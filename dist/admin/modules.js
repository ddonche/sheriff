// Desk panel API v1: one catalog, separate module-owned control panels.
(() => {
  'use strict';
  const icons={"arrow-left":"<!-- @license lucide-static v1.71.0 - ISC -->\n<svg\n  class=\"lucide lucide-arrow-left\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"m12 19-7-7 7-7\" />\n  <path d=\"M19 12H5\" />\n</svg>\n"};
  const el=id=>document.getElementById(id),root=el('modules-panels'),status=el('modules-status');
  let ticket=0,timer,busy=false,selected='',panels=[],mounted=null,scope='',filter='all';
  const visible=()=>location.hash==='#modules';
  const state=()=>window.SheriffModuleConfig?.state();
  const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
  const activation=panel=>(panel.fields||[]).find(f=>f.id===panel.activation);
  const isActive=panel=>!activation(panel)||activation(panel).value===true;
  const filters=node('div','','module-filters'),tabs=node('div','','module-filter-tabs'),search=node('input');
  tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Filter modules by status');
  search.type='search';search.className='wiz-input';search.placeholder='Search installed modules…';search.setAttribute('aria-label','Search installed modules');
  filters.append(tabs,search);root.before(filters);
  for(const value of ['all','active','inactive']){
    const tab=node('button','','module-text-action');tab.type='button';tab.dataset.filter=value;
    tab.addEventListener('click',()=>{filter=value;render();});tabs.append(tab);
  }
  search.addEventListener('input',render);
  function unmount(){if(mounted){mounted.abort();mounted=null;}}
  function sync(){
    const current=state();if(!current)return;
    el('modules-save').disabled=busy||current.disabled||current.saving||!current.dirty;
    el('modules-build').disabled=busy||current.disabled||current.saving;
    el('modules-dirty').hidden=!current.dirty;
    el('modules-scope').textContent=current.grouped?'Site settings — '+current.siteName+'. Changes apply to all its portals.':'Settings for '+(current.portal||'the selected portal')+'.';
    status.textContent=el('cf-status').textContent;status.className=el('cf-status').className;
    for(const control of root.querySelectorAll('[data-module-setting]'))control.disabled=busy||current.disabled||current.saving||control.dataset.invalid==='true';
  }
  async function api(operation,payload,signal,portal=window.SheriffPortalContext.current){
    const response=await window.SheriffDeskBackend.request('modules.'+operation,{portal},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal});
    const raw=await response.text();let data;try{data=JSON.parse(raw)}catch{throw Error('Module service returned an unreadable response (HTTP '+response.status+').');}
    if(!response.ok||data.ok===false)throw Error(data.stderr||'Could not load module controls.');return data;
  }
  async function patch(panel,field,value){
    const before=state();if(!before||before.disabled||busy)return;
    busy=true;const request=++ticket;clearTimeout(timer);sync();el('modules-error').textContent='';
    try{
      const result=await api('patch',{text:before.text,module:panel.id,field:field.id,value});
      if(request!==ticket)return;
      if(!window.SheriffModuleConfig.patch(before,result.content))throw Error('Configuration changed while this setting was being edited. Try again.');
      panels=result.panels;render();
    }catch(error){el('modules-error').textContent=error.message;}
    finally{busy=false;sync();}
  }
  function button(label,action,cls=''){const b=node('button',label,'btn small '+cls);b.type='button';b.addEventListener('click',action);return b;}
  function withIcon(button,name){const icon=node('span','','module-control-icon');icon.setAttribute('aria-hidden','true');icon.innerHTML=icons[name];button.prepend(icon);return button;}
  el('modules-back').replaceChildren();el('modules-back').append(node('span','Modules'));withIcon(el('modules-back'),'arrow-left');
  function header(panel){
    const head=node('div','','module-card-head'),icon=node('span','','module-icon');icon.setAttribute('aria-hidden','true');icon.innerHTML=panel.icon_svg||'';
    const title=node('div');title.append(node('h3',panel.name||panel.id),node('p',panel.description||'','np-hint'));
    head.append(icon,title,node('span',panel.version?'v'+panel.version:'Installed','pill'));return head;
  }
  function render(){
    unmount();root.replaceChildren();
    const panel=panels.find(p=>p.id===selected);
    if(selected&&!panel)selected='';
    root.classList.toggle('is-catalog',!panel);
    el('modules-title').textContent=panel?.name||'Modules';
    el('modules-back').hidden=!panel;
    el('modules-intro').textContent=panel?'Module control panel. Save settings when ready; rebuilding updates the website.':'All module settings live here. Select a module to open its controls. Save activation changes; rebuild when ready.';
    filters.hidden=!!panel;
    for(const tab of tabs.children){const value=tab.dataset.filter,count=panels.filter(p=>value==='all'||isActive(p)===(value==='active')).length;tab.textContent=value[0].toUpperCase()+value.slice(1)+' ('+count+')';tab.setAttribute('aria-pressed',String(filter===value));}
    if(!panels.length){root.append(node('p','No installed modules declare Desk controls yet.','tree-msg'));return;}
    const query=search.value.trim().toLocaleLowerCase();
    const matches=panels.filter(p=>(filter==='all'||isActive(p)===(filter==='active'))&&[p.name,p.id,p.description].join(' ').toLocaleLowerCase().includes(query)).sort((a,b)=>Number(isActive(b))-Number(isActive(a))||(a.name||a.id).localeCompare(b.name||b.id));
    if(!panel&&!matches.length)root.append(node('p','No modules match your filters.','tree-msg'));
    for(const item of panel?[panel]:matches){
      const card=node('section','','panel module-card'+(!panel?' module-catalog-row':''));card.dataset.module=item.id;card.dataset.active=String(isActive(item));const heading=header(item);card.append(heading);
      if(item.error)card.append(node('p',item.error,'ed-status err'));
      const field=activation(item);
      if(!panel){
        const openPanel=()=>{selected=item.id;render();};
        const title=heading.querySelector('h3'),name=node('button',item.name||item.id,'module-name');name.type='button';name.setAttribute('aria-label','Open '+(item.name||item.id)+' panel');name.addEventListener('click',openPanel);title.replaceChildren(name);
        const bar=node('div','','module-catalog-actions');
        if(field){const toggle=button(field.value===true?'Deactivate':'Activate',()=>void patch(item,field,field.value!==true));toggle.className='module-text-action '+(field.value===true?'module-deactivate':'module-activate');toggle.dataset.moduleSetting='';toggle.dataset.invalid=String(typeof field.value!=='boolean');bar.append(toggle);}
        else bar.append(node('span','Always active','np-hint'));
        const open=button('Settings',openPanel);open.className='module-text-action';open.setAttribute('aria-label',(item.name||item.id)+' settings');bar.append(open);
        const updates=node('span','','module-update');
        // A release link is honest until package installation/update providers exist.
        if(typeof item.updates==='string'&&/^https:\/\//i.test(item.updates)){
          const link=node('a','Updates','module-text-action');link.href=item.updates;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label',(item.name||item.id)+' updates');updates.append(link);
        }
        bar.append(updates);card.append(bar);
      }else{
        for(const f of item.fields||[]){
          const label=node('label','','module-field'),input=node('input');input.type='checkbox';input.checked=f.value===true;input.dataset.moduleSetting='';input.dataset.invalid=String(typeof f.value!=='boolean');
          const text=node('span');text.append(node('strong',f.label||f.id),node('small',typeof f.value==='boolean'?(f.description||''):'This setting must be true or false. Correct it in Config.'));
          label.append(input,text);card.append(label);input.addEventListener('change',()=>void patch(item,f,input.checked));
        }
        if(item.help)card.append(node('p',item.help,'np-hint module-help'));
        const container=node('div','','module-control-panel');card.append(container);root.append(card);void mountPanel(item,container);continue;
      }
      root.append(card);
    }
    sync();
  }
  async function mountPanel(panel,container){
    if(!panel.panel)return;
    const controller=new AbortController();mounted=controller;const {signal}=controller,portal=window.SheriffPortalContext.current;
    const active=()=>!signal.aborted&&container.isConnected&&portal===window.SheriffPortalContext.current;
    container.textContent='Loading panel…';
    try{
      const bundle=await api('panel',{module:panel.id},signal);if(!active())return;
      const url=URL.createObjectURL(new Blob([bundle.source],{type:'text/javascript'}));let entry;
      try{entry=await import(url);}finally{URL.revokeObjectURL(url);}
      if(!active())return;if(typeof entry.mount!=='function')throw Error('Module panel must export mount(context).');
      container.replaceChildren();
      const ui={node,button,icon(name){const icon=node('span','','module-control-icon');icon.setAttribute('aria-hidden','true');icon.innerHTML=bundle.icons?.[name]||'';return icon;},
        field(labelText,options={}){const label=node('label','','module-control-field'),input=node('input');input.className='wiz-input';input.type=options.type||'text';input.placeholder=options.placeholder||'';input.setAttribute('aria-label',labelText);label.append(node('span',labelText),input);return {element:label,input};},
        message(text=''){const message=node('p',text,'np-hint module-control-message');message.setAttribute('role','status');return message;}};
      const request=(action,payload={})=>{if(!active())return Promise.reject(new DOMException('Module panel was closed.','AbortError'));return api('action',{module:panel.id,action,payload},signal,portal);};
      const cleanup=await entry.mount(Object.freeze({apiVersion:1,container,portal,site:state()?.siteName||'',mode:window.SheriffDeskBackend.mode,signal,ui,request,
        settings:Object.fromEntries((panel.fields||[]).map(f=>[f.id,f.value])),
        services:Object.freeze({cloud:window.SheriffCloudSync,backend:window.SheriffDeskBackend})}));
      if(typeof cleanup==='function'){if(signal.aborted)cleanup();else signal.addEventListener('abort',cleanup,{once:true});}
    }catch(error){if(active()){container.replaceChildren(uiError(error));}}
  }
  function uiError(error){const box=node('div','','module-panel-error');box.append(node('p',error.message,'ed-status err'),button('Retry',render));return box;}
  async function inspect(request){
    const before=state();if(request!==ticket||!visible()||busy||!before||before.disabled)return;
    try{const result=await api('inspect',{text:before.text});if(request!==ticket||state()?.text!==before.text)return;panels=result.panels;render();el('modules-error').textContent='';}
    catch(error){if(request===ticket)el('modules-error').textContent=error.message;}
    sync();
  }
  function refresh(){sync();if(!visible()||busy)return;clearTimeout(timer);const request=++ticket;timer=setTimeout(()=>inspect(request),80);}
  window.SheriffModules={enter(){const next=state()?.portal;if(scope!==next){scope=next;unmount();}root.textContent='Loading modules…';el('modules-error').textContent='';refresh();},refresh};
  el('modules-back').addEventListener('click',()=>{selected='';render();});
  el('modules-save').addEventListener('click',()=>window.SheriffModuleConfig.save(false));
  el('modules-build').addEventListener('click',()=>window.SheriffModuleConfig.save(true));
  window.SheriffPortalContext.subscribe?.(()=>{ticket++;unmount();});
  window.addEventListener('hashchange',()=>{if(!visible()){ticket++;clearTimeout(timer);unmount();}});
  window.addEventListener('sheriff:editor-change',refresh);
  new MutationObserver(sync).observe(el('cf-status'),{childList:true,subtree:true,attributes:true});
})();
