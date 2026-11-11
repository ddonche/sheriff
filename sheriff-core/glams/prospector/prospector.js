/* Theme-neutral Prospector controls. Themes own the sheriff-search-* class styling. */
(function(){
  'use strict';
  if(window.__sheriffProspector)return;window.__sheriffProspector=true;
  function init(){
    const wrapper=document.getElementById('sheriff-search'),input=document.getElementById('sheriff-search-input');if(!wrapper||!input)return;
    const panel=document.createElement('div');panel.className='sheriff-search-results';panel.hidden=true;
    const filterRow=document.createElement('label');filterRow.className='sheriff-search-filter';filterRow.append(document.createTextNode('Category '));const filter=document.createElement('select');filter.setAttribute('aria-label','Filter search by category');filter.append(new Option('All categories',''));filterRow.append(filter);filterRow.hidden=true;
    const list=document.createElement('div');list.id='sheriff-search-results';list.setAttribute('role','listbox');list.setAttribute('aria-label','Search results');
    const status=document.createElement('div');status.className='sheriff-search-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');panel.append(filterRow,list,status);wrapper.append(panel);
    input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls',list.id);
    let worker=null,workerAvailable=true,fallback=null,fallbackLoad=null,sequence=0,timer,active=-1,links=[],open=false;
    function close(){sequence++;open=false;panel.hidden=true;panel.style.display='none';input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;}
    function show(){open=true;panel.hidden=false;panel.style.display='block';input.setAttribute('aria-expanded','true');}
    function select(index){active=index;links.forEach((link,i)=>{link.setAttribute('aria-selected',String(i===index));link.classList.toggle('is-active',i===index);});if(index>=0){input.setAttribute('aria-activedescendant',links[index].id);links[index].scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');}
    function receive(data){if(data.id!==sequence)return;panel.setAttribute('aria-busy','false');list.replaceChildren();links=[];select(-1);show();if(data.error){status.textContent=data.error;return;}if(filter.options.length===1&&data.categories?.length){for(const category of data.categories)filter.append(new Option(category,category));filterRow.hidden=false;}
      status.textContent=data.total?data.total+' result'+(data.total===1?'':'s'):'No results found.';
      for(const [i,item]of (data.results||[]).entries()){
        const url=new URL(item.href,location.href);if(url.origin!==location.origin||!['http:','https:'].includes(url.protocol))continue;
        const link=document.createElement('a');link.setAttribute('href',item.href);link.id='prospector-result-'+data.id+'-'+i;link.className='sheriff-search-result';link.setAttribute('role','option');link.setAttribute('aria-selected','false');
        const title=document.createElement('div');title.className='sheriff-search-result-title';title.textContent=item.title;
        const excerpt=document.createElement('div');excerpt.className='sheriff-search-result-summary';excerpt.textContent=item.excerpt||'';link.append(title,excerpt);
        if(item.version){const version=document.createElement('span');version.className='sheriff-search-result-version';version.textContent=item.version;link.append(version);}
        link.addEventListener('pointermove',()=>select(links.indexOf(link)));list.append(link);links.push(link);
      }
    }
    function runFallback(message){if(!fallbackLoad)fallbackLoad=fetch('/public/search-index.json',{cache:'no-cache'}).then(response=>{if(!response.ok)throw Error();return response.text();}).then(text=>fallback=window.ProspectorEngine.create(window.ProspectorEngine.parse(text))).catch(error=>{fallbackLoad=null;throw error;});fallbackLoad.then(()=>setTimeout(()=>receive({id:message.id,...fallback.query(message.query,{category:message.category,limit:10})}),0)).catch(()=>receive({id:message.id,error:'Search is unavailable right now. Try again shortly.'}));}
    function search(){clearTimeout(timer);const query=input.value.trim();if(!query){list.replaceChildren();close();return;}const message={id:++sequence,query,category:filter.value};show();panel.setAttribute('aria-busy','true');status.textContent='Searching…';
      if(!worker&&workerAvailable&&typeof Worker==='function'){try{worker=new Worker('/public/prospector-worker.js');const current=worker;worker.onmessage=event=>receive(event.data);worker.onerror=()=>{if(worker!==current)return;current.terminate();worker=null;workerAvailable=false;if(open&&input.value.trim())runFallback({id:sequence,query:input.value.trim(),category:filter.value});};}catch{worker=null;workerAvailable=false;}}
      if(worker)worker.postMessage(message);else runFallback(message);
    }
    input.addEventListener('input',event=>{if(event.isComposing)return;sequence++;clearTimeout(timer);list.replaceChildren();links=[];select(-1);if(!input.value.trim()){list.replaceChildren();close();return;}timer=setTimeout(search,100);});input.addEventListener('compositionend',search);input.addEventListener('focus',()=>{if(input.value.trim())search();});filter.addEventListener('change',search);
    input.addEventListener('keydown',event=>{if(event.isComposing)return;if(event.key==='Escape'){event.preventDefault();clearTimeout(timer);close();return;}if(event.key==='ArrowDown'&&links.length){event.preventDefault();show();select((active+1)%links.length);}else if(event.key==='ArrowUp'&&links.length){event.preventDefault();show();select(active<=0?links.length-1:active-1);}else if(event.key==='Enter'&&open&&active>=0){event.preventDefault();location.assign(links[active].href);}});
    document.addEventListener('keydown',event=>{const target=document.activeElement;if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!target?.matches('input,textarea,select')&&!target?.isContentEditable){event.preventDefault();input.focus();input.select();}});
    document.addEventListener('pointerdown',event=>{if(!wrapper.contains(event.target)){clearTimeout(timer);close();}});wrapper.addEventListener('focusout',event=>{if(!wrapper.contains(event.relatedTarget)){clearTimeout(timer);close();}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
}());
