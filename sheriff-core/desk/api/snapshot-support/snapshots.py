"""Portable Desk snapshot helper (Python 3 standard library on macOS/Linux)."""
import base64
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import sys
import uuid
import zipfile

ROOT = Path(os.environ.get('SHERIFF_SNAPSHOT_ROOT', '.')).resolve()
PORTAL = os.environ.get('SHERIFF_SNAPSHOT_PORTAL', '')
ACTION = os.environ.get('SHERIFF_SNAPSHOT_ACTION', '')
ID = os.environ.get('SHERIFF_SNAPSHOT_ID', '')

def inside(relative):
    path = Path(os.path.abspath(ROOT / relative))
    path.relative_to(ROOT)
    for part in (path, *path.parents):
        if part.is_symlink() or getattr(part, 'is_junction', lambda: False)():
            raise ValueError('Linked snapshot or portal paths are not supported.')
        if part == ROOT:
            break
    return path

def portal_id(value):
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]*', value):
        raise ValueError('Invalid portal ID.')

def source_ok(source):
    if not source.is_dir():
        raise ValueError('Portal source directory not found.')
    for directory, dirs, files in os.walk(source, followlinks=False):
        for name in dirs + files:
            inside(str((Path(directory) / name).relative_to(ROOT)))

def checksum(path):
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()

def snapshot(snapshot_id):
    if not re.fullmatch(r'[a-f0-9]{32}', snapshot_id):
        raise ValueError('Invalid snapshot ID.')
    meta_path = inside(f'data/snapshots/{PORTAL}/{snapshot_id}.json')
    archive = inside(f'data/snapshots/{PORTAL}/{snapshot_id}.zip')
    if not meta_path.is_file() or not archive.is_file():
        raise ValueError('Snapshot not found.')
    meta = json.loads(meta_path.read_text(encoding='utf-8-sig'))
    if meta.get('id') != snapshot_id or meta.get('portal') != PORTAL:
        raise ValueError('Snapshot metadata does not match this portal.')
    meta['bytes'] = archive.stat().st_size
    return meta, archive

