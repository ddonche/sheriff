const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process'),{promisify}=require('node:util'),{pathToFileURL}=require('node:url'),exec=promisify(execFile);
const {chromium}=require(process.env.SHERIFF_PLAYWRIGHT_MODULE||'playwright');
const repo=process.env.SHERIFF_TEST_REPO||path.resolve(__dirname,'..'),goblin=process.env.SHERIFF_GOBLIN||'goblin';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-frontend-')),core=path.join(root,'sheriff-core');
let child,browser,gateway,checks=0;
const listen=s=>new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
const directory=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url==='/auth/v1/user'&&req.headers.authorization==='Bearer fixture-editor-token'?{id:'stable-editor-id',email:'fixture@example.test'}:{error:'unauthorized'}));});
function put(rel,text){const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,text);}
function decode(raw){let r=JSON.parse(raw);while(r?.body!==undefined&&r?.status!==undefined)r=typeof r.body==='string'?JSON.parse(r.body):r.body;return r;}
async function stop(){if(child&&child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}child=null;}
async function insertAssets(editor){
 await editor.locator('#cx-icons-toggle').click();await editor.locator('#cx-search').fill('heart');
 await editor.getByRole('button',{name:'Select heart',exact:true}).click({timeout:30000});
 await editor.locator('#cx-size').fill('18');await editor.locator('#cx-insert').click();
 await editor.locator('#ci-toggle').click();await editor.getByRole('button',{name:'Select fixture.svg',exact:true}).click({timeout:30000});
 await editor.locator('#ci-insert').click();await editor.locator('.visual-image img').waitFor();
 assert(await editor.locator('.visual-image img').first().evaluate(img=>img.complete&&img.naturalWidth>0));checks++;
 await editor.locator('#cx-patterns-toggle').click();await editor.getByRole('button',{name:/Fixture Card/}).click({timeout:30000});
 await editor.locator('#cx-insert').click();
 await editor.getByRole('tab',{name:'Source',exact:true}).click();
 const body=await editor.locator('#ed-text').inputValue();
 assert(body.includes('[[icon|heart||18]]'),body);assert(body.includes('[[image:fixture.svg|full|center|]]'),body);assert(body.includes('::: pattern horizontal Fixture Card'),body);checks+=3;
 await editor.getByRole('tab',{name:'Visual',exact:true}).click();
 await editor.locator('#cx-patterns-toggle').click();await editor.getByRole('button',{name:/Shared Notice/}).click();await editor.locator('#cx-insert').click();
 await editor.getByRole('tab',{name:'Source',exact:true}).click();assert((await editor.locator('#ed-text').inputValue()).includes('{{{SHERIFF::PATTERN_SHARED_NOTICE}}}'));checks++;
}
(async()=>{try{
 fs.cpSync(path.join(repo,'sheriff-core'),core,{recursive:true});await listen(directory);
 const env={...process.env,SHERIFF_ROOT:root.replaceAll('\\','/'),SHERIFF_RUNTIME_MODE:'local',SUPABASE_URL:'http://127.0.0.1:'+directory.address().port,SUPABASE_ANON_KEY:'fixture-public-key',PATH:path.dirname(goblin)+path.delimiter+process.env.PATH};
 const prefix='^^^^\r\ntitle: Article\r\nlayout: wiki\r\nsummary: Keep this exact metadata.\r\ncustom: untouched\r\n^^^^';
 browser=await chromium.launch({headless:true,...(process.env.SHERIFF_CHROME?{executablePath:process.env.SHERIFF_CHROME}:{})});
 for(const theme of ['compendium','outpost','siegemate']){
  const portal='trial-'+theme;
  put('site/portals/'+portal+'/config.yall','id: '+portal+'\nname: Trial\nhowdy:\n  enabled: true\ntheme:\n  name: '+theme+'\n');
  put('site/portals/'+portal+'/nav.yall','menus:\n  header:\n    Home: /article.html\n  left_wiki:\n    Article: /article.html\n  footer_left:\n    Home: /article.html\n');
  put('site/portals/'+portal+'/content/article.md',prefix+'\r\n\r\nInitial article.\r\n');
  put('site/portals/'+portal+'/content/unrelated.md','^^^^\ntitle: Unrelated\nlayout: wiki\n^^^^\n\nUnrelated sentinel.');
  put('data/.desk/howdy/'+portal+'/access.json',JSON.stringify({version:1,policy:'signed_in',editors:{},locks:{}}));
  put('site/portals/'+portal+'/public/images/fixture.svg','<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="red"/></svg>');
  put('site/portals/'+portal+'/patterns/fixture.txt','::: pattern horizontal Fixture Card\n@mode = template\nname = Example\n:::');
  put('site/portals/'+portal+'/patterns/shared.txt','::: pattern horizontal Shared Notice\n@mode = reusable\nstatus = Ready\n:::');
  const full=await exec(goblin,['run','main.gbln',portal],{cwd:core,env,windowsHide:true,timeout:60000,maxBuffer:20e6});
  assert(full.stdout.includes('Portal build finished'),full.stdout);checks++;
  const output=path.join(root,'dist',portal),unrelated=fs.readFileSync(path.join(output,'unrelated.html'));
  const initialSource=fs.readFileSync(path.join(root,'site/portals',portal,'content/article.md'),'utf8'),metadata=initialSource.slice(0,initialSource.indexOf('^^^^',4)+4);
  assert(fs.existsSync(path.join(output,'api/page_content.gbln')),'Normal build must install the local editing endpoint');checks++;
  const socket=http.createServer();await listen(socket);const port=socket.address().port;await new Promise(r=>socket.close(r));
  child=spawn(goblin,['start','--host','127.0.0.1','--port',String(port)],{cwd:output,env:{...env,SHERIFF_ROOT:''},windowsHide:true,stdio:['ignore','pipe','pipe']});let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
  const base='http://127.0.0.1:'+port;for(let i=0;i<80;i++){try{await fetch(base+'/article.html');break;}catch{await new Promise(r=>setTimeout(r,100));}}
  async function request(verb,payload,token='fixture-editor-token',origin=base){const r=await fetch(base+'/api/page_content?'+verb+'&portal='+portal,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload)});const raw=await r.text();try{return decode(raw)}catch{throw Error(raw+'\n'+logs);}}
  let data=await request('read',{path:'content/article.md'});assert(data.ok,JSON.stringify(data));assert(data.body.includes('Initial article'));checks++;
  assert.equal((await request('library',{path:'content/article.md',kind:'icons'},'bad-token')).ok,false);
  assert.equal((await request('library',{path:'../config.yall',kind:'images'})).ok,false);
  assert.equal((await request('library',{path:'content/article.md',kind:'config'})).ok,false);checks+=3;
  const images=await request('library',{path:'content/article.md',kind:'images'});assert(images.files?.includes('public/images/fixture.svg'),JSON.stringify(images));checks++;
  assert.equal((await request('read',{path:'content/article.md'},'bad-token')).ok,false);
  assert.equal((await request('read',{path:'content/article.md'},'fixture-editor-token','https://evil.test')).ok,false);
  assert.equal((await request('read',{path:'../config.yall'})).ok,false);checks+=3;
  const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://sheriffcloud.com/howdy/client.js',route=>route.fulfill({contentType:'text/javascript',body:`export async function prepare(){return false} export function subscribe(){} export async function identity(){return {user:{id:'stable-editor-id'},profile:{username:'fixture'}}} export async function signIn(){} export async function signOut(){}` }));
  await page.addInitScript(()=>localStorage.setItem('sheriff.howdy.session.ee0767ae-d4e4-4c7e-88a6-4c5a3152b6ea',JSON.stringify({access_token:'fixture-editor-token'})));
  await page.goto(base+'/article.html');
  await page.locator('[data-howdy-edit]').waitFor({timeout:20000});await page.locator('[data-howdy-edit]').click();
  const editor=page.frameLocator('iframe[title="Sheriff page editor"]');
  await editor.locator('.visual-document').waitFor({timeout:15000});checks++;
  await insertAssets(editor);
  if(process.env.FRONTEND_SCREENSHOTS){await page.screenshot({path:path.join(process.env.FRONTEND_SCREENSHOTS,theme+'-page-editor.png')});}
  assert(!await editor.locator('#ed-text').inputValue().then(s=>s.includes('title: Article')));checks++;
  await editor.locator('#ed-text').fill((await editor.locator('#ed-text').inputValue())+'\n\nEdited from public '+theme+' page.\n');
  await editor.locator('#page-save').click();try{await page.waitForFunction(()=>!document.querySelector('.howdy-page-dialog'),null,{timeout:30000});}catch(e){console.log('Editor status:',await editor.locator('#page-status').textContent(),'browser errors:',errors,'server:',logs);throw e;}await page.waitForLoadState('load');
  const source=fs.readFileSync(path.join(root,'site/portals',portal,'content/article.md'),'utf8');assert(source.startsWith(metadata));assert(source.includes('Edited from public '+theme));assert(source.includes('[[icon|heart||18]]'));assert(source.includes('[[image:fixture.svg|full|center|]]'));assert(source.includes('::: pattern horizontal Fixture Card'));checks+=3;assert(fs.readFileSync(path.join(output,'article.html'),'utf8').includes('Edited from public '+theme));assert.deepEqual(fs.readFileSync(path.join(output,'unrelated.html')),unrelated);assert.equal(errors.length,0,errors.join('\n'));checks+=5;
  data=await request('read',{path:'content/article.md'});let result=await request('save',{path:'content/article.md',base:'stale',body:'must not save'});assert.equal(result.error,'conflict',JSON.stringify(result));checks++;
  if(theme==='compendium'){
   // A failed page schedule saves the body but releases the build lease. Retry
   // uses the returned base, and must not run any PRE/POST action.
   const eventsFile=path.join(core,'events.yall'),events=fs.readFileSync(eventsFile,'utf8');
   fs.writeFileSync(eventsFile,events.replace('  - "frontier::strip_frontmatter"','  - "missing_fixture_action::fail"'));
   const failed=await request('save',{path:'content/article.md',base:data.base,body:'\nSaved before a failing schedule.\n'});
   assert.equal(failed.ok,false,JSON.stringify(failed));assert.equal(failed.saved,true,JSON.stringify(failed));assert(failed.base.includes('Saved before a failing schedule'));assert(!fs.existsSync(path.join(root,'data/.desk/builds',portal,'lease')),JSON.stringify(failed));checks+=4;
   fs.writeFileSync(eventsFile,events);
   const retry=await request('save',{path:'content/article.md',base:failed.base,body:'\nRecovered on retry.\n'});
   assert.equal(retry.ok,true,JSON.stringify(retry));assert(!retry.build_stdout.includes('RUNNING PRE ACT'));assert(!retry.build_stdout.includes('RUNNING POST ACT'));assert.deepEqual(fs.readFileSync(path.join(output,'unrelated.html')),unrelated);checks+=4;
   // Holding a full-build lease prevents a public page write; the same source
   // can be saved after the lease is released.
   const leaseScript=path.join(core,'fixture-lease.gbln');fs.writeFileSync(leaseScript,'import "build-support/output.gbln" as output\n:say(:json_stringify(output::lifecycle("'+portal+'",:env("FIXTURE_PHASE"),:env("FIXTURE_ID") ?? "")))\n');
   const held=await exec(goblin,['run','fixture-lease.gbln'],{cwd:core,env:{...env,FIXTURE_PHASE:'begin',SHERIFF_BUILD_OWNER_PID:String(process.pid)},windowsHide:true});
   const lease=JSON.parse(held.stdout.trim().split('\n').at(-1));data=await request('read',{path:'content/article.md'});
   const busy=await request('save',{path:'content/article.md',base:data.base,body:'Must not overwrite during a portal build.'});assert.equal(busy.ok,false);assert.equal(busy.saved,false);assert.equal(fs.readFileSync(path.join(root,'site/portals',portal,'content/article.md'),'utf8'),data.base);checks+=3;
   await exec(goblin,['run','fixture-lease.gbln'],{cwd:core,env:{...env,FIXTURE_PHASE:'abort',FIXTURE_ID:lease.id},windowsHide:true});
   assert.equal((await request('save',{path:'content/article.md',base:data.base,body:'\nAfter portal build lease.\n'})).ok,true);checks++;
  }
  put('data/.desk/howdy/'+portal+'/access.json',JSON.stringify({version:1,policy:'signed_in',editors:{},locks:{'content/article':true}}));assert.equal((await request('save',{path:'content/article.md',base:data.base,body:'locked'})).ok,false);checks++;
  put('data/.desk/howdy/'+portal+'/access.json',JSON.stringify({version:1,policy:'approved',editors:{},locks:{}}));assert.equal((await request('read',{path:'content/article.md'})).ok,false);assert.equal((await request('library',{path:'content/article.md',kind:'images'})).ok,false);checks+=2;
  put('data/.desk/howdy/'+portal+'/access.json',JSON.stringify({version:1,policy:'approved',owner:'stable-editor-id',editors:{},locks:{}}));assert.equal((await request('read',{path:'content/article.md'})).ok,true);checks++;
  if(theme==='compendium'){
   // The very same browser editor on a hosted origin, with real Goblin policy
   // and a real page build. Only identity lookup and R2 transport are fixtures.
   put('site/.desk/howdy/'+portal+'/access.json',JSON.stringify({version:1,policy:'signed_in',editors:{},locks:{}}));
   const {createDeskHandler,runCommand}=await import(pathToFileURL(path.join(core,'desk/admin/server/desk-server.mjs')));
   const builds=[],uploads=[];
   const handler=createDeskHandler({root,goblin,getUser:async h=>h==='Bearer fixture-editor-token'?{id:'stable-editor-id'}:null,ownsSite:async()=>null,getSite:async id=>id===portal?{subdomain:portal,owner_id:'different-owner'}:null,run:async(command,args,options)=>{if(command==='sh'){uploads.push(args);return {stdout:'Synthetic R2 upload complete',stderr:''};}if(args[0]==='run'&&path.basename(args[1])==='main.gbln')builds.push(args);return runCommand(command,args,options);}});
   gateway=http.createServer((req,res)=>handler(req,res));await listen(gateway);const gatewayBase='http://127.0.0.1:'+gateway.address().port;
   const hosted=await browser.newContext();const hp=await hosted.newPage();const host='https://'+portal+'.sheriffcloud.com';const he=[];hp.on('pageerror',e=>he.push(e.message));
   await hp.route('**/*',async route=>{const u=new URL(route.request().url());if(u.href==='https://sheriffcloud.com/howdy/client.js')return route.fulfill({contentType:'text/javascript',body:`export async function prepare(){return false} export function subscribe(){} export async function identity(){return {user:{id:'stable-editor-id'},profile:{username:'fixture'}}} export async function signIn(){}`});if(u.origin==='https://sheriffcloud.com'&&u.pathname.startsWith('/api/desk/content.')){const response=await fetch(gatewayBase+u.pathname+u.search,{method:route.request().method(),headers:{...route.request().headers(),origin:host},body:route.request().postData()});return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});}if(u.origin!==host)return route.abort();const file=path.join(output,u.pathname.slice(1));if(!file.startsWith(output+path.sep)&&!file.startsWith(output+'/'))return route.abort();try{const body=fs.readFileSync(file),ext=path.extname(file);return route.fulfill({body,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[ext]||'application/octet-stream'});}catch{return route.fulfill({status:404,body:'Not found'});}});
   await hp.addInitScript(()=>localStorage.setItem('sheriff.howdy.session.ee0767ae-d4e4-4c7e-88a6-4c5a3152b6ea',JSON.stringify({access_token:'fixture-editor-token'})));
   await hp.goto(host+'/article.html');await hp.locator('[data-howdy-edit]').click();const ed=hp.frameLocator('iframe[title="Sheriff page editor"]');await ed.locator('.visual-document').waitFor();await insertAssets(ed);await ed.locator('#ed-text').fill((await ed.locator('#ed-text').inputValue())+'\nHosted shared-editor save.\n');await ed.locator('#page-save').click();await hp.waitForFunction(()=>!document.querySelector('.howdy-page-dialog'),null,{timeout:30000});await hp.waitForLoadState('load');assert.equal(builds.length,1);assert.deepEqual(builds[0].slice(-3),[portal,'page','article.md']);assert.equal(uploads.length,1);assert(fs.readFileSync(path.join(output,'article.html'),'utf8').includes('Hosted shared-editor save.'));assert.deepEqual(fs.readFileSync(path.join(output,'unrelated.html')),unrelated);assert.equal(he.length,0,he.join('\n'));checks+=6;
   console.log('Hosted browser flow: same editor, real Goblin permission and page schedule, synthetic R2 transport only.');await hosted.close();gateway.closeAllConnections();await new Promise(r=>gateway.close(r));gateway=null;
  }
  console.log(theme+': real native HTTP + browser body-only edit/build, unchanged metadata/other page, denied identity/origin/path, conflict, lock and stable-ID owner passed.');
  if(process.env.KEEP_FRONTEND_FIXTURE){console.log('Fixture: '+root);await context.close();await stop();break;}
  await context.close();await stop();
 }
 // Multisite uses a public portal slug and a separate storage source ID.
 put('site/sites/network/site.yall','name: Network\ntheme: compendium\nhowdy:\n  enabled: true\nportals:\n  books:\n    source: network-books\n    name: Books\n  other:\n    source: network-other\n    name: Other\n');
 for(const slug of ['books','other']){put('site/portals/network-'+slug+'/config.yall','id: network-'+slug+'\nname: '+slug+'\ntheme:\n  name: siegemate\nmembership:\n  site: network\n  portal: '+slug+'\n');put('site/portals/network-'+slug+'/nav.yall','menus:\n  header:\n    Home: /index.html\n  left_wiki:\n    Home: /index.html\n');put('site/portals/network-'+slug+'/content/index.md','^^^^\ntitle: '+slug+'\nlayout: wiki\n^^^^\n\nMultisite '+slug+'.\n');put('data/.desk/howdy/network-'+slug+'/access.json',JSON.stringify({version:1,policy:'signed_in',editors:{},locks:{}}));put('site/.desk/howdy/network-'+slug+'/access.json',JSON.stringify({version:1,policy:'signed_in',editors:{},locks:{}}));}
 put('sheriff-core/fixture-multisite.gbln','import modules/site_portals/sites as sites\n:say(:json_stringify(sites::build("network")))\n');await exec(goblin,['run','fixture-multisite.gbln'],{cwd:core,env,windowsHide:true,timeout:60000,maxBuffer:20e6});
 const networkOutput=path.join(root,'dist/network'),booksFile=path.join(networkOutput,'p/books/wiki/index.html'),otherFile=path.join(networkOutput,'p/other/wiki/index.html'),other=fs.readFileSync(otherFile);assert(fs.readFileSync(booksFile,'utf8').includes('&quot;portal&quot;:&quot;books&quot;'));checks++;
 assert(fs.existsSync(path.join(networkOutput,'api/page_content.gbln')));assert(!fs.existsSync(path.join(networkOutput,'p/books/wiki/api/page_content.gbln')));checks+=2;
 const socket=http.createServer();await listen(socket);const port=socket.address().port;await new Promise(r=>socket.close(r));child=spawn(goblin,['start','--host','127.0.0.1','--port',String(port)],{cwd:networkOutput,env:{...env,SHERIFF_ROOT:''},windowsHide:true,stdio:'ignore'});const base='http://127.0.0.1:'+port;for(let i=0;i<80;i++){try{await fetch(base+'/');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 async function native(verb,payload){const r=await fetch(base+'/api/page_content?'+verb+'&portal=network-books',{method:'POST',headers:{Origin:base,Authorization:'Bearer fixture-editor-token','Content-Type':'application/json'},body:JSON.stringify({path:'content/index.md',...payload})});return decode(await r.text());}
 const before=await native('read',{}),saved=await native('save',{base:before.base,body:'\nNative multisite edit.\n'});assert.equal(saved.ok,true,JSON.stringify(saved));assert(fs.readFileSync(booksFile,'utf8').includes('Native multisite edit'));assert.deepEqual(fs.readFileSync(otherFile),other);checks+=3;await stop();
 const {createDeskHandler,runCommand}=await import(pathToFileURL(path.join(core,'desk/admin/server/desk-server.mjs')));
 let publicUploads=0;const handler=createDeskHandler({root,goblin,getUser:async h=>h==='Bearer fixture-editor-token'?{id:'stable-editor-id'}:null,ownsSite:async()=>null,getSite:async id=>id==='network'?{subdomain:'network',owner_id:'different-owner'}:null,run:async(command,args,options)=>command==='sh'?(publicUploads++,{stdout:'Synthetic R2 transport',stderr:''}):runCommand(command,args,options)});
 gateway=http.createServer((req,res)=>handler(req,res));await listen(gateway);const gb='http://127.0.0.1:'+gateway.address().port;
 async function hosted(verb,payload){const r=await fetch(gb+'/api/desk/content.'+verb+'?site=network&portal=books',{method:'POST',headers:{Origin:'https://network.sheriffcloud.com',Authorization:'Bearer fixture-editor-token','Content-Type':'application/json'},body:JSON.stringify({path:'content/index.md',...payload})});return r.json();}
 const opened=await hosted('read',{});assert.equal(opened.ok,true,JSON.stringify(opened));const published=await hosted('save',{base:opened.base,body:'\nHosted multisite edit.\n'});assert.equal(published.ok,true,JSON.stringify(published));assert.equal(published.published,true);assert.equal(publicUploads,1);assert(fs.readFileSync(booksFile,'utf8').includes('Hosted multisite edit'));assert.deepEqual(fs.readFileSync(otherFile),other);checks+=6;gateway.closeAllConnections();await new Promise(r=>gateway.close(r));gateway=null;
 console.log('Multisite native and hosted adapters: public slug resolves storage ID, correct page built/published, sibling portal unchanged.');
 console.log('Passed '+checks+' front-end editing checks. Fixture identity transport; actual shared editor, Goblin authorization, source save and Sheriff page schedule.');
}finally{await stop();if(browser)await browser.close();if(gateway){gateway.closeAllConnections();await new Promise(r=>gateway.close(r));}directory.closeAllConnections();await new Promise(r=>directory.close(r));if(!process.env.KEEP_FRONTEND_FIXTURE)fs.rmSync(root,{recursive:true,force:true,maxRetries:12,retryDelay:150});}})().catch(e=>{console.error(e);process.exitCode=1});
