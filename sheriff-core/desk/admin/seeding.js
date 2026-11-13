// Explicit portal seeding. The same Trailboss Wiki module serves local and Cloud.
(function () {
  'use strict';
  const $ = id => document.getElementById('seed-' + id);
  const dialog = $('dialog'), source = $('source'), context = window.SheriffPortalContext;
  let portal = '', release = null, busy = false, saved = '', preview = '', report = null;
  const buttons = ['close', 'example', 'save', 'preview', 'upload'];
  function state(working) {
    busy = working;
    $('comment-note').hidden = !source.value.trim() || source.value.split(/\r?\n/).some(line => line.trim() && !line.trim().startsWith('#'));
    for (const id of buttons) $(id).disabled = working;
    source.disabled = working;
    $('create').disabled = working || !report?.ok || report.conflicts > 0 || !report.creates || preview !== source.value || report.created > 0;
  }
  function status(message, failed = false) { $('status').textContent = message; $('status').classList.toggle('seed-error', failed); }
  function invalidate() {
    preview = ''; report = null; $('results').hidden = true; $('report').hidden = true;
    $('saved').textContent = source.value === saved ? 'Saved' : 'Unsaved plan';
    status('Preview your plan before creating pages.'); state(false);
  }
  async function request(verb) {
    const response = await window.SheriffDeskBackend.request('seed.' + verb, {portal}, {method:'POST', body:source.value, headers:{'Content-Type':'text/plain; charset=utf-8'}});
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      if (data.entries) render(data);
      throw Error((data.created ? `Created ${data.created} articles before the error. ` : '') + (data.stderr || 'The seed operation failed.'));
    }
    return data;
  }
  function render(data) {
    report = data; const rows = $('rows'); rows.replaceChildren();
    for (const entry of data.entries || []) {
      const row = document.createElement('tr'), title = document.createElement('td'), cats = document.createElement('td'), result = document.createElement('td');
      const name = document.createElement('strong'), path = document.createElement('code'), badge = document.createElement('span'), reason = document.createElement('small');
      name.textContent = entry.title; path.textContent = entry.path; title.append(name, path);
      cats.textContent = (entry.categories || []).join(', '); badge.className = 'seed-badge'; badge.dataset.status = entry.status;
      badge.textContent = ({create:'Will create',created:'Created',skip:'Skipped',conflict:'Conflict',failed:'Failed'})[entry.status] || entry.status;
      reason.textContent = entry.reason || ''; result.append(badge, reason); row.append(title, cats, result); rows.append(row);
    }
    $('results').hidden = !data.entries?.length; $('report').hidden = false;
    if (data.saved) {
      saved = source.value; $('saved').textContent = 'Saved';
      status(`Created ${data.created} articles · Skipped ${data.skips} existing articles. Review them in Content, then use Build portal when ready.`);
    } else if (!data.entries?.length) {
      status('No active pages are listed. Remove # from the example seed entries, or replace it with your own plan.');
    } else {
      status(`${data.creates} to create · ${data.skips} to skip · ${data.conflicts} conflicts.`, data.conflicts > 0);
    }
  }
  async function action(verb) {
    if (busy || (verb === 'create' && (preview !== source.value || !report?.ok || report.conflicts || !report.creates))) return;
    state(true); status(verb === 'create' ? 'Creating source files…' : verb === 'preview' ? 'Checking articles and categories…' : 'Saving seeder.yall…');
    try {
      const data = await request(verb);
      if (verb === 'save') { saved = source.value; $('saved').textContent = 'Saved'; status('Saved seeder.yall. No pages were created and no build ran.'); }
      else { preview = source.value; render(data); if (verb === 'create') preview = ''; }
    } catch (error) { status(error.message, true); preview = ''; }
    finally { state(false); }
  }
  async function open(name) {
    if (busy || dialog.open || !context.select(name)) return;
    portal = name; release = context.lock(); saved = ''; preview = ''; report = null;
    $('portal').textContent = name; source.value = ''; $('saved').textContent = ''; $('results').hidden = true; $('report').hidden = true;
    dialog.showModal(); state(true); status('Loading seeder.yall…');
    try { const data = await request('load'); source.value = data.source; saved = data.exists ? data.source : ''; $('saved').textContent = data.exists ? 'Saved' : 'Example · not saved'; status('Preview your plan before creating pages.'); }
    catch (error) { status(error.message, true); }
    finally { state(false); source.focus({preventScroll:true}); }
  }
  function close() {
    if (busy) return;
    if (source.value !== saved && source.value.trim() && !confirm('Close without saving your changes to seeder.yall?')) return;
    dialog.close();
    if (release) release(); release = null;
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => { if (release) release(); release = null; });
  $('close').addEventListener('click', close);
  source.addEventListener('input', invalidate);
  for (const verb of ['save', 'preview', 'create']) $(verb).addEventListener('click', () => action(verb));
  $('example').addEventListener('click', async () => {
    if (busy) return;
    if (source.value !== saved && source.value.trim() && !confirm('Replace the unsaved editor contents with the example?')) return;
    state(true);
    try { source.value = (await request('example')).source; invalidate(); }
    catch (error) { status(error.message, true); }
    finally { state(false); }
  });
  $('upload').addEventListener('change', async () => {
    const file = $('upload').files[0]; $('upload').value = ''; if (!file) return;
    if (!file.name.toLowerCase().endsWith('.yall') || file.size > 524288) { status('Choose a .yall file of at most 512 KB.', true); return; }
    state(true);
    try { source.value = await file.text(); invalidate(); }
    catch (error) { status(error.message, true); }
    finally { state(false); }
  });
  $('report').addEventListener('click', () => {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], {type:'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = portal + '-seeding-report.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  window.SheriffSeeding = {open};
}());
