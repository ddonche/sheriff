(function () {
  "use strict";

  var HELP_ID = "sheriff-markdown-help";
  var MODAL_ID = "sheriff-markdown-modal";

  function injectStylesOnce() {
    if (document.getElementById("sheriff-markdown-help-style")) return;

    var css = ""
      + "#" + MODAL_ID + " {\n"
      + "  display: none;\n"
      + "  position: fixed;\n"
      + "  top: 0;\n"
      + "  left: 0;\n"
      + "  width: 100%;\n"
      + "  height: 100%;\n"
      + "  background: rgba(0,0,0,0.5);\n"
      + "  z-index: 9999;\n"
      + "  align-items: center;\n"
      + "  justify-content: center;\n"
      + "}\n"
      + "#" + MODAL_ID + ".show { display: flex; }\n"
      + "#" + MODAL_ID + " .modal-content {\n"
      + "  background: var(--sl-color-bg, #fff);\n"
      + "  color: var(--sl-color-text, #000);\n"
      + "  border-radius: 10px;\n"
      + "  padding: 24px;\n"
      + "  max-width: 600px;\n"
      + "  max-height: 80vh;\n"
      + "  overflow-y: auto;\n"
      + "  box-shadow: 0 4px 12px rgba(0,0,0,0.3);\n"
      + "}\n"
      + "#" + MODAL_ID + " .modal-close {\n"
      + "  float: right;\n"
      + "  font-size: 28px;\n"
      + "  font-weight: bold;\n"
      + "  cursor: pointer;\n"
      + "  border: none;\n"
      + "  background: transparent;\n"
      + "  color: inherit;\n"
      + "  line-height: 1;\n"
      + "}\n"
      + "#" + MODAL_ID + " h2 { margin-top: 0; }\n"
      + "#" + MODAL_ID + " table { width: 100%; border-collapse: collapse; margin-top: 12px; }\n"
      + "#" + MODAL_ID + " th, #" + MODAL_ID + " td {\n"
      + "  text-align: left;\n"
      + "  padding: 8px;\n"
      + "  border-bottom: 1px solid rgba(0,0,0,0.1);\n"
      + "}\n"
      + "#" + MODAL_ID + " code {\n"
      + "  background: rgba(0,0,0,0.05);\n"
      + "  padding: 2px 6px;\n"
      + "  border-radius: 4px;\n"
      + "  font-family: monospace;\n"
      + "}\n";

    var style = document.createElement("style");
    style.id = "sheriff-markdown-help-style";
    style.type = "text/css";
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  function createModal() {
    if (document.getElementById(MODAL_ID)) return;

    var modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.innerHTML =
      '<div class="modal-content">' +
        '<button class="modal-close" aria-label="Close">&times;</button>' +
        '<h2>Markdown Cheatsheet</h2>' +
        '<table>' +
          '<tr><th>Element</th><th>Syntax</th></tr>' +
          '<tr><td>Heading</td><td><code># H1</code><br><code>## H2</code><br><code>### H3</code></td></tr>' +
          '<tr><td>Bold</td><td><code>**bold text**</code></td></tr>' +
          '<tr><td>Italic</td><td><code>*italicized text*</code></td></tr>' +
          '<tr><td>Blockquote</td><td><code>&gt; blockquote</code></td></tr>' +
          '<tr><td>Ordered List</td><td><code>1. First item</code><br><code>2. Second item</code><br><code>3. Third item</code></td></tr>' +
          '<tr><td>Unordered List</td><td><code>- First item</code><br><code>- Second item</code><br><code>- Third item</code></td></tr>' +
          '<tr><td>Code</td><td><code>`code`</code></td></tr>' +
          '<tr><td>Horizontal Rule</td><td><code>---</code></td></tr>' +
          '<tr><td>Internal Link</td><td><code>[[page-slug|custom name]]</code></td></tr>' +
          '<tr><td>External Link</td><td><code>[[https://example.com|Website]]</code></td></tr>' +
          '<tr><td>Image</td><td><code>[[image:filename.jpg|thumb|left|Caption]]</code></td></tr>' +
        '</table>' +
      '</div>';

    document.body.appendChild(modal);

    modal.addEventListener("click", function (e) {
      if (e.target === modal) modal.classList.remove("show");
    });

    var closeBtn = modal.querySelector(".modal-close");
    closeBtn.addEventListener("click", function () {
      modal.classList.remove("show");
    });
  }

  injectStylesOnce();
  createModal();

  var btn = document.getElementById(HELP_ID);
  if (!btn) return;

  btn.addEventListener("click", function () {
    var modal = document.getElementById(MODAL_ID);
    if (modal) modal.classList.add("show");
  });
})();