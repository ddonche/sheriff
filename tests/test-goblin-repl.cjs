const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-repl-')),core=path.join(temp,'sheriff-core'),token='{{{GOBLIN_REPL::EMBED}}}';let checks=0;
function put(rel,text){const file=path.join(temp,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function run(args=[]){const result=spawnSync(process.env.SHERIFF_GOBLIN||path.join(os.homedir(),'.cargo/bin/goblin'+(process.platform==='win32'?'.exe':'')),['run','main.gbln','test',...args],{cwd:core,encoding:'utf8',timeout:15000,env:{...process.env,SHERIFF_RUNTIME_MODE:'cloud',GOBLIN_NONINTERACTIVE:'0'}});assert.equal(result.status,0,result.stdout+'\n'+result.stderr);return result;}
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
try{
fs.cpSync(path.join(root,'sheriff-core'),core,{recursive:true});
put('site/portals/test/config.yall','name: REPL fixture\ntheme:\n  name: compendium\n');
const page=body=>'^^^^\ntitle: REPL\nlayout: wiki\nsummary: Interactive REPL fixture.\n^^^^\n\n'+body;
put('site/portals/test/content/a.md',page(token));
put('site/portals/test/content/b.md',page(token+'\n\n'+token+'\n\nInline example: `'+token+'`\n\n```text\n'+token+'\n```'));
put('site/portals/test/content/c.md',page('Example only: `'+token+'`\n\n```text\n'+token+'\n```'));
run();const output=path.join(temp,'dist/test');
const a=fs.readFileSync(path.join(output,'a.html'),'utf8'),b=fs.readFileSync(path.join(output,'b.html'),'utf8'),c=fs.readFileSync(path.join(output,'c.html'),'utf8');
assert.equal((a.match(/<div class="goblin-repl-placeholder">/g)||[]).length,1,'First page must embed actual HTML');checks++;
assert.equal((b.match(/<div class="goblin-repl-placeholder">/g)||[]).length,2,'Later pages must not turn embed HTML into a code block');checks++;
assert.equal((b.match(/\{\{\{GOBLIN_REPL::EMBED\}\}\}/g)||[]).length,3,'Inline and both highlighted theme copies of fenced code examples must remain literal');
assert.equal((c.match(/<div class="goblin-repl-placeholder">/g)||[]).length,0);assert(!c.includes('src="/public/js/goblin-repl.js"'));checks++;
for(const file of ['js/goblin-repl.js','wasm/goblin_wasm.js','wasm/goblin_wasm_bg.wasm','wasm/runtime.json'])assert.equal(hash(path.join(output,'public',file)),hash(path.join(core,'glams/goblin_repl',file)));checks++;
if(process.env.SHERIFF_REPL_FIXTURES){const dest=path.resolve(process.env.SHERIFF_REPL_FIXTURES);fs.mkdirSync(dest,{recursive:true});fs.cpSync(output,dest,{recursive:true});}
fs.rmSync(output,{recursive:true,force:true});const single=run(['page','a.md']);assert(!single.stdout.includes('RUNNING PRE ACT'));assert(!single.stdout.includes('RUNNING POST ACT'));
for(const file of ['js/goblin-repl.js','wasm/goblin_wasm.js','wasm/goblin_wasm_bg.wasm','wasm/runtime.json'])assert(fs.existsSync(path.join(output,'public',file)),'A fresh page build must copy '+file);checks++;
const manifest=JSON.parse(fs.readFileSync(path.join(core,'glams/goblin_repl/wasm/runtime.json'),'utf8'));
assert.equal(manifest.version,'0.51.26');
for(const [file,digest] of Object.entries(manifest.files))assert.equal(hash(path.join(core,'glams/goblin_repl',file)),digest,'Bundled release asset '+file);
put('dist/test/public/wasm/runtime.json','{"version":"old"}');
put('dist/test/public/wasm/goblin_wasm_bg.wasm','old binary');
run(['page','a.md']);
assert.equal(hash(path.join(output,'public/wasm/goblin_wasm_bg.wasm')),hash(path.join(core,'glams/goblin_repl/wasm/goblin_wasm_bg.wasm')),'Page build must replace an outdated runtime');checks++;
console.log('Passed '+checks+' REPL build groups: first/later pages, multiple embeds, literal code examples, asset hashes, and fresh page-only assets.');
}finally{assert.equal(path.dirname(temp),path.resolve(os.tmpdir()));assert(path.basename(temp).startsWith('sheriff-repl-'));fs.rmSync(temp,{recursive:true,force:true});}
