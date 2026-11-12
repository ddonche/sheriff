// Real schedules, deterministic output, bounded overlap, live logs, and failed-task recovery.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawn,spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-swarm-')),core=path.join(tmp,'sheriff-core'),output=path.join(tmp,'dist/test');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function put(rel,text){const p=path.join(tmp,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text);}
function hashTree(dir,prefix=''){return Object.fromEntries(fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?Object.entries(hashTree(path.join(dir,e.name),prefix+e.name+'/')):[[prefix+e.name,crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,e.name))).digest('hex')]]));}
const env=workers=>({...process.env,SHERIFF_RUNTIME_MODE:'local',SHERIFF_BUILD_WORKERS:String(workers),SHERIFF_BUILD_OUTPUT:'',SHERIFF_BUILD_DEFER_ACTIVATION:'',GOBLIN_NONINTERACTIVE:'0'});
function run(workers,extra={}){const r=spawnSync(process.env.SHERIFF_GOBLIN||'goblin',['run','main.gbln','test'],{cwd:core,env:{...env(workers),...extra},encoding:'utf8',timeout:15000,windowsHide:true});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);return r;}
(async()=>{try{
 fs.cpSync(path.join(root,'sheriff-core'),core,{recursive:true});
 put('site/portals/test/config.yall','name: Swarm regression\ntheme:\n  name: compendium\n');
 for(let i=0;i<6;i++)put('site/portals/test/content/p'+i+'.md','^^^^\ntitle: Page '+i+'\nlayout: wiki\ncategories: [Examples]\n^^^^\n\n# Heading '+i+'\n\n[[p'+((i+1)%6)+']] [[Missing '+i+']] [[icon|book]]\n\n::: pattern vertical Card\n@mode = template\ntext = Page '+i+'\n@tab First\nvalue = A\n@tab Second\nvalue = B\n:::');
 put('hold.cjs',"const fs=require('fs'),path=require('path'),file=path.join(__dirname,process.argv[2]==='p0'?'release-last':'release'),start=Date.now();const timer=setInterval(()=>{if(fs.existsSync(file)){clearInterval(timer);process.exit(0)}if(Date.now()-start>8000)process.exit(1)},10);");
 put('sheriff-core/modules/swarm_test/swarm_test.gbln',`act before(ctx)
    :append_file!("../pre.count", "pre\\n")
    :create_dir!("../signals")
    return ctx
xx
act first(ctx)
    slug | :stem(ctx{"path"})
    :update!(ctx{"test_stage"}, slug)
    :register_token("SLOT", "TEST_PAGE", slug)
    :write_text!("../signals/start-{slug}", slug)
    if :env("SHERIFF_SWARM_TEST_FAIL") == "1" and slug == "p2" => :read_text("deliberate-swarm-failure")
    if :env("SHERIFF_SWARM_TEST_WAIT") == "1" => :run_cmd("node ../hold.cjs {slug}")
    return ctx
xx
act second(ctx)
    slug | :stem(ctx{"path"})
    if ctx{"test_stage"} != slug => :read_text("schedule-order-failure")
    if :resolve_token("{{{SLOT::TEST_PAGE}}}") != slug => :read_text("token-isolation-failure")
    :update!(ctx{"body"}, ctx{"body"} + "\\n\\nWorker token: " + slug)
    :write_text!("../signals/end-{slug}", slug)
    return ctx
xx
act after(ctx)
    :append_file!("../post.count", "post\\n")
    return ctx
xx
`);
 fs.appendFileSync(path.join(core,'manifest.imports'),'\nimport modules/swarm_test/swarm_test as swarm_test\n');
 const events=path.join(core,'events.yall');fs.writeFileSync(events,fs.readFileSync(events,'utf8').replace('pre:\n','pre:\n  - "swarm_test::before"\n').replace('schedule:\n','schedule:\n  - "swarm_test::first"\n  - "swarm_test::second"\n')+'\n  - "swarm_test::after"\n');
 run(1);put("pre.count", "");put("post.count", "");run(1);const baseline=hashTree(output);
 const signals=path.join(tmp,'signals');assert(signals.startsWith(tmp+path.sep));fs.rmSync(signals,{recursive:true,force:true});
 const child=spawn(process.env.SHERIFF_GOBLIN||'goblin',['run','main.gbln','test'],{cwd:core,env:{...env(2),SHERIFF_SWARM_TEST_WAIT:'1'},windowsHide:true});let stdout='',stderr='',done=false;child.stdout.on('data',chunk=>{stdout+=chunk});child.stderr.on('data',chunk=>{stderr+=chunk});const ended=new Promise(resolve=>child.on('close',code=>{done=true;resolve(code)}));
 let released=false,sawLive=false;const timeout=setTimeout(()=>child.kill(),15000);
 try{for(let attempt=0;attempt<1000&&!done;attempt++){
  const files=fs.existsSync(signals)?fs.readdirSync(signals):[];
  if(!released&&files.filter(f=>f.startsWith('start-')).length===2){await sleep(100);assert.equal(fs.readdirSync(signals).filter(f=>f.startsWith('start-')).length,2,'Only two tasks may enter while both workers are held');assert.deepEqual(hashTree(output),baseline,'Current output changed during rendering');put('release','continue');released=true;}
  if(released&&!sawLive&&files.includes('start-p0')&&stdout.includes('Built page:')){assert.equal(done,false);sawLive=true;put('release-last','continue');}
  if(sawLive)break;await sleep(10);
 }assert.equal(await ended,0,stdout+'\n'+stderr);}finally{clearTimeout(timeout);if(!done)child.kill();}
 assert(released,'Two page schedules must overlap');assert(sawLive,'Completion messages must stream before the swarm finishes');assert.deepEqual(hashTree(output),baseline,'Serial and swarm output must match, including backlinks, wanted pages, search, patterns, and tokens');
 assert.equal(fs.readFileSync(path.join(tmp,'pre.count'),'utf8'),'pre\npre\n');assert.equal(fs.readFileSync(path.join(tmp,'post.count'),'utf8'),'post\npost\n');
 const four=run(4);assert(four.stdout.includes('with 4 page workers'));assert.deepEqual(hashTree(output),baseline);
 const localDefault=run('');assert(localDefault.stdout.includes('with 2 page workers'));assert.deepEqual(hashTree(output),baseline);
 put('site/portals/test/config.yall','name: Swarm regression\ntheme:\n  name: compendium\nbuild:\n  workers: 4\n');
 const hosted=run(8,{SHERIFF_RUNTIME_MODE:'cloud'});assert(hosted.stdout.includes('with 1 page workers'),'Cloud must stay serial despite portal/environment requests');assert.deepEqual(hashTree(output),baseline);
 const failed=spawnSync(process.env.SHERIFF_GOBLIN||'goblin',['run','main.gbln','test'],{cwd:core,env:{...env(2),SHERIFF_SWARM_TEST_FAIL:'1'},encoding:'utf8',timeout:10000,windowsHide:true});assert.notEqual(failed.status,null,'Failed swarm must stop instead of hanging on search actors');assert.notEqual(failed.status,0);assert.match(failed.stderr,/swarm-task-failed|deliberate-swarm-failure/);assert.deepEqual(hashTree(output),baseline);assert(!fs.existsSync(path.join(tmp,'data/.desk/builds/test/lease')));assert(!fs.existsSync(path.join(tmp,'data/.desk/builds/test/next')));
 console.log('Passed real swarm build checks: local default/1/2/4-worker identical output, Cloud capped at one worker, bounded concurrent schedules, ordered actions, isolated tokens, one pre/post pass, live completion logs, and failed-task recovery without hanging.');
}finally{assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));assert(path.basename(tmp).startsWith('sheriff-swarm-'));fs.rmSync(tmp,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1});
