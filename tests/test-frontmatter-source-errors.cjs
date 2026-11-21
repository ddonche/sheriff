const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const repo=process.env.SHERIFF_TEST_REPO||path.resolve(__dirname,'..'),root=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-frontmatter-errors-')),core=path.join(root,'sheriff-core'),portal=path.join(root,'site/portals/trial');
const put=(file,text)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text)};
fs.cpSync(path.join(repo,'sheriff-core'),core,{recursive:true,filter:file=>!['.vs','node_modules'].includes(path.basename(file))});

put(path.join(portal,'config.yall'),'id: trial\nname: Trial\ntheme:\n  name: outpost\ndocumentation:\n  versions: [0.51.26]\n  default_version: 0.51.26\n');
put(path.join(portal,'nav.yall'),'menus:\n  header:\n    Home: /index.html\n');
put(path.join(portal,'content/index.md'),'^^^^\ntitle: Trial\nlayout: wiki\n^^^^\n\nHome.');
const bad='^^^^\ntitle: Entities & Traits\nlayout: wiki\naliases: [entity, entities & traits]\ncanonical: entities\n^^^^\n\nArchived content.';
const good=bad.replace('entities & traits]','"entities & traits"]');
const r5=path.join(portal,'content/docs/des/entities_traits/0.51.26/R5.md'),r6=r5.replace('R5.md','R6.md');put(r5,bad);put(r6,bad);
function run(script,args=[]){const result=spawnSync(process.env.SHERIFF_GOBLIN||'C:/Users/kc516/.cargo/bin/goblin.exe',['run',script,...args],{cwd:core,env:{...process.env,SHERIFF_RUNTIME_MODE:'cloud'},encoding:'utf8',timeout:15000,windowsHide:true,maxBuffer:4e6});if(result.error)throw result.error;return {...result,output:result.stdout+'\n'+result.stderr};}
put(path.join(core,'check-source.gbln'),'import modules/trailboss_wiki/routes_json as routes\nrecords | routes::source_row_sets("trial")\n:say("OK")\n');
let result=run('check-source.gbln');assert.notEqual(result.status,0);assert(result.output.includes('SHERIFF ERROR: Invalid frontmatter'),result.output);assert(result.output.includes('docs/des/entities_traits/0.51.26/R5.md'),result.output);assert.equal(fs.readFileSync(r5,'utf8'),bad);
put(r5,good);result=run('main.gbln',['trial','page','index.md']);assert.notEqual(result.status,0);assert(result.output.includes('docs/des/entities_traits/0.51.26/R6.md'),result.output);assert(result.output.includes('SHERIFF ERROR: Invalid frontmatter'),result.output);fs.writeFileSync(path.join(root,'sample-error.txt'),result.output);
put(r6,good);result=run('check-source.gbln');assert.equal(result.status,0,result.output);assert.equal(fs.readFileSync(r6,'utf8'),good);
// An ordinary page error must carry its filename too, not only revision discovery.
const legacy=path.join(portal,'content/legacy.md');put(legacy,bad);
put(path.join(core,'check-legacy.gbln'),'import modules/trailboss_wiki/routes_json as routes\nctx | routes::build_routes_json_for_portal("trial")\n');
result=run('check-legacy.gbln');assert.notEqual(result.status,0);assert(result.output.includes('legacy.md'),result.output);assert(result.output.includes('SHERIFF ERROR: Invalid frontmatter'),result.output);
const legacyGood=good.replace('canonical: entities','canonical: legacy');put(legacy,legacyGood);result=run('check-legacy.gbln');assert.equal(result.status,0,result.output);
assert.equal(fs.readFileSync(legacy,'utf8'),legacyGood);console.log('Passed: archived revisions and ordinary pages report source filenames, real single-page build identifies an invalid other revision, corrected metadata parses, source files stay untouched.');
fs.writeFileSync(path.join(root,'verification.json'),JSON.stringify({passed:true,root},null,2));
