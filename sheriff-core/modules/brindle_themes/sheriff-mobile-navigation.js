(function () {
  'use strict';

  function init() {
    const main = document.querySelector('.sheriff-main-layout-three, .sheriff-main-layout-two');
    if (!main || main.dataset.mobileNavigation || typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return;
    main.dataset.mobileNavigation = 'ready';
    const mobile = matchMedia('(max-width: 960px)');
    const root = document.documentElement;
    const svg = paths => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
    const icons = {
      browse: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
      page: svg('<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>'),
      close: svg('<path d="m6 6 12 12M18 6 6 18"/>'),
      arrow: svg('<path d="m9 5 7 7-7 7"/>').replace('<svg ', '<svg class="sheriff-mobile-arrow" ')
    };
    const bar = document.createElement('nav');
    bar.className = 'sheriff-mobile-browse-bar';
    bar.setAttribute('aria-label', 'Page navigation');
    const entries = [];
    let openEntry = null;
    let savedOverflow = '';

    function unlock() {
      if (!openEntry) return;
      root.style.overflow = savedOverflow;
      openEntry = null;
    }

    function close(entry, returnFocus = true) {
      entry.returnFocus = returnFocus;
      entry.button.setAttribute('aria-expanded', 'false');
      if (entry.dialog.open) entry.dialog.close();
      unlock();
    }

    function focusTarget(target) {
      if (!target) return;
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
        target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
      }
      target.focus({ preventScroll: true });
    }

    for (const item of [
      { selector: ':scope > .sheriff-left-nav', name: 'Browse', kind: 'browse' },
      { selector: ':scope > .sheriff-toc, :scope > .sheriff-sidebar', name: 'On this page', kind: 'page' }
    ]) {
      const node = main.querySelector(item.selector);
      if (!node || (!node.textContent.trim() && !node.querySelector('a, img, input, button, iframe, video'))) continue;
      const marker = document.createComment('Mobile navigation: original ' + item.kind + ' position');
      node.before(marker);
      const button = document.createElement('button');
      button.type = 'button';
      button.innerHTML = icons[item.kind] + '<span>' + item.name + '</span>' + icons.arrow;
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-expanded', 'false');
      const dialog = document.createElement('dialog');
      let id = 'sheriff-mobile-' + item.kind;
      while (document.getElementById(id)) id += '-nav';
      dialog.id = id;
      dialog.className = 'sheriff-mobile-nav-panel sheriff-mobile-' + item.kind + '-panel';
      dialog.setAttribute('aria-labelledby', id + '-title');
      button.setAttribute('aria-controls', id);
      dialog.innerHTML = '<header class="sheriff-mobile-panel-heading"><h2 id="' + id + '-title">' + item.name + '</h2><button class="sheriff-mobile-panel-close" type="button" aria-label="Close ' + item.name + '" autofocus>' + icons.close + '</button></header><div class="sheriff-mobile-panel-body"></div>';
      const panelBody = dialog.querySelector('.sheriff-mobile-panel-body');
      const toc = node.querySelector('.toc');
      const tocMarker = toc ? document.createComment('Mobile navigation: original contents position') : null;
      if (tocMarker) toc.before(tocMarker);
      const tocDetails = toc?.querySelector('details');
      const entry = { node, marker, button, dialog, panelBody, toc, tocMarker, tocDetails, tocOpen: tocDetails?.open, returnFocus: true };
      entries.push(entry);
      bar.append(button);
      document.body.append(dialog);

      button.addEventListener('click', () => {
        if (!mobile.matches || dialog.open) return;
        if (openEntry) close(openEntry, false);
        entry.returnFocus = true;
        savedOverflow = root.style.overflow;
        dialog.showModal();
        openEntry = entry;
        root.style.overflow = 'hidden';
        button.setAttribute('aria-expanded', 'true');
      });
      dialog.querySelector('.sheriff-mobile-panel-close').addEventListener('click', () => close(entry));
      dialog.addEventListener('cancel', event => { event.preventDefault(); close(entry); });
      dialog.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const focusable = [...dialog.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]')]
          .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      });
      dialog.addEventListener('close', () => {
        // Ignore a queued close event if the user has already reopened this panel.
        if (dialog.open) return;
        if (openEntry === entry) unlock();
        button.setAttribute('aria-expanded', 'false');
        if (entry.returnFocus && mobile.matches) button.focus({ preventScroll: true });
      });
      dialog.addEventListener('click', event => {
        if (event.target === dialog) {
          const rect = dialog.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(entry);
          return;
        }
        const link = event.target.closest('a[href]');
        if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target === '_blank' || link.hasAttribute('download')) return;
        const url = new URL(link.href, location.href);
        let target;
        if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search && url.hash) {
          try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch { /* Keep normal link behavior for malformed fragments. */ }
        }
        close(entry, !target);
        if (target) {
          // Let the link, content-tabs and hashchange handlers keep their normal behavior.
          for (let parent = target.parentElement; parent; parent = parent.parentElement) {
            if (parent.tagName === 'DETAILS') parent.open = true;
          }
          requestAnimationFrame(() => {
            focusTarget(target);
            target.scrollIntoView({ block: 'start', behavior: 'instant' });
          });
        }
      });
    }

    function layout() {
      for (const entry of entries) {
        if (mobile.matches) {
          entry.panelBody.append(entry.node);
          if (entry.toc) entry.node.prepend(entry.toc);
          if (entry.tocDetails) { entry.tocOpen = entry.tocDetails.open; entry.tocDetails.open = true; }
        } else {
          const wasOpen = entry.dialog.open;
          if (wasOpen) close(entry, false);
          entry.marker.after(entry.node);
          if (entry.tocMarker) entry.tocMarker.after(entry.toc);
          if (entry.tocDetails) entry.tocDetails.open = entry.tocOpen;
          if (wasOpen) focusTarget(main.querySelector('.sheriff-article h1, .sheriff-article'));
        }
      }
    }

    if (entries.length) main.before(bar);
    root.classList.add('sheriff-mobile-ready');
    mobile.addEventListener('change', layout);
    layout();

    // Scout's existing dropdown labels also need touch/keyboard activation.
    const dropdowns = [];
    document.querySelectorAll('.sheriff-header-nav > ul > li').forEach(li => {
      const panel = li.querySelector(':scope > .dropdown-panel');
      const label = li.querySelector(':scope > span.sheriff-link');
      if (!panel || !label) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = label.className + ' sheriff-header-menu-toggle';
      button.append(...label.childNodes);
      let id = 'sheriff-header-menu-' + (dropdowns.length + 1);
      while (document.getElementById(id)) id += '-nav';
      panel.id ||= id;
      button.setAttribute('aria-controls', panel.id);
      button.setAttribute('aria-expanded', 'false');
      label.replaceWith(button);
      li.classList.add('sheriff-header-menu-ready');
      const setOpen = open => { li.classList.toggle('sheriff-header-menu-open', open); button.setAttribute('aria-expanded', String(open)); };
      const entry = { li, button, setOpen };
      dropdowns.push(entry);
      button.addEventListener('click', () => {
        const open = button.getAttribute('aria-expanded') !== 'true';
        dropdowns.forEach(other => other.setOpen(false));
        setOpen(open);
      });
      li.addEventListener('mouseenter', () => { if (matchMedia('(hover: hover)').matches) setOpen(true); });
      li.addEventListener('mouseleave', () => { if (matchMedia('(hover: hover)').matches && !li.contains(document.activeElement)) setOpen(false); });
      li.addEventListener('focusout', event => { if (!li.contains(event.relatedTarget)) setOpen(false); });
      li.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); button.focus(); }
        if (event.key === 'ArrowDown' && event.target === button) { event.preventDefault(); setOpen(true); panel.querySelector('a')?.focus(); }
      });
    });
    document.addEventListener('click', event => {
      dropdowns.forEach(entry => { if (!entry.li.contains(event.target)) entry.setOpen(false); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}());
