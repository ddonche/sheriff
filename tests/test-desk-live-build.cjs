const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const source=path.resolve(__dirname,'../sheriff-core/desk/api/build-support'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-live-log-'));
const goblin=process.env.SHERIFF_GOBLIN||path.join(os.homedir(),'.cargo/bin/goblin'+(process.platform==='win32'?'.exe':''));
let checks=0;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{try{
 fs.mkdirSync(path.join(temp,'sheriff-core'),{recursive:true});fs.mkdirSync(path.join(temp,'site/portals/test'),{recursive:true});
 fs.cpSync(source,path.join(temp,'support'),{recursive:true});
 fs.writeFileSync(path.join(temp,'wait.cjs'),'setTimeout(()=>{},2000);');
 const waitCommand=process.platform==='win32'?'powershell.exe -NoProfile -Command Start-Sleep -Seconds 2':'sleep 2';
 fs.writeFileSync(path.join(temp,'sheriff-core/main.gbln'),':say("FIRST λ")\n:run_cmd('+JSON.stringify(waitCommand)+')\n:say("LAST")\n');
 const env={...process.env,GOBLIN_NONINTERACTIVE:'1',SHERIFF_GOBLIN:goblin,SHERIFF_LOG_PORTAL:'test',SHERIFF_LOG_MODE:'portal'};
 function helper(action,args={}){const windows=process.platform==='win32',command=windows?'powershell.exe':'python3',parameters=windows?['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(temp,'support/progress.ps1')]:[path.join(temp,'support/progress.py')];const run=spawnSync(command,parameters,{cwd:temp,env:{...env,SHERIFF_LOG_ACTION:action,...args},encoding:'utf8',timeout:10000,windowsHide:true});assert.equal(run.status,0,run.stderr);return JSON.parse(run.stdout);}
 const started=performance.now(),job=helper('start');assert(job.ok,JSON.stringify(job));assert(performance.now()-started<2000,'Starting a build must not wait for it to finish');
 let status,observed=false,stdout='',stderr='',offsets={SHERIFF_LOG_ID:job.id};
 for(let i=0;i<25;i++){
  status=helper('status',offsets);assert(status.ok,JSON.stringify(status));stdout+=status.stdout;stderr+=status.stderr;
  if(status.stdout.includes('FIRST λ')&&!status.done)observed=true;
  offsets={...offsets,SHERIFF_LOG_STDOUT:String(status.next_stdout),SHERIFF_LOG_STDERR:String(status.next_stderr)};
  if(status.done)break;await sleep(150);
 }
 assert(observed,'The first CLI message must arrive before the final result: '+JSON.stringify(status));checks++;
 assert(status.done);assert.equal(status.result.code,0);assert(status.result.ok);assert.equal(stdout,'FIRST λ\nLAST\n');assert(!stdout.includes('"body"'));assert(status.result.build_ms>=1900);checks++;
 assert.equal(helper('status',offsets).stdout,'','Cursor reads must not duplicate output');checks++;
 fs.writeFileSync(path.join(temp,'sheriff-core/main.gbln'),':say("BEFORE FAILURE")\n:read_text("missing-file")\n');
 const failed=helper('start');
 for(let i=0;i<25;i++){status=helper('status',{SHERIFF_LOG_ID:failed.id});if(status.done)break;await sleep(150);}
 assert(status.done);assert.equal(status.result.ok,false);assert.notEqual(status.result.code,0);assert(status.result.stdout.includes('BEFORE FAILURE'));assert(status.result.stderr.includes('missing-file'));checks++;
 assert.equal(helper('start',{SHERIFF_LOG_PORTAL:'../escape'}).ok,false);checks++;
 console.log('Passed '+checks+' real local live-log checks: output before completion, inherited HTTP mode cleared, UTF-8, timing, cursors, failure output, and path validation.');
}finally{assert.equal(path.dirname(temp),path.resolve(os.tmpdir()));assert(path.basename(temp).startsWith('sheriff-live-log-'));fs.rmSync(temp,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
