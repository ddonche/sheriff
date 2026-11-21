const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');let checks=0;
function setup(mode='local'){
 const calls=[],window={SheriffDeskHost:{mode},dispatchEvent(){},addEventListener(){},SheriffPortalContext:{lock:()=>()=>{}},fetch:async(url,options={})=>{calls.push({url:String(url),options});return new Response(JSON.stringify({ok:true,code:0,id:'tracking',stdout:'Built',content:'Source'}),{headers:{'Content-Type':'application/json'}});}};
 vm.runInNewContext(fs.readFileSync(require('path').resolve(__dirname,'../sheriff-core/desk/admin/backend.js'),'utf8'),{window,document:{addEventListener(){},visibilityState:'hidden'},CustomEvent,URL,URLSearchParams,Response,Headers,ReadableStream,TextEncoder,TextDecoder,setTimeout,setInterval:()=>0,clearInterval,Date,location:{href:'http://local:5173/',origin:'http://local:5173',port:'5173'}});
 const api=window.SheriffDeskBackend;api.setSites([{id:'iveki',grouped:true,portals:[{id:'programming',source:'iveki-programming'},{id:'history',source:'iveki-history'}]}]);return {api,calls};
}
(async()=>{const {api,calls}=setup();
 assert.equal(api.portalUrl('iveki-programming'),'http://iveki.localhost:5173/p/programming/wiki/');checks++;
 assert.equal(api.portalUrl('solo'),'http://solo.localhost:5173/');checks++;
 assert.equal(api.assetUrl('iveki-programming','public/logo.png'),'http://iveki-programming.localhost:5173/public/logo.png');checks++;
 await api.request('files.write',{portal:'iveki-programming',path:'content/index.md',build:'none'},{method:'POST',body:'Saved'});assert(!calls.some(c=>c.url.includes('/api/sites')));checks++;
 calls.length=0;await api.request('page.build',{portal:'iveki-programming',path:'content/with space.md'});const build=calls.find(c=>c.url.startsWith('/api/sites?'));assert(build.url.includes('portal=programming'));assert(build.url.includes('path=with+space.md'));assert(!calls.some(c=>c.url.includes('/api/build_progress')));checks++;
 calls.length=0;await api.request('files.write',{portal:'iveki-programming',path:'content/index.md',build:'portal'},{method:'POST',body:'Source'});assert(calls.findIndex(c=>c.url.startsWith('/api/file'))<calls.findIndex(c=>c.url.startsWith('/api/sites')));assert(calls.find(c=>c.url.startsWith('/api/file')).url.endsWith('build=none'));checks++;
 calls.length=0;await api.request('sites.build',{site:'iveki'},{method:'POST'});assert.equal(calls.filter(c=>c.url.includes('/api/changes?begin')).length,2);assert.equal(calls.filter(c=>c.url.includes('/api/changes?finish')).length,2);assert.equal(api.isBusy(),false);checks++;
 const cloud=setup('cloud');const denied=await cloud.api.request('sites.list');assert.equal(denied.status,400);assert.equal(cloud.calls.length,0);checks++;
 console.log('Passed '+checks+' multisite transport checks.');
})().catch(e=>{console.error(e);process.exitCode=1});
