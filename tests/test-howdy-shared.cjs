const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process'),{promisify}=require('node:util'),exec=promisify(execFile);
const repo=process.argv[2]||path.resolve(__dirname,'..'),goblin=process.env.SHERIFF_GOBLIN||'goblin',root=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-shared-howdy-'));
const core=path.join(root,'sheriff-core');
const files=['modules/howdy/access.gbln','modules/sheriff_sso/sheriff_sso.gbln','modules/sheriff_sso/service.json','desk/admin/requests/howdy_access_request.gbln','desk/api/howdy_access.gbln'];
for(const rel of files){const file=path.join(core,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.copyFileSync(path.join(repo,'sheriff-core',rel),file);}
fs.mkdirSync(path.join(root,'dist/api'),{recursive:true});fs.copyFileSync(path.join(core,'desk/api/howdy_access.gbln'),path.join(root,'dist/api/howdy_access.gbln'));
fs.mkdirSync(path.join(root,'site/portals/trial/content'),{recursive:true});fs.writeFileSync(path.join(root,'site/portals/trial/config.yall'),'howdy:\n  enabled: true\n');fs.writeFileSync(path.join(root,'site/portals/trial/content/article.md'),'^^^^\ntitle: Trial\n^^^^\nOriginal');
let user='alice',lookups=0,server,child;
const directory=http.createServer((req,res)=>{const u=new URL(req.url,'http://fixture');assert.equal(req.headers.apikey,'public-fixture-key');if(u.pathname==='/auth/v1/user'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.headers.authorization==='Bearer fixture-owner-token'?{id:'stable-owner-id'}:{error:'unauthorized'}));return;}lookups++;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(u.searchParams.get('username')==='eq.'+user?[{id:'stable-editor-id',username:user}]:[]));});
const listen=s=>new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
function data(raw){let r=JSON.parse(raw);while(r&&r.body!==undefined&&r.status!==undefined)r=typeof r.body==='string'?JSON.parse(r.body):r.body;return r;}
(async()=>{try{
 await listen(directory);const identity='http://127.0.0.1:'+directory.address().port;
 const socket=http.createServer();await listen(socket);const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 const env={...process.env,SHERIFF_ROOT:root.replaceAll('\\','/'),SHERIFF_RUNTIME_MODE:'local',SUPABASE_URL:identity,SUPABASE_ANON_KEY:'public-fixture-key',PATH:path.dirname(goblin)+path.delimiter+process.env.PATH};
 child=spawn(goblin,['start','--host','127.0.0.1','--port',String(port)],{cwd:path.join(root,'dist'),env,windowsHide:true,stdio:['ignore','pipe','pipe']});let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 const base='http://127.0.0.1:'+port;let ready=false;for(let n=0;n<60;n++){try{await fetch(base+'/');ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}assert(ready,logs);
 async function request(verb,payload={},origin=base,bearer=''){const response=await fetch(base+'/api/howdy_access?'+verb+'&portal=trial',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(bearer?{Authorization:bearer}:{})},body:JSON.stringify(payload)});return data(await response.text());}
 assert.equal((await request('manage')).policy,'approved');
 assert.equal((await request('manage',{},base,'Bearer invalid-token')).ok,false);
 assert.equal((await request('manage',{},base,'Bearer fixture-owner-token')).ok,true);
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'data/.desk/howdy/trial/access.json'),'utf8')).owner,'stable-owner-id');
 assert.equal((await request('grant',{username:'alice'})).ok,true);assert.equal(lookups,1);
 assert.equal((await request('manage')).editors['stable-editor-id'],'alice');
 assert.equal((await request('grant',{username:'missing'})).ok,false);
 async function policy(verb,payload,subject,owner=false){const result=await exec(goblin,['run','desk/admin/requests/howdy_access_request.gbln'],{cwd:core,env:{...env,SHERIFF_RUNTIME_MODE:'cloud',SHERIFF_ACCESS_OWNER:owner?'1':'0',SHERIFF_ACCESS_SUBJECT:subject,GOBLIN_METHOD:'POST',GOBLIN_QUERY_STRING:verb+'&portal=trial',GOBLIN_BODY:JSON.stringify(payload),GOBLIN_REQUEST_FILE:''},windowsHide:true});return data(result.stdout);}
 // Use the same permission state as the hosted adapter; only its storage root differs.
 const localState=path.join(root,'data/.desk/howdy/trial/access.json'),hostedState=path.join(root,'site/.desk/howdy/trial/access.json');
 function sameState(){fs.mkdirSync(path.dirname(hostedState),{recursive:true});fs.copyFileSync(localState,hostedState);}
 sameState();assert.equal((await policy('page',{path:'content/article.md'},'stable-editor-id')).capabilities.edit_content,true);
 assert.equal((await policy('page',{path:'content/article.md'},'other-account')).capabilities.edit_content,false);
 assert.equal((await request('policy',{policy:'signed_in'})).ok,true);sameState();
 assert.equal((await policy('page',{path:'content/article.md'},'other-account')).capabilities.edit_content,true);
 assert.equal((await policy('page',{path:'content/article.md'},'')).capabilities.edit_content,false);
 assert.equal((await policy('policy',{policy:'approved'},'other-account')).ok,false);
 assert.equal((await request('lock',{path:'content/article.md',locked:true})).ok,true);sameState();assert.equal((await policy('page',{path:'content/article.md'},'other-account')).capabilities.edit_content,false);
 assert.equal((await request('manage',{},'https://unrelated.example')).ok,false);
 assert.equal((await request('policy',{policy:'invented'})).ok,false);
 assert.equal((await request('revoke',{subject:'stable-editor-id'})).ok,true);
 assert(!fs.existsSync(path.join(root,'site/portals/trial/access.json')));
 console.log('Real local Goblin HTTP passed: account-directory resolution, stable-ID grants/revoke, approved/signed-in policies shared with hosted handler, anonymous rejection, owner-only policy changes, page locks, cross-origin rejection; no publishing or Cloud permissions endpoint.');
}finally{if(child&&child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}directory.closeAllConnections();await new Promise(resolve=>directory.close(resolve));fs.rmSync(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});}})().catch(error=>{console.error(error);process.exitCode=1;});
