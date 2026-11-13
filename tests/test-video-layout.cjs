// Real rendering against temporary portals; never builds or writes user sites.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),tempRoot=path.resolve(os.tmpdir()),fixture=fs.mkdtempSync(path.join(tempRoot,'sheriff-video-layout-')),core=path.join(fixture,'sheriff-core');
const video=(id,size='half',align='center',caption=id)=>`[[video:youtube|${id}|${size}|${align}|${caption}]]`;
const trio=video('featured','full')+'\n'+video('first','half','left')+video('second','half','right');
const cases=[
{name:'featured',body:'## Video samples\n\n'+trio+'\n\n## Following\n\nBody.',groups:1,frames:3},
{name:'blank-lines',body:[video('featured','full'),video('first'),video('second')].join('\n\n'),groups:1,frames:3},
{name:'halves',body:video('first')+'\n'+video('second'),groups:1,frames:2},
...['left','center','right'].map(align=>({name:'single-'+align,body:video('single','half',align)+'\n\nFollowing prose.',groups:1,frames:1})),
{name:'thumb',body:video('thumb','thumb','right')+'\n\nFollowing prose beside the thumbnail.',groups:1,frames:1},
{name:'prose-boundary',body:video('first')+'\n\nIntervening prose.\n\n'+video('second'),groups:2,frames:2},
{name:'duplicate',body:video('same')+video('same'),groups:1,frames:2},
{name:'pattern-before',body:'::: pattern vertical Infobox\n@mode = template\n'+Array.from({length:18},(_,i)=>'field'+i+' = Example').join('\n')+'\n:::\n\n'+trio+'\n\n## Following\n\nBody.',groups:1,frames:3},
{name:'float-with-pattern',body:'::: pattern vertical Infobox\n@mode = template\n'+Array.from({length:18},(_,i)=>'field'+i+' = Example').join('\n')+'\n:::\n\n'+video('single','half','left')+'\n\n'+('Following prose should wrap alongside the video and stay clear of the infobox. '.repeat(20))+'\n\nMore paragraph content.\n\n## Following\n\nBody.',groups:1,frames:1},
{name:'pattern-inside',body:'::: pattern horizontal Videos\n@mode = template\nwatch = '+video('first')+video('second')+'\n:::',groups:1,frames:2},
{name:'admonition',body:'::: note Watch\n\n'+trio+'\n\n:::',groups:1,frames:3},
{name:'tabs',body:'::: tabs\n@tab First\n'+trio+'\n@tab Second\n'+video('other')+'\n:::',groups:2,frames:4},
{name:'code',body:'`'+video('inline')+'`\n\n```text\n'+trio+'\n```',groups:0,frames:0}
];
if(process.env.SHERIFF_VIDEO_ODIN_SOURCE)cases.push({name:'odin',body:fs.readFileSync(process.env.SHERIFF_VIDEO_ODIN_SOURCE,'utf8'),groups:1,frames:3});
try{
for(const rel of ['modules/trailboss_wiki/trailboss.gbln','modules/trailboss_wiki/stub_source.gbln','modules/trailboss_wiki/routes_json.gbln','modules/markdown_core/markdown.gbln','modules/markdown_core/fenced_code.gbln','modules/markdown_core/content_tabs.gbln','modules/sheriff_patterns/patterns.gbln','modules/frontier_fm/frontier.gbln']){const target=path.join(core,rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,'sheriff-core',rel),target);}
const portal=path.join(fixture,'site/portals/test');fs.mkdirSync(portal,{recursive:true});fs.writeFileSync(path.join(portal,'config.yall'),'theme:\n  name: compendium\n');fs.writeFileSync(path.join(portal,'routes.json'),JSON.stringify({routes:[]}));fs.writeFileSync(path.join(core,'cases.json'),JSON.stringify(cases));
fs.writeFileSync(path.join(core,'verify.gbln'),String.raw`import modules/markdown_core/markdown as markdown
import modules/sheriff_patterns/patterns as patterns
import modules/trailboss_wiki/trailboss as trailboss
import modules/frontier_fm/frontier as frontier
for item in :read_json("cases.json")
    ctx | {"portal":"test","body":item{"body"},"frontmatter":{}}
    ctx |= frontier::strip_frontmatter(ctx)
    ctx |= patterns::apply_patterns(ctx)
    ctx |= markdown::render(ctx)
    ctx |= trailboss::render_fences(ctx)
    ctx |= trailboss::process_wikilinks(ctx)
    :say("VIDEO_CHECK " + :json_stringify({"name":item{"name"},"html":ctx{"body"}}))
xx
`);
const result=spawnSync('goblin',['run','verify.gbln'],{cwd:core,encoding:'utf8',timeout:30000});assert.equal(result.status,0,result.stdout+'\n'+result.stderr);const rows=result.stdout.split(/\r?\n/).filter(line=>line.startsWith('VIDEO_CHECK ')).map(line=>JSON.parse(line.slice(12)));assert.equal(rows.length,cases.length);
for(const row of rows){const item=cases.find(item=>item.name===row.name);assert.equal((row.html.match(/class="sheriff-video-group(?: [^"]*)?"/g)||[]).length,item.groups,row.name+' groups');assert.equal((row.html.match(/<iframe /g)||[]).length,item.frames,row.name+' frames');assert(!/<p><div class="sheriff-video-group(?:[ "])/.test(row.html),row.name+' block must be outside paragraphs');}
for(const name of ['single-left','single-right','thumb','float-with-pattern'])assert(rows.find(row=>row.name===name).html.includes('class="sheriff-video-flow"'),name+' allows prose flow');
assert(!rows.find(row=>row.name==='featured').html.includes('class="sheriff-video-flow"'));
assert(rows.find(row=>row.name==='featured').html.includes('sheriff-video-half sheriff-video-align-left'));assert(rows.find(row=>row.name==='pattern-inside').html.includes('sheriff-pattern'));assert(rows.find(row=>row.name==='code').html.includes('[[video:youtube|inline'));
if(process.env.SHERIFF_VIDEO_FIXTURES){fs.mkdirSync(process.env.SHERIFF_VIDEO_FIXTURES,{recursive:true});fs.writeFileSync(path.join(process.env.SHERIFF_VIDEO_FIXTURES,'videos.json'),JSON.stringify(rows));}
console.log('Passed '+rows.length+' video rendering checks: adjacent/blank-line groups, boundaries, alignments, duplicate embeds, nested patterns/admonitions/tabs, literal code'+(process.env.SHERIFF_VIDEO_ODIN_SOURCE?', and the actual Odin source':'')+'. No user sites built.');
}finally{assert.equal(path.dirname(fixture),tempRoot);assert(path.basename(fixture).startsWith('sheriff-video-layout-'));fs.rmSync(fixture,{recursive:true,force:true});}
