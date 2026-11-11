// Pickers insert into article or navigation buffers; management stays in its own panels.
(function () {
  'use strict';
  const fetch = (...args) => window.SheriffDeskBackend.fetch(...args);
  const $=id=>document.getElementById(id),desk=window.SheriffDesk,context=window.SheriffPortalContext;
  const batchSize=96;let shown=batchSize;
  let target=null,kind='',items=[],selected=null,request=0,loading=false;
  const toggles={icons:$('cx-icons-toggle'),patterns:$('cx-patterns-toggle')};
  const navToggle=$('nv-icons-toggle'),panel=$('cx-panel'),contentAnchor=document.createComment('Content insert picker');
  panel.before(contentAnchor);
  const editorNow=()=>location.hash==='#navigation'?desk.navigationEditor():desk.contentEditor();
  function eligible(editor,next){return !!(editor.portal&&editor.path&&!editor.busy&&!editor.element.disabled&&(/\.md$/i.test(editor.path)||(next==='icons'&&editor.path.toLowerCase()==='nav.yall')));}
  function same(){const editor=editorNow();return target&&eligible(editor,kind)&&editor.element===target.element&&editor.portal===target.portal&&editor.path===target.path&&editor.generation===target.generation&&context.revision===target.revision;}
  function status(text,error){$('cx-status').textContent=text;$('cx-status').classList.toggle('err',!!error);}
  function close(){target=null;items=[];selected=null;loading=false;++request;$('cx-panel').hidden=true;[...Object.values(toggles),navToggle].forEach(button=>button.setAttribute('aria-expanded','false'));}
  function sync(){const busy=!!window.SheriffContentImages?.isBusy();for(const [next,button] of Object.entries(toggles))button.disabled=!eligible(desk.contentEditor(),next)||busy;navToggle.disabled=!eligible(desk.navigationEditor(),'icons')||busy;if(target&&!same())close();}
  function color(){const value=$('cx-color').value.trim();return value&&value.length<=120&&/^[a-zA-Z0-9#(),.% /+\-]+$/.test(value)&&CSS.supports('color',value)?value:'';}
  function size(){const value=$('cx-size').value.trim(),number=Number(value);return /^\d+$/.test(value)&&Number.isInteger(number)&&number>=8&&number<=256?String(number):'';}
  function paint(element,icon){element.dataset.format=icon.format==='png'?'png':'svg';element.style.setProperty('--icon-preview',icon.format==='png'?'url("'+icon.png+'")':'url("data:image/svg+xml,'+encodeURIComponent(icon.svg).replace(/'/g,'%27')+'")');element.style.color=color();if(element===$('cx-selected-icon'))element.style.width=element.style.height=size()?size()+'px':'';}
  function syntax(){if(!selected)return '';if(kind==='icons'){const tint=selected.format==='png'?'':color();return '[[icon|'+selected.name+(tint||size()?'|'+tint:'')+(size()?'|'+size():'')+']]';}return $('cx-pattern-use').value==='token'?desk.patternToken(selected.header.name):desk.patternSource(selected.body);}
  function updateSelection(){
    $('cx-grid').querySelectorAll('[data-item]').forEach(button=>button.setAttribute('aria-pressed',String(selected&&button.dataset.item===selected.key)));
    for(const id of ['cx-color','cx-color-picker','cx-reset-color'])$(id).disabled=selected?.format==='png';
    $('cx-color-help').textContent=selected?.format==='png'?'PNG icons keep their original colors.':'Color (optional)';
    const icon=kind==='icons',header=selected?.header,template=header?.mode==='template';
    $('cx-selected-icon').hidden=!icon||!selected;if(icon&&selected)paint($('cx-selected-icon'),selected);
    $('cx-name').textContent=selected?selected.name:'Select '+(icon?'an icon':'a pattern');
    $('cx-description').textContent=selected?(icon?(selected.source||'Core')+' icon':template?'Template: insert its source, then fill in the fields.':'Reusable: insert a shared token or an independent editable copy.'):'Choose an item to preview what will be inserted.';
    $('cx-pattern-detail').hidden=icon||!selected;$('cx-pattern-use').disabled=template;
    $('cx-pattern-use').querySelector('[value=token]').disabled=!!template;
    $('cx-syntax').value=syntax();$('cx-insert').disabled=loading||!selected||!same();
    $('cx-size').setAttribute('aria-invalid',String(!!$('cx-size').value.trim()&&!size()));
    $('cx-color').setAttribute('aria-invalid',String(!!$('cx-color').value.trim()&&!color()));
  }
  function render(){
    const query=$('cx-search').value.trim().toLowerCase(),matches=items.filter(item=>(item.name+' '+(item.filename||'')).toLowerCase().includes(query)),grid=$('cx-grid');grid.replaceChildren();
    for(const item of (kind==='icons'?matches.slice(0,shown):matches)){
      const button=document.createElement('button');button.type='button';button.dataset.item=item.key;button.title=item.name;button.setAttribute('aria-label','Select '+item.name);button.setAttribute('aria-pressed',String(selected?.key===item.key));
      if(kind==='icons'){button.className='icon-tile';const preview=document.createElement('span');preview.className='icons-preview';preview.setAttribute('aria-hidden','true');paint(preview,item);button.append(preview);}
      else{button.className='cx-pattern-item';const name=document.createElement('span'),mode=document.createElement('small');name.textContent=item.name;mode.textContent=item.header.mode==='template'?'Template':'Reusable';button.append(name,mode);}
      button.addEventListener('click',()=>{selected=item;$('cx-pattern-use').value=item.header?.mode==='template'?'source':'token';updateSelection();});grid.append(button);
    }
    $('cx-more').hidden=kind!=='icons'||matches.length<=shown;$('cx-more').textContent='Show more icons ('+Math.max(0,matches.length-shown)+' remaining)';
    status(items.length?matches.length+' of '+items.length+' '+kind+(matches.length?'':' — no matches.'):(kind==='icons'?'No icons available.':'No patterns yet. Create one in the Patterns panel.'));updateSelection();
  }
  async function open(next){
    const editor=editorNow();if(!eligible(editor,next)||context.locked||window.SheriffContentImages?.isBusy())return;
    if(target&&kind===next){close();editor.element.focus();return;}
    const selection={element:editor.element,portal:editor.portal,path:editor.path,generation:editor.generation,revision:context.revision,start:editor.element.selectionStart,end:editor.element.selectionEnd};
    window.dispatchEvent(new CustomEvent('sheriff:content-picker-open',{detail:{kind:next}}));close();kind=next;shown=batchSize;target=selection;loading=true;const token=++request,capture=target;
    if(location.hash==='#navigation')$('nv-picker-host').append(panel);else contentAnchor.after(panel);
    panel.hidden=false;(location.hash==='#navigation'?navToggle:toggles[kind]).setAttribute('aria-expanded','true');
    $('cx-title').textContent=kind==='icons'?'Insert icon':'Insert pattern';$('cx-insert').textContent=$('cx-title').textContent;$('cx-manage').textContent='Manage '+kind+' ↗';$('cx-manage').href='#'+kind;
    $('cx-icon-detail').hidden=kind!=='icons';$('cx-pattern-detail').hidden=true;$('cx-color').value='';$('cx-size').value='';$('cx-color-picker').value='#22282c';$('cx-search').value='';$('cx-search').placeholder='Search '+kind+'…';$('cx-grid').className=kind==='icons'?'cx-icon-grid':'cx-pattern-list';$('cx-grid').setAttribute('aria-label','Available '+kind);$('cx-grid').replaceChildren();updateSelection();status('Loading '+kind+'…');$('cx-search').focus();
    try{
      const response=await fetch('/api/list_'+kind+'?'+encodeURIComponent(capture.portal),{cache:'no-store'}),data=await response.json();
      if(token!==request||target!==capture||!same())return;
      if(!response.ok||data.ok===false)throw Error(data.stderr||'Could not load '+kind+'.');
      items=kind==='icons'?(data.icons||[]).filter(item=>typeof item.name==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.name)&&(typeof item.svg==='string'||(item.format==='png'&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(item.png)))).map(item=>({...item,key:item.name})):(data.patterns||[]).filter(item=>typeof item.filename==='string'&&typeof item.body==='string').map(item=>({...item,header:desk.patternHeader(item.body)})).filter(item=>item.header).map(item=>({...item,name:item.header.name,key:item.filename}));
      loading=false;render();
    }catch(error){if(token===request&&target===capture){loading=false;status(error.message||'Could not load '+kind+'.',true);updateSelection();}}
  }
  $('cx-size').addEventListener('input',updateSelection);
  $('cx-more').addEventListener('click',()=>{shown+=batchSize;render();});
  $('cx-search').addEventListener('input',()=>{shown=batchSize;if(!loading)render();});
  $('cx-color').addEventListener('input',()=>{for(const icon of items){const tile=Array.from($('cx-grid').children).find(button=>button.dataset.item===icon.key);if(tile)paint(tile.firstElementChild,icon);}updateSelection();});
  $('cx-color-picker').addEventListener('input',()=>{$('cx-color').value=$('cx-color-picker').value;$('cx-color').dispatchEvent(new Event('input'));});
  $('cx-reset-color').addEventListener('click',()=>{$('cx-color').value='';$('cx-color').dispatchEvent(new Event('input'));});
  $('cx-pattern-use').addEventListener('change',updateSelection);
  $('cx-insert').addEventListener('click',()=>{
    if(!selected||!same()||loading||context.locked){if(!same())close();return;}
    let text=syntax();const editor=editorNow();
    if(kind==='patterns'&&$('cx-pattern-use').value==='source'){
      text=text.trim();const before=editor.element.value.slice(0,target.start),after=editor.element.value.slice(target.end),eol=editor.element.value.includes('\r\n')?'\r\n':'\n';
      if(before&&!/\n\s*\n$/.test(before))text=(/\n$/.test(before)?eol:eol+eol)+text;
      if(after&&!/^\r?\n\s*\r?\n/.test(after))text+=/^\r?\n/.test(after)?eol:eol+eol;
    }
    if((location.hash==='#navigation'?desk.insertNavigation(text,target):desk.insertContent(text,target))){const label=kind==='icons'?'Icon':'Pattern';close();editor.element.focus();desk.notify(label+' inserted.');}else close();
  });
  $('cx-cancel').addEventListener('click',()=>{close();editorNow().element.focus();});
  navToggle.addEventListener('click',()=>open('icons'));
  for(const next of Object.keys(toggles))toggles[next].addEventListener('click',()=>open(next));
  $('cx-grid').addEventListener('keydown',event=>{
    const buttons=Array.from($('cx-grid').querySelectorAll('[data-item]')),index=buttons.indexOf(event.target);if(index<0)return;
    const columns=buttons.filter(button=>button.offsetTop===buttons[0].offsetTop).length;
    const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-columns,ArrowDown:columns}[event.key];
    if(delta!==undefined||event.key==='Home'||event.key==='End'){event.preventDefault();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,index+delta))].focus();}
  });
  $('cx-panel').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();editorNow().element.focus();}});
  for(const editor of [desk.contentEditor().element,desk.navigationEditor().element])for(const event of ['click','keyup','select','input'])editor.addEventListener(event,()=>{if(same()){target.start=editor.selectionStart;target.end=editor.selectionEnd;}});
  window.addEventListener('sheriff:content-picker-open',event=>{if(event.detail.kind==='image')close();});
  window.addEventListener('sheriff:editor-change',sync);context.subscribe(()=>{close();sync();});window.addEventListener('hashchange',()=>{close();sync();});sync();
}());
