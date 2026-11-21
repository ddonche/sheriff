const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const repo=process.env.SHERIFF_TEST_REPO||path.resolve(__dirname,'..'),out=process.env.SHERIFF_TEST_OUTPUT||path.resolve(__dirname,'..'),root=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-modules-gallery-')),core=path.join(root,'sheriff-core');
const {chromium}=require(process.env.SHERIFF_PLAYWRIGHT_MODULE||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const goblin=process.env.SHERIFF_GOBLIN||'goblin';
fs.cpSync(path.join(repo,'sheriff-core'),core,{recursive:true,filter:p=>!['.vs','node_modules','__pycache__'].includes(path.basename(p))});
function put(rel,text){const p=path.join(root,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text)}
function run(script,body={},query='',{dist=false,mode='local',method='POST'}={}){
 const request=path.join(root,'request.json');fs.writeFileSync(request,typeof body==='string'?body:JSON.stringify(body));
 const result=spawnSync(goblin,['run',script],{cwd:dist?path.join(root,'dist'):core,env:{...process.env,SHERIFF_ROOT:root,SHERIFF_RUNTIME_MODE:mode,GOBLIN_METHOD:method,GOBLIN_QUERY_STRING:query,GOBLIN_BODY:'',GOBLIN_REQUEST_FILE:request},encoding:'utf8',timeout:30000,maxBuffer:16e6,windowsHide:true});
 assert.equal(result.status,0,result.stderr+'\n'+result.stdout);return JSON.parse(result.stdout);
}
const initial='id: trial\nname: Trial\n# Preserve me\ntheme:\n  name: compendium\nhowdy:\n  enabled: false\n  # Keep this comment\n  future: keep\n';
put('site/portals/trial/config.yall',initial);put('site/portals/trial/content/index.md','^^^^\ntitle: Trial\nlayout: wiki\n^^^^\n\nTrial.');
put('site/portals/network-books/config.yall','id: network-books\nname: Books\ntheme:\n  name: outpost\nmembership:\n  site: network\n  portal: books\n');
put('site/sites/network/site.yall','name: Network\ntheme: compendium\nportals:\n  books:\n    source: network-books\n    name: Books\n');
put('sheriff-core/modules/example/desk.yall','name: Example module\nicon: puzzle\nsettings:\n  enabled:\n    type: boolean\n    section: example\n    key: enabled\n    label: Enable example module\n    default: false\n');
fs.mkdirSync(path.join(root,'dist/api'),{recursive:true});fs.copyFileSync(path.join(core,'desk/api/modules.gbln'),path.join(root,'dist/api/modules.gbln'));
const image=(n,size='thumb',align='left')=>'[[image:sample'+n+'.svg|'+size+'|'+align+'|Figure '+n+']]';
const gallery='::: gallery 3\n'+image(1)+'\n\nFirst explanation with **emphasis**.\n\n'+image(2)+'\n\nSecond explanation.\n\n'+image(3)+'\n\nThird explanation.\n:::\n\n## Following section\n\nNormal text after the images.';
const cases=[{name:'gallery',body:gallery},{name:'two',body:'::: gallery 2\n'+image(1,'half','right')+'\n'+image(2,'full','center')+'\n:::'},{name:'four',body:'::: gallery 4\n'+[1,2,3,4].map(n=>image(n)).join('\n')+'\n:::'},{name:'ordinary',body:image(1)+'\n\nOrdinary text wraps next to this image.'},{name:'code',body:'````markdown\n'+gallery+'\n````'},{name:'comment',body:'<!--\n'+gallery+'\n-->'},{name:'invalid',body:'::: gallery 8\n'+image(1)+'\n:::'},{name:'unclosed',body:'::: gallery 3\n'+image(1)}];
put('sheriff-core/gallery-cases.json',JSON.stringify(cases));put('sheriff-core/gallery-fixture.gbln',`import modules/markdown_core/markdown as markdown
import modules/trailboss_wiki/trailboss as trailboss
out | []
for item in :read_json("gallery-cases.json")
    ctx | {"portal":"trial","body":item{"body"},"frontmatter":{}}
    ctx |= markdown::render(ctx)
    ctx |= trailboss::render_fences(ctx)
    ctx |= trailboss::process_wikilinks(ctx)
    :put_last!(out,{"name":item{"name"},"html":ctx{"body"}})
xx
:say(:json_stringify(out))
`);
let browser,server;let served;
(async()=>{try{
 const inspected=run('desk/admin/requests/desk_modules_request.gbln',{text:initial},'inspect');assert(inspected.ok,inspected.stderr);assert.equal(inspected.panels.length,2);assert(inspected.panels.every(p=>p.fields.length===1));
 for(const id of ['modules/howdy','modules/example']){const patched=run('desk/admin/requests/desk_modules_request.gbln',{text:initial,module:id,field:'enabled',value:true},'patch');assert(patched.ok,patched.stderr);assert(patched.content.includes('# Preserve me'));assert(patched.content.includes('future: keep'));assert.equal(patched.panels.find(p=>p.id===id).fields[0].value,true);}
 assert.equal(fs.readFileSync(path.join(root,'site/portals/trial/config.yall'),'utf8'),initial);
 for(const payload of [{module:'../howdy',field:'enabled',value:true},{module:'modules/howdy',field:'enabled',value:'true'}])assert.equal(run('desk/admin/requests/desk_modules_request.gbln',{text:initial,...payload},'patch').ok,false);
 assert.equal(run('desk/admin/requests/desk_modules_request.gbln',{text:'howdy: {enabled: true}',module:'modules/howdy',field:'enabled',value:false},'patch').ok,false);
 assert.equal(run('api/modules.gbln',{text:initial},'inspect&portal=trial',{dist:true}).panels.length,2);
 assert.equal(run('api/modules.gbln',{text:initial},'inspect&portal=trial',{dist:true,mode:'cloud'}).ok,false);
 const adapter=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(core,'desk/admin/visual/visual-source.js'),'utf8')).toString('base64'));for(const item of cases){const source='^^^^\ntitle: Gallery\nlayout: docs\n^^^^\n\n'+item.body;const parsed=adapter.parsePage(source);assert.equal(adapter.serializePage(parsed,parsed.doc),source,'Visual/Source preserves '+item.name);}
 const rows=run('gallery-fixture.gbln');served=new Map(rows.map(r=>[r.name,r.html]));
 const {createDeskHandler}=await import(require('node:url').pathToFileURL(process.env.SHERIFF_CLOUD_GATEWAY||path.resolve(repo,'../sheriffcloud/desk-server.mjs')).href);
 const cloud=createDeskHandler({root,goblin,secureCookies:false,getUser:async auth=>auth==='Bearer fixture'?{id:'owner'}:null,ownsSite:async(_,id)=>['trial','network'].includes(id)?{id,subdomain:id,name:id}:null});
 server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://local');
  if(url.pathname.startsWith('/api/desk/')){await cloud(req,res);return;}
  if(url.pathname.startsWith('/api/')){
   const name=url.pathname.slice(5),parts=[];for await(const part of req)parts.push(part);const body=Buffer.concat(parts).toString();
   const supported=['modules','sites','portals','portal','file','changes','list_themes','theme_config','frontmatter','ensure_theme'];
   const result=supported.includes(name)?run(name==='modules'?'api/modules.gbln':'desk/api/'+name+'.gbln',body,url.search.slice(1),{dist:name==='modules',method:req.method}):{ok:true,files:[],folders:[],items:[],connected:false};
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
  }
  if(url.pathname.startsWith('/gallery/')){
   const theme=url.searchParams.get('theme')||'compendium',mode=url.searchParams.get('mode')||'light';assert(['compendium','outpost','siegemate'].includes(theme));
   const css=fs.readFileSync(path.join(core,'themes',theme,'css',theme+'.css'),'utf8').replace(/^@import.*$/gm,'');
   res.setHeader('Content-Type','text/html');res.end('<!doctype html><html data-theme="'+mode+'"><meta charset=utf-8><style>'+css+'\nbody{padding:24px}.sheriff-article{max-width:1100px;margin:auto}</style><article class="sheriff-article">'+served.get(url.pathname.slice(9))+'</article></html>');return;
  }
  if(url.pathname.startsWith('/public/images/')){res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><path fill="#c00f25" d="M0 0h300v200H0z"/><path fill="#1e5288" d="M250 0h50v200H80C120 100 230 80 250 0"/></svg>');return;}
  const file=path.resolve(core,'desk','.'+(url.pathname==='/'?'/index.html':url.pathname));assert(file.startsWith(path.join(core,'desk')+path.sep));let body=fs.readFileSync(file);
  if(url.pathname==='/'&&url.searchParams.get('mode')==='cloud')body=Buffer.from(body.toString().replace('</head>','<script>window.SheriffDeskHost={mode:"cloud",session:async()=>({token:"fixture",initialPortal:"trial",sites:[{subdomain:"trial",name:"Trial"},{subdomain:"network",name:"Network"}]})};</script></head>'));
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(body);
 }catch(error){res.statusCode=500;res.end(JSON.stringify({ok:false,stderr:error.message}));}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const denied=await fetch(origin+'/api/desk/modules.inspect?portal=trial',{method:'POST',body:JSON.stringify({text:initial})});assert.equal(denied.status,401);
 const forbidden=await fetch(origin+'/api/desk/modules.inspect?portal=another',{method:'POST',headers:{Authorization:'Bearer fixture'},body:JSON.stringify({text:initial})});assert.equal(forbidden.status,403);
 browser=await chromium.launch({headless:true,executablePath:process.env.SHERIFF_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 for(const mode of ['local','cloud']){
  fs.writeFileSync(path.join(root,'site/portals/trial/config.yall'),initial);
  put('site/sites/network/site.yall','name: Network\ntheme: compendium\nportals:\n  books:\n    source: network-books\n    name: Books\n');
  const context=await browser.newContext({viewport:{width:1400,height:950}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  await page.goto(origin+'/?mode='+mode+'#modules');await page.locator('#desk-site option[value="trial"]').waitFor({state:'attached'});await page.locator('#desk-portal').selectOption('trial');
  assert.equal(await page.locator('[data-build-log=modules]').count(),0);assert.equal(await page.locator('#view-modules .settings-build-layout').count(),0);await page.getByRole('button',{name:'Open Howdy panel'}).click();const enabled=page.getByRole('checkbox',{name:/Enable Howdy/});await enabled.waitFor();await enabled.check();await page.waitForFunction(()=>!document.getElementById('modules-save').disabled);
  assert.equal(fs.readFileSync(path.join(root,'site/portals/trial/config.yall'),'utf8'),initial,'Toggling must not save or build');
  await page.locator('#modules-save').click();await page.waitForFunction(()=>document.getElementById('modules-status').textContent.includes('saved'));assert(fs.readFileSync(path.join(root,'site/portals/trial/config.yall'),'utf8').includes('enabled: true\n  # Keep this comment'));
  await page.locator('a[data-view=config]').click();await page.waitForFunction(()=>!document.getElementById('cf-text').disabled);assert.equal(await page.locator('#cf-howdy-enabled').count(),0);assert((await page.locator('#cf-text').inputValue()).includes('enabled: true'));
  await page.locator('a[data-view=modules]').click();await enabled.waitFor();await page.locator('#desk-portal').selectOption('network-books');await page.waitForFunction(()=>document.getElementById('modules-scope').textContent.includes('Network'));
  await enabled.check();await page.waitForFunction(()=>!document.getElementById('modules-save').disabled);await page.locator('#modules-save').click();await page.waitForFunction(()=>document.getElementById('modules-status').textContent.includes('saved'));assert(fs.readFileSync(path.join(root,'site/sites/network/site.yall'),'utf8').includes('enabled: true'));assert(!fs.readFileSync(path.join(root,'site/portals/network-books/config.yall'),'utf8').includes('howdy:'));
  await enabled.waitFor({state:'visible'});assert(await enabled.isEnabled(),'Module switch stays usable after Save');await page.screenshot({path:path.join(out,'modules-'+mode+'.png'),fullPage:true});assert.deepEqual(errors,[]);await context.close();console.log('Modules '+mode+': declared controls, shared source buffer, Save-only and multisite parent settings passed.');
 }
 for(const theme of ['compendium','outpost','siegemate'])for(const mode of ['light','dark']){
  const page=await browser.newPage({viewport:{width:1200,height:900}});await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  await page.goto(origin+'/gallery/gallery?theme='+theme+'&mode='+mode);await page.locator('.sheriff-gallery img').first().waitFor();assert.equal(await page.locator('.sheriff-gallery-item').count(),3);assert.equal(await page.locator('.sheriff-gallery-item strong').count(),1);
  const boxes=await page.locator('.sheriff-gallery-item').evaluateAll(items=>items.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,bottom:r.bottom,width:r.width}}));assert.equal(new Set(boxes.map(b=>b.y)).size,1);assert.equal(new Set(boxes.map(b=>b.x)).size,3);assert(Math.max(...boxes.map(b=>b.width))-Math.min(...boxes.map(b=>b.width))<1,JSON.stringify(boxes));assert((await page.locator('h2').boundingBox()).y>=Math.max(...boxes.map(b=>b.bottom)));
  await page.screenshot({path:path.join(out,'gallery-'+theme+'-'+mode+'.png'),fullPage:true});
  await page.setViewportSize({width:375,height:900});assert.equal(await page.locator('.sheriff-gallery-item').evaluateAll(items=>new Set(items.map(e=>e.getBoundingClientRect().x)).size),1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  for(const name of ['code','comment','invalid','unclosed']){await page.goto(origin+'/gallery/'+name+'?theme='+theme);assert.equal(await page.locator('.sheriff-gallery').count(),0,name);}
  for(const [name,count] of [['two',2],['four',4]]){await page.setViewportSize({width:1200,height:900});await page.goto(origin+'/gallery/'+name+'?theme='+theme);const cells=await page.locator('.sheriff-gallery-item').evaluateAll(items=>items.map(e=>e.getBoundingClientRect().y));assert.equal(cells.length,count);assert.equal(new Set(cells).size,1);}
  await page.goto(origin+'/gallery/ordinary?theme='+theme);assert.equal(await page.locator('.sheriff-image-block').evaluate(e=>getComputedStyle(e).float),'left');await page.close();console.log('Gallery '+theme+' '+mode+': equal row, captions/descriptions, following heading, mobile stacking and ordinary floats passed.');
 }
 console.log('Fixture retained for inspection: '+root);
 put('verification.json',JSON.stringify({passed:true,root,source:repo},null,2));fs.writeFileSync(path.join(out,'fixture.json'),JSON.stringify({root,origin},null,2));
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));}})().catch(error=>{console.error(error);process.exitCode=1});
