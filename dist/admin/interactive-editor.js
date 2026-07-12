// desk/admin/interactive-editor.js
// Sheriff Desk — Interactive panel.
//
// A native Desk panel (not a modal). Flow:
//   1. Icon library: add/remove icons (stored in public/images/icons/).
//   2. Pick a portal and an image.
//   3. Drag icons from the library onto the image to place markers.
//   4. Click a marker to set where it links and its text.
//   5. Save — writes the sidecar (public/images/<name>.png.json) the runtime reads.
//
// Exposes window.SheriffInteractive.enter(portalNames, PORT), called by the
// view router in admin.js. Uses the Desk file API and Desk's own CSS classes.

(function () {
  "use strict";

  var wired = false;
  var portals = [], PORT = "5173";
  var els = {};
  var S = null; // { portal, imagePath, sidecarPath, model, sel, fit, ox, oy, dirty, icons }
  var IMG_EXT = { png:1, jpg:1, jpeg:1, gif:1, webp:1, svg:1, avif:1 };
  var ICON_ROOT = "public/images/icons";

  // ---------- helpers ----------
  function ext(p){ var m = /\.([a-z0-9]+)$/i.exec(p); return m ? m[1].toLowerCase() : ""; }
  function isImg(p){ return !!IMG_EXT[ext(p)]; }
  function clamp(v,lo,hi){ return v<lo?lo:(v>hi?hi:v); }
  function parentOf(p){ return p.split("/").slice(0,-1).join("/"); }
  function status(m){ if (els.status) els.status.textContent = m || ""; }
  function portalUrl(sub){ return "http://" + S.portal + ".localhost:" + PORT + "/" + sub; }

  // ---------- API ----------
  function apiList(portal){
    return fetch("/api/file?list&" + encodeURIComponent(portal), {cache:"no-store"})
      .then(function(r){return r.json();}).catch(function(){return {ok:false};});
  }
  function apiRead(portal, path){
    var q = "portal="+encodeURIComponent(portal)+"&path="+encodeURIComponent(path);
    return fetch("/api/file?read&"+q,{cache:"no-store"})
      .then(function(r){return r.json();}).catch(function(){return {ok:false};});
  }
  function apiWrite(portal, path, content){
    var q = "portal="+encodeURIComponent(portal)+"&path="+encodeURIComponent(path);
    return fetch("/api/file?write&"+q,{method:"POST",body:content})
      .then(function(r){return r.json();}).catch(function(){return {ok:false,stderr:"API unreachable"};});
  }
  function apiUpload(portal, path, file){
    var q = "portal="+encodeURIComponent(portal)+"&path="+encodeURIComponent(path);
    return fetch("/api/file?upload&"+q,{method:"POST",body:file})
      .then(function(r){return r.json();}).catch(function(){return {ok:false};});
  }
  function apiDelete(portal, path){
    var q = encodeURIComponent(portal)+"&"+encodeURIComponent(path);
    return fetch("/api/file?delete&"+q)
      .then(function(r){return r.json();}).catch(function(){return {ok:false};});
  }
  function apiMkdir(portal, path){
    var q = encodeURIComponent(portal)+"&"+encodeURIComponent(path);
    return fetch("/api/file?mkdir&"+q)
      .then(function(r){return r.json();}).catch(function(){return {ok:false};});
  }

  // ---------- entry ----------
  function enter(portalNames, port){
    portals = portalNames || [];
    PORT = port || (location.port || "5173");
    cacheEls();
    if (!els.portal) return;
    if (els.portal.options.length === 0 && portals.length){
      portals.forEach(function(n){
        var o = document.createElement("option"); o.value=n; o.textContent=n;
        els.portal.appendChild(o);
      });
    }
    if (els.portal.value) loadPortal();
  }

  function cacheEls(){
    if (wired) return;
    els.portal   = document.getElementById("ii-portal");
    els.image    = document.getElementById("ii-image");
    els.save     = document.getElementById("ii-save");
    els.status   = document.getElementById("ii-status");
    els.iconList = document.getElementById("ii-icon-list");
    els.iconCrumbs = document.getElementById("ii-icon-crumbs");
    els.addIcon  = document.getElementById("ii-add-icon");
    els.newFolder= document.getElementById("ii-new-folder");
    els.iconInput= document.getElementById("ii-icon-input");
    els.canvas   = document.getElementById("ii-canvas");
    els.canvasEmpty = document.getElementById("ii-canvas-empty");
    els.img      = document.getElementById("ii-img");
    els.markers  = document.getElementById("ii-markers");
    els.inspEmpty= document.getElementById("ii-insp-empty");
    els.inspFields = document.getElementById("ii-insp-fields");
    els.fLink    = document.getElementById("ii-f-link");
    els.fText    = document.getElementById("ii-f-text");
    els.fDelete  = document.getElementById("ii-f-delete");
    if (!els.portal) return;
    wired = true;

    els.portal.addEventListener("change", loadPortal);
    els.image.addEventListener("change", function(){ selectImage(els.image.value); });
    els.save.addEventListener("click", save);
    els.addIcon.addEventListener("click", function(){ els.iconInput.click(); });
    els.newFolder.addEventListener("click", newIconFolder);
    els.iconInput.addEventListener("change", function(){ uploadIcons(els.iconInput.files); });

    // canvas as a drop target for icons
    els.canvas.addEventListener("dragover", function(e){
      if (!S || !S.imagePath) return;
      if (Array.prototype.indexOf.call(e.dataTransfer.types, "text/ii-icon") < 0) return;
      e.preventDefault(); e.dataTransfer.dropEffect = "copy";
    });
    els.canvas.addEventListener("drop", function(e){
      if (!S || !S.imagePath) return;
      var icon = e.dataTransfer.getData("text/ii-icon");
      if (!icon) return;
      e.preventDefault();
      var pt = pointToImage(e.clientX, e.clientY);
      if (!pt) return;
      S.model.markers.push({ x: pt.x, y: pt.y, icon: icon, label: "", link: "", layer: "" });
      renderMarkers();
      select(S.model.markers.length - 1);
      markDirty();
    });

    // inspector field bindings
    els.fLink.addEventListener("input", function(){
      var mk = selMarker(); if (mk){ mk.link = els.fLink.value; markDirty(); }
    });
    els.fText.addEventListener("input", function(){
      var mk = selMarker(); if (mk){ mk.label = els.fText.value; renderMarkers(); markDirty(); }
    });
    els.fDelete.addEventListener("click", function(){
      if (S.sel == null) return;
      S.model.markers.splice(S.sel, 1); select(null); markDirty();
    });

    window.addEventListener("resize", function(){
      if (!S || !S.imagePath) return; computeFit(); renderMarkers();
    });
  }

  // ---------- portal load ----------
  function loadPortal(){
    S = { portal: els.portal.value, imagePath: null, sidecarPath: null,
          model: null, sel: null, fit:1, ox:0, oy:0, dirty:false,
          iconFiles: [], iconDirs: [], iconCwd: ICON_ROOT };
    els.save.disabled = true;
    resetCanvas();
    status("");
    if (!S.portal) return;
    apiList(S.portal).then(function(data){
      var files = (data && Array.isArray(data.files)) ? data.files.map(String) : [];
      var dirs  = (data && Array.isArray(data.dirs))  ? data.dirs.map(String)  : [];
      // images to annotate: public/images/*, excluding the icons tree and sidecars
      var imgs = files.filter(function(f){
        return f.indexOf("public/images/") === 0 && isImg(f)
          && f.indexOf(ICON_ROOT + "/") !== 0;
      }).sort();
      els.image.innerHTML = '<option value="">Choose an image\u2026</option>';
      imgs.forEach(function(f){
        var o = document.createElement("option");
        o.value = f; o.textContent = f.slice("public/images/".length);
        els.image.appendChild(o);
      });
      computeIcons(files, dirs);
      renderIcons();
    });
  }

  // ---------- icon library (folder-aware) ----------
  function computeIcons(files, dirs){
    S.iconFiles = files.filter(function(f){
      return f.indexOf(ICON_ROOT + "/") === 0 && isImg(f);
    }).sort();
    var dset = {}; dset[ICON_ROOT] = 1;
    (dirs || []).forEach(function(d){
      if (d === ICON_ROOT || d.indexOf(ICON_ROOT + "/") === 0) dset[d] = 1;
    });
    S.iconFiles.forEach(function(f){
      var p = parentOf(f);
      while (p && p.indexOf(ICON_ROOT) === 0){ dset[p] = 1; p = parentOf(p); }
    });
    S.iconDirs = Object.keys(dset).sort();
    if (!S.iconCwd || S.iconDirs.indexOf(S.iconCwd) < 0) S.iconCwd = ICON_ROOT;
  }

  function reloadIcons(){
    if (!S) return;
    apiList(S.portal).then(function(data){
      var files = (data && Array.isArray(data.files)) ? data.files.map(String) : [];
      var dirs  = (data && Array.isArray(data.dirs))  ? data.dirs.map(String)  : [];
      computeIcons(files, dirs);
      renderIcons();
    });
  }

  function renderIconCrumbs(){
    els.iconCrumbs.innerHTML = "";
    // path relative to ICON_ROOT, shown as "icons > set > ..."
    var rel = S.iconCwd === ICON_ROOT ? [] : S.iconCwd.slice(ICON_ROOT.length + 1).split("/");
    var segs = [{ label: "icons", path: ICON_ROOT }];
    var acc = ICON_ROOT;
    rel.forEach(function(part){ acc = acc + "/" + part; segs.push({ label: part, path: acc }); });
    segs.forEach(function(s, i){
      if (i > 0){
        var sep = document.createElement("span"); sep.className = "crumb-sep";
        sep.textContent = "\u203a"; els.iconCrumbs.appendChild(sep);
      }
      var b = document.createElement("button");
      b.type = "button";
      b.className = "crumb" + (i === segs.length - 1 ? " current" : "");
      b.textContent = s.label;
      b.addEventListener("click", function(){ S.iconCwd = s.path; renderIcons(); });
      els.iconCrumbs.appendChild(b);
    });
  }

  function folderCell(name, path, isUp){
    var cell = document.createElement("button");
    cell.type = "button";
    cell.className = "ii-folder" + (isUp ? " up" : "");
    cell.title = isUp ? "Up one level" : name;
    cell.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" '
      + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + (isUp ? '<path d="M20 12H4"/><path d="M10 18l-6-6 6-6"/>'
              : '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>')
      + '</svg><span class="ii-folder-name">' + (isUp ? ".." : escapeHtml(name)) + '</span>';
    cell.addEventListener("click", function(){ S.iconCwd = path; renderIcons(); });
    return cell;
  }

  function iconCell(f){
    var rel = f.slice("public/images/".length); // e.g. "icons/medieval/castle.png"
    var cell = document.createElement("div");
    cell.className = "ii-icon";
    cell.draggable = true;
    cell.title = "Drag onto the image \u00b7 " + rel;
    cell.addEventListener("dragstart", function(e){
      e.dataTransfer.setData("text/ii-icon", rel);
      e.dataTransfer.effectAllowed = "copy";
    });
    var im = document.createElement("img");
    im.src = portalUrl(f); im.alt = rel;
    cell.appendChild(im);
    var x = document.createElement("button");
    x.type = "button"; x.className = "ii-icon-x"; x.textContent = "\u2715";
    x.title = "Remove icon";
    x.addEventListener("click", function(ev){
      ev.stopPropagation();
      if (!window.confirm("Remove icon " + rel + "?")) return;
      apiDelete(S.portal, f).then(reloadIcons);
    });
    cell.appendChild(x);
    return cell;
  }

  function renderIcons(){
    renderIconCrumbs();
    els.iconList.innerHTML = "";
    var folders = S.iconDirs.filter(function(d){ return parentOf(d) === S.iconCwd; }).sort();
    var icons = S.iconFiles.filter(function(f){ return parentOf(f) === S.iconCwd; });
    if (S.iconCwd !== ICON_ROOT){
      els.iconList.appendChild(folderCell("..", parentOf(S.iconCwd), true));
    }
    folders.forEach(function(d){ els.iconList.appendChild(folderCell(d.split("/").pop(), d, false)); });
    icons.forEach(function(f){ els.iconList.appendChild(iconCell(f)); });
    if (!folders.length && !icons.length && S.iconCwd === ICON_ROOT){
      var e = document.createElement("div"); e.className = "portal-empty";
      e.textContent = "No icons yet. Make a set or add icons.";
      els.iconList.appendChild(e);
    }
  }

  function uploadIcons(fileList){
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length || !S) return;
    status("Uploading icons\u2026");
    var chain = Promise.resolve();
    files.forEach(function(file){
      chain = chain.then(function(){
        return apiUpload(S.portal, S.iconCwd + "/" + file.name, file);
      });
    });
    chain.then(function(){ els.iconInput.value = ""; status("Icons added"); reloadIcons(); });
  }

  function newIconFolder(){
    if (!S || !S.portal){ status("Pick a portal first"); return; }
    var name = window.prompt("New icon set (folder name):", "");
    if (name == null) return;
    name = name.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
    if (!name){ status("Invalid folder name"); return; }
    var target = S.iconCwd + "/" + name;
    status("Creating set\u2026");
    apiMkdir(S.portal, target).then(function(res){
      if (res && res.ok !== false){ S.iconCwd = target; status("Set created"); reloadIcons(); }
      else status((res && res.stderr) || "Could not create set");
    });
  }

  function escapeHtml(s){
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // ---------- image select ----------
  function selectImage(path){
    if (S && S.dirty && path !== S.imagePath &&
        !window.confirm("Discard unsaved marker changes?")){
      els.image.value = S.imagePath || ""; return;
    }
    if (!path){ S.imagePath = null; els.save.disabled = true; resetCanvas(); return; }
    S.imagePath = path;
    S.sidecarPath = path + ".json";
    S.sel = null; S.dirty = false;
    els.canvasEmpty.hidden = true;
    els.img.hidden = false;
    els.img.src = portalUrl(path);
    status("Loading\u2026");

    var probe = new Image();
    probe.onload = function(){
      apiRead(S.portal, S.sidecarPath).then(function(res){
        var model = null;
        if (res && res.ok && res.content){
          try { model = JSON.parse(res.content); } catch(e){ model = null; }
        }
        if (!model || typeof model !== "object") model = { version:1 };
        if (!Array.isArray(model.markers)) model.markers = [];
        model.image = { width: probe.naturalWidth, height: probe.naturalHeight };
        S.model = model;
        els.save.disabled = false;
        status(model.markers.length + " marker" + (model.markers.length===1?"":"s"));
        computeFit(); renderMarkers(); select(null);
      });
    };
    probe.onerror = function(){
      S.model = { version:1, image:{width:0,height:0}, markers:[] };
      status("Could not load image \u2014 build the portal first?");
      els.save.disabled = false;
      computeFit(); renderMarkers(); select(null);
    };
    probe.src = portalUrl(path);
  }

  function resetCanvas(){
    els.img.hidden = true; els.img.src = "";
    els.canvasEmpty.hidden = false;
    els.markers.innerHTML = "";
    els.image.value = "";
    select(null);
  }

  // ---------- fit / projection ----------
  function computeFit(){
    var cw = els.canvas.clientWidth, ch = els.canvas.clientHeight;
    var iw = S.model.image.width, ih = S.model.image.height;
    if (!iw || !ih){ S.fit=1; S.ox=0; S.oy=0; return; }
    S.fit = Math.min(cw/iw, ch/ih);
    var dw = iw*S.fit, dh = ih*S.fit;
    S.ox = (cw-dw)/2; S.oy = (ch-dh)/2;
    els.img.style.left = S.ox+"px"; els.img.style.top = S.oy+"px";
    els.img.style.width = dw+"px"; els.img.style.height = dh+"px";
  }
  function toDisplay(x,y){ return { left: S.ox + x*S.fit, top: S.oy + y*S.fit }; }
  function pointToImage(clientX, clientY){
    var r = els.canvas.getBoundingClientRect();
    var cx = clientX - r.left, cy = clientY - r.top;
    var iw = S.model.image.width, ih = S.model.image.height;
    if (cx < S.ox || cy < S.oy || cx > S.ox+iw*S.fit || cy > S.oy+ih*S.fit) return null;
    return { x: clamp((cx-S.ox)/S.fit,0,iw), y: clamp((cy-S.oy)/S.fit,0,ih) };
  }

  // ---------- markers ----------
  function renderMarkers(){
    els.markers.innerHTML = "";
    if (!S || !S.model || !Array.isArray(S.model.markers)) return;
    S.model.markers.forEach(function(mk,i){
      var d = toDisplay(mk.x, mk.y);
      var pin = document.createElement("button");
      pin.type = "button";
      pin.className = "ii-pin" + (S.sel===i ? " sel" : "");
      pin.style.left = d.left+"px"; pin.style.top = d.top+"px";
      if (mk.icon){
        var im = document.createElement("img");
        im.className = "ii-pin-icon"; im.src = portalUrl("public/images/"+mk.icon); im.alt="";
        pin.appendChild(im);
      } else {
        var dot = document.createElement("span"); dot.className="ii-pin-dot"; pin.appendChild(dot);
      }
      if (mk.label){
        var t = document.createElement("span"); t.className="ii-pin-label"; t.textContent=mk.label;
        pin.appendChild(t);
      }
      wireDrag(pin, i);
      els.markers.appendChild(pin);
    });
  }

  function wireDrag(pin, i){
    pin.addEventListener("mousedown", function(e){
      e.preventDefault(); e.stopPropagation();
      select(i);
      var mk = S.model.markers[i];
      var start = { mx:e.clientX, my:e.clientY, x:mk.x, y:mk.y, moved:false };
      function move(ev){
        var dx=(ev.clientX-start.mx)/S.fit, dy=(ev.clientY-start.my)/S.fit;
        if (Math.abs(ev.clientX-start.mx)+Math.abs(ev.clientY-start.my) > 2) start.moved=true;
        mk.x = clamp(start.x+dx,0,S.model.image.width);
        mk.y = clamp(start.y+dy,0,S.model.image.height);
        renderMarkers();
      }
      function up(){
        window.removeEventListener("mousemove",move);
        window.removeEventListener("mouseup",up);
        if (start.moved) markDirty();
      }
      window.addEventListener("mousemove",move);
      window.addEventListener("mouseup",up);
    });
  }

  // ---------- selection / inspector ----------
  function selMarker(){ return (S && S.sel!=null) ? S.model.markers[S.sel] : null; }
  function select(i){
    S.sel = (i==null) ? null : i;
    renderMarkers();
    var mk = selMarker();
    if (mk){
      els.inspEmpty.hidden = true;
      els.inspFields.hidden = false;
      els.fLink.value = mk.link || "";
      els.fText.value = mk.label || "";
    } else {
      els.inspEmpty.hidden = false;
      els.inspFields.hidden = true;
    }
  }

  // ---------- save ----------
  function markDirty(){ S.dirty = true; status("Unsaved changes"); }

  function serialize(){
    var m = S.model;
    var out = {};
    // preserve version + any layers/labels/license authored elsewhere
    out.version = m.version || 1;
    out.image = { width: m.image.width, height: m.image.height };
    if (m.license) out.license = m.license;
    if (m.layers)  out.layers  = m.layers;
    out.markers = m.markers.map(function(mk){
      var o = { x: Math.round(mk.x), y: Math.round(mk.y) };
      if (mk.icon)  o.icon  = mk.icon;
      if (mk.label) o.label = mk.label;
      if (mk.link)  o.link  = mk.link;
      if (mk.layer) o.layer = mk.layer;
      return o;
    });
    if (m.labels) out.labels = m.labels;
    return JSON.stringify(out, null, 2) + "\n";
  }

  function save(){
    if (!S || !S.imagePath) return;
    status("Saving\u2026");
    els.save.disabled = true;
    apiWrite(S.portal, S.sidecarPath, serialize()).then(function(res){
      els.save.disabled = false;
      if (res && res.ok !== false){ S.dirty = false; status("Saved \u2014 portal rebuilt"); }
      else status((res && res.stderr) || "Save failed");
    });
  }

  window.SheriffInteractive = { enter: enter };
})();
