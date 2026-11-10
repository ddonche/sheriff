// Shared Desk backend contract. Legacy URL decoding lives here, never in adapters.
(function () {
  'use strict';
  const host = window.SheriffDeskHost || {}, cloud = host.mode === 'cloud';
  const nativeFetch = window.fetch.bind(window);
  let session = {sites:[]}, previewToken = '', previewAt = 0;
  const enc = encodeURIComponent;
  function json(value, status) { return new Response(JSON.stringify(value), {status:status || 200,headers:{'Content-Type':'application/json'}}); }
  function decode(input) {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) throw Error('Desk accepts only its own API requests.');
    const name=url.pathname.slice(5), raw=url.search.slice(1), parts=raw.split('&'), named=url.searchParams;
    const get=i=>decodeURIComponent(parts[i] || ''), verb=get(0);
    if(name==='portals') return ['portals.list',{}];
    if(name==='build') return ['portal.build',{portal:get(0)}];
    if(name==='file') {
      const rest=new URLSearchParams(parts.slice(1).join('&'));
      const args={portal:rest.get('portal') || get(1)};
      if(['read','write'].includes(verb)) args.path=rest.get('path') || get(2);
      else if(verb==='move') {args.from=get(2);args.to=get(3);}
      else if(verb!=='list') args.path=rest.get('path') || get(2);
      if(rest.has('build')) args.build=rest.get('build');
      if(rest.get('no_overwrite')==='1') args.no_overwrite='1';
      return ['files.'+verb,args];
    }
    if(name==='portal') return ['portals.'+verb,{portal:get(1),target:get(2),theme:get(2),brand:get(3)}];
    if(name==='snapshots') return ['snapshots.'+verb,{portal:named.get('portal') || '',id:named.get('id') || ''}];
    if(name==='ensure_theme') return ['themes.ensure',{portal:get(0),theme:get(1)}];
    if(name==='list_themes') return ['themes.list',{}];
    if(name==='list_layouts') return ['layouts.list',{theme:get(0)}];
    if(name==='list_icons') return ['icons.list',{portal:get(0)}];
    if(name==='list_patterns') return ['patterns.list',{portal:get(0)}];
    throw Error('Unknown Desk API: '+name);
  }
  function localUrl(op,a) {
    const positional=(...v)=>v.map(v=>enc(v || '')).join('&'), named='portal='+enc(a.portal || '')+'&path='+enc(a.path || '');
    if(op==='portals.list') return '/api/portals';
    if(op==='portal.build') return '/api/build?'+enc(a.portal);
    if(op.startsWith('files.')) {const verb=op.slice(6);return '/api/file?'+verb+'&'+(['read','write'].includes(verb)?named:verb==='move'?positional(a.portal,a.from,a.to):verb==='list'?enc(a.portal):positional(a.portal,a.path))+(a.no_overwrite?'&no_overwrite=1':'')+(a.build?'&build='+enc(a.build):'');}
    if(op.startsWith('portals.')) return '/api/portal?'+op.slice(8)+'&'+(op==='portals.rename'?positional(a.portal,a.target):op==='portals.create'?positional(a.portal,a.theme,a.brand):enc(a.portal));
    if(op.startsWith('snapshots.')) {const q=new URLSearchParams();if(a.portal)q.set('portal',a.portal);if(a.id)q.set('id',a.id);return '/api/snapshots?'+op.slice(10)+(q.size?'&'+q:'');}
    const endpoint={'themes.list':'list_themes','themes.ensure':'ensure_theme','layouts.list':'list_layouts','icons.list':'list_icons','patterns.list':'list_patterns'}[op];
    if(!endpoint) throw Error('Unknown Desk operation: '+op);
    return '/api/'+endpoint+(op==='themes.list'?'':'?'+(op==='themes.ensure'?positional(a.portal,a.theme):enc(op==='layouts.list'?a.theme:a.portal)));
  }
  async function cloudSession() {
    const next=await host.session();
    if(!next || !next.token) throw Error('Sign in to Sheriff Cloud to continue.');
    session=next;
    if(previewToken!==next.token || Date.now()-previewAt>60000) {
      const result=await nativeFetch('/api/desk/session',{method:'POST',headers:{Authorization:'Bearer '+next.token},credentials:'same-origin'});
      if(!result.ok) throw Error('Cloud session could not be verified. Sign in again.');
      previewToken=next.token;previewAt=Date.now();
    }
    return next;
  }
  async function request(operation,args,options) {
    args=args || {};options=options || {};
    if(!cloud) return nativeFetch(localUrl(operation,args),options);
    const current=await cloudSession();
    if(operation==='portals.list') return json({ok:true,portals:current.sites.map(s=>s.subdomain)});
    if(operation==='snapshots.list'&&!args.portal) return json({ok:true,portals:current.sites.map(s=>s.subdomain)});
    if(/^portals\.(create|rename|delete)$/.test(operation)) return json({ok:false,stderr:'Manage Cloud sites through Cloud site settings.'},400);
    args={...args,portal:args.portal || window.SheriffPortalContext?.current || current.initialPortal || current.sites[0]?.subdomain || ''};
    const headers=new Headers(options.headers);headers.set('Authorization','Bearer '+current.token);
    return nativeFetch('/api/desk/'+operation+'?'+new URLSearchParams(args),{...options,method:'POST',headers,credentials:'same-origin'});
  }
  if(cloud) {
    const refresh = () => {if(document.visibilityState === 'visible')cloudSession().catch(()=>{previewToken='';void nativeFetch('/api/desk/session',{method:'DELETE'});});};
    const timer=setInterval(refresh,60000);document.addEventListener('visibilitychange',refresh);window.addEventListener('pagehide',()=>clearInterval(timer));
  }
  function portalUrl(portal,relative) {
    if(!portal)return '';
    const site=(session.sites || []).find(s=>s.subdomain===portal);
    const base=cloud ? site?.url || 'https://'+portal+'.sheriffcloud.com/' : 'http://'+portal+'.localhost:'+(location.port || '5173')+'/';
    return new URL(relative || '',base.endsWith('/')?base:base+'/').href;
  }
  function assetUrl(portal,relative) {
    return cloud ? '/api/desk/asset?'+new URLSearchParams({portal,path:relative}) : portalUrl(portal,relative.split('/').map(enc).join('/'));
  }
  window.SheriffDeskBackend={mode:cloud?'cloud':'local',request,fetch(input,options){const [op,args]=decode(input);return request(op,args,options);},portalUrl,assetUrl,decode,localUrl,
    get preferredPortal(){return session.initialPortal;},get capabilities(){return {siteLifecycle:!cloud,publish:cloud,snapshots:true};}};
}());