class PortalLock:
    def __init__(self, folder):
        self.path = inside(str((folder / '.operation.lock').relative_to(ROOT)))
        self.handle = None
    def __enter__(self):
        self.handle = self.path.open('a+b')
        try:
            if os.name == 'nt':
                import msvcrt
                self.handle.seek(0)
                if not self.handle.read(1):
                    self.handle.write(b'0')
                    self.handle.flush()
                self.handle.seek(0)
                msvcrt.locking(self.handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            self.handle.close()
            raise ValueError('Another snapshot operation is running for this portal.')
        return self
    def __exit__(self, *_):
        self.handle.close()

def extract(archive, destination):
    destination.mkdir(parents=True)
    seen = set()
    with zipfile.ZipFile(archive) as source:
        for entry in source.infolist():
            name = entry.filename.replace('\\', '/')
            parts = name.rstrip('/').split('/')
            if not name or name.startswith('/') or ':' in name or any(p in ('', '.', '..') for p in parts):
                raise ValueError('Snapshot contains an unsafe archive path.')
            if stat.S_ISLNK(entry.external_attr >> 16):
                raise ValueError('Snapshot contains a symbolic link.')
            key = os.path.normcase(name.rstrip('/'))
            if key in seen:
                raise ValueError('Snapshot contains duplicate archive paths.')
            seen.add(key)
            target = destination.joinpath(*parts)
            target.resolve().relative_to(destination.resolve())
            if name.endswith('/'):
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with source.open(entry) as reader, target.open('xb') as writer:
                    shutil.copyfileobj(reader, writer)
                mode = (entry.external_attr >> 16) & 0o777
                if mode:
                    target.chmod(mode)
                stamp = dt.datetime(*entry.date_time).timestamp()
                os.utime(target, (stamp, stamp))

def main():
    base = inside('data/snapshots')
    if ACTION == 'list' and not PORTAL:
        portals = []
        if base.is_dir():
            for folder in base.iterdir():
                if folder.is_dir():
                    portal_id(folder.name)
                    checked = inside(f'data/snapshots/{folder.name}')
                    if any(checked.glob('*.json')):
                        portals.append(folder.name)
        return {'ok': True, 'portals': sorted(portals)}
    portal_id(PORTAL)
    source = inside(f'site/portals/{PORTAL}')
    folder = inside(f'data/snapshots/{PORTAL}')
    if ACTION == 'list':
        items = [snapshot(path.stem)[0] for path in folder.glob('*.json')] if folder.is_dir() else []
        return {'ok': True, 'snapshots': sorted(items, key=lambda item: item['created_at'], reverse=True)}
    if ACTION == 'create':
        source_ok(source)
        folder.mkdir(parents=True, exist_ok=True)
    if not folder.is_dir():
        raise ValueError('Snapshot not found.')
    with PortalLock(folder):
        if ACTION == 'create':
            raw = os.environ.get('SHERIFF_SNAPSHOT_BODY', '')
            if len(raw) > 4096:
                raise ValueError('Snapshot name is too long.')
            name = json.loads(raw).get('name', '') if raw else ''
            if name is None:
                name = ''
            if not isinstance(name, str):
                raise ValueError('Snapshot name must be text.')
            name = name.strip()
            if len(name) > 160:
                raise ValueError('Snapshot name must be 160 characters or fewer.')
            new_id = uuid.uuid4().hex
            archive = inside(f'data/snapshots/{PORTAL}/{new_id}.zip')
            partial = inside(f'data/snapshots/{PORTAL}/{new_id}.partial')
            meta_path = inside(f'data/snapshots/{PORTAL}/{new_id}.json')
            meta_partial = meta_path.with_suffix('.json.partial')
            try:
                with zipfile.ZipFile(partial, 'w', compression=zipfile.ZIP_DEFLATED, allowZip64=True) as writer:
                    for directory, dirs, files in os.walk(source):
                        for item in dirs + files:
                            path = Path(directory) / item
                            writer.write(path, path.relative_to(source).as_posix())
                partial.replace(archive)
                meta = {'id': new_id, 'portal': PORTAL, 'name': name, 'created_at': dt.datetime.now(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z'), 'bytes': archive.stat().st_size, 'sha256': checksum(archive)}
                meta_partial.write_text(json.dumps(meta, ensure_ascii=False), encoding='utf-8')
                meta_partial.replace(meta_path)
                return {'ok': True, 'snapshot': meta}
            except Exception:
                for path in (partial, archive, meta_path, meta_partial):
                    path.unlink(missing_ok=True)
                raise
        meta, archive = snapshot(ID)
        if ACTION == 'download':
            return {'ok': True, 'filename': f'{PORTAL}-{ID}.zip', 'zip_base64': base64.b64encode(archive.read_bytes()).decode('ascii')}
        if ACTION == 'delete':
            archive.unlink()
            inside(f'data/snapshots/{PORTAL}/{ID}.json').unlink()
            return {'ok': True}
        if ACTION == 'restore':
            if checksum(archive) != meta.get('sha256'):
                raise ValueError('Snapshot ZIP failed its integrity check. Current portal files were kept.')
            if source.exists():
                source_ok(source)
            stage = inside(f'data/snapshots/{PORTAL}/.restore-{uuid.uuid4().hex}')
            fresh, previous = stage / 'source', stage / 'previous'
            try:
                extract(archive, fresh)
                source.parent.mkdir(parents=True, exist_ok=True)
                if source.exists():
                    source.rename(previous)
                try:
                    fresh.rename(source)
                except Exception:
                    if previous.exists() and not source.exists():
                        previous.rename(source)
                    raise
            except Exception as error:
                if previous.exists():
                    raise ValueError(f'Restore failed. Recovery files are preserved at {previous}. {error}')
                if stage.exists():
                    shutil.rmtree(stage)
                raise
            result = {'ok': True, 'snapshot': meta}
            try:
                shutil.rmtree(stage)
            except OSError:
                result['warning'] = f'Restored. Temporary recovery files remain at {stage}.'
            return result
        raise ValueError('Unknown snapshot action.')

try:
    print(json.dumps(main(), ensure_ascii=False))
except Exception as error:
    print(json.dumps({'ok': False, 'stderr': str(error)}, ensure_ascii=False))
