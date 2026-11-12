"""Private, bounded full-build output lifecycle. Run from sheriff-core."""
import json, os, re, shutil, subprocess, sys, time, uuid
from pathlib import Path

root = Path(os.environ['SHERIFF_LIFECYCLE_ROOT']).resolve() if os.environ.get('SHERIFF_LIFECYCLE_ROOT') else Path.cwd().resolve().parent
portal = os.environ.get('SHERIFF_BUILD_PORTAL', '')
phase = os.environ.get('SHERIFF_BUILD_PHASE', '')
build_id = os.environ.get('SHERIFF_BUILD_ID', '')
if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]*', portal):
    raise ValueError('Invalid portal.')
base = root / 'data/.desk/builds' / portal
active = root / 'dist' / portal
work, previous, lease = base / 'next', base / 'previous', base / 'lease'

def checked(path):
    path.absolute().relative_to(root)
    for part in [path, *path.parents]:
        if part == root: break
        if part.is_symlink(): raise ValueError('Linked build paths are not supported.')
    return path

def remove(path):
    checked(path)
    if path.exists(): shutil.rmtree(path)

def write(path, value):
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value), encoding='utf-8')
    temp.replace(path)

def process(pid):
    try:
        fields = Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()
        return {'pid': pid, 'stamp': fields[19], 'parent': int(fields[1]),
                'name': Path(f'/proc/{pid}/comm').read_text().strip()}
    except FileNotFoundError:
        if Path('/proc').is_dir(): return None
        result = subprocess.run(['ps', '-p', str(pid), '-o', 'ppid=,comm=,lstart='], capture_output=True, text=True)
        fields = result.stdout.strip().split()
        if not fields: return None
        return {'pid': pid, 'parent': int(fields[0]), 'name': Path(fields[1]).name, 'stamp': ' '.join(fields[2:])}

def owner():
    supplied = os.environ.get('SHERIFF_BUILD_OWNER_PID')
    if supplied: return process(int(supplied))
    pid = os.getppid()
    fallback = process(pid)
    for _ in range(8):
        item = process(pid)
        if not item: break
        if item['name'].lower().startswith('goblin'): return item
        pid = item['parent']
    return fallback

def load():
    data = json.loads((lease / 'job.json').read_text())
    if data['id'] != build_id: raise ValueError('Build ownership changed.')
    return data

def main():
    global build_id
    checked(base); checked(active)
    base.mkdir(parents=True, exist_ok=True)
    if phase == 'begin':
        if lease.exists():
            meta = lease / 'job.json'
            if not meta.exists() and time.time() - lease.stat().st_mtime < 30:
                raise ValueError('Another build is starting for this portal.')
            old = json.loads(meta.read_text()) if meta.exists() else {}
            running = process(old.get('owner', {}).get('pid', -1)) if old.get('owner') else None
            if running and running['stamp'] == old['owner']['stamp']:
                raise ValueError('Another build is running for this portal.')
            remove(lease)
        lease.mkdir()
        try:
            remove(work)
            work.mkdir()
            build_id = uuid.uuid4().hex
            data = {'id': build_id, 'portal': portal, 'output': str(work), 'owner': owner(), 'state': 'building'}
            write(lease / 'job.json', data)
            return {**data, 'message': 'Building fresh output; the current site is unchanged.'}
        except Exception:
            remove(lease)
            raise
    data = load()
    if phase == 'ready':
        data['state'] = 'ready'; write(lease / 'job.json', data)
        return {**data, 'message': 'Build complete; output ready for publishing.'}
    if phase == 'abort':
        remove(work); remove(lease)
        return {'message': 'Incomplete output removed; the current site is unchanged.'}
    if phase == 'upload-failed':
        data['state'] = 'upload-failed'; write(base / 'pending.json', data)
        remove(lease)
        return {'message': 'Upload failed; current output and one pending build retained.'}
    if phase != 'activate': raise ValueError('Invalid build phase.')
    if not work.is_dir(): raise ValueError('Completed output is missing.')
    remove(previous)
    active.parent.mkdir(parents=True, exist_ok=True)
    moved = active.exists()
    if moved: active.rename(previous)
    try: work.rename(active)
    except Exception:
        if moved: previous.rename(active)
        raise
    write(base / 'current.json', {'id': data['id'], 'portal': portal, 'output': str(active), 'state': 'complete'})
    (base / 'pending.json').unlink(missing_ok=True)
    remove(lease)
    return {'output': str(active), 'message': 'Activated completed output; one previous build retained privately.'}

if __name__ == '__main__':
    try:
        print(json.dumps(main()))
    except Exception as error:
        print('Build output: ' + str(error), file=sys.stderr)
        sys.exit(1)
