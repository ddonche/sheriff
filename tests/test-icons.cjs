// Actual icon rendering, asset publication, and Desk API against a temporary portal only.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),tempRoot=path.resolve(os.tmpdir()),fixture=fs.mkdtempSync(path.join(tempRoot,'sheriff-icons-')),core=path.join(fixture,'sheriff-core'),portal=path.join(fixture,'site/portals/test');
const cases=[
{name:'inline',body:'Before [[icon|warning]] after [[icon|download|red]] and [[icon|heart|#d04455]].'},
{name:'heading',body:'## [[icon|book]] Documentation\n\nBody.'},
{name:'admonition',body:'::: warning [[icon|warning|#d97706]] Experimental\n\n[[icon|info]] Some advice.\n\n:::'},
{name:'icon-first',body:'::: [[icon|warning]] lore\nThe name **Goblin** was chosen as a historical reference.\n:::'},
{name:'icon-first-color',body:'::: [[icon|warning|rgb(200, 20, 30)]] warning Custom title\n\nAdvice.\n\n:::'},
{name:'icon-first-reset',body:'::: [[icon|warning]] lore\nFirst.\n:::\n\n::: note\nSecond.\n:::'},
{name:'icon-first-float',body:'::: pattern vertical Language\n@mode = template\ncreator = Example\nreleased = 2025\n:::\n\n::: [[icon|warning]] lore\nHistorical note beside an infobox.\n:::'},
{name:'icon-first-tabs',body:'::: tabs\n@tab First\n::: [[icon|warning]] lore\nNested history.\n:::\n@tab Second\nOther panel.\n:::'},
{name:'unknown-fence',body:'::: [[icon|warning]] unknown-kind\nKeep this text.\n:::'},
...['note','tip','warning','important','example','strategy','lore','spoiler'].map(kind=>({name:'icon-kind-'+kind,body:'::: [[icon|info]] '+kind+'\nBody.\n:::'})),
{name:'pattern',body:'::: pattern horizontal Feature\n@mode = template\n[[icon|tag]] Status = [[icon|check|green]] Supported\n:::'},
{name:'reusable',body:'{{{SHERIFF::PATTERN_SHARED}}}'},
{name:'tabs',body:'::: tabs\n@tab First\n[[icon|book]] First tab.\n@tab Second\n[[icon|bug|rgb(200, 20, 30)]] Another tab.\n:::'},
{name:'table',body:'| Status | Details |\n| --- | --- |\n| [[icon|check|green]] | Complete |'},
{name:'code',body:'`[[icon|warning]]`\n\n```markdown\n[[icon|warning|red]]\n::: [[icon|warning]] lore\nLiteral admonition.\n:::\n```'},
{name:'invalid',body:'[[icon|not-present]] [[icon|../config]] [[icon|warning|red;position:fixed]] [[icon|warning|red" onmouseover="bad]]'},
{name:'custom',body:'[[icon|custom-mark]] [[icon|warning]]'}
];
function run(file,args=[],env={}){const result=spawnSync('goblin',['run',file,...args],{cwd:core,encoding:'utf8',timeout:30000,env:{...process.env,...env}});assert.equal(result.status,0,result.stdout+'\n'+result.stderr);return result.stdout;}
try{
for(const rel of ['modules/trailboss_wiki/trailboss.gbln','modules/trailboss_wiki/routes_json.gbln','modules/markdown_core/markdown.gbln','modules/markdown_core/fenced_code.gbln','modules/markdown_core/content_tabs.gbln','modules/sheriff_patterns/patterns.gbln','modules/scout_nav/scout.gbln','modules/stagehand/stagehand.gbln']){const target=path.join(core,rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,'sheriff-core',rel),target);}
fs.cpSync(path.join(root,'sheriff-core/assets'),path.join(core,'assets'),{recursive:true});fs.mkdirSync(path.join(portal,'public/icons'),{recursive:true});fs.mkdirSync(path.join(core,'themes/outpost/css'),{recursive:true});fs.writeFileSync(path.join(core,'themes/outpost/css/outpost.css'),'/* fixture */');fs.writeFileSync(path.join(core,'themes/outpost/css/outpost-header.css'),'/* fixture */');
const custom='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>';fs.writeFileSync(path.join(portal,'public/icons/warning.svg'),custom);fs.writeFileSync(path.join(portal,'public/icons/custom-mark.svg'),custom);fs.writeFileSync(path.join(portal,'config.yall'),'theme:\n  name: outpost\n');fs.writeFileSync(path.join(portal,'routes.json'),JSON.stringify({routes:[]}));fs.writeFileSync(path.join(core,'cases.json'),JSON.stringify(cases));
fs.writeFileSync(path.join(core,'verify.gbln'),String.raw`import modules/markdown_core/markdown as markdown
import modules/sheriff_patterns/patterns as patterns
import modules/trailboss_wiki/trailboss as trailboss
import modules/scout_nav/scout as scout
import modules/stagehand/stagehand as stagehand
register_token("SHERIFF", "PATTERN_SHARED", "<aside>[[icon|star|gold]] Reusable content.</aside>")
for item in :read_json("cases.json")
    ctx | {"portal":"test", "body":item{"body"}, "frontmatter":{}, "wanted_pages":[], "backlinks":[]}
    ctx |= patterns::apply_patterns(ctx)
    ctx |= markdown::render(ctx)
    ctx |= trailboss::render_fences(ctx)
    ctx |= trailboss::process_wikilinks(ctx)
    :say("ICON_CHECK " + :json_stringify({"name":item{"name"},"html":ctx{"body"},"toc":scout::generate_toc(ctx{"body"}),"wanted":ctx{"wanted_pages"},"backlinks":ctx{"backlinks"}}))
xx
stagehand::copy_assets({"portal":"test"})
`);
const output=run('verify.gbln'),records=output.split(/\r?\n/).filter(line=>line.startsWith('ICON_CHECK ')).map(line=>JSON.parse(line.slice(11)));assert.equal(records.length,cases.length);let checks=0;
for(const row of records){assert.deepEqual(row.wanted,[]);assert.deepEqual(row.backlinks,[]);assert(!row.html.includes('sheriff-missing-link'));checks++;}
const get=name=>records.find(row=>row.name===name).html;
assert.equal((get('inline').match(/data-sheriff-icon=/g)||[]).length,3);assert(get('inline').includes('color:red;'));assert(get('inline').includes('color:#d04455;'));assert(get('inline').includes("url('/public/icons/warning.svg')"));checks++;
assert(get('admonition').includes('sheriff-admon-warning'));assert(/sheriff-admon-title[^>]*>.*data-sheriff-icon="warning"/.test(get('admonition')));assert(get('admonition').includes('data-sheriff-icon="info"'));checks++;
for(const name of ['icon-first','icon-first-color','icon-first-float','icon-first-tabs']){const html=get(name);assert(html.includes('sheriff-admon-'+(name==='icon-first-color'?'warning':'lore')),name);assert(!html.includes('::: '),name);assert(/sheriff-admon-title[^>]*><span class="sheriff-icon"/.test(html),name);checks++;}
assert(get('icon-first').includes('</span> Lore</span>'));assert(get('icon-first-color').includes('color:rgb(200, 20, 30);'));assert(get('icon-first-color').includes('</span> Custom title</span>'));assert.equal((get('icon-first-reset').match(/data-sheriff-icon=/g)||[]).length,1);assert(get('icon-first-reset').includes('>Note</span>'));assert(get('unknown-fence').includes('::: '));assert(!get('unknown-fence').includes('sheriff-admon'));checks++;
for(const kind of ['note','tip','warning','important','example','strategy','lore','spoiler']){const html=get('icon-kind-'+kind);assert(html.includes(kind==='spoiler'?'sheriff-spoiler':'sheriff-admon-'+kind),kind);assert(html.includes('data-sheriff-icon="info"'),kind);checks++;}
assert(get('pattern').includes('sheriff-pattern-label'));assert(get('pattern').includes('data-sheriff-icon="tag"'));assert(get('pattern').includes('data-sheriff-icon="check"'));assert(get('reusable').includes('data-sheriff-icon="star"'));assert(get('tabs').includes('data-sheriff-icon="bug"'));assert(get('table').includes('<table>'));assert(get('table').includes('data-sheriff-icon="check"'));checks++;
assert(get('code').includes('[[icon|warning]]'));assert(!get('code').includes('data-sheriff-icon'));assert(get('invalid').includes('sheriff-icon-missing'));assert(!get('invalid').includes('position:fixed'));assert(!get('invalid').includes('onmouseover'));assert(get('custom').includes('data-sheriff-icon="custom-mark"'));checks++;
const published=path.join(fixture,'dist/test/public/icons');assert.equal(fs.readdirSync(published).length,67);assert.equal(fs.readFileSync(path.join(published,'warning.svg'),'utf8'),custom);assert.equal(fs.readFileSync(path.join(published,'book.svg'),'utf8'),fs.readFileSync(path.join(core,'assets/icons/book.svg'),'utf8'));checks++;
fs.copyFileSync(path.join(root,'sheriff-core/desk/api/list_icons.gbln'),path.join(core,'list_icons.gbln'));const catalog=JSON.parse(run('list_icons.gbln',[],{SHERIFF_ROOT:fixture,GOBLIN_QUERY_STRING:'test'}));assert.equal(catalog.icons.length,67);assert.equal(catalog.icons.find(i=>i.name==='warning').source,'Portal');assert.equal(catalog.icons.find(i=>i.name==='book').source,'Core');assert.equal(catalog.icons.find(i=>i.name==='warning').svg,custom);const denied=JSON.parse(run('list_icons.gbln',[],{SHERIFF_ROOT:fixture,GOBLIN_QUERY_STRING:'../test'}));assert.equal(denied.ok,false);checks++;
assert(records.find(row=>row.name==='heading').toc.includes('Documentation'),'Icon headings must remain in the TOC');checks++;
if(process.env.SHERIFF_ICON_FIXTURES){fs.mkdirSync(process.env.SHERIFF_ICON_FIXTURES,{recursive:true});fs.writeFileSync(path.join(process.env.SHERIFF_ICON_FIXTURES,'rendered.json'),JSON.stringify(records));fs.writeFileSync(path.join(process.env.SHERIFF_ICON_FIXTURES,'catalog.json'),JSON.stringify(catalog));}
console.log('Passed '+checks+' icon integration checks: nested content, literal examples, inherited/explicit colors, safe failures, routing isolation, Core/portal assets, and Desk catalog. No user sites built.');
}finally{assert.equal(path.dirname(fixture),tempRoot);assert(path.basename(fixture).startsWith('sheriff-icons-'));fs.rmSync(fixture,{recursive:true,force:true});}
