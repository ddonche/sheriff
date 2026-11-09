// Browser checks against mocked portals; no site builds or real portal mutations.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
let playwright;
try{playwright=require('playwright');}catch{playwright=require(process.env.SHERIFF_PLAYWRIGHT_MODULE || path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root=path.resolve(__dirname,'..'),desk=path.join(root,'sheriff-core/desk');
const files=new Map([
 ['config.yall','documentation:\n  default_version: "current"\n  versions:\n    - "current"\n    - "old"\n  mode: manual\n'],
 ['content/notes.md','^^^^\ncanonical: notes\n^^^^\nOriginal notes'],
 ['content/drafts/nested/leaf.md','Draft leaf'],
 ['content/book/current/R1.md','Book revision one'],
 ['content/book/current/R3.md','Book revision three'],
 ['content/book/old/R1.md','Book old version'],
 ['content/collision.md','Do not replace']
]);
let emptyDirs=new Set(['content/empty']);
const requests=[],dialogs=[],errors=[];
let acceptDialog=true;
function within(parent,value){return value===parent||value.startsWith(parent+'/');}
function dirs(){const result=new Set(emptyDirs);for(const name of files.keys()){const bits=name.split('/');for(let i=1;i<bits.length;i++)result.add(bits.slice(0,i).join('/'));}return [...result];}
(async()=>{
 const candidates=[process.env.SHERIFF_BROWSER_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',playwright.chromium.executablePath()].filter(Boolean);
 const executablePath=candidates.find(p=>fs.existsSync(p));assert(executablePath,'Set SHERIFF_BROWSER_PATH to an installed Chromium browser.');
 const browser=await playwright.chromium.launch({headless:true,executablePath});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',async d=>{dialogs.push(d.message());if(acceptDialog)await d.accept();else{acceptDialog=true;await d.dismiss();}});
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname!=='desk.test'){await route.abort();return;}
  if(url.pathname.startsWith('/api/')){
   const endpoint=url.pathname.slice(5);let data={ok:true};
   if(endpoint==='portals')data={portals:['example']};
   else if(endpoint==='list_themes')data={themes:['outpost','compendium']};
   else if(endpoint==='file'){
    const segments=url.search.slice(1).split('&'),verb=segments.shift(),args=segments.map(decodeURIComponent);
    const named=new URLSearchParams(segments.join('&'));
    const name=named.get('path');requests.push({verb,args,name});
    if(verb==='list')data={ok:true,files:[...files.keys()],dirs:dirs()};
    else if(verb==='read')data=files.has(name)?{ok:true,content:files.get(name)}:{ok:false,stderr:'file not found'};
    else if(verb==='write'){files.set(name,route.request().postData()||'');data={ok:true,code:0,stdout:'',stderr:''};}
    else if(verb==='move'){
     const [,from,to]=args;
     if(files.has(to)||dirs().includes(to))data={ok:false,stderr:'destination already exists'};
     else{
      for(const [p,body]of [...files])if(within(from,p)){files.delete(p);files.set(to+p.slice(from.length),body);}
      emptyDirs=new Set([...emptyDirs].map(p=>within(from,p)?to+p.slice(from.length):p));
      data={ok:true,from,to};
     }
    }else if(verb==='delete'){
     const [,target]=args;
     for(const p of [...files.keys()])if(within(target,p))files.delete(p);
     emptyDirs=new Set([...emptyDirs].filter(p=>!within(target,p)));data={ok:true,path:target};
    }else throw Error('Unexpected API verb '+verb);
   }else throw Error('Unexpected API endpoint '+endpoint);
   await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});return;
  }
  const rel=url.pathname==='/'?'index.html':url.pathname.slice(1),target=path.resolve(desk,rel);
  if(!target.startsWith(desk+path.sep)&&target!==path.join(desk,'index.html'))throw Error('Unexpected asset path');
  if(!fs.existsSync(target)){await route.fulfill({status:404,body:''});return;}
  const contentType=target.endsWith('.js')?'application/javascript':target.endsWith('.css')?'text/css':target.endsWith('.png')?'image/png':'text/html';
  await route.fulfill({contentType,body:fs.readFileSync(target)});
 });
 // Poll real DOM state rather than testing a replica of the event handlers.
 async function until(fn){await page.waitForFunction(fn,null,{timeout:5000});}
 async function openFolder(name){await page.locator('.tree-folder').filter({has:page.locator('.node-name',{hasText:new RegExp('^'+name+'$')})}).click();}
 async function openFile(name){
  const row=page.locator('.tree-item').filter({has:page.getByText(name,{exact:true})});
  const target=await row.getAttribute('title');await row.click();
  await page.waitForFunction(target=>document.getElementById('ed-path').textContent===(target.endsWith('.md')?target:target.replace(/^content\//,'')),target);
 }
 async function renameOpen(newName){await itemMenu((await page.locator('#ed-path').textContent()).split('/').pop(),'rename');const input=page.locator('.rename-input');await input.fill(newName);await input.press('Enter');await until(()=>!document.querySelector('.rename-input'));}
 async function itemMenu(name,action){await page.getByRole('button',{name:'Actions for '+name,exact:true}).click();await page.locator('.ctx-menu button[data-act="'+action+'"]').click();}
 await page.goto('http://desk.test/#content');
 await until(()=>document.querySelector('.tree-item .node-name')?.textContent);
 assert.equal(await page.locator('#ed-raw-revisions').isChecked(),false);
 assert.equal(await page.locator('#ed-rename,#ed-delete').count(),0);
 assert.equal(await page.getByRole('button',{name:'Actions for book',exact:true}).count(),1);
 assert.equal(await page.getByRole('button',{name:'Actions for content',exact:true}).count(),0);
 await openFile('notes.md');await page.locator('#ed-text').fill('Unsaved notes stay open');
 acceptDialog=false;await itemMenu('notes.md','delete');
 assert(files.has('content/notes.md'));assert.equal(await page.locator('#ed-text').inputValue(),'Unsaved notes stay open');
 await renameOpen('collision.md');
 assert(files.has('content/notes.md'));assert.equal(files.get('content/collision.md'),'Do not replace');
 assert.equal(await page.locator('#ed-text').inputValue(),'Unsaved notes stay open');
 await renameOpen('renamed');
 await until(()=>document.getElementById('ed-path').textContent==='content/renamed.md');
 assert.equal(await page.locator('#ed-text').inputValue(),'Unsaved notes stay open');
 assert(!files.has('content/notes.md'));assert(files.has('content/renamed.md'));
 // The flat-page revision context must also follow the new filename.
 await page.locator('#ed-save').click();
 await until(()=>document.querySelector('#ed-version-bar .ed-vb-rev')?.textContent==='editing R2');
 assert.equal(await page.locator('#ed-tab-log').getAttribute('aria-selected'),'true');
 await page.locator('#ed-tab-editor').click();
 assert(files.has('content/renamed/current/R2.md'));assert(![...files.keys()].some(p=>p.startsWith('content/notes/')));
 await openFolder('drafts');await openFolder('nested');await openFile('leaf.md');
 await page.locator('#ed-text').fill('Unsaved draft text');
 await page.locator('#ed-filter').fill('drafts');
 await itemMenu('drafts','rename');assert.equal(await page.locator('.rename-input').inputValue(),'drafts');await page.locator('.rename-input').fill('archive');await page.locator('.rename-input').press('Enter');
 await until(()=>!document.getElementById('desk-portal').disabled && document.getElementById('ed-path').textContent==='content/archive/nested/leaf.md');
 assert.equal(await page.locator('#ed-text').inputValue(),'Unsaved draft text');
 await page.locator('#ed-filter').fill('');
 await itemMenu('archive','rename');await page.locator('.rename-input').fill('Archive');await page.locator('.rename-input').press('Enter');
 await until(()=>!document.getElementById('desk-portal').disabled && document.getElementById('ed-path').textContent==='content/Archive/nested/leaf.md');
 assert.equal(await page.locator('#ed-text').inputValue(),'Unsaved draft text');
 await itemMenu('Archive','rename');await page.locator('.rename-input').fill('archive');await page.locator('.rename-input').press('Enter');
 await until(()=>!document.getElementById('desk-portal').disabled && document.getElementById('ed-path').textContent==='content/archive/nested/leaf.md');
 assert.equal(await page.locator('#ed-text').inputValue(),'Unsaved draft text');
 await itemMenu('archive','delete');
 await until(()=>document.getElementById('ed-text').disabled);
 assert(![...files.keys()].some(p=>p.startsWith('content/archive/')));
 assert(dialogs.some(d=>d.includes('ALL files and subfolders')&&d.includes('Unsaved changes')));
 await itemMenu('empty','delete');await until(()=>![...document.querySelectorAll('.tree-folder .node-name')].some(e=>e.textContent==='empty'));
 assert(!emptyDirs.has('content/empty'));
 await openFile('book');await renameOpen('handbook.md');
 await until(()=>document.getElementById('ed-path').textContent==='handbook');
 assert(files.has('content/handbook/current/R1.md'));assert(files.has('content/handbook/current/R3.md'));assert(files.has('content/handbook/old/R1.md'));
 await page.locator('#ed-raw-revisions').check();
 await openFolder('handbook');await openFolder('current');await openFile('R1.md');
 assert.equal(await page.locator('#ed-text').inputValue(),'Book revision one');
 assert.equal(await page.getByText('Overwrite this revision',{exact:true}).count(),1);
 await page.locator('#ed-text').fill('New revision copied from old text');await page.locator('#ed-save').click();
 await until(()=>document.querySelector('#ed-version-bar .ed-vb-rev')?.textContent==='editing R4');
 assert.equal(await page.locator('#ed-tab-log').getAttribute('aria-selected'),'true');
 await page.locator('#ed-tab-editor').click();
 assert.equal(files.get('content/handbook/current/R3.md'),'Book revision three');
 assert.equal(files.get('content/handbook/current/R4.md'),'New revision copied from old text');
 await itemMenu('R4.md','delete');
 await until(()=>document.querySelector('#ed-version-bar .ed-vb-rev')?.textContent==='editing R3');
 assert.equal(await page.locator('#ed-text').inputValue(),'Book revision three');
 assert(!files.has('content/handbook/current/R4.md'));
 await page.locator('#ed-text').fill('Current unsaved text');await itemMenu('R1.md','delete');
 await until(()=>![...document.querySelectorAll('.tree-item .node-name')].some(e=>e.textContent==='R1.md'));
 assert.equal(await page.locator('#ed-text').inputValue(),'Current unsaved text');
 assert.equal(await page.locator('#ed-save').isDisabled(),false);
 await page.locator('#ed-text').fill('Book revision three');
 // Revision files keep their required naming convention.
 await itemMenu('R3.md','rename');await page.locator('.rename-input').fill('bad.md');await page.locator('.rename-input').press('Enter');
 assert(files.has('content/handbook/current/R3.md'));assert(!files.has('content/handbook/current/bad.md'));
 await page.locator('#ed-raw-revisions').uncheck();
 if(process.env.SHERIFF_UI_SCREENSHOT)await page.screenshot({path:process.env.SHERIFF_UI_SCREENSHOT,fullPage:true});
 await itemMenu('handbook','delete');
 await until(()=>document.getElementById('ed-text').disabled);
 assert(![...files.keys()].some(p=>p.startsWith('content/handbook/')));
 assert(dialogs.some(d=>d.includes('ALL its versions and revisions')));
 assert.deepEqual(errors,[]);
 assert(!requests.some(r=>r.verb==='build'));
 console.log('Passed isolated browser checks: visible actions, file/folder/page rename and delete, unsaved editor state, revision cleanup, and safe revision numbering. No site builds run.');
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
