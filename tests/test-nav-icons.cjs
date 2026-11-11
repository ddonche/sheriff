// Run the real layout/slot/Scout order against temporary portals, never user sites.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),tmp=path.resolve(os.tmpdir()),fixture=fs.mkdtempSync(path.join(tmp,'sheriff-nav-icons-')),core=path.join(fixture,'sheriff-core');
try{
for(const rel of ['modules/markdown_core/fenced_code.gbln','modules/scout_nav/scout.gbln','modules/trailboss_wiki/routes_json.gbln','modules/trailboss_wiki/trailboss.gbln','modules/stagehand/stagehand.gbln','modules/brindle_themes/brindle.gbln','themes/outpost/layouts/docs.html','themes/outpost/templates.yall']){const dst=path.join(core,rel);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(path.join(root,'sheriff-core',rel),dst);}
fs.cpSync(path.join(root,'sheriff-core/assets'),path.join(core,'assets'),{recursive:true});
const portal=path.join(fixture,'site/portals/test');fs.mkdirSync(path.join(portal,'public/icons'),{recursive:true});fs.writeFileSync(path.join(portal,'config.yall'),'theme:\n  name: outpost\n');fs.writeFileSync(path.join(portal,'public/icons/custom-mark.svg'),fs.readFileSync(path.join(core,'assets/icons/star.svg')));
fs.writeFileSync(path.join(portal,'routes.json'),JSON.stringify({routes:[{rel:'docs/index',href:'/docs/index.html',canonical_slug:'docs',title:'Docs',aliases:['Handbook']},{rel:'docs/other',href:'/docs/other.html',canonical_slug:'other',title:'Other'}]}));
fs.writeFileSync(path.join(portal,'nav.yall'),`menus:
  header:
    "[[icon|home]] Home": /docs/index.html
    "[[icon|menu]] Menu":
      "[[icon|book]] Documentation": "[[Handbook]]"
      "[[icon|files]] Guides":
        "[[icon|code|rgb(200, 20, 30)]] Syntax": /docs/other.html
  left_docs:
    "[[icon|book]] Reference":
      "[[icon|book]] Documentation": "[[docs]]"
      "[[icon|folder]] Topics":
        "[[icon|code]] Syntax": /docs/other.html
        "[[icon|info]] Deep group":
          "[[icon|star]] Deep link": /docs/index.html
      "[[icon|warning|orange]] Experimental": /docs/other.html
      "[[icon|not-present]] Missing icon": /docs/other.html
      "[[icon|custom-mark]] Portal icon": /docs/index.html
  footer_left:
    "[[icon|heart|#d04455]] About": /docs/other.html
    "[[icon|info]] Footer text": ""
  footer_right:
    "[[icon|link]] Website": https://example.com
`);
fs.writeFileSync(path.join(core,'verify.gbln'),String.raw`import modules/scout_nav/scout as scout
import modules/trailboss_wiki/trailboss as trailboss
import modules/stagehand/stagehand as stagehand
import modules/brindle_themes/brindle as brindle
scout::publish_nav_tokens({"portal":"test"})
for rel in ["docs/index", "docs/other", "docs/index"]
    ctx | {"portal":"test","body":"<p>Article [[icon|book]]</p><pre><code>[[icon|book]]</code></pre>","frontmatter":{"layout":"docs","title":"Icon menus"},"path":"../site/portals/test/content/" + rel + ".md","route_rel_no_ext":rel,"href":"/" + rel + ".html","wanted_pages":[],"backlinks":[]}
    ctx |= brindle::apply_layout(ctx)
    ctx |= trailboss::process_wikilinks(ctx)
    ctx |= stagehand::wire_slots(ctx)
    ctx |= scout::apply_tokens(ctx)
    :say("NAV_ICON_CHECK " + :json_stringify({"rel":rel,"html":ctx{"body"},"wanted":ctx{"wanted_pages"},"backlinks":ctx{"backlinks"},"registry":resolve_token("{{{SCOUT::left_docs_SIDEBAR}}}")}))
xx
:say("LABEL_CHECK " + :json_stringify([scout::scout_nav_label("test", "Ordinary label"),scout::scout_nav_label("test", "[[icon|book]] [[icon|book]] Label"),scout::scout_nav_label("test", "[[icon|warning|red;position:fixed]] Safe")]))
`);
const run=spawnSync('goblin',['run','verify.gbln'],{cwd:core,encoding:'utf8',timeout:30000});assert.equal(run.status,0,run.stdout+'\n'+run.stderr);const rows=run.stdout.split(/\r?\n/).filter(line=>line.startsWith('NAV_ICON_CHECK ')).map(line=>JSON.parse(line.slice(15)));assert.equal(rows.length,3);let checks=0;
for(const row of rows){const menu=row.html.match(/<aside class="sheriff-left-nav">([\s\S]*?)<\/aside>/)[1];assert(!menu.includes('[[icon|'));assert(menu.includes('sheriff-nav-icon'));assert(menu.includes('sheriff-icon-missing'));assert(menu.includes('data-sheriff-icon="custom-mark"'));assert(menu.includes('color:orange;'));assert(/aria-current="page"[^>]*><span class="sheriff-icon sheriff-nav-icon"/.test(menu),row.rel+" "+menu);assert(row.html.includes('color:rgb(200, 20, 30);'));assert(row.html.includes('color:#d04455;'));assert(row.html.includes('> Footer text</span>'));assert(row.html.includes('<code>[[icon|book]]</code>'));assert(!row.registry.includes('aria-current'));assert.deepEqual(row.wanted,[]);assert.deepEqual(row.backlinks,[]);checks++;}
assert.equal(rows[0].html,rows[2].html);assert.notEqual(rows[0].html,rows[1].html);checks++;
const labels=JSON.parse(run.stdout.split(/\r?\n/).find(line=>line.startsWith('LABEL_CHECK ')).slice(12));assert.equal(labels[0],'Ordinary label');assert.equal((labels[1].match(/data-sheriff-icon=/g)||[]).length,2);assert(!labels[2].includes('position:fixed'));checks++;
if(process.env.SHERIFF_NAV_ICON_FIXTURES){fs.mkdirSync(process.env.SHERIFF_NAV_ICON_FIXTURES,{recursive:true});fs.writeFileSync(path.join(process.env.SHERIFF_NAV_ICON_FIXTURES,'nav-icons.json'),JSON.stringify(rows));}
console.log('Passed '+checks+' Scout icon integration scenarios: actual layout/slot order, header/dropdown/sidebar/footer/group labels, inherited/explicit colors, portal icons, missing icons, alias destinations, active highlighting, literal code, safe colors, and page isolation. No user sites built.');
}finally{assert.equal(path.dirname(fixture),tmp);assert(path.basename(fixture).startsWith('sheriff-nav-icons-'));fs.rmSync(fixture,{recursive:true,force:true});}
