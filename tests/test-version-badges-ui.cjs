// Isolated browser checks for real theme CSS and Desk controls, with no live portal access.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');let pw;try{pw=require('playwright');}catch{pw=require(process.env.SHERIFF_PLAYWRIGHT_MODULE||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root=path.resolve(__dirname,'..'),desk=path.join(root,'sheriff-core/desk'),tempRoot=path.resolve(os.tmpdir()),fixture=fs.mkdtempSync(path.join(tempRoot,'sheriff-badge-ui-'));
const coreTest=spawnSync(process.execPath,[path.join(__dirname,'test-version-badges.cjs')],{cwd:root,encoding:'utf8',env:{...process.env,SHERIFF_BADGE_PREVIEW_DIR:fixture}});assert.equal(coreTest.status,0,coreTest.stdout+coreTest.stderr);
const badge=fs.readFileSync(path.join(fixture,'badge.html'),'utf8');
const themeNames=['compendium','outpost','siegemate'];let checks=0;
(async()=>{
 const executablePath=[process.env.SHERIFF_BROWSER_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',pw.chromium.executablePath()].filter(Boolean).find(p=>fs.existsSync(p));assert(executablePath);
 const browser=await pw.chromium.launch({executablePath,headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:2});await page.route('**/*',route=>route.abort());
 const previews=[];
 for(const {theme,override} of [...themeNames.map(theme=>({theme})),{theme:'siegemate',override:'goblin'}])for(const mode of ['light','dark']){
  const css=fs.readFileSync(path.join(root,'sheriff-core/themes',theme,'css',theme+'.css'),'utf8')+(override?'\n'+fs.readFileSync(path.join(root,'site/portals',override,'themes',theme,'override.css'),'utf8'):'');
  const content='<h3 id="heading">Pattern matching '+badge+'</h3><p id="plain">Added in v1.0.0. Normal text.</p><p id="inline">Added in '+badge+'. Normal text.</p><ul><li>New syntax '+badge+'</li></ul><table><tr><td>Feature</td><td>'+badge+'</td></tr></table><p id="standalone">'+badge+'</p>';
  const doc='<!doctype html><html data-theme="'+mode+'"><head><style>'+css+'\nbody{padding:18px;} .sheriff-article{width:auto!important;max-width:none!important;} h3{margin-top:0;} table{width:100%;}</style></head><body><article class="sheriff-article">'+content+'</article></body></html>';
  await page.setContent(doc);
  const result=await page.evaluate(()=>{
   const badge=document.querySelector('#inline .sheriff-inline-version'),label=badge.querySelector('.sheriff-inline-version-label'),icon=badge.querySelector('svg');
   const p=document.getElementById('inline'),plain=document.getElementById('plain'),headingBadge=document.querySelector('#heading .sheriff-inline-version');
   const canvas=document.createElement('canvas'),context=canvas.getContext('2d');canvas.width=canvas.height=1;
   function rgb(value){context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].slice(0,3);}
   const style=getComputedStyle(badge);
   return {count:document.querySelectorAll('.sheriff-inline-version').length,label:label.textContent,display:style.display,
    font:style.fontFamily,paragraphFont:getComputedStyle(p).fontFamily,iconBeforeLabel:icon.getBoundingClientRect().right<=label.getBoundingClientRect().left,
    height:p.getBoundingClientRect().height,plainHeight:plain.getBoundingClientRect().height,
    headingFont:parseFloat(getComputedStyle(headingBadge).fontSize),rootFont:parseFloat(getComputedStyle(document.documentElement).fontSize),
    linkColor:rgb(style.getPropertyValue("--sheriff-link")),iconForeground:rgb(getComputedStyle(icon).color),iconFill:rgb(getComputedStyle(icon).backgroundColor),iconBackground:getComputedStyle(icon).backgroundColor,labelBackground:style.backgroundColor,divider:parseFloat(getComputedStyle(icon).borderRightWidth),foreground:rgb(style.color),background:rgb(style.backgroundColor),overflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert.equal(result.count,5,theme+' '+mode);assert.equal(result.label,'v1.0.0');assert.equal(result.display,'inline-flex');assert.equal(result.font,result.paragraphFont);assert(result.iconBeforeLabel);assert.notEqual(result.iconBackground,result.labelBackground);assert.equal(result.divider,1);assert.deepEqual(result.iconFill,result.linkColor);
  assert(Math.abs(result.height-result.plainHeight)<1,JSON.stringify({theme,mode,...result}));assert(result.headingFont<=result.rootFont*.875+.1);assert(!result.overflow);
  function luminance(c){return c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((v,n,i)=>v+n*[.2126,.7152,.0722][i],0);}
  const fg=luminance(result.foreground),bg=luminance(result.background),contrast=(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);assert(contrast>=4.5,theme+' '+mode+' contrast '+contrast);
  const iconFg=luminance(result.iconForeground),iconBg=luminance(result.iconFill);assert((Math.max(iconFg,iconBg)+.05)/(Math.min(iconFg,iconBg)+.05)>=4.5,theme+' '+mode+' icon contrast');
  if(process.env.SHERIFF_BADGE_PREVIEW_DIR && !override && theme==='compendium' && mode==='light'){const out=path.resolve(process.env.SHERIFF_BADGE_PREVIEW_DIR);fs.mkdirSync(out,{recursive:true});await page.locator('#inline .sheriff-inline-version').screenshot({path:path.join(out,'badge-detail.png'),scale:'device'});}
  previews.push({theme:theme+(override?" ("+override+")":""),mode,doc});checks++;
 }
 if(process.env.SHERIFF_BADGE_PREVIEW_DIR){
  const out=path.resolve(process.env.SHERIFF_BADGE_PREVIEW_DIR);fs.mkdirSync(out,{recursive:true});
  const gallery='<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:26px;background:#eef0f2;color:#17252b;font:15px system-ui}h1{font-size:24px;margin:0 0 8px}p{margin:0 0 20px;color:#53636b}.gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.card{border:1px solid #cbd2d5;border-radius:8px;overflow:hidden;background:white}.label{padding:9px 14px;font-weight:600}iframe{display:block;width:100%;height:390px;border:0}</style></head><body><h1>Sheriff version badges</h1><p>A solid link-color icon cell beside the version label. Includes Goblin portal overrides.</p><div class="gallery"></div><script>const previews='+JSON.stringify(previews).replace(/<\/script/gi,'<\\/script')+';for(const item of previews){const card=document.createElement("section");card.className="card";const label=document.createElement("div");label.className="label";label.textContent=item.theme+" · "+item.mode;const frame=document.createElement("iframe");frame.title=label.textContent;frame.srcdoc=item.doc;card.append(label,frame);document.querySelector(".gallery").append(card);}</script></body></html>';
  fs.writeFileSync(path.join(out,'preview.html'),gallery);await page.setContent(gallery);await page.waitForFunction(()=>document.querySelectorAll('iframe').length===8&&[...document.querySelectorAll('iframe')].every(f=>f.contentDocument?.querySelector('.sheriff-inline-version')));await page.screenshot({path:path.join(out,'preview.png'),fullPage:true,scale:'css'});
 }
 await page.close();
 const deskPage=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];deskPage.on('pageerror',e=>errors.push(e.message));
 await deskPage.addInitScript(()=>{window.__copied=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.__copied.push(text)},configurable:true});});
 let config='documentation:\n  default_version: "v1.0.0"\n  versions:\n    - "v0.47.6"\n    - "v1.0.0"\n';
 await deskPage.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.hostname!=='desk.test'){await route.abort();return;}
  if(u.pathname.startsWith('/api/')){
   const endpoint=u.pathname.slice(5);let data={ok:true};
   if(endpoint==='portals')data={portals:['example']};
   else if(endpoint==='file'){
    const [verb,...rest]=u.search.slice(1).split('&'),params=new URLSearchParams(rest.join('&'));
    if(verb==='list')data={ok:true,files:['config.yall','content/example.md'],dirs:['content']};
    else if(verb==='read')data={ok:true,content:params.get('path')==='config.yall'?config:'Example page'};
    else if(verb==='write'){config=route.request().postData();data={ok:true,code:0,stdout:'',stderr:''};}
    else throw Error('Unexpected mock operation '+verb);
   }else throw Error('Unexpected endpoint '+endpoint);
   await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});return;
  }
  const file=path.resolve(desk,u.pathname==='/'?'index.html':u.pathname.slice(1));if(!file.startsWith(desk+path.sep))throw Error('Unexpected asset');if(!fs.existsSync(file)){await route.fulfill({status:404,body:''});return;}
  await route.fulfill({contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html',body:fs.readFileSync(file)});
 });
 await deskPage.goto('http://desk.test/#content');await deskPage.getByText('example.md',{exact:true}).click();await deskPage.waitForFunction(()=>document.getElementById('ed-path').textContent==='content/example.md');
 await deskPage.getByRole('combobox',{name:'Copy version badge token',exact:true}).selectOption('v0.47.6');await deskPage.waitForFunction(()=>window.__copied.length===1);assert.equal(await deskPage.evaluate(()=>window.__copied[0]),'{{{SHERIFF::v0.47.6}}}');checks++;
 await deskPage.getByRole('link',{name:'Config',exact:true}).click();await deskPage.waitForFunction(()=>document.getElementById('cf-text').value.includes('documentation:'));
 await deskPage.locator('#cf-version-badges summary').click();assert.equal(await deskPage.locator('#cf-version-badge-list code').count(),2);
 await deskPage.getByRole('button',{name:'Copy badge token for v1.0.0',exact:true}).click();await deskPage.waitForFunction(()=>window.__copied.length===2);assert.equal(await deskPage.evaluate(()=>window.__copied[1]),'{{{SHERIFF::v1.0.0}}}');checks++;
 const changed=config.replace('    - "v1.0.0"','    - "v1.0.0"\n    - "v2.0.0"');await deskPage.locator('#cf-text').fill(changed);assert.equal(await deskPage.getByRole('button',{name:'Copy badge token for v2.0.0',exact:true}).isDisabled(),true);
 await deskPage.locator('#cf-save').click();await deskPage.waitForFunction(()=>!document.querySelector('#cf-version-badge-list button').disabled);assert.equal(await deskPage.getByRole('button',{name:'Copy badge token for v2.0.0',exact:true}).isDisabled(),false);checks++;
 await deskPage.getByRole('link',{name:'Content',exact:true}).click();await deskPage.getByRole('combobox',{name:'Copy version badge token',exact:true}).selectOption('v2.0.0');await deskPage.waitForFunction(()=>window.__copied.length===3);assert.equal(await deskPage.evaluate(()=>window.__copied[2]),'{{{SHERIFF::v2.0.0}}}');checks++;
 assert.deepEqual(errors,[]);await deskPage.close();
 }finally{await browser.close();}
 assert.equal(path.dirname(fixture),tempRoot);assert(path.basename(fixture).startsWith('sheriff-badge-ui-'));fs.rmSync(fixture,{recursive:true,force:true});
 console.log('Passed '+checks+' browser checks covering eight theme/portal/mode combinations, inline sizing, contrast, and Desk token copying. No site builds run.');
})().catch(e=>{console.error(e);process.exitCode=1;});