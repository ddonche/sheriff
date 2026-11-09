// Visual icon browser. Previews use SVG masks without executing SVG markup.
(function () {
  'use strict';
  const fetch = (...args) => window.SheriffDeskBackend.fetch(...args);
  const context = window.SheriffPortalContext, $ = id => document.getElementById(id);
  const grid = $('ic-grid'), search = $('ic-search'), color = $('ic-color'), picker = $('ic-color-picker'), refresh = $('ic-refresh');
  const copyButton = $('ic-copy'), selectedPreview = $('ic-selected-preview');
  let icons = [], selectedName = '', loaded = null, pending = null, request = 0, copyTimer;
  function status(text, error) { $('ic-status').textContent = text; $('ic-status').classList.toggle('err', !!error); }
  function chosenColor() { const value = color.value.trim(); return value && value.length <= 120 && /^[a-zA-Z0-9#(),.% /+\-]+$/.test(value) && CSS.supports('color', value) ? value : ''; }
  function syntax(name) { return '[[icon|' + name + (chosenColor() ? '|' + chosenColor() : '') + ']]'; }
  function paint(preview, icon) {
    preview.style.setProperty('--icon-preview', 'url("data:image/svg+xml,' + encodeURIComponent(icon.svg).replace(/'/g,'%27') + '")');
    preview.style.color = chosenColor();
  }
  function updateStatus() {
    const count = icons.filter(icon => icon.name.includes(search.value.trim().toLowerCase())).length;
    const invalid = !!color.value.trim() && !chosenColor(); color.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    if (pending) status('Loading icons…');
    else status(invalid ? 'That color is not valid. Using the surrounding styling.' : count + ' of ' + icons.length + ' icons' + (context.current ? ' available for ' + context.current : ' in Core') + '.');
  }
  function updateSelection() {
    const selected = icons.find(icon => icon.name === selectedName);
    grid.querySelectorAll('.icon-tile').forEach(tile => tile.setAttribute('aria-pressed', tile.dataset.icon === selectedName ? 'true' : 'false'));
    selectedPreview.hidden = !selected; copyButton.disabled = !selected; clearTimeout(copyTimer);
    copyButton.textContent = 'Copy syntax'; copyButton.setAttribute('aria-label', selected ? 'Copy ' + selected.name : 'Copy syntax'); $('ic-copy-status').textContent = '';
    $('ic-selected-name').textContent = selected ? selected.name : 'Select an icon';
    $('ic-selected-source').textContent = selected ? selected.source + ' icon' : 'Choose a tile to see its syntax.';
    $('ic-syntax').value = selected ? syntax(selected.name) : '';
    if (selected) { paint(selectedPreview, selected); selectedPreview.setAttribute('aria-label', selected.name); }
  }
  function render() {
    const query = search.value.trim().toLowerCase(), matches = icons.filter(icon => icon.name.includes(query)); grid.replaceChildren();
    for (const icon of matches) {
      const tile = document.createElement('button'); tile.type = 'button'; tile.className = 'icon-tile'; tile.dataset.icon = icon.name;
      tile.setAttribute('aria-label', 'Select ' + icon.name); tile.title = icon.name; tile.setAttribute('aria-pressed', icon.name === selectedName ? 'true' : 'false');
      const preview = document.createElement('span'); preview.className = 'icons-preview'; preview.setAttribute('aria-hidden', 'true'); paint(preview, icon); tile.append(preview);
      tile.addEventListener('click', () => { selectedName = icon.name; updateSelection(); if (matchMedia('(max-width:760px)').matches) $('ic-selection').scrollIntoView({behavior:'smooth',block:'nearest'}); }); grid.append(tile);
    }
    $('ic-empty').hidden = !!matches.length || !!pending;
    search.placeholder = icons.length ? 'Search ' + icons.length + ' icons…' : 'Search icons…';
    updateSelection(); updateStatus();
  }
  function updateColor() {
    grid.querySelectorAll('.icons-preview').forEach(preview => { preview.style.color = chosenColor(); }); updateSelection(); updateStatus();
    const probe = document.createElement('span'); probe.style.color = chosenColor() || '#22282c'; document.body.append(probe);
    const rgb = getComputedStyle(probe).color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/); probe.remove();
    if (rgb) picker.value = '#' + rgb.slice(1,4).map(value => Number(value).toString(16).padStart(2,'0')).join('');
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (_) { const field = document.createElement('textarea'); field.value = text; field.style.position = 'fixed'; field.style.opacity = '0'; document.body.append(field); field.select(); const ok = document.execCommand('copy'); field.remove(); if (!ok) throw Error('Copy failed. Select and copy the syntax manually.'); }
  }
  copyButton.addEventListener('click', async () => {
    if (!selectedName || copyButton.disabled) return;
    const name = selectedName, text = syntax(name);
    try { await copy(text); if (name !== selectedName) return; copyButton.textContent = 'Copied'; $('ic-copy-status').textContent = 'Syntax copied to clipboard.'; copyTimer = setTimeout(() => { copyButton.textContent = 'Copy syntax'; $('ic-copy-status').textContent = ''; }, 1800); }
    catch (error) { $('ic-copy-status').textContent = error.message; }
  });
  grid.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
    const tiles = Array.from(grid.querySelectorAll('.icon-tile')), index = tiles.indexOf(event.target); if (index < 0) return;
    const columns = tiles.filter(tile => tile.offsetTop === tiles[0].offsetTop).length;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tiles.length-1 : index + ({ArrowLeft:-1,ArrowRight:1,ArrowUp:-columns,ArrowDown:columns}[event.key]);
    event.preventDefault(); tiles[Math.max(0,Math.min(tiles.length-1,next))].focus();
  });
  async function enter(force) {
    const portal = context.current, revision = context.revision, key = revision + ':' + portal;
    if (!force && (loaded === key || pending === key)) return;
    const previousName = selectedName, token = ++request; pending = key; loaded = null; icons = []; selectedName = ''; grid.replaceChildren(); updateSelection(); $('ic-empty').hidden = true; status('Loading icons…'); refresh.disabled = true;
    try {
      const response = await fetch('/api/list_icons?' + encodeURIComponent(portal), {cache:'no-store'}), data = await response.json();
      if (token !== request || revision !== context.revision || portal !== context.current) return;
      if (!response.ok || data.ok === false) throw Error(data.stderr || 'Could not load icons.');
      icons = (data.icons || []).filter(icon => typeof icon.name === 'string' && typeof icon.svg === 'string');
      selectedName = icons.some(icon => icon.name === previousName) ? previousName : icons.some(icon => icon.name === 'warning') ? 'warning' : icons[0]?.name || '';
      loaded = key; pending = null; render();
    } catch (error) { if (token === request) { pending = null; status(error.message || 'Could not load icons.', true); } }
    finally { if (token === request) { pending = null; refresh.disabled = false; } }
  }
  search.addEventListener('input', render); color.addEventListener('input', updateColor);
  picker.addEventListener('input', () => { color.value = picker.value; updateColor(); });
  $('ic-reset-color').addEventListener('click', () => { color.value = ''; updateColor(); });
  $('ic-clear-search').addEventListener('click', () => { search.value = ''; render(); search.focus(); });
  refresh.addEventListener('click', () => enter(true)); window.SheriffIcons = { enter };
  if (location.hash === '#icons') enter();
}());
