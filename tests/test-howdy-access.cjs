const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const os=require('node:os');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-howdy-policy-')),core=path.join(root,'sheriff-core'),goblin=process.env.SHERIFF_GOBLIN||'goblin';
for(const rel of ['modules/howdy/access.gbln','modules/sheriff_sso/sheriff_sso.gbln','modules/sheriff_sso/service.json','desk/admin/requests/howdy_access_request.gbln']){const to=path.join(core,rel);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(__dirname,'../sheriff-core',rel),to);}
fs.mkdirSync(path.join(root,'site/portals/trial/content/article/1.0'),{recursive:true});
const file=path.join(root,'site/portals/trial/content/article.md'),source='^^^^\r\ntitle: A & B\r\ncategories: [Books]\r\n^^^^\r\nOriginal body\r\n';fs.writeFileSync(file,source);
fs.writeFileSync(path.join(root,'site/portals/trial/config.yall'),'howdy:\n  enabled: true\n');
try{
function call(verb,payload={},owner=false,subject='editor',portal='trial'){
 const result=spawnSync(goblin,['run','desk/admin/requests/howdy_access_request.gbln'],{cwd:core,encoding:'utf8',windowsHide:true,env:{...process.env,SHERIFF_ROOT:root,SHERIFF_RUNTIME_MODE:'cloud',SHERIFF_ACCESS_OWNER:owner?'1':'0',SHERIFF_ACCESS_SUBJECT:subject,GOBLIN_QUERY_STRING:verb+'&portal='+portal,GOBLIN_BODY:JSON.stringify(payload),GOBLIN_REQUEST_FILE:''}});
 assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
}
const clear=path.join(root,'site/.desk/howdy');fs.rmSync(clear,{recursive:true,force:true});
assert.equal(call('read',{path:'content/article.md'}).ok,false);
assert.equal(call('grant',{subject:'editor'},false).ok,false);
assert.equal(call('grant',{subject:'editor',label:'Alice'},true).ok,true);
assert.equal(call('read',{path:'content/article.md'},false,'other').ok,false);
assert.equal(call('read',{path:'content/article.md'},false,'editor','other').ok,false);
const read=call('read',{path:'content/article.md'});assert.equal(read.ok,true,read.stderr);assert.equal(read.body,'\r\nOriginal body\r\n');assert.equal(read.base,source);
assert.equal(call('save',{path:'content/article.md',base:source,body:'\nNew content'}).saved,true);
assert.equal(fs.readFileSync(file,'utf8'),'^^^^\r\ntitle: A & B\r\ncategories: [Books]\r\n^^^^\nNew content');
assert.equal(call('save',{path:'content/article.md',base:source,body:'STALE'}).error,'conflict');
assert.equal(call('save',{path:'config.yall',base:source,body:'EVIL'}).ok,false);
assert.equal(call('lock',{path:'content/article.md',locked:true},true).ok,true);
assert.equal(call('page',{path:'content/article/1.0/R99.md'},true).capabilities.locked,true);
for(const paths of [['content/article.md'],['content/article/1.0/R99.md'],['content'],['content/article/1.0/R99.md','content/new.md']])assert.equal(call('guard',{paths},true).error,'locked');
assert.equal(call('save',{path:'content/article.md',base:read.base,body:'NO'},true).ok,false,'Owner must unlock first');
assert.equal(call('guard',{replace_source:true},true).error,'locked');
assert.equal(call('lock',{path:'content/article.md',locked:false},true).ok,true);
assert.equal(call('guard',{paths:['content/article.md']},true).ok,true);
assert.equal(call('revoke',{subject:'editor'},true).ok,true);
assert.equal(call('save',{path:'content/article.md',base:fs.readFileSync(file,'utf8'),body:'revoked'}).ok,false);
assert.equal(call('read',{path:'content/../../config.yall'},true).ok,false);
assert.equal(call('guard',{checked:true,path:'content/article.md',base_path:'content/article.md',base:'outdated'},true).error,'conflict');
assert(!fs.existsSync(path.join(root,'site/portals/trial/access.json')),'Trusted state must remain outside portal source');
// A fence-like value is metadata, not the closing fence.
const fenced='^^^^\ntitle: A ^^^^ B\n^^^^\nOriginal';fs.writeFileSync(file,fenced);assert.equal(call('grant',{subject:'editor'},true).ok,true);assert.equal(call('save',{path:'content/article.md',base:fenced,body:'\nEdited'}).saved,true);assert.equal(fs.readFileSync(file,'utf8'),'^^^^\ntitle: A ^^^^ B\n^^^^\nEdited');
assert.equal(call('lock',{path:'content/R2.md',locked:true},true).ok,true);assert.equal(call('page',{path:'content/article.md'},true).capabilities.locked,false);assert.equal(call('page',{path:'content/R2.md'},true).capabilities.locked,true);
console.log('Howdy Goblin access: owner/editor/anonymous isolation, grant/revoke, body-only save, exact frontmatter retention, stale saves, locks across revisions, mutation/restore guards and path rejection passed.');

}finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
