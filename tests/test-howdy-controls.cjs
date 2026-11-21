const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.SHERIFF_PLAYWRIGHT_MODULE||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const core=path.resolve(__dirname,'../sheriff-core');
const fixture=`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/style"><main style="max-width:900px;margin:32px auto"><div class="ed-save-actions"><button class="btn small">Save</button></div><details id="page-details" class="panel"><summary>Page details</summary><div class="page-details-body"></div></details><section id="card" class="panel module-card" style="padding:24px;margin-top:24px"><h3>Howdy — Sheriff Cloud login</h3></section></main>
<script>
window.calls=[];let locked=false,editors={},denyLock=false;const listeners=[];
window.failNextLock=()=>denyLock=true;
window.SheriffDesk={contentEditor:()=>({portal:'trial',path:'content/article.md',generation:1,element:{value:'Unsaved content'}})};
window.SheriffPortalContext={current:'trial',subscribe:fn=>listeners.push(fn)};
window.SheriffDeskBackend={mode:'cloud',request:async(op,args,options)=>{
 const payload=JSON.parse(options.body);calls.push({op,args,payload});
 if(op.endsWith('.lock')&&denyLock){denyLock=false;return new Response(JSON.stringify({ok:false,stderr:'Connection interrupted. Try again.'}),{status:503});}
 if(op.endsWith('.lock'))locked=payload.locked;
 if(op.endsWith('.grant'))editors.editor=payload.username;
 if(op.endsWith('.revoke'))delete editors[payload.subject];
 return new Response(JSON.stringify({ok:true,editors,capabilities:{manage_access:true,locked}}));
}};
</script><script src="/script"></script>`;
const server=http.createServer((req,res)=>{
 if(req.url==='/style'){res.writeHead(200,{'Content-Type':'text/css'});res.end(fs.readFileSync(path.join(core,'desk/admin/admin.css')));return;}
 if(req.url==='/panel'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(fs.readFileSync(path.join(core,'modules/howdy/admin/panel.js')));return;}
 if(req.url==='/script'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(fs.readFileSync(path.join(core,'desk/admin/howdy-access.js')));return;}
 res.writeHead(200,{'Content-Type':'text/html'});res.end(fixture);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const executablePath=process.env.SHERIFF_CHROME||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined);
 const browser=await chromium.launch({...(executablePath?{executablePath}:{}),headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:750}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  assert.equal(await page.locator('#page-details').evaluate(el=>el.open),false);assert.equal(await page.locator('.ed-save-actions').getByRole('button',{name:'Lock page',exact:true}).isVisible(),true);
  await page.getByRole('button',{name:'Lock page',exact:true}).click();
  await page.getByRole('button',{name:'Unlock page',exact:true}).waitFor();
  assert(await page.evaluate(()=>SheriffHowdyAccess.blocked('trial','content/article.md')));
  assert.equal(await page.evaluate(()=>SheriffDesk.contentEditor().element.value),'Unsaved content');
  await page.getByRole('button',{name:'Unlock page',exact:true}).click();
  await page.getByRole('button',{name:'Lock page',exact:true}).waitFor();
  await page.evaluate(()=>failNextLock());await page.getByRole('button',{name:'Lock page',exact:true}).click();
  await page.getByText('Connection interrupted. Try again.',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Lock page',exact:true}).isEnabled(),true);
  await page.evaluate(async()=>{const entry=await import('/panel');const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};await entry.mount({container:document.getElementById('card'),portal:'trial',mode:'cloud',signal:new AbortController().signal,services:{backend:SheriffDeskBackend},ui:{node,button(label,fn){const b=node('button',label,'btn small');b.type='button';b.onclick=fn;return b;},field(label){const element=node('label'),input=node('input');input.className='wiz-input';input.setAttribute('aria-label',label);element.append(node('span',label),input);return {element,input};},icon(){return node('span');},message(text){return node('p',text,'np-hint');}}});});
  await page.getByLabel('Sheriff username').fill('alice');await page.getByRole('button',{name:'Allow editing'}).click();
  await page.getByText('alice',{exact:true}).waitFor();
  if(process.env.SHERIFF_DESK_SCREENSHOT)await page.screenshot({path:process.env.SHERIFF_DESK_SCREENSHOT});
  await page.getByRole('button',{name:'Remove access'}).click();await page.getByText('Only the site owner can edit this portal.').waitFor();
  const calls=await page.evaluate(()=>window.calls);assert(calls.every(c=>c.args.portal==='trial'));assert(!calls.some(c=>/build|files.write/.test(c.op)));assert.deepEqual(errors,[]);
  console.log('Howdy Desk browser controls passed lock/unlock, retry errors, buffer preservation, username grant/revoke, selected-portal scope and no implicit builds.');
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
