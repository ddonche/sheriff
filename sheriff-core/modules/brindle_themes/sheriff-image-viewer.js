(function () {
  'use strict';

  function init() {
    if (document.documentElement.dataset.sheriffImageViewer || typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return;
    document.documentElement.dataset.sheriffImageViewer = 'ready';
    const managed = new WeakMap();
    let dialog, preview, caption, status, opener, savedOverflow = '';

    function eligible(img) {
      if (!img.matches('.sheriff-article img, img.sheriff-focus-panel-img')) return false;
      if (img.closest('a, button, .sheriff-page-header, .sheriff-ii-overlay, [data-no-image-viewer]')) return false;
      if (img.matches('.sheriff-interactive, .campfire-author-avatar, .sheriff-icon, [data-sheriff-icon]')) return false;
      if (img.closest('.sheriff-image-block')?.querySelector('.sheriff-ii-badge')) return false;
      if (!managed.has(img) && (img.hasAttribute('role') || img.hasAttribute('tabindex'))) return false;
      return !!img.getAttribute('src');
    }

    function update(img) {
      const previous = managed.get(img);
      if (!eligible(img)) {
        if (previous) {
          for (const [name, value] of Object.entries(previous)) {
            if (value === null) img.removeAttribute(name);
            else img.setAttribute(name, value);
          }
          img.classList.remove('sheriff-image-viewable');
          managed.delete(img);
        }
        return;
      }
      if (previous) return;
      managed.set(img, Object.fromEntries(['role', 'tabindex', 'aria-label', 'aria-haspopup'].map(name => [name, img.getAttribute(name)])));
      img.setAttribute('role', 'button');
      img.setAttribute('tabindex', '0');
      img.setAttribute('aria-haspopup', 'dialog');
      img.setAttribute('aria-label', img.alt ? 'Open image: ' + img.alt : 'Open full-size image');
      img.classList.add('sheriff-image-viewable');
    }

    function close() {
      if (dialog?.open) dialog.close();
      document.documentElement.style.overflow = savedOverflow;
    }

    function createViewer() {
      dialog = document.createElement('dialog');
      dialog.className = 'sheriff-image-viewer';
      dialog.setAttribute('aria-label', 'Image preview');
      dialog.innerHTML = '<header class="sheriff-image-viewer-header"><span>Image</span><button type="button" class="sheriff-image-viewer-close" aria-label="Close image" autofocus><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><figure class="sheriff-image-viewer-figure"><img class="sheriff-image-viewer-image" alt=""><figcaption class="sheriff-image-viewer-caption" hidden></figcaption></figure><p class="sheriff-image-viewer-status" role="status"></p>';
      preview = dialog.querySelector('img');
      caption = dialog.querySelector('figcaption');
      status = dialog.querySelector('[role="status"]');
      const button = dialog.querySelector('button');
      button.addEventListener('click', close);
      dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
      dialog.addEventListener('keydown', event => {
        // The close button is the viewer's only interactive control.
        if (event.key === 'Tab') { event.preventDefault(); button.focus(); }
      });
      dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
      });
      dialog.addEventListener('close', () => {
        if (dialog.open) return;
        document.documentElement.style.overflow = savedOverflow;
        if (opener?.isConnected) opener.focus({ preventScroll: true });
      });
      preview.addEventListener('load', () => { status.hidden = true; });
      preview.addEventListener('error', () => { status.textContent = 'Image could not be loaded.'; status.hidden = false; });
      document.body.append(dialog);
    }

    function open(img) {
      if (!eligible(img)) return;
      if (!dialog) createViewer();
      opener = img;
      const block = img.closest('.sheriff-image-block, figure, .sheriff-focus-panel');
      const label = block?.querySelector('.sheriff-image-caption, figcaption, .sheriff-focus-panel-caption')?.textContent.trim() || img.alt;
      caption.textContent = label || '';
      caption.hidden = !label;
      preview.alt = img.alt || '';
      status.textContent = 'Loading image…';
      status.hidden = false;
      preview.src = img.currentSrc || img.src;
      if (preview.complete && preview.naturalWidth) status.hidden = true;
      savedOverflow = document.documentElement.style.overflow;
      dialog.showModal();
      document.documentElement.style.overflow = 'hidden';
    }

    document.querySelectorAll('.sheriff-article img, img.sheriff-focus-panel-img').forEach(update);
    document.addEventListener('click', event => {
      const img = event.target.closest('img');
      if (!img || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !eligible(img)) return;
      event.preventDefault();
      open(img);
    });
    document.addEventListener('keydown', event => {
      const img = event.target;
      if (!img.matches?.('img') || !managed.has(img) || !eligible(img) || event.defaultPrevented || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      open(img);
    });
    // Existing interactive-image code upgrades images asynchronously. Remove our
    // ordinary-image affordance when that code takes ownership; never replace it.
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'attributes') { if (record.target.matches('img')) update(record.target); }
        else for (const node of record.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE || node.closest('.sheriff-image-viewer')) continue;
          if (node.matches('img')) update(node);
          node.querySelectorAll('img').forEach(update);
        }
      }
    });
    const roots = new Set(document.querySelectorAll('.sheriff-article, .sheriff-focus-panel'));
    roots.forEach(root => observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'src'] }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}());
