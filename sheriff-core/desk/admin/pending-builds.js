// Shared Desk UI. Goblin owns saved-source comparisons and build coverage.
(function () {
  'use strict';
  const context=window.SheriffPortalContext,backend=window.SheriffDeskBackend;
  const notice=document.getElementById('desk-build-notice'),review=document.getElementById('changes-dialog');
  if(!notice||!review)return;
  const $=id=>document.getElementById('changes-'+id);
  let portal='',data=null,error='',working=false,requestId=0,timer;
  function render() {
    const count=data?.page_count||0,shared=!!data?.portal_required;
    notice.hidden=!error&&!count&&!shared;
    notice.textContent=error?'Build status unavailable':shared?(count?`${count} ${count===1?'page':'pages'} + site changes need building`:'Site changes need building'):`${count} ${count===1?'page needs':'pages need'} building`;
    notice.title=error||'Review saved changes. Building is optional.';
    window.SheriffBuildLog.setStoredStatus?.(portal,data);
    $('portal').textContent=portal;
    $('summary').textContent=error||(!count&&!shared?'No tracked saved changes need building.':shared?'Shared changes affect other pages. Build the portal to apply everything.':`${count} saved ${count===1?'page needs':'pages need'} building. You can build just ${count===1?'this page':'these pages'}.`);
    $('summary').classList.toggle('changes-error',!!error);
    const unsaved=window.SheriffDesk?.unsavedPanels()||[];
    $('unsaved').textContent=unsaved.length?'Unsaved editor changes in '+unsaved.join(', ')+'. Save them first to include them in a build.':'These actions build saved files. They do not save open editors.';
    $('pages').replaceChildren();
    for(const path of data?.pages||[]) {const row=document.createElement('li');row.textContent=path.replace(/^content\//,'');$('pages').append(row);}
    $('page-section').hidden=!count;
    $('shared').replaceChildren();
    for(const item of data?.shared||[]) {const row=document.createElement('li'),path=document.createElement('span'),reason=document.createElement('small');path.textContent=item.path;reason.textContent=item.reason;row.append(path,reason);$('shared').append(row);}
    $('shared-section').hidden=!shared;
    $('build-pages').textContent=count===1?'Build page':`Build ${count} changed pages`;
    $('build-pages').hidden=!count;
    $('build-portal').hidden=!shared;
    for(const id of ['build-pages','build-portal'])$(id).disabled=working||context.locked||!!error;
    $('refresh').disabled=working;
    $('progress').hidden=!working;
  }
  async function refresh() {
    const selected=context.current,id=++requestId;if(!selected)return;
    portal=selected;
    try {const response=await backend.request('changes.status',{portal:selected},{method:'POST',body:'{}',headers:{'Content-Type':'application/json'}});const next=await response.json();if(!response.ok||next.ok===false)throw Error(next.stderr||'Could not check saved changes.');if(id!==requestId||selected!==context.current)return;data=next;error='';}
    catch(e){if(id!==requestId)return;error=e.message;}
    render();
  }
  async function build(mode) {
    if(working||context.locked)return;
    // Refresh before choosing work so another tab's saved changes are included.
    await refresh();if(error||context.locked)return;
    const selected=portal,paths=(data?.pages||[]).slice();
    if(mode==='page'&&!paths.length||mode==='portal'&&!data?.portal_required)return;
    working=true;const unlock=context.lock();render();
    const label=mode==='page'?`Build ${paths.length} changed ${paths.length===1?'page':'pages'}`:'Build portal';
    window.SheriffBuildLog.startBatch(label);
    try {
      const targets=mode==='portal'?[null]:paths;
      for(let i=0;i<targets.length;i++) {
        $('progress').textContent=mode==='portal'?'Building portal…':`Building page ${i+1} of ${targets.length}: ${targets[i].replace(/^content\//,'')}`;
        const url=mode==='portal'?'/api/build?'+encodeURIComponent(selected):'/api/page_build?'+new URLSearchParams({portal:selected,path:targets[i]});
        const response=await window.SheriffBuildLog.fetch(url,{method:'POST'}),result=await response.json();
        if(!response.ok||result.ok===false||result.code!==0)throw Error('Build failed. Remaining changes are still pending. See the build log.');
      }
      window.SheriffDesk?.notify(mode==='page'?'Changed pages built.':'Portal built.');
    }catch(e){window.SheriffDesk?.notify(e.message);}
    finally{window.SheriffBuildLog.endBatch();working=false;unlock();await refresh();}
  }
  window.SheriffDesk.makeFloatingPanel(review,'desk.changesPos');
  function closeReview(){review.hidden=true;(notice.hidden?document.getElementById('desk-portal'):notice).focus({preventScroll:true});}
  notice.addEventListener('click',()=>{render();review.hidden=false;$('close').focus({preventScroll:true});void refresh();});
  $('close').addEventListener('click',closeReview);
  $('refresh').addEventListener('click',refresh);
  $('build-pages').addEventListener('click',()=>build('page'));
  $('build-portal').addEventListener('click',()=>build('portal'));
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!review.hidden&&!event.defaultPrevented){event.preventDefault();closeReview();}
  });
  context.subscribe(()=>{data=null;error='';notice.hidden=true;review.hidden=true;void refresh();});
  window.addEventListener('sheriff:saved-changes',event=>{if(event.detail.portal!==context.current)return;clearTimeout(timer);if(event.detail.error){error=event.detail.error;render();}else timer=setTimeout(refresh,80);});
  window.addEventListener('focus',()=>{if(!working)void refresh();});
  // Editor dirty state is deliberately separate from persisted build state.
  document.addEventListener('input',()=>{if(!review.hidden)render();});
  window.SheriffPendingBuilds={refresh};
  if(context.current)void refresh();
}());
