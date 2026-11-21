const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const os=require('node:os');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-howdy-local-')),repo=path.resolve(__dirname,'..'),goblin=process.env.SHERIFF_GOBLIN||'goblin';
for(const rel of ['modules/howdy/access.gbln','modules/sheriff_sso/sheriff_sso.gbln','modules/sheriff_sso/service.json','desk/api/file.gbln','desk/api/snapshots.gbln','desk/api/cloud.gbln','desk/api/howdy_access.gbln','desk/admin/requests/howdy_access_request.gbln']){const to=path.join(root,'sheriff-core',rel);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(repo,'sheriff-core',rel),to);if(rel.startsWith('desk/api/')){const api=path.join(root,'dist/api',path.basename(rel));fs.mkdirSync(path.dirname(api),{recursive:true});fs.copyFileSync(to,api);}}
const source='^^^^\ntitle: Trial\n^^^^\nOriginal',file=path.join(root,'site/portals/trial/content/article.md');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,source);fs.writeFileSync(path.join(root,'site/portals/trial/config.yall'),'id: trial\n');
function run(script,query,payload='',extra={}){const result=spawnSync(goblin,['run','api/'+script+'.gbln'],{cwd:path.join(root,'dist'),encoding:'utf8',windowsHide:true,env:{...process.env,SHERIFF_ROOT:root,SHERIFF_RUNTIME_MODE:'local',GOBLIN_QUERY_STRING:query,GOBLIN_METHOD:'POST',GOBLIN_BODY:typeof payload==='string'?payload:JSON.stringify(payload),GOBLIN_REQUEST_FILE:'',PATH:path.isAbsolute(goblin)?path.dirname(goblin)+path.delimiter+process.env.PATH:process.env.PATH,...extra}});assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);}
try{
 assert.equal(run('howdy_access','lock&portal=trial',{path:'content/article.md',locked:true}).ok,true);
 for(const query of ['write&portal=trial&path=content/article.md','write&portal=trial&path=content/article/1.0/R4.md','delete&trial&content/article.md','move&trial&content/article.md&content/other.md'])assert.equal(run('file',query,'Changed').error,'locked',query);
 assert.equal(run('snapshots','restore&portal=trial&id=fake').error,'locked');assert.equal(run('cloud','import&portal=trial').error,'locked');
 assert.equal(fs.readFileSync(file,'utf8'),source);
 assert.equal(run('howdy_access','lock&portal=trial',{path:'content/article.md',locked:false}).ok,true);
 const query='write&portal=trial&path=content/article.md&checked=1&build=none';
 assert.equal(run('file',query,{content:'New',base:'outdated',base_path:'content/article.md'}).error,'conflict');
 assert.equal(fs.readFileSync(file,'utf8'),source);
 const saved=run('file',query,{content:source+'\nChanged',base:source,base_path:'content/article.md'});assert.equal(saved.ok,true,saved.stderr);assert.equal(fs.readFileSync(file,'utf8'),source+'\nChanged');
 assert.equal(run('howdy_access','page&portal=trial',{path:'content/article.md'},{GOBLIN_HEADERS_JSON:JSON.stringify({host:'attacker.test',origin:'http://attacker.test'})}).ok,false);
 assert.equal(run('howdy_access','manage&portal=trial',{}, {SHERIFF_RUNTIME_MODE:'cloud'}).ok,false,'Exported CGI must not provide a Cloud authorization bypass');
 console.log('Local exported Desk API passed persistent page locks, revision/move/delete/restore/pull guards, checked source saves, conflict preservation and Cloud adapter denial.');
}finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
