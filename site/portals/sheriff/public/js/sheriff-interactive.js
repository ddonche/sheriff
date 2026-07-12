// public/js/sheriff-interactive.js
// Interactive Image behavior for Sheriff.
//
// Does NOTHING unless an <img class="sheriff-image"> has a sidecar JSON
// sitting next to it at <src>.json. If the sidecar exists, that image
// becomes interactive: click opens a full-screen pan/zoom viewer with
// markers (wikilink hotspots), toggleable layers, and text annotations.
//
// The image render in Trailboss is untouched. This is a pure enhancement:
// plain <img> stays a plain <img> until a sidecar is found.
//
// Sidecar shape (see sheriff-interactive.md):
//   {
//     "version": 1,
//     "image":   { "width": 814, "height": 622 },
//     "license": { "author": "", "source": "", "license": "", "note": "" },
//     "layers":  [ { "id": "cities", "label": "Cities", "visible": true } ],
//     "markers": [ { "x": 410, "y": 300, "icon": "icons/city.png",
//                    "label": "Andergard", "link": "Andergard",
//                    "layer": "cities" } ],
//     "labels":  [ { "x": 200, "y": 150, "text": "The Reach",
//                    "size": 18, "layer": "cities" } ]
//   }
//
// marker.link:
//   - starts with "/"  -> used verbatim as the href (no resolution)
//   - otherwise        -> treated as a wikilink target and resolved
//                         through the portal's routes.json, exactly like
//                         the build resolver (normalize_to_slug +
//                         canonical_slug/slug/aliases match).

