// public/js/focus_panel.js
// Focus Panel behavior for Sheriff
// - Does nothing unless a page contains: [data-focus-panel]
// - Hover/focus a .sheriff-focus-link to swap the panel image + caption
// - Restores default on mouseleave / blur
// - Click/tap locks; click outside unlocks (mobile-friendly)
// - Makes panel sticky when scrolling (like Wikipedia images)

(function () {
  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  // ---- 1) Find the focus panel on this page (if none, do nothing) ----
  var panel = qs('[data-focus-panel]');
  if (!panel) return;

  var img = qs('img', panel);
  var cap = qs('.sheriff-focus-panel-caption', panel);
  if (!img) return;

  // Defaults come from HTML attributes set by Trailboss:
  var defaultSrc = panel.getAttribute('data-default-src') || img.getAttribute('src') || '';
  var defaultCaption = panel.getAttribute('data-default-caption') || '';

  function setPanel(src, caption) {
    var effectiveCaption = (caption && caption.length) ? caption : defaultCaption;

    if (src) {
      img.src = src;
    }
    img.alt = effectiveCaption || '';

    if (cap) {
      cap.textContent = effectiveCaption || '';
    }
  }

  function resetPanel() {
    setPanel(defaultSrc, defaultCaption);
  }

  resetPanel();

  // ---- 2) Sticky scroll behavior (Wikipedia-style) ----
var parent = panel.parentElement;
var placeholder = document.createElement('div');
placeholder.className = 'sheriff-focus-panel-placeholder';

// Store original position info
var originalOffset = null;
var originalRight = null;

function updateStickyPosition() {
  if (window.innerWidth <= 860) {
    // Mobile: no sticky
    panel.style.position = '';
    panel.style.top = '';
    panel.style.width = '';
    panel.style.right = '';
    if (placeholder.parentNode) {
      placeholder.remove();
    }
    return;
  }

  // Calculate where the panel originally sits
  if (!originalOffset && !placeholder.parentNode) {
    var rect = panel.getBoundingClientRect();
    originalOffset = rect.top + window.pageYOffset;
    originalRight = window.innerWidth - rect.right; // Distance from right edge
  }

  var scrollTop = window.pageYOffset;
  var panelHeight = panel.offsetHeight;
  var topThreshold = 80;

  // Check if we've scrolled past where the panel originally was
  if (scrollTop > (originalOffset - topThreshold)) {
    // Make it fixed
    var panelWidth = panel.offsetWidth;
    panel.style.position = 'fixed';
    panel.style.top = topThreshold + 'px';
    panel.style.right = originalRight + 'px'; // Use calculated right position
    panel.style.width = panelWidth + 'px';
    
    // Insert placeholder
    if (!placeholder.parentNode) {
      placeholder.style.height = panelHeight + 'px';
      placeholder.style.width = panelWidth + 'px';
      placeholder.style.float = 'right';
      placeholder.style.margin = getComputedStyle(panel).margin;
      panel.parentNode.insertBefore(placeholder, panel);
    }
  } else {
    // Return to normal flow
    panel.style.position = '';
    panel.style.top = '';
    panel.style.width = '';
    panel.style.right = '';
    if (placeholder.parentNode) {
      placeholder.remove();
    }
    originalOffset = null;
    originalRight = null;
  }
}

window.addEventListener('scroll', updateStickyPosition);
window.addEventListener('resize', updateStickyPosition);
updateStickyPosition();

  // ---- 3) Identify all focus links on the page ----
  var links = qsa('.sheriff-focus-link');
  if (links.length === 0) return;

  function readLinkData(el) {
    var src = el.getAttribute('data-focus-src') || '';
    var caption = el.getAttribute('data-focus-caption') || '';
    return { src: src, caption: caption };
  }

  function closestFocusLink(target) {
    while (target && target !== document.documentElement) {
      if (target.classList && target.classList.contains('sheriff-focus-link')) return target;
      target = target.parentNode;
    }
    return null;
  }

  var locked = false;

  // Hover: swap in (unless locked)
  document.addEventListener('mouseover', function (e) {
    if (locked) return;

    var link = closestFocusLink(e.target);
    if (!link) return;

    var d = readLinkData(link);
    if (!d.src) return;

    setPanel(d.src, d.caption);
  });

  // Leaving the link area: restore default (unless locked)
  document.addEventListener('mouseout', function (e) {
    if (locked) return;

    var link = closestFocusLink(e.target);
    if (!link) return;

    var to = e.relatedTarget;
    if (to && closestFocusLink(to)) return;

    resetPanel();
  });

  // Keyboard accessibility
  document.addEventListener('focusin', function (e) {
    if (locked) return;

    var link = closestFocusLink(e.target);
    if (!link) return;

    var d = readLinkData(link);
    if (!d.src) return;

    setPanel(d.src, d.caption);
  });

  document.addEventListener('focusout', function (e) {
    if (locked) return;

    var link = closestFocusLink(e.target);
    if (!link) return;

    resetPanel();
  });

  // Click/tap: lock
  document.addEventListener('click', function (e) {
    var link = closestFocusLink(e.target);

    if (!link) {
      if (locked) {
        locked = false;
        resetPanel();
      }
      return;
    }

    var d = readLinkData(link);
    if (!d.src) return;

    locked = true;
    setPanel(d.src, d.caption);

    e.preventDefault();
  });
})();