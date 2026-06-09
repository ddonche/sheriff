// glams/prospector/prospector.js
// Tiny client-side search for Prospector.
// - Loads /public/search-index.json
// - Expects NDJSON: one JSON object per line
// - Expected entry shape: { href, title, summary }
// - Wires Prospector search tokens
// - Shows dropdown results under the input

(function () {
  const INDEX_URL    = "/public/search-index.json";
  const WRAPPER_ID   = "prospector-search";
  const INPUT_ID     = "prospector-search-input";
  const RESULTS_ID   = "prospector-search-results";

  let index = [];
  let loaded = false;
  let loading = false;

  let wrapperEl = null;
  let inputEl   = null;
  let resultsEl = null;

  function log(msg) {
    console.log("[Prospector]", msg);
  }

  function initDomHandles() {
    wrapperEl = document.getElementById(WRAPPER_ID);
    inputEl   = document.getElementById(INPUT_ID);

    if (!wrapperEl || !inputEl) {
      log("Search DOM not found; aborting.");
      return false;
    }

    resultsEl = document.getElementById(RESULTS_ID);

    if (!resultsEl) {
      resultsEl = document.createElement("div");
      resultsEl.id = RESULTS_ID;
      resultsEl.className = "prospector-search-results";
      wrapperEl.appendChild(resultsEl);
    }

    return true;
  }

  function loadIndex() {
    if (loaded || loading) return;

    loading = true;

    fetch(INDEX_URL, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        const lines = text.split(/\r?\n/);
        const out = [];

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line) continue;

          try {
            var obj = JSON.parse(line);

            if (obj && obj.href && obj.title) {
              out.push({
                href: obj.href,
                title: obj.title,
                summary: obj.summary || ""
              });
            }
          } catch (e) {
            console.warn("[Prospector] bad JSON line", i + 1, e);
          }
        }

        index = out;
        loaded = true;

        log("Loaded " + index.length + " search entries.");
      })
      .catch(function (err) {
        console.error("[Prospector] failed to load index:", err);
      })
      .finally(function () {
        loading = false;
      });
  }

  function clearResults() {
    if (!resultsEl) return;

    resultsEl.innerHTML = "";
    resultsEl.style.display = "none";
  }

  function renderResults(results) {
    if (!resultsEl) return;

    if (!results || results.length === 0) {
      clearResults();
      return;
    }

    resultsEl.innerHTML = "";

    results.slice(0, 10).forEach(function (item) {
      var a = document.createElement("a");
      a.className = "prospector-search-result";
      a.href = item.href;

      var titleEl = document.createElement("div");
      titleEl.className = "prospector-search-result-title";
      titleEl.textContent = item.title;

      var summaryEl = document.createElement("div");
      summaryEl.className = "prospector-search-result-summary";
      summaryEl.textContent = item.summary || "";

      a.appendChild(titleEl);
      a.appendChild(summaryEl);
      resultsEl.appendChild(a);
    });

    resultsEl.style.display = "block";
  }

  function handleQueryChange() {
    if (!loaded || index.length === 0) {
      clearResults();
      return;
    }

    var q = (inputEl.value || "").trim().toLowerCase();

    if (!q) {
      clearResults();
      return;
    }

    var results = index.filter(function (item) {
      var t = (item.title || "").toLowerCase();
      var s = (item.summary || "").toLowerCase();

      return t.indexOf(q) !== -1 || s.indexOf(q) !== -1;
    });

    renderResults(results);
  }

  function isTextInput(el) {
    if (!el) return false;

    var tag = el.tagName;
    if (!tag) return false;

    tag = tag.toLowerCase();

    if (tag === "textarea") return true;

    if (tag === "input") {
      var type = (el.type || "").toLowerCase();

      return (
        type === "text" ||
        type === "search" ||
        type === "email" ||
        type === "url" ||
        type === "password" ||
        type === "number"
      );
    }

    return false;
  }

  function wireEvents() {
    if (!inputEl) return;

    inputEl.addEventListener("input", handleQueryChange);

    window.addEventListener("keydown", function (e) {
      if (e.key === "/" && !isTextInput(document.activeElement)) {
        e.preventDefault();
        inputEl.focus();
        inputEl.select();
      } else if (e.key === "Escape") {
        if (document.activeElement === inputEl) {
          inputEl.blur();
        }

        clearResults();
      }
    });

    document.addEventListener("click", function (e) {
      if (!wrapperEl) return;

      if (!wrapperEl.contains(e.target)) {
        clearResults();
      }
    });
  }

  function init() {
    if (!initDomHandles()) return;

    loadIndex();
    wireEvents();

    log("Search initialized.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();