const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const pw=require(process.env.SHERIFF_PLAYWRIGHT_MODULE||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-repl-browser-'));let browser;
(async()=>{try{
const generated=spawnSync(process.execPath,[path.join(__dirname,'test-goblin-repl.cjs')],{cwd:root,encoding:'utf8',timeout:25000,env:{...process.env,SHERIFF_REPL_FIXTURES:temp}});assert.equal(generated.status,0,generated.stdout+'\n'+generated.stderr);
browser=await pw.chromium.launch({headless:true,executablePath:process.env.SHERIFF_BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(8000);
await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='repl.test')return route.abort();requests.push(url.pathname);const file=path.join(temp,decodeURIComponent(url.pathname));if(!file.startsWith(temp+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});const type={'.html':'text/html','.js':'application/javascript','.wasm':'application/wasm','.css':'text/css','.json':'application/json'}[path.extname(file)]||'application/octet-stream';return route.fulfill({contentType:type,body:fs.readFileSync(file)});});
await page.goto('http://repl.test/b.html');
await page.waitForFunction(()=>document.querySelectorAll('.goblin-repl-wrap').length===2&&[...document.querySelectorAll('.goblin-repl-input')].every(input=>!input.disabled),{},{timeout:15000}).catch(async error=>{console.error(await page.locator('body').innerText(),errors,requests);throw error;});
const repls=page.locator('.goblin-repl-wrap');assert.equal(await repls.count(),2);
await repls.nth(0).locator('input').fill(':say(1 + 2)');await repls.nth(0).getByRole('button',{name:'run',exact:true}).click();assert((await repls.nth(0).locator('.goblin-repl-line.output').last().textContent()).trim()==='3');
await repls.nth(1).locator('input').fill(':say(6 * 7)');await repls.nth(1).getByRole('button',{name:'run',exact:true}).click();assert((await repls.nth(1).locator('.goblin-repl-line.output').last().textContent()).trim()==='42');
assert.equal(requests.filter(url=>url.endsWith('goblin_wasm_bg.wasm')).length,1,'Multiple embeds share one WASM initialization');
assert((await page.locator('code').allTextContents()).some(text=>text.includes('{{{GOBLIN_REPL::EMBED}}}')));
await repls.nth(0).getByRole('button',{name:'reset',exact:true}).click();assert.equal(await repls.nth(0).locator('.goblin-repl-line.output').count(),0);assert.equal(await repls.nth(1).locator('.goblin-repl-line.output').count(),1);
assert.equal(await repls.nth(0).locator('.goblin-repl-title').textContent(),'Goblin REPL · v0.51.26');
async function runCode(code){await repls.nth(0).locator('input').fill(code);await repls.nth(0).getByRole('button',{name:'run',exact:true}).click();}
await runCode(':lower("HELLO")');assert.equal((await repls.nth(0).locator('.goblin-repl-line.output').last().textContent()).trim(),'hello');
await runCode('lower("HELLO")');assert.match(await repls.nth(0).locator('.goblin-repl-line.error').last().textContent(),/R1260.*:lower/s);
for(const line of ['act greet(value)','return value','xx','greet("hello")'])await runCode(line);assert.equal((await repls.nth(0).locator('.goblin-repl-line.output').last().textContent()).trim(),'hello');
await runCode(':greet("HELLO")');assert.match(await repls.nth(0).locator('.goblin-repl-line.error').last().textContent(),/R1261/);
assert(requests.some(url=>url.endsWith('goblin_wasm_bg.wasm')));
assert.deepEqual(errors,[]);
if(process.env.SHERIFF_REPL_SCREENSHOT)await page.screenshot({path:process.env.SHERIFF_REPL_SCREENSHOT,fullPage:true});
console.log('Passed real WASM browser checks: Goblin 0.51.26, :lower accepted, bare lower rejected with R1260, bare user actions accepted, colon user actions rejected with R1261, two embeds and independent reset.');
}finally{if(browser)await browser.close();assert.equal(path.dirname(temp),path.resolve(os.tmpdir()));assert(path.basename(temp).startsWith('sheriff-repl-browser-'));fs.rmSync(temp,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
