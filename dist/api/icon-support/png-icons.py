import base64,json,os,re
from pathlib import Path
folder=Path(os.environ['SHERIFF_ICON_DIRECTORY'])
icons=[]
for file in sorted(folder.glob('*.png')):
    if file.is_symlink() or not file.is_file() or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',file.stem) or file.stat().st_size>1048576: continue
    data=file.read_bytes()
    if data[:8]!=b'\x89PNG\r\n\x1a\n': continue
    icons.append({'name':file.stem,'source':'Portal','format':'png','png':'data:image/png;base64,'+base64.b64encode(data).decode('ascii')})
print(json.dumps(icons))
