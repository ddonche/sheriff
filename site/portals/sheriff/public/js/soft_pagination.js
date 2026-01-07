(function () {
  "use strict";

  var TOGGLE_ID = "sheriff-page-toggle";
  var ARTICLE_SEL = "article.sheriff-article";
  var PAGE_HEADER_SEL = "header.sheriff-page-header";

  var CONTENT_WRAP_CLASS = "sheriff-paged-content";
  var PREAMBLE_CLASS = "sheriff-page-preamble";
  var SECTION_CLASS = "sheriff-page-section";
  var PAGER_CLASS = "sheriff-pager";

  var KEY_MODE = "sheriff:page_mode"; // "on" | "off"
  var KEY_INDEX_PREFIX = "sheriff:page_index:"; // + pathname

  var SPLIT_TAG = "H2";
  var MIN_SECTIONS = 1; // because we paginate by sections now

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function injectStylesOnce() {
    if (document.getElementById("sheriff-soft-pagination-style")) return;

    var css = ""
      + "/* -------------------------------------------------- */\n"
      + "/* soft pagination: width stability across pages      */\n"
      + "/* -------------------------------------------------- */\n"
      + "article.sheriff-article { min-width: 0; max-width: 100%; }\n"
      + "." + CONTENT_WRAP_CLASS + " { width: 100%; max-width: 100%; min-width: 0; }\n"
      + "." + CONTENT_WRAP_CLASS + " ." + PREAMBLE_CLASS + " { width: 100%; max-width: 100%; min-width: 0; }\n"
      + "." + CONTENT_WRAP_CLASS + " ." + SECTION_CLASS + " { width: 100%; max-width: 100%; min-width: 0; }\n"
      + "." + CONTENT_WRAP_CLASS + " pre { max-width: 100%; overflow-x: auto; }\n"
      + "." + CONTENT_WRAP_CLASS + " table { max-width: 100%; display: block; overflow-x: auto; }\n"
      + "\n"
      + "/* -------------------------------------------------- */\n"
      + "/* pager styling: readable in light + dark            */\n"
      + "/* -------------------------------------------------- */\n"
      + "." + PAGER_CLASS + " {\n"
      + "  display: flex;\n"
      + "  align-items: center;\n"
      + "  justify-content: space-between;\n"
      + "  gap: 10px;\n"
      + "  padding: 10px 12px;\n"
      + "  margin: 10px 0 14px 0;\n"
      + "  border-radius: 10px;\n"
      + "  border: 1px solid rgba(0,0,0,0.15);\n"
      + "  background: rgba(0,0,0,0.03);\n"
      + "}\n"
      + "/* Prefer color-mix when supported, so it adapts automatically */\n"
      + "@supports (background: color-mix(in srgb, black 10%, white)) {\n"
      + "  ." + PAGER_CLASS + " {\n"
      + "    border: 1px solid color-mix(in srgb, currentColor 22%, transparent);\n"
      + "    background: color-mix(in srgb, currentColor 6%, transparent);\n"
      + "  }\n"
      + "}\n"
      + "." + PAGER_CLASS + " .sheriff-pager-left,\n"
      + "." + PAGER_CLASS + " .sheriff-pager-right {\n"
      + "  display: inline-flex;\n"
      + "  align-items: center;\n"
      + "  gap: 10px;\n"
      + "}\n"
      + "." + PAGER_CLASS + " .sheriff-pager-label {\n"
      + "  font-size: 12px;\n"
      + "  opacity: 0.85;\n"
      + "  white-space: nowrap;\n"
      + "}\n"
      + "." + PAGER_CLASS + " button {\n"
      + "  appearance: none;\n"
      + "  border: 1px solid rgba(0,0,0,0.18);\n"
      + "  background: rgba(255,255,255,0.55);\n"
      + "  color: inherit;\n"
      + "  border-radius: 10px;\n"
      + "  padding: 8px 10px;\n"
      + "  cursor: pointer;\n"
      + "  line-height: 0;\n"
      + "}\n"
      + "@supports (background: color-mix(in srgb, black 10%, white)) {\n"
      + "  ." + PAGER_CLASS + " button {\n"
      + "    border: 1px solid color-mix(in srgb, currentColor 26%, transparent);\n"
      + "    background: color-mix(in srgb, currentColor 8%, transparent);\n"
      + "  }\n"
      + "  ." + PAGER_CLASS + " button:hover { background: color-mix(in srgb, currentColor 12%, transparent); }\n"
      + "}\n"
      + "." + PAGER_CLASS + " button:hover { background: rgba(0,0,0,0.05); }\n"
      + "." + PAGER_CLASS + " button:active { transform: translateY(1px); }\n";

    var style = document.createElement("style");
    style.id = "sheriff-soft-pagination-style";
    style.type = "text/css";
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  function setPressed(btn, on) {
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function persistIndex(idx) {
    lsSet(KEY_INDEX_PREFIX + location.pathname, String(idx));
  }

  function loadIndex() {
    var raw = lsGet(KEY_INDEX_PREFIX + location.pathname);
    if (!raw) return 0;
    var n = parseInt(raw, 10);
    return isNaN(n) ? 0 : n;
  }

  var btn = document.getElementById(TOGGLE_ID);
  if (!btn) return;

  var article = document.querySelector(ARTICLE_SEL);
  if (!article) return;

  var pageHeader = article.querySelector(PAGE_HEADER_SEL);

  injectStylesOnce();

  function ensureContentWrapper() {
    var existing = article.querySelector("." + CONTENT_WRAP_CLASS);
    if (existing) return existing;

    var wrap = document.createElement("div");
    wrap.className = CONTENT_WRAP_CLASS;

    if (pageHeader && pageHeader.parentNode === article) {
      if (pageHeader.nextSibling) article.insertBefore(wrap, pageHeader.nextSibling);
      else article.appendChild(wrap);
    } else {
      article.insertBefore(wrap, article.firstChild);
    }

    // Move all nodes after pageHeader (or all nodes if no pageHeader) into wrapper.
    var moveFrom = [];
    if (pageHeader && pageHeader.parentNode === article) {
      var n = pageHeader.nextSibling;
      while (n) {
        var nn = n.nextSibling;
        if (n !== wrap) moveFrom.push(n);
        n = nn;
      }
    } else {
      var n2 = article.firstChild;
      while (n2) {
        var nn2 = n2.nextSibling;
        if (n2 !== wrap) moveFrom.push(n2);
        n2 = nn2;
      }
    }

    for (var i = 0; i < moveFrom.length; i++) wrap.appendChild(moveFrom[i]);

    return wrap;
  }

  function buildPagedStructure(container) {
    // We operate on ELEMENT children, but we keep them intact (we move nodes).
    var kids = Array.prototype.slice.call(container.children);
    if (!kids.length) return null;

    // Find first H2
    var firstH2Index = -1;
    for (var i = 0; i < kids.length; i++) {
      var tag = (kids[i].tagName || "").toUpperCase();
      if (tag === SPLIT_TAG) { firstH2Index = i; break; }
    }

    // If no H2, treat everything as one section
    if (firstH2Index === -1) {
      var pre = document.createElement("div");
      pre.className = PREAMBLE_CLASS;
      for (var a = 0; a < kids.length; a++) pre.appendChild(kids[a]);

      var sec = document.createElement("section");
      sec.className = SECTION_CLASS;
      // empty section; preamble is the whole page
      return { preamble: pre, sections: [sec] };
    }

    var preamble = document.createElement("div");
    preamble.className = PREAMBLE_CLASS;

    for (var p = 0; p < firstH2Index; p++) {
      preamble.appendChild(kids[p]);
    }

    var sections = [];
    var cur = null;

    function pushCur() {
      if (cur && cur.children.length > 0) sections.push(cur);
      cur = null;
    }

    for (var s = firstH2Index; s < kids.length; s++) {
      var el = kids[s];
      var t = (el.tagName || "").toUpperCase();
      if (t === SPLIT_TAG) {
        pushCur();
        cur = document.createElement("section");
        cur.className = SECTION_CLASS;
      }
      if (!cur) {
        cur = document.createElement("section");
        cur.className = SECTION_CLASS;
      }
      cur.appendChild(el);
    }
    pushCur();

    return { preamble: preamble, sections: sections };
  }

  function ensurePager(container) {
    if (container.querySelector("." + PAGER_CLASS)) return;

    var pager = document.createElement("div");
    pager.className = PAGER_CLASS;

    pager.innerHTML =
      '<div class="sheriff-pager-left">' +
        '<button type="button" class="sheriff-pager-prev" aria-label="Previous page">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
            '<path d="M15 18l-6-6 6-6"/>' +
          "</svg>" +
        "</button>" +
        '<span class="sheriff-pager-label"></span>' +
      "</div>" +
      '<div class="sheriff-pager-right">' +
        '<button type="button" class="sheriff-pager-next" aria-label="Next page">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
            '<path d="M9 18l6-6-6-6"/>' +
          "</svg>" +
        "</button>" +
      "</div>";

    container.insertBefore(pager, container.firstChild);
  }

  function renderPage(root, idx) {
    var pre = root.querySelector("." + PREAMBLE_CLASS);
    var sections = Array.prototype.slice.call(root.querySelectorAll("." + SECTION_CLASS));
    if (!pre || !sections.length) return;

    var count = sections.length;
    idx = clamp(idx, 0, count - 1);

    // Heuristic:
    // - If preamble contains an H1 (common in docs pages), keep it ONLY on page 1.
    // - Otherwise (small lead-in), keep it on every page.
    var preHasH1 = !!pre.querySelector("h1, H1");
    var showPreamble = preHasH1 ? (idx === 0) : true;

    pre.style.display = showPreamble ? "" : "none";

    for (var i = 0; i < sections.length; i++) {
      sections[i].style.display = (i === idx) ? "" : "none";
    }

    root.setAttribute("data-page-index", String(idx));

    var label = root.querySelector(".sheriff-pager-label");
    if (label) label.textContent = "Page " + (idx + 1) + " of " + count;

    var prev = root.querySelector(".sheriff-pager-prev");
    var next = root.querySelector(".sheriff-pager-next");

    if (prev) {
      prev.onclick = function () {
        var ni = (idx - 1 + count) % count;
        renderPage(root, ni);
        persistIndex(ni);
      };
    }
    if (next) {
      next.onclick = function () {
        var ni = (idx + 1) % count;
        renderPage(root, ni);
        persistIndex(ni);
      };
    }
  }

  function paginateOn(contentRoot) {
    if (contentRoot.getAttribute("data-paged") === "true") return;

    // Snapshot original nodes for restoration
    var original = Array.prototype.slice.call(contentRoot.childNodes);
    contentRoot._sheriffOriginalNodes = original;

    var built = buildPagedStructure(contentRoot);
    if (!built || !built.sections || built.sections.length < MIN_SECTIONS) {
      // restore and bail
      while (contentRoot.firstChild) contentRoot.removeChild(contentRoot.firstChild);
      for (var r = 0; r < original.length; r++) contentRoot.appendChild(original[r]);
      delete contentRoot._sheriffOriginalNodes;
      return;
    }

    // Clear and append paged structure
    while (contentRoot.firstChild) contentRoot.removeChild(contentRoot.firstChild);
    contentRoot.appendChild(built.preamble);
    for (var i = 0; i < built.sections.length; i++) contentRoot.appendChild(built.sections[i]);

    contentRoot.setAttribute("data-paged", "true");
    contentRoot.setAttribute("data-page-count", String(built.sections.length));

    ensurePager(contentRoot);

    var idx = loadIndex();
    idx = clamp(idx, 0, built.sections.length - 1);
    renderPage(contentRoot, idx);
  }

  function paginateOff(contentRoot) {
    if (contentRoot.getAttribute("data-paged") !== "true") return;

    var original = contentRoot._sheriffOriginalNodes;

    var pager = contentRoot.querySelector("." + PAGER_CLASS);
    if (pager) pager.remove();

    while (contentRoot.firstChild) contentRoot.removeChild(contentRoot.firstChild);

    if (original && original.length) {
      for (var r = 0; r < original.length; r++) contentRoot.appendChild(original[r]);
    }

    contentRoot.removeAttribute("data-paged");
    contentRoot.removeAttribute("data-page-count");
    contentRoot.removeAttribute("data-page-index");
    delete contentRoot._sheriffOriginalNodes;
  }

  function modeOn() {
    setPressed(btn, true);
    lsSet(KEY_MODE, "on");
    var contentRoot = ensureContentWrapper();
    paginateOn(contentRoot);
  }

  function modeOff() {
    setPressed(btn, false);
    lsSet(KEY_MODE, "off");
    var contentRoot = ensureContentWrapper();
    paginateOff(contentRoot);
  }

  btn.addEventListener("click", function () {
    var on = (lsGet(KEY_MODE) === "on");
    if (on) modeOff();
    else modeOn();
  });

  if (lsGet(KEY_MODE) === "on") modeOn();
  else setPressed(btn, false);
})();
