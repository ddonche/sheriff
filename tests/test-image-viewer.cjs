// Real Goblin image/pattern rendering and ordinary-image viewer behavior.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const repo=process.env.SHERIFF_TEST_REPO||path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-image-viewer-')),core=path.join(tmp,'sheriff-core');
const pw=process.env.SHERIFF_NATIVE_ONLY==='1'?null:require(process.env.SHERIFF_PLAYWRIGHT_MODULE||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const dimensions={large:[3600,2200],small:[96,64],tall:[400,5000],wide:[5000,400]};
const body=[
 '## Ordinary images',
 'Click a thumbnail or picture to view the original image, fitted to your screen.',
 '[[image:sheriff-viewer-large.svg|thumb|center|A large diagram]]',
 '## Image in an infobox',
 '::: pattern vertical Example',
 '@mode = template',
 '_image = [[image:sheriff-viewer-small.svg|full|center|Small image at its natural size]]',
 'description = Ordinary pattern images use the same viewer.',
 ':::',
 '## Tall and wide images',
 '![Tall image](/public/images/sheriff-viewer-tall.svg)',
 '[[image:sheriff-viewer-wide.svg|thumb|center|A wide image]]',
 '## Existing behavior is preserved',
 '<a href="/linked.html" id="linked-image"><img src="/public/images/sheriff-viewer-small.svg" alt="Linked image"></a>',
 '<img class="sheriff-image sheriff-interactive" id="interactive-image" src="/public/images/sheriff-viewer-small.svg" alt="Existing interactive image">',
 '<img class="sheriff-image" id="async-interactive-image" src="/public/images/sheriff-viewer-small.svg" alt="Asynchronously upgraded image">',
 '<img id="custom-control" role="button" tabindex="0" src="/public/images/sheriff-viewer-small.svg" alt="Existing custom control">',
 '<img id="broken-image" src="/public/images/not-found.svg" alt="Missing image">'
].join('\n\n');
let checks=0;
(async()=>{let browser,server;try{
 fs.cpSync(path.join(repo,'sheriff-core'),core,{recursive:true});
 for(const theme of ['compendium','outpost','siegemate']){const portal=path.join(tmp,'site/portals',theme),images=path.join(portal,'public/images');fs.mkdirSync(images,{recursive:true});fs.writeFileSync(path.join(portal,'config.yall'),'theme:\n  name: '+theme+'\n  brand_name: Image viewer\n');
  for(const [name,[w,h]]of Object.entries(dimensions))fs.writeFileSync(path.join(images,'sheriff-viewer-'+name+'.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'"><defs><linearGradient id="g"><stop stop-color="#176b87"/><stop offset="1" stop-color="#723b85"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><path d="M0 0L'+w+' '+h+'M'+w+' 0L0 '+h+'" stroke="#ffffff66" stroke-width="'+Math.min(w,h)/80+'"/><text x="50%" y="50%" fill="white" text-anchor="middle" font-family="sans-serif" font-size="'+Math.min(w,h)/8+'">'+w+' × '+h+'</text></svg>');
 }
 fs.writeFileSync(path.join(core,'viewer-body.txt'),body);
 fs.writeFileSync(path.join(core,'viewer-fixture.gbln'),String.raw`import modules/markdown_core/markdown as markdown
import modules/sheriff_patterns/patterns as patterns
import modules/trailboss_wiki/trailboss as trailboss
import modules/brindle_themes/brindle as brindle
import modules/stagehand/stagehand as stagehand
for theme in ["compendium", "outpost", "siegemate"]
    for key in ["STYLE", "LOGO", "BRANDNAME", "THEMESWITCHER"]
        :clear_token("BRINDLE", key)
    xx
    for key in ["left_wiki_SIDEBAR", "header_DROPDOWN", "footer_left_FLAT", "footer_right_FLAT", "TOC", "BREADCRUMBS"]
        :register_token("SCOUT", key, "")
    xx
    for key in ["VERSION", "PAGE_COUNT", "REPO", "READTIME", "UTILICONS"]
        :register_token("BADGE", key, "")
    xx
    for key in ["DOC_VERSIONS", "REVISION_META", "CATEGORIES", "CANONLINK"]
        :register_token("TRAILBOSS", key, "")
    xx
    :register_token("PROSPECTOR", "SEARCH_INPUT", "")
    ctx | {"portal": theme, "body": :read_text("viewer-body.txt"), "frontmatter": {"title": "Images, enlarged", "layout": "wiki"}, "build_mode": "page"}
    ctx |= patterns::apply_patterns(ctx)
    ctx |= markdown::render(ctx)
    ctx |= trailboss::render_fences(ctx)
    ctx |= trailboss::process_wikilinks(ctx)
    ctx |= brindle::apply_layout(ctx)
    ctx |= stagehand::wire_slots(ctx)
    ctx |= brindle::apply_tokens(ctx)
    :write_text!("../dist/{theme}/viewer.html", ctx{"body"})
    stagehand::copy_assets({"portal": theme})
xx
`);
 const run=spawnSync(process.env.SHERIFF_GOBLIN||'goblin',['run','viewer-fixture.gbln'],{cwd:core,encoding:'utf8',timeout:30000,env:{...process.env,SHERIFF_RUNTIME_MODE:'cloud',SHERIFF_BUILD_OUTPUT:''}});assert.equal(run.status,0,run.stderr+'\n'+run.stdout.slice(-2500));
 const output=path.join(tmp,'dist');
 for(const theme of ['compendium','outpost','siegemate']){assert.equal(fs.readFileSync(path.join(output,theme,'public/js/sheriff-image-viewer.js'),'utf8'),fs.readFileSync(path.join(core,'modules/brindle_themes/sheriff-image-viewer.js'),'utf8'));assert.equal(fs.readFileSync(path.join(output,theme,'viewer.html'),'utf8').match(/src="\/public\/js\/sheriff-image-viewer.js"/g)?.length,1);checks++;}
 if(process.env.SHERIFF_NATIVE_ONLY==='1'){console.log('Passed '+checks+' native '+"image-viewer assets"+' checks.');return;}
 server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),theme=url.searchParams.get('theme')||'compendium';const file=path.resolve(output,theme,decodeURIComponent(url.pathname).replace(/^\/+/,''));if(!['compendium','outpost','siegemate'].includes(theme)||!file.startsWith(path.resolve(output,theme)+path.sep)){res.writeHead(400);return res.end()}
  if(fs.existsSync(file)&&fs.statSync(file).isFile()){res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[path.extname(file)]||'text/plain')+'; charset=utf-8'});res.end(fs.readFileSync(file))}else{res.writeHead(404);res.end('Not found')}
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 browser=await pw.chromium.launch({headless:true,executablePath:process.env.SHERIFF_BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 for(const theme of ['compendium','outpost','siegemate'])for(const mode of ['light','dark'])for(const width of [1280,390,320]){
  const context=await browser.newContext({viewport:{width,height:width===1280?900:700},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(mode=>localStorage.setItem('brindle-theme',mode),mode);await context.route('**/*',r=>{if(!r.request().url().startsWith(base))return r.abort();const u=new URL(r.request().url());u.searchParams.set('theme',theme);return r.continue({url:u.href})});
  await page.goto(base+'/viewer.html?theme='+theme);await page.locator('html[data-sheriff-image-viewer="ready"]').waitFor();
  const dialog=page.getByRole('dialog',{name:'Image preview'});
  for(const name of ['large','small','tall','wide']){const img=page.locator('.sheriff-article img[src="/public/images/sheriff-viewer-'+name+'.svg"]').first();if(name==='small')assert.equal(await img.locator('xpath=ancestor::*[contains(@class,"sheriff-pattern")]').count()>0,true);await img.click();await dialog.waitFor();const image=dialog.locator('img');await image.evaluate(e=>e.decode());const size=await image.evaluate(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,nw:e.naturalWidth,nh:e.naturalHeight,x:r.x,y:r.y,viewportWidth:innerWidth,viewportHeight:innerHeight}});assert(size.width<=size.nw+1&&size.height<=size.nh+1,'Do not upscale small images');assert(size.x>=0&&size.y>=0&&size.x+size.width<=size.viewportWidth&&size.y+size.height<=size.viewportHeight,JSON.stringify(size));assert(Math.abs(size.width/size.height-size.nw/size.nh)<.02,'Keep proportions');if(name==='large'&&width>=390)assert(size.width>await img.evaluate(e=>e.getBoundingClientRect().width),theme+'/'+width+': '+JSON.stringify(size));if(name==='small')assert.deepEqual([size.width,size.height],[96,64]);assert.equal(await image.getAttribute('src'),await img.evaluate(e=>e.currentSrc));assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),'hidden');await page.keyboard.press('Tab');assert(await dialog.getByRole('button',{name:'Close image'}).evaluate(e=>e===document.activeElement));await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert(await img.evaluate(e=>e===document.activeElement));assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),'');checks++;}
  const first=page.locator('.sheriff-article img.sheriff-image').first();await first.focus();await page.keyboard.press('Enter');await dialog.waitFor();await dialog.getByRole('button',{name:'Close image'}).click();await first.focus();await page.keyboard.press(' ');await dialog.waitFor();await page.mouse.click(1,1);await dialog.waitFor({state:'hidden'});checks++;
  assert.equal(await page.locator('#linked-image img').getAttribute('role'),null);assert.equal(await page.locator('#interactive-image').getAttribute('role'),null);assert.equal(await page.locator('#custom-control').getAttribute('role'),'button');
  await page.evaluate(()=>{window.existingInteractiveClicks=0;for(const id of ['interactive-image','async-interactive-image'])document.getElementById(id).addEventListener('click',e=>{e.preventDefault();window.existingInteractiveClicks++});document.getElementById('async-interactive-image').classList.add('sheriff-interactive')});await page.locator('#async-interactive-image').evaluate(e=>new Promise(resolve=>requestAnimationFrame(resolve)));assert.equal(await page.locator('#async-interactive-image').getAttribute('role'),null);await page.locator('#interactive-image').click();await page.locator('#async-interactive-image').click();assert.equal(await dialog.isVisible(),false);assert.equal(await page.evaluate(()=>window.existingInteractiveClicks),2);checks++;
  await page.evaluate(()=>{const img=document.createElement('img');img.src='/public/images/sheriff-viewer-small.svg';img.alt='Inserted later';document.querySelector('.sheriff-article').append(img)});await page.getByRole('button',{name:'Open image: Inserted later'}).click();await dialog.waitFor();await page.keyboard.press('Escape');checks++;
  await page.locator('#broken-image').click();await dialog.waitFor();await dialog.locator('[role="status"]').filter({hasText:'Image could not be loaded.'}).waitFor();await page.keyboard.press('Escape');assert.deepEqual(errors,[]);checks++;await context.close();
 }
 if(process.env.SHERIFF_IMAGE_PREVIEW_DIR)fs.cpSync(output,path.resolve(process.env.SHERIFF_IMAGE_PREVIEW_DIR),{recursive:true});
 console.log('Passed '+checks+' ordinary-image viewer checks: Goblin assets, all three themes/light-dark, desktop/phone, original resolution, screen fit, small images, infoboxes, keyboard/close/focus, dynamic images, explicit links and existing interactive-image ownership.');
}finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));assert(path.basename(tmp).startsWith('sheriff-image-viewer-'));fs.rmSync(tmp,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1});
