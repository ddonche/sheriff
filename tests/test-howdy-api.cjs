// Regression: Goblin's local HTTP server executes exported API scripts from dist.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const repo=path.resolve(__dirname,'..'),root=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-howdy-api-')),core=path.join(root,'sheriff-core'),dist=path.join(root,'dist'),goblin=process.env.SHERIFF_GOBLIN||'goblin';
function copy(source,target){fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);}
for(const file of ['desk/admin/requests/howdy_request.gbln','modules/howdy/howdy.gbln','modules/site_portals/context.gbln','build-support/output.gbln'])copy(path.join(repo,'sheriff-core',file),path.join(core,file));
copy(path.join(repo,'sheriff-core/desk/api/howdy.gbln'),path.join(dist,'api/howdy.gbln'));
function request(payload,{method='POST',mode='local',file=false,explicitRoot=true}={}){
 const input=path.join(root,'body.json');if(file)fs.writeFileSync(input,JSON.stringify(payload));
 const env={...process.env,GOBLIN_METHOD:method,SHERIFF_RUNTIME_MODE:mode,GOBLIN_BODY:file?'':JSON.stringify(payload),GOBLIN_REQUEST_FILE:file?input:'',PATH:path.dirname(goblin)+path.delimiter+process.env.PATH};
 if(explicitRoot)env.SHERIFF_ROOT=root;else delete env.SHERIFF_ROOT;
 const result=spawnSync(goblin,['run','api/howdy.gbln'],{cwd:dist,env,windowsHide:true,encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr+'\n'+result.stdout);return JSON.parse(result.stdout);
}
try{
 const source='name: Trial\n# Keep this comment\ntheme:\n  name: compendium\n';
 assert.deepEqual(request({text:source}),{ok:true,enabled:false});
 const enabled=request({text:source,enabled:true},{file:true});assert.equal(enabled.ok,true,enabled.stderr);assert.equal(enabled.enabled,true);assert(enabled.content.startsWith(source));
 assert.equal(request({text:enabled.content,enabled:false},{explicitRoot:false}).enabled,false);
 assert.equal(request({text:source},{method:'GET'}).ok,false);
 assert.equal(request({text:source},{mode:'cloud'}).ok,false);
 assert.equal(request({text:42}).ok,false);
 assert.equal(request({text:'name: [broken'}).ok,false);
 assert.deepEqual(fs.readdirSync(path.join(root,'data/desk-howdy-requests')),[],'Temporary requests must be removed on success and failure');
 assert(!fs.existsSync(path.join(root,'site')),'Reading/toggling must not save or build a site');
 // Import failures must still reach the browser as JSON, not a runtime error page.
 fs.unlinkSync(path.join(core,'modules/howdy/howdy.gbln'));const failure=request({text:source});assert.equal(failure.ok,false);assert(failure.stderr.includes('howdy'));
 console.log('Howdy dist adapter passed inspect/toggle, file bodies, fallback root, invalid requests, failure diagnostics and cleanup without site writes.');
}finally{assert(path.basename(root).startsWith('sheriff-howdy-api-'));fs.rmSync(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
