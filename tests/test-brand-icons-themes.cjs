// Exercise actual Goblin-rendered brand icons in every bundled theme.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const {chromium}=require(process.env.SHERIFF_PLAYWRIGHT_MODULE||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-brand-themes-'));
(async()=>{let browser;try{
 const generated=spawnSync(process.execPath,[path.join(root,'tests/test-icons.cjs')],{encoding:'utf8',timeout:120000,env:{...process.env,SHERIFF_ICON_FIXTURES:temp}});assert.equal(generated.status,0,generated.stdout+generated.stderr);
 const rows=JSON.parse(fs.readFileSync(path.join(temp,'rendered.json'),'utf8')),catalog=JSON.parse(fs.readFileSync(path.join(temp,'catalog.json'),'utf8')).icons;
 browser=await chromium.launch({headless:true,executablePath:process.env.SHERIFF_BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1200,height:900}});let html='',requests=[];let checks=0;
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://brands.test')return route.abort();if(u.pathname.startsWith('/public/icons/')){const name=path.basename(u.pathname,'.svg'),icon=catalog.find(i=>i.name===name)||catalog.find(i=>i.name===name.replace(/^brand-/,''));assert(icon,name);requests.push(name);return route.fulfill({contentType:'image/svg+xml',body:icon.svg});}return route.fulfill({contentType:'text/html',body:html});});
 for(const theme of ['compendium','outpost','siegemate'])for(const mode of ['light','dark']){
  const css=fs.readFileSync(path.join(root,'sheriff-core/themes',theme,'css',theme+'.css'),'utf8');html='<!doctype html><html data-theme="'+mode+'"><meta charset="utf-8"><style>'+css+'</style><style>body{padding:24px}.sheriff-shell{max-width:1000px}.sheriff-article{max-width:none;min-width:0}</style><main class="sheriff-shell"><article class="sheriff-article">'+rows.find(r=>r.name==='brands').html+rows.find(r=>r.name==='brand-pattern').html+'</article></main></html>';requests=[];
  await page.goto('http://brands.test/'+theme+'-'+mode,{waitUntil:'networkidle'});
  const reddit=page.locator('[data-sheriff-icon=reddit]');assert.equal(await reddit.evaluate(el=>getComputedStyle(el).color),'rgb(255, 69, 0)');assert.equal((await reddit.boundingBox()).width,24);
  const discord=page.locator('[data-sheriff-icon=discord]');assert.equal(await discord.evaluate(el=>getComputedStyle(el).color),'rgb(88, 101, 242)');assert.equal((await discord.boundingBox()).width,24);assert.equal(await page.locator('a.sheriff-icon-link[aria-label=discord]').getAttribute('href'),'https://discord.com/invite/example');
  const github=page.locator('[data-sheriff-icon=github]').first();assert.equal(await github.evaluate(el=>getComputedStyle(el).color===getComputedStyle(el.parentElement).color),true);
  assert(requests.includes('reddit'));assert(requests.includes('discord'));assert(requests.includes('brand-x'));assert(requests.includes('x'));
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),theme+' overflow');await page.setViewportSize({width:1200,height:900});checks++;
 }
 console.log('Passed '+checks+' brand theme checks: actual rendered masks, inherited and brand colors, sizes, linked patterns, and mobile across all three themes in light/dark mode.');
}finally{await browser?.close();assert.equal(path.dirname(temp),path.resolve(os.tmpdir()));assert(path.basename(temp).startsWith('sheriff-brand-themes-'));fs.rmSync(temp,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
