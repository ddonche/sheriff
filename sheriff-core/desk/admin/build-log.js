// One source of build output for Desk's page, portal, and dashboard views.
(function () {
  'use strict';
  const context = window.SheriffPortalContext, latest = new Map();
  const panels = Array.from(document.querySelectorAll('[data-build-log]'));
  const dashboard = document.getElementById('build-log');
  const editor = document.getElementById('ed-tab-editor'), log = document.getElementById('ed-tab-log');
  let selectedPortal = context.current, lastJob = null, batch = null, lastBatch = null;
  function showTab(which, focus) {
    const isLog = which === 'log';
    editor.setAttribute('aria-selected', String(!isLog)); log.setAttribute('aria-selected', String(isLog));
    editor.tabIndex = isLog ? -1 : 0; log.tabIndex = isLog ? 0 : -1;
    document.getElementById('ed-editor-panel').hidden = isLog;
    document.getElementById('ed-log-panel').hidden = !isLog;
    if (focus) (isLog ? log : editor).focus();
  }
  editor.addEventListener('click', () => showTab('editor'));
  log.addEventListener('click', () => showTab('log'));
  for (const button of [editor, log]) button.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    showTab(event.key === 'Home' ? 'editor' : event.key === 'End' ? 'log' : button === editor ? 'log' : 'editor', true);
  });
  function text(job) {
    if (!job) return '';
    const heading = (job.state === 'running' ? 'BUILDING' : job.state === 'success' ? 'BUILD SUCCESS' : 'BUILD FAILED') + ' — ' + job.portal;
    const lines = [heading, '='.repeat(40)];
    if (job.state === 'running') lines.push('Building…');
    else lines.push('Exit code: ' + (job.code === undefined || job.code === null ? 'unavailable' : job.code) + ' · Duration: ' + ((job.ended-job.started)/1000).toFixed(2) + 's');
    if (job.stdout) lines.push('', job.stdout);
    if (job.stderr) lines.push('', job.stderr);
    if (job.state !== 'running' && !job.stdout && !job.stderr) lines.push('', 'No output returned.');
    return lines.join('\n');
  }
  function setOutput(element, value) {
    if (element.textContent !== value) { element.textContent = value; element.scrollTop = 0; }
  }
  function render() {
    for (const panel of panels) {
      const portal = panel.dataset.buildLog === 'content' ? context.current : selectedPortal || context.current;
      const job = latest.get(portal);
      panel.dataset.state = job ? job.state : 'idle';
      panel.querySelector('[data-build-title]').textContent = job ? job.label + ' · ' + job.portal : 'Build log' + (portal ? ' · ' + portal : '');
      panel.querySelector('[data-build-status]').textContent = job ? job.state === 'running' ? 'Building…' : job.state === 'success' ? 'Success · ' + ((job.ended-job.started)/1000).toFixed(2) + 's' : 'Failed · ' + ((job.ended-job.started)/1000).toFixed(2) + 's' : 'Idle';
      panel.querySelector('[data-build-copy]').disabled = !job;
      setOutput(panel.querySelector('[data-build-output]'), text(job) || 'Build ' + (portal || 'a portal') + ' to see its output here.');
    }
    const current = latest.get(context.current), dot = document.getElementById('ed-log-dot');
    dot.hidden = !current; dot.dataset.state = current ? current.state : 'idle';
    log.setAttribute('aria-label', 'Log' + (current ? ': ' + current.state : ''));
    if (dashboard) {
      const group = batch || lastBatch;
      dashboard.dataset.state = lastJob ? lastJob.state : 'idle';
      setOutput(dashboard, group ? [group.label, ...group.jobs.map(text)].join('\n\n') : text(lastJob) || 'Build status: idle');
    }
  }
  for (const panel of panels) panel.querySelector('[data-build-copy]').addEventListener('click', async event => {
    const button = event.currentTarget, original = button.textContent;
    try { await navigator.clipboard.writeText(panel.querySelector('[data-build-output]').textContent); button.textContent = 'Copied'; }
    catch (_) { button.textContent = 'Could not copy'; }
    setTimeout(() => { button.textContent = original; }, 1800);
  });
  function describe(input, options) {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin !== location.origin) return null;
    if (url.pathname === '/api/build') return {portal:decodeURIComponent(url.search.slice(1)),label:options?.deskOperation === 'portal.publish' ? 'Publish' : 'Portal build'};
    if (url.pathname !== '/api/file' || !/^\?write(?:&|$)/.test(url.search)) return null;
    const method = options && options.method || (typeof input !== 'string' && input.method) || 'GET';
    if (method.toUpperCase() !== 'POST') return null;
    const portal = url.searchParams.get('portal'), path = (url.searchParams.get('path') || '').replace(/\\/g, '/');
    const build = url.searchParams.get('build') || 'none';
    if (!portal || !path || build === 'none') return null;
    return {portal,label:(build === 'page' ? 'Page build · ' : 'Portal build · ') + path};
  }
  function record(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function envelope(value) { return record(value) && Object.hasOwn(value, 'body') && record(value.headers) && typeof value.status === 'number'; }
  function parse(value) { if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch (_) { return null; } }
  // Goblin may wrap a command's printed response in an HTTP-style envelope.
  // Decode only that known shape; arbitrary JSON and literal backslashes stay intact.
  function output(value) {
    let text = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value), failed = false;
    for (let depth = 0; depth < 8; depth++) {
      const wrapped = parse(text); if (!envelope(wrapped)) break;
      failed ||= wrapped.status >= 400;
      text = wrapped.body == null ? '' : typeof wrapped.body === 'string' ? wrapped.body : JSON.stringify(wrapped.body);
    }
    return {text, failed};
  }
  function normalize(data) {
    let transportFailed = false;
    for (let depth = 0; envelope(data) && depth < 8; depth++) {
      transportFailed ||= data.status >= 400;
      const inner = parse(data.body);
      if (record(inner) && (Object.hasOwn(inner, 'stdout') || Object.hasOwn(inner, 'code') || Object.hasOwn(inner, 'ok') || envelope(inner))) data = inner;
      else { data = {ok:!transportFailed, stdout:data.body}; break; }
    }
    const stdout = output(data.stdout), stderr = output(data.stderr);
    // Exit code and duration are already displayed in the log header.
    const errors = stderr.text.split(/\r?\n/).filter(line => !/^goblin run .+ → exit \d+ in \d+ms \([\d.]+s\)\s*$/.test(line)).join('\n').trim();
    const failed = transportFailed || stdout.failed || stderr.failed;
    return {...data, ...(failed ? {ok:false} : {}), stdout:stdout.text, stderr:errors};
  }
  async function buildFetch(input, options) {
    const info = describe(input, options);
    if (!info || !info.portal) return (window.SheriffDeskBackend ? window.SheriffDeskBackend.fetch(input, options) : window.fetch(input, options));
    const job = {...info,started:Date.now(),state:'running',stdout:'',stderr:''};
    latest.set(job.portal, job); lastJob = job; selectedPortal = job.portal;
    if (batch) batch.jobs.push(job); else lastBatch = null;
    if (location.hash === '#content' && job.portal === context.current) showTab('log');
    render();
    try {
      const response = options?.deskOperation ? await window.SheriffDeskBackend.request(options.deskOperation, {portal:info.portal}) : await (window.SheriffDeskBackend ? window.SheriffDeskBackend.fetch(input, options) : window.fetch(input, options));
      let data;
      try { data = JSON.parse(await response.clone().text()); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid build result'); }
      catch (_) { data = {ok:false,code:null,stdout:'',stderr:'The build API returned an unreadable response (HTTP ' + response.status + ').'}; }
      if (data) {
        data = normalize(data);
        if (!response.ok) data.ok = false;
        job.code = data.code;
        job.stdout = data.stdout == null ? '' : String(data.stdout);
        job.stderr = data.stderr == null ? '' : String(data.stderr);
        job.state = !response.ok || data.ok === false || (data.code !== undefined && data.code !== null && data.code !== 0) ? 'failed' : 'success';
      }
      // Consumers (page saving, portal builds, restores) receive the same clean result.
      const headers = new Headers(response.headers); headers.delete('content-length'); headers.delete('content-encoding'); headers.set('content-type', 'application/json');
      return new Response(JSON.stringify(data), {status:response.status, statusText:response.statusText, headers});
    } catch (error) { job.state = 'failed'; job.stderr = error.message || 'The build API could not be reached.'; throw error; }
    finally { job.ended = Date.now(); render(); }
  }
  context.subscribe(portal => { selectedPortal = portal; showTab('editor'); render(); });
  window.SheriffBuildLog = {
    fetch:buildFetch, publish:portal => buildFetch('/api/build?' + encodeURIComponent(portal), {deskOperation:'portal.publish'}), showEditor:() => showTab('editor'),
    startBatch(label) { batch = {label,jobs:[]}; lastBatch = null; render(); },
    endBatch() { lastBatch = batch; batch = null; render(); }
  };
  render();
}());
