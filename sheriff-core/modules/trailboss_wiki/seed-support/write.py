# OS-only I/O for the Goblin seeder: reject links and exclusively create articles.
import json, os, pathlib, re, sys, uuid

def run():
    payload_path = pathlib.Path(os.environ['SHERIFF_SEED_REQUEST'])
    payload = json.loads(payload_path.read_text(encoding='utf-8'))
    portal = payload['portal']
    if not re.fullmatch(r'[a-z0-9][a-z0-9_-]*', portal):
        raise ValueError('Invalid portal name.')
    base = pathlib.Path.cwd() / 'site' / 'portals' / portal
    for parent in [base.parent.parent, base.parent, base]:
        if parent.is_symlink(): raise ValueError('Portal links are not supported.')
    if not (base / 'config.yall').is_file(): raise ValueError('Portal not found.')
    def safe(rel):
        parts = rel.split('/')
        if not parts or any(p in ('', '.', '..') for p in parts): raise ValueError('Invalid seed path.')
        current = base
        for part in parts:
            current = current / part
            if current.is_symlink(): raise ValueError('Seed paths cannot contain links.')
        if not current.resolve().is_relative_to(base.resolve()): raise ValueError('Seed path escapes portal.')
        return current
    destination = safe('seeder.yall')
    temporary = base / ('.seeder-' + uuid.uuid4().hex + '.tmp')
    try:
        temporary.write_text(payload['source'], encoding='utf-8', newline='')
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)
    created, failures = [], []
    for item in payload['files']:
        try:
            rel = item['path']
            if not re.fullmatch(r'content/[A-Za-z0-9_./-]+\.md', rel): raise ValueError('Invalid article path.')
            target = safe(rel)
            target.parent.mkdir(parents=True, exist_ok=True)
            safe(rel)
            with target.open('x', encoding='utf-8', newline='') as stream:
                stream.write(item['content'])
            created.append(rel)
        except FileExistsError:
            pass
        except Exception as error:
            failures.append({'path': item.get('path', ''), 'reason': str(error)})
    return {'ok': not failures, 'saved': True, 'created': len(created), 'paths': created, 'failures': failures, 'stderr': 'Some pages could not be created. Review the failures.' if failures else ''}
try:
    result = run()
except Exception as error:
    result = {'ok': False, 'stderr': str(error), 'created': 0, 'paths': []}
print(json.dumps(result, ensure_ascii=False))
