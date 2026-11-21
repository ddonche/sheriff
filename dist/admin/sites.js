// Site context augments the existing portal context; every editor still uses it.
(function(){
  'use strict';
  const backend=window.SheriffDeskBackend,context=window.SheriffPortalContext;
  const el=id=>document.getElementById(id),catalog=[],members=new Map();
  let refreshId=0,current=null,wizard=null;
  const slug=name=>name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const siteSelect=el('desk-site'),siteControl=el('desk-site-control'),siteCaption=el('desk-site-caption');
  const icon=el('desk-site-icon'),buildButton=el('desk-build-site');
  async function api(action,args={},payload){
    const response=action==='build'&&backend.mode==='cloud'?await window.SheriffBuildLog.fetch('/api/sites?build&'+new URLSearchParams(args),{method:'POST'}):await backend.request('sites.'+action,args,{method:action==='list'?'GET':'POST',...(payload?{headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{})});
    const text=await response.text();let data;try{data=JSON.parse(text);}catch{throw Error(text.slice(0,250)||'Site API returned an empty response.');}
    if(!response.ok||data.ok===false)throw Error(data.stderr||'Site operation failed.');return data;
  }
  function siteIcon(site){
    const logo=site.logo?(backend.mode==='cloud'?'/api/desk/asset?'+new URLSearchParams({site:site.id,portal:site.id,scope:'site',path:'public/'+site.logo}):backend.siteUrl(site.id)+'public/'+encodeURIComponent(site.logo)):'';
    return context.createIcon('site:'+site.id,{name:site.name,logo});
  }
  function sync(){
    const member=members.get(context.current),site=member?.site;
    current=site||null;siteControl.hidden=!site?.grouped;buildButton.hidden=!site?.grouped;
    if(site){siteSelect.value=site.id;siteCaption.textContent=site.grouped?site.portals.length+' portals · '+new URL(backend.siteUrl(site.id)).host:'Standalone site';}
    siteSelect.disabled=context.locked;buildButton.disabled=context.locked;
    // Active portal always supports direct switching, including out of a multisite.
    context.filter?.(null);
    icon.replaceChildren();if(site)icon.append(siteIcon(site));
    for(const button of document.querySelectorAll('.desk-site-group-actions button'))button.disabled=context.locked;

  }
  siteSelect.addEventListener('change',()=>{
    const site=catalog.find(s=>s.id===siteSelect.value);if(!site)return;
    const preferred=site.portals.find(p=>p.source===context.current)||site.portals[0];
    if(!context.select(preferred.source)){sync();return;}sync();
  });
  context.subscribe(sync);window.addEventListener('sheriff:operation-change',sync);
  window.addEventListener('sheriff:editor-change',sync);
  function groupCards(root){
    if(!catalog.some(s=>s.grouped))return;
    const cards=[...root.querySelectorAll('[data-portal]')].filter(n=>n.classList.contains('portal')||n.classList.contains('portal-card'));
    if(!cards.length)return;
    const lookup=new Map(cards.map(n=>[n.dataset.portal,n]));root.replaceChildren();
    for(const site of catalog){
      const available=site.portals.filter(p=>lookup.has(p.source));if(!available.length)continue;
      if(!site.grouped){for(const p of available)root.append(lookup.get(p.source));continue;}
      const section=document.createElement('section');section.className='desk-site-group';
      const head=document.createElement('div');head.className='desk-site-group-head';
      const title=document.createElement('h3');title.append(siteIcon(site),document.createTextNode(site.name));
      const actions=document.createElement('div');actions.className='desk-site-group-actions';
      for(const [label,run] of [['Add portal',()=>window.SheriffDesk.openWizard({site})],['Build site',()=>build(site)]]){
        if(label==='Add portal'&&!backend.capabilities.siteLifecycle)continue;
        const button=document.createElement('button');button.className='btn small';button.type='button';button.innerHTML=el(label==='Build site'?'site-build-icon':'site-add-icon').innerHTML;button.append(document.createTextNode(' '+label));button.addEventListener('click',run);actions.append(button);
      }
      if(root.id==='portal-manage-list'&&backend.capabilities.siteLifecycle){
        const remove=document.createElement('button');remove.className='btn small portal-action-icon portal-delete';remove.type='button';remove.title='Delete '+site.name+' site';remove.setAttribute('aria-label',remove.title);remove.innerHTML=el('wiz-portal-trash').innerHTML;remove.addEventListener('click',()=>deleteSite(site));actions.append(remove);
      }
      head.append(title,actions);section.append(head);
      for(const p of available){const card=lookup.get(p.source);card.querySelector('.portal-name').textContent=p.name;card.querySelector('.desk-portal-icon')?.replaceWith(context.createIcon(p.source,{name:p.name,logo:backend.assetUrl(p.source,'public/logo.png')}));const link=card.querySelector('.portal-host'),url=new URL(backend.portalUrl(p.source));link.href=url.href;link.textContent=url.host+url.pathname;for(const action of ['rename','delete']){const button=card.querySelector('.portal-'+action);if(button){button.disabled=true;button.title='Grouped portal rename/removal is not available in this preview.';}}section.append(card);}
      root.append(section);
    }
  }
  async function deleteSite(site){
    if(context.locked||backend.isBusy())return;
    if(window.SheriffDesk.unsavedPanels().length){window.SheriffDesk.notify('Save or cancel your edits before deleting a site.');return;}
    const typed=window.prompt('Delete '+site.name+' and these '+site.portals.length+' portals?\n\n'+site.portals.map(p=>p.name+' (/p/'+p.id+'/)').join('\n')+'\n\n'+(backend.mode==='cloud'?'This removes the Cloud docs site and its portal source. Other apps on a shared site are kept.':'This removes their local source and built output. It does not delete any Cloud site.')+' This cannot be undone.\n\nType the site address to confirm: '+site.id);
    if(typed===null)return;
    if(typed.trim()!==site.id){window.SheriffDesk.notify('Name did not match — nothing deleted.');return;}
    try{
      await api('delete',{site:site.id}, {id:site.id,confirm:typed.trim(),portals:site.portals.map(p=>p.source)});
      await window.SheriffDesk.refreshPortals();
      window.SheriffDesk.notify('Deleted '+site.name);
    }catch(error){window.SheriffDesk.notify(error.message);}
  }
  async function refresh(){
    if(!backend.capabilities.multisite)return;
    const id=++refreshId;
    try{
      const data=await api('list');if(id!==refreshId)return;
      catalog.splice(0,catalog.length,...data.sites);members.clear();
      siteSelect.replaceChildren();for(const site of catalog){const option=document.createElement('option');option.value=site.id;option.textContent=site.name;siteSelect.append(option);for(const portal of site.portals)members.set(portal.source,{site,portal});}
      backend.setSites(catalog);sync();for(const root of [el('portal-list'),el('portal-manage-list')])groupCards(root);
      window.dispatchEvent(new CustomEvent('sheriff:sites-change'));
      el('desk-site-error').hidden=true;
    }catch(error){el('desk-site-error').textContent=error.message;el('desk-site-error').hidden=false;}
  }
  async function build(site=current){
    if(!site?.grouped||context.locked)return;
    buildButton.disabled=true;const release=context.lock();
    window.SheriffBuildLog.setTransfer({portal:context.current,started:Date.now(),label:'Building '+site.name,detail:'Building all '+site.portals.length+' portals in this site.',state:'running'});
    try{const result=await api('build',{site:site.id});window.SheriffBuildLog.setTransfer({portal:context.current,started:Date.now(),label:'Built '+site.name,detail:result.stdout||'Site build completed.',state:'success'});}
    catch(error){window.SheriffBuildLog.setTransfer({portal:context.current,started:Date.now(),label:'Site build failed',detail:error.message,state:'failed'});}
    finally{release();sync();}
  }
  buildButton.addEventListener('click',()=>build());
  function addRow(name='',id=''){
    const root=el('wz-portals'),row=document.createElement('div');row.className='wiz-portal-row';
    const nameLabel=document.createElement('label');nameLabel.textContent='Portal name';const input=document.createElement('input');input.className='wiz-input';input.value=name;input.placeholder='Programming';input.setAttribute('aria-label','Portal name');nameLabel.append(input);
    const slugLabel=document.createElement('label');slugLabel.textContent='Portal address';const address=document.createElement('input');address.className='wiz-input mono';address.value=id;address.placeholder='programming';address.setAttribute('aria-label','Portal address');slugLabel.append(address);
    const preview=document.createElement('small');preview.textContent='/p/'+(id||'programming')+'/';
    let edited=false;input.addEventListener('input',()=>{if(!edited)address.value=slug(input.value);preview.textContent='/p/'+address.value+'/';});address.addEventListener('input',()=>{edited=true;preview.textContent='/p/'+address.value+'/';});
    const remove=document.createElement('button');remove.className='btn small';remove.type='button';remove.title='Remove portal';remove.setAttribute('aria-label','Remove portal');remove.innerHTML=el('wiz-portal-trash').innerHTML;remove.addEventListener('click',()=>row.remove());
    row.append(nameLabel,slugLabel,remove,preview);root.append(row);
  }
  el('wz-add-portal').addEventListener('click',()=>addRow());
  function configure(wiz,options={}){
    wizard=wiz;wiz.structure=options.site?'portal':'single';wiz.parentSite=options.site||null;
    el('wz-portals').replaceChildren();addRow('Main','main');
    el('wiz-structure').hidden=!!options.site||!backend.capabilities.multisite;
    for(const input of document.querySelectorAll('[name="wz-structure"]'))input.checked=input.value===wiz.structure;
    updateWizard();
  }
  function updateWizard(){
    if(!wizard)return;
    el('wz-group-portals').hidden=wizard.structure!=='group';
    el('wz-site-name-label').textContent=wizard.structure==='portal'?'Name your portal':'Name your site';
    el('wz-address-hint').textContent=wizard.structure==='portal'?'Portal address: /p/'+(wizard.slug||'name')+'/':'Your site will run at '+(wizard.slug||'name')+(backend.mode==='cloud'?'.sheriffcloud.com':'.localhost:'+(location.port||'5173'));
    el('wz-first-page-note').textContent=wizard.structure==='group'?'This is the first wiki page in each portal. The site and portal overview pages are generated separately.':'This becomes your wiki home page. You can edit it any time.';
    el('wz-portals-heading').textContent='Portals in '+(wizard.name||'your site');
  }
  for(const input of document.querySelectorAll('[name="wz-structure"]'))input.addEventListener('change',()=>{if(wizard){wizard.structure=input.value;updateWizard();}});
  for(const id of ['wz-name','wz-slug'])el(id).addEventListener('input',()=>queueMicrotask(updateWizard));
  async function createWizard(wiz,mark){
    const rows=wiz.structure==='portal'?[{name:wiz.name,id:wiz.slug}]:[...el('wz-portals').children].map(row=>({name:row.querySelectorAll('input')[0].value.trim(),id:row.querySelectorAll('input')[1].value.trim()}));
    if(!rows.length)throw Error('Add at least one portal.');
    for(const row of rows){if(!row.name||!/^[a-z0-9][a-z0-9_-]*$/.test(row.id))throw Error('Give each portal a name and a valid address.');row.theme=wiz.theme;row.page_title=wiz.pageTitle||row.name;row.body=wiz.pageBody||'Welcome to '+row.name+'.';}
    if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Each portal needs a different address.');
    const site=wiz.parentSite?.id||wiz.slug;mark('create','doing');
    const data=await api(wiz.structure==='portal'?'add':'create',{site}, {id:site,name:wiz.name,theme:wiz.theme,portals:rows});mark('create','done');
    mark('page','done');
    if(wiz.logoFile){
      mark('logo','doing');
      // A site logo belongs to the site. Adding a portal uploads only its logo.
      const extension=(wiz.logoFile.name.split('.').pop()||'png').toLowerCase();
      const response=wiz.structure==='group'
        ?await backend.request('sites.logo',{site,extension},{method:'POST',body:wiz.logoFile})
        :await backend.request('files.upload',{portal:data.portals[0],path:'public/logo.png'},{method:'POST',body:wiz.logoFile});
      const result=await response.json();if(!response.ok||result.ok===false)throw Error(result.stderr||'Logo upload failed.');
      mark('logo','done');
    }else mark('logo','skip');
    await refresh();
    for(const portal of data.portals)await backend.request('changes.touch',{portal},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:'Portal created'})});
    await refresh();
    mark('build','doing');await api('build',{site,...(wiz.structure==='portal'?{portal:wiz.slug}:{})});mark('build','done');
    await refresh();return {portal:data.portals[0],url:backend.siteUrl(site)+(wiz.structure==='portal'?'p/'+wiz.slug+'/':'')};
  }
  window.SheriffSites={refresh,groupCards,configure,createWizard,get current(){return current;},siteIdExists:id=>catalog.some(s=>s.id===id),member:source=>members.get(source),build};
}());
