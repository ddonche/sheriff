// Page-details controls edit the existing unsaved source buffer. Goblin handles YALL.
(function(){
  'use strict';
  const desk=window.SheriffDesk,context=window.SheriffPortalContext,source=document.getElementById('ed-text');
  const panel=document.getElementById('page-details'),form=document.getElementById('page-details-fields'),message=document.getElementById('page-details-status');
  const controls=Array.from(form.querySelectorAll('[data-page-field]'));
  const detailsToggle=document.getElementById('page-details-toggle'),modeRow=document.getElementById('editor-mode-row');
  function renderDisclosure(){detailsToggle.setAttribute('aria-expanded',String(panel.open));detailsToggle.hidden=panel.hidden;modeRow.hidden=panel.hidden;}
  detailsToggle.addEventListener('click',()=>{panel.open=!panel.open;renderDisclosure();});
  panel.addEventListener('toggle',renderDisclosure);
  let fields={},editable={},pending={},running=null,runningKey='',timer,reading=0,ownInput=false,loading=false,key='',loadedText=null;
  let layoutPortal='',layoutChoices=[],layoutRequest=0;
  const identity=e=>e.portal+'\n'+e.path+'\n'+e.generation;
  const isPage=e=>e.path&&/^(content|blog)\/.+\.md$/i.test(e.path);
  const eligible=e=>isPage(e)&&!e.element.disabled;
  function status(text,error=false){message.textContent=text;message.classList.toggle('err',error);}
  async function api(verb,editor,payload){const r=await window.SheriffDeskBackend.request('frontmatter.'+verb,{portal:editor.portal},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await r.json();if(!r.ok||data.ok===false)throw Error(data.stderr||'Could not update page details.');return data;}
  function render(){
    const e=desk.contentEditor();panel.hidden=!isPage(e);detailsToggle.disabled=!eligible(e);renderDisclosure();
    document.getElementById('page-details-caption').textContent=[typeof fields.layout==='string'?fields.layout:'',Array.isArray(fields.categories)&&fields.categories.length?fields.categories.length+' categories':''].filter(Boolean).join(' · ')||'Title, layout, categories & more';
    const layout=document.getElementById('pd-layout'),value=Object.hasOwn(pending,'layout')?pending.layout:document.activeElement===layout?layout.value:typeof fields.layout==='string'?fields.layout:'';layout.replaceChildren(new Option('Select a layout',''));for(const name of new Set([...layoutChoices,...(value?[value]:[])]))layout.add(new Option(name,name));layout.value=value;
    for(const control of controls){const name=control.dataset.pageField;control.disabled=loading||!eligible(e)||editable[name]===false;control.title=editable[name]===false?'This field uses advanced syntax. Edit it in Source.':'';if(Object.hasOwn(pending,name)||document.activeElement===control)continue;const value=fields[name];control.value=Array.isArray(value)&&value.every(item=>typeof item==='string')?value.join('\n'):typeof value==='string'?value:'';}
  }
  async function loadLayouts(e){
    if(layoutPortal===e.portal)return;layoutPortal=e.portal;layoutChoices=[];const id=++layoutRequest;
    try{const theme=await(await window.SheriffDeskBackend.request('themes.config',{portal:e.portal},{method:'POST'})).json();const catalog=await(await window.SheriffDeskBackend.request('layouts.list',{portal:e.portal,theme:theme.theme||'outpost'},{method:'POST'})).json();if(id!==layoutRequest||context.current!==e.portal)return;layoutChoices=Array.isArray(catalog.layouts)?catalog.layouts.filter(name=>typeof name==='string'):[];render();}catch{ /* Source keeps custom layouts available when discovery is unavailable. */ }
  }
  async function inspect(force=false){
    const e=desk.contentEditor(),nextKey=identity(e);render();if(!eligible(e))return;void loadLayouts(e);
    if(nextKey!==key){key=nextKey;pending={};fields={};editable={};loadedText=null;clearTimeout(timer);}
    if(Object.keys(pending).length||running||!force&&e.element.value===loadedText)return;
    const text=e.element.value,id=++reading;loadedText=text;loading=true;render();
    try{const data=await api('inspect',e,{text});if(id!==reading||identity(desk.contentEditor())!==nextKey||source.value!==text||Object.keys(pending).length)return;fields=data.fields||{};editable=data.editable||{};status('Changes here update Source. Save when you’re ready.');render();}
    catch(error){if(id!==reading||identity(desk.contentEditor())!==nextKey)return;fields={};for(const c of controls)editable[c.dataset.pageField]=false;status(error.message,true);render();}
    finally{if(id===reading){loading=false;render();}}
  }
  async function flush(){
    clearTimeout(timer);if(running){
      const current=identity(desk.contentEditor()),owner=runningKey,ok=await running;
      // A reload invalidates the old request; it is not a failure in the new
      // document and must not block returning to Visual after Cancel.
      if(identity(desk.contentEditor())!==current||!ok&&owner===current)return false;
      return Object.keys(pending).length?flush():true;
    }
    if(!Object.keys(pending).length)return true;
    const e=desk.contentEditor(),captured=identity(e),text=source.value,changes=pending;pending={};
    if(!eligible(e))return false;
    status('Updating Source…');runningKey=captured;
    running=(async()=>{try{
      const data=await api('patch',e,{text,changes});
      if(identity(desk.contentEditor())!==captured||source.value!==text)return false;
      const next=data.content;if(typeof next!=='string')throw Error('Page details returned no source.');
      // Replace only the changed range and keep a source selection in the body.
      let start=0,end=text.length,nextEnd=next.length;
      while(start<end&&start<nextEnd&&text[start]===next[start])start++;
      while(end>start&&nextEnd>start&&text[end-1]===next[nextEnd-1]){end--;nextEnd--;}
      const a=source.selectionStart,b=source.selectionEnd,delta=nextEnd-end;
      source.setRangeText(next.slice(start,nextEnd),start,end,'preserve');
      source.setSelectionRange(a>=end?a+delta:a,b>=end?b+delta:b);
      fields=data.fields||{};editable=data.editable||{};loadedText=next;
      ownInput=true;source.dispatchEvent(new Event('input',{bubbles:true}));ownInput=false;
      status('Page details updated in Source · not saved yet');render();return true;
    }catch(error){if(identity(desk.contentEditor())===captured&&source.value===text){pending={...changes,...pending};status(error.message,true);}return false;}})();
    const ok=await running;running=null;if(identity(desk.contentEditor())!==captured||!ok&&source.value!==text){loadedText=null;void inspect(true);}return ok&&Object.keys(pending).length?flush():ok;
  }
  for(const control of controls)control.addEventListener('input',()=>{
    const name=control.dataset.pageField;pending[name]=name==='categories'?control.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean):control.value;
    ownInput=true;source.dispatchEvent(new Event('input',{bubbles:true}));ownInput=false;
    status('Unsaved page details');clearTimeout(timer);timer=setTimeout(()=>void flush(),250);
  });
  source.addEventListener('input',()=>{if(ownInput)return;if(Object.keys(pending).length||running){pending={};reading++;status('Source changed. Review page details after typing.');}clearTimeout(timer);timer=setTimeout(()=>void inspect(true),250);});
  window.addEventListener('sheriff:editor-change',()=>void inspect());
  new MutationObserver(()=>void inspect()).observe(document.getElementById('ed-path'),{childList:true,characterData:true,subtree:true});
  new MutationObserver(()=>{render();void inspect();}).observe(source,{attributes:true,attributeFilter:['disabled']});
  panel.addEventListener('toggle',()=>{if(panel.open)void inspect(true);});
  context.subscribe(()=>{reading++;key='';pending={};loadedText=null;loading=false;fields={};editable={};clearTimeout(timer);render();});
  window.addEventListener('sheriff:saved-changes',event=>{if(event.detail.portal===context.current&&event.detail.path==='config.yall'){layoutPortal='';void loadLayouts(desk.contentEditor());}});
  window.SheriffPageDetails={flush};render();void inspect();
}());
