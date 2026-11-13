// Real route discovery, generated listings, icon overrides, and removal in temporary portals.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-stub-listings-')),core=path.join(tmp,'sheriff-core'),portal=path.join(tmp,'site/portals/test'),token='{{{SHERIFF::STUB}}}';
function put(rel,text){const p=path.join(tmp,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text);}
function source(title,body,extra=''){return '^^^^\ntitle: '+title+'\nlayout: wiki\ncategories: [Examples]\n'+extra+'^^^^\n\n'+body+'\n';}
function run(args=['test']){const r=spawnSync(process.env.SHERIFF_GOBLIN||'goblin',['run','main.gbln',...args],{cwd:core,env:{...process.env,SHERIFF_RUNTIME_MODE:'local',SHERIFF_BUILD_WORKERS:'2',SHERIFF_BUILD_OUTPUT:'',SHERIFF_BUILD_DEFER_ACTIVATION:'',GOBLIN_NONINTERACTIVE:'0'},encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);return r.stdout;}
const output=rel=>fs.readFileSync(path.join(tmp,'dist/test',rel),'utf8'),routes=()=>JSON.parse(fs.readFileSync(path.join(portal,'routes.json'),'utf8')).routes;
const markerCount=html=>(html.match(/class="sheriff-directory-stub-icon"/g)||[]).length;
const config=theme=>'name: Stub listing preview\ntheme:\n  name: '+theme+'\n  brand_name: Stub preview\n  logo: logo.svg\n';
try{
 fs.cpSync(path.join(root,'sheriff-core'),core,{recursive:true});put('site/portals/test/config.yall',config('compendium'));
 put('site/portals/test/nav.yall','menus:\n  header:\n    Alpha: /alpha.html\n    Beta: /beta.html\n  left_docs:\n    Preview articles:\n      Alpha: /alpha.html\n      Beta: /beta.html\n      Examples: /categories/examples.html\n  footer_left:\n    Alpha: /alpha.html\n  footer_right:\n    Beta: /beta.html\n');
 put('site/portals/test/public/logo.svg',fs.readFileSync(path.join(core,'assets/icons/book-open.svg'),'utf8'));
 const bodies={alpha:token+'\n\nAn unfinished article.',beta:'A finished article.',code:'```text\n'+token+'\n```',inline:'`'+token+'`',comment:'<!-- '+token+' -->',indented:'    '+token,reused:'{{{SHERIFF::PATTERN_STATUS}}}'};
 for(const [name,body]of Object.entries(bodies))put('site/portals/test/content/'+name+'.md',source(name[0].toUpperCase()+name.slice(1),body));
 put('site/portals/test/content/metadata.md',source('Metadata','A complete article.','summary: "'+token+'"\n'));
 put('site/portals/test/content/categories/unfinished.md',source('Unfinished category',token));
 put('site/portals/test/patterns/status.txt','::: pattern horizontal Status\n@mode = reusable\nstatus = '+token+'\n:::');
 run();let indexed=routes();
 for(const route of indexed.filter(r=>Object.keys(bodies).includes(r.slug)||r.slug==='metadata'||r.rel==='categories/unfinished'))assert.equal(route.is_stub,['alpha','reused','unfinished'].includes(route.slug),route.rel);
 for(const rel of ['all_pages.html','categories/examples.html']){const html=output(rel);assert.equal(markerCount(html),2,rel);assert.equal((html.match(/aria-label="Stub article"/g)||[]).length,2);assert(html.includes('data-sheriff-icon="notebook-pen"'));assert(html.includes('href="/alpha.html"'));assert(html.includes('href="/categories/unfinished.html"'));assert(html.includes('sheriff-directory-category-icon'),'Category kind remains independent of stub status');assert(!html.includes('sheriff-missing'));}
 assert(fs.existsSync(path.join(portal,'content/categories/stub-pages.md')));assert(!routes().find(r=>r.rel==='categories/stub-pages').categories.includes('Stub pages'),'Generated category must not enroll itself');const stubCategory=output('categories/stub-pages.html');assert(stubCategory.includes('href="/alpha.html"')&&stubCategory.includes('href="/reused.html"'));assert(!fs.readFileSync(path.join(portal,'content/categories/stub-pages.md'),'utf8').includes('[[beta|Beta]]'));assert(output('alpha.html').includes('sheriff-wiki-category-tag" href="/categories/stub-pages.html"'));assert(!output('beta.html').includes('sheriff-wiki-category-tag" href="/categories/stub-pages.html"'));
 const fm=fs.readFileSync(path.join(portal,'content/alpha.md'),'utf8').split('^^^^')[1];assert(!fm.includes('is_stub')&&!fm.includes('stub:'),'No derived status is persisted in frontmatter');
 if(process.env.SHERIFF_STUB_PREVIEW_DIR){
  const dest=path.resolve(process.env.SHERIFF_STUB_PREVIEW_DIR);
  for(const theme of ['compendium','outpost','siegemate']){
   put('site/portals/test/config.yall',config(theme));run();
   fs.mkdirSync(dest,{recursive:true});
   for(const [name,file]of Object.entries({'all-pages':'all_pages.html','category':'categories/examples.html','stubs':'categories/stub-pages.html'}))fs.writeFileSync(path.join(dest,'stub-listings-'+theme+'-'+name+'.html'),output(file));
   fs.cpSync(path.join(tmp,'dist/test/public'),path.join(dest,'public'),{recursive:true});
  }
  put('site/portals/test/config.yall',config('compendium'));
 }
 put('site/portals/test/themes/compendium/templates.yall','wiki_icons:\n  stub: feather\n');run();assert(output('all_pages.html').includes('data-sheriff-icon="feather"'));assert.equal(markerCount(output('all_pages.html')),2);
 if(process.env.SHERIFF_STUB_PREVIEW_DIR){const dest=path.resolve(process.env.SHERIFF_STUB_PREVIEW_DIR);fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'stub-listings-all-pages.html'),output('all_pages.html'));fs.writeFileSync(path.join(dest,'stub-listings-category.html'),output('categories/examples.html'));fs.cpSync(path.join(tmp,'dist/test/public'),path.join(dest,'public'),{recursive:true});}
 put('site/portals/test/themes/compendium/templates.yall','wiki_icons:\n  stub: false\n');run();assert.equal(markerCount(output('all_pages.html')),0);assert.equal(routes().find(r=>r.slug==='alpha').is_stub,true,'Disabling decoration does not change status');
 const oldDirectory=output('all_pages.html');put('site/portals/test/content/alpha.md',source('Alpha','A completed article.'));const pageLog=run(['test','page','alpha.md']);assert(!pageLog.includes('RUNNING PRE ACT')&&!pageLog.includes('RUNNING POST ACT'));assert.equal(output('all_pages.html'),oldDirectory,'Page-only build must not regenerate shared listings');assert(!output('alpha.html').includes('sheriff-wiki-category-tag" href="/categories/stub-pages.html"'),'Page-only removal clears the tag despite cached routes');
 put('site/portals/test/themes/compendium/templates.yall','wiki_icons:\n  stub: feather\n');run();assert.equal(routes().find(r=>r.slug==='alpha').is_stub,false);assert.equal(markerCount(output('all_pages.html')),1);assert.equal(markerCount(output('categories/examples.html')),1);
 // Removing every marker clears derived membership and the generated category.
 put('site/portals/test/content/reused.md',source('Reused','Complete.'));
 put('site/portals/test/content/categories/unfinished.md',source('Unfinished category','Complete.'));
 put('site/portals/test/content/manual.md',source('Manual','Complete.','canonical: manual\n'));
 // A stale manual assignment cannot keep the automatic category alive.
 put('site/portals/test/content/manual.md',fs.readFileSync(path.join(portal,'content/manual.md'),'utf8').replace('categories: [Examples]','categories: [Examples, "Stub pages"]'));
 const manualBefore=fs.readFileSync(path.join(portal,'content/manual.md'),'utf8');run();
 assert(!fs.existsSync(path.join(portal,'content/categories/stub-pages.md')));assert(!fs.existsSync(path.join(tmp,'dist/test/categories/stub-pages.html')));
 assert(!routes().some(r=>(r.categories||[]).includes('Stub pages')));assert.equal(fs.readFileSync(path.join(portal,'content/manual.md'),'utf8'),manualBefore,'Source metadata stays untouched');
 console.log('Passed real stub listing builds: derived route flags, code/comment/frontmatter exclusions, reusable patterns, leading article stub icons and category folders, custom/disabled icons, marker removal, and page-build isolation. Only temporary portals used.');
}finally{assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));assert(path.basename(tmp).startsWith('sheriff-stub-listings-'));fs.rmSync(tmp,{recursive:true,force:true});}
