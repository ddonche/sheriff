// Isolated slot/version-tab rendering checks. Never runs a site build.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),tempRoot=path.resolve(os.tmpdir()),fixture=fs.mkdtempSync(path.join(tempRoot,'sheriff-slots-')),core=path.join(fixture,'sheriff-core');
try {
for(const rel of ['modules/markdown_core/fenced_code.gbln','modules/stagehand/stagehand.gbln','modules/trailboss_wiki/trailboss.gbln','modules/trailboss_wiki/routes_json.gbln',...['outpost','siegemate','compendium'].map(t=>'themes/'+t+'/templates.yall')]){const dest=path.join(core,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,'sheriff-core',rel),dest);}
const cases=[];
function portal(name,theme,override){const dir=path.join(fixture,'site/portals',name);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'config.yall'),'theme:\n  name: "'+theme+'"\nrouting:\n  url_root: ""\n');if(override!==undefined){const file=path.join(dir,'themes',theme,'templates.yall');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,override);}return name;}
for(const theme of ['outpost','siegemate','compendium']){
 const legacy=fs.readFileSync(path.join(root,'site/portals/goblin/themes',theme,'templates.yall'),'utf8');
 const name=portal('legacy-'+theme,theme,legacy);
 cases.push({name:name+'-single',portal:name,versions:['0.50.0'],body:'{{{SLOT::WIKI_PAGETABS}}}'});
 cases.push({name:name+'-multiple',portal:name,versions:['0.50.0','0.46.3'],body:'{{{SLOT::WIKI_PAGETABS}}}'});
}
portal('core-only','siegemate');cases.push({name:'core-only',portal:'core-only',versions:['0.50.0','0.46.3'],body:'{{{SLOT::WIKI_PAGETABS}}}'});
portal('overrides','siegemate','layouts:\n  docs:\n    slots:\n      WIKI_PAGETABS:\n      CUSTOM:\n        - "TEST::CUSTOM"\n');cases.push({name:'explicit-empty',portal:'overrides',versions:['0.50.0','0.46.3'],body:'x{{{SLOT::WIKI_PAGETABS}}}y{{{SLOT::CUSTOM}}}'});
portal('replace','siegemate','layouts:\n  docs:\n    slots:\n      WIKI_PAGETABS:\n        - "TEST::CUSTOM"\n');cases.push({name:'explicit-replacement',portal:'replace',versions:['0.50.0','0.46.3'],body:'{{{SLOT::WIKI_PAGETABS}}}'});
cases.push({name:'no-slot-leak',portal:'core-only',versions:['0.50.0'],body:'{{{SLOT::CUSTOM}}}'});
fs.writeFileSync(path.join(core,'cases.json'),JSON.stringify(cases));fs.writeFileSync(path.join(core,'verify.gbln'),String.raw`import modules/stagehand/stagehand as stagehand
import modules/trailboss_wiki/trailboss as trailboss
register_token("TEST", "CUSTOM", "portal override")
for item in :read_json("cases.json")
    ctx | {"portal": item{"portal"}, "frontmatter": {"layout": "docs"}, "body": item{"body"}, "available_documentation_versions": item{"versions"}, "documentation_version": "0.50.0", "version_rel_rows": ["0.50.0|||docs/actions", "0.46.3|||docs/actions__0-46-3"]}
    ctx |= stagehand::wire_slots(ctx)
    ctx |= trailboss::publish_doc_versions(ctx)
    :say("SLOT_CHECK " + :json_stringify({"name": item{"name"}, "html": ctx{"body"}, "registry": resolve_token("{{{SLOT::WIKI_PAGETABS}}}")}))
xx
`);
const result=spawnSync('goblin',['run','verify.gbln'],{cwd:core,encoding:'utf8',timeout:30000});assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
const records=result.stdout.split(/\r?\n/).filter(x=>x.startsWith('SLOT_CHECK ')).map(x=>JSON.parse(x.slice(11)));assert.equal(records.length,cases.length);let checks=0;
for(const row of records){assert.equal(row.registry,'{{{SLOT::WIKI_PAGETABS}}}');if(row.name.endsWith('-single'))assert.equal(row.html,'');else if(row.name.endsWith('-multiple')||row.name==='core-only'){assert(!row.html.includes('{{{'));assert(row.html.includes('aria-current="page">0.50.0'));assert(row.html.includes('docs/actions__0-46-3.html'));assert(row.html.includes('>0.46.3</a>'));}else if(row.name==='explicit-empty')assert.equal(row.html,'xy{{{TEST::CUSTOM}}}');else if(row.name==='explicit-replacement')assert.equal(row.html,'{{{TEST::CUSTOM}}}');else if(row.name==='no-slot-leak')assert.equal(row.html,'{{{SLOT::CUSTOM}}}');checks++;}
console.log('Passed '+checks+' isolated slot checks: legacy templates across all themes, single/multiple versions, missing portal templates, explicit empty/replacement overrides, and registry isolation. No site builds run.');
}finally{if(path.dirname(fixture)===tempRoot&&path.basename(fixture).startsWith('sheriff-slots-'))fs.rmSync(fixture,{recursive:true,force:true});}
