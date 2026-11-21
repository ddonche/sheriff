// Public browser UI only. Identity and account actions use Cloud's shared client.
(() => {
  'use strict';
  const host = document.querySelector('[data-howdy]');
  if (!host || host.dataset.ready) return;
  host.dataset.ready = 'true';
  const status = host.querySelector('.howdy-status');
  let client, loading, identity, generation = 0, open = false;
  const safeImage = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };
  function button(label, handler, className = '') {
    const element = document.createElement('button'); element.type = 'button'; element.textContent = label;
    element.className = className; element.addEventListener('click', handler); return element;
  }
  async function connect() {
    if (client) return client;
    if (!loading) loading = import('https://sheriffcloud.com/howdy/client.js').then(async module => {
      client = module;
      const navigating = await client.prepare();
      if (navigating) return client;
      client.subscribe(() => void refresh());
      return client;
    }).catch(error => { loading = null; client = null; throw error; });
    return loading;
  }
  async function perform(fn) {
    status.textContent = '';
    try { await fn(); } catch(error) { console.error('Howdy account service:', error); status.textContent = 'Sheriff Cloud sign-in is unavailable. Please contact the site owner.'; }
  }
  function closeMenu(focus = false) {
    open = false; const menu = host.querySelector('.howdy-menu'); if (menu) menu.hidden = true;
    const trigger = host.querySelector('.howdy-avatar'); trigger?.setAttribute('aria-expanded', 'false');
    if (focus) trigger?.focus();
  }
  function render() {
    host.querySelectorAll('button,.howdy-menu').forEach(node => node.remove());
    if (!identity?.user) {
      host.prepend(button('Log in / Sign up', () => perform(async () => { const api = await connect(); await api.signIn(host); await refresh(); }), 'howdy-login sheriff-header-action'));
      return;
    }
    const profile = identity.profile || {}, name = profile.display_name || profile.username || 'Your account';
    const trigger = button('', () => { open = !open; menu.hidden = !open; trigger.setAttribute('aria-expanded', String(open)); }, 'howdy-avatar');
    trigger.setAttribute('aria-label', name + ' — account menu'); trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-controls', 'howdy-account-menu');
    const image = safeImage(profile.avatar_url);
    if (image) { const img = document.createElement('img'); img.src = image; img.alt = ''; img.addEventListener('error', () => { trigger.textContent = name.charAt(0).toUpperCase(); }, {once:true}); trigger.append(img); }
    else trigger.textContent = name.charAt(0).toUpperCase();
    const menu = document.createElement('div'); menu.id = 'howdy-account-menu'; menu.className = 'howdy-menu'; menu.hidden = true;
    const heading = document.createElement('strong'); heading.textContent = name; menu.append(heading);
    menu.append(button('Account settings', () => perform(async () => { closeMenu(); await client.account(host); await refresh(); })));
    menu.append(button('Sign out', () => perform(async () => { closeMenu(); await client.signOut(); await refresh(); })));
    host.prepend(trigger, menu); open = false;
  }
  async function refresh() {
    const ticket = ++generation;
    const next = await client.identity();
    if (ticket !== generation) return;
    identity = next; render();
    void window.SheriffPageEditing?.refresh(identity,client);
  }
  host.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); closeMenu(true); } });
  document.addEventListener('click', event => { if (!host.contains(event.target)) closeMenu(); });
  document.addEventListener('focusin', event => { if (!host.contains(event.target)) closeMenu(); });
  void perform(async () => { await connect(); await refresh(); });
})();
