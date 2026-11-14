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
  const seconds = ms => (ms/1000).toFixed(2) + 's';
  function duration(data, total) {
    const parts = [];
    if (Number.isFinite(data.build_ms)) parts.push('Build: ' + seconds(data.build_ms));
    if (Number.isFinite(data.upload_ms)) parts.push('R2 upload: ' + seconds(data.upload_ms));
    return parts.join(' · ') || 'Total: ' + seconds(total);
  }
  function phaseStatus(job) {
    if (job.state !== 'running') return (job.state === 'success' ? 'Success' : Number.isFinite(job.upload_ms) ? 'Upload failed' : 'Failed') + ' · ' + duration(job,job.ended-job.started);
    return job.phase === 'uploading' ? 'Build: ' + seconds(job.build_ms) + ' · Uploading to R2…' : job.phase === 'queued' ? 'Waiting to build…' : 'Building…';
  }
  function text(job) {
    if (!job) return '';
    const heading = (job.state === 'running' ? job.phase === 'uploading' ? 'UPLOADING' : 'BUILDING' : job.state === 'success' ? 'BUILD SUCCESS' : Number.isFinite(job.upload_ms) ? 'UPLOAD FAILED' : 'BUILD FAILED') + ' — ' + job.portal;
    const lines = [heading, '='.repeat(40)];
    if (job.state === 'running' && job.phase !== 'uploading') lines.push(phaseStatus(job));
    else if (job.state !== 'running') lines.push('Exit code: ' + (job.code ?? 'unavailable') + ' · ' + duration(job,job.ended-job.started), 'Total elapsed: ' + seconds(job.ended-job.started));
    if (Object.hasOwn(job,'build_stdout')) {
      if (job.build_stdout) lines.push('',job.build_stdout);
      if (job.build_stderr) lines.push('',job.build_stderr);
      if (Number.isFinite(job.build_ms) && Number.isFinite(job.build_code)) lines.push('',(job.build_code === 0 ? 'BUILD SUCCESS' : 'BUILD FAILED') + ' · Sheriff: ' + seconds(job.build_ms));
      if (job.phase === 'uploading' || Number.isFinite(job.upload_ms)) {
        lines.push('Uploading to R2…');
        if (job.upload_stdout) lines.push(job.upload_stdout);
        if (job.upload_stderr) lines.push(job.upload_stderr);
        if (Number.isFinite(job.upload_ms)) lines.push((job.published ? 'UPLOAD SUCCESS' : 'UPLOAD FAILED') + ' · R2 upload: ' + seconds(job.upload_ms));
      }
    } else {
      if (job.stdout) lines.push('',job.stdout);
      if (job.stderr) lines.push('',job.stderr);
    }
    if (job.request_error) lines.push('',job.request_error);
    if (job.state !== 'running' && !job.stdout && !job.stderr) lines.push('', 'No output returned.');
    return lines.join('\n');
  }
  function setOutput(element, value) {
    if (element.textContent !== value) { const follow=element.scrollHeight-element.clientHeight-element.scrollTop<40,top=element.scrollTop; element.textContent = value; element.scrollTop = follow ? element.scrollHeight : top; }
  }
  function render() {
    for (const panel of panels) {
      const portal = panel.dataset.buildLog === 'content' ? context.current : selectedPortal || context.current;
      const job = latest.get(portal);
      panel.dataset.state = job ? job.state : 'idle';
      panel.querySelector('[data-build-title]').textContent = job ? job.label + ' · ' + job.portal : 'Build log' + (portal ? ' · ' + portal : '');
      panel.querySelector('[data-build-status]').textContent = job ? phaseStatus(job) : 'Idle';
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
    // The runtime footer measures Sheriff, unlike the browser's whole-request timer.
    const footer = stderr.text.match(/goblin run .+ → exit \d+ in (\d+)ms \([\d.]+s\)/);
    if (!Number.isFinite(data.build_ms) && footer) data.build_ms = Number(footer[1]);
    const cleanError = value => output(value).text.split(/\r?\n/).filter(line => !/^goblin run .+ → exit \d+ in \d+ms \([\d.]+s\)\s*$/.test(line)).join('\n').trim();
    const phases = Object.hasOwn(data,'build_stdout') ? {build_stdout:output(data.build_stdout).text,build_stderr:cleanError(data.build_stderr),upload_stdout:output(data.upload_stdout).text,upload_stderr:cleanError(data.upload_stderr)} : {};

    const errors = stderr.text.split(/\r?\n/).filter(line => !/^goblin run .+ → exit \d+ in \d+ms \([\d.]+s\)\s*$/.test(line)).join('\n').trim();
    const failed = transportFailed || stdout.failed || stderr.failed;
    return {...data, ...phases, ...(failed ? {ok:false} : {}), stdout:stdout.text, stderr:errors};
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
      const headers = new Headers(options?.headers);
      headers.set('Accept','application/x-ndjson');
      const requestOptions = {...options,headers};
      const response = options?.deskOperation ? await window.SheriffDeskBackend.request(options.deskOperation, {portal:info.portal}, requestOptions) : await (window.SheriffDeskBackend ? window.SheriffDeskBackend.fetch(input, requestOptions) : window.fetch(input, requestOptions));
      let data;
      try {
        if ((response.headers.get('content-type') || '').includes('application/x-ndjson')) {
          const reader = response.body.getReader(), decoder = new TextDecoder();
          let pending = '', final = false;
          function event(line) {
            if (!line.trim()) return;
            const update = JSON.parse(line);
            if (typeof options?.onProgress === 'function') options.onProgress(update);
            if (update.stream && typeof update.chunk === 'string') {
              if(!Object.hasOwn(job,'build_stdout'))job.build_stdout='';
              const key=(update.phase === 'uploading' ? 'upload_' : 'build_') + (update.stream === 'stderr' ? 'stderr' : 'stdout');
              job.phase=update.phase;job[key]=(job[key]||'')+update.chunk;render();
            }
            else if (update.phase === 'result') { data = update; final = true; }
            else { Object.assign(job,normalize(update)); render(); }
          }
          for (;;) {
            const {value,done} = await reader.read();
            pending += decoder.decode(value,{stream:!done});
            const lines = pending.split('\n'); pending = lines.pop();
            lines.forEach(event);
            if (done) break;
          }
          event(pending);
          if (!final) throw Error('Incomplete build response');
        } else data = JSON.parse(await response.clone().text()); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid build result'); }
      catch (_) { data = {ok:false,code:null,stdout:'',stderr:'The build API returned an unreadable response (HTTP ' + response.status + ').'}; }
      if (data) {
        data = normalize(data);
        if (!response.ok) data.ok = false;
        if (Object.hasOwn(job,'build_stdout') && !Object.hasOwn(data,'build_stdout') && data.ok === false) job.request_error = data.stderr;
        Object.assign(job,data);
        job.code = data.code;
        job.stdout = data.stdout == null ? '' : String(data.stdout);
        job.stderr = data.stderr == null ? '' : String(data.stderr);
        job.state = !response.ok || data.ok === false || (data.code !== undefined && data.code !== null && data.code !== 0) ? 'failed' : 'success';
      }
      // Consumers (page saving, portal builds, restores) receive the same clean result.
      const resultHeaders = new Headers(response.headers); resultHeaders.delete('content-length'); resultHeaders.delete('content-encoding'); resultHeaders.set('content-type', 'application/json');
      return new Response(JSON.stringify(data), {status:response.status, statusText:response.statusText, headers:resultHeaders});
    } catch (error) { job.state = 'failed'; job.stderr = error.message || 'The build API could not be reached.'; job.request_error = job.stderr; throw error; }
    finally { job.ended = Date.now(); render(); }
  }
  context.subscribe(portal => { selectedPortal = portal; showTab('editor'); render(); });
  window.SheriffBuildLog = {
    duration, fetch:buildFetch, publish:portal => buildFetch('/api/build?' + encodeURIComponent(portal), {deskOperation:'portal.publish'}), showEditor:() => showTab('editor'),
    startBatch(label) { batch = {label,jobs:[]}; lastBatch = null; render(); },
    endBatch() { lastBatch = batch; batch = null; render(); }
  };
  render();
}());
