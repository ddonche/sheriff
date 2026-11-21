// Public page editing uses the shared Desk bundle and the shared Howdy policy.
(() => {
  'use strict';
  const host=document.querySelector('[data-howdy][data-page]');if(!host)return;
  let page;try{page=JSON.parse(host.dataset.page);}catch{return;}
  let generation=0,dialog=null,frame=null,current=null,client=null,editing=false;
  const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname)||location.hostname.endsWith('.localhost');
  const scope='sheriff-page-editor';
  async function token(){
    // identity() refreshes the existing SSO session under its browser refresh lock.
    if(!await client.identity())throw Error('Sign in to Sheriff again.');
    const session=JSON.parse(localStorage.getItem('sheriff.howdy.session.ee0767ae-d4e4-4c7e-88a6-4c5a3152b6ea')||'null');
    if(!session?.access_token)throw Error('Sign in to Sheriff again.');return session.access_token;
  }
  async function request(verb,payload){
    const url=local?'/api/page_content?'+verb+'&portal='+encodeURIComponent(page.source):'https://sheriffcloud.com/api/desk/content.'+verb+'?'+new URLSearchParams({site:page.site,portal:page.portal});
    const response=await fetch(url,{method:'POST',cache:'no-store',credentials:'omit',headers:{Authorization:'Bearer '+await token(),'Content-Type':'application/json'},body:JSON.stringify({...payload,path:page.path})});
    const raw=await response.text();let result;try{result=JSON.parse(raw);while(result?.status!==undefined&&result?.body!==undefined)result=typeof result.body==='string'?JSON.parse(result.body):result.body;}catch{throw Error('The page editing service returned an unreadable response (HTTP '+response.status+').');}
    if(!response.ok||result.ok===false){const error=Error(result.stderr||'This account cannot edit this page.');error.result=result;throw error;}return result;
  }
  const send=(type,data={})=>frame?.contentWindow?.postMessage({scope,type,...data},location.origin);
  function theme(){const styles=getComputedStyle(host),out={};for(const key of ['bg','panel','input-bg','border','text','muted','accent','link','danger','font-body','control-radius','panel-radius'])out['--sheriff-'+key]=styles.getPropertyValue('--sheriff-'+key);return out;}
  function close(){dialog?.close();dialog?.remove();dialog=null;frame=null;current=null;editing=false;}
  async function open(){
    if(editing)return;editing=true;
    try{
      current=await request('read',{});
      dialog=document.createElement('dialog');dialog.className='howdy-page-dialog';dialog.setAttribute('aria-label','Edit this page');
      frame=document.createElement('iframe');frame.title='Sheriff page editor';frame.src=page.public_base+'/howdy/editor/index.html';dialog.append(frame);document.body.append(dialog);
      dialog.addEventListener('cancel',event=>{event.preventDefault();send('close-request');});dialog.showModal();
    }catch(error){editing=false;host.querySelector('.howdy-status').textContent=error.message;}
  }
  window.addEventListener('message',async event=>{
    if(!frame||event.source!==frame.contentWindow||event.origin!==location.origin||event.data?.scope!==scope)return;
    const data=event.data;
    if(data.type==='ready'){send('init',{page:{...page,title:document.querySelector('h1')?.textContent||'Edit page'},body:current.body,theme:theme()});return;}
    if(data.type==='close'){close();return;}
    if(data.type==='complete'){close();location.reload();return;}
    if(data.type==='library'&&Number.isSafeInteger(data.id)&&['images','icons','patterns'].includes(data.kind)){
      const requestingFrame=frame;
      try{const result=await request('library',{kind:data.kind});if(frame===requestingFrame)send('library-result',{id:data.id,result});}
      catch(error){if(frame===requestingFrame)send('library-result',{id:data.id,result:{ok:false,stderr:error.message}});}return;
    }
    if(data.type!=='save'||typeof data.body!=='string'||data.body.length>2097152)return;
    const savingFrame=frame;
    try{const result=await request('save',{base:current.base,body:data.body});if(frame!==savingFrame)return;current.base=result.base;send('result',{ok:true,saved:true,body:data.body});}
    catch(error){if(frame!==savingFrame)return;const result=error.result;if(result?.saved&&result.base)current.base=result.base;send('result',{ok:false,saved:!!result?.saved,body:data.body,error:error.message});}
  });
  window.SheriffPageEditing={async refresh(identity,api){
    client=api;const ticket=++generation;host.querySelector('[data-howdy-edit]')?.remove();if(!identity?.user)return;
    try{await request('read',{});if(ticket!==generation)return;const button=document.createElement('button');button.type='button';button.className='sheriff-header-action howdy-edit';button.dataset.howdyEdit='';button.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg><span>Edit page</span>';button.addEventListener('click',()=>void open());host.prepend(button);}catch{/* Permissions fail closed; normal browsing and sign-in remain available. */}
  }};
})();
