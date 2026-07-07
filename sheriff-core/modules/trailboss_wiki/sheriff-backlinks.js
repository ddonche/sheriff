(function () {
  function renderBacklinks(widget, entries) {
    var body = widget.querySelector(".sheriff-wiki-backlinks-body");
    if (!body) return;

    if (!Array.isArray(entries) || entries.length === 0) {
      body.innerHTML = '<p class="sheriff-wiki-backlinks-empty">No pages link here.</p>';
      return;
    }

    var list = document.createElement("ul");
    list.className = "sheriff-wiki-backlinks-list";

    entries.forEach(function (entry) {
      if (!entry || !entry.href) return;

      var item = document.createElement("li");
      var link = document.createElement("a");
      link.className = "sheriff-link";
      link.href = entry.href;
      link.textContent = entry.title || entry.href;

      item.appendChild(link);
      list.appendChild(item);
    });

    body.innerHTML = "";
    body.appendChild(list);
  }

  function loadBacklinks(widget) {
    if (widget.dataset.sheriffBacklinksLoaded === "true") return;
    widget.dataset.sheriffBacklinksLoaded = "true";

    var src = widget.getAttribute("data-sheriff-backlinks");
    if (!src) {
      renderBacklinks(widget, []);
      return;
    }

    fetch(src, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) return [];
        return response.json();
      })
      .then(function (entries) {
        renderBacklinks(widget, entries);
      })
      .catch(function () {
        renderBacklinks(widget, []);
      });
  }

  function initBacklinks() {
    document.querySelectorAll("[data-sheriff-backlinks]").forEach(function (widget) {
      if (widget.dataset.sheriffBacklinksBound === "true") return;
      widget.dataset.sheriffBacklinksBound = "true";

      if (widget.open) loadBacklinks(widget);

      widget.addEventListener("toggle", function () {
        if (widget.open) loadBacklinks(widget);
      });
    });
  }

  if (window.SheriffBacklinks) {
    window.SheriffBacklinks.init();
    return;
  }

  window.SheriffBacklinks = {
    init: initBacklinks
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBacklinks);
  } else {
    initBacklinks();
  }
})();
