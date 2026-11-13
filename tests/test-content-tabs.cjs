// Isolated content-tabs rendering checks: no user-site builds or content writes.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),tempRoot=path.resolve(os.tmpdir()),fixture=fs.mkdtempSync(path.join(tempRoot,'sheriff-content-tabs-')),core=path.join(fixture,'sheriff-core');
const cases=[
 {name:'rich',body:['Before tabs.','','::: tabs','','@tab ALGOL 58','','## Early language','','**Bold** and `inline code` with [[Known]].','','| Name | Year |','| --- | --- |','| ALGOL | 1958 |','','::: note History','A historical note.',':::','','@tab ALGOL 60','','## Revised language','','```text','@tab This is code',':::','```','','::: pattern horizontal Language','@mode = template','name = ALGOL 60',':::','','Added in {{{SHERIFF::v1.0.0}}}.','','@tab ALGOL 68','','## Later language','','![Example](/example.png)','',':::','','After tabs.','','::: tabs','@tab First','Independent first.','@tab Second','Independent second.',':::'].join('\n')},
 {name:'float-before',body:['::: pattern vertical Programming language','@mode = template','creator = various','developer = Example','released = 1958','origin = Europe','implementation = Native','paradigms = Procedural, imperative, structured','typing = Static, strong','platform = Cross-platform','extensions = .alg','execution = Compiled','purpose = General-purpose','features = Structured programming','influences = Earlier languages','influenced = Later languages','status = Historical','website = Example',':::','','## Releases','','::: tabs','@tab ALGOL 58','Content about **ALGOL 58**.','@tab ALGOL 60','Content about **ALGOL 60**.','@tab ALGOL 68','Content about **ALGOL 68**.',':::'].join('\n')},
 {name:'float-inside',body:['::: tabs','@tab With pattern','::: pattern vertical Programming language','@mode = template','creator = various','released = 1958','typing = Static, strong','purpose = General-purpose','status = Historical',':::','','Text beside the pattern.','@tab Without pattern','A short second panel.',':::','','Following content.'].join('\n')},
 {name:'compact',body:'Heading\n::: tabs\n@tab One\nFirst **panel**.\n@tab Two\nSecond panel.\n:::\nFollowing content.'},
 {name:'nested',body:'::: tabs\n@tab Outer one\n::: tabs\n@tab Inner one\nInner first.\n@tab Inner two\nInner second.\n:::\n@tab Outer two\nOuter second.\n:::'},
 {name:'escaped-label',body:'::: tabs\n@tab <img src=x onerror=alert(1)> & "Quoted"\nSafe body.\n:::'},
 {name:'fenced-example',unchanged:true,body:'````markdown\n::: tabs\n@tab Example\n```text\n@tab Inside code\n```\n:::\n````'},
 {name:'tilde-example',unchanged:true,body:'~~~markdown\n::: tabs\n@tab Example\nLiteral.\n:::\n~~~'},
 {name:'indented-example',unchanged:true,body:'    ::: tabs\n    @tab Example\n    Literal.\n    :::'},
 {name:'unclosed',unchanged:true,body:'::: tabs\n@tab One\nKeep all this content.'},
 {name:'preamble',unchanged:true,body:'::: tabs\nDo not discard this.\n@tab One\nKeep this too.\n:::'},
 {name:'empty-label',unchanged:true,body:'::: tabs\n@tab\nKeep all this content.\n:::'},
 {name:'outside-marker',unchanged:true,body:'An ordinary @tab line.\n\n@tab Standalone\n\n`::: tabs`'},
 {name:'code-fences-in-panel',body:'::: tabs\n@tab One\n~~~~text\n@tab Fake tab\n::: tabs\n::: \n~~~~\n@tab Two\nActual second.\n:::'}
];
try{
for(const rel of ['modules/markdown_core/markdown.gbln','modules/markdown_core/content_tabs.gbln','modules/markdown_core/fenced_code.gbln','modules/sheriff_patterns/patterns.gbln','modules/trailboss_wiki/trailboss.gbln','modules/trailboss_wiki/stub_source.gbln','modules/trailboss_wiki/routes_json.gbln','modules/badge_labels/badge.gbln','modules/stagehand/stagehand.gbln','modules/brindle_themes/brindle.gbln','modules/markdown_core/sheriff-content-tabs.js','themes/outpost/css/outpost.css','themes/outpost/css/outpost-header.css','themes/outpost/layouts/docs.html']){const dest=path.join(core,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,'sheriff-core',rel),dest);}
const portal=path.join(fixture,'site/portals/test');fs.mkdirSync(portal,{recursive:true});fs.writeFileSync(path.join(portal,'config.yall'),'documentation:\n  default_version: "v1.0.0"\n  versions:\n    - "v1.0.0"\n');
fs.writeFileSync(path.join(portal,'routes.json'),JSON.stringify({routes:[{slug:'known',canonical_slug:'known',href:'/known.html',rel:'known',title:'Known',aliases:[]}]}));
fs.writeFileSync(path.join(core,'cases.json'),JSON.stringify(cases));fs.writeFileSync(path.join(core,'verify.gbln'),String.raw`import modules/markdown_core/markdown as markdown
import modules/markdown_core/content_tabs as tabs
import modules/sheriff_patterns/patterns as patterns
import modules/trailboss_wiki/trailboss as trailboss
import modules/badge_labels/badge as badge
import modules/stagehand/stagehand as stagehand
import modules/brindle_themes/brindle as brindle
for item in :read_json("cases.json")
    prepared | tabs::prepare(item{"body"}, 1)
    ctx | {"portal": "test", "body": item{"body"}, "frontmatter": {}}
    ctx |= patterns::apply_patterns(ctx)
    ctx |= markdown::render(ctx)
    ctx |= trailboss::render_fences(ctx)
    ctx |= trailboss::render_footnotes(ctx)
    ctx |= trailboss::process_wikilinks(ctx)
    ctx |= badge::apply_version_badges(ctx)
    :say("TABS_CHECK " + :json_stringify({"name": item{"name"}, "prepared": prepared{"body"}, "html": ctx{"body"}}))
xx
stagehand::copy_assets({"portal": "test"})
layout | brindle::apply_layout({"portal": "test", "body": "Fixture content", "frontmatter": {"layout": "docs"}})
:say("ASSET_CHECK " + :json_stringify({"copied": :read_text("../dist/test/public/js/sheriff-content-tabs.js"), "scripts": resolve_token("{{{BRINDLE::SCRIPTS}}}")}))
`);
const result=spawnSync('goblin',['run','verify.gbln'],{cwd:core,encoding:'utf8',timeout:30000});assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
const asset=JSON.parse(result.stdout.split(/\r?\n/).find(x=>x.startsWith('ASSET_CHECK ')).slice(12));assert.equal(asset.copied,fs.readFileSync(path.join(root,'sheriff-core/modules/markdown_core/sheriff-content-tabs.js'),'utf8'));assert(asset.scripts.includes('/public/js/sheriff-content-tabs.js'));
const records=result.stdout.split(/\r?\n/).filter(x=>x.startsWith('TABS_CHECK ')).map(x=>JSON.parse(x.slice(11)));assert.equal(records.length,cases.length);let checks=1;
for(const item of cases){const row=records.find(x=>x.name===item.name);if(item.unchanged){assert.equal(row.prepared,item.body,item.name);checks++;continue;}assert(row.html.includes('data-sheriff-content-tabs'),item.name);assert(!row.html.includes('<p>@tab'),item.name);assert(!row.html.includes('<p>::: tabs'),item.name);checks++;}
const rich=records.find(x=>x.name==='rich').html;assert.equal((rich.match(/data-sheriff-content-tabs/g)||[]).length,2);assert.equal((rich.match(/class="sheriff-page-tab sheriff-content-tab"/g)||[]).length,5);assert(rich.includes('<strong>Bold</strong>'));assert(rich.includes('<table>'));assert(rich.includes('sheriff-admon-note'));assert(rich.includes('data-sheriff-pattern="language"'));assert(rich.includes('sheriff-inline-version'));assert(rich.includes('href="/known.html"'));assert(rich.includes('src="/example.png"'));assert(rich.includes('After tabs.'));assert(!rich.includes(' hidden'));checks++;
const ids=[...rich.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length);checks++;
const nested=records.find(x=>x.name==='nested').html;assert.equal((nested.match(/data-sheriff-content-tabs/g)||[]).length,2);const nestedIds=[...nested.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(nestedIds).size,nestedIds.length);checks++;
const escaped=records.find(x=>x.name==='escaped-label').html;assert(!escaped.includes('<img'));assert(escaped.includes('&lt;img'));checks++;
const code=records.find(x=>x.name==='code-fences-in-panel').html;assert.equal((code.match(/class="sheriff-page-tab sheriff-content-tab"/g)||[]).length,2);assert(code.includes('@tab Fake tab'));checks++;
if(process.env.SHERIFF_TABS_PREVIEW_DIR){const out=path.resolve(process.env.SHERIFF_TABS_PREVIEW_DIR);fs.mkdirSync(out,{recursive:true});for(const row of records)fs.writeFileSync(path.join(out,row.name+'.html'),row.html);}
console.log('Passed '+checks+' content-tabs rendering checks. No site builds run.');
}finally{if(path.dirname(fixture)===tempRoot&&path.basename(fixture).startsWith('sheriff-content-tabs-'))fs.rmSync(fixture,{recursive:true,force:true});}
