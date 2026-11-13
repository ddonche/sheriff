// Static navigation rendering in temporary portals only. No site builds run.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),tempRoot=path.resolve(os.tmpdir()),fixture=fs.mkdtempSync(path.join(tempRoot,'sheriff-active-nav-')),core=path.join(fixture,'sheriff-core');
try{
for(const rel of ['modules/markdown_core/fenced_code.gbln','modules/scout_nav/scout.gbln','modules/trailboss_wiki/stub_source.gbln','modules/trailboss_wiki/routes_json.gbln','modules/trailboss_wiki/trailboss.gbln']){const to=path.join(core,rel);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(root,'sheriff-core',rel),to);}
function setup(name,prefix=''){
const dir=path.join(fixture,'site/portals',name);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'config.yall'),'routing:\n  url_root: "'+prefix+'"\n  site_url: "https://wiki.example"\n');
const base=prefix?'/'+prefix:'';
const records=[['index','index',[]],['docs/notes','notes',['Notebook']],['docs/other','other',[]],['languages/csharp','c#',[]],['languages/c++','c++',[]],['languages/c space','space',[]]];
fs.writeFileSync(path.join(dir,'routes.json'),JSON.stringify({routes:records.map(([rel,canonical_slug,aliases])=>({rel,canonical_slug,aliases,href:base+'/'+rel+'.html'}))}));
fs.writeFileSync(path.join(dir,'nav.yall'),`menus:
  main:
    Home: "${base}/"
    Notes: "[[notes]]"
    Group:
      Query link: "${base}/docs/notes.html?mode=compact#section"
      Deep group:
        Alias: "[[Notebook]]"
        Other: "[[other]]"
    CSharp: "[[C#]]"
    CPlusPlus: "[[C++]]"
    Same site: "https://wiki.example${base}/docs/notes.html"
    Foreign site: "https://else.example${base}/docs/notes.html"
    Wrong case: "${base}/Docs/notes.html"
    Missing: "[[absent]]"
  footer:
    Footer notes: "[[notes]]"
    Footer other: "[[other]]"
`);return base;
}
setup('example');setup('prefixed','wiki');
const cases=[{name:'notes',portal:'example',rel:'docs/notes'},{name:'other',portal:'example',rel:'docs/other'},{name:'notes-again',portal:'example',rel:'docs/notes'},{name:'home',portal:'example',rel:'index'},{name:'csharp',portal:'example',rel:'languages/csharp'},{name:'cplusplus',portal:'example',rel:'languages/c++'},{name:'old-version',portal:'example',rel:'docs/notes',output:'docs/notes__0-18'},{name:'prefixed',portal:'prefixed',rel:'docs/notes'},{name:'prefixed-home',portal:'prefixed',rel:'index'}];
fs.writeFileSync(path.join(core,'cases.json'),JSON.stringify(cases));
fs.writeFileSync(path.join(core,'verify.gbln'),String.raw`import modules/scout_nav/scout as scout
for item in :read_json("cases.json")
    portal | item{"portal"}
    scout::publish_nav_tokens({"portal": portal})
    prefix | ""
    if portal == "prefixed" => prefix |= "/wiki"
    rel | item{"rel"}
    out_rel | item{"output"} ?? rel
    body | "<header class=\"sheriff-header\">{{{SCOUT::main_DROPDOWN}}}</header><main>{{{SCOUT::main_SIDEBAR}}}<article><h1>Article</h1><p><a class=\"sheriff-link\" href=\"" + prefix + "/docs/notes.html\">Article link</a></p>{{{SCOUT::BREADCRUMBS}}}</article></main><footer>{{{SCOUT::footer_FLAT}}}</footer>"
    ctx | {"portal": portal, "body": body, "path": "../site/portals/" + portal + "/content/" + rel + ".md", "route_rel_no_ext": rel, "output_rel_no_ext": out_rel, "href": prefix + "/" + out_rel + ".html"}
    crumbs | scout::build_breadcrumbs(ctx)
    ctx |= scout::apply_tokens(ctx)
    :say("NAV_CHECK " + :json_stringify({"name": item{"name"}, "html": ctx{"body"}, "breadcrumbs": crumbs, "registry": :resolve_token("{{{SCOUT::main_SIDEBAR}}}")}))
xx
for pair in [["/C%23.html#section", "/C#.html"], ["/C++.html", "/C++.html"], ["/C%2B%2B.html", "/C++.html"], ["/a%20b.html?q=1#h", "/a b.html"], ["/index.html", "/"], ["/wiki/index.html", "/wiki/"], ["https://wiki.example/docs/notes.html", "/docs/notes.html"], ["https://else.example/docs/notes.html", ""], ["//else.example/docs/notes.html", ""], ["#section", ""]]
    :say("PATH_CHECK " + :json_stringify({"input": pair[0], "path": scout::scout_nav_path(pair[0], "https://wiki.example"), "expected": pair[1]}))
xx
`);
const result=spawnSync('goblin',['run','verify.gbln'],{cwd:core,encoding:'utf8',timeout:30000});assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
const rows=result.stdout.split(/\r?\n/).filter(line=>line.startsWith('NAV_CHECK ')).map(line=>JSON.parse(line.slice(10)));assert.equal(rows.length,cases.length);let checks=0;
function links(html){return [...html.matchAll(/<a\b([^>]*)>([^<]*)<\/a>/g)].map(match=>({attrs:match[1],label:match[2],active:match[1].includes('sheriff-nav-active')}));}
for(const row of rows){const all=links(row.html),active=all.filter(a=>a.active);assert(row.html.includes(row.breadcrumbs));assert(!row.breadcrumbs.includes('sheriff-nav-active'));assert(!row.registry.includes('sheriff-nav-active'));assert(!row.registry.includes('aria-current'));assert(!all.find(a=>a.label==='Article link').active);assert(!all.find(a=>a.label==='Foreign site').active);assert(!all.find(a=>a.label==='Wrong case').active);assert(!all.find(a=>a.label==='Missing').active);assert(active.every(a=>a.attrs.includes('aria-current="page"')&&a.attrs.includes('data-sheriff-nav-link')));assert(active.length>0,row.name+' '+row.html.slice(0,3000));
const wanted=row.name.startsWith('prefixed-home')||row.name==='home'?['Home']:row.name==='other'?['Other','Footer other']:row.name==='csharp'?['CSharp']:row.name==='cplusplus'?['CPlusPlus']:['Notes','Query link','Alias','Same site','Footer notes'];
for(const label of wanted)assert(all.some(a=>a.label===label&&a.active),row.name+' missing active '+label);
for(const a of active)assert(wanted.includes(a.label),row.name+' unexpected active '+a.label);
assert(!/<details class="sheriff-submenu"(?! open)/.test(row.html));checks++;}
assert.equal(rows.find(r=>r.name==='notes').html,rows.find(r=>r.name==='notes-again').html);checks++;
for(const line of result.stdout.split(/\r?\n/).filter(line=>line.startsWith('PATH_CHECK '))){const row=JSON.parse(line.slice(11));assert.equal(row.path,row.expected,row.input);checks++;}
if(process.env.SHERIFF_ACTIVE_NAV_FIXTURES){fs.mkdirSync(process.env.SHERIFF_ACTIVE_NAV_FIXTURES,{recursive:true});fs.writeFileSync(path.join(process.env.SHERIFF_ACTIVE_NAV_FIXTURES,'cases.json'),JSON.stringify(rows,null,2));}
console.log('Passed '+checks+' static navigation checks: header/sidebar/footer, aliases, C#/C++, home and prefixed URLs, anchors/query strings, versions, external/missing links, case sensitivity, unchanged breadcrumbs/article links, and clean shared tokens. No site builds run.');
}finally{assert.equal(path.dirname(fixture),tempRoot);assert(path.basename(fixture).startsWith('sheriff-active-nav-'));fs.rmSync(fixture,{recursive:true,force:true});}
