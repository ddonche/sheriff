// Sheriff Desk — admin panel script (v0.2)
// Single-page: sidebar switches views via location.hash.
// Live: portal list, per-portal + build-all, Pages editor (list/read/write).

(function () {
  'use strict';

  const PORT = location.port || '5173';

  // One navigation rail for every Desk workspace; labels remain accessible.
  const deskShell=document.querySelector('.shell'),sidebarToggle=document.getElementById('desk-sidebar-toggle');
  const sidebarIcons={"open":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-panel-left-open\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" />\n  <path d=\"M9 3v18\" />\n  <path d=\"m14 9 3 3-3 3\" />\n</svg>","close":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-panel-left-close\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" />\n  <path d=\"M9 3v18\" />\n  <path d=\"m16 15-3-3 3-3\" />\n</svg>"};
  for(const link of document.querySelectorAll('#desk-navigation a[data-view]')){
    const name=link.textContent.trim();link.setAttribute('aria-label',name);link.title=name;
    for(const node of Array.from(link.childNodes))if(node.nodeType===Node.TEXT_NODE&&node.textContent.trim()){const label=document.createElement('span');label.className='nav-copy';label.textContent=node.textContent.trim();node.replaceWith(label);}
  }
  function setSidebarCollapsed(collapsed){
    deskShell.classList.toggle('sidebar-collapsed',collapsed);sidebarToggle.innerHTML=sidebarIcons[collapsed?'open':'close'];
    sidebarToggle.setAttribute('aria-expanded',String(!collapsed));sidebarToggle.title=collapsed?'Expand navigation':'Collapse navigation';sidebarToggle.setAttribute('aria-label',sidebarToggle.title);
    try{localStorage.setItem('desk.sidebarCollapsed',String(collapsed));}catch{}
  }
  let sidebarCollapsed=false;try{sidebarCollapsed=localStorage.getItem('desk.sidebarCollapsed')==='true';}catch{}
  setSidebarCollapsed(sidebarCollapsed);sidebarToggle.addEventListener('click',()=>setSidebarCollapsed(!deskShell.classList.contains('sidebar-collapsed')));

  const portalContext = window.SheriffPortalContext;

  // Keep the portal stable until a mutating API response has finished arriving.
  async function fetch(input, options) {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const mutation = /^\/api\/(build|ensure_theme|portal)(?:$|\?)/.test(url.pathname + url.search)
      || (url.pathname === '/api/file' && /^\?(write|delete|move|upload|mkdir)(?:&|$)/.test(url.search));
    const release = mutation ? portalContext.lock() : null;
    try {
      const response = await window.SheriffBuildLog.fetch(input, options);
      if (release) await response.clone().arrayBuffer();
      return response;
    } finally { if (release) release(); }
  }

  const identityRequests = new Map();
  async function loadPortalIdentity(portal) {
    if (!portal) return;
    const request = (identityRequests.get(portal) || 0) + 1;
    identityRequests.set(portal, request);
    try {
      const response = await fetch('/api/file?read&portal=' + encodeURIComponent(portal) + '&path=config.yall', {cache:'no-store'});
      const data = await apiJson(response);
      if (identityRequests.get(portal) !== request || data.ok === false) return;
      const text = String(data.content || '');
      const scalar = value => String(value || '').trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_, a, b) => a === undefined ? b : a);
      const name = text.match(/^name:\s*(.+)$/m);
      const theme = text.match(/^theme:[ \t]*\r?\n((?:[ \t]+[^\n]*\n|[ \t]*\n)*)/m);
      const logo = theme && theme[1].match(/^[ \t]+logo:[ \t]*(.+)$/m);
      let path = scalar(logo && logo[1]) || 'logo.png';
      path = path.replace(/^\/?public\//, '').replace(/^\/+/, '');
      if (path.includes('..') || /[\\:]/.test(path)) path = 'logo.png';
      const url = new URL(window.SheriffDeskBackend.assetUrl(portal, 'public/' + path), location.href);
      portalContext.setMetadata(portal, {name:scalar(name && name[1]) || portal, logo:url.href});
    } catch (_) { /* The shared picker keeps a readable name/initials fallback. */ }
  }

  function isCurrentPortal(portal, revision) {
    return portalContext.current === portal && portalContext.revision === revision;
  }

  // ---------- toast ----------
  const toast = document.getElementById('toast');
  let toastTimer;

  function say(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  async function apiJson(res) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('API returned non-JSON (HTTP ' + res.status + '):', text.slice(0, 800));
      const snippet = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
      throw new Error('HTTP ' + res.status + ': ' + (snippet || 'empty response'));
    }
  }

  function wireDead(root) {
    root.querySelectorAll('[data-dead]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        say('Not wired up yet');
      });
    });
  }
  wireDead(document);

  // ---------- view router ----------
  const VIEWS = {
    dashboard:  { el: 'view-dashboard' },
    content:    { el: 'view-content' },
    portals:    { el: 'view-portals' },
    media:      { el: 'view-media' },
    interactive:{ el: 'view-interactive' },
    patterns:   { el: 'view-patterns' },
    icons:      { el: 'view-icons' },
    navigation: { el: 'view-navigation' },
    themes:     { el: 'view-themes' },
    config:     { el: 'view-config' },
    modules:    { el: 'view-modules' },
    snapshots:  { el: 'view-snapshots' },
    settings:   { el: 'view-settings' }
  };

  const hosted = window.SheriffDeskBackend.mode === 'cloud';
  document.getElementById('settings-cloud').hidden = hosted;
  document.getElementById('settings-hosted-note').hidden = !hosted;
  document.getElementById('settings-account').addEventListener('click', () => document.getElementById('dashboard-cloud-connect').click());

  function currentViewKey() {
    const key = location.hash.replace('#', '') || 'dashboard';
    return VIEWS[key] ? key : 'dashboard';
  }

  function showView() {
    if(location.hash==='#cloud')history.replaceState(null,'','#portals');
    const key = currentViewKey();
    if (window.SheriffSnapshots && window.SheriffSnapshots.isBlocking() && key !== 'snapshots') {
      location.hash = '#snapshots'; say('Wait for the snapshot operation to finish.'); return;
    }
    if (window.SheriffSnapshots && window.SheriffSnapshots.isArchived(portalContext.current)
        && ['content','media','interactive','patterns','navigation','config','modules','themes'].includes(key)) {
      location.hash = '#snapshots'; say('Restore this portal from a snapshot before editing it.'); return;
    }
    const view = VIEWS[key];

    document.querySelectorAll('.view').forEach(v => { v.hidden = true; });
    document.getElementById(view.el).hidden = false;


    document.querySelectorAll('[data-view]').forEach(n => {
      n.classList.toggle('active', n.dataset.view === key);
    });

    if (key === 'content') editorEnter();
    if (key === 'portals') renderManageList();
    if (key === 'media') mediaEnter();
    if (key === 'interactive' && window.SheriffInteractive) window.SheriffInteractive.enter(portalNames, PORT);
    if (key === 'navigation') nvEditor.enter();
    if (key === 'config') configEnter();
    if (key === 'modules') { if (!window.SheriffModuleConfig.enter()) { location.hash='#config'; return; } window.SheriffModules.enter(); }
    if (key === 'themes') themesEnter();
    if (key === 'patterns') patternsEnter();
    if (key === 'icons' && window.SheriffIcons) window.SheriffIcons.enter();
    if (key === 'snapshots' && window.SheriffSnapshots) window.SheriffSnapshots.enter(portalNames);
  }

  window.addEventListener('hashchange', showView);

  // ---------- shared build result parsing ----------
  function buildFailed(data) {
    if (data.ok === false) return true;
    if (data.code !== undefined && data.code !== 0 && data.code !== null) return true;
    return false;
  }

  async function buildPortal(name, btn) {
    const label=btn?.querySelector('[data-portal-action-label]')||btn;
    if (btn) { btn.disabled = true; label.textContent = 'Building…'; }
    try {
      const res = await fetch('/api/build?' + encodeURIComponent(name));
      const data = await res.json();
      if (buildFailed(data)) {
        say('Build failed: ' + name);
        return false;
      }
      return true;
    } catch (err) {
      say('API unreachable — is goblin start running?');
      return false;
    } finally {
      if (btn) { btn.disabled = false; label.textContent = 'Build portal'; }
    }
  }

  // ---------- portal list (dashboard) ----------
  const list = document.getElementById('portal-list');
  const tmpl = document.getElementById('portal-card');
  const statPortals = document.getElementById('stat-portals');
  let portalNames = [];

  function emptyState(msg) {
    list.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'portal-empty';
    div.textContent = msg;
    list.appendChild(div);
  }

  function renderPortals(names) {
    list.innerHTML = '';
    names.forEach(name => {
      const node = tmpl.content.cloneNode(true);
      node.querySelector('.portal').dataset.portal=name;
      node.querySelector('.portal-name').textContent = name;
      node.querySelector('.portal-icon-slot').replaceWith(portalContext.createIcon(name));

      const siteUrl = window.SheriffDeskBackend.portalUrl(name);
      const host = new URL(siteUrl).host;
      const a = node.querySelector('.portal-host');
      a.textContent = host;
      a.href = siteUrl;
      a.target = '_blank';
      a.rel = 'noopener';

      node.querySelector('.portal-edit').addEventListener('click', event => {
        if (!portalContext.select(name)) event.preventDefault();
      });

      node.querySelector('.portal-build').addEventListener('click', e => {
        buildPortal(name, e.currentTarget);
      });

      list.appendChild(node);
    });
  }

  let portalListRequest=0;
  async function loadPortals(preferred) {
    const request=++portalListRequest,revision=portalContext.revision;
    try {
      const res = await fetch('/api/portals');
      const data = await res.json();
      if(request!==portalListRequest)return;
      portalNames = Array.isArray(data.portals) ? data.portals : [];

      if (portalNames.length === 0) {
        emptyState('No portals found in site/portals. Create one to get started.');
        statPortals.textContent = '0';
        if (currentViewKey() !== 'snapshots' && window.SheriffDeskBackend.capabilities.siteLifecycle) maybeAutoWizard();
      } else {
        renderPortals(portalNames);
        statPortals.textContent = String(portalNames.length) + ' detected';
        statPortals.classList.remove('placeholder');
      }
      const target=revision===portalContext.revision?preferred||window.SheriffDeskBackend.preferredPortal:portalContext.current;
      if (window.SheriffSnapshots) window.SheriffSnapshots.setSourcePortals(portalNames, target);
      else portalContext.setPortals(portalNames, {preferred:target});
      portalNames.forEach(portal=>void loadPortalIdentity(portal));
      fillPortalSelect();
      await window.SheriffSites?.refresh();
    } catch (err) {
      if(request!==portalListRequest)return;
      emptyState(window.SheriffDeskBackend.mode === 'cloud' ? (err.message || 'Cloud could not load your sites.') : 'API unreachable — start Sheriff with goblin start from dist.');
      statPortals.textContent = 'Unknown';
    }
  }

  // ---------- build all ----------
  const buildAll = document.getElementById('build-all');

  async function runBuildAll() {
    if (buildAll.disabled) return;
    if (portalNames.length === 0) { say('No portals to build'); return; }
    buildAll.disabled = true;
    buildAll.textContent = 'Building…';
    window.SheriffBuildLog.startBatch('Build all portals');
    try {
      for (const name of portalNames) await buildPortal(name, null);
    } finally {
      window.SheriffBuildLog.endBatch();
      buildAll.disabled = false;
      buildAll.textContent = 'Build all portals';
    }
  }

  buildAll.addEventListener('click', runBuildAll);
  document.getElementById('qa-build-all').addEventListener('click', e => {
    e.preventDefault();
    runBuildAll();
  });


  // ============================================================
  // Portal management
  // ============================================================
  const manageList = document.getElementById('portal-manage-list');
  const manageTmpl = document.getElementById('portal-manage-card');
  const npName = document.getElementById('np-name');
  const npCreate = document.getElementById('np-create');
  const npPreview = document.getElementById('np-preview');

  const PORTAL_NAME_RE = /^[a-z0-9-]+$/;
  const RESERVED_PORTALS = new Set(['admin', 'api', 'public']);

  function renderManageList() {
    manageList.innerHTML = '';
    if (portalNames.length === 0) {
      const div = document.createElement('div');
      div.className = 'portal-empty';
      div.textContent = 'No portals yet. Create your first one above.';
      manageList.appendChild(div);
      window.SheriffCloudSync?.decoratePortals();
      return;
    }
    portalNames.forEach(name => {
      const node = manageTmpl.content.cloneNode(true);
      node.querySelector('.portal').dataset.portal=name;
      node.querySelector('.portal-name').textContent = name;
      node.querySelector('.portal-icon-slot').replaceWith(portalContext.createIcon(name));

      const siteUrl = window.SheriffDeskBackend.portalUrl(name);
      const host = new URL(siteUrl).host;
      const a = node.querySelector('.portal-host');
      a.textContent = host;
      a.href = siteUrl;
      a.target = '_blank';
      a.rel = 'noopener';

      node.querySelector('.portal-edit').addEventListener('click', event => {
        if (!portalContext.select(name)) event.preventDefault();
      });
      node.querySelector('.portal-build').addEventListener('click', e => {
        buildPortal(name, e.currentTarget);
      });
      node.querySelector('.portal-seed').addEventListener('click', () => window.SheriffSeeding.open(name));
      for(const action of ['rename','delete']){const button=node.querySelector('.portal-'+action),label=(action==='rename'?'Rename ':'Delete ')+name;button.title=label;button.setAttribute('aria-label',label);}
      node.querySelector('.portal-rename').hidden = !window.SheriffDeskBackend.capabilities.siteLifecycle;
      node.querySelector('.portal-delete').hidden = !window.SheriffDeskBackend.capabilities.siteLifecycle;
      node.querySelector('.portal-rename').addEventListener('click', () => {
        openRenamePortal(name);
      });
      node.querySelector('.portal-delete').addEventListener('click', () => {
        deletePortal(name);
      });

      manageList.appendChild(node);
    });
    window.SheriffSites?.groupCards(manageList);
    window.SheriffCloudSync?.decoratePortals();
    window.dispatchEvent(new Event('sheriff:portal-cards-rendered'));
  }

  npName.addEventListener('input', () => {
    npPreview.textContent = npName.value.trim() || 'name';
  });
  npName.addEventListener('keydown', e => {
    if (e.key === 'Enter') createPortal();
  });
  npCreate.addEventListener('click', createPortal);

  async function createPortal() {
    if(window.SheriffSites?.current?.grouped){openWizard({site:window.SheriffSites.current});return;}
    const name = npName.value.trim();
    if (!name) { say('Enter a portal name'); return; }
    if (!PORTAL_NAME_RE.test(name)) {
      say('Lowercase letters, numbers, and hyphens only');
      return;
    }
    if (RESERVED_PORTALS.has(name)) {
      say('"' + name + '" is reserved by Sheriff Desk');
      return;
    }
    if (portalNames.includes(name)) {
      say('Portal already exists');
      return;
    }

    npCreate.disabled = true;
    npCreate.textContent = 'Creating\u2026';
    try {
      const res = await fetch('/api/portal?create&' + encodeURIComponent(name)
        + '&outpost&' + encodeURIComponent(name));
      const data = await apiJson(res);
      if (data.ok === false) {
        say(data.stderr || 'Create failed');
        return;
      }
      npName.value = '';
      npPreview.textContent = 'name';
      say('Portal created. Build it when ready.');
      await loadPortals();
      renderManageList();
    } catch (err) {
      say(err.message || 'API unreachable');
    } finally {
      npCreate.disabled = false;
      npCreate.textContent = 'Create portal';
    }
  }

  // ---------- rename a portal ----------
  const rpModal = document.getElementById('rename-modal');
  const rpName = document.getElementById('rp-name');
  const rpOld = document.getElementById('rp-old');
  const rpErr = document.getElementById('rp-err');
  const rpBtn = document.getElementById('rp-rename');
  let rpTarget = null;

  function rpError(msg) {
    rpErr.textContent = msg;
    rpErr.hidden = false;
  }

  function openRenamePortal(name) {
    rpTarget = name;
    rpOld.textContent = name;
    rpName.value = name;
    const hosted=window.SheriffDeskBackend.mode==='cloud';
    rpOld.textContent=hosted?name+' — changing this address requires a new build before the site is available at its new address.':name;
    rpErr.hidden = true;
    rpBtn.disabled = false;
    rpBtn.textContent = 'Rename';
    rpModal.hidden = false;
    setTimeout(() => { rpName.focus(); rpName.select(); }, 50);
  }

  function closeRenamePortal() {
    rpModal.hidden = true;
    rpTarget = null;
  }

  document.getElementById('rp-close').addEventListener('click', closeRenamePortal);
  document.getElementById('rp-cancel').addEventListener('click', closeRenamePortal);
  rpName.addEventListener('input', () => { rpErr.hidden = true; });
  rpName.addEventListener('keydown', e => { if (e.key === 'Enter') renamePortal(); });
  rpBtn.addEventListener('click', renamePortal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !rpModal.hidden) closeRenamePortal();
  });

  async function renamePortal() {
    const from = rpTarget;
    const to = rpName.value.trim();

    if (!from) return;
    if (!to) { rpError('Enter a new name.'); return; }
    if (to === from) { rpError('That is the current name.'); return; }
    if (!PORTAL_NAME_RE.test(to)) {
      rpError('Lowercase letters, numbers, and hyphens only.');
      return;
    }
    if (RESERVED_PORTALS.has(to)) {
      rpError('"' + to + '" is reserved by Sheriff Desk.');
      return;
    }
    if (portalNames.includes(to)) { rpError('A portal named ' + to + ' already exists.'); return; }
    if (portalContext.current === from && !confirmPortalChange(to)) return;

    rpBtn.disabled = true;
    rpBtn.textContent = 'Renaming\u2026';
    try {
      const q = encodeURIComponent(from) + '&' + encodeURIComponent(to);
      const res = await fetch('/api/portal?rename&' + q);
      const data = await apiJson(res);
      if (data.ok === false) {
        rpError(String(data.stderr || 'Rename failed').trim().slice(0, 160));
        rpBtn.disabled = false;
        rpBtn.textContent = 'Rename';
        return;
      }

      closeRenamePortal();
      say('Renamed ' + from + ' to ' + to + '. Build it when ready.');
      const preferred = portalContext.current === from ? to : undefined;

      // The editor was pointed at a portal that no longer exists under that name.
      if (edPortal.value === from) {
        openFile = null;
        edFiles = [];
        edDirs = [];
        knownDirs = new Set();
        edCwd = 'content';
        expandedFolders = new Set();
        edText.value = '';
        edText.disabled = true;
        setDirty(false);
        edPath.textContent = 'No file open';

      }

      await loadPortals(preferred);
      renderManageList();

      // The renamed portal needs an explicit build at its new address.
    } catch (err) {
      rpError(err.message || 'API unreachable');
      rpBtn.disabled = false;
      rpBtn.textContent = 'Rename';
    }
  }

  async function deletePortal(name) {
    const typed = window.prompt(
      (window.SheriffDeskBackend.mode==='cloud'?'This removes the Cloud docs portal and its source. A docs-only site is also removed from your account. Other apps on a shared site are kept. It cannot be undone.\n\n':'This deletes the portal source AND its built output. It cannot be undone.\n\n')
      + 'Type the portal name to confirm: ' + name
    );
    if (typed === null) return;
    if (typed.trim() !== name) { say('Name did not match \u2014 nothing deleted'); return; }

    try {
      const res = await fetch('/api/portal?delete&' + encodeURIComponent(name));
      const data = await apiJson(res);
      if (data.ok === false) {
        say(data.stderr || 'Delete failed');
        return;
      }
      say('Deleted ' + name);
      if (edPortal.value === name) {
        openFile = null;
        edFiles = [];
        edDirs = [];
        expandedFolders = new Set();
        edText.value = '';
        edText.disabled = true;
        setDirty(false);
        edPath.textContent = 'No file open';
      }
      await loadPortals();
      renderManageList();
    } catch (err) {
      say('API unreachable');
    }
  }

  // ============================================================
  // Pages editor
  // ============================================================
  const edPortal = document.getElementById('desk-portal');
  const edFilter = document.getElementById('ed-filter');
  const tree = document.getElementById('file-tree');
  const edPath = document.getElementById('ed-path');
  const edDirty = document.getElementById('ed-dirty');
  const edStatus = document.getElementById('ed-status');
  const edSave = document.getElementById('ed-save');
  const edCancel = document.getElementById('ed-cancel');
  const edBuildPage = document.getElementById('ed-build-page');
  const edBuildPortal = document.getElementById('ed-build-portal');
  const edText = document.getElementById('ed-text');
  const edOpenPortal = document.getElementById('ed-open-portal');
  const newBtn = document.getElementById('ed-new');
  const edRawRevisions = document.getElementById('ed-raw-revisions');

  let edFiles = [];
  let edDirs = [];
  // Folders created this session. An empty folder has no file to imply it,
  // so if the API's dirs list drops it the tree would too. This keeps it.
  let knownDirs = new Set();
  let openFile = null, editorGeneration = 0;

  // --- documentation versions/revisions (mirrors routes_json.gbln rules) ---
  let docConfig = { versions: [], default: null, mode: 'manual', saveDefault: 'revision' };
  let versionedPages = {};        // "content/<page>" -> { versions: { ver: [{num,path}] } }
  let versionedPageSet = new Set();
  let openVersionCtx = null;      // { page, version } when a versioned page is open
  let saveMode = 'revision';      // manual-mode radio: 'revision' | 'overwrite'
  let dirty = false;
  let openedSource = null, openedSourcePath = null;
  let expandedFolders = new Set();
  let edCwd = 'content';
  let renamingPath = null;
  let fileOperationBusy = false, editorBusy = false, contentLoading=false;
  let fileListRequest=0,contentLoadRequest=0,fileInventoryDirty=true;

  function setDirty(v) {
    dirty = v;
    edDirty.hidden = !v;
    if(v&&edStatus.classList.contains('ok'))setStatus('');
    updateFileActions();
  }

  function setStatus(msg, cls) {
    edStatus.textContent = msg || '';
    edStatus.className = 'ed-status' + (cls ? ' ' + cls : '');
  }

  function fillPortalSelect() { portalContext.mount(edPortal); }

  function editorEnter() {
    fillPortalSelect();
    if ((fileInventoryDirty || edFiles.length === 0) && edPortal.value) loadFiles();
    updatePortalLink();
  }

  function updatePortalLink() {
    if (edPortal.value) {
      edOpenPortal.href = window.SheriffDeskBackend.portalUrl(edPortal.value);
      edOpenPortal.hidden = false;
    } else {
      edOpenPortal.hidden = true;
    }
  }

  function confirmDiscard() {
    if (!dirty) return true;
    return window.confirm('Unsaved changes will be lost. Continue?');
  }

  // ---- documentation versions ----
  // Parse the config.yall `documentation:` block (string parse, same style as
  // the theme swap already in this file).
  function parseDocConfig(text) {
    const out = { versions: [], default: null, mode: 'manual', saveDefault: 'revision' };
    const lines = String(text).split(/\r?\n/);
    let i = lines.findIndex(l => /^documentation:\s*$/.test(l));
    if (i < 0) return out;
    let inVersions = false;
    for (i = i + 1; i < lines.length; i++) {
      const line = lines[i];
      if (/^\S/.test(line)) break;            // dedent to a top-level key ends the block
      let m = line.match(/^\s+default_version:\s*"?([^"]+?)"?\s*$/);
      if (m) { out.default = m[1].trim(); inVersions = false; continue; }
      m = line.match(/^\s+mode:\s*"?([a-z]+)"?\s*$/i);
      if (m) { out.mode = m[1].trim().toLowerCase(); inVersions = false; continue; }
      m = line.match(/^\s+default_save_mode:\s*["']?(revision|overwrite)["']?\s*(?:#.*)?$/i);
      if (m) { out.saveDefault = m[1].toLowerCase(); inVersions = false; continue; }
      if (/^\s+versions:\s*$/.test(line)) { inVersions = true; continue; }
      if (inVersions) {
        const mv = line.match(/^\s+-\s*"?([^"]+?)"?\s*$/);
        if (mv) { out.versions.push(mv[1].trim()); continue; }
        if (/^\s+\S+:/.test(line)) inVersions = false;
      }
    }
    return out;
  }

  function versionBadgeToken(version) {
    return '{{{SHERIFF::' + version + '}}}';
  }

  function renderConfigVersionBadges(text, dirty) {
    const panel = document.getElementById('cf-version-badges');
    const list = document.getElementById('cf-version-badge-list');
    const versions = Array.from(new Set(parseDocConfig(text).versions));
    panel.hidden = versions.length === 0;
    list.innerHTML = '';
    document.getElementById('cf-version-badge-note').textContent = dirty
      ? 'Save the configuration before copying newly configured badges.'
      : 'Paste a token into a heading, paragraph, list, or table.';
    versions.forEach(version => {
      const row = document.createElement('div'); row.className = 'cfg-version-badge-row';
      const label = document.createElement('span'); label.textContent = version;
      const token = document.createElement('code'); token.textContent = versionBadgeToken(version);
      const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'btn small';
      copy.textContent = 'Copy token'; copy.disabled = dirty;
      copy.setAttribute('aria-label', 'Copy badge token for ' + version);
      copy.addEventListener('click', () => copyText(versionBadgeToken(version), 'Version badge token copied'));
      row.append(label, token, copy); list.appendChild(row);
    });
    if (!dirty && text && document.getElementById('desk-portal').value === edPortal.value) {
      docConfig = parseDocConfig(text);
      saveMode = docConfig.saveDefault;
      versionedPages = detectVersionedPages(edFiles);
      versionedPageSet = new Set(Object.keys(versionedPages));
      if (openVersionCtx && openVersionCtx.flat) openVersionCtx.version = docConfig.default || docConfig.versions[0];
      else if (openVersionCtx && !docConfig.versions.includes(openVersionCtx.version)) openVersionCtx = null;
      renderVersionBar();
      renderTree();
    }
  }

  async function loadDocConfig(portal, current=()=>true) {
    const revision = portalContext.revision;
    docConfig = { versions: [], default: null, mode: 'manual', saveDefault: 'revision' };
    try {
      const q = 'portal=' + encodeURIComponent(portal) + '&path=' + encodeURIComponent('config.yall');
      const res = await fetch('/api/file?read&' + q, { cache: 'no-store' });
      const data = await res.json();
      if (current() && isCurrentPortal(portal, revision) && data && data.ok !== false && data.content) docConfig = parseDocConfig(data.content);
    } catch (err) { /* no config → no versions, everything stays legacy-flat */ }
  }

  // A versioned page is content/<page>/<version>/R<n>.md where <version> is a
  // declared documentation version. Returns page -> versions -> sorted revisions.
  function detectVersionedPages(paths) {
    const vp = {};
    const vset = new Set(docConfig.versions);
    if (vset.size === 0) return vp;
    for (const p of paths) {
      if (p.indexOf('content/') !== 0 || !/\.md$/i.test(p)) continue;
      const parts = p.split('/');
      if (parts.length < 4) continue;
      const file = parts[parts.length - 1];
      const ver = parts[parts.length - 2];
      if (!vset.has(ver) || !/^R\d+\.md$/i.test(file)) continue;
      const page = parts.slice(0, parts.length - 2).join('/');
      const num = parseInt(file.replace(/^R/i, ''), 10);
      if (!vp[page]) vp[page] = { versions: {} };
      if (!vp[page].versions[ver]) vp[page].versions[ver] = [];
      vp[page].versions[ver].push({ num: num, path: p });
    }
    for (const page in vp) {
      for (const ver in vp[page].versions) {
        vp[page].versions[ver].sort((a, b) => a.num - b.num);
      }
    }
    return vp;
  }

  // Collapse versioned pages to a single page node; hide their version folders
  // and R*.md files from the raw tree.
  function foldForTree(paths, dirs) {
    if (edRawRevisions.checked || versionedPageSet.size === 0) return { paths: paths, dirs: dirs };
    const keepPaths = [];
    for (const p of paths) {
      let under = false;
      for (const page of versionedPageSet) {
        if (p.indexOf(page + '/') === 0) { under = true; break; }
      }
      if (!under) keepPaths.push(p);
    }
    for (const page of versionedPageSet) keepPaths.push(page); // synthetic page node
    const keepDirs = dirs.filter(d => {
      for (const page of versionedPageSet) {
        if (d === page || d.indexOf(page + '/') === 0) return false;
      }
      return true;
    });
    return { paths: keepPaths, dirs: keepDirs };
  }

  function availableVersions(page) {
    const info = versionedPages[page];
    if (!info) return [];
    const ordered = docConfig.versions.filter(v => info.versions[v]);
    // include any on-disk versions not listed in config, after the ordered ones
    for (const v in info.versions) if (ordered.indexOf(v) < 0) ordered.push(v);
    return ordered;
  }

  // Set the caret before focusing a newly loaded textarea; assigning .value
  // otherwise leaves it at the end and the browser scrolls there on focus.
  function resetTextStart(element,focus=false) {
    element.setSelectionRange(0,0);
    if(focus)element.focus({preventScroll:true});
    element.scrollTop=0;element.scrollLeft=0;
  }

  function revealContentRange(start,end=start) {
    if(edText.disabled||edText.hidden)return;
    start=Math.max(0,Math.min(start,edText.value.length));end=Math.max(start,Math.min(end,edText.value.length));
    edText.focus({preventScroll:true});edText.setSelectionRange(start,end,'backward');
    // Measure the wrapped source using the textarea's actual typography and
    // inner width. Line counting alone is wrong for long, wrapped paragraphs.
    const style=getComputedStyle(edText),mirror=document.createElement('div'),marker=document.createElement('span');
    for(const name of ['fontFamily','fontSize','fontWeight','fontStyle','letterSpacing','lineHeight','paddingTop','paddingRight','paddingBottom','paddingLeft','tabSize','wordBreak'])mirror.style[name]=style[name];
    Object.assign(mirror.style,{position:'fixed',left:'-100000px',top:'0',visibility:'hidden',boxSizing:'border-box',width:edText.clientWidth+'px',whiteSpace:edText.wrap==='off'?'pre':'pre-wrap',overflowWrap:'break-word'});
    mirror.append(document.createTextNode(edText.value.slice(0,start)));marker.textContent='\u200b';mirror.append(marker);document.body.append(mirror);
    const top=Math.max(0,marker.offsetTop-(parseFloat(style.paddingTop)||0)-24);mirror.remove();
    const generation=editorGeneration,text=edText.value;
    const scroll=()=>{if(generation!==editorGeneration||edText.value!==text||edText.hidden)return;edText.scrollTop=top;edText.scrollLeft=0;updateEditorTopButton();};
    scroll();requestAnimationFrame(scroll);
  }

  const editorTopButton=document.getElementById('ed-back-to-top'),editorPanel=document.getElementById('ed-editor-panel'),visualSurface=document.getElementById('visual-surface');

  // Reuse the same insertion controls, moving only their container on narrow screens.
  const insertTools=document.querySelector('.content-tools'),insertRail=document.createElement('aside'),insertMedia=matchMedia('(min-width:1301px)'),workspace=document.querySelector('.editor-shell');
  insertRail.className='editor-insert-rail';insertRail.setAttribute('aria-label','Insert content');workspace.append(insertRail);
  function positionInsertTools(){
    const rail=insertMedia.matches&&!editorPanel.hidden;
    workspace.classList.toggle('with-insert-rail',rail);insertRail.hidden=!rail;
    if(rail)insertRail.append(insertTools);else editorPanel.insertBefore(insertTools,document.getElementById('ed-version-bar'));
  }
  insertMedia.addEventListener('change',positionInsertTools);new MutationObserver(positionInsertTools).observe(editorPanel,{attributes:true,attributeFilter:['hidden']});positionInsertTools();

  function updateEditorTopButton(){
    const active=currentViewKey()==='content'&&!editorPanel.hidden&&!!openFile;
    const scroller=edText.hidden?visualSurface:edText;
    const editor=document.querySelector('.editor-main'),main=document.querySelector('main');
    const pastEditor=Math.max(0,main.getBoundingClientRect().top-editor.getBoundingClientRect().top,-editor.getBoundingClientRect().top);
    editorTopButton.hidden=!active||Math.max(scroller.scrollTop,pastEditor)<100;
  }
  document.addEventListener('scroll',updateEditorTopButton,{capture:true,passive:true});
  window.addEventListener('hashchange',updateEditorTopButton);
  window.addEventListener('sheriff:editor-change',()=>requestAnimationFrame(updateEditorTopButton));
  new MutationObserver(updateEditorTopButton).observe(editorPanel,{attributes:true,attributeFilter:['hidden']});
  editorTopButton.addEventListener('mousedown',event=>event.preventDefault());
  editorTopButton.addEventListener('click',()=>{
    if(edText.hidden)window.SheriffVisualEditor?.scrollToTop();else revealContentRange(0);
    // Mobile layouts can scroll the whole workspace rather than the text area.
    const main=document.querySelector('main'),editor=document.querySelector('.editor-main');
    main.scrollTop=Math.max(0,main.scrollTop+editor.getBoundingClientRect().top-main.getBoundingClientRect().top);
    if(window.scrollY)window.scrollTo({top:Math.max(0,window.scrollY+editor.getBoundingClientRect().top),behavior:'instant'});
    updateEditorTopButton();
  });

  async function openVersionedPage(page, version, savedContent) {
    const viewport=savedContent===undefined?null:{start:edText.selectionStart,end:edText.selectionEnd,direction:edText.selectionDirection,top:edText.scrollTop,left:edText.scrollLeft};
    if (savedContent === undefined && (editorBusy || !confirmDiscard())) return;
    const info = versionedPages[page];
    if (!info) { say('No versions for this page'); return; }
    const avail = availableVersions(page);
    if (avail.length === 0) { say('No versions for this page'); return; }
    let ver = version;
    if (!ver || !info.versions[ver]) {
      ver = (docConfig.default && info.versions[docConfig.default]) ? docConfig.default : avail[0];
    }
    const revs = info.versions[ver];
    const latest = revs[revs.length - 1];
    const portal = edPortal.value, revision = portalContext.revision;
    const request=++contentLoadRequest;contentLoading=true;edText.disabled=true;updateFileActions();
    try {
      const q = 'portal=' + encodeURIComponent(edPortal.value) + '&path=' + encodeURIComponent(latest.path);
      const res = await fetch('/api/file?read&' + q);
      const data = await res.json();
      if (request!==contentLoadRequest || !isCurrentPortal(portal, revision)) return;
      if (data.ok === false) { say(data.stderr || 'Could not open revision'); return; }
      const pendingEdits = savedContent !== undefined && edText.value !== savedContent;
      const nextText = pendingEdits ? edText.value : data.content || '';
      openedSource=data.content || '';openedSourcePath=latest.path;
      openFile = latest.path; editorGeneration++;
      edPath.textContent = page.replace(/^content\//, '');
      edText.value = nextText;
      edText.disabled = false;
      setDirty(pendingEdits);
      openVersionCtx = { page: page, version: ver, revNum: latest.num, flat: false };
      if (savedContent === undefined) saveMode = docConfig.saveDefault;
      renderVersionBar();
      renderTree();
      if(viewport){edText.setSelectionRange(viewport.start,viewport.end,viewport.direction);edText.focus({preventScroll:true});edText.scrollTop=viewport.top;edText.scrollLeft=viewport.left;}
      else resetTextStart(edText,true);
      updateEditorTopButton();
    } catch (err) { if (request===contentLoadRequest && isCurrentPortal(portal, revision)) say('API unreachable'); }
    finally {if(request===contentLoadRequest){contentLoading=false;edText.disabled=!openFile;updateFileActions();}}
  }

  function addableVersions(page, isFlat) {
    const all = docConfig.versions;
    if (isFlat) {
      const base = docConfig.default || all[0];
      return all.filter(v => v !== base);
    }
    const have = availableVersions(page);
    return all.filter(v => have.indexOf(v) < 0);
  }

  function renderVersionBar() {
    updateFileActions();
    const bar = document.getElementById('ed-version-bar');
    if (!bar) return;
    const ctx = openVersionCtx;
    if (!ctx || docConfig.versions.length === 0) { bar.hidden = true; bar.innerHTML = ''; return; }
    bar.hidden = false;
    bar.innerHTML = '';

    const label = document.createElement('span');
    label.className = 'ed-vb-label';
    label.textContent = 'Version';
    bar.appendChild(label);

    let tabs, revText;
    if (ctx.flat) {
      const base = docConfig.default || docConfig.versions[0];
      tabs = [base];
      revText = 'flat page';
    } else {
      tabs = availableVersions(ctx.page);
      revText = 'editing R' + ctx.revNum;
    }

    tabs.forEach(v => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ed-vb-tab' + (v === ctx.version ? ' active' : '');
      b.textContent = v + (v === docConfig.default ? ' \u00b7 default' : '');
      if (!ctx.flat) b.addEventListener('click', () => openVersionedPage(ctx.page, v));
      bar.appendChild(b);
    });

    const addable = addableVersions(ctx.page, ctx.flat);
    if (addable.length) {
      const sel = document.createElement('select');
      sel.className = 'ed-vb-add';
      const opt0 = document.createElement('option');
      opt0.value = ''; opt0.textContent = '+ version';
      sel.appendChild(opt0);
      addable.forEach(v => {
        const o = document.createElement('option');
        o.value = v; o.textContent = 'Add ' + v;
        sel.appendChild(o);
      });
      sel.addEventListener('change', () => {
        const v = sel.value;
        sel.value = '';
        if (v) addVersion(ctx, v);
      });
      bar.appendChild(sel);
    }

    const badgeCopy = document.createElement('select');
    badgeCopy.className = 'ed-vb-add ed-vb-badge';
    badgeCopy.setAttribute('aria-label', 'Copy version badge token');
    const copyPrompt = document.createElement('option');
    copyPrompt.value = ''; copyPrompt.textContent = 'Copy badge token…';
    badgeCopy.appendChild(copyPrompt);
    Array.from(new Set(docConfig.versions)).forEach(version => {
      const option = document.createElement('option'); option.value = version;
      option.textContent = version; option.title = versionBadgeToken(version);
      badgeCopy.appendChild(option);
    });
    badgeCopy.addEventListener('change', () => {
      const version = badgeCopy.value; badgeCopy.value = '';
      if (version) copyText(versionBadgeToken(version), 'Version badge token copied');
    });
    bar.appendChild(badgeCopy);

    const rev = document.createElement('span');
    rev.className = 'ed-vb-rev';
    rev.textContent = revText;
    bar.appendChild(rev);

    // save-mode control (revision vs overwrite)
    const modeWrap = document.createElement('span');
    modeWrap.className = 'ed-vb-mode';
    if (docConfig.mode === 'always') {
      modeWrap.textContent = 'saves create a new revision';
    } else if (docConfig.mode === 'off') {
      modeWrap.textContent = ctx.flat ? 'saves overwrite the page' : 'saves overwrite this revision';
    } else {
      const latest = versionedPages[ctx.page] && versionedPages[ctx.page].versions[ctx.version];
      const overwriteLabel = !ctx.flat && latest && latest[latest.length - 1].num !== ctx.revNum ? 'Overwrite this revision' : 'Overwrite latest';
      [['revision', 'New revision'], ['overwrite', overwriteLabel]].forEach(m => {
        const lab = document.createElement('label');
        lab.className = 'ed-vb-radio';
        const r = document.createElement('input');
        r.type = 'radio';
        r.name = 'ed-save-mode';
        r.checked = (saveMode === m[0]);
        r.addEventListener('change', () => { if (r.checked) saveMode = m[0]; });
        lab.appendChild(r);
        lab.appendChild(document.createTextNode(m[1]));
        modeWrap.appendChild(lab);
      });
    }
    bar.appendChild(modeWrap);
  }

  // Add a new version to a page. Flat pages migrate to the folder layout on
  // first use (page.md -> page/<default>/R1.md), then the new version's R1 is
  // seeded from the current content. Foldered pages just get a new version.
  async function addVersion(ctx, newVer) {
    if (editorBusy) return;
    if (dirty) { say('Save your changes before adding a version'); return; }
    const portal = edPortal.value;
    const content = edText.value;
    const q = (path) => 'portal=' + encodeURIComponent(portal) + '&path=' + encodeURIComponent(path);
    setStatus('Adding version ' + newVer + '\u2026');
    try {
      if (ctx.flat) {
        const base = docConfig.default || docConfig.versions[0];
        const flatPath = ctx.page + '.md';
        const baseR1 = ctx.page + '/' + base + '/R1.md';
        // migrate the flat file into the folder layout (true move: copy + delete)
        const mv = await fetch('/api/file?move&' + encodeURIComponent(portal)
          + '&' + encodeURIComponent(flatPath) + '&' + encodeURIComponent(baseR1));
        const mvData = await mv.json();
        if (mvData.ok === false) { say(mvData.stderr || 'Could not convert page'); return; }
      }
      // create the new version's first revision, seeded from current content
      const newR1 = ctx.page + '/' + newVer + '/R1.md';
      const wr = await fetch('/api/file?write&' + q(newR1), { method: 'POST', body: content });
      const wrData = await wr.json();
      if (wrData.ok === false) { say(wrData.stderr || 'Could not create version'); return; }

      say('Added version ' + newVer);
      await loadFiles();
      await openVersionedPage(ctx.page, newVer);
    } catch (err) {
      say('API unreachable');
    }
  }

  function versionsActive() {
    return !!(openVersionCtx && docConfig.versions.length);
  }

  // manual: honor the radio; always: force new revision; off: force overwrite
  function effectiveSaveMode() {
    if (docConfig.mode === 'always') return 'revision';
    if (docConfig.mode === 'off') return 'overwrite';
    return saveMode;
  }

  // Pick the next revision path; the chosen action saves/builds it once.
  async function nextRevisionTarget(portal) {
    const ctx = openVersionCtx;
    if (ctx.flat) {
      const version = docConfig.default || docConfig.versions[0];
      const response = await fetch('/api/file?move&' + encodeURIComponent(portal)
        + '&' + encodeURIComponent(ctx.page + '.md')
        + '&' + encodeURIComponent(ctx.page + '/' + version + '/R1.md'));
      const data = await apiJson(response);
      if (!response.ok || data.ok === false) throw Error(data.stderr || 'Could not create revision');
      openFile = ctx.page + '/' + version + '/R1.md';
      openVersionCtx = {page:ctx.page,version,revNum:1,flat:false};
      editorGeneration++; renderVersionBar();
      return {path:ctx.page + '/' + version + '/R2.md',page:ctx.page,version};
    }
    const revisions = versionedPages[ctx.page]?.versions[ctx.version] || [];
    const next = Math.max(ctx.revNum || 0,...revisions.map(r => r.num)) + 1;
    return {path:ctx.page + '/' + ctx.version + '/R' + next + '.md',page:ctx.page,version:ctx.version};
  }

  const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'ico']);

  function fileExt(path) {
    const i = path.lastIndexOf('.');
    return i === -1 ? '' : path.slice(i + 1).toLowerCase();
  }

  // Direct port of Cloud's buildFileTree (DocsPanel.tsx)
  function buildFileTree(paths, dirs) {
    const root = { name: 'root', path: '', type: 'folder', children: [] };

    // Same approach as the media panel: union the API's dirs with every
    // directory implied by a file path, so nothing can go missing.
    const dirSet = new Set(dirs);
    for (const f of paths) {
      const parts = f.split('/');
      for (let i = 1; i < parts.length; i++) {
        dirSet.add(parts.slice(0, i).join('/'));
      }
    }
    dirs = Array.from(dirSet).sort();

    for (const dir of dirs) {
      const parts = dir.split('/').filter(Boolean);
      let current = root;
      let running = '';
      for (const part of parts) {
        running = running ? running + '/' + part : part;
        if (!current.children) current.children = [];
        let found = current.children.find(c => c.name === part);
        if (!found) {
          found = { name: part, path: running, type: 'folder', children: [] };
          current.children.push(found);
        }
        current = found;
      }
    }

    for (const fullPath of paths) {
      const parts = fullPath.split('/').filter(Boolean);
      let current = root;
      let running = '';
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        running = running ? running + '/' + part : part;
        const isFile = i === parts.length - 1;
        if (!current.children) current.children = [];
        let found = current.children.find(c => c.name === part);
        if (!found) {
          found = { name: part, path: running, type: isFile ? 'file' : 'folder', children: isFile ? undefined : [] };
          current.children.push(found);
        }
        current = found;
      }
    }

    function sortNodes(nodes) {
      return nodes.slice().sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      }).map(n => Object.assign({}, n, { children: n.children ? sortNodes(n.children) : undefined }));
    }

    return sortNodes(root.children || []);
  }

  function fileIconSvg(name) {
    const ext = fileExt(name);
    if (IMAGE_EXTS.has(ext)) {
      return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
    }
    if (ext === 'md') {
      return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>';
  }

  function toggleFolder(path) {
    if (expandedFolders.has(path)) expandedFolders.delete(path);
    else expandedFolders.add(path);
    renderTree();
  }

  function appendRenameInput(row, path, name) {
    const input = document.createElement('input');
    input.type = 'text'; input.className = 'rename-input'; input.value = name;
    input.setAttribute('aria-label', 'New name for ' + name); input.spellcheck = false;
    row.appendChild(input);
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') { renamingPath = null; renderTree(); }
      if (e.key === 'Enter') { e.preventDefault(); commitRename(path, input.value); }
    });
    input.addEventListener('blur', () => {
      if (renamingPath === path) { renamingPath = null; renderTree(); }
    });
    requestAnimationFrame(() => { input.focus(); input.select(); });
  }

  function appendItemActions(wrapper, path) {
    if (!canManageItem(path) || path === renamingPath) return;
    const more = document.createElement('button');
    more.type = 'button'; more.className = 'tree-actions'; more.textContent = '\u22ef';
    more.title = 'Rename, move, or delete';
    more.setAttribute('aria-label', 'Actions for ' + path.split('/').pop());
    more.setAttribute('aria-haspopup', 'menu');
    more.addEventListener('click', e => {
      e.stopPropagation();
      const rect = more.getBoundingClientRect();
      showFileMenu(rect.left, rect.bottom, path);
    });
    wrapper.appendChild(more);
    wrapper.addEventListener('contextmenu', e => {
      e.preventDefault(); showFileMenu(e.clientX, e.clientY, path);
    });
  }

  function fileRow(path, name, indentPx) {
    const wrapper = document.createElement('div'); wrapper.className = 'tree-row';
    const row = document.createElement(path === renamingPath ? 'div' : 'button');
    row.type = 'button';
    const isPage = versionedPageSet.has(path);
    row.className = 'tree-item' + (path === openFile || isPage && pathWithin(path, openFile) ? ' open' : '');
    row.style.paddingLeft = indentPx + 'px'; row.title = path;
    row.innerHTML = '<span class="caret"></span>' + fileIconSvg(isPage ? name + '.md' : name);
    wrapper.appendChild(row);
    if (path === renamingPath) {
      appendRenameInput(row, path, path.split('/').pop());
      return wrapper;
    }
    const label = document.createElement('span'); label.className = 'node-name'; label.textContent = name;
    row.appendChild(label);
    row.addEventListener('click', () => openPath(path));
    if (canManageItem(path)) {
      row.draggable = true;
      row.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', path); e.dataTransfer.effectAllowed = 'move';
      });
    }
    appendItemActions(wrapper, path);
    return wrapper;
  }

  function renderNodes(container, nodes, depth) {
    nodes.forEach(node => {
      if (node.type !== 'folder') {
        container.appendChild(fileRow(node.path, node.name, 10 + depth * 16));
        return;
      }
      const isOpen = expandedFolders.has(node.path);
      const wrapper = document.createElement('div'); wrapper.className = 'tree-row';
      const row = document.createElement(node.path === renamingPath ? 'div' : 'button');
      row.type = 'button'; row.className = 'tree-folder' + (isOpen ? ' expanded' : '');
      row.style.paddingLeft = (10 + depth * 16) + 'px'; row.title = node.path;
      row.setAttribute('aria-expanded',String(isOpen));
      row.innerHTML = '<span class="caret" aria-hidden="true">' + "<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-chevron-right\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"m9 18 6-6-6-6\" />\n</svg>" + '</span>'
        + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
      wrapper.appendChild(row);
      if (node.path === renamingPath) appendRenameInput(row, node.path, node.path.split('/').pop());
      else {
        const label = document.createElement('span'); label.className = 'node-name'; label.textContent = node.name;
        row.appendChild(label);
        row.addEventListener('click', () => { edCwd = node.path; toggleFolder(node.path); });
        if (canManageItem(node.path)) {
          row.draggable = true;
          row.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', node.path); e.dataTransfer.effectAllowed = 'move';
          });
        }
        row.addEventListener('dragover', e => {
          e.preventDefault(); e.dataTransfer.dropEffect = 'move'; row.classList.add('drop-target');
        });
        row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
        row.addEventListener('drop', e => {
          e.preventDefault(); row.classList.remove('drop-target');
          const source = e.dataTransfer.getData('text/plain');
          if (source) moveFilePath(source, node.path + '/' + source.split('/').pop());
        });
        appendItemActions(wrapper, node.path);
      }
      container.appendChild(wrapper);
      if (isOpen && node.children) renderNodes(container, node.children, depth + 1);
    });
  }

  function renderTree() {
    if (renamingPath && tree.querySelector('input')) return;
    const q = edFilter.value.trim().toLowerCase();
    tree.innerHTML = '';

    if (edFiles.length === 0 && edDirs.length === 0) {
      const div = document.createElement('div');
      div.className = 'tree-msg';
      div.textContent = 'No files in this portal yet.';
      tree.appendChild(div);
      return;
    }

    const folded = foldForTree(edFiles, edDirs);

    // Filter active: flat list of matching full paths. No filter: tree.
    if (q) {
      const shown = Array.from(new Set(folded.paths.concat(folded.dirs))).filter(f => f.toLowerCase().includes(q));
      if (shown.length === 0) {
        const div = document.createElement('div');
        div.className = 'tree-msg';
        div.textContent = 'No files match.';
        tree.appendChild(div);
        return;
      }
      renderNodes(tree, shown.map(p => ({path:p, name:p, type:folded.dirs.includes(p) ? 'folder' : 'file', children:[]})), 0);
      return;
    }

    renderNodes(tree, buildFileTree(folded.paths, folded.dirs), 0);
  }

  async function loadFiles() {
    if (!edPortal.value) return;
    if (renamingPath) { fileInventoryDirty=true; return; }
    const portal = edPortal.value, revision = portalContext.revision,request=++fileListRequest;
    const current=()=>request===fileListRequest&&isCurrentPortal(portal,revision);
    tree.innerHTML = '<div class="tree-msg">Loading files\u2026</div>';
    try {
      const res = await fetch('/api/file?list&' + encodeURIComponent(edPortal.value), { cache: 'no-store' });
      const data = await res.json();
      if (!current()) return;
      if (data.ok === false) {
        tree.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'tree-msg';
        div.textContent = data.stderr || 'Could not list files.';
        tree.appendChild(div);
        edFiles = [];
        edDirs = [];
        return;
      }
      edFiles = Array.isArray(data.files) ? data.files.map(String) : [];
      edDirs = Array.isArray(data.dirs) ? data.dirs.map(String) : [];

      for (const d of knownDirs) {
        if (!edDirs.includes(d)) edDirs.push(d);
      }

      await loadDocConfig(portal,current);
      if (!current()) return;
      fileInventoryDirty=false;
      versionedPages = detectVersionedPages(edFiles);
      versionedPageSet = new Set(Object.keys(versionedPages));
      if (openFile && !edFiles.includes(openFile)) {
        if(!dirty&&!editorBusy)clearContentEditor();
        else setStatus('This file was moved or removed. Your unsaved edits are kept.');
      }
      updateFileActions();

      // First load / portal switch: expand top-level folders containing
      // files (same default as Cloud). Reloads keep the current expansion.
      if (expandedFolders.size === 0) {
        for (const f of edFiles) {
          if (f.includes('/')) expandedFolders.add(f.split('/')[0]);
        }
      }

      renderTree();
    } catch (err) {
      if (!current()) return;
      tree.innerHTML = '<div class="tree-msg">API unreachable.</div>';
      edFiles = [];
      edDirs = [];
    }
  }

  // ---------- file operations ----------
  function pathWithin(parent, candidate) {
    return !!(parent && candidate && (candidate === parent || candidate.startsWith(parent + '/')));
  }

  function canManageItem(path) {
    return /^(content|blog|public)\/.+/.test(path || '');
  }

  function revisionContextForPath(path) {
    const parts = String(path || '').split('/');
    if (parts[0] !== 'content' || parts.length < 4) return null;
    const match = /^R([1-9]\d*)\.md$/i.exec(parts[parts.length - 1]);
    const version = parts[parts.length - 2];
    if (!match || !docConfig.versions.includes(version)) return null;
    return {page:parts.slice(0,-2).join('/'), version, revNum:Number(match[1]), flat:false};
  }

  function updateFileActions() {
    const busy = editorBusy || fileOperationBusy || contentLoading;
    const locked=window.SheriffHowdyAccess?.blocked(edPortal.value,openFile);
    edSave.disabled = busy || locked || !dirty || !openFile;
    edCancel.disabled = busy || !dirty || !openFile;
    edBuildPage.disabled = busy || (locked&&dirty) || !openFile || !/^content\/.+\.md$/i.test(openFile);
    edBuildPortal.disabled = busy || (locked&&dirty) || !openFile;
    window.dispatchEvent(new Event('sheriff:editor-change'));
  }

  function clearContentEditor() {
    contentLoadRequest++;contentLoading=false;
    openFile = null; openVersionCtx = null; editorGeneration++;
    edPath.textContent = 'No file open'; edText.value = ''; edText.disabled = true;
    setDirty(false); renderVersionBar(); setStatus('');
  }

  function remapItemPath(value, from, to) {
    return pathWithin(from, value) ? to + value.slice(from.length) : value;
  }

  function isDirectoryItem(path) {
    return versionedPageSet.has(path) || edDirs.includes(path) || edFiles.some(f => f.startsWith(path + '/'));
  }

  function startRename(path) {
    if (fileOperationBusy || !canManageItem(path)) return;
    renamingPath = path;
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) expandedFolders.add(parts.slice(0,i).join('/'));
    if (!path.toLowerCase().includes(edFilter.value.trim().toLowerCase())) edFilter.value = '';
    renderTree();
  }

  async function moveFilePath(srcPath, destPath, onError = say) {
    if (fileOperationBusy || !canManageItem(srcPath) || !canManageItem(destPath) || srcPath === destPath) return false;
    if (pathWithin(srcPath, destPath)) { say('A folder cannot be moved inside itself'); return false; }
    const portal = edPortal.value;
    fileOperationBusy = true; edPortal.disabled = true; updateFileActions();
    try {
      const q = encodeURIComponent(portal) + '&' + encodeURIComponent(srcPath) + '&' + encodeURIComponent(destPath);
      const res = await fetch('/api/file?move&' + q);
      const data = await res.json();
      if (!res.ok || data.ok === false) { onError(data.stderr || 'Move failed'); return false; }
      openFile = remapItemPath(openFile, srcPath, destPath);
      if (openVersionCtx) openVersionCtx.page = openVersionCtx.flat && openFile && /\.md$/i.test(openFile)
        ? openFile.replace(/\.md$/i, '') : remapItemPath(openVersionCtx.page, srcPath, destPath);
      const revision = revisionContextForPath(openFile);
      if (revision) openVersionCtx = revision;
      if (openFile) edPath.textContent = openVersionCtx && !openVersionCtx.flat ? openVersionCtx.page.replace(/^content\//,'') : openFile;
      knownDirs = new Set(Array.from(knownDirs, d => remapItemPath(d, srcPath, destPath)));
      expandedFolders = new Set(Array.from(expandedFolders, d => remapItemPath(d, srcPath, destPath)));
      edCwd = remapItemPath(edCwd, srcPath, destPath);
      const parts = destPath.split('/');
      for (let i=1; i<parts.length; i++) expandedFolders.add(parts.slice(0,i).join('/'));
      await loadFiles(); renderVersionBar();
      setStatus('Renamed or moved · rebuild portal to update the site');
      say('Moved to ' + destPath);
      return true;
    } catch (err) { onError('Move failed: ' + err.message); return false; }
    finally { fileOperationBusy = false; edPortal.disabled = false; updateFileActions(); }
  }

  async function commitRename(path, newName) {
    let name = newName.trim();
    renamingPath = null;
    if (!name || name === path.split('/').pop()) { renderTree(); return; }
    if (/[\\/:*?"<>|\x00-\x1f]/.test(name) || name === '.' || name.includes('..') || /[. ]$/.test(name)) {
      say('Use a filename without slashes, trailing dots, or reserved characters'); renderTree(); return;
    }
    const revision = revisionContextForPath(path);
    if (revision && !/^R[1-9]\d*\.md$/i.test(name)) {
      say('Revision filenames must use R1.md, R2.md, and so on'); renderTree(); return;
    }
    if (versionedPageSet.has(path)) name = name.replace(/\.md$/i, '');
    else if (/\.md$/i.test(path) && !/\.md$/i.test(name)) name += '.md';
    for (const page in versionedPages) {
      if (path.startsWith(page + '/') && path.slice(page.length + 1).indexOf('/') < 0 && !docConfig.versions.includes(name)) {
        say('Declare that version label in config.yall before renaming its folder'); renderTree(); return;
      }
    }
    const parent = path.slice(0,path.lastIndexOf('/'));
    await moveFilePath(path, parent + '/' + name);
    renderTree();
  }

  async function deleteFilePath(path) {
    if (fileOperationBusy || !canManageItem(path)) return;
    const directory = isDirectoryItem(path), page = versionedPageSet.has(path);
    let message = page ? 'Delete page "' + path + '" and ALL its versions and revisions?'
      : directory ? 'Delete folder "' + path + '" and ALL files and subfolders inside it?'
      : 'Delete file "' + path + '"?';
    if (dirty && pathWithin(path,openFile)) message += '\nUnsaved changes in the editor will also be discarded.';
    if (revisionContextForPath(path)) message += '\nIf this is the latest revision, the preceding revision becomes current.';
    if (!window.confirm(message + '\nThis cannot be undone.')) return;
    const recovery = pathWithin(path,openFile) && openVersionCtx && !openVersionCtx.flat ? Object.assign({},openVersionCtx) : null;
    const portal = edPortal.value;
    fileOperationBusy = true; edPortal.disabled = true; updateFileActions();
    try {
      const q = encodeURIComponent(portal) + '&' + encodeURIComponent(path);
      const res = await fetch('/api/file?delete&' + q);
      const data = await res.json();
      if (!res.ok || data.ok === false) { say(data.stderr || 'Delete failed'); return; }
      if (pathWithin(path,openFile)) clearContentEditor();
      knownDirs = new Set(Array.from(knownDirs).filter(d => !pathWithin(path,d)));
      expandedFolders = new Set(Array.from(expandedFolders).filter(d => !pathWithin(path,d)));
      if (pathWithin(path,edCwd)) edCwd = path.slice(0,path.lastIndexOf('/')) || 'content';
      await loadFiles();
      if (recovery && versionedPages[recovery.page]) await openVersionedPage(recovery.page,recovery.version);
      renderVersionBar();
      setStatus('Deleted · rebuild portal to update the site'); say('Deleted ' + path);
    } catch (err) { say('Delete failed: ' + err.message); }
    finally { fileOperationBusy = false; edPortal.disabled = false; updateFileActions(); }
  }

  edRawRevisions.addEventListener('change', () => { renamingPath = null; hideFileMenu(); renderTree(); updateFileActions(); });

  // ---------- context menu ----------
  const fileMenu = document.createElement('div');
  fileMenu.className = 'ctx-menu';
  fileMenu.setAttribute('role', 'menu');
  fileMenu.hidden = true;
  fileMenu.innerHTML = '<button type="button" data-act="rename">Rename</button>'
    + '<button type="button" data-act="move">Move to…</button>'
    + '<button type="button" data-act="delete" class="danger">Delete</button>';
  document.body.appendChild(fileMenu);
  let menuPath = null;

  function showFileMenu(x, y, path) {
    if (fileOperationBusy || !canManageItem(path)) return;
    menuPath = path;
    fileMenu.hidden = false;
    const rect = fileMenu.getBoundingClientRect();
    fileMenu.style.left = Math.min(x, window.innerWidth - rect.width - 8) + 'px';
    fileMenu.style.top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)) + 'px';
    fileMenu.querySelector('button').focus();
  }

  function hideFileMenu() {
    fileMenu.hidden = true;
    menuPath = null;
  }

  fileMenu.addEventListener('click', e => {
    const act = e.target.dataset && e.target.dataset.act;
    const path = menuPath;
    hideFileMenu();
    if (!act || !path) return;
    if (act === 'rename') startRename(path);
    if (act === 'move') openMoveDialog(path);
    if (act === 'delete') deleteFilePath(path);
  });

  document.addEventListener('click', () => { if (!fileMenu.hidden) hideFileMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !fileMenu.hidden) hideFileMenu(); });

  // Choose a destination without changing the filename or document revisions.
  const moveDialog = document.createElement('dialog');
  moveDialog.className = 'snapshot-dialog'; moveDialog.id = 'file-move-dialog';
  moveDialog.setAttribute('aria-labelledby', 'file-move-title');
  moveDialog.innerHTML = '<form id="file-move-form"><h2 id="file-move-title">Move to another folder</h2>'
    + '<div class="selected-snapshot"><strong id="file-move-source"></strong></div>'
    + '<label for="file-move-folder">Destination folder</label><select id="file-move-folder" class="ed-filter"></select>'
    + '<p class="hint">The filename and contents stay the same. Build the portal afterward to update the site.</p>'
    + '<p id="file-move-error" role="alert" hidden></p>'
    + '<div class="actions"><button class="btn" id="file-move-cancel" type="button">Cancel</button>'
    + '<button class="btn primary" id="file-move-confirm" type="submit" disabled>Move</button></div></form>';
  document.body.appendChild(moveDialog);
  const moveFolder = moveDialog.querySelector('#file-move-folder'), moveConfirm = moveDialog.querySelector('#file-move-confirm');
  const moveCancel = moveDialog.querySelector('#file-move-cancel'), moveError = moveDialog.querySelector('#file-move-error');
  let moveSource = null, moveRelease = null, movePending = false;
  function updateMoveChoice() {
    moveConfirm.disabled = movePending || !moveSource || !moveFolder.value || moveFolder.value === moveSource.slice(0, moveSource.lastIndexOf('/'));
  }
  function closeMoveDialog() {
    if (movePending) return;
    moveDialog.close(); moveSource = null;
    if (moveRelease) moveRelease(); moveRelease = null;
  }
  function openMoveDialog(path) {
    if (fileOperationBusy || !canManageItem(path)) return;
    const pages = Array.from(versionedPageSet);
    if (pages.some(page => page !== path && pathWithin(page, path))) {
      say('Move the whole document to keep its versions and revisions together.'); return;
    }
    const root = path.split('/')[0], parent = path.slice(0, path.lastIndexOf('/'));
    const folders = new Set([root, ...[...edDirs, ...knownDirs].filter(dir => dir === root || dir.startsWith(root + '/'))]);
    moveFolder.replaceChildren();
    for (const folder of Array.from(folders).sort()) {
      if (pathWithin(path, folder) || pages.some(page => pathWithin(page, folder))) continue;
      const option = document.createElement('option'); option.value = folder; option.textContent = folder + '/'; moveFolder.appendChild(option);
    }
    moveSource = path; moveDialog.querySelector('#file-move-source').textContent = path;
    moveFolder.value = parent; if (!moveFolder.value) moveFolder.selectedIndex = 0;
    moveError.hidden = true; moveError.textContent = ''; movePending = false;
    moveRelease = portalContext.lock(); updateMoveChoice(); moveDialog.showModal(); moveFolder.focus();
  }
  moveFolder.addEventListener('change', () => { moveError.hidden = true; updateMoveChoice(); });
  moveCancel.addEventListener('click', closeMoveDialog);
  moveDialog.addEventListener('cancel', event => { event.preventDefault(); closeMoveDialog(); });
  moveDialog.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault(); if (moveConfirm.disabled || !moveSource) return;
    const source = moveSource, destination = moveFolder.value + '/' + source.split('/').pop();
    movePending = true; moveFolder.disabled = true; moveCancel.disabled = true; updateMoveChoice();
    try {
      const moved = await moveFilePath(source, destination, message => { moveError.textContent = message; moveError.hidden = false; });
      movePending = false;
      if (moved) closeMoveDialog();
    } finally {
      movePending = false; moveFolder.disabled = false; moveCancel.disabled = false; updateMoveChoice();
    }
  });

  async function openPath(path) {
    if (editorBusy) return;
    if (!confirmDiscard()) return;
    window.SheriffBuildLog.showEditor();
    const portal = edPortal.value, portalRevision = portalContext.revision;
    if (versionedPageSet.has(path)) { openVersionedPage(path); return; }
    if (IMAGE_EXTS.has(fileExt(path))) {
      say('Image viewer lands with the Media panel');
      return;
    }
    const request=++contentLoadRequest;contentLoading=true;edText.disabled=true;updateFileActions();
    setStatus('');
    try {
      const q = 'portal=' + encodeURIComponent(edPortal.value) + '&path=' + encodeURIComponent(path);
      const res = await fetch('/api/file?read&' + q);
      const data = await res.json();
      if (request!==contentLoadRequest || !isCurrentPortal(portal, portalRevision)) return;
      if (data.ok === false) {
        say(data.stderr || 'Could not open file');
        return;
      }
      openedSource=data.content || '';openedSourcePath=path;
      openFile = path; editorGeneration++;
      saveMode = docConfig.saveDefault;
      edPath.textContent = path;
      edText.value = data.content || '';
      edText.disabled = false;
      setDirty(false);
      // flat content page: show the version bar with the implicit default,
      // so versions can be added. Non-content files get no bar.
      const revision = revisionContextForPath(path);
      if (revision) {
        openVersionCtx = revision;
      } else if (path.indexOf('content/') === 0 && /\.md$/i.test(path) && docConfig.versions.length) {
        openVersionCtx = { page: path.replace(/\.md$/i, ''), version: docConfig.default || docConfig.versions[0], flat: true };
      } else {
        openVersionCtx = null;
      }
      renderVersionBar();
      renderTree();
      resetTextStart(edText,true);updateEditorTopButton();
    } catch (err) {
      if (request===contentLoadRequest && isCurrentPortal(portal, portalRevision)) say('API unreachable');
    } finally {
      if(request===contentLoadRequest){contentLoading=false;edText.disabled=!openFile;updateFileActions();}
    }
  }

  async function saveFile(build = 'none') {
    if(window.SheriffPageDetails&&!await window.SheriffPageDetails.flush()){say('Review page details before saving.');return;}
    if (window.SheriffContentImages?.isBusy()) { say('Wait for the image operation to finish.'); return; }
    if (!openFile || editorBusy || fileOperationBusy || (build === 'none' && !dirty)) return;
    if (build === 'page' && !/^content\/.+\.md$/i.test(openFile)) return;
    const portal = edPortal.value, content = edText.value, started = Date.now();
    const button = build === 'page' ? edBuildPage : build === 'portal' ? edBuildPortal : edSave;
    const originalLabel = button.textContent;
    const release = portalContext.lock();
    let target = {path:openFile}, saved = false;
    editorBusy = true; updateFileActions();
    button.textContent = build === 'none' ? 'Saving…' : 'Building…';
    setStatus(build === 'none' ? 'saving…' : 'saving and building ' + (build === 'page' ? 'page…' : 'portal…'));
    try {
      if (dirty && versionsActive() && effectiveSaveMode() === 'revision') target = await nextRevisionTarget(portal);
      const checked=/^content\/.+\.md$/i.test(openFile)&&openedSourcePath===openFile&&openedSource!==null;
      const q = new URLSearchParams({portal,path:target.path,build,...(checked?{checked:'1'}:{})});
      const response = window.SheriffHowdyAccess?.blocked(portal,openFile)&&!dirty&&build!=='none' ? await window.SheriffDeskBackend.request(build==='page'?'page.build':'portal.build',{portal,path:openFile},{method:'POST',headers:{Accept:'application/x-ndjson'}}) : await fetch('/api/file?write&' + q, {
        method:'POST',headers:{'Content-Type':checked?'application/json':'text/plain'},body:checked?JSON.stringify({content,base:openedSource,base_path:openedSourcePath}):content
      });
      const data = await apiJson(response);
      saved = data.saved === true || (response.ok && !buildFailed(data));
      if (saved) {
        openedSource=content;openedSourcePath=target.path;
        setDirty(edText.value !== content);
        if (target.page) {
          openFile = target.path;
          await loadFiles();
          await openVersionedPage(target.page,target.version,content);
        }
      }
      if (!response.ok || buildFailed(data)) {
        setStatus((saved ? 'Saved · ' : '') + (build === 'none' ? 'save failed' : Number.isFinite(data.upload_ms) ? 'upload failed' : 'build failed'),'err');
        if (!saved) setDirty(true);
        if (data.stderr) say(String(data.stderr).trim().slice(0,160));
        return;
      }
      const timing = window.SheriffBuildLog.duration(data,Date.now()-started);
      setStatus(build === 'none' ? '✓ Saved' : '✓ Saved · ' + (build === 'page' ? 'page' : 'portal')
        + (data.published ? ' built and published' : ' built') + ' · ' + timing,'ok');
    } catch (error) {
      setStatus(error.message || 'API unreachable','err');
      if (!saved) setDirty(true);
    } finally {
      editorBusy = false; button.textContent = originalLabel;
      release(); updateFileActions();
    }
  }

  edText.addEventListener('input', () => setDirty(true));
  window.addEventListener('sheriff:access-change',updateFileActions);
  edSave.addEventListener('click', () => saveFile('none'));
  edCancel.addEventListener('click', async () => {
    if (edCancel.disabled) return;
    if (window.SheriffContentImages?.isBusy()) { say('Wait for the image operation to finish.'); return; }
    const portal = edPortal.value, revision = portalContext.revision;
    const wasVisual = window.SheriffVisualEditor?.mode() === 'visual';
    // Reuse the existing confirmed file/revision reload. Its generation change
    // discards pending details, visual history, and stale picker bookmarks too.
    if (openVersionCtx && !openVersionCtx.flat) await openVersionedPage(openVersionCtx.page, openVersionCtx.version);
    else await openPath(openFile);
    if (!dirty && openFile && isCurrentPortal(portal, revision)) {
      setStatus('Edits cancelled · restored saved version');
      if (wasVisual) document.querySelector('#visual-mode-tabs [data-mode="visual"]').click();
    }
  });
  edBuildPage.addEventListener('click', () => saveFile('page'));
  edBuildPortal.addEventListener('click', () => saveFile('portal'));

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      const k = currentViewKey();
      if (k === 'content') { e.preventDefault(); saveFile(); }
      if (k === 'navigation') { e.preventDefault(); nvEditor.save(); }
      if (k === 'config' || k === 'modules') { e.preventDefault(); cfEditor.save(); }
      if (k === 'themes') { e.preventDefault(); thSave(); }
      if (k === 'patterns') { e.preventDefault(); savePattern(); }
    }
  });

  edFilter.addEventListener('input', renderTree);

  // ---------- new folder (shared modal) ----------
  const folderModal = document.getElementById('folder-modal');
  const fmName = document.getElementById('fm-name');
  const fmParent = document.getElementById('fm-parent');
  const fmErr = document.getElementById('fm-err');
  const fmCreate = document.getElementById('fm-create');
  let fmContext = null;   // { portal, parent, onDone }

  function openFolderModal(ctx) {
    fmContext = ctx;
    fmName.value = '';
    fmParent.textContent = ctx.parent;
    fmErr.hidden = true;
    folderModal.hidden = false;
    setTimeout(() => fmName.focus(), 50);
  }
  function closeFolderModal() { folderModal.hidden = true; fmContext = null; }

  document.getElementById('fm-close').addEventListener('click', closeFolderModal);
  document.getElementById('fm-cancel').addEventListener('click', closeFolderModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !folderModal.hidden) closeFolderModal();
  });
  fmName.addEventListener('input', () => { fmErr.hidden = true; });
  fmName.addEventListener('keydown', e => { if (e.key === 'Enter') submitFolder(); });

  async function submitFolder() {
    if (!fmContext) return;
    const clean = fmName.value.trim().replace(/[\\/]/g, '');
    if (!clean) { fmErr.textContent = 'Give the folder a name.'; fmErr.hidden = false; return; }

    const target = fmContext.parent + '/' + clean;
    fmCreate.disabled = true;
    fmCreate.textContent = 'Creating\u2026';
    try {
      const q = encodeURIComponent(fmContext.portal) + '&' + encodeURIComponent(target);
      const res = await fetch('/api/file?mkdir&' + q);
      const data = await apiJson(res);
      if (data.ok === false) {
        fmErr.textContent = data.stderr || 'Could not create folder';
        fmErr.hidden = false;
        return;
      }
      const done = fmContext.onDone;
      closeFolderModal();
      say('Created ' + clean);
      if (done) await done(target);
    } catch (err) {
      fmErr.textContent = err.message || 'API unreachable';
      fmErr.hidden = false;
    } finally {
      fmCreate.disabled = false;
      fmCreate.textContent = 'Create folder';
    }
  }
  fmCreate.addEventListener('click', submitFolder);

  document.getElementById('ed-newfolder').addEventListener('click', () => {
    if (!edPortal.value) { say('Pick a portal first'); return; }
    openFolderModal({
      portal: edPortal.value,
      parent: edCwd || 'content',
      onDone: async target => {
        // expand every ancestor so the new folder is visible
        const parts = target.split('/');
        for (let i = 1; i <= parts.length; i++) {
          expandedFolders.add(parts.slice(0, i).join('/'));
        }
        edCwd = target;
        edFilter.value = '';
        knownDirs.add(target);
        await loadFiles();
      }
    });
  });

  // ---------- new page modal ----------
  const npModal = document.getElementById('np-modal');
  const npmTitle = document.getElementById('npm-title');
  const npmPath = document.getElementById('npm-path');
  const npmFolderSel = document.getElementById('npm-folder');
  const npmLayout = document.getElementById('npm-layout');
  const npmAuthor = document.getElementById('npm-author');
  const npmBlog = document.getElementById('npm-blog');
  const npmAvatar = document.getElementById('npm-avatar');
  const npmThumb = document.getElementById('npm-thumb');
  const npmDate = document.getElementById('npm-date');
  const npmErr = document.getElementById('npm-err');
  const npmCreate = document.getElementById('npm-create');

  let npmPathEdited = false;

  function pageSlug(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  // Offer content folders, excluding a versioned document's internal storage.
  // Defaults to content, never to whatever folder was last clicked.
  function npmLoadFolders() {
    npmFolderSel.innerHTML = '';
    const folders = ['content'];
    for (const d of edDirs) {
      if (d !== 'content' && !d.startsWith('content/')) continue;
      if (Array.from(versionedPageSet).some(page => d === page || d.startsWith(page + '/'))) continue;
      folders.push(d);
    }
    for (const name of [...new Set(folders)].sort()) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name + '/';
      npmFolderSel.appendChild(opt);
    }
    npmFolderSel.value = 'content';
  }

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0');
  }

  function npmError(msg) {
    npmErr.textContent = msg;
    npmErr.hidden = false;
  }

  async function npmLoadLayouts() {
    npmLayout.innerHTML = '';
    const theme = await detectCurrentTheme(edPortal.value);
    if (!theme) {
      npmError('Could not read the theme from config.yall.');
      return;
    }
    const res = await fetch('/api/list_layouts?' + encodeURIComponent(theme));
    const data = await apiJson(res);
    if (data.ok === false || !Array.isArray(data.layouts) || !data.layouts.length) {
      npmError(String(data.stderr || 'No layouts found for theme ' + theme).slice(0, 160));
      return;
    }
    const layouts = [...new Set(data.layouts.map(String))].sort();
    for (const name of layouts) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      npmLayout.appendChild(opt);
    }
    npmLayout.value = layouts.includes('docs') ? 'docs' : layouts[0];
    npmBlog.hidden = npmLayout.value !== 'blog';
  }

  function openNewPage() {
    if (!edPortal.value) { say('Pick a portal first'); return; }
    npmTitle.value = '';
    npmPath.value = '';
    npmPathEdited = false;
    npmLoadFolders();
    npmLoadLayouts();
    npmAuthor.value = localStorage.getItem('desk.author') || 'Sheriff';
    npmAvatar.value = '';
    npmThumb.value = '';
    npmDate.value = todayStr();
    npmBlog.hidden = true;
    npmErr.hidden = true;
    npModal.hidden = false;
    setTimeout(() => npmTitle.focus(), 50);
  }

  function closeNewPage() { npModal.hidden = true; }

  newBtn.addEventListener('click', openNewPage);
  document.getElementById('npm-close').addEventListener('click', closeNewPage);
  document.getElementById('npm-cancel').addEventListener('click', closeNewPage);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !npModal.hidden) closeNewPage();
  });

  npmTitle.addEventListener('input', () => {
    if (!npmPathEdited) {
      const slug = pageSlug(npmTitle.value);
      npmPath.value = slug ? slug + '.md' : '';
    }
    npmErr.hidden = true;
  });
  npmPath.addEventListener('input', () => { npmPathEdited = true; npmErr.hidden = true; });
  npmLayout.addEventListener('change', () => {
    npmBlog.hidden = npmLayout.value.trim() !== 'blog';
  });

  npmTitle.addEventListener('keydown', e => { if (e.key === 'Enter') createNewPage(); });
  npmPath.addEventListener('keydown', e => { if (e.key === 'Enter') createNewPage(); });

  async function createNewPage() {
    const portal = portalContext.current, revision = portalContext.revision;
    const title = npmTitle.value.trim();
    const file = npmPath.value.trim();
    const path = npmFolderSel.value + '/' + file;
    const layout = npmLayout.value.trim() || 'docs';
    const author = npmAuthor.value.trim() || 'Sheriff';

    if (!title) { npmError('Give the page a title.'); return; }
    if (!file) { npmError('Give the file a name.'); return; }
    if (file.includes('/')) { npmError('Pick the folder above; the file name cannot contain /'); return; }
    if (!file.endsWith('.md') && !file.endsWith('.html')) { npmError('File name must end in .md or .html'); return; }
    if (edFiles.includes(path)) { npmError('That file already exists.'); return; }

    let fm = '^^^^\n'
      + 'title: ' + title + '\n'
      + 'author: ' + author + '\n'
      + 'layout: ' + layout + '\n'
      + 'meta_kind: docs\n'
      + 'meta_type: entry\n'
      + 'summary: \n'
      + 'gloss: \n'
      + 'categories: []\n'
      + 'aliases: []\n';

    if (layout === 'blog') {
      if (!npmAvatar.value.trim() || !npmThumb.value.trim() || !npmDate.value.trim()) {
        npmError('The blog layout requires author avatar, thumb, and date.');
        return;
      }
      fm += 'author_avatar: ' + npmAvatar.value.trim() + '\n'
        + 'thumb: ' + npmThumb.value.trim() + '\n'
        + 'date: ' + npmDate.value.trim() + '\n';
    }

    fm += '^^^^\n\n';
    const body = fm + '# ' + title + '\n\nWrite your page here.\n';

    if (!confirmDiscard()) return;

    npmCreate.disabled = true;
    npmCreate.textContent = 'Creating\u2026';
    try {
      const q = 'portal=' + encodeURIComponent(edPortal.value) + '&path=' + encodeURIComponent(path);
      const res = await fetch('/api/file?write&' + q, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body
      });
      const data = await apiJson(res);
      if (buildFailed(data)) {
        npmError(String(data.stderr || 'Could not create page').trim().slice(0, 160));
        return;
      }
      localStorage.setItem('desk.author', author);
      closeNewPage();
      say('Page created');
      await loadFiles();
      if (!isCurrentPortal(portal, revision)) return;
      openPath(path);
    } catch (err) {
      npmError(err.message || 'API unreachable');
    } finally {
      npmCreate.disabled = false;
      npmCreate.textContent = 'Create page';
    }
  }

  npmCreate.addEventListener('click', createNewPage);

    // ============================================================
  // Media manager
  // ============================================================
  const mdPortal = document.getElementById('desk-portal');
  const mdFolder = document.getElementById('md-folder');
  const mdUploadBtn = document.getElementById('md-upload-btn');
  const mdFileInput = document.getElementById('md-file-input');
  const mdGrid = document.getElementById('md-grid');
  const mdDrop = document.getElementById('md-drop');
  const mdCrumbs = document.getElementById('md-crumbs');
  const mdView = document.getElementById('md-view');

  const lightbox = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  const lbPath = document.getElementById('lb-path');
  const lbCopy = document.getElementById('lb-copy');
  const lbDelete = document.getElementById('lb-delete');
  const lbClose = document.getElementById('lb-close');

  let mediaFiles = [];
  let mediaDirs = [];
  let mediaCwd = 'public';
  let mediaViewMode = localStorage.getItem('desk.mediaView') || 'small';
  let lbCurrent = null;
  let mediaUploading = false, mediaRequest = 0;

  function mediaPortalUrl(subpath) {
    return window.SheriffDeskBackend.assetUrl(mdPortal.value, subpath);
  }

  function sitePath(subpath) {
    return '/' + subpath;
  }

  function mediaCopyText(f) {
    if (IMAGE_EXTS.has(fileExt(f))) {
      // trailboss resolves image tags against public/images/, so the tag
      // path must be relative to public/images/, not public/.
      let rel = f;
      if (rel.startsWith('public/images/')) {
        rel = rel.slice('public/images/'.length);
      } else if (rel.startsWith('public/')) {
        rel = rel.slice('public/'.length);
      }
      return '[[image:' + rel + '|SIZE|ALIGN|CAPTION]]';
    }
    return sitePath(f);
  }

  function mediaCopyLabel(f) {
    return IMAGE_EXTS.has(fileExt(f)) ? 'Copy tag' : 'Copy path';
  }

  function parentOf(p) {
    return p.split('/').slice(0, -1).join('/');
  }

  function mediaEnter() {
    if (mdPortal.value) loadMedia();
  }

  async function loadMedia() {
    if (!mdPortal.value) return;
    const portal = mdPortal.value, revision = portalContext.revision, request = ++mediaRequest;
    mdGrid.innerHTML = '<div class="portal-empty">Loading media…</div>';
    try {
      const res = await fetch('/api/file?list&' + encodeURIComponent(mdPortal.value), { cache: 'no-store' });
      const data = await res.json();
      if (request !== mediaRequest || !isCurrentPortal(portal, revision)) return;
      if (data.ok === false) {
        mdGrid.innerHTML = '<div class="portal-empty">' + (data.stderr || 'Could not load media.') + '</div>';
        return;
      }
      const files = Array.isArray(data.files) ? data.files.map(String) : [];
      const dirs = Array.isArray(data.dirs) ? data.dirs.map(String) : [];
      mediaFiles = files.filter(f => f.startsWith('public/')).sort();

      const dirSet = new Set(dirs.filter(d => d === 'public' || d.startsWith('public/')));
      mediaFiles.forEach(f => {
        let p = parentOf(f);
        while (p && p !== 'public') { dirSet.add(p); p = parentOf(p); }
      });
      dirSet.add('public');
      mediaDirs = Array.from(dirSet).sort();

      if (!mediaDirs.includes(mediaCwd)) mediaCwd = 'public';
      renderMedia();
    } catch (err) {
      if (request !== mediaRequest || !isCurrentPortal(portal, revision)) return;
      mdGrid.innerHTML = '<div class="portal-empty">API unreachable.</div>';
    }
  }

  function renderCrumbs() {
    mdCrumbs.innerHTML = '';
    const parts = mediaCwd.split('/');
    parts.forEach((part, i) => {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'crumb-sep';
        sep.textContent = '\u203a';
        mdCrumbs.appendChild(sep);
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'crumb' + (i === parts.length - 1 ? ' current' : '');
      btn.textContent = part;
      const target = parts.slice(0, i + 1).join('/');
      btn.addEventListener('click', () => {
        mediaCwd = target;
        mdFolder.value = mediaCwd;
        renderMedia();
      });
      wireFolderDrop(btn, target);
      mdCrumbs.appendChild(btn);
    });
  }

  function renderViewToggle() {
    mdView.querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', b.dataset.mv === mediaViewMode);
    });
  }

  mdView.addEventListener('click', e => {
    const btn = e.target.closest('button[data-mv]');
    if (!btn) return;
    mediaViewMode = btn.dataset.mv;
    localStorage.setItem('desk.mediaView', mediaViewMode);
    renderMedia();
  });

  function wireFolderDrop(card, destFolder) {
    card.addEventListener('dragover', e => {
      if (!e.dataTransfer.types.includes('text/desk-media')) return;
      e.preventDefault();
      e.stopPropagation();
      card.classList.add('drop-target');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drop-target'));
    card.addEventListener('drop', e => {
      const from = e.dataTransfer.getData('text/desk-media');
      if (!from) return;
      e.preventDefault();
      e.stopPropagation();
      card.classList.remove('drop-target');
      moveMedia(from, destFolder);
    });
  }

  function renderMedia() {
    renderCrumbs();
    renderViewToggle();
    mdGrid.className = 'media-grid ' + mediaViewMode;
    mdGrid.innerHTML = '';

    const folders = mediaDirs.filter(d => parentOf(d) === mediaCwd);
    const files = mediaFiles.filter(f => parentOf(f) === mediaCwd);

    if (folders.length === 0 && files.length === 0) {
      mdGrid.innerHTML = '<div class="portal-empty">Empty folder. Upload something.</div>';
      return;
    }

    // ".." up-one-level target when nested
    if (mediaCwd !== 'public') {
      const up = parentOf(mediaCwd);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'media-card folder up';
      card.innerHTML = '<div class="media-thumb">'
        + '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12H4"/><path d="M10 18l-6-6 6-6"/></svg>'
        + '</div><div class="media-name">..</div>';
      card.title = 'Up to ' + up;
      card.addEventListener('click', () => {
        mediaCwd = up;
        mdFolder.value = mediaCwd;
        renderMedia();
      });
      wireFolderDrop(card, up);
      mdGrid.appendChild(card);
    }

    folders.forEach(d => {
      const name = d.split('/').pop();
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'media-card folder';
      card.innerHTML = '<div class="media-thumb">'
        + '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
        + '</div><div class="media-name"></div>';
      card.querySelector('.media-name').textContent = name;
      card.title = d;
      card.addEventListener('click', () => {
        mediaCwd = d;
        mdFolder.value = mediaCwd;
        renderMedia();
      });
      wireFolderDrop(card, d);
      mdGrid.appendChild(card);
    });

    files.forEach(f => {
      const name = f.split('/').pop();
      const isImg = IMAGE_EXTS.has(fileExt(f));

      const card = document.createElement('div');
      card.className = 'media-card';
      card.draggable = true;
      card.addEventListener('dragstart', e => {
        e.stopPropagation();
        e.dataTransfer.setData('text/desk-media', f);
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));

      const thumb = document.createElement('div');
      thumb.className = 'media-thumb';
      if (isImg) {
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.alt = name;
        img.src = mediaPortalUrl(f);
        img.addEventListener('error', () => {
          thumb.innerHTML = '<span class="thumb-msg">not built yet</span>';
        });
        thumb.appendChild(img);
        thumb.addEventListener('click', () => openLightbox(f));
        thumb.classList.add('clickable');
      } else {
        thumb.innerHTML = fileIconSvg(name);
      }
      card.appendChild(thumb);

      const label = document.createElement('div');
      label.className = 'media-name';
      label.textContent = name;
      label.title = f;
      card.appendChild(label);

      const acts = document.createElement('div');
      acts.className = 'media-actions';
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn small';
      copyBtn.textContent = mediaCopyLabel(f);
      copyBtn.addEventListener('click', () => copyMediaPath(f));
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn small portal-delete';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => deleteMedia(f));
      acts.appendChild(copyBtn);
      acts.appendChild(delBtn);
      card.appendChild(acts);

      mdGrid.appendChild(card);
    });
  }

  function copyMediaPath(f) {
    const p = mediaCopyText(f);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(p).then(
        () => say('Copied ' + p),
        () => say(p)
      );
    } else {
      say(p);
    }
  }

  async function deleteMedia(f) {
    if (!window.confirm('Delete "' + f + '"? This cannot be undone.')) return;
    try {
      const q = encodeURIComponent(mdPortal.value) + '&' + encodeURIComponent(f);
      const res = await fetch('/api/file?delete&' + q);
      const data = await res.json();
      if (data.ok === false) {
        say(data.stderr || 'Delete failed');
        return;
      }
      say('Deleted ' + f);
      if (lbCurrent === f) closeLightbox();
      await loadMedia();
    } catch (err) {
      say('API unreachable');
    }
  }

  // ---------- uploads ----------
  function cleanFolder() {
    let folder = mdFolder.value.trim().replace(/\\/g, '/').replace(/\/+$/, '');
    if (!folder) folder = 'public';
    if (folder !== 'public' && !folder.startsWith('public/')) {
      return null;
    }
    if (folder.includes('..')) return null;
    return folder;
  }

  async function uploadFiles(fileList) {
    if(mediaUploading){say('An upload is already running.');return;}
    if (!mdPortal.value) { say('Pick a portal first'); return; }
    const folder = cleanFolder();
    if (folder === null) { say('Upload folder must be public/ or a subfolder of it'); return; }
    const files = Array.from(fileList);
    if (files.length === 0) return;
    const portal=mdPortal.value,release=portalContext.lock();
    mediaUploading=true;mdUploadBtn.disabled=true;
    let done = 0;
    try {
    for (const file of files) {
      const subpath = folder + '/' + file.name;
      try {
        const q = encodeURIComponent(portal) + '&' + encodeURIComponent(subpath);
        const res = await fetch('/api/file?upload&' + q, {
          method: 'POST',
          body: file
        });
        const data = await res.json();
        if (data.ok === false) {
          say(file.name + ': ' + (data.stderr || 'upload failed'));
          continue;
        }
        done++;
      } catch (err) {
        say('API unreachable');
        break;
      }
    }

    if (done > 0) {
      await loadMedia();
      say(done + ' file' + (done === 1 ? '' : 's') + ' uploaded. Build the portal when ready.');
    }
    } finally {mediaUploading=false;mdUploadBtn.disabled=false;release();}
  }

  // ---------- new folder ----------
  document.getElementById('md-newfolder').addEventListener('click', () => {
    if (!mdPortal.value) { say('Pick a portal first'); return; }
    openFolderModal({
      portal: mdPortal.value,
      parent: mediaCwd,
      onDone: async target => {
        await loadMedia();
        mediaCwd = target;
        mdFolder.value = mediaCwd;
        renderMedia();
      }
    });
  });

  // ---------- move a file into a folder ----------
  async function moveMedia(from, toFolder) {
    const name = from.split('/').pop();
    const to = toFolder + '/' + name;
    if (from === to) return;
    try {
      const q = encodeURIComponent(mdPortal.value)
        + '&' + encodeURIComponent(from)
        + '&' + encodeURIComponent(to);
      const res = await fetch('/api/file?move&' + q);
      const data = await apiJson(res);
      if (data.ok === false) { say(data.stderr || 'Move failed'); return; }
      say('Moved ' + name + ' to ' + toFolder.replace(/^public\/?/, '') || 'public');
      await loadMedia();
      renderMedia();
    } catch (err) {
      say(err.message || 'API unreachable');
    }
  }

  mdUploadBtn.addEventListener('click', () => mdFileInput.click());
  mdFileInput.addEventListener('change', () => {
    uploadFiles(mdFileInput.files);
    mdFileInput.value = '';
  });

  mdDrop.addEventListener('dragover', e => {
    if (e.dataTransfer.types.includes('text/desk-media')) return;
    e.preventDefault();
    mdDrop.classList.add('drag');
  });
  mdDrop.addEventListener('dragleave', () => mdDrop.classList.remove('drag'));
  mdDrop.addEventListener('drop', e => {
    if (e.dataTransfer.types.includes('text/desk-media')) return;
    e.preventDefault();
    mdDrop.classList.remove('drag');
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      uploadFiles(e.dataTransfer.files);
    }
  });

  // ---------- lightbox ----------
  function openLightbox(f) {
    lbCurrent = f;
    lbImg.src = mediaPortalUrl(f);
    lbPath.textContent = mediaCopyText(f);
    lbCopy.textContent = mediaCopyLabel(f);
    lightbox.hidden = false;
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lbImg.src = '';
    lbCurrent = null;
  }

  lbClose.addEventListener('click', closeLightbox);
  lbCopy.addEventListener('click', () => { if (lbCurrent) copyMediaPath(lbCurrent); });
  lbDelete.addEventListener('click', () => { if (lbCurrent) deleteMedia(lbCurrent); });
  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !lightbox.hidden) closeLightbox();
  });

  // ============================================================
  // Single-file editors (Navigation, Config) + Themes panel
  // ============================================================
  function fillPortalSel(sel) { portalContext.mount(sel); }

  function fileEditor(ids, getPath, opts) {
    const sel = document.getElementById(ids.portal);
    const text = document.getElementById(ids.text);
    const dirtyEl = document.getElementById(ids.dirty);
    const statusEl = document.getElementById(ids.status);
    const saveBtn = document.getElementById(ids.save);
    const buildBtn = document.getElementById(ids.build);

    const ed = { path: null, portal: null, dirty: false, missing: false, saving: false, generation: 0 };
    let loadRequest = 0;

    function setDirty(v) {
      ed.dirty = v;
      dirtyEl.hidden = !v;
      saveBtn.disabled = !v || !ed.path || ed.saving;
      buildBtn.disabled = !ed.path || text.disabled || ed.saving;
      if (opts && opts.onContentChange) opts.onContentChange(text.value, v);
      window.dispatchEvent(new Event('sheriff:editor-change'));
    }
    function setStatus(msg, cls) {
      statusEl.textContent = msg || '';
      statusEl.className = 'ed-status' + (cls ? ' ' + cls : '');
    }

    ed.load = async function () {
      if (!sel.value) return;
      const portal = sel.value, request = ++loadRequest;
      ed.generation++;
      if (opts && opts.onContentChange) opts.onContentChange('', false);
      ed.path = getPath(portal);
      ed.portal = portal;
      text.value = ''; text.disabled = true; setDirty(false);
      setStatus('loading…');
      try {
        const q = 'portal=' + encodeURIComponent(sel.value) + '&path=' + encodeURIComponent(ed.path);
        const res = opts?.read ? await opts.read(portal, ed.path) : await fetch('/api/file?read&' + q);
        const data = await apiJson(res);
        if (request !== loadRequest || sel.value !== portal) return;
        if (data.ok === false) {
          if (opts?.read) throw new Error(data.stderr || "Could not load configuration.");
          ed.missing = true;
          text.value = '';
          text.disabled = false;
          setStatus('(new file — Save creates it)');
        } else {
          ed.missing = false;
          text.value = data.content || '';
          ed.original = text.value;
          text.disabled = false;
          setStatus('');
        }
        resetTextStart(text);
        setDirty(false);
      } catch (err) {
        if (request !== loadRequest || sel.value !== portal) return;
        setStatus(err.message || 'API unreachable', 'err');
      }
    };

    ed.save = async function (build='none') {
      if (!ed.path || ed.saving || text.disabled || ed.portal !== sel.value || (build==='none'&&!ed.dirty)) return;
      const portal=ed.portal,path=ed.path,content=text.value,generation=ed.generation;
      const current=()=>ed.portal===portal&&ed.path===path&&ed.generation===generation;
      ed.saving = true;
      window.dispatchEvent(new Event('sheriff:editor-change'));
      saveBtn.disabled = true;
      buildBtn.disabled = true;text.disabled=true;
      (build==='none'?saveBtn:buildBtn).textContent=build==='none'?'Saving…':'Building…';
      const buildScope = opts?.buildScope?.(path) || 'portal';
      setStatus(build==='none'?'Saving…':'Saving and rebuilding ' + buildScope + '…');
      const started = Date.now();
      try {
        const q = 'portal=' + encodeURIComponent(portal) + '&path=' + encodeURIComponent(path);
        const res = opts?.write ? await opts.write(portal,path,content,build,ed.original) : await fetch('/api/file?write&' + q + '&build='+build, {
          method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: content
        });
        const data = await apiJson(res);
        const saved=data.saved===true||!buildFailed(data);
        if(saved){ed.original=content;if(opts?.onSave)opts.onSave(portal);}
        if(!current())return;
        setDirty(saved?text.value!==content:true);
        if (buildFailed(data)) {
          setStatus((saved?'✓ saved · ':'')+(build==='none'?'save failed — ':Number.isFinite(data.upload_ms)?'upload failed — ':'build failed — ')+String(data.stderr || '').trim().slice(0,120), 'err');
          return;
        }
        setStatus(build==='none'?'✓ saved':'✓ saved · '+buildScope+' '+(data.published?'built and published':'rebuilt')+' · '+window.SheriffBuildLog.duration(data,Date.now()-started),'ok');
      } catch (err) {
        if(current()){setStatus(err.message || 'API unreachable', 'err');setDirty(true);}
      } finally {
        ed.saving = false;
        window.dispatchEvent(new Event('sheriff:editor-change'));
        saveBtn.textContent='Save';buildBtn.textContent='Save & rebuild';
        if(current())text.disabled=false;
        setDirty(ed.dirty);
      }
    };

    ed.reset = function () {
      loadRequest++; ed.generation++; ed.path = null; ed.portal = null; ed.missing = false;
      text.value = ''; text.disabled = true; setDirty(false); setStatus('');
    };

    ed.enter = function () {
      fillPortalSel(sel);
      if (sel.value && !ed.dirty) ed.load();
    };

    text.addEventListener('input', () => setDirty(true));
    saveBtn.addEventListener('click',()=>ed.save());
    buildBtn.addEventListener('click',()=>ed.save('portal'));

    return ed;
  }

  const nvEditor = fileEditor(
    { portal: 'desk-portal', text: 'nv-text', dirty: 'nv-dirty', status: 'nv-status', save: 'nv-save', build:'nv-build' },
    () => 'nav.yall'
  );

  let cfScope = 'portal';
  function configEnter() {
    const match = window.SheriffSites?.member(portalContext.current);
    const member = match?.site.grouped ? match : null;
    if (!member) cfScope = 'portal';
    document.getElementById('cf-scope').hidden = !member;
    for (const scope of ['site','portal']) {
      const button = document.getElementById('cf-' + scope);
      button.classList.toggle('active',cfScope === scope);
      button.setAttribute('aria-pressed',String(cfScope === scope));
    }
    document.getElementById('cf-scope-note').textContent = cfScope === 'site'
      ? member.site.name + ' — site.yall. Shared site settings, including multisite themes. Save keeps your changes; Save & rebuild updates the whole site.'
      : 'Portal configuration (config.yall). Save keeps your changes. Save & rebuild updates only the selected portal.';
    cfEditor.enter();
  }
  for (const scope of ['site','portal']) document.getElementById('cf-' + scope).addEventListener('click',()=>{
    if (cfScope === scope || cfEditor.saving) return;
    if (cfEditor.dirty && !window.confirm('Discard unsaved configuration edits and switch?')) return;
    cfEditor.reset(); cfScope = scope; configEnter();
  });

  const cfEditor = fileEditor(
    { portal: 'desk-portal', text: 'cf-text', dirty: 'cf-dirty', status: 'cf-status', save: 'cf-save', build:'cf-build' },
    () => cfScope === 'site' ? 'site.yall' : 'config.yall',
    {
      buildScope: path => path === 'site.yall' ? 'site' : 'portal',
      read: (portal,path) => path === 'site.yall'
        ? window.SheriffDeskBackend.request('sites.config_read',{site:window.SheriffSites.member(portal).site.id})
        : fetch('/api/file?read&portal='+encodeURIComponent(portal)+'&path=config.yall'),
      async write(portal,path,content,build,previous) {
        if (path !== 'site.yall') return fetch('/api/file?write&portal='+encodeURIComponent(portal)+'&path=config.yall&build='+build,{method:'POST',headers:{'Content-Type':'text/plain'},body:content});
        const site = window.SheriffSites.member(portal).site.id;
        const response = await window.SheriffDeskBackend.request('sites.config_write',{site},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content,previous})});
        const saved = await response.clone().json();
        if (!response.ok || saved.ok === false) return response;
        await window.SheriffSites.refresh();
        await window.SheriffPendingBuilds?.refresh();
        if (build === 'none') return response;
        const rebuilt = await fetch('/api/sites?build&site='+encodeURIComponent(site),{method:'POST'});
        return new Response(JSON.stringify({...await rebuilt.json(),saved:true}),{status:rebuilt.status,headers:{'Content-Type':'application/json'}});
      },
      onContentChange(text,dirty) {
        window.SheriffModules?.refresh();
        if (cfScope === 'site') document.getElementById('cf-version-badges').hidden = true;
        else renderConfigVersionBadges(text,dirty);
      },
      onSave: portal => { loadPortalIdentity(portal); thLoadedPortal = null; }
    }
  );

  // Modules and Config share one guarded buffer and the same persistence/build actions.
  window.SheriffModuleConfig={
    enter(){
      const grouped=!!window.SheriffSites?.member(portalContext.current)?.site.grouped,next=grouped?'site':'portal';
      if(cfScope!==next){
        if(cfEditor.saving)return false;
        if(cfEditor.dirty&&!window.confirm('Discard unsaved portal configuration edits and open site-wide module settings?'))return false;
        cfEditor.reset();cfScope=next;
      }
      if(!cfEditor.saving)configEnter();return true;
    },
    state(){const text=document.getElementById('cf-text'),site=window.SheriffSites?.member(portalContext.current)?.site;return {text:text.value,disabled:text.disabled,dirty:cfEditor.dirty,saving:cfEditor.saving,scope:cfScope,portal:portalContext.current,grouped:!!site?.grouped,siteName:site?.name||''};},
    patch(before,content){const text=document.getElementById('cf-text');if(typeof content!=='string'||text.disabled||cfEditor.saving||before.portal!==portalContext.current||before.scope!==cfScope||text.value!==before.text)return false;text.value=content;text.dispatchEvent(new Event('input',{bubbles:true}));return true;},
    save(build){return cfEditor.save(build?'portal':'none');}
  };
  window.addEventListener('sheriff:sites-change',()=>{
    if(currentViewKey()==='modules'&&!cfEditor.dirty&&!cfEditor.saving){window.SheriffModuleConfig.enter();window.SheriffModules.enter();}
    if (currentViewKey() === 'config' && !cfEditor.dirty && !cfEditor.saving) configEnter();
  });

  // ---------- Themes panel ----------
  const thPortal = document.getElementById('desk-portal');
  const thCards = document.getElementById('th-cards');
  const thTabs = document.getElementById('th-tabs');
  let thCurrentTheme = null;   // the theme the portal actually uses
  let thSelected = null;       // the theme whose files are shown below
  let thFile = 'templates.yall';
  let thLoadedPortal = null, thRequest = 0;
  let thApplying = false;
  let thSharedSite = "";

  const thEditor = fileEditor(
    { portal: 'desk-portal', text: 'th-text', dirty: 'th-dirty', status: 'th-status', save: 'th-save', build:'th-build' },
    () => 'themes/' + thSelected + '/' + thFile
  );

  function thSave() { thEditor.save(); }

  function renderThTabs() {
    thTabs.innerHTML = '';
    ['templates.yall', 'override.css'].forEach(f => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cfg-tab' + (f === thFile ? ' active' : '');
      b.textContent = f;
      b.addEventListener('click', () => {
        if (thApplying) return;
        if (thEditor.dirty && !window.confirm('Unsaved changes will be lost. Continue?')) return;
        thFile = f;
        renderThTabs();
        if (thSelected) thEditor.load();
      });
      thTabs.appendChild(b);
    });
  }

  async function detectCurrentTheme(portal) {
    const res = await fetch('/api/theme_config?' + encodeURIComponent(portal));
    const data = await apiJson(res);
    if (!res.ok || data.ok === false) throw new Error(data.stderr || 'Could not read the active theme.');
    thSharedSite = data.shared_site || "";
    return data.theme;
  }

  let themeCardsRequest=0;
  async function renderThemeCards() {
    const revision = portalContext.revision, request=++themeCardsRequest;
    thCards.innerHTML = '<div class="tree-msg">Loading themes…</div>';
    let themes = [];
    try {
      const res = await fetch('/api/list_themes');
      const data = await apiJson(res);
      if (revision !== portalContext.revision || request !== themeCardsRequest) return;
      themes = Array.isArray(data.themes) ? data.themes : [];
    } catch (err) {
      if (revision !== portalContext.revision || request !== themeCardsRequest) return;
      thCards.innerHTML = '<div class="tree-msg">Could not load themes.</div>';
      return;
    }

    thCards.innerHTML = '';
    themes.forEach(t => {
      const card = document.createElement('div');
      card.className = 'theme-card' + (t === thSelected ? ' selected' : '');

      // Preview: served from the current portal's built public if this theme
      // ships a preview.png; falls back to a star placeholder otherwise.
      const preview = document.createElement('div');
      preview.className = 'theme-preview';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = t + ' preview';
      img.src = (window.SheriffDeskBackend.mode === 'cloud' ? '/desk/admin/' : '/admin/') + 'theme-previews/' + t + '.png';
      img.addEventListener('error', () => {
        preview.classList.add('noimg');
        preview.innerHTML = '<svg class="star teal"><use href="#badge-star"/></svg>';
      });
      preview.appendChild(img);
      card.appendChild(preview);

      const body = document.createElement('div');
      body.className = 'theme-body';
      let badges = '';
      if (t === thCurrentTheme) badges += '<span class="pill ok">current</span>';
      body.innerHTML = '<span class="theme-name"></span>' + badges;
      body.querySelector('.theme-name').textContent = t;
      card.appendChild(body);

      if (t !== thCurrentTheme && t === thSelected) {
        const wrap = document.createElement('div');
        wrap.className = 'theme-apply-wrap';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn small primary theme-apply';
        btn.textContent = thSharedSite ? 'Apply to site & rebuild' : 'Apply & rebuild';
        btn.addEventListener('click', e => { e.stopPropagation(); switchTheme(t); });
        wrap.appendChild(btn);
        card.appendChild(wrap);
      }

      card.addEventListener('click', () => selectTheme(t));
      thCards.appendChild(card);
    });
  }

  function selectTheme(t) {
    if (thApplying) return;
    if (t === thSelected) return;
    if (thEditor.dirty && !window.confirm('Unsaved changes will be lost. Continue?')) return;
    thSelected = t;
    thEditor.reset();
    ensureAndLoadTheme(t);
    renderThemeCards();
  }

  async function ensureAndLoadTheme(theme) {
    const portal = thPortal.value, revision = portalContext.revision;
    // A theme the portal has never used has no files yet; seed them so the
    // editor can show templates.yall / override.css without an Apply.
    try {
      await fetch('/api/ensure_theme?' + encodeURIComponent(thPortal.value) + '&' + encodeURIComponent(theme));
    } catch (err) { /* editor will show (new file) if this fails */ }
    if (isCurrentPortal(portal, revision) && thSelected === theme) thEditor.load();
  }

  async function switchTheme(theme) {
    const portal = thPortal.value;
    if (!portal || thApplying) return;
    if (thEditor.saving || document.getElementById('th-text').disabled || thEditor.path !== 'themes/' + theme + '/' + thFile) { say('Wait for the theme file to finish loading.'); return; }
    if (cfEditor.dirty || thEditor.dirty) { say('Save your Config and Themes edits before applying a theme.'); return; }
    const scope = thSharedSite || portal;
    if (!window.confirm('Switch ' + scope + (thSharedSite ? ' and all its portals' : '') + ' to the "' + theme + '" theme and rebuild?')) return;
    thApplying = true; thEditor.saving = true;
    const release = portalContext.lock();
    const text = document.getElementById('th-text');
    text.disabled = true;
    document.getElementById('th-save').disabled = true;
    document.getElementById('th-build').disabled = true;
    try {
      let res = await fetch('/api/ensure_theme?' + encodeURIComponent(portal) + '&' + encodeURIComponent(theme));
      let data = await apiJson(res);
      if (data.ok === false) { say(data.stderr || 'Theme prep failed'); return; }

      if (thSharedSite) {
        res = await fetch('/api/sites?theme&site=' + encodeURIComponent(thSharedSite), {
          method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id:thSharedSite,theme})
        });
        data = await apiJson(res);
        if (!res.ok || data.ok === false) { say(data.stderr || 'Could not save the site theme'); return; }
        say('Switching shared theme — rebuilding site…');
        res = await fetch('/api/sites?build&site=' + encodeURIComponent(thSharedSite), {method:'POST'});
        data = await apiJson(res);
        if (buildFailed(data)) { say('Theme saved; rebuild failed — ' + String(data.stderr || '').slice(0,120)); return; }
        thCurrentTheme = theme; thSelected = theme;
        await window.SheriffSites?.refresh();
        renderThemeCards(); loadPortalIdentity(portal); await thEditor.load();
        say(scope + ' and its portals now use ' + theme);
        return;
      }
      res = await fetch('/api/theme_config?' + encodeURIComponent(portal) + '&' + encodeURIComponent(theme));
      data = await apiJson(res);
      if (!res.ok || data.ok === false) { say(data.stderr || 'Could not prepare config.yall'); return; }
      const updated = data.content;
      const q = 'portal=' + encodeURIComponent(portal) + '&path=config.yall';

      say('Switching theme — rebuilding…');
      res = await fetch('/api/file?write&' + q + '&build=portal', {
        method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: updated
      });
      data = await apiJson(res);
      if (data.saved === true || !buildFailed(data)) {
        thCurrentTheme = theme; thSelected = theme;
        renderThemeCards(); loadPortalIdentity(portal);
      }
      if (buildFailed(data)) { say('Rebuild failed — ' + String(data.stderr || '').slice(0, 120)); return; }

      thCurrentTheme = theme;
      thSelected = theme;
      renderThemeCards();
      await thEditor.load();
      say(portal + ' now uses ' + theme);
    } catch (err) {
      say(err.message || 'API unreachable');
    } finally {
      thApplying = false; thEditor.saving = false; release();
      text.disabled = !thEditor.path;
      document.getElementById('th-save').disabled = !thEditor.path || !thEditor.dirty;
      document.getElementById('th-build').disabled = !thEditor.path;
    }
  }

  async function themesEnter() {

    const portal = thPortal.value, revision = portalContext.revision, request = ++thRequest;
    if (!portal || thLoadedPortal === portal || thEditor.saving || thApplying || thEditor.dirty && thEditor.portal === portal) return;
    thEditor.reset(); thCurrentTheme = null; thSelected = null;
    thCards.textContent = 'Loading themes…';
    let theme;
    try { theme = await detectCurrentTheme(portal); }
    catch (error) {
      if (request === thRequest && isCurrentPortal(portal, revision)) { thCards.textContent = error.message; thEditor.reset(); }
      return;
    }
    if (request !== thRequest || !isCurrentPortal(portal, revision)) return;
    thLoadedPortal = portal; thCurrentTheme = theme; thSelected = theme;
    renderThemeCards(); renderThTabs();
    if (thSelected) await ensureAndLoadTheme(thSelected);
  }

  // ---------- help drawer ----------
  const helpDrawer = document.getElementById('help-drawer');
  const hdTitle = document.getElementById('hd-title');
  const hdBody = document.getElementById('hd-body');
  const hdDocs = document.getElementById('hd-docs');

  function openHelp(key) {
    const help = window.DESK_HELP && window.DESK_HELP[key];
    if (!help) { say('No help written for this section yet'); return; }
    const modal = document.querySelector('dialog[open]');
    (modal || document.body).appendChild(helpDrawer);
    hdTitle.textContent = help.title;
    hdDocs.href = help.docs || 'https://sheriff.sheriffcloud.com';
    hdBody.innerHTML = '';
    help.sections.forEach((s, i) => {
      const d = document.createElement('details');
      if (i === 0) d.open = true;
      const sum = document.createElement('summary');
      sum.textContent = s.title;
      d.appendChild(sum);
      const div = document.createElement('div');
      div.className = 'hd-section';
      div.innerHTML = s.html;
      d.appendChild(div);
      hdBody.appendChild(d);
    });
    helpDrawer.hidden = false;
  }

  function closeHelp() {
    helpDrawer.hidden = true;
    if (helpDrawer.parentElement !== document.body) document.body.appendChild(helpDrawer);
  }
  document.addEventListener('close', event => {
    if (event.target.matches?.('dialog') && event.target.contains(helpDrawer)) closeHelp();
  }, true);

  // draggable: grab the header, position persists
  const makeFloatingPanel = window.SheriffFloatingPanel;
  makeFloatingPanel(helpDrawer, 'desk.helpPos');

  document.addEventListener('click', e => {
    const btn = e.target.closest('.help-btn');
    if (btn) openHelp(btn.dataset.help);
  });
  document.getElementById('hd-close').addEventListener('click', closeHelp);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !helpDrawer.hidden) { e.preventDefault(); closeHelp(); }
  });

  // ---------- resizable file tree ----------
  const resizer = document.getElementById('ed-resizer');
  const editorShell = document.querySelector('.editor-shell');

  const savedW = parseInt(localStorage.getItem('desk.treeWidth'), 10);
  if (savedW >= 180 && savedW <= 560) {
    editorShell.style.setProperty('--tree-w', savedW + 'px');
  }

  resizer.addEventListener('pointerdown', e => {
    e.preventDefault();
    resizer.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startW = editorShell.querySelector('.editor-side').getBoundingClientRect().width;

    function onMove(ev) {
      const w = Math.min(560, Math.max(180, Math.round(startW + (ev.clientX - startX))));
      editorShell.style.setProperty('--tree-w', w + 'px');
    }
    function onUp() {
      resizer.releasePointerCapture(e.pointerId);
      resizer.removeEventListener('pointermove', onMove);
      resizer.removeEventListener('pointerup', onUp);
      const w = editorShell.querySelector('.editor-side').getBoundingClientRect().width;
      localStorage.setItem('desk.treeWidth', String(Math.round(w)));
    }
    resizer.addEventListener('pointermove', onMove);
    resizer.addEventListener('pointerup', onUp);
  });

  // warn on tab close with unsaved changes
  window.addEventListener('beforeunload', e => {
    if (unsavedPanels().length || operationBusy()) { e.preventDefault(); e.returnValue = ''; }
  });

  // ============================================================
  // First-run wizard
  // ============================================================
  const wizard = document.getElementById('wizard');
  const wizClose = document.getElementById('wiz-close');
  const wizDots = document.getElementById('wiz-dots');
  const wzName = document.getElementById('wz-name');
  const wzSlug = document.getElementById('wz-slug');
  const wzSlugPreview = document.getElementById('wz-slug-preview-compat');
  const wzNameErr = document.getElementById('wz-name-err');
  const wzThemes = document.getElementById('wz-themes');
  const wzLogoDrop = document.getElementById('wz-logo-drop');
  const wzLogoInput = document.getElementById('wz-logo-input');
  const wzLogoBrowse = document.getElementById('wz-logo-browse');
  const wzLogoEmpty = document.getElementById('wz-logo-empty');
  const wzLogoPreview = document.getElementById('wz-logo-preview');
  const wzLogoImg = document.getElementById('wz-logo-img');
  const wzLogoClear = document.getElementById('wz-logo-clear');
  const wzPageTitle = document.getElementById('wz-page-title');
  const wzPageBody = document.getElementById('wz-page-body');
  const wzProgress = document.getElementById('wz-progress');
  const wzRunTitle = document.getElementById('wz-run-title');
  const wzDone = document.getElementById('wz-done');
  const wzViewSite = document.getElementById('wz-view-site');
  const wizFoot = document.getElementById('wiz-foot');
  const wzRunErr = document.getElementById('wz-run-err');
  const wzBack = document.getElementById('wz-back');
  const wzSkip = document.getElementById('wz-skip');
  const wzNext = document.getElementById('wz-next');
  const npWizard = document.getElementById('np-wizard');

  const WIZ_STEPS = 5;
  let wiz = null;
  let wizAutoShown = false;

  function maybeAutoWizard() {
    if (wizAutoShown) return;
    wizAutoShown = true;
    openWizard();
  }

  function slugify(s) {
    return s.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function openWizard(options={}) {
    wiz = {
      step: 1, running: false,
      name: '', slug: '', slugEdited: false,
      theme: 'outpost',
      logoFile: null,
      pageTitle: '', pageBody: ''
    };
    wzName.value = '';
    wzSlug.value = '';
    wzSlugPreview.textContent = 'name';
    wzNameErr.hidden = true;
    wzPageTitle.value = '';
    wzPageBody.value = '';
    clearWizLogo();
    resetProgress();
    wzDone.hidden = true;
    wzRunErr.hidden = true;
    loadWizThemes();
    window.SheriffSites?.configure(wiz, options);
    wizGoto(1);
    wizard.hidden = false;
    setTimeout(() => wzName.focus(), 50);
  }

  function closeWizard() {
    if (wiz && wiz.running) return;
    wizard.hidden = true;
    wiz = null;
  }

  wizClose.addEventListener('click', closeWizard);
  npWizard.addEventListener('click', openWizard);
  document.getElementById('dash-wizard').addEventListener('click', openWizard);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !wizard.hidden) closeWizard();
  });

  function wizGoto(step) {
    wiz.step = step;
    document.querySelectorAll('.wiz-step').forEach(s => {
      s.hidden = Number(s.dataset.step) !== step;
    });
    wizDots.innerHTML = '';
    for (let i = 1; i <= WIZ_STEPS; i++) {
      const d = document.createElement('span');
      d.className = 'wiz-dot' + (i === step ? ' on' : i < step ? ' done' : '');
      wizDots.appendChild(d);
    }
    wizFoot.hidden = step === 5;
    wzBack.hidden = step === 1;
    wzSkip.hidden = step !== 3;
    wzNext.textContent = step === 4 ? 'Create my site' : 'Next';
  }

  wzBack.addEventListener('click', () => { if (wiz.step > 1) wizGoto(wiz.step - 1); });
  wzSkip.addEventListener('click', () => {
    clearWizLogo();
    wizGoto(4);
  });

  wzNext.addEventListener('click', () => {
    if (wiz.step === 1) {
      if (!validateWizName()) return;
      wizGoto(2);
    } else if (wiz.step === 2) {
      wizGoto(3);
    } else if (wiz.step === 3) {
      wizGoto(4);
    } else if (wiz.step === 4) {
      wiz.pageTitle = wzPageTitle.value.trim() || 'Welcome';
      wiz.pageBody = wzPageBody.value.trim();
      wizGoto(5);
      runWizard();
    }
  });

  // step 1: name/slug
  wzName.addEventListener('input', () => {
    wiz.name = wzName.value.trim();
    if (!wiz.slugEdited) {
      wiz.slug = slugify(wiz.name);
      wzSlug.value = wiz.slug;
    }
    wzSlugPreview.textContent = wiz.slug || 'name';
    wzNameErr.hidden = true;
  });
  wzSlug.addEventListener('input', () => {
    wiz.slugEdited = true;
    wiz.slug = wzSlug.value.trim();
    wzSlugPreview.textContent = wiz.slug || 'name';
    wzNameErr.hidden = true;
  });

  function wizErr(msg) {
    wzNameErr.textContent = msg;
    wzNameErr.hidden = false;
  }

  function validateWizName() {
    if (!wiz.name) { wizErr('Give your site a name.'); return false; }
    if (!wiz.slug) { wizErr('The address can\u2019t be empty.'); return false; }
    if (!PORTAL_NAME_RE.test(wiz.slug)) {
      wizErr('Address may only use lowercase letters, numbers, and hyphens.');
      return false;
    }
    if (RESERVED_PORTALS.has(wiz.slug)) {
      wizErr('"' + wiz.slug + '" is reserved by Sheriff Desk.');
      return false;
    }
    if (wiz.structure!=='portal' && (portalNames.includes(wiz.slug)||window.SheriffSites?.siteIdExists(wiz.slug))) {
      wizErr('A portal named "' + wiz.slug + '" already exists.');
      return false;
    }
    return true;
  }

  // step 2: themes
  async function loadWizThemes() {
    wzThemes.innerHTML = '<div class="tree-msg">Loading themes\u2026</div>';
    let themes = ['outpost'];
    try {
      const res = await fetch('/api/list_themes');
      const data = await res.json();
      if (Array.isArray(data.themes) && data.themes.length) themes = data.themes;
    } catch (err) { /* fall back to outpost */ }

    if (!themes.includes(wiz.theme)) wiz.theme = themes[0];
    wzThemes.innerHTML = '';
    themes.forEach(t => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'theme-card' + (t === wiz.theme ? ' selected' : '');
      card.innerHTML = '<svg class="star teal"><use href="#badge-star"/></svg><span class="theme-name"></span>';
      card.querySelector('.theme-name').textContent = t;
      card.addEventListener('click', () => {
        wiz.theme = t;
        wzThemes.querySelectorAll('.theme-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
      wzThemes.appendChild(card);
    });
  }

  // step 3: logo
  function clearWizLogo() {
    if (wiz) wiz.logoFile = null;
    wzLogoImg.src = '';
    wzLogoPreview.hidden = true;
    wzLogoEmpty.hidden = false;
  }
  function setWizLogo(file) {
    if (!file || !file.type.startsWith('image/')) { say('Pick an image file'); return; }
    wiz.logoFile = file;
    wzLogoImg.src = URL.createObjectURL(file);
    wzLogoEmpty.hidden = true;
    wzLogoPreview.hidden = false;
  }
  wzLogoBrowse.addEventListener('click', () => wzLogoInput.click());
  wzLogoInput.addEventListener('change', () => {
    if (wzLogoInput.files.length) setWizLogo(wzLogoInput.files[0]);
    wzLogoInput.value = '';
  });
  wzLogoClear.addEventListener('click', clearWizLogo);
  wzLogoDrop.addEventListener('dragover', e => { e.preventDefault(); wzLogoDrop.classList.add('drag'); });
  wzLogoDrop.addEventListener('dragleave', () => wzLogoDrop.classList.remove('drag'));
  wzLogoDrop.addEventListener('drop', e => {
    e.preventDefault();
    wzLogoDrop.classList.remove('drag');
    if (e.dataTransfer.files.length) setWizLogo(e.dataTransfer.files[0]);
  });

  // step 5: run
  function resetProgress() {
    wzProgress.querySelectorAll('li').forEach(li => {
      li.className = '';
    });
  }
  function markTask(task, state) {
    const li = wzProgress.querySelector('li[data-task="' + task + '"]');
    if (li) li.className = state;
  }

  async function runWizard() {
    wiz.running = true;
    wzRunTitle.textContent = 'Creating your site';
    wzRunErr.hidden = true;
    wzDone.hidden = true;
    resetProgress();

    try {
      if(wiz.structure&&wiz.structure!=='single'){
        const created=await window.SheriffSites.createWizard(wiz,markTask); await loadPortals(created.portal);renderManageList();
        wzRunTitle.textContent='Your site is ready';wzViewSite.href=created.url;wzViewSite.hidden=false;wzDone.hidden=false;wiz.running=false;
        return;
      }
      // 1. create portal
      markTask('create', 'doing');
      const brand = wiz.name.replace(/["']/g, '');
      let res = await fetch('/api/portal?create&' + encodeURIComponent(wiz.slug)
        + '&' + encodeURIComponent(wiz.theme)
        + '&' + encodeURIComponent(brand));
      let data = await apiJson(res);
      if (data.ok === false) throw new Error(data.stderr || 'create failed');
      markTask('create', 'done');

      // 2. logo (optional)
      if (wiz.logoFile) {
        markTask('logo', 'doing');
        const ext = (wiz.logoFile.name.split('.').pop() || 'png').toLowerCase();
        const logoPath = 'public/logo.' + (ext === 'png' ? 'png' : ext);
        res = await fetch('/api/file?upload&' + encodeURIComponent(wiz.slug)
          + '&' + encodeURIComponent('public/logo.png'), {
          method: 'POST', body: wiz.logoFile
        });
        data = await apiJson(res);
        if (data.ok === false) throw new Error(data.stderr || 'logo upload failed');
        markTask('logo', 'done');
      } else {
        markTask('logo', 'skip');
      }

      // 3. first page
      markTask('page', 'doing');
      const fm = '^^^^\n'
        + 'title: ' + wiz.pageTitle + '\n'
        + 'author: Sheriff\n'
        + 'layout: docs\n'
        + 'meta_kind: overview\n'
        + 'meta_type: docs\n'
        + 'summary: \n'
        + 'gloss: \n'
        + 'categories: []\n'
        + 'aliases: []\n'
        + '^^^^\n\n';
      const body = fm + '# ' + wiz.pageTitle + '\n\n' + (wiz.pageBody || 'Welcome to ' + wiz.name + '.') + '\n';
      res = await fetch('/api/file?write&portal=' + encodeURIComponent(wiz.slug)
        + '&path=' + encodeURIComponent('content/index.md'), {
        method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body
      });
      data = await apiJson(res);
      if (buildFailed(data)) throw new Error(data.stderr || 'page write failed');
      markTask('page', 'done');

      // Setup finishes with a working local preview, for every site structure.
      markTask('build', 'doing');
      res = await fetch('/api/build?' + encodeURIComponent(wiz.slug));
      data = await apiJson(res);
      if (buildFailed(data)) throw new Error(data.stderr || 'build failed');
      markTask('build', 'done');

      wzRunTitle.textContent = 'Your site is ready';
      wzViewSite.href = window.SheriffDeskBackend.portalUrl(wiz.slug);
      wzViewSite.hidden = false;
      wzDone.hidden = false;
      wiz.running = false;

      await loadPortals();
      renderManageList();
    } catch (err) {
      wiz.running = false;
      wzRunTitle.textContent = 'Something went wrong';
      wzRunErr.textContent = String(err.message || err).slice(0, 200);
      wzRunErr.hidden = false;
      wzProgress.querySelectorAll('li.doing').forEach(li => { li.className = 'fail'; });
    }
  }

  // ============================================================
  // Patterns panel (edit, copy templates, and reuse shared content)
  // ============================================================
  const patPortal = document.getElementById('desk-portal');
  const patList = document.getElementById('pat-list');
  const patText = document.getElementById('pat-text');
  const patName = document.getElementById('pat-name');
  const patTokenEl = document.getElementById('pat-token');
  const patCopyScaffold = document.getElementById('pat-copy-scaffold');
  const patCopyToken = document.getElementById('pat-copy-token');
  const patMode = document.getElementById('pat-mode');
  const patModeHint = document.getElementById('pat-mode-hint');

  const patStatus = document.getElementById('pat-status');
  const patDirty = document.getElementById('pat-dirty');
  const patSave = document.getElementById('pat-save');
  const patDelete = document.getElementById('pat-delete');
  const patNewBtn = document.getElementById('pat-new');

  let patItems = [];
  let patSelected = null;
  let patDirtyFlag = false, patSaving = false;

  // Modes belong to each block; legacy blocks remain reusable.
  const {patternHeader:parsePatternHeader,setPatternMode,patternToken}=window.SheriffPatternOptions;

  let patLoadedPortal = null, patRequest = 0;
  function patternsEnter() {
    fillPortalSel(patPortal);
    if (patPortal.value && patLoadedPortal !== patPortal.value && !patDirtyFlag && !patSaving) loadPatterns();
  }


  async function loadPatterns() {
    if (!patPortal.value) return;
    const portal = patPortal.value, revision = portalContext.revision, request = ++patRequest;
    patList.innerHTML = '<div class="tree-msg">Loading…</div>';
    patSelected = null;
    clearPatternPreview();
    try {
      const res = await fetch('/api/list_patterns?' + encodeURIComponent(patPortal.value));
      const data = await apiJson(res);
      if (request !== patRequest || !isCurrentPortal(portal, revision)) return;
      if (data.ok === false) {
        patList.innerHTML = '<div class="tree-msg">' + (data.stderr || 'Could not load patterns.') + '</div>';
        return;
      }
      patLoadedPortal = portal;
      patItems = Array.isArray(data.patterns) ? data.patterns : [];
      renderPatternList();
    } catch (err) {
      if (request !== patRequest || !isCurrentPortal(portal, revision)) return;
      patList.innerHTML = '<div class="tree-msg">' + (err.message || 'API unreachable') + '</div>';
    }
  }

  function renderPatternList() {
    if (patItems.length === 0) {
      patList.innerHTML = '<div class="tree-msg">No patterns yet. Add .txt scaffolds in this portal\u2019s patterns/ folder.</div>';
      return;
    }
    patList.innerHTML = '';
    patItems.forEach((p, i) => {
      const header = parsePatternHeader(p.body);
      const name = header ? header.name : p.filename.replace(/\.txt$/, '');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pat-item' + (i === patSelected ? ' active' : '');
      btn.innerHTML = '<span class="pat-item-name"></span>'
        + (header ? '<span class="pat-item-orient">' + (header.mode === 'template' ? 'Template' : 'Reusable') + '</span>' : '');
      btn.querySelector('.pat-item-name').textContent = name;
      btn.title = p.filename;
      btn.addEventListener('click', () => selectPattern(i));
      patList.appendChild(btn);
    });
  }

  function clearPatternPreview() {
    patText.value = '';
    patText.disabled = true;
    patName.textContent = 'No pattern selected';
    patTokenEl.textContent = '';
    patTokenEl.hidden = true;
    patMode.value = 'reusable';
    patMode.disabled = true;
    patModeHint.textContent = 'Select a pattern to choose how it is used.';
    patCopyScaffold.textContent = 'Copy template';
    patCopyToken.hidden = true;
    patCopyScaffold.disabled = true;
    patCopyToken.disabled = true;
    patSave.disabled = true;
    patDelete.disabled = true;
    setPatDirty(false);
  }

  function setPatDirty(v) {
    patDirtyFlag = v;
    patDirty.hidden = !v;
    patSave.disabled = patSaving || !v || patSelected === null;
    const header = parsePatternHeader(patText.value);
    patCopyToken.disabled = v || !header || header.mode !== 'reusable';
  }

  function setPatStatus(msg, cls) {
    patStatus.textContent = msg || '';
    patStatus.className = 'ed-status' + (cls ? ' ' + cls : '');
  }

  function selectPattern(i) {
    if (patSaving) return;
    if (patDirtyFlag && !window.confirm('Unsaved changes will be lost. Continue?')) return;
    patSelected = i;
    const p = patItems[i];
    patText.value = p.body;
    patText.disabled = false;
    resetTextStart(patText);
    refreshPatternMeta();
    patCopyScaffold.disabled = false;
    patDelete.disabled = false;
    setPatDirty(false);
    setPatStatus('');
    renderPatternList();
  }

  function refreshPatternMeta() {
    const header = parsePatternHeader(patText.value);
    patName.textContent = header ? header.name : '(no pattern header)';
    const reusable = !!header && header.mode === 'reusable';
    patTokenEl.textContent = reusable ? patternToken(header.name) : '';
    patTokenEl.hidden = !reusable;
    patCopyToken.hidden = !reusable;
    patCopyToken.disabled = !reusable || patDirtyFlag;
    patMode.disabled = !header;
    patMode.value = header ? header.mode : 'reusable';
    patCopyScaffold.textContent = header && header.mode === 'template' ? 'Copy template' : 'Copy source';
    patCopyScaffold.classList.toggle('primary', !!header && header.mode === 'template');
    patModeHint.textContent = !header ? 'Add a pattern header to choose its mode.'
      : reusable && patDirtyFlag ? 'Save changes before copying the reusable token.'
      : reusable ? 'Copy the token to share this saved content across pages.'
      : 'Copy the template into a page, then fill in its fields. No token is published.';
  }

  patText.addEventListener('input', () => {
    setPatDirty(true);
    refreshPatternMeta();
  });

  patMode.addEventListener('change', () => {
    if (patSelected === null || !parsePatternHeader(patText.value)) return;
    patText.value = setPatternMode(patText.value, patMode.value);
    setPatDirty(true);
    refreshPatternMeta();
  });

  async function savePattern() {
    if (patSelected === null || patSave.disabled || patSaving) return;
    const p = patItems[patSelected], portal = patPortal.value, revision = portalContext.revision, body = patText.value;
    patSaving = true; patSave.disabled = true; patDelete.disabled = true;
    patSave.textContent = 'Saving…'; setPatStatus('saving…');
    try {
      const q = 'portal=' + encodeURIComponent(portal) + '&path=' + encodeURIComponent('patterns/' + p.filename);
      const data = await apiJson(await fetch('/api/file?write&' + q, {
        method:'POST', headers:{'Content-Type':'text/plain'}, body
      }));
      if (!isCurrentPortal(portal, revision) || patItems[patSelected] !== p) return;
      if (data.ok === false) throw Error(data.stderr || 'save failed');
      p.body = body;
      setPatDirty(patText.value !== body);
      setPatStatus(patDirtyFlag ? '✓ saved · newer edits unsaved' : '✓ saved', 'ok');
      refreshPatternMeta(); renderPatternList();
    } catch (err) {
      if (isCurrentPortal(portal, revision)) { setPatStatus(err.message || 'API unreachable', 'err'); setPatDirty(true); }
    } finally {
      patSaving = false; patSave.textContent = 'Save';
      patSave.disabled = !patDirtyFlag || patSelected === null;
      patDelete.disabled = patSelected === null;
    }
  }

  patSave.addEventListener('click', savePattern);

  async function deletePattern() {
    if (patSelected === null || patSaving) return;
    const p = patItems[patSelected];
    const header = parsePatternHeader(p.body);
    const name = header ? header.name : p.filename;
    if (!window.confirm('Delete pattern "' + name + '"? This cannot be undone.')) return;
    patSaving = true; patText.disabled = true; patMode.disabled = true; patSave.disabled = true; patDelete.disabled = true;
    try {
      const q = encodeURIComponent(patPortal.value) + '&' + encodeURIComponent('patterns/' + p.filename);
      const res = await fetch('/api/file?delete&' + q);
      const data = await apiJson(res);
      if (data.ok === false) { say(data.stderr || 'Delete failed'); return; }
      say('Deleted ' + name);
      patSelected = null;
      clearPatternPreview();
      await loadPatterns();
    } catch (err) {
      say(err.message || 'API unreachable');
    } finally {
      patSaving = false; patText.disabled = patSelected === null;
      patDelete.disabled = patSelected === null; setPatDirty(patDirtyFlag); refreshPatternMeta();
    }
  }

  patDelete.addEventListener('click', deletePattern);

  // ---------- new pattern modal ----------
  const patnewModal = document.getElementById('patnew-modal');
  const patnewName = document.getElementById('patnew-name');
  const patnewToken = document.getElementById('patnew-token');
  const patnewTokenRow = document.getElementById('patnew-token-row');
  const patnewMode = document.getElementById('patnew-mode');
  const patnewModeHint = document.getElementById('patnew-mode-hint');
  const patnewErr = document.getElementById('patnew-err');
  const patnewCreate = document.getElementById('patnew-create');

  function patFileFromName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function openPatNew() {
    if (!patPortal.value) { say('Pick a portal first'); return; }
    patnewName.value = '';
    patnewMode.value = 'template';
    refreshPatNewMode();
    patnewErr.hidden = true;
    document.querySelector('input[name="patnew-orient"][value="vertical"]').checked = true;
    patnewModal.hidden = false;
    setTimeout(() => patnewName.focus(), 50);
  }
  function closePatNew() { patnewModal.hidden = true; }

  patNewBtn.addEventListener('click', openPatNew);
  document.getElementById('patnew-close').addEventListener('click', closePatNew);
  document.getElementById('patnew-cancel').addEventListener('click', closePatNew);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !patnewModal.hidden) closePatNew();
  });

  patnewName.addEventListener('input', () => {
    refreshPatNewMode();
    patnewErr.hidden = true;
  });
  patnewName.addEventListener('keydown', e => { if (e.key === 'Enter') createPattern(); });

  function refreshPatNewMode() {
    const reusable = patnewMode.value === 'reusable';
    patnewTokenRow.hidden = !reusable;
    const name = patnewName.value.trim();
    patnewToken.textContent = reusable ? (name ? patternToken(name) : '{{{SHERIFF::PATTERN_NAME}}}') : '';
    patnewModeHint.textContent = reusable
      ? 'Fill this pattern with content that will be shared wherever its token is used.'
      : 'Copy this template into a page and fill in the fields for that page.';
  }
  patnewMode.addEventListener('change', refreshPatNewMode);

  function patnewError(msg) { patnewErr.textContent = msg; patnewErr.hidden = false; }

  async function createPattern() {
    const portal = portalContext.current, revision = portalContext.revision;
    const name = patnewName.value.trim();
    const orient = document.querySelector('input[name="patnew-orient"]:checked').value;
    const mode = patnewMode.value === 'template' ? 'template' : 'reusable';
    const slug = patFileFromName(name);

    if (!name) { patnewError('Give the pattern a name.'); return; }
    if (!slug) { patnewError('Name must contain letters or numbers.'); return; }

    const file = 'patterns/' + slug + '.txt';
    if (patItems.some(p => 'patterns/' + p.filename === file)) {
      patnewError('A pattern named "' + name + '" already exists.'); return;
    }

    // Blank scaffold: header + two empty field lines to start + close.
    const body = '::: pattern ' + orient + ' ' + name + '\n'
      + '@mode = ' + mode + '\n'
      + 'label = \n'
      + 'label = \n'
      + ':::\n';

    patnewCreate.disabled = true;
    patnewCreate.textContent = 'Creating…';
    try {
      const q = 'portal=' + encodeURIComponent(patPortal.value) + '&path=' + encodeURIComponent(file);
      const res = await fetch('/api/file?write&' + q, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body
      });
      const data = await apiJson(res);
      if (data.ok === false) { patnewError(data.stderr || 'Create failed'); return; }
      closePatNew();
      say('Pattern created — fill it in and save');
      await loadPatterns();
      if (!isCurrentPortal(portal, revision)) return;
      const idx = patItems.findIndex(p => 'patterns/' + p.filename === file);
      if (idx >= 0) selectPattern(idx);
    } catch (err) {
      patnewError(err.message || 'API unreachable');
    } finally {
      patnewCreate.disabled = false;
      patnewCreate.textContent = 'Create pattern';
    }
  }

  patnewCreate.addEventListener('click', createPattern);

  function copyText(text, label) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => say(label), () => say(text));
    } else {
      say(text);
    }
  }

  patCopyScaffold.addEventListener('click', () => {
    if (patSelected === null) return;
    const header = parsePatternHeader(patText.value);
    copyText(patText.value, header && header.mode === 'template'
      ? 'Template copied — paste into a page and fill it in' : 'Pattern source copied');
  });

  patCopyToken.addEventListener('click', () => {
    if (patSelected === null) return;
    const header = parsePatternHeader(patText.value);
    if (!header || header.mode !== 'reusable' || patDirtyFlag) return;
    copyText(patternToken(header.name), 'Token copied — paste it where the pattern should appear');
  });

  // ---------- boot ----------
  function unsavedPanels() {
    const pending = [];
    if (dirty) pending.push('Content');
    if (nvEditor.dirty) pending.push('Navigation');
    if (cfEditor.dirty) pending.push('Config');
    if (thEditor.dirty) pending.push('Themes');
    if (patDirtyFlag) pending.push('Patterns');
    if (window.SheriffInteractive && window.SheriffInteractive.isDirty()) pending.push('Interactive');
    if (window.SheriffSeeding?.isDirty()) pending.push('Seeding');
    if (wiz && !wizard.hidden && !wiz.running && wiz.step<5 && (wzName.value.trim()||wzPageTitle.value.trim()||wzPageBody.value.trim()||wiz.logoFile)) pending.push('New site');
    return pending;
  }

  function operationBusy() {
    return window.SheriffDeskBackend.isBusy() || editorBusy || fileOperationBusy || mediaUploading
      || nvEditor.saving || cfEditor.saving || thEditor.saving || patSaving || !!wiz?.running
      || !!window.SheriffContentImages?.isBusy() || !!window.SheriffIcons?.isBusy()
      || !!window.SheriffInteractive?.isSaving() || !!window.SheriffSeeding?.isBusy()
      || !!window.SheriffSnapshots?.isBusy() || !!window.SheriffCloudSync?.isBusy()
      || !!window.SheriffBuildLog?.isBusy();
  }

  function confirmPortalChange(next) {
    if (operationBusy()) {
      say('Wait for the current save or file operation to finish.'); return false;
    }
    const pending = unsavedPanels();
    return !pending.length || window.confirm('Switch to ' + next + '? Unsaved changes in ' + pending.join(', ') + ' will be discarded.');
  }

  function resetPortalPanels() {
    fileListRequest++;fileInventoryDirty=true;mediaRequest++;
    if(wiz&&!wiz.running&&!wizard.hidden)closeWizard();
    expandedFolders = new Set(); knownDirs = new Set(); edFiles = []; edDirs = [];
    edCwd = 'content'; edFilter.value = ''; renamingPath = null; hideFileMenu();
    docConfig = {versions:[],default:null,mode:'manual',saveDefault:'revision'}; saveMode = 'revision'; versionedPages = {}; versionedPageSet = new Set();
    clearContentEditor(); tree.innerHTML = '';
    nvEditor.reset(); cfEditor.reset(); thEditor.reset();
    thLoadedPortal = null; thRequest++; thCurrentTheme = null; thSelected = null; thCards.innerHTML = '';
    patLoadedPortal = null; patRequest++; patItems = []; patSelected = null; clearPatternPreview(); patList.innerHTML = '';
    mediaFiles = []; mediaDirs = []; mediaCwd = 'public'; mdFolder.value = 'public'; mdGrid.innerHTML = ''; closeLightbox();
    if (window.SheriffInteractive) window.SheriffInteractive.reset();
    updatePortalLink();
  }

  let inventoryTimer;
  window.addEventListener('sheriff:saved-changes', event => {
    const detail = event.detail || {};
    if (!detail.mutated || detail.portal !== portalContext.current) return;
    fileInventoryDirty = true; fileListRequest++;
    const paths = [detail.path, detail.from, detail.to].filter(Boolean);
    if (paths.some(path => path.startsWith('patterns/'))) patLoadedPortal = null;
    clearTimeout(inventoryTimer);
    inventoryTimer = setTimeout(() => {
      if (detail.portal !== portalContext.current) return;
      if (currentViewKey() === 'content') void loadFiles();
      if (currentViewKey() === 'media' && !mediaUploading) void loadMedia();
    }, 80);
  });
  window.SheriffDesk = {
    unsavedPanels,
    makeFloatingPanel,
    isBusy:operationBusy,
    openWizard,
    notify: say,
    contentEditor: () => ({portal:portalContext.current,path:openFile,element:edText,generation:editorGeneration}),
    navigationEditor: () => ({portal:nvEditor.portal,path:nvEditor.path,element:document.getElementById('nv-text'),generation:nvEditor.generation,busy:nvEditor.saving}),
    insertNavigation(text, target) {
      const editor = this.navigationEditor();
      if (currentViewKey() !== 'navigation' || target.element !== editor.element || target.portal !== portalContext.current || target.portal !== editor.portal || target.path !== editor.path || target.generation !== editor.generation || editor.element.disabled || editor.busy) return false;
      editor.element.setRangeText(text, target.start, target.end, 'end');
      editor.element.dispatchEvent(new Event('input', {bubbles:true}));
      return true;
    },
    patternHeader: parsePatternHeader,
    patternToken,
    patternSource: body => setPatternMode(body, 'template'),
    refreshFiles: loadFiles,
    revealContentRange,
    insertContent(text, target) {
      if (target.portal !== portalContext.current || target.path !== openFile || edText.disabled || fileOperationBusy || (target.generation !== undefined && target.generation !== editorGeneration)) return false;
      if (target.visual) return window.SheriffVisualEditor?.insert(text, target.visual) || false;
      edText.setRangeText(text, target.start, target.end, 'end');
      edText.dispatchEvent(new Event('input', {bubbles:true}));
      return true;
    },
    insertContentImage(text, target) { return this.insertContent(text, target); },
    portals: () => portalNames.slice(),
    refreshPortals: () => loadPortals(portalContext.current),
    async portalRestored(portal) {
      if (portal === portalContext.current) resetPortalPanels();
      await loadPortals(portal);
      await window.SheriffPendingBuilds?.refresh();
    }
  };
  portalContext.guard(confirmPortalChange);
  portalContext.subscribe((portal, previous) => {
    resetPortalPanels(); loadPortalIdentity(portal);
    if (previous) showView();
  });
  loadPortals().then(showView);
  showView();
})();

