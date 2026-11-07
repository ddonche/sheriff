// Isolated Desk file API checks. Every filesystem mutation stays in this temporary fixture.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const tempRoot=path.resolve(os.tmpdir());
const fixture=fs.mkdtempSync(path.join(tempRoot,'sheriff-file-manager-'));
const portal=path.join(fixture,'site/portals/example');
fs.mkdirSync(path.join(portal,'content'),{recursive:true});
fs.copyFileSync(path.join(root,'sheriff-core/desk/api/file.gbln'),path.join(fixture,'file.gbln'));
let checks=0;
function check(name,run){run();checks++;}
function write(rel,data='page'){const p=path.join(portal,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,data);}
function exists(rel){return fs.existsSync(path.join(portal,rel));}
function api(verb,...args){
 const query=[verb,...args.map(encodeURIComponent)].join('&');
 const result=spawnSync('goblin',['run','file.gbln'],{cwd:fixture,encoding:'utf8',timeout:15000,env:{...process.env,SHERIFF_ROOT:fixture.replace(/\\/g,'/'),GOBLIN_QUERY_STRING:query}});
 if(result.error)throw result.error;
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
 const line=result.stdout.trim().split(/\r?\n/).findLast(s=>s.startsWith('{'));
 assert(line,result.stdout);return JSON.parse(line);
}
write('content/original.md','^^^^\ncanonical: unchanged\n^^^^\nBody');
check('rename a Markdown page',()=>{assert.equal(api('move','example','content/original.md','content/renamed.md').ok,true);assert(!exists('content/original.md'));assert(fs.readFileSync(path.join(portal,'content/renamed.md'),'utf8').includes('canonical: unchanged'));});
write('content/a folder/nested/.hidden',Buffer.from([0,1,2,255]));
write('content/a folder/nested/extensionless','bytes');
fs.mkdirSync(path.join(portal,'content/a folder/empty/also-empty'),{recursive:true});
check('move nested folders, binary and extensionless files, and empty folders',()=>{assert.equal(api('move','example','content/a folder','content/new folder').ok,true);assert(!exists('content/a folder'));assert.deepEqual(fs.readFileSync(path.join(portal,'content/new folder/nested/.hidden')),Buffer.from([0,1,2,255]));assert(exists('content/new folder/nested/extensionless'));assert(exists('content/new folder/empty/also-empty'));});
check('reject moving a folder into itself',()=>{assert.equal(api('move','example','content/new folder','content/new folder/child').ok,false);assert(exists('content/new folder/nested/extensionless'));assert(!exists('content/new folder/child'));});
write('content/taken.md','untouched');
check('reject file collisions without replacing either file',()=>{assert.equal(api('move','example','content/renamed.md','content/taken.md').ok,false);assert(exists('content/renamed.md'));assert.equal(fs.readFileSync(path.join(portal,'content/taken.md'),'utf8'),'untouched');});
fs.mkdirSync(path.join(portal,'content/taken-folder'),{recursive:true});
check('reject folder collisions',()=>{assert.equal(api('move','example','content/new folder','content/taken-folder').ok,false);assert(exists('content/new folder'));});
write('content/C# & F++.md','special names');
check('decode encoded punctuation and spaces',()=>{assert.equal(api('move','example','content/C# & F++.md','content/new # & + name.md').ok,true);assert(exists('content/new # & + name.md'));assert.equal(api('delete','example','content/new # & + name.md').ok,true);});
write('content/revision-page/current/R1.md','one');write('content/revision-page/current/R3.md','three');
check('rename a versioned page including every revision',()=>{assert.equal(api('move','example','content/revision-page','content/renamed-page').ok,true);assert(exists('content/renamed-page/current/R1.md'));assert(exists('content/renamed-page/current/R3.md'));assert(!exists('content/revision-page'));});
check('delete one revision without deleting the page',()=>{assert.equal(api('delete','example','content/renamed-page/current/R1.md').ok,true);assert(!exists('content/renamed-page/current/R1.md'));assert(exists('content/renamed-page/current/R3.md'));});
check('delete a page and its revision directories',()=>{assert.equal(api('delete','example','content/renamed-page').ok,true);assert(!exists('content/renamed-page'));});
check('delete nested directories',()=>{assert.equal(api('delete','example','content/new folder').ok,true);assert(!exists('content/new folder'));});
for(const bad of ['content','content/','content/.','content/../outside','content//','content/with:drive','content/bad?name','/content/taken.md','C:/outside','content/trailing.'])check('reject invalid deletion '+bad,()=>{assert.equal(api('delete','example',bad).ok,false);assert(exists('content/taken.md'));});
check('reject unknown portals',()=>assert.equal(api('delete','other','content/taken.md').ok,false));
check('reject missing query arguments',()=>{assert.equal(api('move','example').ok,false);assert.equal(api('delete','example').ok,false);});
check('reject invalid move destinations',()=>{for(const dest of ['content','content/../outside.md','C:/outside.md','content/.'])assert.equal(api('move','example','content/taken.md',dest).ok,false);assert(exists('content/taken.md'));});
write('content/blocker','a file, not a directory');
check('copy failure preserves the source and returns an API error',()=>{const result=api('move','example','content/taken.md','content/blocker/cannot-create.md');assert.equal(result.ok,false);assert(result.stderr.startsWith('Move failed:'));assert(exists('content/taken.md'));assert.equal(fs.readFileSync(path.join(portal,'content/blocker'),'utf8'),'a file, not a directory');});
check('prefix siblings are not descendants',()=>{write('content/prefix/file.md','kept');assert.equal(api('move','example','content/prefix','content/prefix-other').ok,true);assert(exists('content/prefix-other/file.md'));});
write('content/Uppercase.md','case-only file bytes');
check('case-only file rename changes the actual filesystem spelling',()=>{assert.equal(api('move','example','content/Uppercase.md','content/uppercase.md').ok,true);const names=fs.readdirSync(path.join(portal,'content'));assert(names.includes('uppercase.md'));assert(!names.includes('Uppercase.md'));assert.equal(fs.readFileSync(path.join(portal,'content/uppercase.md'),'utf8'),'case-only file bytes');});
write('content/Frameworks/nested/imperative.md','framework article');
fs.mkdirSync(path.join(portal,'content/Frameworks/empty'),{recursive:true});
check('case-only folder rename preserves nested files and empty folders',()=>{assert.equal(api('move','example','content/Frameworks','content/frameworks').ok,true);const names=fs.readdirSync(path.join(portal,'content'));assert(names.includes('frameworks'));assert(!names.includes('Frameworks'));assert.equal(fs.readFileSync(path.join(portal,'content/frameworks/nested/imperative.md'),'utf8'),'framework article');assert(exists('content/frameworks/empty'));});
check('case-only nested folder rename preserves its parent spelling',()=>{assert.equal(api('move','example','content/frameworks/nested','content/frameworks/Nested').ok,true);assert(fs.readdirSync(path.join(portal,'content/frameworks')).includes('Nested'));assert(exists('content/frameworks/Nested/imperative.md'));});
check('successful case-only moves remove their temporary recovery data',()=>{const directory=path.join(fixture,'data/desk-moves');assert.deepEqual(fs.readdirSync(directory),[]);});
if(!exists('content/UPPERCASE.MD'))check('case-sensitive filesystems still reject a distinct destination',()=>{write('content/UPPERCASE.MD','separate destination');assert.equal(api('move','example','content/uppercase.md','content/UPPERCASE.MD').ok,false);assert.equal(fs.readFileSync(path.join(portal,'content/UPPERCASE.MD'),'utf8'),'separate destination');assert.equal(fs.readFileSync(path.join(portal,'content/uppercase.md'),'utf8'),'case-only file bytes');});
check('failed final case-only copy restores the original and retains recovery data',()=>{
 write('content/Rollback.md','original survives failure');
 const apiPath=path.join(fixture,'file.gbln'),original=fs.readFileSync(apiPath,'utf8');
 const call='        copy_managed_tree(recovery_item, destination)';assert(original.includes(call));
 fs.writeFileSync(apiPath,original.replace(call,()=> '        :read_text("forced-case-rename-failure.txt")'));
 try{
  const result=api('move','example','content/Rollback.md','content/rollback.md');assert.equal(result.ok,false);assert(result.stderr.includes('Source content restored'));assert.equal(fs.readFileSync(path.join(portal,'content/Rollback.md'),'utf8'),'original survives failure');assert(fs.readdirSync(path.join(portal,'content')).includes('Rollback.md'));
  const recovery=path.join(fixture,'data/desk-moves');const entries=fs.readdirSync(recovery);assert.equal(entries.length,1);assert.equal(fs.readFileSync(path.join(recovery,entries[0],'item'),'utf8'),'original survives failure');
 }finally{fs.writeFileSync(apiPath,original);}
});
check('empty directories remain listed',()=>{fs.mkdirSync(path.join(portal,'content/empty-again'),{recursive:true});assert(api('list','example').dirs.includes('content/empty-again'));});
assert.equal(path.dirname(path.resolve(fixture)),tempRoot);assert(path.basename(fixture).startsWith('sheriff-file-manager-'));
fs.rmSync(fixture,{recursive:true,force:true});
console.log('Passed '+checks+' isolated file-management API checks. No site builds run.');