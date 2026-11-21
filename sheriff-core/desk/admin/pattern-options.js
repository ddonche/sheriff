// Pattern syntax shared by Desk and its public page editor.
(() => {
  function parsePatternHeader(body) {
    const lines = String(body || '').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^:::\s*pattern\s+(\S+)\s+(.+?)\s*$/);
      if (!m) continue;
      let mode = 'reusable';
      let endIndex = i + 1;
      for (; endIndex < lines.length; endIndex++) {
        if (/^\s*:::\s*$/.test(lines[endIndex])) break;
        const option = lines[endIndex].match(/^\s*@mode\s*=\s*(template|reusable)\s*$/i);
        if (option) mode = option[1].toLowerCase();
      }
      return { orientation: m[1], name: m[2].trim(), mode, lineIndex: i, endIndex };
    }
    return null;
  }

  function setPatternMode(body, mode) {
    const text = String(body || '');
    const header = parsePatternHeader(text);
    if (!header) return text;
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.split(/\r?\n/);
    const fields = lines.slice(header.lineIndex + 1, header.endIndex)
      .filter(line => !/^\s*@mode\s*=/.test(line.toLowerCase()));
    const value = mode === 'template' ? 'template' : 'reusable';
    lines.splice(header.lineIndex + 1, header.endIndex - header.lineIndex - 1,
      '@mode = ' + value, ...fields);
    return lines.join(eol);
  }

  function patternToken(name) {
    const up = name.trim().replace(/ \(pattern\)|\(pattern\)|[()]/g, '').replace(/[- ]/g, '_').toUpperCase();
    return '{{{SHERIFF::PATTERN_' + up + '}}}';
  }

  window.SheriffPatternOptions={patternHeader:parsePatternHeader,setPatternMode,patternToken,patternSource:body=>setPatternMode(body,'template')};
})();
