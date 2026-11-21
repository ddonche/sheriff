// Native Goblin APIs against a temporary site: provider aliases, overrides, and theme previews.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-brand-config-'));
function put(rel,content){const p=path.join(temp,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,content);}
function run(api){const result=spawnSync('goblin',['run',path.join(root,'sheriff-core/desk/api',api+'.gbln')],{cwd:path.join(root,'sheriff-core'),encoding:'utf8',timeout:30000,env:{...process.env,SHERIFF_ROOT:temp,GOBLIN_QUERY_STRING:'test'}});assert.equal(result.status,0,result.stdout+result.stderr);const data=JSON.parse(result.stdout);assert.equal(data.ok,true,data.stderr);return data;}
try{
 const metadata=JSON.parse(fs.readFileSync(path.join(root,'sheriff-core/assets/simple-icons/metadata.json'),'utf8')).filter(i=>['github','x','reddit'].includes(i.name));
 put('sheriff-core/assets/simple-icons/metadata.json',JSON.stringify(metadata));
 for(const i of metadata)put('sheriff-core/assets/simple-icons/icons/'+i.name+'.svg',fs.readFileSync(path.join(root,'sheriff-core/assets/simple-icons/icons',i.name+'.svg')));
 const custom='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>';
 put('sheriff-core/assets/icons/x.svg',fs.readFileSync(path.join(root,'sheriff-core/assets/icons/x.svg')));
 put('site/portals/test/config.yall','theme:\n  name: outpost\n');
 put('site/portals/test/public/icons/github.svg',custom);put('site/portals/test/public/icons/brand-x.svg',custom);put('site/portals/test/public/icons/brand-reddit.svg',custom);
 put('sheriff-core/themes/outpost/templates.yall','admonition_icons:\n  note: brand-github\n  tip: github\n  warning: brand-x\n');
 const catalog=run('list_icons').icons;
 assert.equal(catalog.find(i=>i.name==='github').source,'Portal');assert.equal(catalog.find(i=>i.name==='github').svg,custom);
 assert.equal(catalog.find(i=>i.name==='brand-github').brandColor,'#181717');assert.equal(catalog.find(i=>i.name==='x').source,'Core');assert.equal(catalog.find(i=>i.name==='brand-x').source,'Simple Icons');assert(!catalog.some(i=>i.name==='brand-reddit'));assert.equal(catalog.find(i=>i.name==='reddit').source,'Simple Icons');
 const previews=run('theme_config').admonitions.previews;
 assert.equal(previews.github.svg,custom);assert.equal(previews.github.brandColor,undefined);assert.equal(previews['brand-github'].brandColor,'#181717');assert(previews['brand-x'].svg.includes('data-brand-color="#000000"'));assert.notEqual(previews['brand-x'].svg,custom);
 console.log('Passed 12 native brand catalog/theme checks: portal overrides, reserved provider aliases, Core X, and configured admonition previews. No user files changed.');
}finally{assert.equal(path.dirname(temp),path.resolve(os.tmpdir()));assert(path.basename(temp).startsWith('sheriff-brand-config-'));fs.rmSync(temp,{recursive:true,force:true});}
