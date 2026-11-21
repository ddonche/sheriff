const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),crypto=require('node:crypto');
const repo=process.env.SHERIFF_TEST_REPO||path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-missing-')),core=path.join(tmp,'sheriff-core');let checks=0;
const put=(rel,text)=>{const p=path.join(tmp,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text);return p;};
const read=rel=>fs.readFileSync(path.join(tmp,rel),'utf8');
function run(portal,args=[],env={}){const r=spawnSync(process.env.SHERIFF_GOBLIN||'goblin',['run','main.gbln',portal,...args],{cwd:core,encoding:'utf8',timeout:120000,windowsHide:true,env:{...process.env,SHERIFF_RUNTIME_MODE:process.env.SHERIFF_RUNTIME_MODE||'cloud',...env}});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);return r.stdout;}
try{
 fs.cpSync(path.join(repo,'sheriff-core'),core,{recursive:true});
 const renderer=path.join(core,'modules/trailboss_wiki/destinations.gbln');
 fs.writeFileSync(renderer,fs.readFileSync(renderer,'utf8').replace('act render(ctx, title, body, rel, categories)','act render(ctx, title, body, rel, categories)\n    :say("MISSING_RENDER")'));
 const themes=process.env.ONE_THEME?['compendium']:['compendium','outpost','siegemate'];
 for(const theme of themes){
  const p='site/portals/'+theme,o='dist/'+theme;
  put(p+'/config.yall',`id: ${theme}\nname: Missing link test\ntheme:\n  name: ${theme}\n  brand_name: Missing link test\n  logo: logo.svg\nrouting:\n  url_root: wiki\n`);
  put(p+'/public/logo.svg','<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#5096ab"/></svg>');
  put(p+'/nav.yall','menus:\n  header:\n    Home: /\n    Unwritten menu: "[[Nav Missing]]"\n  left_docs:\n    Home: /index.html\n  left_wiki:\n    Home: /index.html\n  footer_left:\n    Home: /\n  footer_right:\n    Home: /\n');
  put(p+'/content/index.md','^^^^\ntitle: Home\ncanonical: home\nlayout: wiki\n^^^^\n\n[[Future Article|Write it]] [[Future Article#History]] [[C++ Missing]] [[Category:Unwritten]]\n\n`[[Code Example]]`\n');
  put(p+'/content/other.md','^^^^\ntitle: Other\nlayout: wiki\ncanonical: other\n^^^^\n\n[[Future Article]]\n');
  const full=run(theme);assert(!full.includes('SHERIFF ERROR'));checks++;
  const home=read(o+'/index.html');
  assert(home.includes('href="/wiki/_wiki/future-article.html"'));assert(home.includes('href="/wiki/_wiki/future-article.html#History"'));assert(home.includes('sheriff-missing-link'));checks+=3;
  assert(home.includes('/wiki/_wiki/nav-missing.html'));assert(fs.existsSync(path.join(tmp,o,'_wiki/nav-missing.html')));checks+=2;
  const placeholder=read(o+'/_wiki/future-article.html');assert(placeholder.includes('This page hasn’t been created yet.'));assert(placeholder.includes('/wiki/categories/missing-pages.html'));assert(placeholder.includes('noindex'));assert(!placeholder.includes('data-page-edit'));checks+=4;
  const listing=read(o+'/categories/missing-pages.html');assert(listing.includes('Missing Pages'));assert(listing.includes('referring pages'));assert(listing.includes('sheriff-directory'));assert.equal(listing,read(o+'/wanted-pages.html'));assert(read(p+'/content/categories.md').includes('Category:Missing Pages'));checks+=5;
  const routes=JSON.parse(read(p+'/routes.json')).routes;assert(!routes.some(r=>r.rel.startsWith('_wiki/')));const search=JSON.parse(read(o+'/public/search-index.json'));assert(!search.documents.some(r=>r.href.includes('_wiki/')));assert(!fs.existsSync(path.join(tmp,o,'_wiki/code-example.html')));checks+=3;
  const punctuation=JSON.parse(read(o+'/public/missing-pages.json')).targets['c++-missing'];assert(punctuation);assert(home.includes('/wiki/_wiki/c~2B~2B-missing.html'));checks+=2;
  // Creating an article anywhere must replace the stable destination by a page
  // schedule only, with no changes whatsoever to incoming article HTML.
  const oldHome=home,oldOther=read(o+'/other.html');
  put(p+'/content/articles/future.md','^^^^\ntitle: Future Article\ncanonical: future-article\nlayout: wiki\n^^^^\n\n# History\n\nCreated without a portal rebuild.');
  const events=path.join(core,'events.yall'),original=fs.readFileSync(events,'utf8');
  const schedule=original.slice(original.indexOf('schedule:'),original.indexOf('\npost:'));
  fs.writeFileSync(events,'pre:\n  - "forbidden::pre"\n'+schedule+'\npost:\n  - "forbidden::post"\n');
  const log=run(theme,['page','articles/future.md']);assert(!log.includes('RUNNING PRE')&&!log.includes('RUNNING POST'));checks++;
  const redirect=read(o+'/_wiki/future-article.html');assert(redirect.includes('/wiki/articles/future.html'));assert(redirect.includes('location.hash'));assert(!redirect.includes('hasn’t been created'));checks+=3;
  assert.equal(read(o+'/index.html'),oldHome);assert.equal(read(o+'/other.html'),oldOther);assert(!read(o+'/categories/missing-pages.html').includes('href="/wiki/_wiki/future-article.html">Future Article</a>'));assert(read(o+'/articles/future.html').includes('Created without'));checks+=4;
  // Hosted page builds emit supporting destinations into fresh isolated output.
  const isolated=path.join(tmp,'page-output/'+theme).replaceAll('\\','/');
  // Resolve another genuinely new target in this isolated build.
  put(p+'/content/new-nav.md','^^^^\ntitle: Nav Missing\ncanonical: nav-missing\nlayout: wiki\n^^^^\n\nNew menu article.');
  run(theme,['page','new-nav.md'],{SHERIFF_BUILD_OUTPUT:isolated});assert(fs.readFileSync(path.join(isolated,'_wiki/nav-missing.html'),'utf8').includes('/wiki/new-nav.html'));assert(fs.existsSync(path.join(isolated,'categories/missing-pages.html')));assert(!fs.existsSync(path.join(isolated,'index.html')));checks+=3;
  // Retry a failed publication with a brand-new output directory. Cached state
  // must not make the required stable redirect disappear on the retry.
  fs.rmSync(isolated,{recursive:true,force:true});
  run(theme,['page','new-nav.md'],{SHERIFF_BUILD_OUTPUT:isolated});assert(fs.readFileSync(path.join(isolated,'_wiki/nav-missing.html'),'utf8').includes('/wiki/new-nav.html'));checks++;
  const fresh=path.join(tmp,'fresh/'+theme).replaceAll('\\','/');
  run(theme,['page','index.md'],{SHERIFF_BUILD_OUTPUT:fresh});assert(fs.existsSync(path.join(fresh,'_wiki/c~2B~2B-missing.html')));assert(fs.existsSync(path.join(fresh,'categories/missing-pages.html')));checks+=2;
  fs.writeFileSync(events,original);
  // Full builds retain stable destinations after resolution, while only actual
  // articles enter routes, All Pages and search.
  run(theme);assert(read(o+'/_wiki/future-article.html').includes('/wiki/articles/future.html'));assert(!read(o+'/all_pages.html').includes('href="/wiki/_wiki/'));checks+=2;
  console.log(theme+' full + page-only + isolated hosted output passed.');
 }
 // Membership uses the same stable destinations under the portal's wiki mount.
 put('site/sites/network/site.yall','name: Network\ntheme: compendium\nportals:\n  programming:\n    source: network-programming\n    name: Programming\n');
 const grouped='site/portals/network-programming';
 put(grouped+'/config.yall','id: network-programming\nname: Programming\ntheme:\n  name: compendium\nmembership:\n  site: network\n  portal: programming\n');
 put(grouped+'/nav.yall','menus:\n  header:\n    Home: /index.html\n');
 put(grouped+'/content/index.md','^^^^\ntitle: Programming\ncanonical: index\nlayout: wiki\n^^^^\n\n[[Unwritten Here]]');
 run('network-programming');assert(read('dist/network-programming/index.html').includes('/p/programming/wiki/_wiki/unwritten-here.html'));assert(read('dist/network-programming/_wiki/unwritten-here.html').includes('/p/programming/wiki/categories/missing-pages.html'));assert(read('dist/network-programming/all_pages.html').includes('No articles yet.'));checks+=3;
 put(grouped+'/content/nested/created.md','^^^^\ntitle: Unwritten Here\ncanonical: unwritten-here\nlayout: wiki\n^^^^\n\nNew mounted article.');
 run('network-programming',['page','nested/created.md']);assert(read('dist/network-programming/_wiki/unwritten-here.html').includes('/p/programming/wiki/nested/created.html'));checks++;
 // Rendering cost must stay bounded as the number of missing targets grows.
 put('site/portals/compendium/content/bulk.md','^^^^\ntitle: Bulk\nlayout: wiki\n^^^^\n\n'+Array.from({length:200},(_,i)=>'[[Bulk Missing '+i+']]').join(' '));
 const bulk=run('compendium');assert.equal(bulk.split('\n').filter(l=>l.trim()==='MISSING_RENDER').length,2);checks++;
 for(const i of [0,99,199]){const html=read('dist/compendium/_wiki/bulk-missing-'+i+'.html');assert(html.includes('Bulk Missing '+i));assert(!/SHERIFFMISSINGTITLE8A64|sheriffmissingcanonical8a64|sheriffmissingpath8a64/.test(html));assert(html.includes('[[bulk-missing-'+i+']]'));checks+=3;}
 console.log('Passed '+checks+' missing-page checks. Fixture: '+tmp);
 if(process.env.KEEP_FIXTURE)console.log('Keeping fixture');else fs.rmSync(tmp,{recursive:true,force:true});
}catch(e){console.error('Retained failing fixture: '+tmp);throw e;}
