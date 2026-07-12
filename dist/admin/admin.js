// Sheriff Desk — admin panel script (v0.2)
// Single-page: sidebar switches views via location.hash.
// Live: portal list, per-portal + build-all, Pages editor (list/read/write).

(function () {
  'use strict';

  const PORT = location.port || '5173';

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
    navigation: { el: 'view-navigation' },
    themes:     { el: 'view-themes' },
    config:     { el: 'view-config' },
    cloud:      { el: 'view-placeholder', title: 'Cloud Sync',
                  text: 'Sheriff Cloud sync isn\u2019t built yet. Push, pull, and backups land here.' },
    settings:   { el: 'view-placeholder', title: 'Settings',
                  text: 'Desk settings \u2014 nothing to set yet. Your site\u2019s configuration lives under Config.' }
  };

  const phTitle = document.getElementById('ph-title');
  const phText = document.getElementById('ph-text');

  function currentViewKey() {
    const key = location.hash.replace('#', '') || 'dashboard';
    return VIEWS[key] ? key : 'dashboard';
  }

  function showView() {
    const key = currentViewKey();
    const view = VIEWS[key];

    document.querySelectorAll('.view').forEach(v => { v.hidden = true; });
    document.getElementById(view.el).hidden = false;

    if (view.el === 'view-placeholder') {
      phTitle.textContent = view.title;
      phText.textContent = view.text;
    }

    document.querySelectorAll('[data-view]').forEach(n => {
      n.classList.toggle('active', n.dataset.view === key);
    });

    if (key === 'content') editorEnter();
    if (key === 'portals') renderManageList();
    if (key === 'media') mediaEnter();
    if (key === 'interactive' && window.SheriffInteractive) window.SheriffInteractive.enter(portalNames, PORT);
    if (key === 'navigation') nvEditor.enter();
    if (key === 'config') cfEditor.enter();
    if (key === 'themes') themesEnter();
    if (key === 'patterns') patternsEnter();
  }

  window.addEventListener('hashchange', showView);

  // ---------- build log (dashboard) ----------
  const buildLog = document.getElementById('build-log');

  function logLine(text, cls) {
    const line = document.createElement('span');
    if (cls) line.className = cls;
    line.textContent = text;
    buildLog.appendChild(document.createTextNode('\n'));
    buildLog.appendChild(line);
    buildLog.scrollTop = buildLog.scrollHeight;
  }

  function logReset(text) {
    buildLog.textContent = '';
    const line = document.createElement('span');
    line.className = 'dim';
    line.textContent = text;
    buildLog.appendChild(line);
  }

  // ---------- shared build result parsing ----------
  function buildFailed(data) {
    if (data.ok === false) return true;
    if (data.code !== undefined && data.code !== 0 && data.code !== null) return true;
    return false;
  }

  async function buildPortal(name, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Building…'; }
    logLine('→ building ' + name);
    try {
      const res = await fetch('/api/build?' + encodeURIComponent(name));
      const data = await res.json();
      if (buildFailed(data)) {
        logLine('✗ ' + name + ' failed', '');
        if (data.stderr) logLine(String(data.stderr).trim(), 'dim');
        say('Build failed: ' + name);
        return false;
      }
      logLine('✓ ' + name + ' built', 'ok');
      return true;
    } catch (err) {
      logLine('✗ ' + name + ': API unreachable', '');
      say('API unreachable — is goblin start running?');
      return false;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Build portal'; }
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
      node.querySelector('.portal-name').textContent = name;

      const host = name + '.localhost:' + PORT;
      const a = node.querySelector('.portal-host');
      a.textContent = host;
      a.href = 'http://' + host;
      a.target = '_blank';
      a.rel = 'noopener';

      node.querySelector('.portal-edit').addEventListener('click', () => {
        editorPendingPortal = name;
      });

      node.querySelector('.portal-build').addEventListener('click', e => {
        buildPortal(name, e.currentTarget);
      });

      list.appendChild(node);
    });
  }

  async function loadPortals() {
    try {
      const res = await fetch('/api/portals');
      const data = await res.json();
      portalNames = Array.isArray(data.portals) ? data.portals : [];

      if (portalNames.length === 0) {
        emptyState('No portals found in site/portals. Create one to get started.');
        statPortals.textContent = '0';
        maybeAutoWizard();
      } else {
        renderPortals(portalNames);
        statPortals.textContent = String(portalNames.length) + ' detected';
        statPortals.classList.remove('placeholder');
      }
      fillPortalSelect();
    } catch (err) {
      emptyState('API unreachable — start Sheriff with goblin start from dist.');
      statPortals.textContent = 'Unknown';
    }
  }

  // ---------- build all ----------
  const buildAll = document.getElementById('build-all');

  async function runBuildAll() {
    if (portalNames.length === 0) { say('No portals to build'); return; }
    buildAll.disabled = true;
    buildAll.textContent = 'Building…';
    logReset('build all · ' + new Date().toLocaleTimeString());
    for (const name of portalNames) {
      await buildPortal(name, null);
    }
    buildAll.disabled = false;
    buildAll.textContent = 'Build all portals';
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
      return;
    }
    portalNames.forEach(name => {
      const node = manageTmpl.content.cloneNode(true);
      node.querySelector('.portal-name').textContent = name;

      const host = name + '.localhost:' + PORT;
      const a = node.querySelector('.portal-host');
      a.textContent = host;
      a.href = 'http://' + host;
      a.target = '_blank';
      a.rel = 'noopener';

      node.querySelector('.portal-edit').addEventListener('click', () => {
        editorPendingPortal = name;
      });
      node.querySelector('.portal-build').addEventListener('click', e => {
        buildPortal(name, e.currentTarget);
      });
      node.querySelector('.portal-rename').addEventListener('click', () => {
        openRenamePortal(name);
      });
      node.querySelector('.portal-delete').addEventListener('click', () => {
        deletePortal(name);
      });

      manageList.appendChild(node);
    });
  }

  npName.addEventListener('input', () => {
    npPreview.textContent = npName.value.trim() || 'name';
  });
  npName.addEventListener('keydown', e => {
    if (e.key === 'Enter') createPortal();
  });
  npCreate.addEventListener('click', createPortal);

  async function createPortal() {
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
      say('Portal created \u2014 building\u2026');
      await loadPortals();
      renderManageList();
      const ok = await buildPortal(name, null);
      if (ok) say(name + ' is ready at ' + name + '.localhost:' + PORT);
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
    if (!confirmDiscard()) return;

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
      say('Renamed ' + from + ' to ' + to);

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
        editorPendingPortal = to;
      }

      await loadPortals();
      renderManageList();

      // dist/{from} was discarded, so the portal is unserved until this finishes.
      say('Rebuilding ' + to + '\u2026');
      const b = await fetch('/api/build?' + encodeURIComponent(to));
      const bd = await apiJson(b);
      if (buildFailed(bd)) {
        say('Renamed, but the rebuild failed. Build it from its card.');
        return;
      }
      say('Renamed and rebuilt ' + to);
    } catch (err) {
      rpError(err.message || 'API unreachable');
      rpBtn.disabled = false;
      rpBtn.textContent = 'Rename';
    }
  }

  async function deletePortal(name) {
    const typed = window.prompt(
      'This deletes the portal source AND its built output. It cannot be undone.\n\n'
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
  const edPortal = document.getElementById('ed-portal');
  const edFilter = document.getElementById('ed-filter');
  const tree = document.getElementById('file-tree');
  const edPath = document.getElementById('ed-path');
  const edDirty = document.getElementById('ed-dirty');
  const edStatus = document.getElementById('ed-status');
  const edSave = document.getElementById('ed-save');
  const edText = document.getElementById('ed-text');
  const edOpenPortal = document.getElementById('ed-open-portal');
  const newBtn = document.getElementById('ed-new');

  let editorPendingPortal = null;   // set by dashboard "Edit content"
  let edFiles = [];
  let edDirs = [];
  // Folders created this session. An empty folder has no file to imply it,
  // so if the API's dirs list drops it the tree would too. This keeps it.
  let knownDirs = new Set();
  let openFile = null;
  let dirty = false;
  let expandedFolders = new Set();
  let edCwd = 'content';
  let renamingPath = null;

  function setDirty(v) {
    dirty = v;
    edDirty.hidden = !v;
    edSave.disabled = !v || !openFile;
  }

  function setStatus(msg, cls) {
    edStatus.textContent = msg || '';
    edStatus.className = 'ed-status' + (cls ? ' ' + cls : '');
  }

  function fillPortalSelect() {
    edPortal.innerHTML = '';
    portalNames.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      edPortal.appendChild(opt);
    });
  }

  function editorEnter() {
    if (edPortal.options.length === 0 && portalNames.length > 0) fillPortalSelect();
    if (editorPendingPortal) {
      edPortal.value = editorPendingPortal;
      editorPendingPortal = null;
      loadFiles();
    } else if (edFiles.length === 0 && edPortal.value) {
      loadFiles();
    }
    updatePortalLink();
  }

  function updatePortalLink() {
    if (edPortal.value) {
      edOpenPortal.href = 'http://' + edPortal.value + '.localhost:' + PORT;
      edOpenPortal.hidden = false;
    } else {
      edOpenPortal.hidden = true;
    }
  }

  function confirmDiscard() {
    if (!dirty) return true;
    return window.confirm('Unsaved changes will be lost. Continue?');
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

  function fileRow(path, name, indentPx) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'tree-item' + (path === openFile ? ' open' : '');
    row.style.paddingLeft = indentPx + 'px';

    if (path === renamingPath) {
      row.innerHTML = '<span class="caret"></span>' + fileIconSvg(name);
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'rename-input';
      input.value = name;
      input.spellcheck = false;
      row.appendChild(input);
      input.addEventListener('click', e => e.stopPropagation());
      input.addEventListener('keydown', e => {
        if (e.key === 'Escape') { renamingPath = null; renderTree(); }
        if (e.key === 'Enter') commitRename(path, input.value);
      });
      input.addEventListener('blur', () => {
        if (renamingPath === path) { renamingPath = null; renderTree(); }
      });
      requestAnimationFrame(() => { input.focus(); input.select(); });
      return row;
    }

    row.innerHTML = '<span class="caret"></span>' + fileIconSvg(name) + '<span class="node-name"></span>';
    row.querySelector('.node-name').textContent = name;
    row.title = path;
    row.addEventListener('click', () => openPath(path));

    row.draggable = true;
    row.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', path);
      e.dataTransfer.effectAllowed = 'move';
    });

    row.addEventListener('contextmenu', e => {
      e.preventDefault();
      showFileMenu(e.clientX, e.clientY, path);
    });
    return row;
  }

  function renderNodes(container, nodes, depth) {
    nodes.forEach(node => {
      if (node.type === 'folder') {
        const isOpen = expandedFolders.has(node.path);
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'tree-folder' + (isOpen ? ' expanded' : '');
        row.style.paddingLeft = (10 + depth * 16) + 'px';
        row.innerHTML = '<span class="caret">' + (isOpen ? '\u25be' : '\u25b8') + '</span>'
          + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
          + '<span class="node-name"></span>';
        row.querySelector('.node-name').textContent = node.name;
        row.addEventListener('click', () => {
          edCwd = node.path;
          toggleFolder(node.path);
        });

        row.addEventListener('dragover', e => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          row.classList.add('drop-target');
        });
        row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
        row.addEventListener('drop', e => {
          e.preventDefault();
          row.classList.remove('drop-target');
          const srcPath = e.dataTransfer.getData('text/plain');
          if (!srcPath) return;
          const base = srcPath.split('/').pop();
          const dest = node.path + '/' + base;
          if (dest === srcPath) return;
          moveFilePath(srcPath, dest);
        });

        container.appendChild(row);
        if (isOpen && node.children) {
          renderNodes(container, node.children, depth + 1);
        }
      } else {
        container.appendChild(fileRow(node.path, node.name, 10 + depth * 16));
      }
    });
  }

  function renderTree() {
    const q = edFilter.value.trim().toLowerCase();
    tree.innerHTML = '';

    if (edFiles.length === 0) {
      const div = document.createElement('div');
      div.className = 'tree-msg';
      div.textContent = 'No files in this portal yet.';
      tree.appendChild(div);
      return;
    }

    // Filter active: flat list of matching full paths. No filter: tree.
    if (q) {
      const shown = edFiles.filter(f => f.toLowerCase().includes(q));
      if (shown.length === 0) {
        const div = document.createElement('div');
        div.className = 'tree-msg';
        div.textContent = 'No files match.';
        tree.appendChild(div);
        return;
      }
      shown.forEach(f => tree.appendChild(fileRow(f, f, 10)));
      return;
    }

    renderNodes(tree, buildFileTree(edFiles, edDirs), 0);
  }

  async function loadFiles() {
    if (!edPortal.value) return;
    tree.innerHTML = '<div class="tree-msg">Loading files\u2026</div>';
    try {
      const res = await fetch('/api/file?list&' + encodeURIComponent(edPortal.value), { cache: 'no-store' });
      const data = await res.json();
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

      // First load / portal switch: expand top-level folders containing
      // files (same default as Cloud). Reloads keep the current expansion.
      if (expandedFolders.size === 0) {
        for (const f of edFiles) {
          if (f.includes('/')) expandedFolders.add(f.split('/')[0]);
        }
      }

      renderTree();
    } catch (err) {
      tree.innerHTML = '<div class="tree-msg">API unreachable.</div>';
      edFiles = [];
      edDirs = [];
    }
  }

  // ---------- file operations ----------
  async function moveFilePath(srcPath, destPath) {
    try {
      const q = encodeURIComponent(edPortal.value)
        + '&' + encodeURIComponent(srcPath)
        + '&' + encodeURIComponent(destPath);
      const res = await fetch('/api/file?move&' + q);
      const data = await res.json();
      if (data.ok === false) {
        say(data.stderr || 'Move failed');
        return;
      }
      if (openFile === srcPath) {
        openFile = destPath;
        edPath.textContent = destPath;
      }
      const parts = destPath.split('/');
      let running = '';
      for (let i = 0; i < parts.length - 1; i++) {
        running = running ? running + '/' + parts[i] : parts[i];
        expandedFolders.add(running);
      }
      say('Moved to ' + destPath);
      await loadFiles();
    } catch (err) {
      say('API unreachable');
    }
  }

  function commitRename(path, newName) {
    const name = newName.trim();
    renamingPath = null;
    if (!name || name === path.split('/').pop()) { renderTree(); return; }
    if (name.includes('/') || name.includes('\\')) {
      say('Name cannot contain slashes');
      renderTree();
      return;
    }
    const dir = path.split('/').slice(0, -1).join('/');
    moveFilePath(path, dir ? dir + '/' + name : name);
  }

  async function deleteFilePath(path) {
    if (!window.confirm('Delete "' + path + '"? This cannot be undone.')) return;
    try {
      const q = encodeURIComponent(edPortal.value) + '&' + encodeURIComponent(path);
      const res = await fetch('/api/file?delete&' + q);
      const data = await res.json();
      if (data.ok === false) {
        say(data.stderr || 'Delete failed');
        return;
      }
      if (openFile === path) {
        openFile = null;
        edPath.textContent = 'No file open';
        edText.value = '';
        edText.disabled = true;
        setDirty(false);
      }
      say('Deleted ' + path);
      await loadFiles();
    } catch (err) {
      say('API unreachable');
    }
  }

  // ---------- context menu ----------
  const fileMenu = document.createElement('div');
  fileMenu.className = 'ctx-menu';
  fileMenu.hidden = true;
  fileMenu.innerHTML = '<button type="button" data-act="rename">Rename</button>'
    + '<button type="button" data-act="delete" class="danger">Delete</button>';
  document.body.appendChild(fileMenu);
  let menuPath = null;

  function showFileMenu(x, y, path) {
    menuPath = path;
    fileMenu.hidden = false;
    const rect = fileMenu.getBoundingClientRect();
    fileMenu.style.left = Math.min(x, window.innerWidth - rect.width - 8) + 'px';
    fileMenu.style.top = Math.min(y, window.innerHeight - rect.height - 8) + 'px';
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
    if (act === 'rename') { renamingPath = path; renderTree(); }
    if (act === 'delete') deleteFilePath(path);
  });

  document.addEventListener('click', () => { if (!fileMenu.hidden) hideFileMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !fileMenu.hidden) hideFileMenu(); });

  async function openPath(path) {
    if (!confirmDiscard()) return;
    if (IMAGE_EXTS.has(fileExt(path))) {
      say('Image viewer lands with the Media panel');
      return;
    }
    setStatus('');
    try {
      const q = 'portal=' + encodeURIComponent(edPortal.value) + '&path=' + encodeURIComponent(path);
      const res = await fetch('/api/file?read&' + q);
      const data = await res.json();
      if (data.ok === false) {
        say(data.stderr || 'Could not open file');
        return;
      }
      openFile = path;
      edPath.textContent = path;
      edText.value = data.content || '';
      edText.disabled = false;
      setDirty(false);
      renderTree();
      edText.focus();
    } catch (err) {
      say('API unreachable');
    }
  }

  async function saveFile() {
    if (!openFile || edSave.disabled) return;
    edSave.disabled = true;
    edSave.textContent = 'Saving…';
    setStatus('building…');
    const started = Date.now();
    try {
      const q = 'portal=' + encodeURIComponent(edPortal.value) + '&path=' + encodeURIComponent(openFile);
      const res = await fetch('/api/file?write&' + q, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: edText.value
      });
      const data = await res.json();
      if (buildFailed(data)) {
        setStatus('build failed', 'err');
        if (data.stderr) say(String(data.stderr).trim().slice(0, 120));
        setDirty(true);
        return;
      }
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      const isPage = openFile.startsWith('content/') && openFile.endsWith('.md');
      setStatus('✓ saved · ' + (isPage ? 'page built' : 'portal rebuilt') + ' in ' + secs + 's', 'ok');
      setDirty(false);
    } catch (err) {
      setStatus('API unreachable', 'err');
      setDirty(true);
    } finally {
      edSave.textContent = 'Save & build';
      edSave.disabled = !dirty;
    }
  }

  edText.addEventListener('input', () => setDirty(true));
  edSave.addEventListener('click', saveFile);

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      const k = currentViewKey();
      if (k === 'content') { e.preventDefault(); saveFile(); }
      if (k === 'navigation') { e.preventDefault(); nvEditor.save(); }
      if (k === 'config') { e.preventDefault(); cfEditor.save(); }
      if (k === 'themes') { e.preventDefault(); thSave(); }
      if (k === 'patterns') { e.preventDefault(); savePattern(); }
    }
  });

  edPortal.addEventListener('change', () => {
    if (!confirmDiscard()) return;
    expandedFolders = new Set();
    knownDirs = new Set();
    edCwd = 'content';
    openFile = null;
    edPath.textContent = 'No file open';
    edText.value = '';
    edText.disabled = true;
    setDirty(false);
    updatePortalLink();
    loadFiles();
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

  // Every folder a page may live in, drawn from the tree's own dir list.
  // Defaults to content, never to whatever folder was last clicked.
  function npmLoadFolders() {
    npmFolderSel.innerHTML = '';
    const folders = ['content'];
    for (const d of edDirs) {
      if (d === 'content' || d.startsWith('content/')) folders.push(d);
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
  const mdPortal = document.getElementById('md-portal');
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

  function mediaPortalUrl(subpath) {
    return 'http://' + mdPortal.value + '.localhost:' + PORT + '/' + subpath;
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
    if (mdPortal.options.length === 0 && portalNames.length > 0) {
      portalNames.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        mdPortal.appendChild(opt);
      });
    }
    if (mdPortal.value) loadMedia();
  }

  mdPortal.addEventListener('change', () => {
    mediaCwd = 'public';
    mdFolder.value = mediaCwd;
    loadMedia();
  });

  async function loadMedia() {
    if (!mdPortal.value) return;
    mdGrid.innerHTML = '<div class="portal-empty">Loading media…</div>';
    try {
      const res = await fetch('/api/file?list&' + encodeURIComponent(mdPortal.value), { cache: 'no-store' });
      const data = await res.json();
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
    if (!mdPortal.value) { say('Pick a portal first'); return; }
    const folder = cleanFolder();
    if (folder === null) { say('Upload folder must be public/ or a subfolder of it'); return; }
    const files = Array.from(fileList);
    if (files.length === 0) return;

    let done = 0;
    for (const file of files) {
      const subpath = folder + '/' + file.name;
      try {
        const q = encodeURIComponent(mdPortal.value) + '&' + encodeURIComponent(subpath);
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
      say(done + ' file' + (done === 1 ? '' : 's') + ' uploaded — building…');
      await loadMedia();
      const ok = await buildPortal(mdPortal.value, null);
      if (ok) {
        say(done + ' file' + (done === 1 ? '' : 's') + ' uploaded and live');
        renderMedia();
      }
    }
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
  function fillPortalSel(sel) {
    if (sel.options.length === 0 && portalNames.length > 0) {
      portalNames.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
      });
    }
  }

  function fileEditor(ids, getPath, opts) {
    const sel = document.getElementById(ids.portal);
    const text = document.getElementById(ids.text);
    const dirtyEl = document.getElementById(ids.dirty);
    const statusEl = document.getElementById(ids.status);
    const saveBtn = document.getElementById(ids.save);

    const ed = { path: null, dirty: false, missing: false };

    function setDirty(v) {
      ed.dirty = v;
      dirtyEl.hidden = !v;
      saveBtn.disabled = !v || !ed.path;
    }
    function setStatus(msg, cls) {
      statusEl.textContent = msg || '';
      statusEl.className = 'ed-status' + (cls ? ' ' + cls : '');
    }

    ed.load = async function () {
      if (!sel.value) return;
      ed.path = getPath(sel.value);
      setStatus('loading…');
      try {
        const q = 'portal=' + encodeURIComponent(sel.value) + '&path=' + encodeURIComponent(ed.path);
        const res = await fetch('/api/file?read&' + q);
        const data = await apiJson(res);
        if (data.ok === false) {
          ed.missing = true;
          text.value = '';
          text.disabled = false;
          setStatus('(new file — Save creates it)');
        } else {
          ed.missing = false;
          text.value = data.content || '';
          text.disabled = false;
          setStatus('');
        }
        setDirty(false);
      } catch (err) {
        setStatus(err.message || 'API unreachable', 'err');
      }
    };

    ed.save = async function () {
      if (!ed.path || saveBtn.disabled) return;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      setStatus('rebuilding…');
      const started = Date.now();
      try {
        const q = 'portal=' + encodeURIComponent(sel.value) + '&path=' + encodeURIComponent(ed.path);
        const res = await fetch('/api/file?write&' + q, {
          method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: text.value
        });
        const data = await apiJson(res);
        if (buildFailed(data)) {
          setStatus('build failed — ' + String(data.stderr || '').trim().slice(0, 120), 'err');
          setDirty(true);
          return;
        }
        const secs = ((Date.now() - started) / 1000).toFixed(1);
        setStatus('✓ saved · portal rebuilt in ' + secs + 's', 'ok');
        setDirty(false);
      } catch (err) {
        setStatus(err.message || 'API unreachable', 'err');
        setDirty(true);
      } finally {
        saveBtn.textContent = 'Save & rebuild';
        saveBtn.disabled = !ed.dirty;
      }
    };

    ed.enter = function () {
      fillPortalSel(sel);
      if (sel.value && !ed.dirty) ed.load();
    };

    text.addEventListener('input', () => setDirty(true));
    saveBtn.addEventListener('click', ed.save);
    if (!opts || opts.autoChange !== false) {
      sel.addEventListener('change', () => {
        if (ed.dirty && !window.confirm('Unsaved changes will be lost. Continue?')) return;
        ed.load();
      });
    }

    return ed;
  }

  const nvEditor = fileEditor(
    { portal: 'nv-portal', text: 'nv-text', dirty: 'nv-dirty', status: 'nv-status', save: 'nv-save' },
    () => 'nav.yall'
  );

  const cfEditor = fileEditor(
    { portal: 'cf-portal', text: 'cf-text', dirty: 'cf-dirty', status: 'cf-status', save: 'cf-save' },
    () => 'config.yall'
  );

  // ---------- Themes panel ----------
  const thPortal = document.getElementById('th-portal');
  const thCards = document.getElementById('th-cards');
  const thTabs = document.getElementById('th-tabs');
  let thCurrentTheme = null;   // the theme the portal actually uses
  let thSelected = null;       // the theme whose files are shown below
  let thFile = 'templates.yall';

  const thEditor = fileEditor(
    { portal: 'th-portal', text: 'th-text', dirty: 'th-dirty', status: 'th-status', save: 'th-save' },
    () => 'themes/' + thSelected + '/' + thFile,
    { autoChange: false }
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
        if (thEditor.dirty && !window.confirm('Unsaved changes will be lost. Continue?')) return;
        thFile = f;
        renderThTabs();
        if (thCurrentTheme) thEditor.load();
      });
      thTabs.appendChild(b);
    });
  }

  async function detectCurrentTheme(portal) {
    try {
      const q = 'portal=' + encodeURIComponent(portal) + '&path=' + encodeURIComponent('config.yall');
      const res = await fetch('/api/file?read&' + q);
      const data = await apiJson(res);
      if (data.ok === false) return null;
      const m = String(data.content || '').match(/theme:\s*\r?\n\s*name:\s*"([^"]+)"/);
      return m ? m[1] : null;
    } catch (err) { return null; }
  }

  async function renderThemeCards() {
    thCards.innerHTML = '<div class="tree-msg">Loading themes…</div>';
    let themes = [];
    try {
      const res = await fetch('/api/list_themes');
      const data = await apiJson(res);
      themes = Array.isArray(data.themes) ? data.themes : [];
    } catch (err) {
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
      img.src = '/admin/theme-previews/' + t + '.png';
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
        btn.textContent = 'Apply & rebuild';
        btn.addEventListener('click', e => { e.stopPropagation(); switchTheme(t); });
        wrap.appendChild(btn);
        card.appendChild(wrap);
      }

      card.addEventListener('click', () => selectTheme(t));
      thCards.appendChild(card);
    });
  }

  function selectTheme(t) {
    if (t === thSelected) return;
    if (thEditor.dirty && !window.confirm('Unsaved changes will be lost. Continue?')) return;
    thSelected = t;
    ensureAndLoadTheme(t);
    renderThemeCards();
  }

  async function ensureAndLoadTheme(theme) {
    // A theme the portal has never used has no files yet; seed them so the
    // editor can show templates.yall / override.css without an Apply.
    try {
      await fetch('/api/ensure_theme?' + encodeURIComponent(thPortal.value) + '&' + encodeURIComponent(theme));
    } catch (err) { /* editor will show (new file) if this fails */ }
    thEditor.load();
  }

  async function switchTheme(theme) {
    const portal = thPortal.value;
    if (!portal) return;
    if (!window.confirm('Switch ' + portal + ' to the "' + theme + '" theme and rebuild?')) return;

    try {
      let res = await fetch('/api/ensure_theme?' + encodeURIComponent(portal) + '&' + encodeURIComponent(theme));
      let data = await apiJson(res);
      if (data.ok === false) { say(data.stderr || 'Theme prep failed'); return; }

      const q = 'portal=' + encodeURIComponent(portal) + '&path=' + encodeURIComponent('config.yall');
      res = await fetch('/api/file?read&' + q);
      data = await apiJson(res);
      if (data.ok === false) { say('Could not read config.yall'); return; }
      const cfg = String(data.content || '');
      const updated = cfg.replace(/(theme:\s*\r?\n\s*name:\s*")[^"]+(")/, '$1' + theme + '$2');
      if (updated === cfg && !cfg.includes('"' + theme + '"')) {
        say('Could not find theme name in config.yall');
        return;
      }

      say('Switching theme — rebuilding…');
      res = await fetch('/api/file?write&' + q, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: updated
      });
      data = await apiJson(res);
      if (buildFailed(data)) { say('Rebuild failed — ' + String(data.stderr || '').slice(0, 120)); return; }

      thCurrentTheme = theme;
      thSelected = theme;
      renderThemeCards();
      thEditor.load();
      say(portal + ' now uses ' + theme);
    } catch (err) {
      say(err.message || 'API unreachable');
    }
  }

  async function themesEnter() {
    fillPortalSel(thPortal);
    if (!thPortal.value) return;
    thCurrentTheme = await detectCurrentTheme(thPortal.value);
    thSelected = thCurrentTheme;
    renderThemeCards();
    renderThTabs();
    if (thSelected && !thEditor.dirty) thEditor.load();
  }

  thPortal.addEventListener('change', async () => {
    if (thEditor.dirty && !window.confirm('Unsaved changes will be lost. Continue?')) return;
    thCurrentTheme = await detectCurrentTheme(thPortal.value);
    thSelected = thCurrentTheme;
    renderThemeCards();
    if (thSelected) thEditor.load();
  });

  // ---------- help drawer ----------
  const helpDrawer = document.getElementById('help-drawer');
  const hdTitle = document.getElementById('hd-title');
  const hdBody = document.getElementById('hd-body');
  const hdDocs = document.getElementById('hd-docs');

  function openHelp(key) {
    const help = window.DESK_HELP && window.DESK_HELP[key];
    if (!help) { say('No help written for this section yet'); return; }
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

  function closeHelp() { helpDrawer.hidden = true; }

  // draggable: grab the header, position persists
  (function () {
    const head = helpDrawer.querySelector('.hd-head');

    function clampPos(left, top) {
      const w = helpDrawer.offsetWidth || 480;
      return {
        left: Math.min(Math.max(8, left), window.innerWidth - Math.min(w, 200)),
        top: Math.min(Math.max(8, top), window.innerHeight - 60)
      };
    }

    function applyPos(left, top) {
      const p = clampPos(left, top);
      helpDrawer.style.left = p.left + 'px';
      helpDrawer.style.top = p.top + 'px';
      helpDrawer.style.right = 'auto';
    }

    try {
      const saved = JSON.parse(localStorage.getItem('desk.helpPos') || 'null');
      if (saved && typeof saved.left === 'number') applyPos(saved.left, saved.top);
    } catch (e) { /* default CSS position */ }

    head.addEventListener('pointerdown', e => {
      if (e.target.closest('.wiz-x')) return;
      e.preventDefault();
      head.setPointerCapture(e.pointerId);
      const rect = helpDrawer.getBoundingClientRect();
      const offX = e.clientX - rect.left;
      const offY = e.clientY - rect.top;

      function onMove(ev) {
        applyPos(ev.clientX - offX, ev.clientY - offY);
      }
      function onUp() {
        head.releasePointerCapture(e.pointerId);
        head.removeEventListener('pointermove', onMove);
        head.removeEventListener('pointerup', onUp);
        const r = helpDrawer.getBoundingClientRect();
        localStorage.setItem('desk.helpPos', JSON.stringify({ left: r.left, top: r.top }));
      }
      head.addEventListener('pointermove', onMove);
      head.addEventListener('pointerup', onUp);
    });
  })();

  document.addEventListener('click', e => {
    const btn = e.target.closest('.help-btn');
    if (btn) openHelp(btn.dataset.help);
  });
  document.getElementById('hd-close').addEventListener('click', closeHelp);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !helpDrawer.hidden) closeHelp();
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
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  // ============================================================
  // First-run wizard
  // ============================================================
  const wizard = document.getElementById('wizard');
  const wizClose = document.getElementById('wiz-close');
  const wizDots = document.getElementById('wiz-dots');
  const wzName = document.getElementById('wz-name');
  const wzSlug = document.getElementById('wz-slug');
  const wzSlugPreview = document.getElementById('wz-slug-preview');
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

  function openWizard() {
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
    if (portalNames.includes(wiz.slug)) {
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
    wzRunTitle.textContent = 'Building your site';
    wzRunErr.hidden = true;
    wzDone.hidden = true;
    resetProgress();

    try {
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

      // 4. full build
      markTask('build', 'doing');
      res = await fetch('/api/build?' + encodeURIComponent(wiz.slug));
      data = await apiJson(res);
      if (buildFailed(data)) throw new Error(data.stderr || 'build failed');
      markTask('build', 'done');

      wzRunTitle.textContent = 'Your site is ready';
      wzViewSite.href = 'http://' + wiz.slug + '.localhost:' + PORT;
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
  // Patterns panel (read-only browse + copy)
  // ============================================================
  const patPortal = document.getElementById('pat-portal');
  const patList = document.getElementById('pat-list');
  const patText = document.getElementById('pat-text');
  const patName = document.getElementById('pat-name');
  const patTokenEl = document.getElementById('pat-token');
  const patCopyScaffold = document.getElementById('pat-copy-scaffold');
  const patCopyToken = document.getElementById('pat-copy-token');

  const patStatus = document.getElementById('pat-status');
  const patDirty = document.getElementById('pat-dirty');
  const patSave = document.getElementById('pat-save');
  const patDelete = document.getElementById('pat-delete');
  const patNewBtn = document.getElementById('pat-new');

  let patItems = [];
  let patSelected = null;
  let patDirtyFlag = false;

  // "::: pattern vertical Region"  -> { orientation:'vertical', name:'Region' }
  // "::: pattern horizontal Outrider Characters" -> name:'Outrider Characters'
  function parsePatternHeader(body) {
    const lines = String(body || '').split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^:::\s*pattern\s+(\S+)\s+(.+?)\s*$/);
      if (m) return { orientation: m[1], name: m[2].trim() };
    }
    return null;
  }

  function patternToken(name) {
    const up = name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
    return '{{{SHERIFF::PATTERN_' + up + '}}}';
  }

  function patternsEnter() {
    fillPortalSel(patPortal);
    if (patPortal.value) loadPatterns();
  }

  patPortal.addEventListener('change', loadPatterns);

  async function loadPatterns() {
    if (!patPortal.value) return;
    patList.innerHTML = '<div class="tree-msg">Loading…</div>';
    patSelected = null;
    clearPatternPreview();
    try {
      const res = await fetch('/api/list_patterns?' + encodeURIComponent(patPortal.value));
      const data = await apiJson(res);
      if (data.ok === false) {
        patList.innerHTML = '<div class="tree-msg">' + (data.stderr || 'Could not load patterns.') + '</div>';
        return;
      }
      patItems = Array.isArray(data.patterns) ? data.patterns : [];
      renderPatternList();
    } catch (err) {
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
        + (header ? '<span class="pat-item-orient">' + header.orientation + '</span>' : '');
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
    patCopyScaffold.disabled = true;
    patCopyToken.disabled = true;
    patSave.disabled = true;
    patDelete.disabled = true;
    setPatDirty(false);
  }

  function setPatDirty(v) {
    patDirtyFlag = v;
    patDirty.hidden = !v;
    patSave.disabled = !v || patSelected === null;
  }

  function setPatStatus(msg, cls) {
    patStatus.textContent = msg || '';
    patStatus.className = 'ed-status' + (cls ? ' ' + cls : '');
  }

  function selectPattern(i) {
    if (patDirtyFlag && !window.confirm('Unsaved changes will be lost. Continue?')) return;
    patSelected = i;
    const p = patItems[i];
    patText.value = p.body;
    patText.disabled = false;
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
    patTokenEl.textContent = header ? patternToken(header.name) : '(add ::: pattern header)';
    patCopyToken.disabled = !header;
  }

  patText.addEventListener('input', () => {
    setPatDirty(true);
    refreshPatternMeta();
  });

  async function savePattern() {
    if (patSelected === null || patSave.disabled) return;
    const p = patItems[patSelected];
    patSave.disabled = true;
    patSave.textContent = 'Saving…';
    setPatStatus('saving…');
    try {
      const q = 'portal=' + encodeURIComponent(patPortal.value) + '&path=' + encodeURIComponent('patterns/' + p.filename);
      const res = await fetch('/api/file?write&' + q, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: patText.value
      });
      const data = await apiJson(res);
      if (data.ok === false) {
        setPatStatus(data.stderr || 'save failed', 'err');
        setPatDirty(true);
        return;
      }
      p.body = patText.value;
      setPatStatus('✓ saved', 'ok');
      setPatDirty(false);
      renderPatternList();
    } catch (err) {
      setPatStatus(err.message || 'API unreachable', 'err');
      setPatDirty(true);
    } finally {
      patSave.textContent = 'Save';
      patSave.disabled = !patDirtyFlag;
    }
  }

  patSave.addEventListener('click', savePattern);

  async function deletePattern() {
    if (patSelected === null) return;
    const p = patItems[patSelected];
    const header = parsePatternHeader(p.body);
    const name = header ? header.name : p.filename;
    if (!window.confirm('Delete pattern "' + name + '"? This cannot be undone.')) return;
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
    }
  }

  patDelete.addEventListener('click', deletePattern);

  // ---------- new pattern modal ----------
  const patnewModal = document.getElementById('patnew-modal');
  const patnewName = document.getElementById('patnew-name');
  const patnewToken = document.getElementById('patnew-token');
  const patnewErr = document.getElementById('patnew-err');
  const patnewCreate = document.getElementById('patnew-create');

  function patFileFromName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function openPatNew() {
    if (!patPortal.value) { say('Pick a portal first'); return; }
    patnewName.value = '';
    patnewToken.textContent = '{{{SHERIFF::PATTERN_NAME}}}';
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
    const name = patnewName.value.trim();
    patnewToken.textContent = name ? patternToken(name) : '{{{SHERIFF::PATTERN_NAME}}}';
    patnewErr.hidden = true;
  });
  patnewName.addEventListener('keydown', e => { if (e.key === 'Enter') createPattern(); });

  function patnewError(msg) { patnewErr.textContent = msg; patnewErr.hidden = false; }

  async function createPattern() {
    const name = patnewName.value.trim();
    const orient = document.querySelector('input[name="patnew-orient"]:checked').value;
    const slug = patFileFromName(name);

    if (!name) { patnewError('Give the pattern a name.'); return; }
    if (!slug) { patnewError('Name must contain letters or numbers.'); return; }

    const file = 'patterns/' + slug + '.txt';
    if (patItems.some(p => 'patterns/' + p.filename === file)) {
      patnewError('A pattern named "' + name + '" already exists.'); return;
    }

    // Blank scaffold: header + two empty field lines to start + close.
    const body = '::: pattern ' + orient + ' ' + name + '\n'
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
    copyText(patItems[patSelected].body, 'Scaffold copied — paste into a page and fill it in');
  });

  patCopyToken.addEventListener('click', () => {
    if (patSelected === null) return;
    const header = parsePatternHeader(patItems[patSelected].body);
    if (!header) { say('No pattern header to build a token from'); return; }
    copyText(patternToken(header.name), 'Token copied — paste it where the pattern should appear');
  });

  // ---------- boot ----------
  loadPortals().then(showView);
  showView();
})();
