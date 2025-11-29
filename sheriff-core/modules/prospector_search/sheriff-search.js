(function () {
  const input = document.getElementById("sheriff-search");
  if (!input) return;

  let index = null;
  const resultsBox = input.nextElementSibling;

  async function loadIndex() {
    if (index) return index;
    
    const resp = await fetch("/public/search-index.jsonl");
    const text = await resp.text();
    
    // Parse JSONL (one JSON object per line)
    index = text
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
    
    return index;
  }

  function scoreEntry(entry, q) {
    const qLower = q.toLowerCase();
    let score = 0;

    if (entry.title.toLowerCase().includes(qLower)) score += 10;
    
    for (const h of entry.headings || []) {
      if (h.toLowerCase().includes(qLower)) {
        score += 5;
        break;
      }
    }

    if ((entry.summary || "").toLowerCase().includes(qLower)) score += 3;
    if ((entry.content || "").toLowerCase().includes(qLower)) score += 1;

    return score * (entry.weight || 1);
  }

  function renderResults(entries, q) {
    if (!q) {
      resultsBox.style.display = "none";
      resultsBox.innerHTML = "";
      return;
    }

    const top = entries
      .map(e => ({ entry: e, score: scoreEntry(e, q) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    if (!top.length) {
      resultsBox.style.display = "none";
      resultsBox.innerHTML = "";
      return;
    }

    const ul = document.createElement("ul");
    for (const { entry } of top) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = entry.url;
      a.innerHTML = `<strong>${entry.title}</strong>`;
      
      if (entry.summary) {
        const p = document.createElement("p");
        p.textContent = entry.summary;
        a.appendChild(p);
      }
      
      li.appendChild(a);
      ul.appendChild(li);
    }
    
    resultsBox.innerHTML = "";
    resultsBox.appendChild(ul);
    resultsBox.style.display = "block";
  }

  input.addEventListener("input", async (e) => {
    const q = e.target.value.trim();
    const idx = await loadIndex();
    renderResults(idx, q);
  });

  input.addEventListener("blur", () => {
    setTimeout(() => {
      resultsBox.style.display = "none";
    }, 200);
  });

  input.addEventListener("focus", async () => {
    const q = input.value.trim();
    if (q) {
      const idx = await loadIndex();
      renderResults(idx, q);
    }
  });
})();