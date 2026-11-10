(function () {
  'use strict';
  const groups = new Map();

  function select(state, index, focus) {
    state.tabs.forEach((tab, i) => {
      const active = i === index;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      tab.classList.toggle('sheriff-page-tab-active', active);
      state.panels[i].hidden = !active;
    });
    if (focus) state.tabs[index].focus();
  }

  function revealTarget(hash) {
    if (!hash || hash === '#') return;
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    let panel = target.closest('.sheriff-content-tab-panel');
    while (panel) {
      const state = groups.get(panel.parentElement);
      if (state) select(state, state.panels.indexOf(panel), false);
      panel = panel.parentElement.closest('.sheriff-content-tab-panel');
    }
    return target;
  }

  function init() {
    let patternNumber = 0;
    document.querySelectorAll('[data-sheriff-content-tabs]').forEach(group => {
      if (groups.has(group)) return;
      const nav = group.querySelector(':scope > .sheriff-content-tab-list');
      if (!nav) return;
      const tabs = Array.from(nav.children).filter(el => el.classList.contains('sheriff-content-tab'));
      const panels = Array.from(group.children).filter(el => el.classList.contains('sheriff-content-tab-panel'));
      if (!tabs.length || tabs.length !== panels.length) return;
      if (panels.some(panel => !panel.id)) {
        let id;
        do { id = 'sheriff-pattern-tabs-' + (++patternNumber); } while (document.getElementById(id));
        group.id = id;
        panels.forEach((panel,index) => {
          panel.id = id + '-panel-' + (index + 1);
          tabs[index].id = id + '-tab-' + (index + 1);
          tabs[index].setAttribute('href','#' + panel.id);
        });
      }
      const state = { tabs, panels };
      groups.set(group, state);
      nav.setAttribute('role', 'tablist');
      tabs.forEach((tab, index) => {
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', panels[index].id);
        panels[index].setAttribute('role', 'tabpanel');
        panels[index].setAttribute('aria-labelledby', tab.id);
        panels[index].tabIndex = 0;
        tab.addEventListener('click', event => {
          event.preventDefault();
          select(state, index, false);
        });
        tab.addEventListener('keydown', event => {
          let next;
          if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
          else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = tabs.length - 1;
          else if (event.key === ' ') next = index;
          else return;
          event.preventDefault();
          select(state, next, true);
        });
      });
      select(state, 0, false);
      group.classList.add('sheriff-content-tabs-ready');
    });
    const target = revealTarget(location.hash);
    if (target) requestAnimationFrame(() => target.scrollIntoView());
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented) return;
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search) revealTarget(url.hash);
  });
  window.addEventListener('hashchange', () => {
    const target = revealTarget(location.hash);
    if (target) target.scrollIntoView();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}());
