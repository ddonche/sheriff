// Full and page builds run against disposable portals only.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-page-build-')),core=path.join(tmp,'sheriff-core');
let checks=0;
function put(rel,text){const file=path.join(tmp,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);return file;}
function files(dir,prefix=''){if(!fs.existsSync(dir))return [];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name),prefix+e.name+'/'):[prefix+e.name]).sort();}
function snapshot(dir){return Object.fromEntries(files(dir).map(rel=>[rel,crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,rel))).digest('hex')]));}
function run(args){const started=Date.now(),r=spawnSync(process.env.SHERIFF_GOBLIN||'goblin',['run','main.gbln','test',...args],{cwd:core,encoding:'utf8',timeout:60000,env:{...process.env,SHERIFF_RUNTIME_MODE:'cloud'}});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);return {...r,ms:Date.now()-started};}
try{
 fs.cpSync(path.join(repo,'sheriff-core'),core,{recursive:true});
 put('site/portals/test/config.yall','name: Test\nsite_url: https://test.example\ntheme:\n  name: compendium\n');
 put('site/portals/test/nav.yall','menus:\n  left_docs:\n    Notes: /notes.html\n    Unrelated: "[[unrelated]]"\n  header:\n    Home: /\n  footer_left:\n    Home: /\n  footer_right:\n    Home: /\n');
 put('site/portals/test/content/notes.md','^^^^\ntitle: Notes\nlayout: wiki\ncategories:\n  - Examples\n^^^^\n\n# Notes\n\n[[unrelated]] [[icon|book]] [[image:used.svg|half|left|Used]]\n\n{{{SHERIFF::PATTERN_NOTICE}}}\n\n{{{BADGE::STATS}}}\n');
 put('site/portals/test/content/unrelated.md','^^^^\ntitle: Unrelated\nlayout: wiki\ncategories:\n  - Examples\n^^^^\n\nUnrelated content [[video:youtube|UNRELATED|full|center|Other]].');
 put('site/portals/test/patterns/notice.txt','::: pattern horizontal Notice\n@mode = reusable\ntext = Page pattern works\n:::');
 put('site/portals/test/public/images/used.svg','<svg xmlns="http://www.w3.org/2000/svg"/>');
 put('site/portals/test/public/images/unused.svg','Unused media sentinel');
 put('dist/index.html','CLOUD APP SENTINEL');put('dist/admin/sentinel.txt','ADMIN SENTINEL');
 const full=run([]),output=path.join(tmp,'dist/test'),source=path.join(tmp,'site/portals/test');
 assert(full.stdout.includes('rjson::build_all_pages_once'));assert(fs.existsSync(path.join(output,'unrelated.html')));checks+=2;
 put('site/portals/test/content/index.html','CUSTOM INDEX MUST NOT BE COPIED BY A PAGE BUILD');
 const afterFull=snapshot(source),beforeOutputs=snapshot(output);
 // Any pre/post invocation now fails, including an accidental full-build fallback.
 const events=path.join(core,'events.yall'),config=fs.readFileSync(events,'utf8'),schedule=config.slice(config.indexOf('schedule:'),config.indexOf('\npost:'));
 fs.writeFileSync(events,'pre:\n  - "regression::must_not_run_pre"\n\n'+schedule+'\npost:\n  - "regression::must_not_run_post"\n');
 const page=run(['page','notes.md']);
 assert(!page.stdout.includes('RUNNING PRE ACT'));assert(!page.stdout.includes('RUNNING POST ACT'));assert(!page.stdout.includes('STAGEHAND:'));assert(!page.stdout.includes('rjson::'));checks+=4;
 assert.deepEqual(snapshot(source),afterFull,'Page build must not rewrite sources, routes/report, or generated category/All Pages sources');checks++;
 const afterOutputs=snapshot(output);for(const [rel,hash] of Object.entries(beforeOutputs)){if(rel!=='notes.html')assert.equal(afterOutputs[rel],hash,'Unrelated output changed: '+rel);}checks++;
 // Fresh Cloud output contains just the requested HTML, no copied library or indexes.
 fs.rmSync(output,{recursive:true,force:true});const fresh=run(['page','notes.md']);
 assert.deepEqual(files(output),['notes.html']);checks++;
 const html=fs.readFileSync(path.join(output,'notes.html'),'utf8');
 for(const marker of ['Page pattern works','href="/unrelated.html"','sheriff-portal-stats','data-sheriff-icon="book"','sheriff-nav-active'])assert(html.includes(marker),'Missing '+marker);checks+=5;
 assert(!html.includes('{{{BADGE::STATS}}}'));assert(!html.includes('{{{SCOUT::'));checks+=2;
 assert.deepEqual(snapshot(source),afterFull);assert.equal(fs.readFileSync(path.join(tmp,'dist/index.html'),'utf8'),'CLOUD APP SENTINEL');assert.equal(fs.readFileSync(path.join(tmp,'dist/admin/sentinel.txt'),'utf8'),'ADMIN SENTINEL');checks+=3;
 // A new page does not silently fall back to a portal build.
 put('site/portals/test/content/new.md','^^^^\ntitle: New\nlayout: wiki\n^^^^\n\nNew page.');
 fs.rmSync(output,{recursive:true,force:true});run(['page','new.md']);assert.deepEqual(files(output),['new.html']);checks++;
 console.log('Passed '+checks+' schedule-only page build checks. Full fixture '+full.ms+'ms; page '+page.ms+'ms; fresh-output page '+fresh.ms+'ms. Only temporary portals used.');
}finally{assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));assert(path.basename(tmp).startsWith('sheriff-page-build-'));fs.rmSync(tmp,{recursive:true,force:true});}
