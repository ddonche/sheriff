const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const repo=process.env.SHERIFF_REPO||'C:/Users/kc516/Desktop/sheriff';
const source=fs.readFileSync(path.join(repo,'sheriff-core/desk/admin/backend.js'),'utf8');let checks=0;
function backend(scenario){
 const calls=[];let polls=0;
 const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
 const window={dispatchEvent(){},SheriffPortalContext:{lock:()=>()=>{}},fetch:async url=>{
  calls.push(String(url));
  if(url.includes('/api/changes'))return json({ok:true,id:'tracking'});
  if(url.includes('/api/file'))return scenario==='save404'?new Response('API script not found: dist/api/file.gbln',{status:404}):json({ok:true,saved:true});
  if(url.includes('start'))return scenario==='start404'?new Response('API script not found: dist/api/build_progress.gbln',{status:404}):json({ok:true,id:'build'});
  if(url.includes('status')){
   polls++;
   if(scenario==='status404')return new Response('API script not found: dist/api/build_progress.gbln',{status:404});
   if(scenario==='runtime500')return new Response('Goblin runtime error: test failure',{status:500});
   return json({ok:true,done:true,next_stdout:5,next_stderr:0,stdout:'Built',stderr:'',result:{ok:scenario!=='failed',code:scenario==='failed'?2:0,stdout:'Built',stderr:scenario==='failed'?'Actual build problem':'',build_ms:5815}});
  }
  throw Error('Unexpected API '+url);
 }};
 vm.runInNewContext(source,{window,location:{origin:'http://local',port:'5173',href:'http://local/'},URL,URLSearchParams,Response,Headers,ReadableStream,TextEncoder,TextDecoder,CustomEvent,setTimeout,Date,console});return {api:window.SheriffDeskBackend,calls};
}
(async()=>{
 for(const scenario of ['start404','save404']){
  const {api,calls}=backend(scenario);await assert.rejects(api.request(scenario==='save404'?'files.write':'portal.build',{portal:'demo',path:'content/index.md',build:'portal'},{body:'Source',headers:{Accept:'application/x-ndjson'}}),error=>error.message.includes('HTTP 404')&&error.message.includes('API script not found')&&!error.message.includes('Unexpected token'));checks++;if(scenario==='save404')assert(!calls.some(url=>url.includes('build_progress')));
 }
 for(const scenario of ['status404','runtime500','healthy','failed']){
  const {api,calls}=backend(scenario),response=await api.request('portal.build',{portal:'demo'},{headers:{Accept:'application/x-ndjson'}});const events=(await response.text()).trim().split('\n').map(JSON.parse),result=events.at(-1);assert.equal(result.phase,'result');
  if(scenario==='status404'||scenario==='runtime500'){assert.equal(result.ok,false);assert(result.stderr.includes(scenario==='status404'?'HTTP 404':'HTTP 500'));assert(result.stderr.includes(scenario==='status404'?'API script not found:':'Goblin runtime error:'));assert(!result.stderr.includes('Unexpected token'));}
  else {assert.equal(result.code,scenario==='healthy'?0:2);assert.equal(result.build_ms,5815);assert.equal(result.stderr,scenario==='healthy'?'':'Actual build problem');}
  assert.equal(calls.filter(url=>url.includes('start')).length,1);checks++;
 }
 console.log('Passed '+checks+' build API response cases: plain-text startup/save/poll failures keep the actual HTTP error; success, timing, and genuine build failures remain intact.');
})().catch(error=>{console.error(error);process.exitCode=1});
