// Build output UI tests run against in-memory APIs only. No user sites are built or written.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const pw=require(process.env.SHERIFF_PLAYWRIGHT_MODULE||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const desk=path.resolve(__dirname,'../sheriff-core/desk'),state={calls:[],buildGate:null,mode:'success',files:new Map([['content/notes.md','Original notes']])};
function config(portal){return 'id: '+portal+'\nname: '+portal+'\ndocumentation:\n  versions:\n    - "current"\n  default_version: "current"\n  mode: off\ntheme:\n  name: compendium\n';}
const wrappedOutput=body=>JSON.stringify({body,cookies:[],headers:{},status:200});
function gate(){let release,started;const promise=new Promise(r=>release=r),ready=new Promise(r=>started=r);return {promise,ready,release,started};}
(async()=>{const browser=await pw.chromium.launch({headless:true,executablePath:process.env.SHERIFF_BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
const page=await browser.newPage({viewport:{width:1920,height:1080}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
await page.route('**/*',async route=>{const request=route.request(),u=new URL(request.url());if(u.hostname!=='desk.test')return route.abort();if(u.pathname.startsWith('/api/')){
const endpoint=u.pathname.slice(5),[verb,...args]=u.search.slice(1).split('&'),params=new URLSearchParams(args.join('&')),portal=params.get('portal')||decodeURIComponent(u.search.slice(1));let data={ok:true};
if(endpoint==='portals')data={portals:['example','other']};
else if(endpoint==='file'){
if(verb==='list')data={ok:true,files:['config.yall','nav.yall',...state.files.keys()],dirs:['content']};
else if(verb==='read')data={ok:true,content:params.get('path')==='config.yall'?config(portal):params.get('path')==='nav.yall'?'header: []':state.files.get(params.get('path'))||''};
else if(verb==='write'){state.files.set(params.get('path'),request.postData());state.calls.push({endpoint,portal,path:params.get('path')});data={ok:true,code:0,stdout:wrappedOutput('Full page build output\n<em>literal output</em>\nPage output ends here'),stderr:'Page warning\ngoblin run main.gbln → exit 0 in 378ms (0.378s)'};if(state.buildGate){const wait=state.buildGate;state.buildGate=null;wait.started();await wait.promise;}}
else throw Error('Unexpected mutation '+verb);
}else if(endpoint==='build'){
state.calls.push({endpoint,portal});if(state.buildGate){const wait=state.buildGate;state.buildGate=null;wait.started();await wait.promise;}
if(state.mode==='network')return route.abort('failed');if(state.mode==='invalid')return route.fulfill({contentType:'text/html',body:'Invalid response'});
data=state.mode==='failure'?{ok:false,code:1,stdout:'PRE ACT OUTPUT\nOutput before the failure',stderr:'Compiler error: fixture failure'}:{ok:true,code:0,stdout:'Full portal output for '+portal+'\n'+Array.from({length:140},(_,i)=>'Build line '+i).join('\n')+'\nEND OF OUTPUT',stderr:'Nonfatal warning for '+portal};

if(state.mode==='wrapped')data={ok:true,code:0,stdout:wrappedOutput('Building portal:\nexample\n---- RUNNING PRE ACT ----\nscout::publish_nav_tokens\nC:\\wiki\\new\\notes.md\nPortal build finished.'),stderr:'goblin run main.gbln → exit 0 in 4121ms (4.121s)'};
if(state.mode==='nested')data={ok:true,code:0,stdout:wrappedOutput(wrappedOutput('Nested build output\nSecond line')),stderr:'A genuine warning\ngoblin run main.gbln → exit 0 in 99ms (0.099s)'};
if(state.mode==='wrapped-failure')data={ok:true,code:0,stdout:JSON.stringify({body:'Compiler error: T0205\nmodules/test.gbln:42',headers:{},cookies:[],status:500}),stderr:'goblin run main.gbln → exit 1 in 22ms (0.022s)'};
if(state.mode==='plain-json')data={ok:true,code:0,stdout:'{"body":"Keep literal \\n and \\t","status":200}',stderr:''};
if(state.mode==='array')data=[];
if(state.mode==='root-wrapper')data={body:JSON.stringify({ok:true,code:0,stdout:'Root envelope output\nFinished',stderr:''}),status:200,headers:{},cookies:[]};
if(state.mode==='nonzero')data={ok:true,code:7,stdout:wrappedOutput('Output before failure'),stderr:'Compiler failed\ngoblin run main.gbln → exit 7 in 8ms (0.008s)'};
}else if(endpoint==='list_patterns')data={ok:true,patterns:[]};else if(endpoint==='list_themes')data={themes:['compendium']};else if(endpoint==='ensure_theme')data={ok:true};else throw Error('Unexpected API '+endpoint);
return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
}const file=path.resolve(desk,u.pathname==='/'?'index.html':u.pathname.slice(1));assert(file.startsWith(desk+path.sep));if(!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(file)});
});
let checks=0;const portalPanel=page.locator('[data-build-log=portals]'),contentPanel=page.locator('[data-build-log=content]');
async function view(name){await page.getByRole('link',{name,exact:true}).click();}
async function result(panel,state){await page.waitForFunction(({scope,state})=>document.querySelector('[data-build-log='+scope+']').dataset.state===state,{scope:panel===portalPanel?'portals':'content',state});}
async function portalBuild(name){await page.locator('#portal-manage-list .portal').filter({has:page.locator('.portal-name',{hasText:new RegExp('^'+name+'$')})}).getByRole('button',{name:'Build portal',exact:true}).click();}
await page.addInitScript(()=>{window.SheriffDeskHost={liveBuilds:false};});await page.goto('http://desk.test/#portals');await page.locator('#portal-manage-list .portal').first().waitFor();const a=await page.locator('.portals-wrap').boundingBox(),b=await portalPanel.boundingBox();assert(b.x>a.x+a.width,'Portal log should sit to the right');checks++;
const delayed=gate();state.buildGate=delayed;await portalBuild('other');await delayed.ready;await result(portalPanel,'running');assert((await portalPanel.textContent()).includes('other'));delayed.release();await result(portalPanel,'success');assert((await portalPanel.textContent()).includes('Build line 139'));assert((await portalPanel.textContent()).includes('END OF OUTPUT'));assert((await portalPanel.textContent()).includes('Nonfatal warning for other'));assert((await portalPanel.textContent()).includes('Exit code: 0'));assert((await portalPanel.locator('[data-build-output]').evaluate(el=>el.scrollTop))>0);checks++;
// Copy log contains every line, not only the visible scroll viewport.
await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.copiedBuildLog=value;}}});});await portalPanel.locator('[data-build-copy]').click();assert((await page.evaluate(()=>window.copiedBuildLog)).includes('Build line 139'));checks++;
state.mode='failure';await portalBuild('example');await result(portalPanel,'failed');assert((await portalPanel.textContent()).includes('Output before the failure'));assert((await portalPanel.textContent()).includes('Compiler error'));assert((await portalPanel.textContent()).includes('Exit code: 1'));checks++;
// Match Goblin's actual printed HTTP-envelope output; keep ordinary JSON and diagnostics intact.
state.mode='wrapped';await portalBuild('example');await result(portalPanel,'success');let clean=await portalPanel.locator('[data-build-output]').textContent();assert(clean.startsWith('BUILD SUCCESS — example\n========================================\nExit code: 0'));assert(clean.includes('Building portal:\nexample\n---- RUNNING PRE ACT ----\nscout::publish_nav_tokens'));assert(clean.includes('C:\\wiki\\new\\notes.md'));assert(!clean.includes('"cookies"'));assert(!clean.includes('"headers"'));assert(!clean.includes('"body"'));assert(!clean.includes('--- stderr ---'));assert(!clean.includes('goblin run main.gbln'));assert(!clean.includes('Started:'));assert.match(clean,/Build: 4\.12s/);assert.match(clean,/Total elapsed:/);await portalPanel.locator('[data-build-copy]').click();assert.equal(await page.evaluate(()=>window.copiedBuildLog),clean);checks++;
state.mode='nested';await portalBuild('example');await result(portalPanel,'success');clean=await portalPanel.locator('[data-build-output]').textContent();assert(clean.includes('Nested build output\nSecond line'));assert(clean.includes('A genuine warning'));assert(!clean.includes('goblin run main.gbln'));checks++;
state.mode='wrapped-failure';await portalBuild('example');await result(portalPanel,'failed');assert((await portalPanel.textContent()).includes('Compiler error: T0205\nmodules/test.gbln:42'));assert((await portalPanel.locator('[data-build-output]').textContent()).startsWith('BUILD FAILED'));checks++;
state.mode='plain-json';await portalBuild('example');await result(portalPanel,'success');assert((await portalPanel.textContent()).includes('{"body":"Keep literal \\n and \\t","status":200}'));checks++;
state.mode='root-wrapper';await portalBuild('example');await result(portalPanel,'success');assert((await portalPanel.textContent()).includes('Root envelope output\nFinished'));assert((await portalPanel.textContent()).includes('Exit code: 0'));checks++;
state.mode='nonzero';await portalBuild('example');await result(portalPanel,'failed');assert((await portalPanel.textContent()).includes('Compiler failed'));assert((await portalPanel.textContent()).includes('Exit code: 7'));assert(!(await portalPanel.textContent()).includes('goblin run main.gbln'));state.mode='success';checks++;
await view('Content');await page.locator('#ed-filter').fill('notes.md');await page.locator('#file-tree').getByText('content/notes.md',{exact:true}).click();await page.waitForFunction(()=>!document.getElementById('ed-text').disabled);await page.locator('#ed-text').fill('Edited notes retained in the editor');
const pageGate=gate();state.buildGate=pageGate;await page.locator('#ed-build-page').click();await pageGate.ready;assert.equal(await page.locator('#ed-tab-log').getAttribute('aria-selected'),'true');assert(await page.locator('#ed-editor-panel').isHidden());await result(contentPanel,'running');await page.locator('#ed-tab-editor').click();await page.locator('#ed-text').fill('New edits typed while building');await page.locator('#ed-tab-log').click();pageGate.release();await result(contentPanel,'success');assert((await contentPanel.textContent()).includes('Full page build output'));assert((await contentPanel.textContent()).includes('Page warning'));assert(!(await contentPanel.textContent()).includes('goblin run main.gbln'));assert(!(await contentPanel.textContent()).includes('\"cookies\"'));assert((await contentPanel.textContent()).includes('<em>literal output</em>'));assert.equal(await contentPanel.locator('em').count(),0);checks++;
await page.locator('#ed-tab-editor').click();assert.equal(await page.locator('#ed-text').inputValue(),'New edits typed while building');assert(!(await page.locator('#ed-save').isDisabled()));await page.locator('#ed-tab-editor').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#ed-tab-log').getAttribute('aria-selected'),'true');await page.keyboard.press('Home');assert(await page.locator('#ed-text').isVisible());checks++;
await view('Portals');assert((await portalPanel.textContent()).includes('Full page build output'));await view('Content');await page.locator('#ed-tab-log').click();assert((await contentPanel.textContent()).includes('Full page build output'));checks++;
await page.locator('#desk-portal').selectOption('other');assert.equal(await page.locator('#ed-tab-editor').getAttribute('aria-selected'),'true');await page.locator('#ed-tab-log').click();assert((await contentPanel.textContent()).includes('Full portal output for other'));assert(!(await contentPanel.textContent()).includes('Full page build output'));checks++;
state.mode='invalid';await view('Portals');await portalBuild('other');await result(portalPanel,'failed');assert((await portalPanel.textContent()).includes('unreadable response'));checks++;
state.mode='array';await portalBuild('other');await result(portalPanel,'failed');assert((await portalPanel.textContent()).includes('unreadable response'));checks++;
state.mode='network';await portalBuild('other');await result(portalPanel,'failed');assert((await portalPanel.textContent()).includes('Failed to fetch'));state.mode='success';checks++;
await view('Dashboard');await page.locator('#build-all').click();await page.waitForFunction(()=>!document.getElementById('build-all').disabled);const aggregate=await page.locator('#build-log').textContent();assert(aggregate.includes('Full portal output for example'));assert(aggregate.includes('Full portal output for other'));assert.equal((aggregate.match(/END OF OUTPUT/g)||[]).length,2);checks++;
// Stream chunks can split JSON lines and UTF-8 characters. Never wait for R2 to finish to show build success.
await view('Portals');
await page.evaluate(()=>{
  const backend=window.SheriffDeskBackend;window.savedPhaseBackend={fetch:backend.fetch,mode:backend.mode};
  backend.mode='cloud';backend.fetch=async(_input,options)=>{
    if(new Headers(options.headers).get('Accept')!=='application/x-ndjson')throw Error('Missing streaming request');
    return new Response(new ReadableStream({start(controller){window.phaseController=controller;}}),{headers:{'Content-Type':'application/x-ndjson'}});
  };
  window.phaseBuild={ok:true,code:0,build_code:0,build_ms:123,build_stdout:'Sheriff output λ',build_stderr:''};
  window.phaseRequest=window.SheriffBuildLog.fetch('/api/build?example');
});
await page.waitForFunction(()=>!!window.phaseController);
await page.evaluate(()=>window.phaseController.enqueue(new TextEncoder().encode(JSON.stringify({phase:'building',stream:'stdout',chunk:'First live message\n'})+'\n')));
await portalPanel.locator('[data-build-output]').filter({hasText:'First live message'}).waitFor();
assert.equal(await portalPanel.getAttribute('data-state'),'running');
assert(!(await portalPanel.locator('[data-build-output]').textContent()).includes('BUILD FAILED'));checks++;
await page.evaluate(()=>window.phaseController.enqueue(new TextEncoder().encode(JSON.stringify({phase:'building',stream:'stdout',chunk:'Second live message λ\n'})+'\n')));
await portalPanel.locator('[data-build-output]').filter({hasText:'Second live message λ'}).waitFor();checks++;

