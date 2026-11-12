// Insert images into the current Markdown buffer using Desk's shared Media files.
(function () {
  'use strict';
  const fetch = (...args) => window.SheriffDeskBackend.fetch(...args);
  const $ = id => document.getElementById(id), context = window.SheriffPortalContext, desk = window.SheriffDesk;
  const extensions = new Set(['png','jpg','jpeg','gif','webp','svg','avif','ico']);
  let target = null, files = [], folders = [], busy = false, loading = false, request = 0, blob = '', fileForPreview = null;
  const root = 'public/images', port = location.port || '5173';
  function eligible(editor) { return editor.portal && editor.path && /\.md$/i.test(editor.path) && !editor.element.disabled; }
  function same(editor, capture) { return capture && editor.portal === capture.portal && editor.path === capture.path && editor.generation === capture.generation && !editor.element.disabled; }
  function rememberFolder(folder) { try { localStorage.setItem('desk.imageFolder.' + target.portal, folder); } catch (_) {} }
  function savedFolder(portal) { try { return localStorage.getItem('desk.imageFolder.' + portal) || root; } catch (_) { return root; } }
  function status(text, error) { $('ci-status').textContent = text || ''; $('ci-status').classList.toggle('err', !!error); }
  function disposePreview() { if (blob) URL.revokeObjectURL(blob); blob = ''; fileForPreview = null; }
  function close() {
    target = null; loading = false; ++request; disposePreview(); $('ci-panel').hidden = true; $('ci-toggle').setAttribute('aria-expanded','false');
    $('ci-file').value = ''; $('ci-newfolder-row').hidden = true;
    $('ci-preview-image').removeAttribute('src'); $('ci-preview-image').hidden = true;
  }
  function syncEditor() {
    const editor = desk.contentEditor(); $('ci-toggle').disabled = !eligible(editor) || busy;
    if (target && !same(editor,target)) close();
  }
  function selectedPath() {
    if ($('ci-source').value === 'existing') return $('ci-existing').value;
    const file = $('ci-file').files[0];
    return file && $('ci-folder').value ? $('ci-folder').value + '/' + file.name : '';
  }
  function captionError() { return /[|\[\]]/.test($('ci-caption').value) ? 'Captions cannot contain |, [ or ] in Sheriff image syntax.' : ''; }
  function token() {
    const path = selectedPath();
    if (!path || !path.startsWith(root + '/') || captionError()) return '';
    const relative = path.slice(root.length + 1).split('/').map(encodeURIComponent).join('/');
    return '[[image:' + relative + '|' + $('ci-size').value + '|' + $('ci-align').value + '|' + $('ci-caption').value.trim() + ']]';
  }
  function preview() {
    const upload = $('ci-source').value === 'upload', file = $('ci-file').files[0], path = selectedPath();
    if (file !== fileForPreview) { disposePreview(); if (file) { fileForPreview = file; blob = URL.createObjectURL(file); } }
    const src = upload ? blob : path && target ? window.SheriffDeskBackend.assetUrl(target.portal, path) : '';
    $('ci-preview-image').hidden = !src; $('ci-preview-placeholder').hidden = !!src;
    $('ci-preview-placeholder').textContent = 'Choose an image to preview it.';
    if (src && $('ci-preview-image').getAttribute('src') !== src) $('ci-preview-image').src = src;
    else if (!src) $('ci-preview-image').removeAttribute('src');
  }
  function update() {
    const upload = $('ci-source').value === 'upload';
    document.querySelectorAll('[data-ci-source]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.ciSource === $('ci-source').value));});
    $('ci-library').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.path === $('ci-existing').value)));
    $('ci-upload-row').hidden = !upload; $('ci-existing-row').hidden = upload;
    $('ci-syntax-preview').textContent = token() || captionError() || 'Choose an image to generate its syntax.';
    $('ci-form').querySelectorAll('input,select,button').forEach(control => { control.disabled = busy || loading; });
    $('ci-insert').disabled = busy || loading || !target || !token();
    $('ci-cancel').disabled = busy;
    $('ci-toggle').disabled = busy || loading || !eligible(desk.contentEditor());
    preview();
  }
  function renderExisting(preferred) {
    const select = $('ci-existing'), folder = $('ci-folder').value;
    select.replaceChildren(new Option('Choose an image…',''));
    for (const file of files.filter(file => file.slice(0,file.lastIndexOf('/')) === folder)) select.add(new Option(file.slice(file.lastIndexOf('/')+1),file));
    if (Array.from(select.options).some(option => option.value === preferred)) select.value = preferred;
    const library=$('ci-library'); library.replaceChildren();
    for(const option of Array.from(select.options).filter(option=>option.value)) {
      const button=document.createElement('button'); button.type='button'; button.className='ci-image-tile'; button.dataset.path=option.value; button.setAttribute('aria-label','Select '+option.textContent); button.setAttribute('aria-pressed',String(option.value===select.value));
      const image=document.createElement('img'); image.alt=''; image.loading='lazy'; image.src=window.SheriffDeskBackend.assetUrl(target.portal, option.value);
      const label=document.createElement('span'); label.textContent=option.textContent; button.append(image,label); button.addEventListener('click',()=>{select.value=option.value;status('');update();}); library.append(button);
    }
    $('ci-library-empty').hidden=select.options.length>1;
    update();
  }
  async function api(verb, portal, path, options) {
    const query = encodeURIComponent(portal) + (path ? '&' + encodeURIComponent(path) : '');
    const response = await fetch('/api/file?' + verb + '&' + query + (verb === 'upload' ? '&no_overwrite=1' : ''), options || {cache:'no-store'});
    let data; try { data = await response.json(); } catch (_) { throw Error('The file API returned an unreadable response.'); }
    if (!response.ok || data.ok === false) throw Error(data.stderr || 'Image request failed.');
    return data;
  }
  async function load(preferred) {
    if (!target) return false;
    const capture = target, current = ++request;
    const data = await api('list',capture.portal);
    if (current !== request || target !== capture || !same(desk.contentEditor(),capture)) return false;
    files = (data.files || []).filter(file => typeof file === 'string' && file.startsWith(root+'/') && extensions.has(file.split('.').pop().toLowerCase())).sort();
    const found = new Set([root,...(data.dirs || []).filter(folder => folder === root || folder.startsWith(root+'/'))]);
    files.forEach(file => { let folder = file.slice(0,file.lastIndexOf('/')); while (folder.startsWith(root)) { found.add(folder); const index=folder.lastIndexOf('/'); if(index<root.length)break; folder=folder.slice(0,index); } });
    folders = [...found].sort(); const select = $('ci-folder'); select.replaceChildren();
    folders.forEach(folder => select.add(new Option(folder,folder))); select.value = folders.includes(preferred) ? preferred : root;
    renderExisting(); return true;
  }
  async function open() {
    const editor = desk.contentEditor(); if (!eligible(editor) || busy) return;
    if (target) { close(); return; }
    window.dispatchEvent(new CustomEvent('sheriff:content-picker-open',{detail:{kind:'image'}}));
    target = {portal:editor.portal,path:editor.path,generation:editor.generation,start:editor.element.selectionStart,end:editor.element.selectionEnd};
    $('ci-source').value='existing'; $('ci-caption').value=''; $('ci-size').value='full'; $('ci-align').value='center';
    $('ci-file').value=''; $('ci-panel').hidden=false; $('ci-toggle').setAttribute('aria-expanded','true');
    files=[]; folders=[]; loading=true; $('ci-folder').replaceChildren(new Option(root,root)); $('ci-existing').replaceChildren(new Option('Choose an image…',''));
    status('Loading image folders…'); update();
    const capture=target;
    try { if(await load(savedFolder(capture.portal))) { status(''); document.querySelector('[data-ci-source=existing]').focus(); } }
    catch(error) { if(target===capture)status(error.message,true); }
    finally { if(target===capture){loading=false;update();} }
  }
  async function operation(task) {
    if (busy || loading || !target) return;
    if (context.locked) { status('Wait for the current save or build to finish.',true); return; }
    const capture=target, release=context.lock(); busy=true; update();
    try { await task(capture); }
    catch(error) { if(target===capture)status(error.message,true); else desk.notify(error.message); }
    finally { busy=false; release(); syncEditor(); if(target)update(); }
  }
  $('ci-form').addEventListener('submit',event=>{
    event.preventDefault(); if (!token()) return;
    operation(async capture=>{
      const path=selectedPath(), syntax=token(), upload=$('ci-source').value==='upload', folder=$('ci-folder').value;
      if(upload) {
        const file=$('ci-file').files[0], extension=file.name.split('.').pop().toLowerCase();
        if(!extensions.has(extension))throw Error('Choose a supported image file.');
        if(/[\\/\r\n]/.test(file.name))throw Error('The image filename must not contain a path.');
        status('Uploading image…');
        await api('upload',capture.portal,path,{method:'POST',body:file});
      }
      if(target!==capture || !same(desk.contentEditor(),capture)) { desk.notify(upload?'Image uploaded. The open page changed, so no syntax was inserted.':'The open page changed; choose the image again.'); return; }
      rememberFolder(folder);
      if(!desk.insertContentImage(syntax,capture))throw Error('The open page changed; choose the image again.');
      close(); desk.contentEditor().element.focus(); desk.notify(upload?'Image uploaded and inserted. Save & build when ready.':'Image syntax inserted.');
      if(upload) await desk.refreshFiles();
    });
  });
  $('ci-toggle').addEventListener('click',open);
  $('ci-cancel').addEventListener('click',()=>{if(!busy){close();desk.contentEditor().element.focus();}});
  document.querySelectorAll('[data-ci-source]').forEach(button=>button.addEventListener('click',()=>{$('ci-source').value=button.dataset.ciSource;status('');update();}));
  window.addEventListener('sheriff:content-picker-open',event=>{if(event.detail.kind!=='image'&&!busy)close();});
  $('ci-source').addEventListener('change',()=>{status('');update();});
  $('ci-folder').addEventListener('change',()=>{status('');rememberFolder($('ci-folder').value);renderExisting();});
  for(const id of ['ci-file','ci-existing','ci-size','ci-align','ci-caption'])$(id).addEventListener(id==='ci-caption'?'input':'change',()=>{status('');update();});
  $('ci-newfolder').addEventListener('click',()=>{ $('ci-newfolder-row').hidden=false; $('ci-folder-name').value=''; $('ci-folder-name').focus(); });
  $('ci-cancel-folder').addEventListener('click',()=>{$('ci-newfolder-row').hidden=true;status('');});
  $('ci-folder-name').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('ci-create-folder').click();}});
  $('ci-create-folder').addEventListener('click',()=>{
    const name=$('ci-folder-name').value.trim();
    if(!name || name==='.' || name==='..' || /[\\/:*?"<>|\r\n]/.test(name) || /[. ]$/.test(name)){status('Use a folder name without slashes, trailing dots, or reserved filename characters.',true);return;}
    const path=$('ci-folder').value+'/'+name;
    operation(async capture=>{status('Creating folder…');await api('mkdir',capture.portal,path,{method:'POST'});if(target!==capture)return;if(await load(path)){rememberFolder(path);$('ci-newfolder-row').hidden=true;status('Folder created.');}await desk.refreshFiles();});
  });
  $('ci-preview-image').addEventListener('error',()=>{$('ci-preview-image').hidden=true;$('ci-preview-placeholder').hidden=false;$('ci-preview-placeholder').textContent='Preview unavailable. Existing images may need a site build first.';});
  $('ci-preview-image').addEventListener('load',()=>{$('ci-preview-image').hidden=false;$('ci-preview-placeholder').hidden=true;});
  const text=desk.contentEditor().element;
  for(const event of ['click','keyup','select','input'])text.addEventListener(event,()=>{if(target&&same(desk.contentEditor(),target)){target.start=text.selectionStart;target.end=text.selectionEnd;}});
  window.addEventListener('sheriff:editor-change',syncEditor);
  context.subscribe(()=>{close();syncEditor();});
  window.addEventListener('hashchange',()=>{if(location.hash!=='#content'&&!busy)close();});
  window.SheriffContentImages={isBusy:()=>busy}; syncEditor();
}());
