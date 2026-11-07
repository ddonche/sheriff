// Isolated Core rendering checks; never runs a site build.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),tempRoot=path.resolve(os.tmpdir()),fixture=fs.mkdtempSync(path.join(tempRoot,'sheriff-version-badges-'));
const core=path.join(fixture,'sheriff-core');
for(const rel of ['modules/badge_labels/badge.gbln','modules/trailboss_wiki/routes_json.gbln','modules/sheriff_patterns/patterns.gbln','modules/markdown_core/markdown.gbln','modules/markdown_core/content_tabs.gbln','modules/markdown_core/fenced_code.gbln']){const dest=path.join(core,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,'sheriff-core',rel),dest);}
function portal(name,versions){const dir=path.join(fixture,'site/portals',name);fs.mkdirSync(path.join(dir,'patterns'),{recursive:true});fs.writeFileSync(path.join(dir,'config.yall'),'version: "0.19.0"\ndocumentation:\n  default_version: '+JSON.stringify(versions[0]||'current')+'\n  versions:\n'+versions.map(v=>'    - '+JSON.stringify(v)+'\n').join(''));return dir;}
const one=portal('one',['v0.47.6','v1.0.0','current']);portal('two',['v2.0.0']);portal('empty',[]);
fs.writeFileSync(path.join(one,'patterns/shared.txt'),'::: pattern horizontal Shared\n@mode = reusable\nreleased = {{{SHERIFF::v1.0.0}}}\n:::\n');
const body=[
 '# Page {{{SHERIFF::v1.0.0}}}',
 '',
 'Added in {{{SHERIFF::v1.0.0}}}. Still supported in {{{SHERIFF::v0.47.6}}}.',
 '',
 '{{{SHERIFF::current}}}',
 '',
 '- List item {{{SHERIFF::v1.0.0}}}',
 '',
 '| Feature | Version |','| --- | --- |','| Patterns | {{{SHERIFF::v1.0.0}}} |',
 '',
 'Inline example: `{{{SHERIFF::v1.0.0}}}`.',
 '',
 '```md','{{{SHERIFF::v1.0.0}}}','```',
 '',
 '{{{SHERIFF::PATTERN_SHARED}}}',
 '',
 '<script>const version = "{{{SHERIFF::v1.0.0}}}";</script>',
 '',
 '<textarea>{{{SHERIFF::v1.0.0}}}</textarea>',
 '',
 'Unknown: {{{SHERIFF::v9.9.9}}}',
 '',
 'Header version: {{{BADGE::VERSION}}}'
].join('\n');
fs.writeFileSync(path.join(core,'cases.json'),JSON.stringify([{portal:'one',body},{portal:'one',body},{portal:'two',body:'Current {{{SHERIFF::v2.0.0}}}; previous {{{SHERIFF::v1.0.0}}}'},{portal:'empty',body:'{{{SHERIFF::current}}}'}]));
fs.writeFileSync(path.join(core,'verify.gbln'),String.raw`import modules/trailboss_wiki/routes_json as rjson
import modules/badge_labels/badge as badge
import modules/sheriff_patterns/patterns as patterns
import modules/markdown_core/markdown as markdown
for item in :read_json("cases.json")
    portal | item{"portal"}
    patterns::publish_patterns({"portal": portal})
    ctx | {"portal": portal, "body": item{"body"}, "frontmatter": {}}
    ctx |= patterns::apply_patterns(ctx)
    ctx |= markdown::render(ctx)
    ctx |= badge::apply_tokens(ctx)
    ctx |= badge::apply_version_badges(ctx)
    :say("BADGE_CHECK " + :json_stringify({"portal": portal, "html": ctx{"body"}, "registry": resolve_token("{{{SHERIFF::v1.0.0}}}")}))
xx
:say("ESCAPE_CHECK " + :json_stringify({"html": badge::build_inline_version_badge("<release & \"quoted\">" )}))
`);
const result=spawnSync('goblin',['run','verify.gbln'],{cwd:core,encoding:'utf8',timeout:30000});
if(result.status!==0)throw Error('Isolated fixture '+fixture+'\n'+result.stdout+'\n'+result.stderr);
const records=result.stdout.split(/\r?\n/).filter(s=>s.startsWith('BADGE_CHECK ')).map(s=>JSON.parse(s.slice(12)));
assert.equal(records.length,4,result.stdout);let count=0;
function check(name,fn){fn();count++;}
for(const [i,row]of records.entries()){
 const html=row.html;
 if(i<2){
  check('all placements render on pass '+i,()=>{assert.equal((html.match(/class="sheriff-inline-version"/g)||[]).length,7,html);assert(html.includes('data-version="v0.47.6"'));assert(html.includes('data-version="current"'));});
  check('code examples stay literal on pass '+i,()=>{for(const sample of html.match(/<(?:pre|code)\b[\s\S]*?<\/(?:pre|code)>/g)||[])assert(!sample.includes('sheriff-inline-version'),sample);assert(html.includes('<code>{{{SHERIFF::v1.0.0}}}</code>'));});
  check('scripts and textareas stay literal on pass '+i,()=>{assert(html.includes('<script>const version = "{{{SHERIFF::v1.0.0}}}";</script>'));assert(html.includes('<textarea>{{{SHERIFF::v1.0.0}}}</textarea>'));});
  check('unknown versions stay visible on pass '+i,()=>assert(html.includes('{{{SHERIFF::v9.9.9}}}')));
  check('header badge is preserved on pass '+i,()=>assert(html.includes('class="sheriff-version-badge">0.19.0</span>')));
  check('tag icon is accessible on pass '+i,()=>{assert(html.includes('aria-hidden="true"'));assert(html.includes('sheriff-inline-version-label">v1.0.0</span>'));});
 }
 check('no registry leak on pass '+i,()=>assert.equal(row.registry,'{{{SHERIFF::v1.0.0}}}'));
}
check('portal switching clears prior badge values',()=>{assert(records[2].html.includes('data-version="v2.0.0"'));assert(records[2].html.includes('{{{SHERIFF::v1.0.0}}}'));});
check('sites with no declared versions are unchanged',()=>assert(records[3].html.includes('{{{SHERIFF::current}}}')));
const escaped=JSON.parse(result.stdout.split(/\r?\n/).find(s=>s.startsWith('ESCAPE_CHECK ')).slice(13)).html;
check('labels and title attributes are escaped',()=>{assert(escaped.includes('&lt;release &amp; &quot;quoted&quot;&gt;'));assert(!escaped.includes('<release'));});
const events=fs.readFileSync(path.join(root,'sheriff-core/events.yall'),'utf8');
check('badges resolve after the other token passes',()=>assert(events.indexOf('"badge::apply_version_badges"')>events.indexOf('"goblin_repl::apply_tokens"')));
if(process.env.SHERIFF_BADGE_PREVIEW_DIR){const output=path.resolve(process.env.SHERIFF_BADGE_PREVIEW_DIR);fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'badge.html'),records[0].html.match(/<span class="sheriff-inline-version"[\s\S]*?<\/svg><span class="sheriff-inline-version-label">[\s\S]*?<\/span><\/span>/)[0]);fs.writeFileSync(path.join(output,'rendered.html'),records[0].html);}
assert.equal(path.dirname(fixture),tempRoot);assert(path.basename(fixture).startsWith('sheriff-version-badges-'));fs.rmSync(fixture,{recursive:true,force:true});
console.log('Passed '+count+' inline version-badge checks. No site builds run.');