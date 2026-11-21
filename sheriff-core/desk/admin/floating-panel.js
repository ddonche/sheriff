// Shared Desk floating panel behavior.
window.SheriffFloatingPanel = function(panel, storageKey) {
    const head = panel.querySelector('.hd-head');

    function clampPos(left, top) {
      const w = panel.offsetWidth || 480;
      const h = panel.offsetHeight || Math.min(window.innerHeight * .76, 820);
      return {
        left: Math.min(Math.max(8, left), Math.max(8, window.innerWidth - w - 8)),
        top: Math.min(Math.max(8, top), Math.max(8, window.innerHeight - h - 8))
      };
    }

    function applyPos(left, top) {
      const p = clampPos(left, top);
      panel.style.left = p.left + 'px';
      panel.style.top = p.top + 'px';
      panel.style.right = 'auto';
    }

    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved && typeof saved.left === 'number') applyPos(saved.left, saved.top);
    } catch (e) { /* default CSS position */ }
    window.addEventListener('resize', () => {
      if (panel.style.left) applyPos(parseFloat(panel.style.left), parseFloat(panel.style.top));
    });

    head.addEventListener('pointerdown', e => {
      if (e.target.closest('.wiz-x')) return;
      e.preventDefault();
      head.setPointerCapture(e.pointerId);
      const rect = panel.getBoundingClientRect();
      const offX = e.clientX - rect.left;
      const offY = e.clientY - rect.top;

      function onMove(ev) {
        applyPos(ev.clientX - offX, ev.clientY - offY);
      }
      function onUp() {
        head.releasePointerCapture(e.pointerId);
        head.removeEventListener('pointermove', onMove);
        head.removeEventListener('pointerup', onUp);
        const r = panel.getBoundingClientRect();
        localStorage.setItem(storageKey, JSON.stringify({ left: r.left, top: r.top }));
      }
      head.addEventListener('pointermove', onMove);
      head.addEventListener('pointerup', onUp);
    });
  };
