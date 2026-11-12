"""Complete-output activation with a Windows folder held open; disposable files only."""
from pathlib import Path
import ctypes,json,os,shutil,subprocess,tempfile
repo=Path(__file__).resolve().parents[1]
tmp=Path(tempfile.mkdtemp(prefix='sheriff-locked-output-'));handle=None
try:
 core=tmp/'sheriff-core';core.mkdir();shutil.copytree(repo/'sheriff-core/build-support',core/'build-support')
 output=tmp/'dist/fixture';images=output/'public/images';images.mkdir(parents=True)
 (output/'old.html').write_text('old generated page');(images/'old.asset').write_text('old asset')
 env=dict(os.environ,SHERIFF_BUILD_PORTAL='fixture',SHERIFF_BUILD_OWNER_PID=str(os.getpid()))
 def phase(name,build_id=''):
  command=['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File','build-support/lifecycle.ps1'] if os.name=='nt' else ['python3','build-support/lifecycle.py']
  result=subprocess.run(command,cwd=core,env=dict(env,SHERIFF_BUILD_PHASE=name,SHERIFF_BUILD_ID=build_id),capture_output=True,text=True)
  assert result.returncode==0,result.stdout+'\n'+result.stderr
  return json.loads(result.stdout)
 job=phase('begin');work=Path(job['output']);(work/'new.html').write_text('new complete page');(work/'public/images').mkdir(parents=True);(work/'public/images/new.asset').write_text('new asset')
 if os.name=='nt':
  kernel=ctypes.WinDLL('kernel32',use_last_error=True);kernel.CreateFileW.argtypes=[ctypes.c_wchar_p,ctypes.c_uint32,ctypes.c_uint32,ctypes.c_void_p,ctypes.c_uint32,ctypes.c_uint32,ctypes.c_void_p];kernel.CreateFileW.restype=ctypes.c_void_p;kernel.CloseHandle.argtypes=[ctypes.c_void_p]
  handle=kernel.CreateFileW(str(images),1,3,None,3,0x02000000,None)
  assert handle!=ctypes.c_void_p(-1).value
 phase('activate',job['id'])
 assert (output/'new.html').read_text()=='new complete page' and (images/'new.asset').exists()
 assert not (output/'old.html').exists() and not (images/'old.asset').exists()
 previous=tmp/'data/.desk/builds/fixture/previous'
 assert (previous/'old.html').exists() and (previous/'public/images/old.asset').exists()
 assert not work.exists() and not (tmp/'data/backups/fixture/latest.zip').exists()
 print('Passed locked-output activation: completed files activated, stale files removed, one private previous build retained, and no ZIP compression.')
finally:
 if handle is not None:kernel.CloseHandle(handle)
 assert tmp.parent==Path(tempfile.gettempdir()) and tmp.name.startswith('sheriff-locked-output-')
 shutil.rmtree(tmp)
