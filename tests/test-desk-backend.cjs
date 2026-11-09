const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../sheriff-core/desk/admin/backend.js'),'utf8');
function setup(mode='local'){
  const calls=[];let token='first';const host={mode,session:async()=>({token,initialPortal:'alpha',sites:[{subdomain:'alpha',url:'https://custom.example/'}]})};
  const window={SheriffDeskHost:host,fetch:async(url,options)=>{calls.push({url,options});return new Response('{"ok":true}',{headers:{'Content-Type':'application/json'}})},addEventListener(){}};
  const context={window,document:{visibilityState:'visible',addEventListener(){}},location:{href:'http://desk.test:5173/',origin:'http://desk.test:5173',port:'5173'},URL,URLSearchParams,Response,Headers,Date,setInterval:()=>1,clearInterval(){}};
  vm.runInNewContext(source,context);return {backend:window.SheriffDeskBackend,calls,host,setToken(value){token=value}};
}
(async()=>{
  let checks=0;const local=setup();
  await local.backend.fetch('/api/file?read&portal=alpha&path=content%2Fwith%20space.md');assert.equal(local.calls.at(-1).url,'/api/file?read&portal=alpha&path=content%2Fwith%20space.md');checks++;
  const binary=new Uint8Array([0,255,3]);await local.backend.request('files.upload',{portal:'alpha',path:'public/images/a b.png',no_overwrite:'1'},{method:'POST',body:binary});assert.equal(local.calls.at(-1).options.body,binary);assert.equal(local.calls.at(-1).url,'/api/file?upload&alpha&public%2Fimages%2Fa%20b.png&no_overwrite=1');checks++;
  await local.backend.fetch('/api/file?move&alpha&content%2Fold.md&content%2Fnew.md');assert.equal(local.calls.at(-1).url,'/api/file?move&alpha&content%2Fold.md&content%2Fnew.md');checks++;
  await local.backend.fetch('/api/portal?create&alpha&compendium&My%20Wiki');assert.equal(local.calls.at(-1).url,'/api/portal?create&alpha&compendium&My%20Wiki');checks++;
  assert.equal(local.backend.portalUrl('alpha'),'http://alpha.localhost:5173/');assert.equal(local.backend.assetUrl('alpha','public/images/a b.svg'),'http://alpha.localhost:5173/public/images/a%20b.svg');checks++;
  const cloud=setup('cloud');let response=await cloud.backend.request('portals.list');assert.deepEqual((await response.json()).portals,['alpha']);assert.equal(cloud.calls.length,1);assert.equal(cloud.calls[0].url,'/api/desk/session');checks++;
  await cloud.backend.request('files.upload',{portal:'alpha',path:'public/a.png'},{method:'POST',body:binary});let call=cloud.calls.at(-1);assert(call.url.startsWith('/api/desk/files.upload?'));assert.equal(call.options.body,binary);assert.equal(call.options.headers.get('Authorization'),'Bearer first');assert(!call.url.includes('first'));checks++;
  cloud.setToken('refreshed');await cloud.backend.request('portal.build',{portal:'alpha'});call=cloud.calls.at(-1);assert.equal(call.options.headers.get('Authorization'),'Bearer refreshed');assert(!call.url.includes('refreshed'));checks++;
  assert.equal(cloud.backend.portalUrl('alpha','docs/page.html'),'https://custom.example/docs/page.html');assert.equal(cloud.backend.assetUrl('alpha','public/a.png'),'/api/desk/asset?portal=alpha&path=public%2Fa.png');checks++;
  response=await cloud.backend.request('portals.delete',{portal:'alpha'});assert.equal(response.status,400);assert(!cloud.calls.some(call=>call.url.includes('portals.delete')));checks++;
  cloud.setToken('');const before=cloud.calls.length;await assert.rejects(cloud.backend.request('files.read',{portal:'alpha',path:'config.yall'}),/Sign in/);assert.equal(cloud.calls.length,before);checks++;
  assert.throws(()=>local.backend.fetch('https://elsewhere.example/api/file?list&alpha'),/own API/);assert.throws(()=>local.backend.fetch('/api/unknown'),/Unknown Desk API/);checks++;
  console.log('Passed '+checks+' Desk backend contract checks: local URL/body compatibility, file names with spaces, binary uploads, fresh Cloud sessions, scoped site lists, custom domains, authenticated media URLs, denied lifecycle operations, and expired-session rejection.');
})().catch(error=>{console.error(error);process.exitCode=1});
