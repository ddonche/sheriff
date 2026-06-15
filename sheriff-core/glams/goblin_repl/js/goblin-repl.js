// glams/goblin-repl/goblin-repl.js
// Self-contained Goblin REPL embed. Drop onto any page.
// Expects goblin_wasm.js and goblin_wasm_bg.wasm at /public/wasm/

(function () {
  const WASM_PATH = "/public/wasm/goblin_wasm.js"; // copied from glams/goblin_repl/wasm/ by init()

  const STYLE = `
    .goblin-repl-wrap {
      background: #0f1117;
      border: 1px solid #2a2f3e;
      border-radius: 10px;
      overflow: hidden;
      font-family: "JetBrains Mono", "Fira Mono", "Cascadia Code", monospace;
      font-size: 13px;
      display: flex;
      flex-direction: column;
      min-height: 260px;
      max-height: 480px;
    }
    .goblin-repl-titlebar {
      background: #181c27;
      border-bottom: 1px solid #2a2f3e;
      padding: 8px 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: "Inter", system-ui, sans-serif;
      font-size: 11px;
      color: #64748b;
      user-select: none;
      flex-shrink: 0;
    }
    .goblin-repl-title { font-weight: 700; color: #5b95a7; letter-spacing: 0.03em; }
    .goblin-repl-status { font-size: 10px; }
    .goblin-repl-spacer { flex: 1; }
    .goblin-repl-btn {
      background: none;
      border: 1px solid #334155;
      border-radius: 4px;
      color: #64748b;
      font-size: 10px;
      font-family: "Inter", system-ui, sans-serif;
      padding: 2px 7px;
      cursor: pointer;
    }
    .goblin-repl-output {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .goblin-repl-line {
      line-height: 1.65;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .goblin-repl-line.input  { color: #5b95a7; }
    .goblin-repl-line.output { color: #e2e8f0; }
    .goblin-repl-line.error  { color: #f87171; }
    .goblin-repl-line.info   { color: #64748b; opacity: 0.7; }
    .goblin-repl-inputrow {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-top: 1px solid #2a2f3e;
      background: #181c27;
      flex-shrink: 0;
    }
    .goblin-repl-prompt { color: #5b95a7; font-weight: 700; font-size: 14px; user-select: none; }
    .goblin-repl-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #e2e8f0;
      font-family: "JetBrains Mono", "Fira Mono", monospace;
      font-size: 13px;
      caret-color: #4ade80;
    }
    .goblin-repl-run {
      background: #5b95a7;
      border: none;
      border-radius: 5px;
      color: #fff;
      font-family: "Inter", system-ui, sans-serif;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      cursor: pointer;
    }
    .goblin-repl-run:disabled { opacity: 0.4; cursor: not-allowed; background: #334155; }
  `;

  function injectStyle() {
    if (document.getElementById("goblin-repl-style")) return;
    const s = document.createElement("style");
    s.id = "goblin-repl-style";
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function uid() { return Math.random().toString(36).slice(2); }

  function isIncomplete(output) {
    return output.includes("EOF") || (output.includes("Expected") && output.includes("EOF"));
  }

  function initRepl(container, replInstance) {
    const outputEl = container.querySelector(".goblin-repl-output");
    const inputEl  = container.querySelector(".goblin-repl-input");
    const statusEl = container.querySelector(".goblin-repl-status");
    const promptEl = container.querySelector(".goblin-repl-prompt");
    const runBtn   = container.querySelector(".goblin-repl-run");
    const resetBtn = container.querySelector(".goblin-repl-btn.reset");

    const pending = [];
    const history = [];
    let histIdx   = -1;
    let draft     = "";

    statusEl.textContent = "wasm";
    inputEl.disabled = false;
    runBtn.disabled  = false;
    inputEl.focus();

    function pushLine(kind, text) {
      const div = document.createElement("div");
      div.className = "goblin-repl-line " + kind;
      div.textContent = (kind === "input" ? "› " : "  ") + text;
      outputEl.appendChild(div);
      outputEl.scrollTop = outputEl.scrollHeight;
    }

    function run() {
      const cmd = inputEl.value.trim();
      if (!cmd) return;

      if (cmd === "reset") {
        replInstance.reset();
        pending.length = 0;
        promptEl.textContent = "›";
        statusEl.textContent = "wasm";
        outputEl.innerHTML = "";
        pushLine("info", "Session reset.");
        inputEl.value = "";
        return;
      }

      pushLine("input", cmd);
      history.unshift(cmd);
      histIdx = -1;
      draft = "";
      inputEl.value = "";

      pending.push(cmd);
      const payload = pending.join("\n");

      const output = replInstance.run(payload);

      if (isIncomplete(output)) {
        promptEl.textContent = "…";
        statusEl.textContent = "…";
        return;
      }

      pending.length = 0;
      promptEl.textContent = "›";
      statusEl.textContent = "wasm";

      if (output.trim()) {
        output.split("\n").forEach(function(line) {
          if (!line.trim()) return;
          const isError = line.startsWith("Runtime error:") || line.startsWith("Compile error:");
          pushLine(isError ? "error" : "output", line);
        });
      }
    }

    runBtn.addEventListener("click", run);

    inputEl.addEventListener("keydown", function(e) {
      if (e.key === "Enter") { e.preventDefault(); run(); return; }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!history.length) return;
        if (histIdx === -1) draft = inputEl.value;
        histIdx = Math.min(histIdx + 1, history.length - 1);
        inputEl.value = history[histIdx] || "";
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (histIdx <= 0) { histIdx = -1; inputEl.value = draft; return; }
        histIdx--;
        inputEl.value = history[histIdx] || "";
        return;
      }
    });

    resetBtn.addEventListener("click", function() {
      replInstance.reset();
      pending.length = 0;
      promptEl.textContent = "›";
      statusEl.textContent = "wasm";
      outputEl.innerHTML = "";
      pushLine("info", "Session reset.");
    });
  }

  function buildHTML(id) {
    return `
      <div class="goblin-repl-wrap" id="${id}">
        <div class="goblin-repl-titlebar">
          <span class="goblin-repl-title">Goblin REPL</span>
          <span class="goblin-repl-status">loading…</span>
          <span class="goblin-repl-spacer"></span>
          <button class="goblin-repl-btn reset">reset</button>
        </div>
        <div class="goblin-repl-output">
          <div class="goblin-repl-line info">  Goblin REPL — type reset to clear session.</div>
        </div>
        <div class="goblin-repl-inputrow">
          <span class="goblin-repl-prompt">›</span>
          <input class="goblin-repl-input" type="text" disabled placeholder="loading vm…"
            autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" />
          <button class="goblin-repl-run" disabled>run</button>
        </div>
      </div>
    `;
  }

  let wasmMod   = null;
  let wasmReady = null;

  function loadWasm() {
    if (wasmReady) return wasmReady;
    wasmReady = import(WASM_PATH).then(function(mod) {
      return mod.default().then(function() { wasmMod = mod; return mod; });
    });
    return wasmReady;
  }

  function mountAll() {
    injectStyle();
    const placeholders = document.querySelectorAll(".goblin-repl-placeholder");
    if (!placeholders.length) return;

    loadWasm().then(function(mod) {
      placeholders.forEach(function(ph) {
        const id = "goblin-repl-" + uid();
        ph.outerHTML = buildHTML(id);
        const container = document.getElementById(id);
        const repl = new mod.GoblinRepl();
        initRepl(container, repl);
      });
    }).catch(function(e) {
      placeholders.forEach(function(ph) {
        ph.textContent = "Failed to load Goblin REPL: " + e.message;
        ph.style.color = "#f87171";
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAll);
  } else {
    mountAll();
  }
})();
