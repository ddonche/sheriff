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
    media:      { el: 'view-placeholder', title: 'Media',
                  text: 'The media manager isn\u2019t built yet. Uploads, browsing, and inserting file paths into the editor land here.' },
    navigation: { el: 'view-placeholder', title: 'Navigation',
                  text: 'The navigation editor isn\u2019t built yet. It will edit nav.yall per portal.' },
    themes:     { el: 'view-placeholder', title: 'Themes',
                  text: 'The theme panel isn\u2019t built yet. Theme overrides can already be edited under Content \u2192 themes/.' },
    build:      { el: 'view-placeholder', title: 'Build',
                  text: 'The full build panel isn\u2019t built yet. Build all and per-portal builds are on the Dashboard.' },
    cloud:      { el: 'view-placeholder', title: 'Cloud Sync',
                  text: 'Sheriff Cloud sync isn\u2019t built yet. Push, pull, and backups land here.' },
    settings:   { el: 'view-placeholder', title: 'Settings',
                  text: 'Settings aren\u2019t built yet.' }
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
  document.getElementById('gs-build').addEventListener('click', e => {
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
  const RESERVED_PORTALS = new Set(['api', 'public']);

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
      const res = await fetch('/api/create_portal?' + encodeURIComponent(name));
      const data = await res.json();
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
      if (ok) say(name + ' is live at ' + name + '.localhost:' + PORT);
    } catch (err) {
      say('API unreachable');
    } finally {
      npCreate.disabled = false;
      npCreate.textContent = 'Create portal';
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
      const res = await fetch('/api/delete_portal?' + encodeURIComponent(name));
      const data = await res.json();
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
  const newRow = document.getElementById('newpage-row');
  const newInput = document.getElementById('newpage-path');

  let editorPendingPortal = null;   // set by dashboard "Edit content"
  let edFiles = [];
  let edDirs = [];
  let openFile = null;
  let dirty = false;
  let expandedFolders = new Set();
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
      return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
    }
    if (ext === 'md') {
      return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>';
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
      row.innerHTML = fileIconSvg(name);
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

    row.innerHTML = fileIconSvg(name) + '<span class="node-name"></span>';
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
        row.style.paddingLeft = (10 + depth * 14) + 'px';
        row.innerHTML = '<span class="caret">' + (isOpen ? '\u25be' : '\u25b8') + '</span>'
          + '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
          + '<span class="node-name"></span>';
        row.querySelector('.node-name').textContent = node.name;
        row.addEventListener('click', () => toggleFolder(node.path));

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
        container.appendChild(fileRow(node.path, node.name, 29 + depth * 14));
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
      const res = await fetch('/api/list_files?' + encodeURIComponent(edPortal.value));
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
      const res = await fetch('/api/move_file?' + q);
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
      const res = await fetch('/api/delete_file?' + q);
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
      const res = await fetch('/api/read_file?' + q);
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
      const res = await fetch('/api/write_file?' + q, {
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
      setStatus('✓ saved & built in ' + secs + 's', 'ok');
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
      if (currentViewKey() === 'content') {
        e.preventDefault();
        saveFile();
      }
    }
  });

  edPortal.addEventListener('change', () => {
    if (!confirmDiscard()) return;
    expandedFolders = new Set();
    openFile = null;
    edPath.textContent = 'No file open';
    edText.value = '';
    edText.disabled = true;
    setDirty(false);
    updatePortalLink();
    loadFiles();
  });

  edFilter.addEventListener('input', renderTree);

  // ---------- new page ----------
  newBtn.addEventListener('click', () => {
    if (newRow.hidden) {
      newRow.hidden = false;
      newInput.value = 'content/';
      newInput.focus();
    } else {
      newRow.hidden = true;
    }
  });

  newInput.addEventListener('keydown', async e => {
    if (e.key === 'Escape') { newRow.hidden = true; return; }
    if (e.key !== 'Enter') return;

    const path = newInput.value.trim();
    const okContent = path.startsWith('content/') && (path.endsWith('.md') || path.endsWith('.html'));
    const okOther = path.startsWith('blog/') || path.startsWith('public/');
    if (!path || (!okContent && !okOther)) {
      say('Path must be under content/ (.md or .html), blog/, or public/');
      return;
    }
    if (edFiles.includes(path)) {
      say('That file already exists');
      return;
    }
    if (!confirmDiscard()) return;

    const name = path.split('/').pop().replace(/\.md$/, '');
    const starter = path.startsWith('content/') && path.endsWith('.md')
      ? '^^^^\ntitle: ' + name + '\nauthor: Sheriff\nlayout: docs\nmeta_kind: overview\nmeta_type: docs\nsummary: \n^^^^\n\n# ' + name + '\n\nWrite your page here.\n'
      : '\n';

    try {
      const q = 'portal=' + encodeURIComponent(edPortal.value) + '&path=' + encodeURIComponent(path);
      const res = await fetch('/api/write_file?' + q, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: starter
      });
      const data = await res.json();
      if (buildFailed(data)) {
        say(data.stderr ? String(data.stderr).trim().slice(0, 120) : 'Could not create page');
        return;
      }
      newRow.hidden = true;
      say('Page created');
      await loadFiles();
      openPath(path);
    } catch (err) {
      say('API unreachable');
    }
  });

  // warn on tab close with unsaved changes
  window.addEventListener('beforeunload', e => {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  // ---------- boot ----------
  loadPortals().then(showView);
  showView();
})();
