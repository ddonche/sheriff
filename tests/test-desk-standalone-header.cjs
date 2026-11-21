const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require(process.env.SHERIFF_PLAYWRIGHT_MODULE||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const repo=process.env.SHERIFF_TEST_REPO||path.resolve(__dirname,'..'),desk=path.join(repo,'sheriff-core/desk');
const override=process.env.SHERIFF_HEADER_SITES_SCRIPT;
const sites=[
 {id:'goblin',name:'Goblin',grouped:false,portals:[{id:'goblin',source:'goblin',name:'Goblin'}]},
 {id:'programming',name:'Programming',grouped:false,portals:[{id:'programming',source:'programming',name:'Programming'}]},
 {id:'iveki',name:'Iveki',grouped:true,portals:[{id:'books',source:'iveki-books',name:'Books'},{id:'languages',source:'iveki-languages',name:'Languages'}]},
 {id:'network',name:'Network',grouped:true,portals:[{id:'wiki',source:'network-wiki',name:'Network Wiki'}]}
];
const names=sites.flatMap(s=>s.portals.map(p=>p.source));let checks=0;
function eq(a,b,message){assert.deepEqual(a,b,message);checks++}
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SHERIFF_BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 for(const mode of ['local','cloud']){
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort());
  await page.route('http://desk.test/',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(desk,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')}));
  await page.goto('http://desk.test/');
  await page.evaluate(({mode,sites})=>{
   window.SheriffDeskBackend={mode,capabilities:{multisite:true,siteLifecycle:mode==='local'},
    request:async operation=>{if(operation!=='sites.list')throw Error('Unexpected mutation: '+operation);return new Response(JSON.stringify({ok:true,sites:window.fixtureSites}));},
    setSites:()=>{},siteUrl:id=>'https://'+id+'.sheriffcloud.com/',assetUrl:(portal,file)=>'https://'+portal+'.sheriffcloud.com/'+file,
    portalUrl:portal=>{for(const site of window.fixtureSites)for(const p of site.portals)if(p.source===portal)return 'https://'+site.id+'.sheriffcloud.com/'+(site.grouped?'p/'+p.id+'/wiki/':'');return 'https://'+portal+'.sheriffcloud.com/';},isBusy:()=>false};
   window.fixtureSites=sites;window.SheriffDesk={unsavedPanels:()=>[],notify:()=>{}};
  },{mode,sites});
  await page.addScriptTag({content:fs.readFileSync(path.join(desk,'admin/portal-context.js'),'utf8')});
  await page.addScriptTag({content:fs.readFileSync(override||path.join(desk,'admin/sites.js'),'utf8')});
  await page.evaluate(names=>window.SheriffPortalContext.setPortals(names,{preferred:'goblin'}),names);
  await page.evaluate(()=>window.SheriffSites.refresh());
  const options=()=>page.locator('#desk-portal option').evaluateAll(items=>items.map(o=>o.value));
  eq(await page.locator('#desk-site-control').isVisible(),false,mode+': standalone hides Site despite other multisites');
  eq(await options(),names);eq(await page.locator('#desk-build-site').isVisible(),false);
  await page.locator('#desk-portal').selectOption('programming');eq(await page.evaluate(()=>window.SheriffSites.current.id),'programming');
  eq(await page.locator('#desk-site-control').isVisible(),false);eq(await page.locator('#desk-portal').inputValue(),'programming');
  await page.locator('#desk-portal').selectOption('iveki-books');eq(await page.locator('#desk-site-control').isVisible(),true);
  eq(await page.locator('#desk-site').inputValue(),'iveki');eq(await page.locator('#desk-build-site').isVisible(),true);eq(await options(),names);
  await page.locator('#desk-portal').selectOption('goblin');eq(await page.locator('#desk-site-control').isVisible(),false);
  eq(await page.evaluate(()=>window.SheriffSites.current.id),'goblin');eq(await page.locator('#desk-build-site').isVisible(),false);
  eq(await page.locator('.desk-portal-caption').innerText(),'goblin.sheriffcloud.com');
  await page.locator('#desk-portal').selectOption('iveki-languages');
  await page.locator('#desk-site').selectOption('network');eq(await page.locator('#desk-site').inputValue(),'network');
  eq(await page.locator('#desk-portal').inputValue(),'network-wiki');eq(await page.locator('#desk-site-control').isVisible(),true,'Explicit multisite remains multisite even with one current member');
  // Unsaved-change guards and in-progress operation locks still control both selectors.
  await page.evaluate(()=>{window.rejectSwitch=window.SheriffPortalContext.guard(()=>false)});
  await page.locator('#desk-portal').selectOption('goblin');eq(await page.locator('#desk-portal').inputValue(),'network-wiki');
  await page.locator('#desk-site').selectOption('goblin');eq(await page.locator('#desk-site-control').isVisible(),true);eq(await page.locator('#desk-site').inputValue(),'network');
  await page.evaluate(()=>{window.rejectSwitch();window.releaseSwitch=window.SheriffPortalContext.lock();window.dispatchEvent(new Event('sheriff:operation-change'))});
  eq(await page.locator('#desk-portal').isDisabled(),true);eq(await page.locator('#desk-site').isDisabled(),true);
  await page.evaluate(()=>{window.releaseSwitch();window.dispatchEvent(new Event('sheriff:operation-change'))});
  await page.locator('#desk-portal').selectOption('goblin');eq(await page.locator('#desk-site-control').isVisible(),false);
  eq(await page.evaluate(()=>localStorage.getItem(window.SheriffDeskBackend.mode==='cloud'?'desk.activePortal.cloud':'desk.activePortal')),'goblin');
  await page.evaluate(()=>{window.fixtureSites=window.fixtureSites.filter(s=>!s.grouped);window.SheriffPortalContext.setPortals(['goblin','programming']);return window.SheriffSites.refresh()});
  eq(await page.locator('#desk-site-control').isVisible(),false);eq(await options(),['goblin','programming']);
  await page.evaluate(()=>{window.fixtureSites=[];window.SheriffPortalContext.setPortals([]);return window.SheriffSites.refresh()});
  eq(await page.locator('#desk-site-control').isVisible(),false);eq(await page.locator('#desk-portal').isDisabled(),true);
  await page.setViewportSize({width:600,height:960});eq(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  eq(errors,[]);await page.close();
 }
 console.log('Passed '+checks+' header checks in local and hosted modes: standalone direct switching, multisite entry/exit, guards, operation locks and empty inventory. No files saved or builds triggered.');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
