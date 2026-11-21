// Actual Goblin Desk sync under continuous endpoint reads; disposable files only.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const exec=promisify(execFile),repo=process.env.SHERIFF_REPO||'C:/Users/kc516/Desktop/sheriff',goblin=process.env.SHERIFF_GOBLIN||'C:/Users/kc516/.cargo/bin/goblin.exe';
(async()=>{const temp=await fs.mkdtemp(path.join(os.tmpdir(),'sheriff-desk-sync-'));let timer,reads=0,failures=[];try{
 const core=path.join(temp,'sheriff-core'),source=path.join(temp,'desk'),dist=path.join(temp,'dist');
 async function put(root,file,text){const target=path.join(root,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,text);}
 await put(core,'modules/stagehand/stagehand.gbln',await fs.readFile(path.join(repo,'sheriff-core/modules/stagehand/stagehand.gbln'),'utf8'));await put(core,'build-support/output.gbln',await fs.readFile(path.join(repo,'sheriff-core/build-support/output.gbln'),'utf8'));
 const endpoint=':say(:json_stringify({"ok":true,"done":false}))\n',live=path.join(dist,'api/build_progress.gbln');
 for(const root of [source,dist])await put(root,'api/build_progress.gbln',endpoint);
 await put(source,'api/new.gbln',':say("New endpoint")');await put(source,'admin/app.js','new UI');await put(source,'index.html','new Desk');
 for(let i=0;i<100;i++)await put(source,'admin/panels/'+i+'.js','// '+i+'\n'+'x'.repeat(8192));
 await put(dist,'api/retired.gbln','obsolete API');await put(dist,'admin/retired.gbln','obsolete admin API');await put(dist,'programming/index.html','PORTAL OUTPUT UNCHANGED');
 const stamp=new Date('2001-01-01');await fs.utimes(live,stamp,stamp);
 await put(core,'verify.gbln','import modules/stagehand/stagehand as stagehand\nrepeat 6\n    stagehand::sync_desk("../desk", "../dist")\nxx\n:say("SYNC_OK")\n');
 timer=setInterval(()=>{reads++;fs.readFile(live,'utf8').then(text=>{if(text!==endpoint)failures.push('Incomplete endpoint');},err=>failures.push(err.code));},1);
 const result=await exec(goblin,['run','verify.gbln'],{cwd:core,windowsHide:true,timeout:20000});clearInterval(timer);await new Promise(r=>setTimeout(r,30));assert(result.stdout.includes('SYNC_OK'),result.stdout);assert(reads>10);assert.deepEqual(failures,[]);
 assert.equal((await fs.stat(live)).mtime.toISOString(),stamp.toISOString());assert.equal(await fs.readFile(path.join(dist,'api/new.gbln'),'utf8'),':say("New endpoint")');assert.equal(await fs.readFile(path.join(dist,'admin/app.js'),'utf8'),'new UI');
 for(const file of ['api/retired.gbln','admin/retired.gbln'])assert.equal(await fs.stat(path.join(dist,file)).then(()=>true,()=>false),false);
 assert.equal(await fs.readFile(path.join(dist,'programming/index.html'),'utf8'),'PORTAL OUTPUT UNCHANGED');
 console.log('Passed real Goblin Desk sync: '+reads+' uninterrupted API reads, unchanged endpoint not rewritten, new assets copied, retired endpoints removed, and portal output untouched.');
}finally{clearInterval(timer);assert(temp.startsWith(os.tmpdir()+path.sep));await fs.rm(temp,{recursive:true,force:true,maxRetries:3})}})().catch(error=>{console.error(error);process.exitCode=1});
