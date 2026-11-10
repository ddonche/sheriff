// Real Goblin-rendered pattern fixtures and existing browser tab controls; no live sites.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-pattern-tabs-')),core=path.join(tmp,'sheriff-core');
const pw=require(process.env.SHERIFF_PLAYWRIGHT_MODULE||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const book=['::: pattern vertical Book','@mode = template','title = The Example Book','author = [[Known]]','@tab Hardcover','_image = [[image:hardcover.svg|full|center|Hardcover cover]]','isbn = 978-1-23456-789-0','pages = 320','publisher = Example Press','@tab Paperback','_image = [[image:paperback.svg|full|center|Paperback cover]]','isbn = 978-1-23456-790-6','pages = 352','publisher = Another Press',':::'].join('\n');
const cases=[
 {name:'book',body:book+'\n\nArticle content after the book.'},
 {name:'repeated',body:'{{{SHERIFF::PATTERN_BOOK}}}\n\n{{{SHERIFF::PATTERN_BOOK}}}\n\n::: tabs\n@tab Article one\nFirst article panel.\n@tab Article two\nOther article panel.\n:::'},
 {name:'nested',body:'::: tabs\n@tab Book details\n'+book+'\n@tab Article text\nJust the article.\n:::'},
 {name:'only-tabs',body:'::: pattern horizontal Editions\n@mode = template\n@tab First\npages = 100\n@tab Second\npages = 200\n:::'},
 {name:'escaped',body:'::: pattern vertical Escaped\n@mode = template\n@tab <img src=x onerror=alert(1)> [[Known]] {{{BADGE::PAGE_COUNT}}}\ntext = Safe\n@tab Same\ntext = One\n@tab Same\ntext = Two\n:::'},
 {name:'empty',body:'::: pattern vertical Empty\n@mode = template\n@tab First\n@tab Second\npages = 200\n:::'},
 {name:'bad-marker',body:'::: pattern vertical Invalid\n@mode = template\ntitle = Keep this\n@tab\npages = 100\n@tab Second\npages = 200\n:::'},
 {name:'ordinary-field',body:'::: pattern vertical Legacy\n@mode = template\n@table = Ordinary field\ntext = An @tab marker inside a value\n:::'},
 {name:'code',body:'````\n'+book+'\n````'}
];
let browser,checks=0;
(async()=>{try{
 fs.cpSync(path.join(root,'sheriff-core'),core,{recursive:true});
 const portal=path.join(tmp,'site/portals/test');fs.mkdirSync(path.join(portal,'patterns'),{recursive:true});
 fs.writeFileSync(path.join(portal,'config.yall'),'theme:\n  name: compendium\n');
 fs.writeFileSync(path.join(portal,'routes.json'),JSON.stringify({routes:[{slug:'known',canonical_slug:'known',href:'/known.html',rel:'known',title:'Known',aliases:[]}]}));
 fs.writeFileSync(path.join(portal,'patterns/book.txt'),book.replace('@mode = template','@mode = reusable'));
 fs.writeFileSync(path.join(core,'cases.json'),JSON.stringify(cases));
 fs.writeFileSync(path.join(core,'verify.gbln'),"import modules/sheriff_patterns/patterns as patterns\nimport modules/markdown_core/markdown as markdown\nimport modules/trailboss_wiki/trailboss as trailboss\npatterns::publish_patterns({\"portal\": \"test\"})\nfor item in :read_json(\"cases.json\")\n    ctx | {\"portal\": \"test\", \"body\": item{\"body\"}, \"frontmatter\": {}}\n    ctx |= patterns::apply_patterns(ctx)\n    ctx |= markdown::render(ctx)\n    ctx |= trailboss::render_fences(ctx)\n    ctx |= trailboss::process_wikilinks(ctx)\n    :say(\"PATTERN_TABS \" + :json_stringify({\"name\": item{\"name\"}, \"html\": ctx{\"body\"}}))\nxx\n");
 const result=spawnSync(process.env.SHERIFF_GOBLIN||'goblin',['run','verify.gbln'],{cwd:core,encoding:'utf8',timeout:30000});assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
 const rows=result.stdout.split(/\r?\n/).filter(line=>line.startsWith('PATTERN_TABS ')).map(line=>JSON.parse(line.slice(13)));
 const rendered=name=>rows.find(row=>row.name===name).html;
 assert.equal(rows.length,cases.length);
 assert(rendered('book').includes('href="/known.html"'));assert(rendered('book').includes('hardcover.svg'));assert(rendered('book').includes('paperback.svg'));assert(rendered('book').includes('Article content after the book.'));assert(!rendered('book').includes('@tab'));checks++;
 assert(!rendered('ordinary-field').includes('data-sheriff-content-tabs'));assert(rendered('ordinary-field').includes('Ordinary field'));assert(rendered('ordinary-field').includes('An @tab marker inside a value'));checks++;
 assert(!rendered('bad-marker').includes('data-sheriff-content-tabs'));assert(rendered('bad-marker').includes('Keep this'));assert(rendered('bad-marker').includes('100'));assert(rendered('bad-marker').includes('200'));checks++;
 assert(!rendered('code').includes('data-sheriff-content-tabs'));assert(rendered('code').includes('@tab Hardcover'));checks++;
 assert(!rendered('escaped').includes('<img src=x'));assert(rendered('escaped').includes('&lt;img'));assert(!rendered('escaped').includes('href="/known.html"'));checks++;
 const tabScript=fs.readFileSync(path.join(root,'sheriff-core/modules/markdown_core/sheriff-content-tabs.js'),'utf8');
 function doc(theme,mode,content,js=true){const css=fs.readFileSync(path.join(root,'sheriff-core/themes',theme,'css',theme+'.css'),'utf8');return '<!doctype html><html data-theme="'+mode+'"><head><meta charset="utf-8"><style>'+css+'\nbody{padding:20px}.sheriff-article{width:auto!important;max-width:900px!important;margin:auto}</style></head><body><article class="sheriff-article"><h1>A book with several editions</h1>'+content+'<p>More article text outside the infobox.</p></article>'+(js?'<script>'+tabScript+'</script>':'')+'</body></html>';}
 async function open(content,theme='compendium',mode='light',js=true,url='http://patterns.test/example'){
   const page=await browser.newPage({viewport:{width:1280,height:950}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',route=>route.request().isNavigationRequest()?route.fulfill({contentType:'text/html',body:doc(theme,mode,content,js)}):route.request().resourceType()==='image'?route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="260"><rect width="200" height="260" fill="'+(route.request().url().includes('hardcover')?'#294c66':'#b77946')+'"/><text x="24" y="130" fill="white">Example Book</text></svg>'}):route.abort());
   page.setDefaultTimeout(6000);await page.goto(url);return {page,errors};
 }
 browser=await pw.chromium.launch({headless:true,executablePath:process.env.SHERIFF_BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 for(const theme of ['compendium','outpost','siegemate'])for(const mode of ['light','dark']){
   const {page,errors}=await open(rendered('book'),theme,mode),pattern=page.locator('[data-sheriff-pattern=book]'),group=pattern.locator('[data-sheriff-content-tabs]');
   assert.equal(await group.getByRole('tab').count(),2);assert.equal(await group.getByRole('tabpanel').count(),1);
   assert(await pattern.getByText('The Example Book',{exact:true}).isVisible());assert(await pattern.getByRole('link',{name:'Known',exact:true}).isVisible());
   assert(await group.getByText('978-1-23456-789-0',{exact:true}).isVisible());assert.equal(await group.locator('img:visible').count(),1);

   await group.getByRole('tab',{name:'Paperback',exact:true}).click();
   assert(await group.getByText('978-1-23456-790-6',{exact:true}).isVisible());assert(!await group.getByText('978-1-23456-789-0',{exact:true}).isVisible());assert(await pattern.getByText('The Example Book',{exact:true}).isVisible());
   assert((await group.locator('img:visible').getAttribute('src')).includes('paperback.svg'));
   await group.getByRole('tab',{name:'Paperback',exact:true}).focus();await page.keyboard.press('Home');assert(await group.getByText('320',{exact:true}).isVisible());await page.keyboard.press('End');assert(await group.getByText('352',{exact:true}).isVisible());
   const state=await group.evaluate(el=>{const t=el.querySelector('[aria-selected=true]'),p=el.querySelector('[role=tabpanel]:not([hidden])');return {controls:t.getAttribute('aria-controls'),panel:p.id,labelledby:p.getAttribute('aria-labelledby'),tab:t.id};});assert.equal(state.controls,state.panel);assert.equal(state.labelledby,state.tab);
   await page.emulateMedia({media:'print'});assert.equal(await group.locator('.sheriff-content-tab-panel:visible').count(),2);assert.equal(await group.locator('.sheriff-content-tab-heading:visible').count(),2);await page.emulateMedia({media:'screen'});
   if(process.env.SHERIFF_PATTERN_TABS_PREVIEW_DIR){fs.mkdirSync(process.env.SHERIFF_PATTERN_TABS_PREVIEW_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SHERIFF_PATTERN_TABS_PREVIEW_DIR,theme+'-'+mode+'.png'),fullPage:true});fs.writeFileSync(path.join(process.env.SHERIFF_PATTERN_TABS_PREVIEW_DIR,theme+'-'+mode+'.html'),doc(theme,mode,rendered('book')));}
   await page.setViewportSize({width:360,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),theme+' '+mode+' mobile overflow');
   assert.deepEqual(errors,[]);await page.close();checks++;
 }
 const {page:repeated}=await open(rendered('repeated'));const groups=repeated.locator('[data-sheriff-pattern=book] [data-sheriff-content-tabs]');assert.equal(await groups.count(),2);
 const ids=await repeated.locator('[id]').evaluateAll(elements=>elements.map(el=>el.id));assert.equal(new Set(ids).size,ids.length);
 await groups.nth(0).getByRole('tab',{name:'Paperback'}).click();assert(await groups.nth(0).getByText('352',{exact:true}).isVisible());assert(await groups.nth(1).getByText('320',{exact:true}).isVisible());
 await repeated.locator('article > [data-sheriff-content-tabs]').getByRole('tab',{name:'Article two'}).click();assert(await groups.nth(0).getByText('352',{exact:true}).isVisible());await repeated.close();checks++;
 const {page:nested}=await open(rendered('nested'));const outer=nested.locator('article > [data-sheriff-content-tabs]'),inner=nested.locator('[data-sheriff-pattern=book] [data-sheriff-content-tabs]');await inner.getByRole('tab',{name:'Paperback'}).click();await outer.locator(':scope > nav').getByRole('tab',{name:'Article text'}).click();assert(!await inner.isVisible());await outer.locator(':scope > nav').getByRole('tab',{name:'Book details'}).click();assert(await inner.getByText('352',{exact:true}).isVisible());await nested.close();checks++;
 for(const name of ['only-tabs','empty','escaped']){const {page}=await open(rendered(name));const group=page.locator('[data-sheriff-content-tabs]');assert(await group.getByRole('tab').count()>=2);await group.getByRole('tab').last().click();assert.equal(await group.getByRole('tabpanel').count(),1);await page.setViewportSize({width:360,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' mobile overflow');await page.close();checks++;}
 const {page:fallback}=await open(rendered('book'),'siegemate','dark',false);assert.equal(await fallback.locator('.sheriff-content-tab-panel:visible').count(),2);assert.equal(await fallback.locator('.sheriff-content-tab-heading:visible').count(),2);assert.equal(await fallback.locator('.sheriff-content-tab-list:visible').count(),0);await fallback.close();checks++;
 const {page:linked}=await open(rendered('book'),'compendium','light',true,'http://patterns.test/example#sheriff-pattern-tabs-1-panel-2');assert(await linked.getByText('352',{exact:true}).isVisible());await linked.close();checks++;
 console.log('Passed '+checks+' pattern-tab scenarios: shared fields, edition images/ISBN/pages, repeated tokens, nested article tabs, keyboard, independent IDs, all themes/light-dark, mobile, print, no-JS, safe labels, code examples, and malformed marker fallback. Only temporary fixtures used.');
}finally{if(browser)await browser.close();assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));assert(path.basename(tmp).startsWith('sheriff-pattern-tabs-'));fs.rmSync(tmp,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});

