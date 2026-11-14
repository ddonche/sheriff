// Real Goblin layout/asset integration and browser behavior; no user portals are built.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const http = require('node:http'), assert = require('node:assert/strict'), { spawnSync } = require('node:child_process');
const repo = process.env.SHERIFF_TEST_REPO || path.resolve(__dirname, '..');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'sheriff-mobile-navigation-'));
const core = path.join(fixture, 'sheriff-core');
const themes = ['compendium', 'outpost', 'siegemate'];
const layouts = ['wiki', 'docs', 'docs_embed', 'admin', 'blog', 'blog_index'];
const pw = process.env.SHERIFF_NATIVE_ONLY === '1' ? null : require(process.env.SHERIFF_PLAYWRIGHT_MODULE || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
let checks = 0;

(async () => {
  let server, browser;
  try {
    fs.cpSync(path.join(repo, 'sheriff-core'), core, { recursive: true });
    for (const theme of themes) {
      const portal = path.join(fixture, 'site/portals', theme);
      fs.mkdirSync(path.join(portal, 'public'), { recursive: true });
      fs.writeFileSync(path.join(portal, 'routes.json'), JSON.stringify({routes:['wiki','origins','early','guide','about','all_pages','categories','stub_pages'].map(slug=>({slug,href:'/'+slug+'.html',title:slug,aliases:[]}))}));
      fs.writeFileSync(path.join(portal, 'config.yall'), 'theme:\n  name: ' + theme + '\n  brand_name: Programming\n');
    }
    fs.writeFileSync(path.join(core, 'mobile-fixture.gbln'), String.raw`import modules/brindle_themes/brindle as brindle
import modules/stagehand/stagehand as stagehand
import modules/scout_nav/scout as scout

for theme in ["compendium", "outpost", "siegemate"]
    for key in ["STYLE", "LOGO", "BRANDNAME", "THEMESWITCHER"]
        :clear_token("BRINDLE", key)
    xx
    sidebar | scout::scout_render_sidebar(theme, {"Explore Programming": {"Current article": "/wiki.html", "History": {"Origins": "/origins.html", "Early languages": "/early.html"}, "Guides": {"Guide": "/guide.html"}}})
    :register_token("SCOUT", "left_wiki_SIDEBAR", sidebar)
    :register_token("SCOUT", "left_docs_SIDEBAR", sidebar)
    :register_token("SCOUT", "header_DROPDOWN", scout::scout_render_header_nav(theme, {"About": "/about.html", "Special": {"Pages": {"All pages": "/all_pages.html", "Categories": "/categories.html", "Stub pages": "/stub_pages.html"}}}))
    :register_token("SCOUT", "BREADCRUMBS", "<nav class=\"sheriff-breadcrumbs\"><a href=\"/\">Home</a></nav>")
    :register_token("SCOUT", "TOC", scout::generate_toc("<h2><span id=\"history\" class=\"anchor\">History</span></h2><h2><span id=\"details\" class=\"anchor\">Details</span></h2>"))
    :register_token("CAMPFIRE", "BLOG_LIST", "<h2>More posts</h2><a href=\"/other.html\">Another post</a>")
    :register_token("PROSPECTOR", "SEARCH_INPUT", "<div class=\"sheriff-search-wrapper\"><input class=\"sheriff-search-input\" type=\"search\" aria-label=\"Search this site\"><div class=\"sheriff-search-results\" hidden><a class=\"sheriff-search-result\" href=\"/result.html\">Search result</a></div></div>")
    :register_token("SCOUT", "footer_left_FLAT", "")
    :register_token("SCOUT", "footer_right_FLAT", "")
    :register_token("SITE", "FOCUS_PANEL", "")
    :register_token("BADGE", "VERSION", "")
    :register_token("BADGE", "PAGE_COUNT", "")
    :register_token("BADGE", "REPO", "")
    :register_token("BADGE", "READTIME", "")
    :register_token("BADGE", "UTILICONS", "")
    :register_token("TRAILBOSS", "DOC_VERSIONS", "")
    :register_token("TRAILBOSS", "REVISION_META", "")
    :register_token("TRAILBOSS", "CATEGORIES", "")
    :register_token("TRAILBOSS", "CANONLINK", "")
    /// First render deliberately has no pre schedule: missing assets must be available.
    for layout in ["wiki", "docs", "docs_embed", "admin", "blog", "blog_index"]
        ctx | {"portal": theme, "body": "<p>A short introduction.</p><h2><span id=\"history\" class=\"anchor\">History</span></h2><p>Text beside the menu.</p><div style=\"height:1000px\"></div><h2><span id=\"details\" class=\"anchor\">Details</span></h2><p>More text.</p>", "frontmatter": {"title": "Navigation fixture", "layout": layout, "author": "Sheriff"}, "href": "/wiki.html"}
        :clear_token("SCOUT", "TOC")
        :clear_token("SCOUT", "BREADCRUMBS")
        ctx |= brindle::apply_layout(ctx)
        ctx |= stagehand::wire_slots(ctx)
        ctx |= scout::apply_tokens(ctx)
        ctx |= brindle::apply_tokens(ctx)
        :write_text!("../dist/{theme}/{layout}.html", ctx{"body"})
    xx
    :write_text!("../dist/{theme}/public/js/sheriff-mobile-navigation.js", "old script")
    :write_text!("../dist/{theme}/public/css/sheriff-mobile-navigation.css", "old style")
    stagehand::copy_assets({"portal": theme})
xx
`);
    const generated = spawnSync(process.env.SHERIFF_GOBLIN || 'goblin', ['run', 'mobile-fixture.gbln'], { cwd: core, encoding: 'utf8', timeout: 60000, env: { ...process.env, SHERIFF_RUNTIME_MODE: 'cloud', SHERIFF_BUILD_OUTPUT: '' } });
    assert.equal(generated.status, 0, generated.stdout + '\n' + generated.stderr);
    const output = path.join(fixture, 'dist');
    for (const theme of themes) {
      for (const [source, target] of [['modules/brindle_themes/sheriff-mobile-navigation.js', 'public/js/sheriff-mobile-navigation.js'], ['themes/mobile-navigation.css', 'public/css/sheriff-mobile-navigation.css']]) {
        assert.equal(fs.readFileSync(path.join(output, theme, target), 'utf8'), fs.readFileSync(path.join(core, source), 'utf8'));
        checks++;
      }
      for (const layout of layouts) {
        const html = fs.readFileSync(path.join(output, theme, layout + '.html'), 'utf8');
        assert(html.includes('/public/css/sheriff-mobile-navigation.css'), theme + '/' + layout + ': ' + html.slice(0,450));
        assert(html.indexOf('/public/css/sheriff-mobile-navigation.css') < html.indexOf('/public/css/override.css'));
        if (layout !== 'home') assert.equal(html.match(/src="\/public\/js\/sheriff-mobile-navigation.js"/g)?.length, 1);
        checks++;
      }
    }
    if (process.env.SHERIFF_MOBILE_PREVIEW_DIR) fs.cpSync(output, path.resolve(process.env.SHERIFF_MOBILE_PREVIEW_DIR), { recursive: true });
    if (process.env.SHERIFF_NATIVE_ONLY === '1') { console.log('Passed '+checks+' native mobile-navigation layout and asset checks.'); return; }
    server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost'), theme = url.searchParams.get('theme') || 'compendium';
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const file = path.resolve(output, theme, relative || 'wiki.html');
      if (!themes.includes(theme) || !file.startsWith(path.resolve(output, theme) + path.sep)) { res.writeHead(400); res.end(); return; }
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        const ext = path.extname(file), mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
        res.writeHead(200, { 'Content-Type': (mime[ext] || 'application/octet-stream') + '; charset=utf-8' });
        res.end(fs.readFileSync(file));
      } else { res.writeHead(404); res.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    browser = await pw.chromium.launch({ headless: true, executablePath: process.env.SHERIFF_BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });

    for (const theme of themes) for (const mode of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', hasTouch: true });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await context.addInitScript(mode => { localStorage.setItem('brindle-theme', mode); }, mode);
      await context.route('**/*', route => {
        if (!route.request().url().startsWith(base)) return route.abort();
        const url = new URL(route.request().url()); url.searchParams.set('theme', theme);
        return route.continue({ url: url.href });
      });
      for (const layout of layouts.filter(x => x !== 'home')) {
        await page.goto(base + '/' + layout + '.html?theme=' + theme);
        await page.locator('html.sheriff-mobile-ready').waitFor();
        const hasBrowse = !layout.startsWith('blog');
        const browse = page.getByRole('button', { name: 'Browse', exact: true });
        const contents = page.getByRole('button', { name: 'On this page', exact: true });
        for (const width of [320, 390, 768]) {
          await page.setViewportSize({ width, height: 844 });
          assert.equal(await browse.count(), hasBrowse ? 1 : 0);
          assert(await contents.isVisible());
          assert.equal(await page.locator('.sheriff-main-layout-three > .sheriff-left-nav, .sheriff-main-layout-three > .sheriff-toc, .sheriff-main-layout-two > .sheriff-sidebar').count(), 0);
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), theme + '/' + mode + '/' + layout + '/' + width + ' overflow: ' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0,12).map(e => ({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right})))));
          checks++;
        }
        await page.setViewportSize({ width: 390, height: 844 });
        if (hasBrowse) {
          await browse.click();
          const dialog = page.getByRole('dialog', { name: 'Browse', exact: true });
          assert.equal(await browse.getAttribute('aria-expanded'), 'true');
          const nested = dialog.locator('details').first(), original = await nested.evaluate(e => e.open);
          await nested.locator('summary').first().click();
          for (let i = 0; i < 15; i++) { await page.keyboard.press('Tab'); assert(await page.evaluate(() => !!document.activeElement.closest('dialog[open]'))); }
          await page.keyboard.press('Escape');
          assert.equal(await browse.evaluate(e => e === document.activeElement), true);
          await browse.click(); assert.equal(await nested.evaluate(e => e.open), !original);
          if (layout === 'wiki') assert.equal(await dialog.locator('[aria-current="page"]').count(), 1);
          await page.mouse.click(385, 400); assert.equal(await dialog.count(), 0);
          checks += 4;
        }
        await contents.click();
        const pagePanel = page.getByRole('dialog', { name: 'On this page', exact: true });
        if (hasBrowse) {
          await pagePanel.locator('.toc a').first().click();
          assert.equal(await pagePanel.count(), 0);
          assert.equal(await page.evaluate(() => document.activeElement.id), 'history');
          assert.equal(await page.evaluate(() => location.hash), '#history');
          assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '');
          assert(await page.locator('#history').evaluate(e => e.getBoundingClientRect().top >= 50));
        } else { await pagePanel.getByRole('button', { name: 'Close On this page' }).click(); }
        checks++;
        await page.evaluate(() => scrollTo(0, 0));
        const special = page.getByRole('button', { name: /Special/ });
        await special.click();
        const allPages = page.locator('.dropdown-panel a').filter({ hasText: 'All pages' });
        assert(await allPages.isVisible());
        assert(await allPages.evaluate(e => { const r = e.getBoundingClientRect(); return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), theme + '/' + layout + ' Special link is covered by search');
        await page.keyboard.press('Escape'); assert.equal(await special.getAttribute('aria-expanded'), 'false');
        await special.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('ArrowDown');
        assert.equal(await allPages.evaluate(e => e === document.activeElement), true);
        await page.keyboard.press('Escape');
        checks += 2;
        await contents.click();
        await page.setViewportSize({ width: 1280, height: 900 });
        await contents.waitFor({state:'hidden'});
        await page.locator('dialog[open]').waitFor({state:'hidden'});
        assert.equal(await page.getByRole('dialog').count(), 0);
        assert.equal(await contents.isVisible(), false);
        assert.equal(await page.locator('.sheriff-main-layout-three > .sheriff-left-nav').count(), hasBrowse ? 1 : 0);
        assert.equal(await page.locator('.sheriff-main-layout-three > .sheriff-toc, .sheriff-main-layout-two > .sheriff-sidebar').count(), 1);
        assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '');
        checks++;
        await page.setViewportSize({ width: 390, height: 844 });
      }
      assert.deepEqual(errors, [], theme + '/' + mode);
      await context.close();
    }
    const fallback = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const page = await fallback.newPage();
    await page.goto(base + '/wiki.html');
    assert(await page.locator('.sheriff-main-layout-three > .sheriff-left-nav').isVisible());
    assert.equal(await page.locator('.sheriff-mobile-browse-bar').count(), 0); checks++;
    await fallback.close();
    if (process.env.SHERIFF_MOBILE_PREVIEW_DIR) fs.cpSync(output, path.resolve(process.env.SHERIFF_MOBILE_PREVIEW_DIR), { recursive: true });
    console.log('Passed ' + checks + ' mobile navigation checks: Goblin asset publication, all three themes, six sidebar layouts, light/dark, phone/tablet/desktop, nested menus, focus, fragments, touch/keyboard Special menu and no-JS fallback.');
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(fixture), path.resolve(os.tmpdir()));
    assert(path.basename(fixture).startsWith('sheriff-mobile-navigation-'));
    fs.rmSync(fixture, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
