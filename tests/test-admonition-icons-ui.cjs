const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-admon-ui-'));
const pw=require(process.env.SHERIFF_PLAYWRIGHT_MODULE||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{let browser;try{
 const result=spawnSync(process.execPath,[path.join(__dirname,'test-admonition-icons.cjs')],{cwd:root,encoding:'utf8',timeout:30000,env:{...process.env,SHERIFF_ADMON_ICON_FIXTURES:tmp}});assert.equal(result.status,0,result.stdout+result.stderr);
 const rows=JSON.parse(fs.readFileSync(path.join(tmp,'rendered.json')));let html='',checks=0;
 browser=await pw.chromium.launch({headless:true,executablePath:process.env.SHERIFF_BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1200,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='admon-icons.test')return route.abort();if(url.pathname.startsWith('/public/icons/'))return route.fulfill({contentType:'image/svg+xml',body:fs.readFileSync(path.join(root,'sheriff-core/assets/icons',path.basename(url.pathname)))});return route.fulfill({contentType:'text/html',body:html});});
 for(const theme of ['outpost','compendium','siegemate'])for(const mode of ['light','dark']){
  const content=rows.filter(row=>row.name.startsWith(theme+'-')).map(row=>'<section data-case="'+row.name+'">'+row.html+'</section>').join('')+rows.find(row=>row.name==='explicit-after').html;
  html='<!doctype html><html data-theme="'+mode+'"><head><meta charset="utf-8"><style>'+fs.readFileSync(path.join(root,'sheriff-core/themes',theme,'css',theme+'.css'),'utf8')+'\nbody{padding:20px}.sheriff-article{width:auto;max-width:900px;margin:auto;min-width:0}</style></head><body><article class="sheriff-article">'+content+'</article></body></html>';
  await page.goto('http://admon-icons.test/'+theme+'-'+mode,{waitUntil:'networkidle'});
  assert.equal(await page.locator('.sheriff-admon-title .sheriff-icon').count(),8);assert.equal(await page.locator('.sheriff-spoiler-title .sheriff-icon').count(),1);
  for(const el of await page.locator('section .sheriff-admon-title .sheriff-icon, section .sheriff-spoiler-title .sheriff-icon').all()){
   const state=await el.evaluate(icon=>({color:getComputedStyle(icon).color,parent:getComputedStyle(icon.parentElement).color,width:icon.getBoundingClientRect().width}));assert.equal(state.color,state.parent);assert(state.width>10);
  }
  const explicit=page.locator('article > .sheriff-admon .sheriff-icon');assert.equal(await explicit.count(),1);assert.equal(await explicit.evaluate(el=>getComputedStyle(el).color),'rgb(255, 0, 0)');assert.equal((await explicit.boundingBox()).width,24);
  const spoiler=page.locator('details');assert(!(await spoiler.getAttribute('open')));await spoiler.locator('summary').click();assert(await spoiler.evaluate(el=>el.open));await spoiler.locator('summary').click();assert(!await spoiler.evaluate(el=>el.open));checks++;
  if(process.env.SHERIFF_ADMON_ICON_PREVIEW){fs.mkdirSync(process.env.SHERIFF_ADMON_ICON_PREVIEW,{recursive:true});await page.screenshot({path:path.join(process.env.SHERIFF_ADMON_ICON_PREVIEW,theme+'-'+mode+'.png'),fullPage:true});}
  await page.setViewportSize({width:360,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),theme+' '+mode+' overflow');checks++;await page.setViewportSize({width:1200,height:1000});
 }
 assert.deepEqual(errors,[]);console.log('Passed '+checks+' admonition browser/theme checks: default and manual icons, inherited colors, explicit pixel sizes, native spoiler toggles, and narrow layouts across all themes and light/dark modes.');
}finally{if(browser)await browser.close();assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));assert(path.basename(tmp).startsWith('sheriff-admon-ui-'));fs.rmSync(tmp,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1});
