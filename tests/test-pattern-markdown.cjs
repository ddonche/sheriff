// Real field Markdown, wiki resolution, pattern tabs/tokens, and PNG icons in disposable sites.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-pattern-markdown-')),core=path.join(tmp,'sheriff-core'),portal=path.join(tmp,'site/portals/test');
try{
fs.cpSync(path.join(root,'sheriff-core'),core,{recursive:true});fs.mkdirSync(path.join(portal,'patterns'),{recursive:true});fs.mkdirSync(path.join(portal,'public/icons'),{recursive:true});
fs.writeFileSync(path.join(portal,'config.yall'),'theme:\n  name: outpost\n');
fs.writeFileSync(path.join(portal,'routes.json'),JSON.stringify({routes:[{rel:'books/path-of-the-outrider',href:'/books/path-of-the-outrider.html',canonical_slug:'path-of-the-outrider',title:'Path of the Outrider',aliases:[]},{rel:'everwind-series',href:'/everwind-series.html',canonical_slug:'everwind-series',title:'Everwind Series',aliases:[]}]}));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');fs.writeFileSync(path.join(portal,'public/icons/game-crest.png'),png);
const book=['::: pattern vertical Book','@mode = template','appears = *[[Path of the Outrider]]*','bold = **[[Everwind Series]]**','code = `*[[Path of the Outrider]]*`','escaped = \\*Literal stars\\*','text = *ordinary italics* and **ordinary bold**','raw = <span class="edition">First</span><br>Second','png = [[icon|game-crest||18]]','svg = [[icon|book|orange|24]]','token = {{{TEST::VALUE}}}','@tab First edition','title = *[[Path of the Outrider]]*','@tab Second edition','title = **[[Everwind Series]]**',':::'].join('\n');
fs.writeFileSync(path.join(portal,'patterns/book.txt'),book.replace('@mode = template','@mode = reusable'));
fs.writeFileSync(path.join(core,'cases.json'),JSON.stringify([{name:'inline',body:book+'\n\nArticle *[[Everwind Series]]*.'},{name:'reusable',body:'{{{SHERIFF::PATTERN_BOOK}}}'},{name:'code',body:'````md\n'+book+'\n````'}]));
fs.writeFileSync(path.join(core,'verify.gbln'),`import modules/sheriff_patterns/patterns as patterns
import modules/markdown_core/markdown as markdown
import modules/trailboss_wiki/trailboss as trailboss
register_token("TEST", "VALUE", "<strong>Already formatted</strong>")
patterns::publish_patterns({"portal":"test"})
for item in :read_json("cases.json")
    ctx | {"portal":"test","body":item{"body"},"frontmatter":{},"wanted_pages":[],"backlinks":[]}
    ctx |= patterns::apply_patterns(ctx)
    ctx |= markdown::render(ctx)
    ctx |= trailboss::render_fences(ctx)
    ctx |= trailboss::process_wikilinks(ctx)
    :say("PATTERN_MD " + :json_stringify({"name":item{"name"},"html":resolve_token(ctx{"body"})}))
xx
`);
const result=spawnSync(process.env.SHERIFF_GOBLIN||'goblin',['run','verify.gbln'],{cwd:core,encoding:'utf8',timeout:30000});assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
const rows=result.stdout.split(/\r?\n/).filter(line=>line.startsWith('PATTERN_MD ')).map(line=>JSON.parse(line.slice(11)));let checks=0;
for(const name of ['inline','reusable']){
 const html=rows.find(row=>row.name===name).html;
 assert(/<dd class="sheriff-pattern-value"><em><a[^>]*href="\/books\/path-of-the-outrider.html"[^>]*>Path of the Outrider<\/a><\/em><\/dd>/.test(html),html);checks++;
 assert(/<dd class="sheriff-pattern-value"><strong><a[^>]*href="\/everwind-series.html"[^>]*>Everwind Series<\/a><\/strong><\/dd>/.test(html));checks++;
 assert(html.includes('<code>*[[Path of the Outrider]]*</code>'));assert(!/<code>[^<]*<a/.test(html));checks++;
 assert(html.includes('>\*Literal stars\*</dd>'));assert(html.includes('<em>ordinary italics</em> and <strong>ordinary bold</strong>'));checks++;
 assert(html.includes('<span class="edition">First</span><br>Second'));assert(html.includes('<strong>Already formatted</strong>'),name+' '+html);assert(!html.includes('&lt;strong&gt;'));checks++;
 assert(html.includes('data-sheriff-icon="game-crest" data-sheriff-icon-format="png"'));assert(html.includes('--sheriff-icon-size:18px;'));assert(html.includes('data-sheriff-icon="book"'));checks++;
 assert(!/<dd[^>]*><p>/.test(html));assert(!html.includes('@@TB_'));assert(!html.includes('*<a'));assert(html.includes('data-sheriff-content-tabs'));checks++;
}
const code=rows.find(row=>row.name==='code').html;assert(!code.includes('data-sheriff-pattern='));assert(code.includes('*[[Path of the Outrider]]*'));checks++;
assert(/<em><a[^>]*href="\/everwind-series.html"[^>]*>Everwind Series<\/a><\/em>/.test(rows.find(row=>row.name==='inline').html));checks++;
assert(fs.readFileSync(path.join(tmp,'dist/test/public/icons/game-crest.png')).equals(png));checks++;
if(process.env.SHERIFF_PATTERN_MARKDOWN_PREVIEW_DIR){fs.mkdirSync(process.env.SHERIFF_PATTERN_MARKDOWN_PREVIEW_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.SHERIFF_PATTERN_MARKDOWN_PREVIEW_DIR,'rendered.json'),JSON.stringify(rows,null,2));}
console.log('Passed '+checks+' pattern Markdown checks: exact Everwind italics, bold, tabs, reusable tokens, code literals, escaped stars, raw HTML, PNG/SVG icons, and one-page asset publication. No user sites built.');
}finally{assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));assert(path.basename(tmp).startsWith('sheriff-pattern-markdown-'));fs.rmSync(tmp,{recursive:true,force:true});}
