// Real Goblin route snapshots, collision ordering and wanted-page output checks.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const repo=process.env.SHERIFF_TEST_REPO||path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-route-cache-')),core=path.join(tmp,'sheriff-core');
const put=(rel,data)=>{const file=path.join(tmp,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);};
function run(text){put('sheriff-core/probe.gbln',text);const r=spawnSync(process.env.SHERIFF_GOBLIN||'goblin',['run','probe.gbln'],{cwd:core,encoding:'utf8',timeout:30000,windowsHide:true});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);return r.stdout;}
try{
 fs.cpSync(path.join(repo,'sheriff-core'),core,{recursive:true});
 put('site/portals/test/config.yall','name: Test\ntheme:\n  name: compendium\n');
 put('site/portals/test/content/example.md','^^^^\ntitle: Example\nlayout: wiki\n^^^^\nExample');
 const routes=[{slug:'first',canonical_slug:'first',href:'/first.html',aliases:['Shared'],gloss:''},{slug:'shared',canonical_slug:'shared',href:'/second.html',aliases:[],gloss:'Later gloss'},{slug:'empty',canonical_slug:'empty',href:'',gloss:'First gloss'},{slug:'fallback',canonical_slug:'empty',href:'/fallback.html',gloss:'Second gloss'}];
 put('site/portals/test/routes.json',JSON.stringify({routes}));
 const output=run(`import modules/trailboss_wiki/trailboss as trailboss
ctx | {"portal":"test"}
ctx |= trailboss::prepare_route_lookup(ctx,"test")
:say(:json_stringify([trailboss::lookup_href_by_slug(ctx,"test","shared"),trailboss::lookup_gloss_by_slug(ctx,"test","shared"),trailboss::lookup_href_by_slug(ctx,"test","empty"),trailboss::lookup_gloss_by_slug(ctx,"test","empty"),trailboss::lookup_slug_by_href(ctx,"test","/fallback.html"),trailboss::lookup_href_by_slug(ctx,"test","unknown")]))
:write_text!("../site/portals/test/routes.json", "{\\"routes\\":[{\\"slug\\":\\"first\\",\\"href\\":\\"/updated.html\\"}]}")
:say(trailboss::lookup_href_by_slug(ctx,"test","first"))
fresh | {"portal":"test"}
fresh |= trailboss::prepare_route_lookup(fresh,"test")
:say(trailboss::lookup_href_by_slug(fresh,"test","first"))
ctx |= trailboss::build_routes(ctx)
:say(trailboss::lookup_href_by_slug(ctx,"test","example"))
`);
 const lines=output.trim().split(/\r?\n/);assert.deepEqual(JSON.parse(lines[0]),['/first.html','','/fallback.html','First gloss','fallback','']);assert.equal(lines[1],'/first.html');assert.equal(lines[2],'/updated.html');assert.equal(lines.at(-1),'/example.html');
 const wanted=[{slug:'alpha',title:'Alpha',source_href:'/one.html',source_title:'One & <two>'},{slug:'beta',title:'Beta',source_href:'/two.html',source_title:'Two'},{slug:'alpha',title:'Ignored later title',source_href:'/one.html',source_title:'Duplicate'},{slug:'alpha',title:'Alpha',source_href:'/three.html',source_title:'Three'},{portal:'other',slug:'alpha',title:'Other Alpha',source_href:'/else.html',source_title:'Else'},null,{}];
 put('sheriff-core/wanted.json',JSON.stringify(wanted));
 const wantedScript=`import modules/trailboss_wiki/trailboss as trailboss
act passthrough(ctx)
    return ctx
xx
ctx | {"portal":"test","schedule":["passthrough"],"wanted_pages": :read_json("wanted.json")}
ctx |= trailboss::build_wanted_pages_once(ctx)
`;
 run(wantedScript);const html=fs.readFileSync(path.join(tmp,'dist/test/categories/missing-pages.html'),'utf8');
 assert.equal((html.match(/class="sheriff-wanted-item"/g)||[]).length,2);assert(html.includes('2 referring pages'));assert(html.includes('1 referring page'));assert(html.includes('One &amp; &lt;two&gt;'));assert(!html.includes('Ignored later title'));assert.equal((html.match(/>Duplicate</g)||[]).length,0);assert(html.indexOf('>Alpha</a>')<html.indexOf('>Beta</a>'));
 assert.equal(html,fs.readFileSync(path.join(tmp,'dist/test/wanted-pages.html'),'utf8'));
 console.log('Passed route collision/fallback ordering, build-local snapshot isolation/refresh, and missing-directory counts/source deduplication/escaping.');
}finally{assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));assert(path.basename(tmp).startsWith('sheriff-route-cache-'));fs.rmSync(tmp,{recursive:true,force:true,maxRetries:6,retryDelay:150});}
