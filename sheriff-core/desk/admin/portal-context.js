// One active portal for every Desk panel. New panels can mount a selector,
// subscribe to changes, and register a guard or an operation lock.
(function () {
  'use strict';
  const key = window.SheriffDeskBackend?.mode === 'cloud' ? 'desk.activePortal.cloud' : 'desk.activePortal';
  const selectors = new Map(), metadata = new Map(), listeners = new Set(), guards = new Set(), locks = new Set();
  let names = [], current = '', revision = 0, remembered = '';
  try { remembered = localStorage.getItem(key) || ''; } catch (_) {}
  const port = location.port || '5173';
  function host(portal) { return portal ? new URL(window.SheriffDeskBackend.portalUrl(portal)).host : ''; }
  function fallback(name) { return name.trim().split(/[\s_-]+/).filter(Boolean).map(s => s[0]).slice(0, 2).join('').toUpperCase() || '?'; }
  function render() {
    selectors.forEach((parts, select) => {
      if (Array.from(select.options).map(o => o.value).join('\n') !== names.join('\n')) {
        select.replaceChildren();
        names.forEach(name => { const option = document.createElement('option'); option.value = name; select.appendChild(option); });
      }
      Array.from(select.options).forEach(option => { option.textContent = (metadata.get(option.value) || {}).name || option.value; });
      select.value = current;
      select.disabled = !names.length || locks.size > 0;
      const info = metadata.get(current) || {}, name = info.name || current;
      const src = current ? info.logo || window.SheriffDeskBackend.assetUrl(current, 'public/logo.png') : '';
      parts.root.dataset.portal = current;
      parts.initials.textContent = fallback(name);
      parts.initials.hidden = !current || (!parts.img.hidden && parts.img.dataset.loaded === src);
      if (src && parts.img.getAttribute('src') !== src) {
        parts.img.hidden = true; parts.initials.hidden = false;
        parts.img.dataset.loaded = '';
        parts.img.src = src;
      } else if (!src) {
        parts.img.removeAttribute('src'); parts.img.hidden = true; parts.initials.hidden = true;
      }
      if (parts.caption) parts.caption.textContent = current ? host(current) : 'Create a portal to get started';
    });
  }
  function mount(select) {
    if (!select || selectors.has(select)) return;
    const primary = select.hasAttribute('data-portal-primary');
    const root = document.createElement('div'); root.className = 'desk-portal-picker' + (primary ? ' desk-portal-picker-primary' : '');
    select.parentNode.insertBefore(root, select);
    const icon = document.createElement('span'); icon.className = 'desk-portal-icon'; icon.setAttribute('aria-hidden', 'true');
    const img = document.createElement('img'); img.alt = ''; img.hidden = true;
    const initials = document.createElement('span'); initials.className = 'desk-portal-initials';
    icon.append(img, initials); root.append(icon);
    const text = document.createElement('div'); text.className = 'desk-portal-picker-text';
    if (primary) { const label = document.createElement('label'); label.htmlFor = select.id; label.className = 'desk-portal-label'; label.textContent = 'Active portal'; text.append(label); }
    text.append(select); root.append(text);
    let caption;
    if (primary) { caption = document.createElement('span'); caption.className = 'desk-portal-caption'; caption.setAttribute('aria-live', 'polite'); text.append(caption); }
    img.addEventListener('load', () => { img.dataset.loaded = img.getAttribute('src'); img.hidden = false; initials.hidden = true; });
    img.addEventListener('error', () => { img.hidden = true; initials.hidden = !current; });
    select.addEventListener('change', event => { event.stopImmediatePropagation(); selectPortal(select.value); }, true);
    selectors.set(select, { root, img, initials, caption }); render();
  }
  function selectPortal(name, options) {
    options = options || {};
    if (name && !names.includes(name)) { render(); return false; }
    if (name === current) { render(); return true; }
    if (!options.force) {
      if (locks.size) { render(); return false; }
      for (const guard of guards) if (guard(name, current) === false) { render(); return false; }
    }
    const previous = current; current = name; revision++;
    try { if (current) localStorage.setItem(key, current); else localStorage.removeItem(key); } catch (_) {}
    remembered = current; render();
    listeners.forEach(listener => listener(current, previous));
    window.dispatchEvent(new CustomEvent('sheriff:portal-change', { detail: { portal: current, previous } }));
    return true;
  }
  function setPortals(next, options) {
    names = Array.from(new Set((next || []).filter(name => typeof name === 'string' && name)));
    const preferred = options && options.preferred;
    const target = names.includes(preferred) ? preferred : names.includes(current) ? current : names.includes(remembered) ? remembered : names[0] || '';
    if (target !== current) selectPortal(target, { force: true }); else render();
  }
  function lock() { const token = {}; locks.add(token); render(); return () => { locks.delete(token); render(); }; }
  window.SheriffPortalContext = {
    get current() { return current; }, get revision() { return revision; },
    get locked() { return locks.size > 0; },
    get portals() { return names.slice(); }, mount, select: selectPortal, setPortals,
    setMetadata(portal, info) { if (!names.includes(portal)) return; metadata.set(portal, info || {}); render(); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    guard(fn) { guards.add(fn); return () => guards.delete(fn); }, lock
  };
  document.querySelectorAll('[data-portal-select]').forEach(mount);
}());
