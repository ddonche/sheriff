// Product code runs in Goblin; these checks use disposable sources only.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),{spawnSync}=require('child_process');
const repo=path.resolve(__dirname,'..'),root=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-desk-sites-')),core=root+'/sheriff-core';
fs.cpSync(repo+'/sheriff-core',core,{recursive:true,filter:p=>path.basename(p).toLowerCase()!=='.vs'});
let checks=0;
function call(verb,payload){const file=root+'/request.json';fs.writeFileSync(file,JSON.stringify(payload||{}));const r=spawnSync('goblin',['run','desk/admin/requests/sites_request.gbln'],{cwd:core,env:{...process.env,SHERIFF_ROOT:root,GOBLIN_QUERY_STRING:verb,GOBLIN_REQUEST_FILE:file},encoding:'utf8',timeout:45000,windowsHide:true});if(r.status!==0)throw Error(r.stderr+'\n'+r.stdout);try{return JSON.parse(r.stdout);}catch{throw Error(r.stdout+'\n'+r.stderr)}}
function ok(value){assert.equal(value.ok,true,value.stderr);checks++;}
ok(call('list'));
ok(call('create',{id:'trial-iveki',name:'Trial Iveki',theme:'compendium',portals:[{id:'programming',name:'Programming'},{id:'history',name:'History'}]}));
let inventory=call('list');ok(inventory);assert.equal(inventory.sites[0].portals.length,2);checks++;
assert.equal(fs.existsSync(root+'/dist/trial-iveki'),false);checks++;
assert.equal(call('create',{id:'trial-iveki',name:'Conflict',theme:'compendium',portals:[{id:'other',name:'Other'}]}).ok,false);checks++;
assert.equal(call('create',{id:'../bad',name:'Bad',theme:'compendium',portals:[]}).ok,false);checks++;
const registry=root+'/site/sites/trial-iveki/site.yall';fs.appendFileSync(registry,'\ndescription: Preserve this description\ncustom_setting: Keep me\n');
ok(call('add',{id:'trial-iveki',portals:[{id:'science',name:'Science'}]}));assert(fs.readFileSync(registry,'utf8').includes('custom_setting: Keep me'));checks++;
// Commented policy is valid YALL; only shared mode permits a parent theme edit.
assert(fs.readFileSync(registry,'utf8').includes('# multisite_theming: shared'));checks++;
assert.equal(call('theme',{id:'trial-iveki',theme:'siegemate'}).ok,false);checks++;
const savedPortal=fs.readFileSync(root+'/site/portals/trial-iveki-programming/config.yall','utf8');
fs.appendFileSync(registry,'\nmultisite_theming: shared\n');
ok(call('theme',{id:'trial-iveki',theme:'siegemate'}));
assert(fs.readFileSync(registry,'utf8').includes('custom_setting: Keep me'));checks++;
assert.equal(fs.readFileSync(root+'/site/portals/trial-iveki-programming/config.yall','utf8'),savedPortal);checks++;
const current=spawnSync('goblin',['run','desk/api/theme_config.gbln'],{cwd:core,env:{...process.env,SHERIFF_ROOT:root,GOBLIN_QUERY_STRING:'trial-iveki-programming'},encoding:'utf8',windowsHide:true});
assert.equal(current.status,0,current.stderr);const active=JSON.parse(current.stdout);ok(active);assert.equal(active.theme,'siegemate');assert.equal(active.shared_site,'trial-iveki');checks+=2;
assert.equal(call('theme',{id:'trial-iveki',theme:'../bad'}).ok,false);checks++;
fs.writeFileSync(registry,fs.readFileSync(registry,'utf8').replace('\nmultisite_theming: shared\n','\nmultisite_theming: individual\n'));
// Site logos are binary uploads owned by the site, never copied to its portals.
const logo=fs.readFileSync(core+'/desk/admin/logo.png'),logoRequest=root+'/logo-upload.png';fs.writeFileSync(logoRequest,logo);
const uploaded=spawnSync('goblin',['run','desk/api/sites.gbln'],{cwd:core,env:{...process.env,SHERIFF_ROOT:root,GOBLIN_METHOD:'POST',GOBLIN_QUERY_STRING:'logo&site=trial-iveki&extension=png',GOBLIN_BODY:'',GOBLIN_REQUEST_FILE:logoRequest},encoding:'utf8',timeout:45000,windowsHide:true});assert.equal(uploaded.status,0,uploaded.stderr);ok(JSON.parse(uploaded.stdout));assert.deepEqual(fs.readFileSync(root+'/site/sites/trial-iveki/public/site-logo.png'),logo);assert.equal(fs.existsSync(root+'/site/portals/trial-iveki-programming/public/logo.png'),false);checks+=2;
ok(call('build&site=trial-iveki'));
assert.deepEqual(fs.readFileSync(root+'/dist/trial-iveki/public/site-logo.png'),logo);assert(fs.readFileSync(root+'/dist/trial-iveki/index.html','utf8').includes('/public/site-logo.png'));checks+=2;
assert(fs.existsSync(root+'/dist/trial-iveki/p/programming/wiki/index.html'));checks++;
const sibling=fs.readFileSync(root+'/dist/trial-iveki/p/history/wiki/index.html');
fs.appendFileSync(root+'/site/portals/trial-iveki-programming/content/index.md','\nScoped page edit.\n');
ok(call('build&site=trial-iveki&portal=programming&path=index.md'));
assert(fs.readFileSync(root+'/dist/trial-iveki/p/programming/wiki/index.html','utf8').includes('Scoped page edit.'));assert.deepEqual(fs.readFileSync(root+'/dist/trial-iveki/p/history/wiki/index.html'),sibling);checks+=2;
const bad=call('build&site=trial-iveki&portal=programming&path=..%2Fbad.md');assert.equal(bad.ok,false);checks++;
const front=fs.readFileSync(root+'/site/portals/trial-iveki-programming/content/index.md','utf8');assert(front.includes('title: Programming'));assert(!front.includes('title: "'));checks++;
// Deletion validates the entire reviewed membership before touching any source.
ok(call('create',{id:'delete-trial',name:'Delete Trial',theme:'compendium',portals:[{id:'books',name:'Books'},{id:'history',name:'History'}]}));
const doomed=['delete-trial-books','delete-trial-history'],payload={id:'delete-trial',confirm:'delete-trial',portals:doomed};
assert.equal(call('delete',{...payload,confirm:'wrong'}).ok,false);assert.equal(call('delete',{...payload,portals:[doomed[0]]}).ok,false);checks+=2;
const memberFile=root+'/site/portals/delete-trial-history/config.yall',memberText=fs.readFileSync(memberFile,'utf8');fs.writeFileSync(memberFile,memberText.replace('site: delete-trial','site: trial-iveki'));assert.equal(call('delete',payload).ok,false);assert(fs.existsSync(root+'/site/portals/'+doomed[0]+'/content/index.md'));fs.writeFileSync(memberFile,memberText);checks+=2;
fs.mkdirSync(root+'/site/sites/shared-reference',{recursive:true});fs.writeFileSync(root+'/site/sites/shared-reference/site.yall','name: Shared reference\nportals:\n  books:\n    source: delete-trial-books\n');assert.equal(call('delete',payload).ok,false);assert(fs.existsSync(root+'/site/portals/'+doomed[0]));fs.unlinkSync(root+'/site/sites/shared-reference/site.yall');checks+=2;
fs.mkdirSync(root+'/dist/delete-trial',{recursive:true});fs.writeFileSync(root+'/dist/delete-trial/index.html','Disposable built site');const kept=fs.readFileSync(root+'/site/portals/trial-iveki-programming/content/index.md');ok(call('delete',payload));for(const source of doomed)assert(!fs.existsSync(root+'/site/portals/'+source));assert(!fs.existsSync(root+'/dist/delete-trial'));assert(!fs.existsSync(root+'/site/sites/delete-trial'));assert.deepEqual(fs.readFileSync(root+'/site/portals/trial-iveki-programming/content/index.md'),kept);checks+=5;
assert.equal(call('delete',{id:'../trial-iveki',confirm:'../trial-iveki',portals:[]}).ok,false);checks++;
// The parent config editor saves without building and rejects stale/invalid writes.
const loadedConfig=call('config_read&site=trial-iveki');ok(loadedConfig);
const editedConfig=loadedConfig.content+'\ndescription: Edited from Desk\n';
ok(call('config_write&site=trial-iveki',{content:editedConfig,previous:loadedConfig.content}));
assert.equal(fs.readFileSync(registry,'utf8'),editedConfig);checks++;
assert.equal(fs.readFileSync(root+'/site/portals/trial-iveki-programming/config.yall','utf8'),savedPortal);checks++;
assert.equal(call('config_write&site=trial-iveki',{content:loadedConfig.content,previous:loadedConfig.content}).ok,false);checks++;
assert.equal(call('config_write&site=trial-iveki',{content:editedConfig+'\nmultisite_theming: broken\n',previous:editedConfig}).ok,false);checks++;
assert.equal(call('config_write&site=trial-iveki',{content:editedConfig.replace('source: trial-iveki-history','source: solo'),previous:editedConfig}).ok,false);checks++;
assert.equal(call('config_read&site=../trial-iveki').ok,false);checks++;
assert.equal(fs.readFileSync(registry,'utf8'),editedConfig);checks++;
console.log('Passed '+checks+' real Goblin site API checks.');

module.exports=root;
