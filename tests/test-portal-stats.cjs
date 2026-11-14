// Portal statistics against temporary source trees only; no user builds or writes.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');const root=path.resolve(__dirname,'..'),tmp=path.resolve(os.tmpdir()),fixture=fs.mkdtempSync(path.join(tmp,'sheriff-portal-stats-')),core=path.join(fixture,'sheriff-core');
try{
for(const rel of ['build_output.gbln','modules/badge_labels/badge.gbln','modules/badge_labels/portal_stats.gbln','modules/trailboss_wiki/stub_source.gbln','modules/trailboss_wiki/routes_json.gbln','modules/frontier_fm/frontier.gbln','modules/sheriff_patterns/patterns.gbln','modules/markdown_core/markdown.gbln','modules/markdown_core/content_columns.gbln','modules/markdown_core/content_tabs.gbln','modules/markdown_core/fenced_code.gbln']){const dst=path.join(core,rel);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(path.join(root,'sheriff-core',rel),dst);}
function put(portal,rel,text){const dst=path.join(fixture,'site/portals',portal,rel);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.writeFileSync(dst,text);return dst;}
function config(portal){put(portal,'config.yall','documentation:\n  versions:\n    - "current"\n    - "older"\n  default_version: "current"\n');}
config('one');config('two');config('empty');config('legacy');put('legacy','report.json',JSON.stringify({pages:7}));
put('one','report.json',JSON.stringify({pages:42,portal:'one',letters:{A:4},custom:'keep'}));put('two','report.json',JSON.stringify({pages:1}));
const originals=[];
for(const [file,body] of Object.entries({
'index.md':'[[video:youtube|BASE_001|full|center|Welcome]]',
'docs/current/R1.md':'[[video:youtube|OLD_REVISION|full|center|Old]]',
'docs/current/R2.md':'[[video:youtube|LATEST_001|full|center|Latest]]\n[[video:vimeo|1234|full|center|Clip]]\n[[video:youtube|1234|full|center|Different provider]]',
'docs/older/R1.md':'[[video:youtube|OLDER_VERSION|full|center|Published older version]]',
'docs/older/not-a-revision.md':'[[video:youtube|INVALID_REV|full|center|Not published]]',
'repeated.md':'[[video:youtube|BASE_001|thumb|left|Repeated]]\n[[video:YouTube|BASE_001|full|right|Repeated]]\n{{{SHERIFF::PATTERN_SHARED_VIDEO}}}\n\n::: pattern horizontal Example\n@mode = template\nvideo = [[video:youtube|INLINE_001|full|center|Inline]]\n:::\n\n::: tabs\n@tab Video\n[[video:youtube|TAB_001|full|center|Tabbed]]\n@tab Text\nOther\n:::',
'examples.md':['^^^^','title: Examples','summary: [[video:youtube|FRONTMATTER|full|center|Example]]','^^^^','','`[[video:youtube|INLINE_CODE|full|center|Literal]]`','','````markdown','::: tabs','@tab Example','```text','[[video:youtube|LONG_FENCE|full|center|Literal]]','```',':::','````','','~~~markdown','[[video:youtube|TILDE_CODE|full|center|Literal]]','~~~','','    [[video:youtube|INDENT_CODE|full|center|Literal]]','','<pre>[[video:youtube|RAW_PRE|full|center|Literal]]</pre>','<code>[[video:youtube|RAW_CODE|full|center|Literal]]</code>','<script>[[video:youtube|SCRIPT_CODE|full|center|Literal]]</script>','<textarea>[[video:youtube|TEXT_AREA|full|center|Literal]]</textarea>','<!-- [[video:youtube|COMMENT|full|center|Literal]] -->','','[[video:unsupported|NOPE|full|center|Invalid]]','[[video:youtube||full|center|Empty]]','[[video:vimeo|notnumeric|full|center|Invalid]]','[[video:youtube|bad id|full|center|Invalid]]'].join('\n')
})){const dst=put('one','content/'+file,body);originals.push([dst,body]);}
put('one','patterns/shared.txt','::: pattern horizontal Shared Video\n@mode = reusable\nsource = [[video:youtube|PATTERN_001|full|center|Shared]]\n:::');put('one','patterns/unused.txt','::: pattern horizontal Unused\nsource = [[video:youtube|UNUSED_PATTERN|full|center|Unused]]\n:::');
for(const name of ['root.png','nested/photo.JPG','nested/photo two.webp','art.svg'])put('one','public/images/'+name,'fixture');put('one','public/images/readme.txt','not an image');put('one','public/icons/icon.svg','not library media');put('one','public/logo.png','not library media');put('one','themes/compendium/banner.png','theme asset');put('two','public/images/one.jpg','fixture');put('two','content/page.md','No videos.');
const tokens='{{{BADGE::PAGE_COUNT}}} {{{BADGE::IMAGE_COUNT}}} {{{BADGE::VIDEO_COUNT}}}\n\n{{{BADGE::STATS}}}';
fs.writeFileSync(path.join(core,'tokens.json'),JSON.stringify({body:tokens+'\n\n`{{{BADGE::IMAGE_COUNT}}}`\n\n```text\n{{{BADGE::STATS}}}\n```'}));
fs.writeFileSync(path.join(core,'verify.gbln'),String.raw`import modules/trailboss_wiki/routes_json as rjson
import modules/badge_labels/portal_stats as stats
import modules/badge_labels/badge as badge
import modules/sheriff_patterns/patterns as patterns
import modules/markdown_core/markdown as markdown
for portal in ["one", "two", "empty", "one"]
    pre | {"portal":portal}
    pre |= patterns::publish_patterns(pre)
    pre |= stats::collect(pre)
    if portal == "one" => :write_json!("../site/portals/one/report.json", {"pages":999,"images":999,"videos":999})
    for pass in [1, 2]
        ctx | {"portal":portal,"body": :read_json("tokens.json"){"body"},"portal_stats":pre{"portal_stats"},"frontmatter":{}}
        ctx |= patterns::apply_patterns(ctx)
        ctx |= markdown::render(ctx)
        ctx |= badge::apply_tokens(ctx)
        :say("STATS_CHECK " + :json_stringify({"portal":portal,"pass":pass,"report":pre{"portal_stats"},"html":ctx{"body"},"registry": :resolve_token("{{{BADGE::STATS}}}")}))
    xx
    if portal == "one" => :write_json!("../site/portals/one/report.json", pre{"portal_stats"})
xx
:say("KEYS_CHECK " + :json_stringify([stats::video_key("youtube|AbC_-123|full"),stats::video_key("vimeo|1234|full"),stats::video_key("vimeo|abc|full"),stats::video_key("youtube||full"),stats::video_key("unknown|id|full")]))
/// Simulate a subsequent build after deleting the library file and changing the page.
:delete_path!("../site/portals/two/public/images/one.jpg")
:write_text!("../site/portals/two/content/page.md", "[[video:youtube|NEW_VIDEO|full|center|New]]")
pre | {"portal":"two"}
pre |= patterns::publish_patterns(pre)
pre |= stats::collect(pre)
:say("RECOUNT_CHECK " + :json_stringify(pre{"portal_stats"}))
/// A missing or older report remains usable by Badge.
ctx | {"portal":"empty","body":"{{{BADGE::STATS}}}","frontmatter":{}}
ctx |= badge::apply_tokens(ctx)
:say("FALLBACK_CHECK " + :json_stringify(ctx{"body"}))
ctx |= {"portal":"legacy","body":"{{{BADGE::STATS}}}","frontmatter":{}}
ctx |= badge::apply_tokens(ctx)
:say("LEGACY_CHECK " + :json_stringify(ctx{"body"}))
:say("INVALID_CHECK " + :json_stringify(badge::build_stats({"pages":-1,"images":"unsafe","videos":false})))
`);
const result=spawnSync('goblin',['run','verify.gbln'],{cwd:core,encoding:'utf8',timeout:30000});assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
const rows=result.stdout.split(/\r?\n/).filter(line=>line.startsWith('STATS_CHECK ')).map(line=>JSON.parse(line.slice(12)));assert.equal(rows.length,8);let checks=0;
for(const row of rows){const expected=row.portal==='one'?{pages:42,images:4,videos:8}:row.portal==='two'?{pages:1,images:1,videos:0}:{pages:0,images:0,videos:0};for(const [key,count]of Object.entries(expected)){assert.equal(row.report[key]??0,count,row.portal+' '+key);assert(row.html.includes('data-stat="'+key+'"><span class="sheriff-stat-label">'));assert(row.html.includes('sheriff-stat-count">'+count+'</span>'));}assert.equal((row.html.match(/class="sheriff-portal-stats"/g)||[]).length,1);assert(row.html.includes('<code>{{{BADGE::IMAGE_COUNT}}}</code>'));assert(row.html.replace(/<[^>]+>/g,'').includes('{{{BADGE::STATS}}}'));for(const sample of row.html.match(/<pre[\s\S]*?<\/pre>/g)||[])assert(!sample.includes('sheriff-portal-stats'));assert.equal(row.registry,'{{{BADGE::STATS}}}');if(row.portal==='one'){assert.equal(row.report.custom,'keep');assert.deepEqual(row.report.letters,{A:4});}if(row.portal==='two'){assert(row.html.includes('>1 Page</span>'));assert(row.html.includes('>1 Image</span>'));assert(row.html.includes('>0 Videos</span>'));}checks++;}
for(const [file,body]of originals)assert.equal(fs.readFileSync(file,'utf8'),body);checks++;
const recount=JSON.parse(result.stdout.split(/\r?\n/).find(line=>line.startsWith('RECOUNT_CHECK ')).slice(14));assert.equal(recount.images,0);assert.equal(recount.videos,1);assert.equal(recount.pages,1);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(fixture,'site/portals/two/report.json'),'utf8')),recount);checks++;
const keys=JSON.parse(result.stdout.split(/\r?\n/).find(line=>line.startsWith('KEYS_CHECK ')).slice(11));assert.deepEqual(keys,['youtube|AbC_-123','vimeo|1234','','','']);checks++;
const legacy=JSON.parse(result.stdout.split(/\r?\n/).find(line=>line.startsWith('LEGACY_CHECK ')).slice(13));assert(legacy.includes('sheriff-stat-count\">7</span>'));assert.equal((legacy.match(/sheriff-stat-count\">0<\/span>/g)||[]).length,2);const invalid=JSON.parse(result.stdout.split(/\r?\n/).find(line=>line.startsWith('INVALID_CHECK ')).slice(14));assert.equal((invalid.match(/sheriff-stat-count\">0<\/span>/g)||[]).length,3);checks++;
const events=fs.readFileSync(path.join(root,'sheriff-core/events.yall'),'utf8');assert(events.indexOf('"portal_stats::collect"')>events.indexOf('"sheriff::publish_patterns"'));assert(events.indexOf('"portal_stats::collect"')<events.indexOf('\nschedule:'));assert(fs.readFileSync(path.join(root,'sheriff-core/manifest.imports'),'utf8').includes('modules/badge_labels/portal_stats'));checks++;
if(process.env.SHERIFF_STATS_FIXTURES){fs.mkdirSync(process.env.SHERIFF_STATS_FIXTURES,{recursive:true});fs.writeFileSync(path.join(process.env.SHERIFF_STATS_FIXTURES,'stats.json'),JSON.stringify(rows));}
console.log('Passed '+checks+' portal-statistics integration scenarios: unique library files and video embeds, nested folders, patterns/tabs, latest revisions and published versions, literal examples, report preservation, repeat counts, portal isolation, all four tokens, and source preservation. No user sites built.');
}finally{assert.equal(path.dirname(fixture),tmp);assert(path.basename(fixture).startsWith('sheriff-portal-stats-'));fs.rmSync(fixture,{recursive:true,force:true});}
