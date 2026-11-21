const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const repo=process.env.SHERIFF_TEST_REPO||path.resolve(__dirname,'..'),cloud=process.env.SHERIFF_CLOUD_REPO||path.resolve(repo,'../sheriffcloud'),out=process.env.SHERIFF_TEST_OUTPUT||os.tmpdir();
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-module-panels-')),core=path.join(root,'sheriff-core'),goblin=process.env.SHERIFF_GOBLIN||'goblin';
const {chromium}=require(process.env.SHERIFF_PLAYWRIGHT_MODULE||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
fs.cpSync(path.join(repo,'sheriff-core'),core,{recursive:true,filter:p=>!['.vs','node_modules','__pycache__'].includes(path.basename(p))});
function put(rel,text){const file=path.join(root,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
const config='id: trial\nname: Trial\n# Preserve this comment\nhowdy:\n  enabled: true\n';
put('site/portals/trial/config.yall',config);put('site/portals/trial/content/index.md','^^^^\ntitle: Trial\nlayout: wiki\n^^^^\nHello.');
put('sheriff-core/modules/example/desk.yall','api_version: 1\nname: Example\nversion: 1.2.3\nactivation: enabled\nupdates: https://example.org/releases\nsettings:\n  enabled:\n    type: boolean\n    section: example\n    key: enabled\n    label: Enable Example\n    default: false\npanel:\n  entry: admin/panel.js\n  handler: admin/panel.gbln\n  actions: [echo]\n');
put('sheriff-core/modules/example/admin/panel.js',`export async function mount(ctx){window.exampleMounts=(window.exampleMounts||0)+1;ctx.signal.addEventListener('abort',()=>window.exampleAborts=(window.exampleAborts||0)+1,{once:true});const result=await ctx.request('echo',{message:'Third-party panel works'});if(ctx.signal.aborted)return;ctx.container.append(ctx.ui.node('h4',result.message),ctx.ui.node('p','Portal: '+result.portal),ctx.ui.button('Example action',()=>{window.exampleClicks=(window.exampleClicks||0)+1;}));return ()=>window.exampleCleanups=(window.exampleCleanups||0)+1;}`);
put('sheriff-core/modules/example/admin/panel.gbln',`request | :read_json(:env("GOBLIN_REQUEST_FILE"))\n:say(:json_stringify({"ok":true,"message":request{"payload"}{"message"},"portal": :env("SHERIFF_MODULE_PORTAL"),"owner": :env("SHERIFF_ACCESS_OWNER"),"subject": :env("SHERIFF_ACCESS_SUBJECT")}))\n`);
function run(script,body,query,mode='local',extra={}){
 const file=path.join(root,'request.json');fs.writeFileSync(file,JSON.stringify(body));
 const result=spawnSync(goblin,['run',script],{cwd:core,env:{...process.env,SHERIFF_ROOT:root.replaceAll('\\','/'),SHERIFF_RUNTIME_MODE:mode,GOBLIN_METHOD:'POST',GOBLIN_QUERY_STRING:query,GOBLIN_BODY:'',GOBLIN_REQUEST_FILE:file,...extra},encoding:'utf8',timeout:30000,windowsHide:true});
 assert.equal(result.status,0,result.stderr+'\n'+result.stdout);let value=JSON.parse(result.stdout);while(value&&Object.hasOwn(value,'body')&&Object.hasOwn(value,'status'))value=typeof value.body==='string'?JSON.parse(value.body):value.body;return value;
}
const driver='desk/admin/requests/desk_modules_request.gbln';let server,browser;
(async()=>{try{
 const initial=run(driver,{text:config},'inspect');assert.equal(initial.panels.length,2);assert.equal(initial.panels.find(p=>p.id==='modules/howdy').fields[0].value,true);
 const patched=run(driver,{text:config,module:'modules/howdy',field:'enabled',value:false},'patch');assert(patched.content.includes('# Preserve this comment'));assert(patched.content.includes('enabled: false'));assert.equal(fs.readFileSync(path.join(root,'site/portals/trial/config.yall'),'utf8'),config);
 for(const id of ['../howdy','modules/../howdy','modules/not-installed'])assert.equal(run(driver,{module:id},'panel').ok,false);
 const bundle=run(driver,{module:'modules/howdy'},'panel');assert(bundle.ok,bundle.stderr);assert(bundle.source.includes('export function mount'));assert(bundle.icons['user-round-plus'].includes('<svg'));
 assert.equal(run(driver,{module:'modules/example',action:'erase',payload:{}},'action&portal=trial').ok,false);
 const action=run(driver,{module:'modules/example',action:'echo',payload:{message:'Native Goblin handler'}},'action&portal=trial');assert(action.ok,action.stderr);assert.equal(action.message,'Native Goblin handler');assert.equal(action.portal,'trial');
 const localAdapter=path.join(core,'desk/api/modules.gbln');const nativeAction=run(localAdapter,{module:'modules/example',action:'echo',payload:{message:'Local HTTP adapter'}},'action&portal=trial');assert(nativeAction.ok,nativeAction.stderr);assert.equal(nativeAction.message,'Local HTTP adapter');assert.equal(run(localAdapter,{text:config},'inspect','cloud').ok,false);assert.equal(run(localAdapter,{text:config},'inspect','local',{GOBLIN_HEADERS_JSON:'{"host":"localhost:5173","origin":"https://unrelated.example"}'}).ok,false);
 const {createDeskHandler}=await import(pathToFileURL(cloud+'/desk-server.mjs').href);
 const handler=createDeskHandler({root,goblin,secureCookies:false,getUser:async auth=>auth==='Bearer fixture'?{id:'owner'}:null,ownsSite:async(_,id)=>id==='trial'?{id,subdomain:id}:null});
 const fixture=mode=>`<!doctype html><meta charset=utf-8><link rel=stylesheet href=/admin/admin.css><main style="padding:28px;max-width:1600px;margin:auto"><section id=view-modules><div class=cfg-wrap><div class=view-head><button class="btn small" id=modules-back hidden>Modules</button><h2 class=bracket id=modules-title>Modules</h2></div><p id=modules-scope class=np-hint></p><p id=modules-intro class="np-hint module-intro"></p><div id=modules-panels class=module-panels></div><p id=modules-error role=alert></p><div class="cfg-foot module-actions"><span id=modules-status></span><span id=modules-dirty hidden>unsaved</span><button id=modules-save class="btn small primary">Save</button><button id=modules-build class="btn small">Save & rebuild</button></div></div></section><span id=cf-status></span></main><script>
window.currentText=${JSON.stringify(config)};window.saved=0;window.failAccess=true;window.accessCalls=0;window.waitAccess=false;window.pendingAccess=null;window.lastAccess=null;
window.SheriffPortalContext={current:'trial'};
window.SheriffModuleConfig={state:()=>({text:currentText,portal:'trial',disabled:false,dirty:currentText!==${JSON.stringify(config)},saving:false}),patch:(before,text)=>{if(before.text!==currentText)return false;currentText=text;return true},save:()=>{saved++;document.getElementById('cf-status').textContent='saved'}};
window.SheriffCloudSync={access:async(verb,portal,payload)=>{accessCalls++;lastAccess={verb,portal,payload};if(waitAccess)await new Promise(resolve=>pendingAccess=resolve);if(failAccess)throw new TypeError('Failed to fetch');return {ok:true,editors:{}}}};
window.SheriffDeskBackend={mode:${JSON.stringify(mode)},request:async(op,args,options)=>{if(op.startsWith('howdy.access.'))return new Response(JSON.stringify(await SheriffCloudSync.access(op.split('.').at(-1),args.portal,JSON.parse(options.body))));return fetch(${JSON.stringify(mode==='local'?'/native/':'/api/desk/')}+op+'?portal='+args.portal,{...options,headers:{...options.headers,Authorization:'Bearer fixture'}})}};
</script><script src=/admin/modules.js></script><script>location.hash='modules';SheriffModules.enter()</script>`;
 server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://local');if(url.pathname.startsWith('/api/desk/'))return void await handler(req,res);
  if(url.pathname.startsWith('/native/')){let body='';for await(const chunk of req)body+=chunk;res.setHeader('Content-Type','application/json');return void res.end(JSON.stringify(run(driver,JSON.parse(body),url.pathname.slice(8).replace('modules.','')+'&portal=trial')));}
  if(url.pathname.startsWith('/admin/')){const file=path.join(core,'desk',url.pathname);res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');return void res.end(fs.readFileSync(file));}
  res.setHeader('Content-Type','text/html');res.end(fixture(url.searchParams.get('mode')||'local'));
 }catch(error){res.statusCode=500;res.end(JSON.stringify({ok:false,stderr:error.message}));}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 async function call(who,portal,operation,body){const res=await fetch(origin+'/api/desk/modules.'+operation+'?portal='+portal,{method:'POST',headers:{...(who?{Authorization:'Bearer '+who}:{}),'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:res.status,...await res.json()};}
 assert.equal((await call('','trial','panel',{module:'modules/howdy'})).status,401);assert.equal((await call('fixture','other','action',{module:'modules/example',action:'echo'})).status,403);
 const hosted=await call('fixture','trial','action',{module:'modules/example',action:'echo',payload:{message:'Hosted Goblin'}});assert(hosted.ok,hosted.stderr);assert.equal(hosted.owner,'1');assert.equal(hosted.subject,'owner');assert.equal(hosted.portal,'trial');
 browser=await chromium.launch({headless:true,executablePath:process.env.SHERIFF_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 for(const mode of ['local','cloud']){
  const page=await browser.newPage({viewport:{width:1400,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/?mode='+mode);
  await page.getByRole('button',{name:'Open Howdy panel'}).waitFor();assert.equal(await page.getByLabel('Sheriff username').count(),0);assert.equal(await page.evaluate(()=>accessCalls),0);
  const rows=page.locator('#modules-panels>[data-module]');assert.deepEqual(await rows.evaluateAll(items=>items.map(e=>e.dataset.module)),['modules/howdy','modules/example']);
  assert.equal(await page.getByRole('button',{name:'Deactivate',exact:true}).evaluate(e=>e.classList.contains('module-deactivate')),true);
  await page.getByRole('button',{name:'Inactive (1)',exact:true}).click();assert.equal(await rows.count(),1);assert.equal(await rows.first().getAttribute('data-module'),'modules/example');
  await page.getByRole('button',{name:'Active (1)',exact:true}).click();assert.equal(await rows.count(),1);assert.equal(await rows.first().getAttribute('data-module'),'modules/howdy');
  await page.getByRole('button',{name:'All (2)',exact:true}).click();await page.getByRole('searchbox',{name:'Search installed modules'}).fill('EXAMPLE');assert.equal(await rows.count(),1);
  await page.getByRole('searchbox',{name:'Search installed modules'}).fill('no-such-module');await page.getByText('No modules match your filters.').waitFor();assert.equal(await page.evaluate(()=>accessCalls),0);
  await page.getByRole('searchbox',{name:'Search installed modules'}).fill('');
  await page.getByRole('button',{name:'Deactivate',exact:true}).click();await page.locator('[data-module="modules/howdy"]').getByRole('button',{name:'Activate',exact:true}).waitFor();assert.deepEqual(await rows.evaluateAll(items=>items.map(e=>e.dataset.module)),['modules/example','modules/howdy']);assert((await page.evaluate(()=>currentText)).includes('enabled: false'));assert.equal(await page.evaluate(()=>saved),0);await page.locator('#modules-save').click();assert.equal(await page.evaluate(()=>saved),1);
  await page.getByRole('button',{name:'Open Howdy panel'}).click();await page.getByText(/Could not reach Sheriff/).waitFor();assert(await page.getByRole('button',{name:'Allow editing'}).isDisabled());assert(await page.locator('#modules-back').isVisible());assert.equal(await page.getByRole('button',{name:'Open Example panel'}).count(),0);
  const username=page.getByLabel('Sheriff username'),grant=page.getByRole('button',{name:'Allow editing'});
  assert(await username.isEnabled());await username.fill('alice');
  const failedCalls=await page.evaluate(()=>accessCalls);await username.press('Enter');assert.equal(await page.evaluate(()=>accessCalls),failedCalls);
  await page.evaluate(()=>{failAccess=false;waitAccess=true;});await page.getByRole('button',{name:'Retry',exact:true}).click();
  await page.waitForFunction(()=>pendingAccess!==null);assert(await username.isEnabled());assert(await grant.isDisabled());await username.fill('alice-ready');
  await page.evaluate(()=>{waitAccess=false;pendingAccess();pendingAccess=null;});await page.getByText('Only the site owner can edit this portal.').waitFor();assert(await grant.isEnabled());assert.equal(await username.inputValue(),'alice-ready');
  await page.evaluate(()=>waitAccess=true);await grant.click();await page.waitForFunction(()=>pendingAccess!==null);await username.fill('bob');
  await page.evaluate(()=>{waitAccess=false;pendingAccess();pendingAccess=null;});await page.getByText('Editing access updated.',{exact:true}).waitFor();assert.equal(await username.inputValue(),'bob');assert.equal(await page.evaluate(()=>lastAccess.payload.username),'alice-ready');
  await grant.click();await page.waitForFunction(()=>document.querySelector('.howdy-access-form input').value==='');
  await page.screenshot({path:path.join(out,'module-howdy-'+mode+'.png'),fullPage:true});
  await page.locator('#modules-back').click();await page.getByRole('button',{name:'Open Example panel'}).click();await page.getByText('Third-party panel works',{exact:true}).waitFor();await page.getByRole('button',{name:'Example action'}).click();assert.equal(await page.evaluate(()=>exampleClicks),1);
  await page.locator('#modules-back').click();assert.equal(await page.evaluate(()=>exampleCleanups),1);assert.equal(await page.evaluate(()=>exampleAborts),1);
  await page.screenshot({path:path.join(out,'module-catalog-'+mode+'.png'),fullPage:true});await page.setViewportSize({width:375,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);await page.close();console.log(mode+': catalog separation, activation/save, module-owned panel, failed-request retry, Goblin handler, lifecycle cleanup, mobile passed.');
 }
 console.log('Module panel API native validation and authenticated Cloud gateway checks passed. Fixture: '+root);
}finally{await browser?.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}})().catch(error=>{console.error(error);process.exitCode=1;});
