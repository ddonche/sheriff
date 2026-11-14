// Goblin rendering + responsive list/reference layout. All content is disposable.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const repo=process.env.SHERIFF_TEST_REPO||path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-columns-')),core=path.join(tmp,'sheriff-core');
const pw=process.env.SHERIFF_NATIVE_ONLY==='1'?null:require(process.env.SHERIFF_PLAYWRIGHT_MODULE||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const list=Array.from({length:24},(_,i)=>'- Item '+(i+1)+' — useful content and [[Known]]').join('\n');
const references=Array.from({length:18},(_,i)=>'Source '+(i+1)+'[^source'+i+'].').join(' ')+'\n\n'+Array.from({length:18},(_,i)=>'[^source'+i+']: Reference '+(i+1)+' with [[Known]] and **emphasis**.').join('\n');
const cases=[
 ...[2,3,4].map(n=>({name:'columns-'+n,body:'Before.\n\n::: columns '+n+'\n'+list+'\n:::\n\nAfter.'})),
 {name:'ordered',body:'::: columns 3\n'+Array.from({length:20},(_,i)=>(i+1)+'. Ordered item '+(i+1)).join('\n')+'\n:::'},
 {name:'nested-list',body:'::: columns 2\n- Parent\n  - Child one\n  - Child two\n- Other parent\n:::'},
 {name:'tabs-inside',body:'::: columns 2\n::: tabs\n@tab First\n- First list item\n@tab Second\n- Second list item\n:::\n\n- Outside tabs\n:::'},
 {name:'inside-tab',body:'::: tabs\n@tab First\n::: columns 2\n- One\n- Two\n:::\n@tab Second\nOrdinary panel.\n:::'},
 {name:'admon-inside',body:'::: columns 2\n::: note A note\nUseful **advice**.\n:::\n\n- An item\n:::'},
 {name:'inside-admon',body:'::: note List\n::: columns 2\n- One\n- Two\n:::\n:::'},
 {name:'nested-columns',body:'::: columns 2\n::: columns 3\n- Inner one\n- Inner two\n:::\n\n- Outer item\n:::'},
 {name:'code-in-columns',body:'::: columns 2\n```text\n::: columns 4\n::: \n```\n\n- Real item\n:::'},
 ...[
  ['fenced','````markdown\n::: columns 2\n- Example\n:::\n````'],
  ['tilde','~~~markdown\n::: columns 2\n- Example\n:::\n~~~'],
  ['indented','    ::: columns 2\n    - Example\n    :::'],
  ['inline','`::: columns 2` is an example.'],
  ['comment','<!--\n::: columns 2\n- Hidden example\n:::\n-->'],
  ['raw-code','<pre><code>\n::: columns 2\n- Example\n:::\n</code></pre>'],
  ['unclosed','::: columns 2\n- Keep every line.'],
  ['invalid','::: columns 5\n- Keep this.\n:::'],
  ['missing-count','::: columns\n- Keep this.\n:::'],
  ['injection','::: columns 2 onclick=alert(1)\n- Keep this.\n:::']
 ].map(([name,body])=>({name,body,unchanged:true})),
 ...[null,1,2,3,4,5,'2 onclick=alert(1)'].map(n=>({name:'references-'+(typeof n==='string'?'invalid':String(n)),body:references,footnote_columns:n}))
];
let checks=0;
(async()=>{let browser,server;try{
 fs.cpSync(path.join(repo,'sheriff-core'),core,{recursive:true});
 const portal=path.join(tmp,'site/portals/test');fs.mkdirSync(portal,{recursive:true});fs.writeFileSync(path.join(portal,'config.yall'),'theme:\n  name: compendium\n');fs.writeFileSync(path.join(portal,'routes.json'),JSON.stringify({routes:[{slug:'known',canonical_slug:'known',href:'/known.html',title:'Known',aliases:[]}]}));
 fs.writeFileSync(path.join(core,'cases.json'),JSON.stringify(cases));
 fs.writeFileSync(path.join(core,'columns-fixture.gbln'),String.raw`import modules/markdown_core/content_columns as columns
import modules/markdown_core/markdown as markdown
import modules/trailboss_wiki/trailboss as trailboss
for item in :read_json("cases.json")
    prepared | columns::prepare(item{"body"})
    ctx | {"portal": "test", "body": item{"body"}, "frontmatter": {"footnote_columns": item{"footnote_columns"} ?? 1}}
    ctx |= markdown::render(ctx)
    ctx |= trailboss::render_fences(ctx)
    ctx |= trailboss::render_footnotes(ctx)
    ctx |= trailboss::process_wikilinks(ctx)
    :say("COLUMNS_RESULT " + :json_stringify({"name": item{"name"}, "prepared": prepared, "html": ctx{"body"}}))
xx
`);
 const run=spawnSync(process.env.SHERIFF_GOBLIN||'goblin',['run','columns-fixture.gbln'],{cwd:core,encoding:'utf8',timeout:30000});assert.equal(run.status,0,run.stderr+'\n'+run.stdout.slice(-3500));
 const rows=run.stdout.split(/\r?\n/).filter(s=>s.startsWith('COLUMNS_RESULT ')).map(s=>JSON.parse(s.slice(15))),byName=name=>rows.find(row=>row.name===name);
 assert.equal(rows.length,cases.length);checks++;
 for(const item of cases){const row=byName(item.name);if(item.unchanged)assert.equal(row.prepared,item.body,item.name);else if(!item.name.startsWith('references')){assert(row.html.includes('class="sheriff-columns sheriff-columns-'),item.name);assert(!row.html.includes('<p>::: columns'),item.name);}checks++;}
 if(process.env.SHERIFF_NATIVE_ONLY==='1'){console.log('Passed '+checks+' native '+"content/reference columns"+' checks.');return;}
 const pages=new Map();
 for(const theme of ['compendium','outpost','siegemate'])for(const mode of ['light','dark']){
  const css=fs.readFileSync(path.join(repo,'sheriff-core/themes',theme,'css',theme+'.css'),'utf8');
  pages.set('/'+theme+'-'+mode+'.html','<!doctype html><html data-theme="'+mode+'"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><style>body{padding:1rem}.sheriff-article{width:100%;max-width:none;margin:auto} .case{clear:both;border-bottom:1px solid var(--sheriff-border);padding-block:1rem} .label{font:12px system-ui;color:var(--sheriff-muted)}</style></head><body><article class="sheriff-article">'+rows.map(row=>'<section class="case" id="case-'+row.name+'"><div class="label">'+row.name+'</div>'+row.html+'</section>').join('\n')+'</article></body></html>');
 }
 server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),html=pages.get(url.pathname);res.writeHead(html?200:404,{'Content-Type':'text/html; charset=utf-8'});res.end(html||'Not found')});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 browser=await pw.chromium.launch({headless:true,executablePath:process.env.SHERIFF_BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});const page=await browser.newPage();await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
 for(const theme of ['compendium','outpost','siegemate'])for(const mode of ['light','dark']){
  await page.setViewportSize({width:1280,height:1000});await page.goto(base+'/'+theme+'-'+mode+'.html');
  for(const n of [2,3,4]){const group=page.locator('#case-columns-'+n+' .sheriff-columns');assert.equal(await group.locator(':scope > ul').count(),1);assert.equal(await group.locator('li').count(),24);const positions=await group.locator('li').evaluateAll(items=>new Set(items.map(e=>Math.round(e.getBoundingClientRect().x))).size);assert.equal(positions,n,theme+'/'+n);assert.deepEqual(await group.locator('li').allTextContents(),Array.from({length:24},(_,i)=>'Item '+(i+1)+' — useful content and Known'));assert.equal(await group.locator('a[href="/known.html"]').count(),24);checks++;}
  assert.equal(await page.locator('#case-ordered .sheriff-columns > ol').count(),1);assert.equal(await page.locator('#case-ordered li').count(),20);assert.equal(await page.locator('#case-nested-list .sheriff-columns > ul > li > ul > li').count(),2);checks++;
  for(const name of ['tabs-inside','inside-tab']){assert.equal(await page.locator('#case-'+name+' [data-sheriff-content-tabs]').count(),1);assert.equal(await page.locator('#case-'+name+' .sheriff-columns').count(),1);checks++;}
  for(const name of ['admon-inside','inside-admon']){assert.equal(await page.locator('#case-'+name+' .sheriff-admon').count(),1);assert.equal(await page.locator('#case-'+name+' .sheriff-columns').count(),1);checks++;}
  assert.equal(await page.locator('#case-nested-columns .sheriff-columns .sheriff-columns').count(),1);assert.equal(await page.locator('#case-code-in-columns .sheriff-columns').count(),1);checks++;
  for(const n of [2,3,4]){const section=page.locator('#case-references-'+n+' section.sheriff-footnotes'),list=section.locator(':scope > ol');assert.equal(await list.locator(':scope > li').count(),18);assert.equal(await list.locator('li').evaluateAll(items=>new Set(items.map(e=>Math.round(e.getBoundingClientRect().x))).size),n);assert.equal(await section.evaluate(e=>getComputedStyle(e).columnCount),'auto');const links=await page.locator('#case-references-'+n+' a[href^="#"]').evaluateAll(links=>links.map(a=>a.hash.slice(1)));for(const id of links)assert.equal(await page.locator('#case-references-'+n+' [id="'+id+'"]').count(),1);checks++;}
  for(const n of ['null','1','5']){assert.equal(await page.locator('#case-references-'+n+' .sheriff-footnote-columns').count(),0);checks++;}
  // Container width, not just viewport width, limits the requested column count.
  const narrow=page.locator('#case-columns-4 .sheriff-columns');await narrow.evaluate(e=>e.style.width='360px');assert.equal(await narrow.locator('li').evaluateAll(items=>new Set(items.map(e=>Math.round(e.getBoundingClientRect().x))).size),1);await narrow.evaluate(e=>e.style.removeProperty('width'));checks++;
  for(const width of [768,390,320]){await page.setViewportSize({width,height:900});for(const selector of ['#case-columns-4 .sheriff-columns > ul > li','#case-references-4 .sheriff-footnotes > ol > li']){const count=await page.locator(selector).evaluateAll(items=>new Set(items.map(e=>Math.round(e.getBoundingClientRect().x))).size);assert(count<=4);if(width<=390)assert.equal(count,1);}assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),theme+'/'+width+' overflow');checks++;}
 }
 if(process.env.SHERIFF_COLUMNS_PREVIEW_DIR){const dir=path.resolve(process.env.SHERIFF_COLUMNS_PREVIEW_DIR);fs.mkdirSync(dir,{recursive:true});for(const [name,html]of pages)fs.writeFileSync(path.join(dir,name.slice(1)),html);fs.writeFileSync(path.join(dir,'rendered.json'),JSON.stringify(rows,null,2));}
 console.log('Passed '+checks+' content/reference columns checks: real Goblin rendering, nested blocks/code protection, semantic lists, numbered references/backlinks, all themes light/dark, container widths and phone fallback.');
}finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));assert(path.basename(tmp).startsWith('sheriff-columns-'));fs.rmSync(tmp,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1});