(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // tiny helpers (matching focus_panel.js conventions)
  // ---------------------------------------------------------------------
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function el(tag, cls, parent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  }
  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  // ---------------------------------------------------------------------
  // wikilink resolution — mirror of Trailboss normalize_to_slug +
  // lookup_href_by_slug. routes.json is fetched once per mount, cached.
  // ---------------------------------------------------------------------
  var routesCache = {}; // mount -> Promise<routes[]>

  function normalizeToSlug(page) {
    if (!page) return "";
    var cleaned = String(page)
      .replace(/ \(module\)/g, "")
      .replace(/\(module\)/g, "")
      .replace(/\(/g, "")
      .replace(/\)/g, "")
      .trim();
    if (!cleaned) return "";
    return cleaned.toLowerCase().replace(/ /g, "-").replace(/_/g, "-");
  }

  function loadRoutes(mount) {
    if (routesCache[mount]) return routesCache[mount];
    var url = (mount || "") + "/public/routes.json";
    routesCache[mount] = fetch(url)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !Array.isArray(data.routes)) return [];
        return data.routes;
      })
      .catch(function () { return []; });
    return routesCache[mount];
  }

  // Returns a Promise<string|null> — the resolved href, or null if unresolved.
  function resolveLink(link, mount) {
    if (!link) return Promise.resolve(null);
    // Direct href — navigate verbatim, no routes.json needed.
    if (link.charAt(0) === "/") return Promise.resolve(link);

    var hashIdx = link.indexOf("#");
    var target = hashIdx >= 0 ? link.slice(0, hashIdx) : link;
    var anchor = hashIdx >= 0 ? link.slice(hashIdx) : "";
    var slug = normalizeToSlug(target);
    if (!slug) return Promise.resolve(null);

    return loadRoutes(mount).then(function (routes) {
      for (var i = 0; i < routes.length; i++) {
        var meta = routes[i];
        if (!meta) continue;
        var metaSlug = meta.canonical_slug || meta.slug || "";
        if (metaSlug === slug && meta.href) return meta.href + anchor;
        if (Array.isArray(meta.aliases)) {
          for (var j = 0; j < meta.aliases.length; j++) {
            if (normalizeToSlug(meta.aliases[j]) === slug && meta.href) {
              return meta.href + anchor;
            }
          }
        }
      }
      return null;
    });
  }

  // ---------------------------------------------------------------------
  // derive the sidecar url and the mount from an <img>
  // src "/m/public/images/maps/a.png" -> sidecar + mount "/m"
  // src "/public/images/maps/a.png"   -> sidecar + mount ""
  // ---------------------------------------------------------------------
  function sidecarUrl(src) {
    var q = src.indexOf("?");
    return (q >= 0 ? src.slice(0, q) : src) + ".json";
  }
  function mountOf(src) {
    var idx = src.indexOf("/public/");
    return idx >= 0 ? src.slice(0, idx) : "";
  }

  // ---------------------------------------------------------------------
  // The viewer. One instance is built lazily on first open and reused.
  // ---------------------------------------------------------------------
  var Viewer = (function () {
    var overlay, stage, world, imgEl, markerLayer, labelLayer,
        layersPanel, footer, zoomWrap;
    var scale = 1, tx = 0, ty = 0, minScale = 0.1, maxScale = 12;
    var natW = 0, natH = 0;
    var drag = null;
    var built = false;

    function build() {
      if (built) return;
      built = true;

      overlay = el("div", "sheriff-ii-overlay");
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");

      stage = el("div", "sheriff-ii-stage", overlay);
      world = el("div", "sheriff-ii-world", stage);
      imgEl = el("img", "sheriff-ii-img", world);
      imgEl.setAttribute("draggable", "false");
      labelLayer = el("div", "sheriff-ii-labels", world);
      markerLayer = el("div", "sheriff-ii-markers", world);

      // controls
      zoomWrap = el("div", "sheriff-ii-controls", overlay);
      mkBtn(zoomWrap, "+", "Zoom in", function () { zoomBy(1.3); });
      mkBtn(zoomWrap, "\u2212", "Zoom out", function () { zoomBy(1 / 1.3); });
      mkBtn(zoomWrap, "\u2922", "Fit", fit);

      var closeBtn = mkBtn(overlay, "\u2715", "Close", close);
      closeBtn.className = "sheriff-ii-close";

      layersPanel = el("div", "sheriff-ii-layers", overlay);
      footer = el("div", "sheriff-ii-footer", overlay);

      // interactions
      stage.addEventListener("wheel", onWheel, { passive: false });
      stage.addEventListener("mousedown", onDown);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      stage.addEventListener("touchstart", onTouchStart, { passive: false });
      stage.addEventListener("touchmove", onTouchMove, { passive: false });
      stage.addEventListener("touchend", onTouchEnd);
      overlay.addEventListener("mousedown", function (e) {
        if (e.target === overlay) close();
      });
      document.addEventListener("keydown", function (e) {
        if (overlay.classList.contains("is-open") && e.key === "Escape") close();
      });

      document.body.appendChild(overlay);
    }

    function mkBtn(parent, txt, label, fn) {
      var b = el("button", "sheriff-ii-btn", parent);
      b.type = "button";
      b.textContent = txt;
      b.setAttribute("aria-label", label);
      b.addEventListener("click", fn);
      return b;
    }

    function applyTransform() {
      world.style.transform =
        "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
      // keep marker pins a constant screen size (Google-Maps style)
      var inv = 1 / scale;
      var pins = markerLayer.children;
      for (var i = 0; i < pins.length; i++) {
        pins[i].style.transform =
          "translate(-50%,-100%) scale(" + inv + ")";
      }
    }

    function fit() {
      var r = stage.getBoundingClientRect();
      var pad = 40;
      var sw = (r.width - pad * 2) / natW;
      var sh = (r.height - pad * 2) / natH;
      scale = Math.min(sw, sh);
      minScale = scale * 0.5;
      tx = (r.width - natW * scale) / 2;
      ty = (r.height - natH * scale) / 2;
      applyTransform();
    }

    function zoomAt(factor, cx, cy) {
      var r = stage.getBoundingClientRect();
      var px = cx - r.left, py = cy - r.top;
      var ns = clamp(scale * factor, minScale, maxScale);
      var k = ns / scale;
      tx = px - (px - tx) * k;
      ty = py - (py - ty) * k;
      scale = ns;
      applyTransform();
    }
    function zoomBy(factor) {
      var r = stage.getBoundingClientRect();
      zoomAt(factor, r.left + r.width / 2, r.top + r.height / 2);
    }

    function onWheel(e) {
      e.preventDefault();
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY);
    }
    function onDown(e) {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, tx: tx, ty: ty, moved: false };
    }
    function onMove(e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      tx = drag.tx + dx;
      ty = drag.ty + dy;
      applyTransform();
    }
    function onUp() { drag = null; }

    // touch: single-finger pan, two-finger pinch
    var touch = null;
    function dist(t) {
      var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
    function mid(t) {
      return { x: (t[0].clientX + t[1].clientX) / 2,
               y: (t[0].clientY + t[1].clientY) / 2 };
    }
    function onTouchStart(e) {
      if (e.touches.length === 1) {
        var t = e.touches[0];
        touch = { mode: "pan", x: t.clientX, y: t.clientY, tx: tx, ty: ty };
      } else if (e.touches.length === 2) {
        touch = { mode: "pinch", d: dist(e.touches), m: mid(e.touches) };
        e.preventDefault();
      }
    }
    function onTouchMove(e) {
      if (!touch) return;
      e.preventDefault();
      if (touch.mode === "pan" && e.touches.length === 1) {
        var t = e.touches[0];
        tx = touch.tx + (t.clientX - touch.x);
        ty = touch.ty + (t.clientY - touch.y);
        applyTransform();
      } else if (touch.mode === "pinch" && e.touches.length === 2) {
        var nd = dist(e.touches), m = mid(e.touches);
        zoomAt(nd / touch.d, m.x, m.y);
        touch.d = nd;
      }
    }
    function onTouchEnd(e) {
      touch = e.touches.length ? touch : null;
    }

    function buildLayers(data) {
      layersPanel.innerHTML = "";
      var layers = Array.isArray(data.layers) ? data.layers : [];
      if (!layers.length) { layersPanel.style.display = "none"; return; }
      layersPanel.style.display = "";
      var head = el("div", "sheriff-ii-layers-head", layersPanel);
      head.textContent = "Layers";
      layers.forEach(function (ly) {
        var row = el("label", "sheriff-ii-layer-row", layersPanel);
        var cb = el("input", null, row);
        cb.type = "checkbox";
        cb.checked = ly.visible !== false;
        cb.setAttribute("data-layer", ly.id);
        var span = el("span", null, row);
        span.textContent = ly.label || ly.id;
        cb.addEventListener("change", function () {
          setLayerVisible(ly.id, cb.checked);
        });
        setLayerVisible(ly.id, cb.checked);
      });
    }

    function setLayerVisible(id, on) {
      qsa('[data-layer-of="' + cssEsc(id) + '"]', world).forEach(function (n) {
        n.style.display = on ? "" : "none";
      });
    }
    function cssEsc(s) { return String(s).replace(/"/g, '\\"'); }

    function buildFooter(data) {
      var lic = data.license || {};
      var bits = [];
      if (lic.author) bits.push(lic.author);
      if (lic.license) bits.push(lic.license);
      if (lic.source) bits.push(lic.source);
      if (!bits.length) { footer.style.display = "none"; return; }
      footer.style.display = "";
      footer.textContent = bits.join("  \u00b7  ");
    }

    function open(src, data, mount) {
      build();
      imgEl.src = src;

      natW = (data.image && data.image.width) || 0;
      natH = (data.image && data.image.height) || 0;

      var proceed = function () {
        world.style.width = natW + "px";
        world.style.height = natH + "px";

        markerLayer.innerHTML = "";
        labelLayer.innerHTML = "";

        // text annotations — scale with the map
        (data.labels || []).forEach(function (lb) {
          var t = el("div", "sheriff-ii-label", labelLayer);
          if (lb.layer) t.setAttribute("data-layer-of", lb.layer);
          t.style.left = lb.x + "px";
          t.style.top = lb.y + "px";
          if (lb.size) t.style.fontSize = lb.size + "px";
          t.textContent = lb.text || "";
        });

        // markers — constant screen size, resolve links lazily
        (data.markers || []).forEach(function (mk) {
          var pin = el("button", "sheriff-ii-marker", markerLayer);
          pin.type = "button";
          if (mk.layer) pin.setAttribute("data-layer-of", mk.layer);
          pin.style.left = mk.x + "px";
          pin.style.top = mk.y + "px";
          pin.title = mk.label || "";

          if (mk.icon) {
            var icon = el("img", "sheriff-ii-marker-icon", pin);
            icon.src = mount + "/public/images/" + mk.icon;
            icon.alt = mk.label || "";
            icon.setAttribute("draggable", "false");
          } else {
            el("span", "sheriff-ii-marker-pin", pin);
          }
          if (mk.label) {
            var cap = el("span", "sheriff-ii-marker-label", pin);
            cap.textContent = mk.label;
          }

          resolveLink(mk.link, mount).then(function (href) {
            if (href) {
              pin.setAttribute("data-href", href);
            } else if (mk.link) {
              pin.classList.add("is-missing");
            }
          });

          pin.addEventListener("click", function (e) {
            e.stopPropagation();
            if (drag && drag.moved) return;
            var href = pin.getAttribute("data-href");
            if (href) window.location.href = href;
          });
        });

        buildLayers(data);
        buildFooter(data);

        overlay.classList.add("is-open");
        document.documentElement.style.overflow = "hidden";
        fit();
      };

      if (natW && natH) {
        proceed();
      } else {
        // no dimensions in sidecar — read them off the loaded image
        var probe = new Image();
        probe.onload = function () {
          natW = probe.naturalWidth;
          natH = probe.naturalHeight;
          proceed();
        };
        probe.onerror = proceed;
        probe.src = src;
      }
    }

    function close() {
      overlay.classList.remove("is-open");
      document.documentElement.style.overflow = "";
    }

    return { open: open };
  })();

  // ---------------------------------------------------------------------
  // wire-up: find images, probe for sidecars, upgrade the ones that have one
  // ---------------------------------------------------------------------
  function upgrade(img) {
    var src = img.getAttribute("src");
    if (!src) return;
    var url = sidecarUrl(src);

    fetch(url)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return; // plain image, leave it alone
        var mount = mountOf(src);
        img.classList.add("sheriff-interactive");

        // inline affordance: a small corner glyph
        var block = img.closest ? img.closest(".sheriff-image-block") : null;
        if (block && !block.querySelector(".sheriff-ii-badge")) {
          var badge = el("span", "sheriff-ii-badge", block);
          badge.setAttribute("aria-hidden", "true");
          badge.textContent = "\u2922"; // expand glyph
        }

        var target = block || img;
        target.style.cursor = "zoom-in";
        target.addEventListener("click", function (e) {
          // let real links inside the block (e.g. caption links) work normally
          if (e.target && e.target.closest && e.target.closest("a")) return;
          e.preventDefault();
          try {
            Viewer.open(img.src, data, mount);
          } catch (err) {
            if (window.console) console.warn("[sheriff-interactive] open failed:", err);
          }
        });
      })
      .catch(function () { /* no sidecar / network — stays a plain image */ });
  }

  function init() {
    injectStyles();
    qsa("img.sheriff-image").forEach(upgrade);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ---------------------------------------------------------------------
  // styles — injected so this ships as a single self-contained file
  // ---------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById("sheriff-ii-styles")) return;
    var css = [
      ".sheriff-image-block{position:relative;display:inline-block}",
      ".sheriff-ii-badge{position:absolute;top:6px;right:6px;width:22px;height:22px;",
      "display:flex;align-items:center;justify-content:center;border-radius:4px;",
      "background:rgba(20,20,20,.72);color:#fff;font-size:13px;line-height:1;",
      "pointer-events:none}",
      "img.sheriff-interactive{cursor:zoom-in}",

      ".sheriff-ii-overlay{position:fixed;inset:0;z-index:2147483000;display:none;",
      "background:rgba(12,12,14,.92)}",
      ".sheriff-ii-overlay.is-open{display:block}",
      ".sheriff-ii-stage{position:absolute;inset:0;overflow:hidden;",
      "cursor:grab;touch-action:none}",
      ".sheriff-ii-stage:active{cursor:grabbing}",
      ".sheriff-ii-world{position:absolute;top:0;left:0;transform-origin:0 0;",
      "will-change:transform}",
      ".sheriff-ii-img{display:block;width:100%;height:100%;user-select:none}",

      ".sheriff-ii-markers,.sheriff-ii-labels{position:absolute;inset:0;",
      "pointer-events:none}",
      ".sheriff-ii-marker{position:absolute;transform:translate(-50%,-100%);",
      "transform-origin:50% 100%;pointer-events:auto;background:none;border:0;",
      "padding:0;cursor:pointer;display:flex;flex-direction:column;",
      "align-items:center}",
      ".sheriff-ii-marker-icon{width:32px;height:32px;object-fit:contain;",
      "filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))}",
      ".sheriff-ii-marker-pin{width:16px;height:16px;border-radius:50% 50% 50% 0;",
      "background:#c0392b;transform:rotate(-45deg);",
      "box-shadow:0 1px 3px rgba(0,0,0,.5);border:2px solid #fff}",
      ".sheriff-ii-marker-label{margin-top:2px;font-size:12px;color:#fff;",
      "background:rgba(0,0,0,.6);padding:1px 6px;border-radius:3px;",
      "white-space:nowrap;max-width:180px;overflow:hidden;",
      "text-overflow:ellipsis}",
      ".sheriff-ii-marker.is-missing .sheriff-ii-marker-pin{background:#7a7a7a}",
      ".sheriff-ii-marker.is-missing{opacity:.65}",

      ".sheriff-ii-label{position:absolute;transform:translate(-50%,-50%);",
      "color:#f5f1e6;font-weight:600;text-shadow:0 1px 3px rgba(0,0,0,.8);",
      "white-space:nowrap;pointer-events:none;font-size:16px}",

      ".sheriff-ii-controls{position:absolute;left:16px;bottom:16px;display:flex;",
      "flex-direction:column;gap:6px;z-index:2}",
      ".sheriff-ii-btn{width:38px;height:38px;border:0;border-radius:6px;",
      "background:rgba(30,30,34,.9);color:#fff;font-size:18px;cursor:pointer;",
      "display:flex;align-items:center;justify-content:center}",
      ".sheriff-ii-btn:hover{background:rgba(60,60,66,.95)}",
      ".sheriff-ii-close{position:absolute;top:16px;right:16px;z-index:2}",

      ".sheriff-ii-layers{position:absolute;top:16px;left:16px;z-index:2;",
      "background:rgba(20,20,24,.9);color:#eee;border-radius:8px;padding:10px 12px;",
      "font-size:13px;min-width:120px}",
      ".sheriff-ii-layers-head{font-weight:700;margin-bottom:6px;opacity:.8;",
      "text-transform:uppercase;letter-spacing:.04em;font-size:11px}",
      ".sheriff-ii-layer-row{display:flex;align-items:center;gap:8px;",
      "padding:3px 0;cursor:pointer}",
      ".sheriff-ii-layer-row input{cursor:pointer}",

      ".sheriff-ii-footer{position:absolute;right:16px;bottom:16px;z-index:2;",
      "background:rgba(20,20,24,.85);color:#cfcfcf;font-size:12px;",
      "padding:6px 10px;border-radius:6px;max-width:60vw}",

      "@media(max-width:860px){.sheriff-ii-layers{font-size:14px}",
      ".sheriff-ii-footer{max-width:90vw}}"
    ].join("");
    var style = document.createElement("style");
    style.id = "sheriff-ii-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }
})();