await page.evaluate(()=>{
  const bytes=new TextEncoder().encode(JSON.stringify({phase:'uploading',...window.phaseBuild})+'\n');
  for(let offset=0;offset<bytes.length;offset+=3)window.phaseController.enqueue(bytes.slice(offset,offset+3));
});
await portalPanel.locator('[data-build-status]').filter({hasText:'Uploading to R2…'}).waitFor();
assert.match(await portalPanel.locator('[data-build-output]').textContent(),/Sheriff output λ\n\nBUILD SUCCESS · Sheriff: 0\.12s\nUploading to R2…/);checks++;
await page.evaluate(async()=>{
  window.phaseController.enqueue(new TextEncoder().encode(JSON.stringify({phase:'result',...window.phaseBuild,published:true,upload_ms:345,upload_stdout:'Upload output',stdout:'Sheriff output λ\nUpload output'})+'\n'));
  window.phaseController.close();window.phaseResponse=await (await window.phaseRequest).json();
});
await result(portalPanel,'success');assert.match(await portalPanel.locator('[data-build-status]').textContent(),/Build: 0\.12s · R2 upload: 0\.34s/);assert.match(await portalPanel.locator('[data-build-output]').textContent(),/UPLOAD SUCCESS · R2 upload: 0\.34s/);checks++;
// A dropped connection after building must remain visibly failed, with its diagnostic retained.
await page.evaluate(()=>{window.phaseRequest=window.SheriffBuildLog.fetch('/api/build?example');});
await page.evaluate(()=>{window.phaseController.enqueue(new TextEncoder().encode(JSON.stringify({phase:'uploading',...window.phaseBuild})+'\n'));window.phaseController.close();});
await page.evaluate(async()=>{window.phaseResponse=await (await window.phaseRequest).json();});
await result(portalPanel,'failed');assert.match(await portalPanel.locator('[data-build-output]').textContent(),/unreadable response/);assert(!(await page.evaluate(()=>window.phaseResponse)).ok);checks++;
await page.evaluate(()=>{Object.assign(window.SheriffDeskBackend,window.savedPhaseBackend);});
if(process.env.SHERIFF_BUILD_LOG_PREVIEW_DIR){await page.evaluate(()=>document.getElementById('toast').classList.remove('show'));const out=path.resolve(process.env.SHERIFF_BUILD_LOG_PREVIEW_DIR);fs.mkdirSync(out,{recursive:true});await view('Portals');state.mode='wrapped';await portalBuild('example');await result(portalPanel,'success');state.mode='success';await page.screenshot({path:path.join(out,'portals.png'),fullPage:true});await page.locator('#desk-portal').selectOption('example');await view('Content');await page.locator('#ed-filter').fill('notes.md');await page.locator('#file-tree').getByText('content/notes.md',{exact:true}).click();await page.waitForFunction(()=>!document.getElementById('ed-text').disabled);await page.locator('#ed-text').fill('Updated fixture content');await page.locator('#ed-build-page').click();await result(contentPanel,'success');await page.screenshot({path:path.join(out,'content-log.png'),fullPage:true});await page.locator('#ed-tab-editor').click();await page.screenshot({path:path.join(out,'content-editor.png'),fullPage:true});await view('Portals');await page.setViewportSize({width:600,height:900});await page.screenshot({path:path.join(out,'narrow.png'),fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Narrow layout overflow');const box=await page.locator('.portals-wrap').boundingBox(),logBox=await portalPanel.boundingBox();assert(logBox.y>=box.y+box.height,'Narrow log should sit below portal cards');checks++;}
assert.deepEqual(errors,[]);console.log('Passed '+checks+' build-log browser scenarios: decoded transport envelopes, literal JSON/backslashes, preserved warnings/errors, failure status, clean copy output, placement, full stdout/stderr, status/exit code, copy, automatic tabs, editor preservation, keyboard controls, portal isolation, retained results, failures, batch output, and responsive layout. All build/file APIs mocked.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
