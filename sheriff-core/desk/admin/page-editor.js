// Page-only host for Desk's existing Visual/Source editor. No account tokens here.
(() => {
  'use strict';
  const $=id=>document.getElementById(id),source=$('ed-text');
  let page=null,original='',busy=false,ready=false,locked=false,requestId=0;
  const pending=new Map(),catalogs=new Map();
  const send=(type,extra={})=>parent.postMessage({scope:'sheriff-page-editor',type,...extra},location.origin);
  function status(text,error=false){$('page-status').textContent=text;$('page-status').classList.toggle('err',error);}
  const dirty=()=>source.value!==original;
  function controls(){source.disabled=busy; $('page-save').disabled=busy; $('page-close').disabled=busy;}
  window.SheriffPortalContext={get current(){return page?.source||'';},revision:1,get locked(){return busy||locked;},lock(){locked=true;return ()=>{locked=false;};},subscribe(){return ()=>{};}};
  window.SheriffDesk={
    contentEditor:()=>({portal:page?.source||'',path:page?.path||'',generation:1,element:source}),
    makeFloatingPanel:window.SheriffFloatingPanel,
    notify:text=>status(text),
    ...window.SheriffPatternOptions,
    insertContentImage(text,target){return this.insertContent(text,target);},
    revealContentRange(start,end){source.focus({preventScroll:true});source.setSelectionRange(start,end);source.scrollTop=Math.max(0,(source.value.slice(0,start).split('\n').length-3)*22);},
    insertContent(text,target){if(busy||target.portal!==page.source||target.path!==page.path)return false;if(target.visual)return window.SheriffVisualEditor?.insert(text,target.visual)||false;source.setRangeText(text,target.start,target.end,'end');source.dispatchEvent(new Event('input',{bubbles:true}));return true;},
  };
  function library(kind){
    if(!catalogs.has(kind))catalogs.set(kind,new Promise((resolve,reject)=>{
      const id=++requestId,timer=setTimeout(()=>{pending.delete(id);catalogs.delete(kind);reject(Error('Loading '+kind+' timed out. Please retry.'));},30000);
      pending.set(id,result=>{clearTimeout(timer);if(result.ok===false){catalogs.delete(kind);reject(Error(result.stderr||'Could not load '+kind));}else resolve(result);});send('library',{id,kind});
    }));return catalogs.get(kind);
  }
  const response=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
  window.SheriffDeskBackend={
    assetUrl(portal,path){return page.public_base+'/'+path.replace(/^public\//,'').split('/').map(encodeURIComponent).join('/');},
    async request(op){
      if(op==='themes.config')return response({ok:true,admonitions:page.admonitions||{}});
      if(op==='icons.list')return response(await library('icons'));
      throw Error('This page editor cannot manage site settings.');
    },
    async fetch(input){
      const url=new URL(input,location.href);
      if(url.pathname==='/api/list_icons')return response(await library('icons'));
      if(url.pathname==='/api/list_patterns')return response(await library('patterns'));
      if(url.pathname==='/api/file'&&url.search.split('&')[0]==='?list')return response(await library('images'));
      throw Error('This page editor can select existing assets. Upload and manage assets in Desk.');
    },
  };
  function loadScript(file){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=file;script.onload=resolve;script.onerror=()=>reject(Error('Desk component could not load: '+file));document.body.append(script);});}
  function close(){if(busy)return;if(!dirty()||confirm('Discard your unsaved changes to this page?'))send('close');}
  $('page-close').addEventListener('click',close);
  $('page-save').addEventListener('click',()=>{if(busy)return;busy=true;controls();status('Saving content and building this page…');send('save',{body:source.value});});
  window.addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});
  window.addEventListener('message',async event=>{
    if(event.source!==parent||event.origin!==location.origin||event.data?.scope!=='sheriff-page-editor')return;
    const data=event.data;
    if(data.type==='library-result'){const resolve=pending.get(data.id);if(resolve){pending.delete(data.id);resolve(data.result);}return;}
    if(data.type==='close-request'){close();return;}
    if(data.type==='result'){
      busy=false;
      if(data.saved)original=data.body;
      controls();
      if(data.ok){status('Page saved and built.');send('complete');}
      else status(data.error||'Could not save this page. Your edits are still here.',true);
      return;
    }
    if(data.type!=='init'||ready)return;
    ready=true;page=data.page;original=data.body;source.value=original;source.disabled=false;
    for(const [name,value] of Object.entries(data.theme||{}))if(/^--sheriff-[a-z-]+$/.test(name))document.documentElement.style.setProperty(name,value);
    $('ed-path').textContent=page.title||'Edit page';
    $('page-details-toggle').remove();$('page-details-caption').remove();$('page-details').remove();$('editor-mode-row').hidden=false;
    // Reuse Desk's pickers; contributor access is limited to existing portal assets.
    document.querySelector('[data-ci-source=upload]').hidden=true;
    $('ci-newfolder').hidden=true;$('cx-manage').hidden=true;
    $('ci-library-empty').textContent='No images in this folder.';
    for(const el of document.querySelectorAll('.content-tools'))el.classList.add('page-insert-tools');
    const script=document.createElement('script');script.src='visual-editor.js';script.onload=()=>{
      $('visual-mode-tabs').querySelector('[data-mode="visual"]').click();
      (async()=>{for(const file of ['content-images.js','content-inserts.js'])await loadScript(file);controls();send('loaded');})().catch(error=>status(error.message,true));
    };script.onerror=()=>status('Desk editor could not load. Your source has not been changed.',true);document.body.append(script);
  });
  const top=$('ed-back-to-top'),surface=$('visual-surface');
  for(const scroller of [source,surface])scroller.addEventListener('scroll',()=>{top.hidden=scroller.scrollTop<180;});
  top.addEventListener('click',()=>{if(window.SheriffVisualEditor?.mode()==='visual')window.SheriffVisualEditor.scrollToTop();else{source.scrollTop=0;source.focus();source.setSelectionRange(0,0);}});
  send('ready');
})();
