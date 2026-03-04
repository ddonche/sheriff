(() => {
  let tip = null;

  function ensureTip() {
    if (tip) return tip;
    tip = document.createElement("div");
    tip.className = "sheriff-gloss-tip";
    tip.style.display = "none";
    document.body.appendChild(tip);
    return tip;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showTip(el, x, y) {
    const gloss = el.getAttribute("data-gloss");
    if (!gloss) return;

    const t = ensureTip();
    t.innerHTML =
      `<div class="sheriff-gloss-text">${escapeHtml(gloss)}</div>` +
      `<div class="sheriff-gloss-hint">Click to visit full article</div>`;

    t.style.display = "block";
    moveTip(x, y);
  }

  function hideTip() {
    if (!tip) return;
    tip.style.display = "none";
  }

  function moveTip(x, y) {
    if (!tip || tip.style.display === "none") return;

    const pad = 14;

    // First set to measure size
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;

    const rect = tip.getBoundingClientRect();

    // Above cursor by default
    let left = x + pad;
    let top = y - rect.height - pad;

    // If it would go off the top, flip below
    if (top < 8) top = y + pad;

    // If it would go off the right edge, shift left
    if (left + rect.width > window.innerWidth - 8) {
      left = window.innerWidth - rect.width - 8;
    }

    // If it would go off the left edge, clamp
    if (left < 8) left = 8;

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  document.addEventListener("mouseover", (e) => {
    const a = e.target?.closest?.("a[data-gloss]");
    if (!a) return;
    showTip(a, e.clientX, e.clientY);
  });

  document.addEventListener("mouseout", (e) => {
    const a = e.target?.closest?.("a[data-gloss]");
    if (!a) return;
    hideTip();
  });

  document.addEventListener("mousemove", (e) => {
    moveTip(e.clientX, e.clientY);
  });

  document.addEventListener("focusin", (e) => {
    const a = e.target?.closest?.("a[data-gloss]");
    if (!a) return;
    const r = a.getBoundingClientRect();
    showTip(a, r.left + r.width / 2, r.top);
  });

  document.addEventListener("focusout", (e) => {
    const a = e.target?.closest?.("a[data-gloss]");
    if (!a) return;
    hideTip();
  });
})();