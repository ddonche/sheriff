// Actual static client and Web Worker with real generated search data. No live sites.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const pw=require(process.env.SHERIFF_PLAYWRIGHT_MODULE||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')),root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-prospector-ui-'));
let browser,checks=0;
(async()=>{try{
const generated=spawnSync(process.execPath,[path.join(__dirname,'test-prospector.cjs')],{cwd:root,encoding:'utf8',timeout:60000,env:{...process.env,SHERIFF_PROSPECTOR_FIXTURES:temp}});assert.equal(generated.status,0,generated.stdout+'\n'+generated.stderr);const index=fs.readFileSync(path.join(temp,'index.json'),'utf8');
browser=await pw.chromium.launch({headless:true,executablePath:process.env.SHERIFF_BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
async function open(theme='outpost',mode='light',fallback=false,resultIndex=index){const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],requests=[];let fail=false,release=null;page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));if(fallback)await page.addInitScript(()=>{window.Worker=undefined;});
 await page.context().route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='search.test')return route.abort();requests.push(u.pathname);if(u.pathname.startsWith('/public/images/'))return route.fulfill({status:u.pathname.includes('broken')?404:200,contentType:'image/svg+xml',body:u.pathname.includes('broken')?'':'<svg xmlns="http://www.w3.org/2000/svg" width="48" height="64"><rect width="48" height="64" fill="#52647a"/></svg>'});if(u.pathname==='/public/search-index.json'){if(release){const wait=release;release=null;await wait.promise;}return route.fulfill({status:fail?503:200,contentType:'application/json',body:fail?'unavailable':resultIndex});}if(u.pathname.startsWith('/public/prospector')){const file=path.join(root,'sheriff-core/glams/prospector',path.basename(u.pathname));return route.fulfill({contentType:'application/javascript; charset=utf-8',body:fs.readFileSync(file)});}const css=fs.readFileSync(path.join(root,'sheriff-core/themes',theme,'css',theme+'.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'sheriff-core/themes',theme,'css',theme+'-header.css'),'utf8');return route.fulfill({contentType:'text/html',body:'<!doctype html><html data-theme="'+mode+'"><head><meta charset="utf-8"><style>'+css+'</style></head><body><div class="sheriff-shell"><header class="sheriff-header"><div class="sheriff-header-top"><a class="sheriff-logo-link" href="/">Sheriff</a></div><div class="sheriff-header-bottom"><nav class="sheriff-header-nav"><ul><li><a href="/">Home</a></li><li><a href="/docs/">Docs</a></li></ul></nav><div class="sheriff-search-wrapper" id="sheriff-search"><div class="sheriff-search-icon" aria-hidden="true"></div><input class="sheriff-search-input" id="sheriff-search-input" type="search" aria-label="Search this site"><span class="sheriff-search-shortcut" aria-hidden="true">/</span></div></div></header><main><h1>Search fixture</h1><input id="other-input"><div contenteditable id="editable">Editor</div></main></div><script src="/public/prospector-engine.js" defer></script><script src="/public/prospector.js" defer></script></body></html>'});});await page.goto('http://search.test/example.html');return {page,errors,requests,fail:v=>fail=v,gate:()=>{let done;const gate={promise:new Promise(r=>done=r)};release=gate;return ()=>done();}};
}
for(const theme of ['outpost','compendium','siegemate'])for(const mode of ['light','dark']){
 const {page,errors,requests}=await open(theme,mode),input=page.getByRole('combobox',{name:'Search this site'});assert(!requests.includes('/public/search-index.json'));await input.fill('cryptobiology');await page.locator('#sheriff-search-results').getByRole('option',{name:/Cryptobiology/}).first().waitFor();assert(requests.includes('/public/prospector-worker.js'));assert.equal(page.workers().length,1);assert(await page.workers()[0].evaluate(()=>!!engine),'Search must execute in the actual worker');assert.equal(await page.locator('#sheriff-search-results').getByRole('option').first().locator('.sheriff-search-result-title').textContent(),'Cryptobiology');assert((await page.locator('.sheriff-search-status').textContent()).includes('2 results'));checks++;
 await page.getByRole('combobox',{name:'Filter search by category'}).selectOption('Books');await page.waitForFunction(()=>document.querySelector('.sheriff-search-status').textContent==='1 result');assert((await page.locator('#sheriff-search-results').getByRole('option').textContent()).includes('Path of the Outrider'));assert((await page.locator('#sheriff-search-results').getByRole('option').textContent()).includes('Cryptobiology research'));
 const thumbnail=page.locator('.sheriff-search-result-thumbnail');await thumbnail.waitFor();
 await page.waitForFunction(()=>document.querySelector('.sheriff-search-result-thumbnail')?.naturalWidth>0);
 assert.equal(await thumbnail.getAttribute('alt'),'');assert.equal(await thumbnail.getAttribute('loading'),'lazy');assert.equal(await thumbnail.getAttribute('decoding'),'async');
 assert.equal(await thumbnail.evaluate(img=>getComputedStyle(img).objectFit),'contain');checks++;
 await page.getByRole('combobox',{name:'Filter search by category'}).selectOption('');await input.fill('Outrider Tale');await page.waitForFunction(()=>document.querySelector('.sheriff-search-result-title')?.textContent==='Path of the Outrider');await input.press('ArrowDown');const selected=await input.getAttribute('aria-activedescendant');assert(selected);assert.equal(await page.locator('#'+selected).getAttribute('aria-selected'),'true');await input.press('Escape');assert.equal(await input.getAttribute('aria-expanded'),'false');checks++;
 await page.locator('#other-input').focus();await page.keyboard.press('/');assert.equal(await page.locator('#other-input').inputValue(),'/');await page.locator('h1').click();await page.keyboard.press('/');assert(await input.evaluate(el=>document.activeElement===el));await input.fill('noexistentword');await page.waitForFunction(()=>document.querySelector('.sheriff-search-status').textContent==='No results found.');assert.equal(await page.locator('#sheriff-search-results').getByRole('option').count(),0);checks++;
 if(process.env.SHERIFF_PROSPECTOR_PREVIEW_DIR){const dest=process.env.SHERIFF_PROSPECTOR_PREVIEW_DIR;fs.mkdirSync(dest,{recursive:true});await input.fill('harbor');await page.locator('#sheriff-search-results').getByRole('option').first().waitFor();await page.screenshot({path:path.join(dest,theme+'-'+mode+'.png'),fullPage:true});}
 assert.deepEqual(errors,[]);await page.close();
}
// Regression: the real header flex row must not absorb results or overflow.
for(const theme of ['outpost','compendium','siegemate'])for(const mode of ['light','dark']){
 const {page}=await open(theme,mode);
 for(const width of [1280,768,390,320]){
  await page.setViewportSize({width,height:900});
  const input=page.getByRole('combobox',{name:'Search this site'});
  await input.press('Escape');
  const before=await page.locator('.sheriff-header').boundingBox();
  await input.fill('Outrider Tale');
  await page.locator('#sheriff-search-results').getByRole('option').first().waitFor();
  await page.evaluate(()=>{
   const list=document.querySelector('#sheriff-search-results'),first=list.firstElementChild;
   // Ten long results exercise clipping, scrolling and unbroken title wrapping.
   for(let i=list.children.length;i<10;i++){
    const row=first.cloneNode(true);row.removeAttribute('id');
    row.querySelector('.sheriff-search-result-title').textContent='A long article title '+('UnbrokenTitle'.repeat(10));
    row.querySelector('.sheriff-search-result-summary').textContent='A long search excerpt. '.repeat(30);
    list.append(row);
   }
  });
  const geometry=await page.evaluate(()=>{
   const panel=document.querySelector('.sheriff-search-results'),rect=panel.getBoundingClientRect(),input=document.querySelector('.sheriff-search-wrapper').getBoundingClientRect();
   const link=panel.querySelector('a'),summary=panel.querySelector('.sheriff-search-result-summary'),style=getComputedStyle(summary);
   return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,inputBottom:input.bottom,viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,scrolls:panel.scrollHeight>panel.clientHeight,position:getComputedStyle(panel).position,underline:getComputedStyle(link).textDecorationLine,summaryHeight:summary.clientHeight,lineHeight:parseFloat(style.lineHeight)};
  });
  assert.equal(geometry.position,'absolute',theme);
  assert(!geometry.overflow,theme+' '+width+' '+JSON.stringify(geometry));
  assert(geometry.left>=0&&geometry.right<=width+1,JSON.stringify(geometry));
  assert(geometry.top>=geometry.inputBottom&&geometry.bottom<=900,JSON.stringify(geometry));
  assert(geometry.scrolls,'Long results should scroll within the panel');
  assert.equal(geometry.underline,'none');
  assert(geometry.summaryHeight<=geometry.lineHeight*2+1,'Excerpts stay within two lines');
  assert.equal((await page.locator('.sheriff-header').boundingBox()).height,before.height,'Results must not resize the header');
  await input.press('Escape');
  assert(!await page.locator('.sheriff-search-results').isVisible());checks++;
 }
 if(process.env.SHERIFF_PROSPECTOR_PREVIEW_DIR){
  await page.setViewportSize({width:1280,height:900});
  await page.getByRole('combobox',{name:'Search this site'}).fill('harbor');
  await page.locator('#sheriff-search-results').getByRole('option').first().waitFor();
  await page.screenshot({path:path.join(process.env.SHERIFF_PROSPECTOR_PREVIEW_DIR,theme+'-'+mode+'-header.png'),fullPage:true});
 }
 await page.close();
}
// Category metadata is bounded, literal text, optional, and responsive beside versions.
const metadataIndex=JSON.parse(index);
for(const doc of metadataIndex.documents){
 if(doc.href==='/book.html'){doc.version='1.2.3';doc.categories=['Books','Everwind','<img src=x onerror=alert(1)>','LongCategory'.repeat(12),'Fifth category','Sixth category'];}
 else if(doc.href==='/guide.html'){doc.version='';doc.categories=[];}
 else {doc.version='';doc.categories=['Dispatch'];}
}
for(const theme of ['outpost','compendium','siegemate'])for(const mode of ['light','dark']){
 const {page,errors}=await open(theme,mode,false,JSON.stringify(metadataIndex));
 const input=page.getByRole('combobox',{name:'Search this site'});
 await input.fill('Outrider Tale');
 const row=page.locator('#sheriff-search-results').getByRole('option').first();
 await row.waitFor();
 assert.deepEqual(await row.locator('.sheriff-search-result-category').allTextContents(),metadataIndex.documents.find(d=>d.href==='/book.html').categories.slice(0,4));
 assert.equal(await row.locator('.sheriff-search-result-version').textContent(),'1.2.3');
 assert.equal(await row.locator('.sheriff-search-result-categories img').count(),0,'Category labels must be literal text');
 for(const width of [1280,320]){
  await page.setViewportSize({width,height:900});
  const bounds=await row.evaluate(el=>{
   const meta=el.querySelector('.sheriff-search-result-meta').getBoundingClientRect(),cats=el.querySelector('.sheriff-search-result-categories').getBoundingClientRect(),version=el.querySelector('.sheriff-search-result-version').getBoundingClientRect();
   return {metaRight:meta.right,catsRight:cats.right,catLeft:cats.left,versionRight:version.right,catTop:cats.top,versionBottom:version.bottom,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert(!bounds.overflow,theme+' '+width);
  assert(Math.abs(bounds.metaRight-bounds.catsRight)<1,'Categories align to the right');
  assert(bounds.catLeft>=bounds.versionRight||bounds.catTop>=bounds.versionBottom,'Metadata wraps without overlap');
 }
 await input.fill('cryptobiology');
 await page.waitForFunction(()=>document.querySelector('.sheriff-search-result-title')?.textContent==='Cryptobiology');
 assert.equal(await row.locator('.sheriff-search-result-meta').count(),0,'No blank metadata row');assert.equal(await row.locator('img').count(),0,'Text-only results reserve no image space');assert(!await row.evaluate(el=>el.classList.contains('has-thumbnail')));
 await input.fill('Latest dispatch');
 await page.waitForFunction(()=>document.querySelector('.sheriff-search-result-title')?.textContent==='Latest dispatch');
 assert.equal(await row.locator('.sheriff-search-result-version').count(),0);
 assert.equal(await row.locator('.sheriff-search-result-category').textContent(),'Dispatch');
 assert.deepEqual(errors,[]);checks++;await page.close();
}
for(const thumbnail of ['javascript:alert(1)','data:image/svg+xml,<svg/>','http://user:password@search.test/private.png','http://[invalid','/public/images/broken.png']){
 const brokenIndex=JSON.parse(index);brokenIndex.documents.find(d=>d.href==='/book.html').thumbnail=thumbnail;
 const {page,errors}=await open('outpost','light',false,JSON.stringify(brokenIndex));
 await page.getByRole('combobox',{name:'Search this site'}).fill('Outrider Tale');
 await page.locator('#sheriff-search-results').getByRole('option').first().waitFor();
 await page.waitForFunction(()=>!document.querySelector('.sheriff-search-result')?.classList.contains('has-thumbnail'));
 assert.equal(await page.locator('.sheriff-search-result-thumbnail').count(),0,'Invalid or failed thumbnails leave no placeholder');
 assert.deepEqual(errors,[]);await page.close();checks++;
}
const fallback=await open('outpost','light',true);await fallback.page.getByRole('combobox',{name:'Search this site'}).fill('cryptobiolgy');await fallback.page.locator('#sheriff-search-results').getByRole('option').first().waitFor();assert(!fallback.requests.includes('/public/prospector-worker.js'));assert.equal(await fallback.page.locator('.sheriff-search-result-thumbnail').count(),1);assert.deepEqual(fallback.errors,[]);await fallback.page.close();checks++;
const offline=await open();offline.fail(true);await offline.page.getByRole('combobox',{name:'Search this site'}).fill('harbor');await offline.page.waitForFunction(()=>document.querySelector('.sheriff-search-status').textContent.includes('unavailable'));offline.fail(false);await offline.page.getByRole('combobox',{name:'Search this site'}).fill('harbors');await offline.page.locator('#sheriff-search-results').getByRole('option').first().waitFor();assert.deepEqual(offline.errors,[]);await offline.page.close();checks++;
const stale=await open();const release=stale.gate();const box=stale.page.getByRole('combobox',{name:'Search this site'});await box.fill('harbor');await stale.page.waitForFunction(()=>document.querySelector('.sheriff-search-status').textContent==='Searching…');await box.press('Escape');release();await stale.page.waitForTimeout(200);assert.equal(await box.getAttribute('aria-expanded'),'false');assert.equal(await stale.page.locator('#sheriff-search-results').getByRole('option').count(),0);await box.fill('Path of the Outrider');await stale.page.locator('#sheriff-search-results').getByRole('option').first().waitFor();await box.press('ArrowDown');await box.press('Enter');await stale.page.waitForURL('http://search.test/book.html');assert.deepEqual(stale.errors,[]);await stale.page.close();checks++;
console.log('Passed '+checks+' Prospector browser groups: real Web Worker, all themes/light-dark, lazy loading, rank/alias/category results, snippets, accessible keyboard navigation, shortcuts, no results, worker fallback, retry, stale replies and Enter navigation. Result styling remains theme-owned.');
}finally{if(browser)await browser.close();assert.equal(path.dirname(temp),path.resolve(os.tmpdir()));assert(path.basename(temp).startsWith('sheriff-prospector-ui-'));fs.rmSync(temp,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1});
