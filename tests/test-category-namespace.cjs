// Actual routing, category generation, pattern and wikilink rendering in a disposable portal.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const repo=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-category-namespace-')),core=path.join(tmp,'sheriff-core'),portal=path.join(tmp,'site/portals/test');
let checks=0;
const put=(rel,text)=>{const file=path.join(tmp,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
const page=(title,body,extra='')=>'^^^^\ntitle: '+title+'\nlayout: wiki\n'+extra+'^^^^\n\n'+body;
function run(file,source){put('sheriff-core/'+file,source);const r=spawnSync(process.env.SHERIFF_GOBLIN||'goblin',['run',file],{cwd:core,encoding:'utf8',timeout:30000});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);return r.stdout;}
try{
 fs.cpSync(path.join(repo,'sheriff-core'),core,{recursive:true});
 put('site/portals/test/config.yall','name: Test\nrouting:\n  url_root: wiki\ntheme:\n  name: compendium\n');
 put('site/portals/test/content/outriders.md',page('Outriders','Article about the Outriders.','canonical: Outriders\n'));
 put('site/portals/test/content/member.md',page('Member','[[category:Outriders|Our outriders]] [[Category:outriders]] [[Category:Raiders]]\n\n`[[Category:Inline Example]]`\n\n```md\n[[Category:Code Example]]\n```\n\n<!-- [[Category:Comment Example]] -->\n\n<code>[[Category:HTML Example]]</code>\n\n    [[Category:Indented Example]]\n\n[[:Category:Link Only]]','categories: [Outriders]\n'));
 put('site/portals/test/content/pattern.md',page('Pattern','::: pattern vertical Person\n@mode = template\ngroup = [[category:Outriders|The Outriders]]\n:::'));
 put('site/portals/test/content/reused.md',page('Reused','{{{SHERIFF::PATTERN_NOTICE}}}'));
 put('site/portals/test/patterns/notice.txt','::: pattern horizontal Notice\n@mode = reusable\ngroup = [[Category:Reused category|Reusable membership]]\n:::');
 put('site/portals/test/content/categories/outriders.md',page('Outriders','Old generated list','canonical: Outriders\ngenerated_by: categories\nmeta_type: generated\nauthor: Portal Author\ncustom_setting: retained\naliases: [Riders]\ncategories: [Factions]\n'));
 const generator='import modules/trailboss_wiki/routes_json as routes\nimport modules/sheriff_patterns/patterns as patterns\npatterns::publish_patterns({"portal":"test"})\nroutes::clean_category_pages_once({"portal":"test"})\nroutes::build_routes_json_for_portal("test")\nroutes::build_category_pages_once({"portal":"test"})\nroutes::build_routes_json_for_portal("test")\nroutes::build_redirect_pages_once({"portal":"test"})\n';
 run('generate.gbln',generator);
 const routes=JSON.parse(fs.readFileSync(path.join(portal,'routes.json'))).routes;
 const article=routes.find(r=>r.rel==='outriders'),category=routes.find(r=>r.rel==='categories/outriders');
 assert.equal(article.canonical_slug,'outriders');assert.equal(category.canonical_slug,'category:outriders');assert.equal(category.canonical,'[[Category:Outriders]]');assert.deepEqual(category.aliases,['Category:Riders']);checks++;
 assert.deepEqual(routes.find(r=>r.rel==='member').categories,['Outriders','Raiders']);assert.deepEqual(routes.find(r=>r.rel==='pattern').categories,['Outriders']);assert.deepEqual(routes.find(r=>r.rel==='reused').categories,['Reused category']);checks++;
 assert(!routes.some(r=>/example|link-only/.test(r.rel)),'code, comments, and link-only references must not create categories');checks++;
 const read=rel=>fs.readFileSync(path.join(portal,'content',rel),'utf8');
 const md=read('categories/outriders.md');assert(md.includes('canonical: Category:Outriders'));assert(md.includes('custom_setting: retained'));assert(md.includes('author: Portal Author'));assert(md.includes('[[member|Member]]'));assert(md.includes('[[pattern|Pattern]]'));assert(!md.includes('[[:category:outriders|Outriders]]'),'category must not enroll itself from its generated listing');checks++;
 assert(read('categories/factions.md').includes('[[:category:outriders|Outriders]]'));assert(read('categories.md').includes('[[:Category:Outriders|Outriders]]'));assert(fs.existsSync(path.join(tmp,'dist/test/categories/riders.html')));assert(!fs.existsSync(path.join(tmp,'dist/test/riders.html')));checks++;
 const output=run('render.gbln',String.raw`import modules/trailboss_wiki/trailboss as trailboss
import modules/trailboss_wiki/routes_json as routes
import modules/markdown_core/markdown as markdown
import modules/frontier_fm/frontier as frontier
import modules/sheriff_patterns/patterns as patterns
patterns::publish_patterns({"portal":"test"})
ctx | {"portal":"test","body":"[[Outriders]] [[Category:Outriders]] [[category:OUTRIDERS|Custom text]] [[:Category:Riders|Alias]] [[Category:Outriders#O|Section]] [[Category:Unknown]]","frontmatter":{},"path":"../site/portals/test/content/member.md","href":"/wiki/member.html"}
ctx |= trailboss::process_wikilinks(ctx)
:say("LINKS " + :json_stringify(ctx{"body"}))
for rel in ["member", "pattern", "reused", "categories/outriders"]
    text | :read_text("../site/portals/test/content/{rel}.md")
    ctx |= {"portal":"test","path":"../site/portals/test/content/{rel}.md","href":"/wiki/{rel}.html","body":text}
    ctx |= frontier::strip_frontmatter(ctx)
    ctx |= patterns::apply_patterns(ctx)
    ctx |= routes::collect_page_categories(ctx)
    ctx |= markdown::render(ctx)
    ctx |= trailboss::process_wikilinks(ctx)
    :update!(ctx{"body"}, ctx{"body"} + "{{{TRAILBOSS::CATEGORIES}}} {{{TRAILBOSS::CANONLINK}}}")
    ctx |= trailboss::publish_categories(ctx)
    ctx |= trailboss::publish_canonical_link(ctx)
    :say("PAGE " + :json_stringify({"rel":rel,"body":ctx{"body"},"categories":ctx{"frontmatter"}{"categories"}}))
xx
`);
 const links=JSON.parse(output.split(/\r?\n/).find(l=>l.startsWith('LINKS ')).slice(6));
 assert(links.includes('href="/wiki/outriders.html"'));assert(links.includes('href="/wiki/categories/outriders.html" class="sheriff-link">Outriders</a>'));assert(links.includes('href="/wiki/categories/outriders.html" class="sheriff-link">Custom text</a>'));assert(links.includes('href="/wiki/categories/outriders.html" class="sheriff-link">Alias</a>'));assert(links.includes('href="/wiki/categories/outriders.html#O" class="sheriff-link">Section</a>'));assert(links.includes('sheriff-missing-link'));checks++;
 const pages=output.split(/\r?\n/).filter(l=>l.startsWith('PAGE ')).map(l=>JSON.parse(l.slice(5)));
 for(const p of pages){assert(p.body.includes('sheriff-wiki-category-tag'),JSON.stringify(p));assert(!p.body.includes('{{{TRAILBOSS::'));}
 assert(pages.find(p=>p.rel==='categories/outriders').body.includes('data-wikilink="[[Category:Outriders]]"'));assert(pages.find(p=>p.rel==='pattern').body.includes('>The Outriders</a>'));checks++;
 const before=read('categories/outriders.md');run('generate.gbln',generator);assert.equal(read('categories/outriders.md'),before);checks++;
 console.log('Passed '+checks+' category namespace integration groups: article/category collisions, legacy metadata, custom labels/aliases/anchors, membership deduplication, patterns, code exclusions, parent categories, canonical copy, redirects and repeat builds. Only temporary sites used.');
}finally{assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));assert(path.basename(tmp).startsWith('sheriff-category-namespace-'));fs.rmSync(tmp,{recursive:true,force:true});}
