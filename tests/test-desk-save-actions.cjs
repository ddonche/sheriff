// Local save/build contract, using a disposable source tree and a tiny build fixture.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-save-actions-')),core=path.join(tmp,'sheriff-core'),portal=path.join(tmp,'site/portals/test');
fs.mkdirSync(core,{recursive:true});fs.mkdirSync(portal,{recursive:true});fs.copyFileSync(path.join(root,'sheriff-core/desk/api/file.gbln'),path.join(core,'file.gbln'));
fs.writeFileSync(path.join(core,'main.gbln'),'if args.len == 2\n    :put_last!(args, :env("SHERIFF_PAGE_TARGET"))\nxx\n:write_json!("../build-call.json", args)\nif :file_exists("../fail-build")\n    :read_text("forced-build-failure")\nxx\n:say("Fixture built")\n');
let checks=0;
function unwrap(v){for(let n=0;n<8;n++){if(typeof v==='string'){try{v=JSON.parse(v);continue}catch{break}}if(v&&typeof v.body==='string'&&typeof v.status==='number'){v=v.body;continue}break}return v;}
function write(file,build,text='Saved draft'){const r=spawnSync(process.env.SHERIFF_GOBLIN||'goblin',['run','file.gbln'],{cwd:core,encoding:'utf8',timeout:30000,env:{...process.env,SHERIFF_ROOT:tmp.replaceAll('\\','/'),GOBLIN_QUERY_STRING:'write&'+new URLSearchParams({portal:'test',path:file,...(build===undefined?{}:{build})}),GOBLIN_BODY:text,GOBLIN_REQUEST_FILE:''}});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);return unwrap(r.stdout.trim());}
try{
 let r=write('content/a.md');assert.equal(r.saved,true);assert.equal(fs.existsSync(path.join(tmp,'build-call.json')),false);checks++;
 r=write('content/a.md','none','');assert.equal(r.saved,true);assert.equal(fs.readFileSync(path.join(portal,'content/a.md'),'utf8'),'');assert(!fs.existsSync(path.join(tmp,'build-call.json')));checks++;
 r=write('content/a.md','page');assert.equal(r.code,0,JSON.stringify(r));assert.equal(r.saved,true);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(tmp,'build-call.json'),'utf8')),['test','page','a.md']);checks++;
 r=write('content/a b.md','page');assert.equal(r.code,0,JSON.stringify(r));assert.deepEqual(JSON.parse(fs.readFileSync(path.join(tmp,'build-call.json'),'utf8')),['test','page','a b.md']);checks++;
 r=write('content/a.md','portal');assert.equal(r.code,0);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(tmp,'build-call.json'),'utf8')),['test']);checks++;
 fs.rmSync(path.join(tmp,'build-call.json'));r=write('config.yall','none','name: Draft');assert.equal(r.saved,true);assert(!fs.existsSync(path.join(tmp,'build-call.json')));checks++;
 r=write('config.yall','page','name: Bad');assert.equal(r.ok,false);assert.equal(fs.readFileSync(path.join(portal,'config.yall'),'utf8'),'name: Draft');checks++;
 r=write('content/a.md','invalid','Do not write');assert.equal(r.ok,false);assert.equal(fs.readFileSync(path.join(portal,'content/a.md'),'utf8'),'Saved draft');checks++;
 fs.writeFileSync(path.join(tmp,'fail-build'),'1');r=write('content/a.md','page','Source survives failure');assert.notEqual(r.code,0);assert.equal(r.saved,true);assert.equal(fs.readFileSync(path.join(portal,'content/a.md'),'utf8'),'Source survives failure');checks++;
 console.log('Passed '+checks+' local save/build action checks: default/save-only, empty Markdown, one-page command, spaces, portal command, validation, and saved-source build failure. Temporary fixtures only.');
}finally{assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));assert(path.basename(tmp).startsWith('sheriff-save-actions-'));fs.rmSync(tmp,{recursive:true,force:true});}
