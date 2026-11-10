"""Reproduce Windows error 32 with an open output folder; use disposable files only."""
from pathlib import Path
import ctypes, os, shutil, subprocess, tempfile, zipfile
repo=Path(__file__).resolve().parents[1]
text=(repo/'sheriff-core/main.gbln').read_text(encoding='utf-8')
helpers=text[text.index('act create_all_dirs'):text.index('/// --- helper: run pre schedule')]
tmp=Path(tempfile.mkdtemp(prefix='sheriff-locked-output-'))
handle=None
try:
 core=tmp/'sheriff-core';core.mkdir();output=tmp/'dist/fixture';images=output/'public/images';images.mkdir(parents=True)
 (output/'old.html').write_text('old generated page');(images/'extensionless').write_text('old asset')
 if os.name=='nt':
  kernel=ctypes.WinDLL('kernel32',use_last_error=True)
  kernel.CreateFileW.argtypes=[ctypes.c_wchar_p,ctypes.c_uint32,ctypes.c_uint32,ctypes.c_void_p,ctypes.c_uint32,ctypes.c_uint32,ctypes.c_void_p]
  kernel.CreateFileW.restype=ctypes.c_void_p;kernel.CloseHandle.argtypes=[ctypes.c_void_p]
  handle=kernel.CreateFileW(str(images),1,3,None,3,0x02000000,None)
  assert handle!=ctypes.c_void_p(-1).value
  # Prove this fixture reproduces the exact deletion failure before checking the fix.
  (core/'old.gbln').write_text('#local::portal | "fixture"\n:delete_path!("../dist/fixture")\n')
  old=subprocess.run([shutil.which('goblin'),'run','old.gbln'],cwd=core,capture_output=True,text=True)
  assert old.returncode!=0 and 'os error 32' in old.stderr,old.stderr
  (output/'old.html').write_text('old generated page');(images/'extensionless').write_text('old asset')
 (core/'check.gbln').write_text(helpers+'\n#local::portal | "fixture"\n:say(backup_dist())\n',encoding='utf-8')
 fixed=subprocess.run([shutil.which('goblin'),'run','check.gbln'],cwd=core,capture_output=True,text=True)
 assert fixed.returncode==0,fixed.stdout+'\n'+fixed.stderr
 assert images.is_dir() and not (output/'old.html').exists() and not (images/'extensionless').exists()
 with zipfile.ZipFile(tmp/'data/backups/fixture/latest.zip') as z:
  names=z.namelist();assert any(n.endswith('old.html') for n in names) and any(n.endswith('extensionless') for n in names),names
 print('Passed locked-output regression: reproduced error 32, backup retained all files, cleanup removed stale files and preserved the locked directory.')
finally:
 if handle is not None:kernel.CloseHandle(handle)
 assert tmp.parent==Path(tempfile.gettempdir()) and tmp.name.startswith('sheriff-locked-output-')
 shutil.rmtree(tmp)
