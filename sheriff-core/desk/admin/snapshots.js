// Portal source save points. Shared portal selection comes from portal-context.js.
(function () {
  'use strict';
  const fetch = (...args) => window.SheriffDeskBackend.fetch(...args);
  const context = window.SheriffPortalContext;
  const $ = id => document.getElementById(id);
  const dialog = $('ss-dialog');
  let sources = [], catalog = [], rows = [], busy = '', loading = 0, entering = 0, modal = null;
  const archived = portal => !!portal && catalog.includes(portal) && !sources.includes(portal);
  const visible = () => location.hash === '#snapshots';
  const pending = () => window.SheriffDesk ? window.SheriffDesk.unsavedPanels() : [];
  function status(message, error) { $('ss-status').textContent = message || ''; $('ss-status').classList.toggle('err', !!error); }
  function size(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(1) + ' GB';
  }
  function date(value) { const time = new Date(value); return Number.isNaN(time.getTime()) ? value : time.toLocaleString(); }
  function name(row) { return row.name || 'Snapshot'; }
  function controls() {
    const unavailable = !context.current || archived(context.current) || !!busy;
    $('ss-create').disabled = unavailable; $('ss-first').disabled = unavailable;
    $('ss-refresh').disabled = !!busy;
    $('ss-rows').querySelectorAll('button').forEach(button => { button.disabled = !!busy; });
    $('ss-archived').hidden = !archived(context.current);
  }
  function render() {
    $('ss-rows').replaceChildren();
    for (const row of rows) {
      const tr = document.createElement('tr'); tr.dataset.snapshot = row.id;
      const label = document.createElement('td'); label.className = 'snapshot-name'; label.textContent = name(row);
      const timestamp = document.createElement('td'); timestamp.className = 'snapshot-date'; timestamp.textContent = date(row.created_at);
      const bytes = document.createElement('td'); bytes.className = 'snapshot-size'; bytes.textContent = size(row.bytes);
      const actions = document.createElement('td'), buttons = document.createElement('div'); buttons.className = 'snapshot-row-actions';
      for (const [text, handler] of [['Download', download], ['Restore', restoreDialog], ['Delete', deleteDialog]]) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'btn small' + (text === 'Delete' ? ' delete' : '');
        button.textContent = text; button.addEventListener('click', () => handler(row)); buttons.append(button);
      }
      actions.append(buttons); tr.append(label, timestamp, bytes, actions); $('ss-rows').append(tr);
    }
    $('ss-table').hidden = !rows.length; $('ss-empty').hidden = !!rows.length;
    $('ss-empty').querySelector('p').textContent = context.current ? 'Save your first snapshot of this portal.' : 'Create a portal to save your first snapshot.';
    $('ss-total').textContent = rows.length + (rows.length === 1 ? ' snapshot' : ' snapshots') + ' · ' + size(rows.reduce((total, row) => total + row.bytes, 0));
    controls();
  }
  async function api(verb, portal, id, body) {
    let query = verb;
    if (portal) query += '&portal=' + encodeURIComponent(portal);
    if (id) query += '&id=' + encodeURIComponent(id);
    const mutate = ['create', 'restore', 'delete'].includes(verb);
    const response = await fetch('/api/snapshots?' + query, mutate ? {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body || {})} : {cache:'no-store'});
    let data;
    try { data = await response.json(); } catch (_) { throw new Error('The snapshot API returned an unreadable response.'); }
    if (!response.ok || data.ok === false) throw new Error(data.stderr || 'Snapshot request failed (HTTP ' + response.status + ').');
    return data;
  }
  function setSourcePortals(names, preferred) {
    sources = names.slice();
    context.setPortals([...sources, ...catalog], {preferred:preferred || context.current});
    catalog.filter(archived).forEach(portal => context.setMetadata(portal, {name:portal + ' (snapshot only)'}));
    controls();
  }
  async function refreshCatalog() {
    const data = await api('list'); catalog = Array.isArray(data.portals) ? data.portals : [];
    setSourcePortals(sources);
  }
  async function loadRows() {
    const request = ++loading, portal = context.current, revision = context.revision;
    rows = []; render();
    if (!portal) return;
    status('Loading snapshots…');
    try {
      const data = await api('list', portal);
      if (request !== loading || portal !== context.current || revision !== context.revision) return;
      rows = (data.snapshots || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      render(); status('');
    } catch (error) { if (request === loading && portal === context.current && revision === context.revision) status(error.message, true); }
  }
  async function enter(names) {
    const request = ++entering;
    if (Array.isArray(names)) setSourcePortals(names);
    if (busy) return;
    try { await refreshCatalog(); if (request === entering) await loadRows(); }
    catch (error) { if (request === entering) status(error.message, true); }
  }
  function closeDialog() { modal = null; if (dialog.open) dialog.close(); }
  function paragraph(text) { const p = document.createElement('p'); p.textContent = text; $('ss-dialog-body').append(p); }
  function openDialog(title, button, action, row) {
    if (busy || !context.current) return false;
    if (context.locked) { status('Wait for the current save or build to finish.', true); return false; }
    modal = {portal:context.current, action, row};
    $('ss-dialog-title').textContent = title; $('ss-confirm').textContent = button;
    $('ss-confirm').className = 'btn ' + (action === 'delete' ? 'danger' : 'primary');
    $('ss-dialog-body').replaceChildren();
    if (row) {
      const selected = document.createElement('div'); selected.className = 'selected-snapshot';
      const title = document.createElement('strong'); title.textContent = name(row);
      const detail = document.createElement('small'); detail.textContent = date(row.created_at) + ' · ' + size(row.bytes);
      selected.append(title, detail); $('ss-dialog-body').append(selected);
    }
    return true;
  }
  function createDialog() {
    if (archived(context.current) || !openDialog('Save snapshot', 'Save snapshot', 'create')) return;
    paragraph('Save all files currently on disk for ' + context.current + '.');
    const label = document.createElement('label'); label.htmlFor = 'ss-name'; label.textContent = 'Name (optional)';
    const input = document.createElement('input'); input.id = 'ss-name'; input.type = 'text'; input.maxLength = 160; input.placeholder = 'Before trying a new module';
    $('ss-dialog-body').append(label, input);
    const dirty = pending();
    paragraph(dirty.length ? 'Unsaved edits in ' + dirty.join(', ') + ' are not included. Save those edits first if you want them in this snapshot.' : 'The date and time are recorded automatically.');
    dialog.showModal(); input.focus();
  }
  function restoreDialog(row) {
    if (!openDialog('Restore snapshot?', 'Restore and rebuild', 'restore', row)) return;
    paragraph('Replace all source files in ' + context.current + ' with this snapshot, then rebuild the site. Changes made since this save point will be removed.');
    const dirty = pending(); if (dirty.length) paragraph('Unsaved edits in ' + dirty.join(', ') + ' will also be discarded.');
    dialog.showModal(); $('ss-cancel').focus();
  }
  function deleteDialog(row) {
    if (!openDialog('Delete snapshot?', 'Delete snapshot', 'delete', row)) return;
    paragraph('Permanently delete this saved ZIP for ' + context.current + '? Your current portal files will stay as they are.');
    dialog.showModal(); $('ss-cancel').focus();
  }
  async function operation(kind, portal, task) {
    if (busy || portal !== context.current) return;
    if (context.locked) { status('Wait for the current save or build to finish.', true); return; }
    busy = kind; const release = context.lock(); controls();
    try { await task(); } catch (error) { status(error.message, true); }
    finally { busy = ''; release(); controls(); }
  }
  async function download(row) {
    const portal = context.current;
    await operation('download', portal, async () => {
      status('Preparing ZIP download…');
      const data = await api('download', portal, row.id), binary = atob(data.zip_base64);
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], {type:'application/zip'}));
      const link = document.createElement('a'); link.href = url; link.download = data.filename; document.body.append(link);
      link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      status('ZIP download started.');
    });
  }
  async function restore(portal, row) {
    status('Restoring source files…'); $('ss-build-log').hidden = true; $('ss-build-output').textContent = '';
    const result = await api('restore', portal, row.id);
    // From this point the source was replaced successfully, even if a refresh or build fails.
    let refreshWarning = '';
    try {
      await window.SheriffDesk.portalRestored(portal);
      sources = window.SheriffDesk.portals();
    } catch (error) { refreshWarning = ' Desk refresh failed: ' + error.message; }
    status('Source restored. Rebuilding ' + portal + '…');
    let message, failed = false;
    try {
      const response = await window.SheriffBuildLog.fetch('/api/build?' + encodeURIComponent(portal));
      const build = await response.json();
      failed = !response.ok || build.ok === false || (build.code !== undefined && build.code !== null && build.code !== 0);
      message = failed ? 'Snapshot restored, but the rebuild failed.' : 'Snapshot restored and site rebuilt.';
      $('ss-build-output').textContent = [build.stdout, build.stderr].filter(Boolean).join('\n') || (failed ? 'The build API reported a failure.' : 'Build completed.');
    } catch (error) { failed = true; message = 'Snapshot restored, but the rebuild could not finish.'; $('ss-build-output').textContent = error.message; }
    $('ss-build-log').hidden = false; $('ss-build-log').open = failed;
    try { await refreshCatalog(); await loadRows(); } catch (error) { refreshWarning += ' Snapshot list refresh failed: ' + error.message; }
    status(message + (result.warning ? ' ' + result.warning : '') + refreshWarning, failed || !!refreshWarning);
  }
  $('ss-form').addEventListener('submit', async event => {
    event.preventDefault(); if (!modal) return;
    const selected = modal, label = $('ss-name') ? $('ss-name').value.trim() : '';
    closeDialog();
    await operation(selected.action, selected.portal, async () => {
      if (selected.action === 'restore') { await restore(selected.portal, selected.row); return; }
      status(selected.action === 'create' ? 'Saving snapshot…' : 'Deleting snapshot…');
      await api(selected.action, selected.portal, selected.row && selected.row.id, {name:label});
      const message = selected.action === 'create' ? 'Snapshot saved.' : 'Snapshot deleted.';
      try { await refreshCatalog(); await loadRows(); status(message); }
      catch (error) { status(message + ' List refresh failed: ' + error.message, true); }
    });
  });
  $('ss-create').addEventListener('click', createDialog); $('ss-first').addEventListener('click', createDialog);
  $('ss-cancel').addEventListener('click', closeDialog); dialog.addEventListener('cancel', () => { modal = null; });
  $('ss-refresh').addEventListener('click', () => enter(sources));
  context.subscribe(() => {
    closeDialog(); ++loading; rows = []; render(); status(''); $('ss-build-log').hidden = true;
    if (visible() && !busy) loadRows();
  });
  window.addEventListener('hashchange', () => { if (!visible()) closeDialog(); });
  window.SheriffSnapshots = {enter, setSourcePortals, isArchived:archived, isBlocking:() => busy === 'create' || busy === 'restore'};
  if (visible()) enter(window.SheriffDesk ? window.SheriffDesk.portals() : context.portals);
}());
