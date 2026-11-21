// Shared Desk backend contract. Legacy URL decoding lives here, never in adapters.
(function () {
  'use strict';
  const host = window.SheriffDeskHost || {}, cloud = host.mode === 'cloud';
  const nativeFetch = window.fetch.bind(window);
  let session = {sites:[]}, previewToken = '', previewAt = 0, deskSites=[], accountSites=null;
  const memberFor=source=>{for(const site of deskSites)if(site.grouped){const portal=site.portals.find(p=>p.source===source);if(portal)return {site,portal};}return null;};
  const enc = encodeURIComponent;
  function json(value, status) { return new Response(JSON.stringify(value), {status:status || 200,headers:{'Content-Type':'application/json'}}); }
  function decode(input) {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) throw Error('Desk accepts only its own API requests.');
    const name=url.pathname.slice(5), raw=url.search.slice(1), parts=raw.split('&'), named=url.searchParams;
    const get=i=>decodeURIComponent(parts[i] || ''), verb=get(0);
    if(name==='sites') return ['sites.'+verb,Object.fromEntries([...named].filter(([key])=>key!==verb))];
    if(name==='modules')return ['modules.'+verb,{portal:named.get('portal')}];
    if(name==='portals') return ['portals.list',{}];
    if(name==='build') return ['portal.build',{portal:get(0)}];
    if(name==='page_build') return ['page.build',{portal:named.get('portal'),path:named.get('path')}];
    if(name==='changes') return ['changes.'+verb,{portal:named.get('portal')}];
    if(name==='file') {
      const rest=new URLSearchParams(parts.slice(1).join('&'));
      const args={portal:rest.get('portal') || get(1)};
      if(['read','write'].includes(verb)) args.path=rest.get('path') || get(2);
      else if(verb==='move') {args.from=get(2);args.to=get(3);}
      else if(verb!=='list') args.path=rest.get('path') || get(2);
      if(rest.has('build')) args.build=rest.get('build');
      if(rest.get('checked')==='1')args.checked='1';
      if(rest.get('no_overwrite')==='1') args.no_overwrite='1';
      return ['files.'+verb,args];
    }
    if(name==='portal') return ['portals.'+verb,{portal:get(1),target:get(2),theme:get(2),brand:get(3)}];
    if(name==='seed') return ['seed.'+verb,{portal:named.get('portal') || ''}];
    if(name==='seed') return ['seed.'+verb,{portal:named.get('portal') || ''}];
    if(name==='snapshots') return ['snapshots.'+verb,{portal:named.get('portal') || '',id:named.get('id') || ''}];
    if(name==='ensure_theme') return ['themes.ensure',{portal:get(0),theme:get(1)}];
    if(name==='theme_config') return ['themes.config',{portal:get(0),theme:get(1)}];
    if(name==='list_themes') return ['themes.list',{}];
    if(name==='list_layouts') return ['layouts.list',{theme:get(0)}];
    if(name==='list_icons') return ['icons.list',{portal:get(0)}];
    if(name==='list_patterns') return ['patterns.list',{portal:get(0)}];
    throw Error('Unknown Desk API: '+name);
  }
  function localUrl(op,a) {
    const positional=(...v)=>v.map(v=>enc(v || '')).join('&'), named='portal='+enc(a.portal || '')+'&path='+enc(a.path || '');
    if(op.startsWith('sites.'))return '/api/sites?'+op.slice(6)+'&'+new URLSearchParams(a);
    if(op==='portals.list') return '/api/portals';
    if(op==='portal.build') return '/api/build?'+enc(a.portal);
    if(op.startsWith('modules.'))return '/api/modules?'+op.slice(8)+'&portal='+enc(a.portal);
    if(op.startsWith('howdy.access.'))return '/api/howdy_access?'+op.slice(13)+'&portal='+enc(a.portal);
    if(op==='howdy.settings')return '/api/howdy?settings&portal='+enc(a.portal);
    if(op.startsWith('frontmatter.'))return '/api/frontmatter?'+op.slice(12)+'&portal='+enc(a.portal);
    if(op.startsWith('changes.')) return '/api/changes?'+op.slice(8)+'&portal='+enc(a.portal);
    if(op.startsWith('files.')) {const verb=op.slice(6);return '/api/file?'+verb+'&'+(['read','write'].includes(verb)?named:verb==='move'?positional(a.portal,a.from,a.to):verb==='list'?enc(a.portal):positional(a.portal,a.path))+(a.no_overwrite?'&no_overwrite=1':'')+(a.build?'&build='+enc(a.build):'')+(a.checked?'&checked=1':'');}
    if(op.startsWith('portals.')) return '/api/portal?'+op.slice(8)+'&'+(op==='portals.rename'?positional(a.portal,a.target):op==='portals.create'?positional(a.portal,a.theme,a.brand):enc(a.portal));
    if(op.startsWith('seed.')) return '/api/seed?'+op.slice(5)+'&portal='+enc(a.portal);
    if(op.startsWith('seed.')) return '/api/seed?'+op.slice(5)+'&portal='+enc(a.portal);
    if(op.startsWith('snapshots.')) {const q=new URLSearchParams();if(a.portal)q.set('portal',a.portal);if(a.id)q.set('id',a.id);return '/api/snapshots?'+op.slice(10)+(q.size?'&'+q:'');}
    const endpoint={'themes.list':'list_themes','themes.ensure':'ensure_theme','themes.config':'theme_config','layouts.list':'list_layouts','icons.list':'list_icons','patterns.list':'list_patterns'}[op];
    if(!endpoint) throw Error('Unknown Desk operation: '+op);
    return '/api/'+endpoint+(op==='themes.list'?'':'?'+(['themes.ensure','themes.config'].includes(op)?positional(a.portal,a.theme):enc(op==='layouts.list'?a.theme:a.portal)));
  }
  async function cloudSession() {
    const next=await host.session();
    if(!next || !next.token) throw Error('Sign in to Sheriff Cloud to continue.');
    session={...next,sites:accountSites||next.sites};
    if(previewToken!==next.token || Date.now()-previewAt>60000) {
      const result=await nativeFetch('/api/desk/session',{method:'POST',headers:{Authorization:'Bearer '+next.token},credentials:'same-origin'});
      if(!result.ok) throw Error('Cloud session could not be verified. Sign in again.');
      previewToken=next.token;previewAt=Date.now();
    }
    return next;
  }
  async function buildApiResult(response,label) {
    const text=await response.text();let data;
    try {data=JSON.parse(text);} catch (_) {throw Error(label+' (HTTP '+response.status+'): '+(text.trim().slice(0,1000)||'Empty response.'));}
    if(!data||typeof data!=='object'||Array.isArray(data))throw Error(label+' (HTTP '+response.status+'): Invalid build API result.');
    return data;
  }
  async function localBuild(operation,args,options) {
    const saved=operation==='files.write';
    if(saved){const response=await nativeFetch(localUrl(operation,{...args,build:'none'}),options);const result=await buildApiResult(response.clone(),'Could not save page');if(!response.ok||result.ok===false)return response;}
    const page=operation==='page.build'||saved&&args.build==='page';
    const parameters=new URLSearchParams({portal:args.portal,mode:page?'page':'portal',target:page?args.path.replace(/^content\//,''):''});
    const started=await nativeFetch('/api/build_progress?start&'+parameters,{method:'POST'});
    const job=await buildApiResult(started,'Could not start build');if(!started.ok||job.ok===false)return json(job,400);
    let cancelled=false;
    const encoder=new TextEncoder(),stream=new ReadableStream({
      async start(controller){
        const emit=data=>{if(!cancelled)controller.enqueue(encoder.encode(JSON.stringify(data)+'\n'));};
        emit({phase:'building'});let stdout=0,stderr=0;const deadline=Date.now()+190000;
        try{for(;;){
          const response=await nativeFetch('/api/build_progress?status&'+new URLSearchParams({portal:args.portal,id:job.id,stdout:String(stdout),stderr:String(stderr)}),{cache:'no-store'});
          const progress=await buildApiResult(response,'Could not read build progress');if(!response.ok||progress.ok===false)throw Error(progress.stderr||'Build progress is unavailable.');
          for(const name of ['stdout','stderr'])if(progress[name])emit({phase:'building',stream:name,chunk:progress[name]});
          stdout=progress.next_stdout;stderr=progress.next_stderr;
          if(progress.done){emit({phase:'result',...progress.result,build_code:progress.result.code,build_stdout:progress.result.stdout||'',build_stderr:progress.result.stderr||'',...(saved?{saved:true}:{})});break;}
          if(cancelled)return;if(Date.now()>deadline)throw Error('Build progress timed out. Check the server process before retrying.');await new Promise(resolve=>setTimeout(resolve,150));
        }}catch(error){emit({phase:'result',ok:false,code:1,stderr:error.message,...(saved?{saved:true}:{})});}
        if(!cancelled)controller.close();
      },cancel(){cancelled=true;}
    });
    return new Response(stream,{headers:{'Content-Type':'application/x-ndjson'}});
  }
  async function transport(operation,args,options) {
    if(!cloud&&operation.startsWith("howdy.access.")&&window.SheriffCloudSync?.connected){const headers=new Headers(options.headers);headers.set("Authorization","Bearer "+await window.SheriffCloudSync.accessToken());options={...options,headers};}
    args=args || {};options=options || {};
    if(!cloud){
      const member=memberFor(args.portal);
      if(member&&(operation==='portal.build'||operation==='page.build'||operation==='files.write'&&['page','portal'].includes(args.build))){
        const saved=operation==='files.write';if(saved){const response=await nativeFetch(localUrl(operation,{...args,build:'none'}),options);const data=await response.clone().json();if(!response.ok||data.ok===false)return response;}
        const page=operation==='page.build'||saved&&args.build==='page';
        const response=await nativeFetch(localUrl('sites.build',{site:member.site.id,portal:member.portal.id,...(page?{path:args.path.replace(/^content\//,'')}:{})}),{method:'POST'});
        if(!saved)return response;const data=await response.json();return json({...data,saved:true},response.status);
      }
      const building=operation==='portal.build'||operation==='page.build'||(operation==='files.write'&&['page','portal'].includes(args.build));if(operation==='page.build'||building&&host.liveBuilds!==false&&new Headers(options.headers).get('Accept')?.includes('application/x-ndjson'))return localBuild(operation,args,options);return nativeFetch(localUrl(operation,args),options);}
    const current=await cloudSession();
    if(operation==='sites.list'||operation==='portals.list'){
      const response=await nativeFetch('/api/desk/sites.list',{method:'POST',headers:{Authorization:'Bearer '+current.token,'Content-Type':'application/json'},body:JSON.stringify({ids:current.sites.map(s=>s.subdomain)})});
      const data=await response.json();if(!response.ok||data.ok===false)return json(data,response.status);
      if(data.accountSites){accountSites=data.accountSites;session.sites=accountSites;current.sites=accountSites;}
      deskSites=data.sites;for(const site of current.sites)if(!deskSites.some(s=>s.id===site.subdomain))deskSites.push({id:site.subdomain,name:site.name||site.subdomain,grouped:false,portals:[{id:site.subdomain,source:site.subdomain,name:site.name||site.subdomain}]});
      return json(operation==='sites.list'?{ok:true,sites:deskSites}:{ok:true,portals:deskSites.flatMap(s=>s.portals.map(p=>p.source))});
    }
    if(operation==='snapshots.list'&&!args.portal) return json({ok:true,portals:current.sites.map(s=>s.subdomain)});

    if(!operation.startsWith('sites.'))args={...args,portal:args.portal || window.SheriffPortalContext?.current || current.initialPortal || current.sites[0]?.subdomain || ''};
    const member=memberFor(args.portal);if(member)args.site=member.site.id;
    const headers=new Headers(options.headers);headers.set('Authorization','Bearer '+current.token);
    const response=await nativeFetch('/api/desk/'+operation+'?'+new URLSearchParams(args),{...options,method:'POST',headers,credentials:'same-origin'});
    if(/^portals\.(create|rename|delete)$|^sites\.(create|delete)$/.test(operation)&&response.ok){const data=await response.clone().json();if(data.ok!==false){if(data.accountSites){accountSites=data.accountSites;session.sites=accountSites;}window.dispatchEvent(new CustomEvent('sheriff:account-sites-change'));}}
    return response;
  }
  async function finishResponse(response,settle){
    if(!response.headers.get('Content-Type')?.includes('application/x-ndjson')){let data;try{data=await response.clone().json()}catch{data={ok:false}}await settle(data);return response;}
    const reader=response.body.getReader(),decoder=new TextDecoder(),encoder=new TextEncoder();let finished=false;
    const stream=new ReadableStream({async start(controller){let pending='';try{async function line(text){if(!text.trim())return;const item=JSON.parse(text);if(item.phase==='result'){await settle(item);finished=true;}controller.enqueue(encoder.encode(text+'\n'));}for(;;){const {value,done}=await reader.read();pending+=decoder.decode(value,{stream:!done});const lines=pending.split('\n');pending=lines.pop();for(const text of lines)await line(text);if(done)break;}await line(pending);if(!finished)await settle({ok:false});controller.close();}catch(e){if(!finished)await settle({ok:false});controller.error(e);}},async cancel(){await reader.cancel();if(!finished)await settle({ok:false});}});
    const headers=new Headers(response.headers);headers.delete('Content-Length');return new Response(stream,{status:response.status,headers});
  }
  const activeOperations=new Set();
  function beginOperation(operation,portal) {
    const entry={operation,portal};activeOperations.add(entry);
    const unlock=window.SheriffPortalContext?.lock()||(()=>{});
    window.dispatchEvent(new CustomEvent('sheriff:operation-change'));
    return ()=>{if(!activeOperations.delete(entry))return;unlock();window.dispatchEvent(new CustomEvent('sheriff:operation-change'));};
  }
  function changed(portal,error,details={}) { window.dispatchEvent(new CustomEvent('sheriff:saved-changes',{detail:{portal,error,...details}})); }
  async function track(verb,portal,payload={}) {
    const response=await transport('changes.'+verb,{portal},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const result=await response.json();
    if(!response.ok||result.ok===false)throw Error(result.stderr||'Build-change tracking is unavailable.');
    return result;
  }
  async function request(operation,args={},options={}) {
    if(operation.startsWith('changes.'))return transport(operation,args,options);
    if(operation.startsWith('sites.')&&!['sites.list','sites.config_read'].includes(operation)){
      const done=beginOperation(operation,args.site);const tickets=[];
      try{
        if(operation==='sites.build'){const site=deskSites.find(s=>s.id===args.site);for(const member of site?.portals||[]){if(args.portal&&args.portal!==member.id)continue;try{const ticket=await track('begin',member.source,{mode:args.path?'page':'portal',path:args.path||''});tickets.push({portal:member.source,id:ticket.id});}catch(error){changed(member.source,error.message);}}}
        const response=await transport(operation,args,options);
        const finish=async result=>{try{for(const ticket of tickets){try{await track('finish',ticket.portal,{id:ticket.id,success:result.ok!==false&&result.code===0,build_success:result.build_code===0||result.ok!==false&&result.code===0,published:result.published===true,build_ms:result.build_ms,upload_ms:result.upload_ms});changed(ticket.portal);}catch(error){changed(ticket.portal,error.message);}}}finally{done();}};
        return finishResponse(response,finish);
      }catch(error){for(const ticket of tickets)await track('finish',ticket.portal,{id:ticket.id,success:false,build_success:false}).catch(()=>{});done();throw error;}
    }
    const writes=/^files\.(write|upload|move|delete|mkdir)$|^portals\.(create|rename|delete)$|^seed\.(save|create)$|^snapshots\.(create|restore|delete)$|^themes\.ensure$/.test(operation);
    const building=['portal.build','portal.publish','page.build'].includes(operation)||(operation==='files.write'&&['page','portal'].includes(args.build));
    const done=writes||building?beginOperation(operation,args.portal):()=>{};
    if(['portals.create','portals.rename'].includes(operation)) {
      try {
      const response=await transport(operation,args,options);
      const result=await response.clone().json();
      if(response.ok&&result.ok!==false) {
        const target=operation==='portals.rename'?args.target:args.portal;
        try {await track('touch',target,{path:operation==='portals.rename'?'Portal renamed':'Portal created'});changed(target);}
        catch(error){changed(target,error.message);}
      }
      return response;
      } finally {done();}
    }
    const mutation=/^files\.(write|upload|move|delete)$/.test(operation)||['seed.create','themes.ensure','snapshots.restore'].includes(operation);
    const portal=args.portal;
    if(!portal||!building&&!mutation) {
      try {
        const response=await transport(operation,args,options);
        if(writes){const result=await response.clone().json();if(response.ok&&result.ok!==false)changed(portal,'',{operation,mutated:true,...args});}
        return response;
      } finally {done();}
    }
    let ticket=null,trackingError='';
    try {
      // Initialize before the first edit, including saves before header load.
      await track('status',portal);
      if(building)ticket=await track('begin',portal,{mode:operation==='page.build'||args.build==='page'?'page':'portal',path:args.path||'',...(operation==='files.write'&&typeof options.body==='string'?{text:args.checked==='1'?JSON.parse(options.body).content:options.body}:{})});
    } catch(error) { trackingError=error.message;changed(portal,trackingError); }
    async function settle(result) {
      const details={operation,mutated:mutation&&(result.ok!==false||result.saved===true),path:args.path,from:args.from,to:args.to};
      try {
        if(mutation&&(result.ok!==false||result.saved===true)) {
          // A snapshot can restore a deleted portal whose source could not be
          // inspected before the operation. Verify tracking again after restore.
          if(operation==='snapshots.restore'&&trackingError){await track('status',portal);trackingError='';}
          if(['files.upload','files.move','files.delete','snapshots.restore'].includes(operation))await track('touch',portal,{path:args.path||args.from||'Restored source'});
        }
        // Failed uploads leave work pending until Cloud activates a build.
        if(ticket)await track('finish',portal,{id:ticket.id,success:result.ok!==false&&result.code===0,build_success:result.build_code===0||result.ok!==false&&result.code===0,published:result.published===true,build_ms:result.build_ms,upload_ms:result.upload_ms});
        changed(portal,trackingError,details);
      } catch(error) { changed(portal,error.message,details); }
      finally {done();}
    }
    let response;
    try { response=await transport(operation,args,options); }
    catch(error) { await settle({ok:false});throw error; }
    if(!response.headers.get('Content-Type')?.includes('application/x-ndjson')) {
      let result;try{result=await response.clone().json();}catch{result={ok:false};}
      await settle({...result,...(!response.ok?{ok:false}:{})});return response;
    }
    // Log chunks flow immediately; only the final event waits for tracking.
    const reader=response.body.getReader(),decoder=new TextDecoder(),encoder=new TextEncoder();
    const stream=new ReadableStream({async start(controller){let pending='',finished=false;try{
      async function line(text){if(!text.trim())return;const event=JSON.parse(text);if(event.phase==='result'){await settle(event);finished=true;}controller.enqueue(encoder.encode(text+'\n'));}
      for(;;){const {value,done}=await reader.read();pending+=decoder.decode(value,{stream:!done});const lines=pending.split('\n');pending=lines.pop();for(const text of lines)await line(text);if(done)break;}
      await line(pending);if(!finished)await settle({ok:false});controller.close();
    }catch(error){if(!finished)await settle({ok:false});controller.error(error);}},cancel(){return reader.cancel();}});
    const headers=new Headers(response.headers);headers.delete('Content-Length');return new Response(stream,{status:response.status,headers});
  }
  if(cloud) {
    const refresh = () => {if(document.visibilityState === 'visible')cloudSession().catch(()=>{previewToken='';void nativeFetch('/api/desk/session',{method:'DELETE'});});};
    const timer=setInterval(refresh,60000);document.addEventListener('visibilitychange',refresh);window.addEventListener('pagehide',()=>clearInterval(timer));
  }
  function portalUrl(portal,relative) {
    if(!portal)return '';
    const site=(session.sites || []).find(s=>s.subdomain===portal);
    const member=memberFor(portal);
    if(member){const parent=(session.sites||[]).find(s=>s.subdomain===member.site.id);return new URL(relative||'',(cloud?(parent?.url||'https://'+member.site.id+'.sheriffcloud.com/'):'http://'+member.site.id+'.localhost:'+(location.port||'5173')+'/')+'p/'+member.portal.id+'/wiki/').href;}
    const base=cloud ? site?.url || 'https://'+portal+'.sheriffcloud.com/' : 'http://'+portal+'.localhost:'+(location.port || '5173')+'/';
    return new URL(relative || '',base.endsWith('/')?base:base+'/').href;
  }
  function assetUrl(portal,relative) {
    if(!cloud&&memberFor(portal))return new URL(relative.split('/').map(enc).join('/'),'http://'+portal+'.localhost:'+(location.port||'5173')+'/').href;
    return cloud ? '/api/desk/asset?'+new URLSearchParams({portal,path:relative,...(memberFor(portal)?{site:memberFor(portal).site.id}:{})}) : portalUrl(portal,relative.split('/').map(enc).join('/'));
  }
  window.SheriffDeskBackend={mode:cloud?'cloud':'local',request,fetch(input,options){const [op,args]=decode(input);return request(op,args,options);},portalUrl,assetUrl,decode,localUrl,
    setSites(value){deskSites=value||[];},
    isBusy:()=>activeOperations.size>0,
    get preferredPortal(){return deskSites.find(s=>s.id===session.initialPortal)?.portals[0]?.source||session.initialPortal;}, resolvePortal(value){return deskSites.find(s=>s.id===value)?.portals[0]?.source||value;}, siteUrl(value){const site=session.sites.find(s=>s.subdomain===value);return cloud?site?.url||'https://'+value+'.sheriffcloud.com/':'http://'+value+'.localhost:'+(location.port||'5173')+'/';},get capabilities(){return {siteLifecycle:true,multisite:true,publish:cloud,snapshots:true};}};
}());
