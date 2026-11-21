// Cloud injects this bootstrap only into its exported shared Desk entry point.
(function(){
  'use strict';
  const pending=new Map();let sequence=0;
  window.addEventListener('message',event=>{
    if(event.source!==parent||event.origin!==location.origin)return;
    if(event.data?.type==='sheriff:desk-session') {
      const request=pending.get(event.data.id);if(!request)return;pending.delete(event.data.id);clearTimeout(request.timer);
      event.data.error?request.reject(Error(event.data.error)):request.resolve(event.data.session);
    }
    if(event.data?.type==='sheriff:desk-sites-changed')void window.SheriffDesk?.refreshPortals();
    if(event.data?.type==='sheriff:desk-select'&&window.SheriffPortalContext)window.SheriffPortalContext.select(window.SheriffDeskBackend.resolvePortal(event.data.portal));
  });
  window.SheriffDeskHost={mode:'cloud',session(){return new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(Error('Open Desk through your signed-in Cloud workspace.'));},10000);pending.set(id,{resolve,reject,timer});parent.postMessage({type:'sheriff:desk-session-request',id},location.origin);});}};
  window.addEventListener('sheriff:portal-change',event=>{const status=document.getElementById('desk-publish-status');if(status)status.textContent='';parent.postMessage({type:'sheriff:desk-portal',portal:window.SheriffSites?.member(event.detail.portal)?.site.id||event.detail.portal},location.origin);});
  function decoratePortals(){
    for(const row of document.querySelectorAll('#portal-manage-list [data-portal]')){
      if(row.querySelector('.portal-cloud-tools'))continue;
      const tools=document.createElement('div'),badge=document.createElement('span'),link=document.createElement('a');
      tools.className='portal-cloud-tools';badge.className='portal-cloud-badge';badge.textContent='Cloud';link.className='btn small ghost';link.textContent='Open live site ↗';link.href=window.SheriffDeskBackend.portalUrl(row.dataset.portal);link.target='_blank';link.rel='noopener';tools.append(badge,link);row.append(tools);
    }
  }
  window.addEventListener('sheriff:sites-change',decoratePortals);
  window.addEventListener('sheriff:portal-cards-rendered',decoratePortals);
  window.addEventListener('sheriff:account-sites-change',()=>parent.postMessage({type:'sheriff:desk-sites-mutated'},location.origin));
  window.addEventListener('load',()=>{
    const preview=document.getElementById('np-preview');if(preview?.parentElement)preview.parentElement.lastChild.textContent='.sheriffcloud.com once built.';
    document.body.classList.add('desk-hosted');document.querySelector('.env-tag').textContent='CLOUD ADMIN';
    document.querySelector('.foot').textContent='Sheriff Desk · Cloud';
    document.querySelector('.welcome > p').textContent='Save keeps source edits without building or publishing. Build page saves, builds, and publishes that page. Build portal saves, builds, and publishes the whole portal. Publish builds and publishes the selected portal from saved source.';
    for(const node of document.querySelectorAll('nav .nav-label'))if(['Deploy','System'].includes(node.textContent.trim()))node.hidden=true;
    for(const node of document.querySelectorAll('.welcome .stat')){if(node.querySelector('.k')?.textContent==='Workspace')node.querySelector('.v').textContent='Sheriff Cloud';if(node.querySelector('.k')?.textContent==='Cloud')node.querySelector('.v').textContent='Connected';}
    document.getElementById('dashboard-cloud-connect')?.closest('.panel')?.setAttribute('hidden','');
    for(const key of ['settings'])document.querySelector('[data-view="'+key+'"]')?.setAttribute('hidden','');
    const button=document.getElementById('desk-publish'),status=document.getElementById('desk-publish-status');button.hidden=false;
    button.addEventListener('click',async()=>{
      const context=window.SheriffPortalContext,portal=context.current;
      if(!portal||context.locked)return;
      if(window.SheriffDesk.unsavedPanels().length){status.textContent='Save your edits before publishing.';return;}
      const release=context.lock();button.disabled=true;status.textContent='Building and publishing '+portal+'…';
      try{const response=await window.SheriffBuildLog.publish(portal);const result=await response.json();if(!response.ok||result.ok===false||!result.published)throw Error(result.stderr||'Publishing failed.');status.textContent='Published '+portal+'.';}
      catch(error){status.textContent=error.message;}finally{release();button.disabled=false;}
    });
  });
}());
