(function () {
  'use strict';
  if(window.SheriffDeskBackend.mode==='cloud')return;
  const view=document.getElementById('view-cloud'),context=window.SheriffPortalContext,T=window.SheriffCloudTransfer;
  const CLOUD='https://admin.sheriffcloud.com';
  let connection=null,session=null,pending=null,busy=false,remote=null,local=null,revision=0;
  const icons={cloud:'M20 16.6A4.5 4.5 0 0 0 18 8a6 6 0 0 0-11.7 1.8A3.5 3.5 0 0 0 7 17h2',download:'M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4',upload:'M12 16V4m-5 5 5-5 5 5M5 17v4h14v-4',link:'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2'};
  const svg=name=>'<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="'+icons[name]+'"/></svg>';
  view.innerHTML='<div class="cloud-wrap"><div class="view-head"><h2 class="bracket">Cloud Sync</h2></div><section class="panel cloud-card"><div class="cloud-card-heading">'+svg('cloud')+'<div><h3 id="cl-title">Connect this portal</h3><p id="cl-description">Work locally. Publish to your Cloud site.</p></div><span id="cl-badge" class="cloud-badge">Not connected</span></div><div id="cl-site" hidden><a id="cl-url" target="_blank" rel="noopener"></a><p id="cl-details" class="mono-hint"></p></div><p id="cl-status" role="status" aria-live="polite"></p><div class="cloud-actions"><button id="cl-connect" class="btn teal" type="button">'+svg('link')+'Connect to Cloud</button><button id="cl-download" class="btn" type="button" hidden>'+svg('download')+'Download</button><button id="cl-deploy" class="btn primary" type="button" hidden>'+svg('upload')+'Deploy</button><button id="cl-check" class="btn" type="button" hidden>Check changes</button></div><p class="mono-hint">First version: up to 48 MB for source and build combined.</p><div class="cloud-secondary" id="cl-secondary" hidden><a href="https://admin.sheriffcloud.com" target="_blank" rel="noopener">Cloud settings ↗</a><button id="cl-disconnect" class="btn ghost small" type="button">Disconnect</button></div></section><section class="panel cloud-explanation"><h3>Your local and live site</h3><p><strong>Download</strong> brings Cloud’s source into this local portal so you can work offline. <strong>Deploy</strong> builds locally and uploads the finished site and matching source. Cloud does not build it again.</p><p>If both copies changed, choose which copy to keep. Replaced source is backed up. Saving a file still only saves it; publishing happens when you click Deploy.</p></section><section class="panel cloud-progress" hidden><h3>Deployment progress</h3><pre id="cl-log" aria-live="polite"></pre></section></div>';
  const $=id=>document.getElementById('cl-'+id);
  const logPanel=view.querySelector('.cloud-progress');
  function message(text,error=false){$('status').textContent=text;$('status').classList.toggle('cloud-error',error);}
  function log(text){logPanel.hidden=false;$('log').textContent+=text;$('log').scrollTop=$('log').scrollHeight;}
  function validSession(){return session&&session.expires_at*1000>Date.now()+15000&&(!connection||session.account===connection.account);}
  function render(){
    const connected=!!connection,authenticated=validSession();
    $('title').textContent=connected?'Connected to Cloud':'Connect this portal';$('description').textContent=context.current?'Local portal: '+context.current:'Choose a portal first.';
    $('site').hidden=!connected;$('secondary').hidden=!connected;
    $('connect').hidden=connected&&authenticated;$('connect').innerHTML=svg('link')+(connected?'Sign in to Cloud':'Connect to Cloud');
    if(connection){$('url').textContent=connection.url;$('url').href=connection.url;$('details').textContent='Cloud site: '+connection.portal;}
    for(const id of ['download','deploy','check'])$(id).hidden=!connected;
    for(const id of ['connect','download','deploy','check','disconnect'])$(id).disabled=busy||!context.current||(['download','deploy','check'].includes(id)&&!authenticated);
    $('badge').textContent=!connected?'Not connected':!authenticated?'Sign in to sync':remote?.files===0?'Ready to deploy':remote&&local?remote.revision===local?'Up to date':connection.baseline&&remote.revision===connection.baseline?'Local changes':connection.baseline&&local===connection.baseline?'Cloud changes':'Changes on both sides':'Connected';
  }
  async function result(response){let data;try{data=await response.json()}catch{throw Error('The server returned an unreadable response.');}if(!response.ok||data.ok===false)throw Error(data.stderr||data.error||'The operation failed.');return data;}
  async function api(verb,body,params={}){return result(await fetch('/api/cloud?'+verb+'&'+new URLSearchParams({portal:context.current,...params}),{method:'POST',headers:{'Content-Type':body instanceof Uint8Array?'application/octet-stream':'application/json'},body:body instanceof Uint8Array?body:JSON.stringify(body||{})}));}
  async function cloud(op,body){
    if(!validSession())throw Error('Sign in to Cloud again to continue.');
    const response=await fetch(CLOUD+'/api/desk/sync.'+op+'?'+new URLSearchParams({portal:connection.portal}),{method:'POST',headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/json',Accept:op==='deploy'?'application/x-ndjson':'application/json'},body:JSON.stringify(body||{}),credentials:'omit'});
    if(response.status===401){session=null;render();throw Error('Your Cloud session expired. Sign in again.');}
    if(!response.headers.get('Content-Type')?.includes('application/x-ndjson'))return result(response);
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',doneResult;
    for(;;){const chunk=await reader.read();buffer+=decoder.decode(chunk.value||new Uint8Array(),{stream:!chunk.done});const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines){if(!line)continue;const item=JSON.parse(line);if(item.chunk)log(item.chunk);if(item.phase==='result')doneResult=item;}if(chunk.done)break;}
    if(!doneResult||doneResult.ok===false||!doneResult.published)throw Error(doneResult?.stderr||'Cloud could not finish publishing. Your last sync was not advanced.');return doneResult;
  }
  async function exportSource(){
    const created=await result(await window.SheriffDeskBackend.request('snapshots.create',{portal:context.current},{method:'POST',body:JSON.stringify({name:'Cloud transfer'})}));
    const id=created.snapshot.id;
    try{const data=await result(await window.SheriffDeskBackend.request('snapshots.download',{portal:context.current,id},{method:'POST'}));return await T.unzip(T.bytes(data.zip_base64),T.sourcePath);}
    finally{await window.SheriffDeskBackend.request('snapshots.delete',{portal:context.current,id},{method:'POST'}).catch(()=>{});}
  }
  async function check(){message('Checking local and Cloud changes…');const files=await exportSource();local=await T.fingerprint(files);remote=await cloud('inspect');render();message($('badge').textContent+'.');return files;}
  async function saveBaseline(value){connection=(await api('link',{...connection,baseline:value})).connection;local=value;remote={revision:value};render();}
  async function download(){
    const files=await check();
    if(local!==remote.revision&&(!connection.baseline||local!==connection.baseline)&&!confirm('Replace this local portal with Cloud’s source? Your current local source will be saved in Snapshots.'))return;
    message('Downloading Cloud source…');const data=await cloud('download');
    if(!data.files.length)throw Error('This Cloud site has no source yet. Deploy your local portal first.');
    const incoming=[];for(const file of data.files){if(!T.sourcePath(file.path))throw Error('Cloud returned an unsupported source path.');const bytes=T.bytes(file.base64);if(await T.hash(bytes)!==file.sha256)throw Error('Downloaded file failed its checksum.');incoming.push({path:file.path,bytes});}
    if(await T.fingerprint(incoming)!==data.revision)throw Error('Downloaded source failed its revision check.');
    // Recheck local edits made from another window while the download was in flight.
    if(await T.fingerprint(await exportSource())!==await T.fingerprint(files))throw Error('Local files changed during download. Check changes and retry.');
    const archive=T.zip(incoming);await api('import',archive,{sha256:await T.hash(archive)});await api('state-import',data.state);await saveBaseline(data.revision);message('Downloaded. Your previous local source is in Snapshots. Build locally when you are ready.');
    window.dispatchEvent(new CustomEvent('sheriff:cloud-download',{detail:{portal:context.current}}));
  }
  async function deploy(){
    let source=await check();
    if(remote.revision!==connection.baseline&&remote.files>0&&local!==remote.revision&&!confirm('Cloud has changes that are not in this local portal. Deploy this local copy and replace Cloud’s source? Cloud will keep its previous source for recovery. Choose Cancel, then Download, to use Cloud’s copy.'))return;
    logPanel.hidden=false;$('log').textContent='';message('Building locally…');log('Building '+context.current+' locally…\n');
    const started=performance.now();let streamed=false;
    const built=await result(await window.SheriffBuildLog.fetch('/api/build?'+encodeURIComponent(context.current),{method:'POST',onProgress:update=>{if(update.chunk){streamed=true;log(update.chunk);}}}));
    if(!streamed)log((built.stdout||'')+(built.stderr||'')+'\n');const buildMs=built.build_ms??performance.now()-started;
    const after=await exportSource();if(await T.fingerprint(after)!==await T.fingerprint(source))throw Error('Source changed while building. Save your edits and deploy again.');source=after;
    const state=(await api('state-export')).state;
    const bundle=await api('build-archive');let output;
    try{const response=await fetch(bundle.url,{cache:'no-store'});if(!response.ok)throw Error('Could not read the completed build.');output=await T.unzip(await response.arrayBuffer(),T.outputPath);}
    finally{await api('cleanup',{}, {id:bundle.id}).catch(()=>{});}
    if(source.reduce((n,f)=>n+f.bytes.length,0)+output.reduce((n,f)=>n+f.bytes.length,0)>T.MAX_BYTES)throw Error('Source and build together exceed the current 48 MB transfer limit.');
    async function encode(files){const out=[];for(const file of files)out.push({path:file.path,base64:T.base64(file.bytes),sha256:await T.hash(file.bytes)});return out;}
    message('Build succeeded. Uploading to Cloud and R2…');log('BUILD SUCCESS · Sheriff: '+(buildMs/1000).toFixed(2)+'s\nUploading the completed build and matching source…\n');
    const done=await cloud('deploy',{expected_revision:remote.revision,build_ms:buildMs,state,source:await encode(source),output:await encode(output)});
    await saveBaseline(done.revision);message('Published. Local and Cloud source are synced.');log('PUBLISHED · R2: '+((done.upload_ms||0)/1000).toFixed(2)+'s\n');
  }
  async function run(work){if(busy)return;busy=true;const unlock=context.lock();render();try{await work()}catch(error){message(error.message,true);if(!logPanel.hidden)log('ERROR: '+error.message+'\n');}finally{busy=false;unlock();render();}}
  async function load(){if(busy)return;const own=++revision;try{const data=await api('state');if(own!==revision)return;connection=data.connection||null;local=null;remote=null;message(connection?'Sign in to check changes, download, or deploy.':'Connect this local portal to a new or existing Cloud site.');render();}catch(error){message(error.message,true);}}
  $('connect').addEventListener('click',()=>{
    if(pending){pending.popup?.close();clearTimeout(pending.timer);pending=null;}
    const state=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
    const popup=window.open(CLOUD+'/desk-connect?'+new URLSearchParams({origin:location.origin,state,site:connection?.site_id||''}),'sheriff-cloud-connect-'+state,'width=600,height=760');
    if(!popup){message('Allow the Cloud sign-in window, then click Connect again.',true);return;}
    const timer=setTimeout(()=>{if(pending?.state===state){pending=null;message('Connection timed out. Click Connect to try again.',true);}},300000);
    pending={state,popup,timer,portal:context.current};message('Choose or create your site in the Cloud window.');
  });
  window.addEventListener('message',event=>{
    const data=event.data;if(!pending||event.origin!==CLOUD||event.source!==pending.popup||data?.type!=='sheriff:cloud-connected'||data.state!==pending.state)return;
    if(pending.portal!==context.current){message('The selected portal changed. Connect again.',true);return;}
    clearTimeout(pending.timer);pending=null;
    if(!data.token||!data.site?.id||!data.site?.portal||!/^https:\/\//.test(data.site.url)||!data.account||!Number.isFinite(data.expires_at)){message('Cloud returned an invalid connection.',true);return;}
    session={token:data.token,account:data.account,expires_at:data.expires_at};
    void run(async()=>{const same=connection?.site_id===data.site.id&&connection?.account===data.account;connection=(await api('link',{...data.site,site_id:data.site.id,account:data.account,baseline:same?connection.baseline:''})).connection;await check();});
  });
  $('check').addEventListener('click',()=>void run(check));$('download').addEventListener('click',()=>void run(download));$('deploy').addEventListener('click',()=>void run(deploy));
  $('disconnect').addEventListener('click',()=>void run(async()=>{if(!confirm('Disconnect this portal? Local and Cloud files will stay where they are.'))return;await api('forget');session=null;connection=null;local=null;remote=null;message('Disconnected.');}));
  context.subscribe(()=>{if(pending){clearTimeout(pending.timer);pending.popup?.close();pending=null;}if(location.hash==='#cloud')void load();else{connection=null;local=null;remote=null;render();}});
  window.SheriffCloudSync={enter:load};render();
}());
