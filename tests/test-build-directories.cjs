const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const repo=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-build-dirs-')),core=path.join(temp,'sheriff-core');
const output=path.join(temp,'dist/test'),history=path.join(temp,'data/.desk/builds/test');
function put(rel,body){const p=path.join(temp,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,body);}
function hashes(dir,prefix=''){if(!fs.existsSync(dir))return {};return Object.fromEntries(fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?Object.entries(hashes(path.join(dir,e.name),prefix+e.name+'/')):[[prefix+e.name,crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,e.name))).digest('hex')]]));}
function run(ok=true){const r=spawnSync(process.env.SHERIFF_GOBLIN||'goblin',['run','main.gbln','test'],{cwd:core,encoding:'utf8',timeout:20000,env:{...process.env,SHERIFF_RUNTIME_MODE:'cloud',SHERIFF_BUILD_DEFER_ACTIVATION:'',SHERIFF_BUILD_OUTPUT:''}});if(ok)assert.equal(r.status,0,r.stdout+'\n'+r.stderr);else assert.notEqual(r.status,0);return r;}
try {
 fs.cpSync(path.join(repo,'sheriff-core'),core,{recursive:true});
 put('site/portals/test/config.yall','name: Build test\ntheme:\n  name: compendium\n');
 function page(text){put('site/portals/test/content/notes.md','^^^^\ntitle: Notes\nlayout: wiki\n^^^^\n\n'+text);}
 page('FIRST completed build');run();const first=hashes(output);assert(!fs.existsSync(path.join(history,'previous')));assert(!fs.existsSync(path.join(history,'next')));
 assert(!fs.existsSync(path.join(temp,'data/backups/test/latest.zip')));
 page('SECOND completed build');run();const second=hashes(output);assert.notDeepEqual(first,second);assert.deepEqual(hashes(path.join(history,'previous')),first);
 page('THIRD completed build');run();const third=hashes(output);assert.deepEqual(hashes(path.join(history,'previous')),second);
 assert.deepEqual(fs.readdirSync(history).sort(),['current.json','previous']);
 const events=path.join(core,'events.yall');fs.writeFileSync(events,fs.readFileSync(events,'utf8').replace('pre:\n','pre:\n  - "regression::fail_build"\n'));
 fs.appendFileSync(path.join(core,'manifest.imports'),'\nimport modules/regression/regression as regression\n');
 put('sheriff-core/modules/regression/regression.gbln','act fail_build(ctx)\n:read_text("deliberate-build-failure")\nreturn ctx\nxx\n');
 const failed=run(false);assert.match(failed.stderr,/regression.gbln.*read_text/s);assert.deepEqual(hashes(output),third);assert.deepEqual(hashes(path.join(history,'previous')),second);
 assert(!fs.existsSync(path.join(history,'next')));assert(!fs.existsSync(path.join(history,'lease')));
 assert(!Object.keys(third).some(p=>p.includes('previous')||p.includes('current.json')));
 console.log('Passed retained-build checks: no ZIP, fresh output, one private previous build, bounded retention, and unchanged current/previous output after a real Goblin failure.');
}finally{assert.equal(path.dirname(temp),path.resolve(os.tmpdir()));assert(path.basename(temp).startsWith('sheriff-build-dirs-'));fs.rmSync(temp,{recursive:true,force:true});}
