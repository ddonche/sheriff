// Account sign-in and source/output sync. Site identity is automatic, never a setup step.
(function(){
  'use strict';
  if(window.SheriffDeskBackend.mode==='cloud')return;
  const context=window.SheriffPortalContext,T=window.SheriffCloudTransfer,CLOUD='https://admin.sheriffcloud.com';
  let session=null,client=null,sites=[],directoryOwner='',busy=false,remote=null,local=null,syncState={},generation=0;
  let operation=null;
  const connections=new Map();
  const groupFor=(portal=context.current)=>{const member=window.SheriffSites?.member(portal);return member?.site.grouped?member.site:null;};
  const cloudName=portal=>groupFor(portal)?.id||portal;
  async function siteApi(action,site,payload){return result(await window.SheriffDeskBackend.request('sites.'+action,{site},{method:'POST',body:payload instanceof Uint8Array?payload:JSON.stringify(payload||{}),headers:{'Content-Type':payload instanceof Uint8Array?'application/octet-stream':'application/json'}}));}
  const localPortals=()=>window.SheriffDesk?.portals()||context.portals;
  const view=document.createElement('dialog');view.id='cl-dialog';view.className='cloud-dialog';view.setAttribute('aria-labelledby','cl-title cl-portal-summary');
  view.innerHTML='<div class="cloud-dialog-heading"><span id="cl-cloud-glyph" class="cloud-dialog-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 18H6a4 4 0 0 1-.5-8A7 7 0 0 1 19 8a5 5 0 0 1 0 10h-2M12 21V12m-3 3 3-3 3 3"/></svg></span><div><span class="cloud-eyebrow">SHERIFF CLOUD</span><h2 id="cl-title">Cloud changes</h2><span id="cl-portal-summary" class="sr-only"></span><div id="cl-identity" class="cloud-portal-identity" hidden><select id="cl-portal" data-portal-select data-portal-primary aria-label="Portal for Cloud transfer"></select></div><p id="cl-description"></p><p id="cl-destination" hidden></p></div><button class="wiz-x" id="cl-close" type="button" aria-label="Close Cloud progress">&times;</button></div><ol id="cl-steps" class="cloud-steps" aria-label="Transfer progress" hidden></ol><p id="cl-status" role="status" aria-live="polite"></p><div id="cl-times" class="cloud-times" hidden></div><details class="cloud-progress" hidden><summary>Activity log</summary><pre id="cl-log" tabindex="0" aria-label="Cloud transfer output"></pre></details><p id="cl-background" class="cloud-background" hidden>You can close this window. The transfer will continue.</p><footer class="cloud-dialog-footer"><a id="cl-live" class="btn small ghost" target="_blank" rel="noopener" hidden>Open live site ↗</a><div class="cloud-dialog-actions"><button id="cl-check" class="btn small" type="button">Check changes</button><button id="cl-download" class="btn small" type="button">Pull from Cloud</button><button id="cl-deploy" class="btn small primary" type="button">Push to Cloud</button></div></footer>';
  document.body.append(view);
  const account=document.createElement('dialog');account.id='cl-account-dialog';account.className='cloud-dialog cloud-account-dialog';account.setAttribute('aria-labelledby','cl-account-title');
  account.innerHTML='<div class="cloud-dialog-heading"><div><span class="cloud-eyebrow">SHERIFF CLOUD</span><h2 id="cl-account-title">Your account</h2></div><button class="wiz-x" id="cl-account-close" type="button" aria-label="Close account">&times;</button></div><p id="cl-account"></p><span id="cl-badge" class="cloud-account-badge">Not signed in</span><p class="cloud-background">One account connects all your Cloud sites. Manage and download them in Portals.</p><footer class="cloud-dialog-footer"><a class="btn small ghost" href="https://admin.sheriffcloud.com" target="_blank" rel="noopener">Open online Desk ↗</a><button id="cl-connect" class="btn small teal" type="button">Sign in to Sheriff</button><button id="cl-signout" class="btn small" type="button" hidden>Sign out</button></footer>';
  document.body.append(account);
  const $=name=>document.getElementById('cl-'+name),logPanel=view.querySelector('.cloud-progress');
  // Reuse Desk's shared portal identity, logo, selection guards and build lock.
  context.mount($('portal'));
  $('identity').querySelector('.desk-portal-label').textContent='Portal';
  function message(text,error=false){$('status').textContent=text;$('status').classList.toggle('cloud-error',error);if(error&&operation)operation.failed=true;}
  function log(text){logPanel.hidden=false;$('log').textContent+=text;$('log').scrollTop=$('log').scrollHeight;}
  function phase(index,text){if(operation){operation.stage=index;renderProgress();}message(text);}
  function openProgress(kind='compare',site=null){
    if(account.open)account.close();
    const name=site?.name||document.getElementById('desk-portal')?.selectedOptions[0]?.textContent||context.current;
    operation={kind,name,portal:site?.portal||context.current,account:session?.account,stage:-1,finished:false,failed:false,buildMs:null,uploadMs:null};
    $('log').textContent='';logPanel.hidden=true;logPanel.open=kind!=='compare';
    renderProgress();if(!view.open)view.showModal();
  }
  function renderProgress(){
    if(!operation)return;
    const {kind,name,finished,failed,stage,buildMs,uploadMs}=operation;
    $('title').textContent=(kind==='push'?'Push to Cloud':kind==='pull'?'Pull from Cloud':'Cloud changes')+(kind==='push'?'':' · '+name);
    $('portal-summary').textContent=kind==='push'?'· '+(document.getElementById('desk-portal')?.selectedOptions[0]?.textContent||name):'';
    $('identity').hidden=kind!=='push';$('cloud-glyph').hidden=kind==='push';
    const group=groupFor(operation.portal);
    $('deploy').textContent=group?'Build & push '+group.name+' site':'Build & push this portal';
    $('description').textContent=kind==='push'?(group?'Build and publish '+group.name+' with all '+group.portals.length+' portals.':'Build here, then publish this portal online.'):kind==='pull'?'Download this portal’s source to work offline.':'Compare the local and Cloud copies of this portal.';
    const destination=siteFor(operation.portal);
    $('destination').textContent=kind==='push'?'Destination: '+(destination?.url||'New Cloud site — '+cloudName(operation.portal)):'';
    $('destination').hidden=kind!=='push';
    const labels=kind==='pull'?['Check changes','Download source','Save locally']:['Check changes','Build locally','Upload & publish'];
    $('steps').hidden=kind==='compare';$('steps').replaceChildren();
    labels.forEach((label,i)=>{const row=document.createElement('li'),mark=document.createElement('span'),text=document.createElement('span');row.dataset.state=i<stage||finished&&!failed?'done':i===stage?failed?'failed':'active':'waiting';mark.textContent=row.dataset.state==='done'?'✓':row.dataset.state==='failed'?'!':String(i+1);mark.className='cloud-step-mark';text.textContent=label;row.append(mark,text);$('steps').append(row);});
    $('times').replaceChildren();
    for(const [label,value] of [['Sheriff build',buildMs],['R2 upload',uploadMs]])if(Number.isFinite(value)){const item=document.createElement('span');item.textContent=label+': '+(value/1000).toFixed(2)+'s';$('times').append(item);}
    $('times').hidden=!$('times').childElementCount;
    $('background').hidden=!busy||kind==='compare';
    const headerStatus=document.getElementById('desk-publish-status');
    if(headerStatus&&kind!=='compare'){headerStatus.textContent=failed?(kind==='push'?'Push failed':'Pull failed'):finished?(kind==='push'?'Published':'Downloaded'):busy?['Checking changes…',kind==='push'?'Building locally…':'Downloading…',kind==='push'?'Uploading…':'Saving locally…'][stage]||'':'';headerStatus.title=$('status').textContent;}
    if (operation.started && (kind==='push'||kind==='pull')) {
      const label = failed ? (kind==='push'?'Push failed':'Pull failed') : finished ? (kind==='push'?'Published':'Downloaded')
        : busy ? ['Checking changes…',kind==='push'?(buildMs===null?'Building locally…':'Preparing upload…'):'Downloading source…',kind==='push'?'Uploading to R2…':'Saving locally…'][stage]||'Working…' : 'Cancelled';
      const times = [Number.isFinite(buildMs)?'Sheriff build: '+(buildMs/1000).toFixed(2)+'s':'',Number.isFinite(uploadMs)?'R2 upload: '+(uploadMs/1000).toFixed(2)+'s':''].filter(Boolean).join(' · ');
      window.SheriffBuildLog.setTransfer({portal:operation.portal,started:operation.started,ended:operation.ended,state:busy?'running':failed?'failed':'success',label,detail:operation.portal+' · '+label+(times?' · '+times:'')});
    }
    const live=siteFor();$('live').hidden=!live;$('live').href=live?.url||'#';
    view.querySelector('.cloud-dialog-actions').hidden=busy;
    for(const id of ['deploy','download','check'])$(id).hidden=finished&&!failed&&kind!=='compare';
  }
  function signedIn(){return !!session&&session.expires_at*1000>Date.now()+15000;}
  function siteFor(portal=context.current){
    if(!client||!portal)return null;
    const saved=connections.get(portal);
    if(saved&&saved.account===session?.account&&saved.site_id)return sites.find(site=>site.id===saved.site_id)||null;
    let name;try{name=client.cloudPortalName(cloudName(portal))}catch{return null}
    return sites.find(site=>site.portal===name)||null;
  }
  async function readConnections(){
    const owner=session?.account;
    if(!owner)return;
    const values=await Promise.all(localPortals().map(async portal=>[portal,(await api('state',{}, {portal})).connection]));
    if(owner!==session?.account)return;
    connections.clear();for(const [portal,value] of values)if(value?.account===owner)connections.set(portal,value);
  }
  function requireIdentity(){
    const portal=context.current,saved=connections.get(portal);
    if(saved&&saved.account===session?.account&&saved.site_id&&!siteFor(portal))throw Error('This portal’s Cloud site is no longer available to your account. No files were transferred.');
    const name=client.cloudPortalName(cloudName(portal));
    const duplicate=localPortals().some(other=>other!==portal&&client.cloudPortalName(cloudName(other))===name&&cloudName(other)!==cloudName(portal)&&!connections.has(other));
    if(!saved&&duplicate)throw Error('Two local portals use the same Cloud name. Rename one before pushing so they cannot overwrite the same site.');
  }
  function apply(value){const previous=session?.account;session=value?{token:value.access_token,account:value.user.id,email:value.user.email||'',expires_at:value.expires_at}:null;if(previous!==session?.account){sites=[];directoryOwner='';connections.clear();remote=null;local=null;}render();if(previous!==session?.account)setTimeout(()=>void load(),0);}
  const authReady=import(CLOUD+'/assets-home/desk-auth.js?v=3').then(async module=>{client=module;const auth=await module.prepareDeskAuth();auth.onAuthStateChange((_event,value)=>apply(value));const {data,error}=await auth.getSession();if(error)throw error;apply(data.session);return auth;}).catch(()=>{message('Cloud sign-in could not be loaded. Check your internet connection and reload Desk.',true);return null;});
  async function currentSession(){const auth=await authReady;if(!auth)throw Error('Cloud sign-in is unavailable. Reload Desk when online.');const {data,error}=await auth.getSession();if(error)throw error;apply(data.session);if(!signedIn())throw Error('Sign in to Sheriff to continue.');return auth;}
  async function refreshSites(force=false){if(!signedIn()){sites=[];directoryOwner='';render();return;}const owner=session.account;if(!force&&directoryOwner===owner)return;const data=await client.getDeskSites();if(owner!==session?.account)return;sites=data.sites;await readConnections();if(owner!==session?.account)return;directoryOwner=owner;render();}
  function render(){
    const authenticated=signedIn(),site=siteFor(),portal=context.current,hasSource=localPortals().includes(portal);
    $('account').textContent=authenticated?(session.email||'Signed in to Sheriff'):'Sign in to Sheriff to push and pull your sites.';
    $('badge').textContent=authenticated?'Connected':'Not signed in';
    $('description').textContent=portal?'Current portal: '+portal+(site?' · '+site.url:''):'Choose a portal.';
    $('connect').hidden=authenticated;$('connect').disabled=busy;$('signout').hidden=!authenticated;$('signout').disabled=busy;
    $('deploy').disabled=busy||!authenticated||!hasSource;$('download').disabled=busy||!authenticated||!site||!hasSource;$('check').disabled=busy||!authenticated||!portal;
    const stat=document.getElementById('stat-cloud');if(stat){stat.textContent=authenticated?'Connected':'Not signed in';stat.classList.toggle('placeholder',!authenticated);}
    const label=document.getElementById('dashboard-cloud-status');if(label)label.textContent=authenticated?'Connected'+(session.email?' · '+session.email:''):'Not signed in';
    const connect=document.getElementById('dashboard-cloud-connect');if(connect){connect.textContent=authenticated?'Account':'Sign in to Sheriff';connect.disabled=busy;}
    for(const [id,allowed] of [['deploy',authenticated&&hasSource],['download',authenticated&&site&&hasSource]]){const button=document.getElementById('dashboard-cloud-'+id);if(button)button.disabled=busy||!allowed;}
    const push=document.getElementById('desk-publish');if(push){push.hidden=!authenticated;push.textContent=busy&&operation?'View progress':'Push to Cloud';push.disabled=!hasSource||busy&&!operation;}
    const dot=document.getElementById('dashboard-cloud-dot');if(dot)dot.classList.toggle('on',authenticated);
    renderProgress();decoratePortals();
  }
  function decoratePortals(){
    const container=document.getElementById('portal-manage-list');if(!container)return;
    container.querySelectorAll('.portal-cloud-tools,.portal-cloud-only').forEach(node=>node.remove());
    if(!signedIn())return;
    const locals=window.SheriffDesk?.portals()||context.portals;
    for(const row of container.querySelectorAll('[data-portal]')){
      const portal=row.dataset.portal,site=siteFor(portal),tools=document.createElement('div'),badge=document.createElement('span'),button=document.createElement('button');tools.className='portal-cloud-tools';badge.className='portal-cloud-badge';badge.textContent=site?'Local + Cloud':'Local only';
      button.className='btn small ghost';button.textContent='Cloud actions ↗';button.disabled=busy;button.addEventListener('click',()=>{if(!choose(portal))return;openProgress();void run(check,'compare',null,false);});tools.append(badge,button);row.append(tools);
    }
    for(const site of sites){
      if(locals.some(name=>siteFor(name)?.id===site.id))continue;
      container.querySelector('.portal-empty')?.remove();
      const row=document.createElement('article'),name=document.createElement('div'),url=document.createElement('a'),tools=document.createElement('div'),badge=document.createElement('span'),pull=document.createElement('button');
      row.className='portal portal-cloud-only';row.dataset.cloudPortal=site.portal;name.className='name';name.append(context.createIcon(site.portal,{name:site.name||site.portal}),document.createTextNode(site.name||site.portal));url.className='portal-host host';url.href=site.url;url.textContent=new URL(site.url).host;url.target='_blank';url.rel='noopener';tools.className='portal-cloud-tools';badge.className='portal-cloud-badge';badge.textContent='Cloud only';pull.className='btn small';pull.textContent='Download to Desk';pull.disabled=busy;pull.addEventListener('click',()=>void run(()=>pullSite(site),'pull',site));tools.append(badge,pull);row.append(name,url,tools);container.append(row);
    }
  }
  function choose(portal){try{requireSaved();return context.select(portal);}catch(error){window.SheriffDesk?.notify(error.message);return false;}}
  function reviewPush(){
    if(busy){if(operation&&!view.open)view.showModal();return;}
    if(!context.current||context.locked){window.SheriffDesk?.notify('Wait for the current save or file operation to finish.');return;}
    if(!localPortals().includes(context.current)){window.SheriffDesk?.notify('Restore or download this portal’s source before pushing.');return;}
    openProgress('push');
    message('Review the portal and destination above. Nothing will be built or uploaded until you select Build & push this portal.');
    render();
  }
  function confirmPush(){
    if(!operation||operation.portal!==context.current||operation.account!==session?.account){reviewPush();return;}
    void run(deploy,'push');
  }
  async function result(response){let data;try{data=await response.json()}catch{throw Error('The server returned an unreadable response.');}if(!response.ok||data.ok===false)throw Error(data.stderr||data.error||'The operation failed.');return data;}
  async function api(verb,body,params={}){return result(await fetch('/api/cloud?'+verb+'&'+new URLSearchParams({portal:context.current,...params}),{method:'POST',headers:{'Content-Type':body instanceof Uint8Array?'application/octet-stream':'application/json'},body:body instanceof Uint8Array?body:JSON.stringify(body||{})}));}
  async function cloud(op,body,site=siteFor()){
    await currentSession();if(!site)throw Error('This site has not been pushed to Cloud yet.');
    const response=await fetch(CLOUD+'/api/desk/sync.'+op+'?'+new URLSearchParams({portal:site.portal}),{method:'POST',headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/json',Accept:op==='deploy'?'application/x-ndjson':'application/json'},body:JSON.stringify(body||{}),credentials:'omit'});
    if(response.status===401)throw Error('Your sign-in expired. Sign in to Sheriff again.');
    if(!response.headers.get('Content-Type')?.includes('application/x-ndjson'))return result(response);
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',doneResult;
    for(;;){const chunk=await reader.read();buffer+=decoder.decode(chunk.value||new Uint8Array(),{stream:!chunk.done});const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines){if(!line)continue;const item=JSON.parse(line);if(item.chunk)log(item.chunk);if(item.phase==='result')doneResult=item;}if(chunk.done)break;}
    if(!doneResult||doneResult.ok===false||!doneResult.published)throw Error(doneResult?.stderr||'Cloud could not finish publishing. The last sync was not advanced.');return doneResult;
  }
  async function exportSource(){const group=groupFor();if(group){const data=await siteApi('transfer_export',group.id);return T.unzip(T.bytes(data.zip_base64),T.groupedSourcePath);}const created=await result(await window.SheriffDeskBackend.request('snapshots.create',{portal:context.current},{method:'POST',body:JSON.stringify({name:'Cloud transfer'})}));const id=created.snapshot.id;try{const data=await result(await window.SheriffDeskBackend.request('snapshots.download',{portal:context.current,id},{method:'POST'}));return await T.unzip(T.bytes(data.zip_base64),T.sourcePath);}finally{await window.SheriffDeskBackend.request('snapshots.delete',{portal:context.current,id},{method:'POST'}).catch(()=>{});}}
  async function readSyncState(){const data=(await api('state')).connection;if(data?.account===session?.account)connections.set(context.current,data);else connections.delete(context.current);requireIdentity();const site=siteFor();syncState=data&&site&&data.site_id===site.id&&data.account===session?.account?data:{baseline:''};}
  async function check(){phase(0,'Checking local and Cloud changes…');await currentSession();await refreshSites(true);await readSyncState();const files=await exportSource();local=await T.fingerprint(files);const site=siteFor();remote=site?await cloud('inspect',{},site):{files:0,revision:await T.fingerprint([])};message(!site?'Ready for its first push.':local===remote.revision?'Up to date.':syncState.baseline===remote.revision?'Local changes.':syncState.baseline===local?'Cloud changes.':'Local and Cloud copies differ.');render();return files;}
  async function saveBaseline(value){const site=siteFor(),group=groupFor();for(const portal of group?group.portals.map(p=>p.source):[context.current]){syncState=(await api('link',{portal:site.portal,site_id:site.id,url:site.url,account:session.account,baseline:value},{portal})).connection;connections.set(portal,syncState);}local=value;remote={revision:value};render();}
  function requireSaved(){const panels=window.SheriffDesk?.unsavedPanels()||[];if(panels.length)throw Error('Save your changes in '+panels.join(', ')+' before pulling or pushing.');}
  async function decodeDownload(data){if(!data.files.length)throw Error('This Cloud site has no source to pull yet.');const incoming=[];for(const file of data.files){if(!(data.format==='multisite-v1'?T.groupedSourcePath:T.sourcePath)(file.path))throw Error('Cloud returned an unsupported source path.');const bytes=T.bytes(file.base64);if(await T.hash(bytes)!==file.sha256)throw Error('Downloaded file failed its checksum.');incoming.push({path:file.path,bytes});}if(await T.fingerprint(incoming)!==data.revision)throw Error('Downloaded source failed its revision check.');return incoming;}
  async function importDownload(data,incoming){if(data.format==='multisite-v1'){
    phase(2,'Saving the site and its portals locally…');const restored=await siteApi('transfer_import',data.site,T.zip(incoming,T.groupedSourcePath));
    await window.SheriffDesk.refreshPortals();await window.SheriffSites.refresh();context.select(restored.portals[0],{force:true});
    for(const portal of restored.portals)await api('state-import',data.states?.[portal]||{},{portal});
    await window.SheriffDesk.portalRestored(context.current);await saveBaseline(data.revision);message('Site and portals downloaded for offline editing. The previous source is retained for recovery.');return;
  }phase(2,'Saving source locally…');const archive=T.zip(incoming);await api('import',archive,{sha256:await T.hash(archive)});await api('state-import',data.state);await window.SheriffDesk.portalRestored(context.current);await saveBaseline(data.revision);message('Pulled from Cloud. The source is available offline; previous local files are in Snapshots.');}
  async function download(){requireSaved();const files=await check();if(!siteFor())throw Error('This site has not been pushed to Cloud yet.');if(local!==remote.revision&&(!syncState.baseline||local!==syncState.baseline)&&!confirm('Replace this local copy with Cloud source? Your current local files will be saved in Snapshots.'))return false;phase(1,'Downloading Cloud source…');const data=await cloud('download'),incoming=await decodeDownload(data);if(await T.fingerprint(await exportSource())!==await T.fingerprint(files))throw Error('Local files changed during download. Check changes and retry.');await importDownload(data,incoming);}
  async function pullSite(site){requireSaved();await currentSession();const locals=window.SheriffDesk.portals(),portal=locals.find(name=>siteFor(name)?.id===site.id)||site.portal;if(locals.includes(portal)){if(siteFor(portal)?.id!==site.id)throw Error('A different local portal already uses this name. Rename it before downloading this Cloud site.');context.select(portal,{force:true});return download();}phase(1,'Downloading '+site.name+' for offline editing…');const data=await cloud('download',{},site),incoming=await decodeDownload(data);if(data.format==='multisite-v1'){await importDownload(data,incoming);return;}await result(await window.SheriffDeskBackend.request('portals.create',{portal,theme:'outpost',brand:''},{method:'POST'}));await window.SheriffDesk.refreshPortals();context.select(portal,{force:true});await importDownload(data,incoming);}
  function authored(files){return files.filter(file=>{if(!/^(?:portals\/[^/]+\/)?content\/.*\.md$/i.test(file.path))return true;const head=new TextDecoder().decode(file.bytes).match(/^\uFEFF?\s*\^\^\^\^[ \t]*\r?\n([\s\S]*?)\r?\n\^\^\^\^/);return !head||!(/^(?:generated_by\s*:\s*\S|meta_type\s*:\s*generated\s*$)/m.test(head[1]));});}
  async function deploy(){
    requireSaved();let source=await check();if(remote.revision!==syncState.baseline&&remote.files>0&&local!==remote.revision&&!confirm('Cloud has changes that are not in this local copy. Push this copy and replace Cloud source? Cloud keeps its previous source for recovery. Cancel and Pull from Cloud to use Cloud’s copy.'))return false;
    logPanel.hidden=false;$('log').textContent='';phase(1,'Building '+operation.name+' locally…');log('Building '+context.current+' locally…\n');const started=performance.now();let streamed=false;
    const group=groupFor();
    const built=await result(await window.SheriffBuildLog.fetch(group?'/api/sites?build&site='+encodeURIComponent(group.id):'/api/build?'+encodeURIComponent(context.current),{method:'POST',onProgress:update=>{if(update.chunk){streamed=true;log(update.chunk);}}}));if(!streamed)log((built.stdout||'')+(built.stderr||'')+'\n');const buildMs=built.build_ms??performance.now()-started;let buildId;try{const status=await result(await window.SheriffDeskBackend.request('changes.status',{portal:context.current},{method:'POST',body:'{}'}));buildId=status.history?.last_build?.id;}catch(error){log('Could not read build history: '+error.message+'\n');}
    operation.buildMs=buildMs;renderProgress();const after=await exportSource();if(await T.fingerprint(authored(after))!==await T.fingerprint(authored(source)))throw Error('Source changed while building. Save your edits and push again.');source=after;let state,states={},bundle,output;
    if(group){for(const portal of group.portals)states[portal.source]=(await api('state-export',{}, {portal:portal.source})).state;const archive=await siteApi('output_archive',group.id);output=await T.unzip(T.bytes(archive.zip_base64),T.outputPath);}
    else{state=(await api('state-export')).state;bundle=await api('build-archive');}
    if(bundle)try{const response=await fetch(bundle.url,{cache:'no-store'});if(!response.ok)throw Error('Could not read the completed build.');output=await T.unzip(await response.arrayBuffer(),T.outputPath);}finally{await api('cleanup',{}, {id:bundle.id}).catch(()=>{});}
    if(source.reduce((n,f)=>n+f.bytes.length,0)+output.reduce((n,f)=>n+f.bytes.length,0)>T.MAX_BYTES)throw Error('Source and build together exceed the current 48 MB transfer limit.');
    if(!siteFor()){await client.ensureDeskSite(cloudName(context.current),group?.name||document.getElementById('desk-portal')?.selectedOptions[0]?.textContent||context.current);await refreshSites(true);if(!siteFor())throw Error('The Cloud site could not be loaded. Retry the push.');remote=await cloud('inspect');}
    async function encode(files){const out=[];for(const file of files)out.push({path:file.path,base64:T.base64(file.bytes),sha256:await T.hash(file.bytes)});return out;}
    phase(2,'Build succeeded. Uploading to Cloud and R2…');log('BUILD SUCCESS · Sheriff: '+(buildMs/1000).toFixed(2)+'s\nUploading the completed build and matching source…\n');const done=await cloud('deploy',{...(group?{format:'multisite-v1',states}:{}),expected_revision:remote.revision,build_ms:buildMs,state,source:await encode(source),output:await encode(output)});operation.uploadMs=done.upload_ms;await saveBaseline(done.revision);
    try{if(!buildId)throw Error('No build history was recorded.');await result(await window.SheriffDeskBackend.request('changes.publish',{portal:context.current},{method:'POST',body:JSON.stringify({build_id:buildId,upload_ms:done.upload_ms})}));await window.SheriffPendingBuilds?.refresh();}
    catch(error){log('Published successfully; could not save local publication history: '+error.message+'\n');}
    message('Pushed to Cloud. Local and Cloud source are synced.');log('PUBLISHED · R2: '+((done.upload_ms||0)/1000).toFixed(2)+'s\n');
  }
  async function run(work,kind='compare',site=null,open=true){
    if(busy){if(operation&&!view.open)view.showModal();return;}
    if(context.locked){window.SheriffDesk?.notify('Wait for the current save or file operation to finish.');return;}
    if(kind==='account')operation=null;else if(open)openProgress(kind,site);
    if(operation)operation.stage=0;
    if(operation&&(kind==='push'||kind==='pull'))operation.started=Date.now();
    busy=true;generation++;const unlock=context.lock();render();
    try{const completed=await work();if(operation){if(completed===false){operation.stage=-1;message('Cancelled. No files were replaced.');}else operation.finished=true;}}
    catch(error){message(error.message,true);if(!logPanel.hidden)log('ERROR: '+error.message+'\n');if(kind==='account')window.SheriffDesk?.notify(error.message);}
    finally{if(operation?.started)operation.ended=Date.now();busy=false;unlock();render();}
  }
  async function load(){if(busy)return;const own=++generation;try{await authReady;if(own!==generation)return;if(signedIn()){await refreshSites();await readConnections();}if(own!==generation)return;remote=null;local=null;syncState={};message(view.open&&operation?.kind==='push'?'Review the portal and destination above. Nothing will be built or uploaded until you select Build & push this portal.':signedIn()?'Push your local work to Cloud or pull the latest source.':'Sign in to Sheriff to continue.');render();}catch(error){message(error.message,true);}}
  $('connect').addEventListener('click',()=>{if(account.open)account.close();void run(async()=>{if(!await authReady)throw Error('Cloud sign-in is unavailable.');const value=await client.signInDesk();if(!value)return;await currentSession();await refreshSites(true);window.SheriffDesk?.notify('Signed in to Sheriff.');},'account');});
  $('deploy').textContent='Build & push this portal';
  $('deploy').addEventListener('click',confirmPush);$('download').addEventListener('click',()=>void run(download,'pull'));$('check').addEventListener('click',()=>void run(check));$('signout').addEventListener('click',()=>void run(async()=>{const auth=await authReady;if(auth){const result=await auth.signOut({scope:'local'});if(result.error)throw result.error;}apply(null);account.close();window.SheriffDesk?.notify('Signed out.');},'account'));
  $('close').addEventListener('click',()=>view.close());$('account-close').addEventListener('click',()=>account.close());
  context.subscribe(()=>{remote=null;local=null;syncState={};if(!busy){const reviewing=view.open&&operation?.kind==='push';document.getElementById('desk-publish-status').textContent='';if(reviewing)reviewPush();else{operation=null;if(view.open)view.close();}}render();void load();});
  for(const [id,action] of [['connect',()=>{if(signedIn()){if(!account.open)account.showModal();}else $('connect').click();}],['deploy',reviewPush],['download',()=>void run(download,'pull')]])document.getElementById('dashboard-cloud-'+id)?.addEventListener('click',action);
  document.getElementById('desk-publish')?.addEventListener('click',reviewPush);
  window.SheriffCloudSync={accessToken:async()=>{await currentSession();return session.token;},isBusy:()=>busy,enter:load,decoratePortals,get sites(){return sites.slice()},get connected(){return signedIn()}};render();
}());
