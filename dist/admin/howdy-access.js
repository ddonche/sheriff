window.SheriffHowdyIcons={"lock":"<!-- @license lucide-static v1.71.0 - ISC -->\n<svg\n  class=\"lucide lucide-lock-keyhole\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <circle cx=\"12\" cy=\"16\" r=\"1\" />\n  <rect x=\"3\" y=\"10\" width=\"18\" height=\"12\" rx=\"2\" />\n  <path d=\"M7 10V7a5 5 0 0 1 10 0v3\" />\n</svg>\n","unlock":"<!-- @license lucide-static v1.71.0 - ISC -->\n<svg\n  class=\"lucide lucide-lock-keyhole-open\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <circle cx=\"12\" cy=\"16\" r=\"1\" />\n  <rect width=\"18\" height=\"12\" x=\"3\" y=\"10\" rx=\"2\" />\n  <path d=\"M7 10V7a5 5 0 0 1 9.33-2.5\" />\n</svg>\n","user":"<!-- @license lucide-static v1.71.0 - ISC -->\n<svg\n  class=\"lucide lucide-user-round-plus\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M2 21a8 8 0 0 1 13.292-6\" />\n  <circle cx=\"10\" cy=\"8\" r=\"5\" />\n  <path d=\"M19 16v6\" />\n  <path d=\"M22 19h-6\" />\n</svg>\n","remove":"<!-- @license lucide-static v1.71.0 - ISC -->\n<svg\n  class=\"lucide lucide-user-round-minus\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M2 21a8 8 0 0 1 13.292-6\" />\n  <circle cx=\"10\" cy=\"8\" r=\"5\" />\n  <path d=\"M22 19h-6\" />\n</svg>\n"};
// Howdy reuses the page action bar and module card; no build side effects.
(() => {
  'use strict';
  const desk=window.SheriffDesk,context=window.SheriffPortalContext,backend=window.SheriffDeskBackend;
  const actions=document.querySelector('.ed-save-actions');if(!desk||!actions)return;
  const row=document.createElement('div');row.className='howdy-page-access';row.hidden=true;
  const button=document.createElement('button');button.type='button';button.className='btn small';
  const note=document.createElement('span');note.className='np-hint';note.setAttribute('role','status');row.append(button,note);actions.prepend(row);
  let selected='',caps=null,busy=false,request=0,notice='';
  const identity=e=>e.portal+'\n'+e.path+'\n'+e.generation;
  const isPage=e=>/^(content|blog)\/.+\.md$/i.test(e.path||'');
  const icons=window.SheriffHowdyIcons;
  async function api(verb,portal,payload={},online=false){
    if(online&&backend.mode==='local'){
      if(!window.SheriffCloudSync?.access)throw Error('Sign in to Sheriff Cloud to manage published editing access.');
      return window.SheriffCloudSync.access(verb,portal,payload);
    }
    const response=await backend.request('howdy.access.'+verb,{portal},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const text=await response.text();let result;try{result=JSON.parse(text)}catch{throw Error('Howdy access could not be loaded.');}
    if(!response.ok||result.ok===false)throw Error(result.stderr||'Howdy access is unavailable.');return result;
  }
  function render(){
    const e=desk.contentEditor();row.hidden=!isPage(e);button.disabled=busy||!caps?.manage_access;
    button.innerHTML=(caps?.locked?icons.unlock:icons.lock)+'<span>'+(caps?.locked?'Unlock page':'Lock page')+'</span>';
    button.setAttribute('aria-pressed',String(caps?.locked===true));
    button.title=caps?.locked?'Unlock this page to allow editing. Reading and builds remain available.':'Lock this page against editing across all revisions.';
    note.hidden=!notice;note.textContent=notice|| (caps?.locked?'Locked for editing. Reading and builds remain available.':backend.mode==='local'?'Page locks protect edits in this local workspace.':'Only the site owner can lock this page.');
  }
  async function load(force=false){
    const e=desk.contentEditor(),id=identity(e);if(!isPage(e)){row.hidden=true;selected='';caps=null;return;}
    if(selected===id&&!force)return;selected=id;caps=null;notice='';render();const own=++request;
    try{const result=await api('page',e.portal,{path:e.path});if(own!==request||identity(desk.contentEditor())!==id)return;caps=result.capabilities;render();window.dispatchEvent(new Event('sheriff:access-change'));}
    catch(error){if(own===request){notice=error.message;render();}}
  }
  button.addEventListener('click',async()=>{
    const e=desk.contentEditor(),id=identity(e);if(!caps?.manage_access||busy)return;
    busy=true;notice='';render();try{const result=await api('lock',e.portal,{path:e.path,locked:!caps.locked});if(identity(desk.contentEditor())===id){caps=result.capabilities;render();window.dispatchEvent(new Event('sheriff:access-change'));}}
    catch(error){notice=error.message;}finally{busy=false;render();}
  });
  window.SheriffHowdyAccess={blocked(portal,path){return selected.startsWith(portal+'\n'+path+'\n')&&caps?.locked===true;},refresh:()=>load(true)};
  window.addEventListener('sheriff:editor-change',()=>void load());
  document.getElementById('page-details').addEventListener('toggle',()=>{if(document.getElementById('page-details').open)void load(true);});
  window.addEventListener('focus',()=>void load(true));context.subscribe(()=>{selected='';caps=null;void load();});
  void load();
})();
