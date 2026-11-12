"""Local Desk build output jobs; output is readable while Goblin is running."""
import importlib.util, json, os, re, subprocess, sys, time, uuid
from pathlib import Path
root=Path.cwd().resolve();portal=os.environ.get('SHERIFF_LOG_PORTAL','');action=os.environ.get('SHERIFF_LOG_ACTION','');job_id=os.environ.get('SHERIFF_LOG_ID','')
if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]*',portal): raise ValueError('Invalid portal.')
base=root/'data/.desk/build-logs'/portal

def atomic(file,value):
    temp=file.with_suffix('.tmp');temp.write_text(json.dumps(value),encoding='utf-8');temp.replace(file)
def folder():
    if not re.fullmatch(r'[a-f0-9]{32}',job_id): raise ValueError('Invalid build job.')
    path=base/job_id;path.resolve().relative_to(root)
    for item in [path,*path.parents]:
        if item==root: break
        if item.is_symlink(): raise ValueError('Linked build paths are not supported.')
    return path

def main():
    global job_id
    if action=='start':
        if not (root/'site/portals'/portal).is_dir(): raise ValueError('Unknown portal.')
        mode=os.environ.get('SHERIFF_LOG_MODE','portal');target=os.environ.get('SHERIFF_LOG_TARGET','')
        if mode not in ('page','portal'): raise ValueError('Invalid build mode.')
        if mode=='page' and (not target.endswith('.md') or target.startswith('/') or '..' in Path(target).parts): raise ValueError('Invalid page.')
        job_id=uuid.uuid4().hex;job=folder();job.mkdir(parents=True)
        atomic(job/'request.json',{'mode':mode,'target':target})
        env=dict(os.environ,SHERIFF_LOG_ACTION='worker',SHERIFF_LOG_ID=job_id)
        subprocess.Popen([sys.executable,__file__],cwd=root,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        return {'ok':True,'id':job_id}
    job=folder()
    if action=='worker':
        request=json.loads((job/'request.json').read_text());started=time.perf_counter()
        args=[os.environ.get('SHERIFF_GOBLIN','goblin'),'run','main.gbln',portal]
        env=dict(os.environ,SHERIFF_PAGE_TARGET=request['target'],GOBLIN_NONINTERACTIVE='0')
        if request['mode']=='page':args.append('page')
        lifecycle=None;output_job=None
        try:
            helper=root/'sheriff-core/build-support/lifecycle.py'
            if request['mode']=='portal' and helper.is_file():
                os.environ.update(SHERIFF_BUILD_PORTAL=portal,SHERIFF_BUILD_OWNER_PID=str(os.getpid()),SHERIFF_LIFECYCLE_ROOT=str(root))
                spec=importlib.util.spec_from_file_location('sheriff_build_lifecycle',helper)
                lifecycle=importlib.util.module_from_spec(spec);spec.loader.exec_module(lifecycle)
                lifecycle.phase='begin';output_job=lifecycle.main();env['SHERIFF_BUILD_OUTPUT']=output_job['output']
            with (job/'stdout.txt').open('wb') as out,(job/'stderr.txt').open('wb') as err:
                result=subprocess.run(args,cwd=root/'sheriff-core',env=env,stdout=out,stderr=err,timeout=180)
            if output_job:
                lifecycle.phase='activate' if result.returncode==0 else 'abort';lifecycle.build_id=output_job['id']
                activated=lifecycle.main();output_job=None
                with (job/'stdout.txt').open('ab') as out:out.write((activated['message']+'\n').encode('utf-8'))
            stdout=(job/'stdout.txt').read_text(encoding='utf-8',errors='replace');stderr=(job/'stderr.txt').read_text(encoding='utf-8',errors='replace')
            footer=re.search(r'goblin run .+ → exit \d+ in (\d+)ms',stderr)
            atomic(job/'result.json',{'ok':result.returncode==0,'code':result.returncode,'stdout':stdout,'stderr':stderr,'build_ms':int(footer[1]) if footer else (time.perf_counter()-started)*1000})
        except Exception as error:
            if output_job:
                try:
                    lifecycle.phase='abort';lifecycle.build_id=output_job['id'];lifecycle.main()
                except Exception:pass
            atomic(job/'result.json',{'ok':False,'code':1,'stdout':'','stderr':str(error),'build_ms':(time.perf_counter()-started)*1000})
        return {'ok':True}
    if action=='status':
        if not (job/'request.json').is_file(): raise ValueError('Unknown build job.')
        output={}
        for stream in ('stdout','stderr'):
            file=job/(stream+'.txt');text=file.read_text(encoding='utf-8',errors='replace') if file.exists() else ''
            offset=max(0,int(os.environ.get('SHERIFF_LOG_'+stream.upper(),'0')))
            output[stream]=text[offset:];output['next_'+stream]=len(text)
        result=job/'result.json';output['done']=result.exists()
        if result.exists():output['result']=json.loads(result.read_text())
        return {'ok':True,**output}
    raise ValueError('Unknown action.')
try:print(json.dumps(main()))
except Exception as error:print(json.dumps({'ok':False,'stderr':str(error)}))
