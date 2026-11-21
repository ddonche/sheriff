// Grouped-site transport and streamed process bridge. Theme, membership and mount
// decisions are made by Sheriff’s Goblin site module, not duplicated here.
import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
const fail=(message,status=400)=>Object.assign(Error(message),{status})
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const fingerprint=files=>hash(JSON.stringify(files.map(f=>[f.path,hash(f.bytes)]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0)))
const limit=48*1024*1024
function safe(value){return typeof value==='string'&&value.length<1024&&!/[\\:\x00-\x1f]/.test(value)&&!value.startsWith('/')&&value.split('/').every(p=>p&&!p.startsWith('.'))}
export function groupedSourcePath(value){return safe(value)&&!/(^|\/)(credentials(?:\.[^/]*)?|[^/]*\.(pem|key))$/i.test(value)&&(value==='site/site.yall'||value.startsWith('site/public/')||/^portals\/[a-z0-9][a-z0-9_-]*\/((content|blog|public|patterns|themes)\/.+|(config|nav|assets|widgets|seeder)\.yall)$/.test(value))}
function outputPath(value){return safe(value)&&!/^(admin|api|site|data|node_modules|sheriff-core)\//.test(value)}
async function readFiles(folder,prefix,allowed){const files=[];let total=0;async function visit(dir,rel){let entries;try{entries=await fs.readdir(dir,{withFileTypes:true})}catch(error){if(error.code==='ENOENT')return;throw error}for(const e of entries){if(e.isSymbolicLink())throw fail('Linked site paths cannot be transferred.');const key=rel+e.name,full=path.join(dir,e.name);if(e.isDirectory()){if(safe(key))await visit(full,key+'/')}else if(e.isFile()&&allowed(key)){const stat=await fs.stat(full);total+=stat.size;if(total>limit)throw fail('Source exceeds the 48 MB transfer limit.',413);files.push({path:key,bytes:await fs.readFile(full)})}}}await visit(folder,prefix);return files}
function unpack(entries,allowed){if(!Array.isArray(entries)||entries.length>20000)throw fail('Invalid transfer file list.');let total=0;const seen=new Set();return entries.map(f=>{if(!f||!allowed(f.path)||typeof f.base64!=='string'||f.base64.length>limit*1.4)throw fail('Invalid transfer path.');const key=f.path.toLowerCase();if(seen.has(key))throw fail('Duplicate transfer file.');seen.add(key);const bytes=Buffer.from(f.base64,'base64');total+=bytes.length;if(total>limit)throw fail('Transfer exceeds 48 MB.',413);if(bytes.toString('base64')!==f.base64||hash(bytes)!==f.sha256)throw fail('Transfer checksum failed.');return {path:f.path,bytes}})}
async function writeFiles(folder,files){for(const f of files){const file=path.join(folder,f.path);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,f.bytes,{flag:'wx'})}}
export function createMultisiteBridge({root,goblin,run,invoke,publish,buildJob,lifecycle,safePath,noLinks,state}){
  const core=path.join(root,'sheriff-core')
  async function policy(mode,site,extra={}){const data=await invoke('site_cloud_request','',Buffer.from(JSON.stringify({mode,site,...extra})));if(data.ok===false)throw fail(data.stderr||data.error||'Site configuration is invalid.');return data}
  async function catalog(ids){return (await policy('catalog','',{ids})).sites}
  const registryCache=new Map();
  async function current(site){
    const file=await safePath(root,'site/sites/'+site+'/site.yall');let stamp;
    try{stamp=hash(await fs.readFile(file))}catch(error){if(error.code==='ENOENT'){registryCache.delete(site);return null;}throw error}
    const cached=registryCache.get(site);if(cached?.stamp===stamp)return cached.group;
    const rows=await catalog([site]),group=rows.find(s=>s.id===site&&s.grouped)||null;registryCache.set(site,{stamp,group});return group;
  }
  async function sourceFiles(site){const group=await current(site);if(!group)return null;await noLinks(await safePath(root,'site/sites/'+site));for(const p of group.portals)await noLinks(await safePath(root,'site/portals/'+p.source));const files=await readFiles(path.join(root,'site/sites',site),'site/',groupedSourcePath);for(const p of group.portals)files.push(...await readFiles(path.join(root,'site/portals',p.source),'portals/'+p.source+'/',groupedSourcePath));if(files.reduce((n,f)=>n+f.bytes.length,0)>limit)throw fail('Source exceeds 48 MB.',413);return {group,files}}
  async function transfer(op,site,payload,progress){
    const local=await sourceFiles(site);let incoming;try{incoming=JSON.parse(payload.toString()||'{}')}catch{throw fail('Invalid transfer request.')}
    if(!local&&incoming.format!=='multisite-v1')return null
    const files=local?.files||[],rev=fingerprint(files)
    if(op==='sync.inspect')return {ok:true,format:'multisite-v1',revision:rev,files:files.length}
    if(op==='sync.download'){const states={};for(const p of local.group.portals)states[p.source]=await state('export',p.source);return {ok:true,format:'multisite-v1',site,revision:rev,states,files:files.map(f=>({path:f.path,base64:f.bytes.toString('base64'),sha256:hash(f.bytes)}))}}
    if(op!=='sync.deploy')throw fail('Unknown site transfer.')
    if(incoming.format!=='multisite-v1')throw fail('Pull the grouped site before replacing it.')
    if(incoming.expected_revision!==rev)throw fail('Cloud changed. Check changes and retry.',409)
    const source=unpack(incoming.source,groupedSourcePath),output=unpack(incoming.output,outputPath)
    if(source.reduce((n,f)=>n+f.bytes.length,0)+output.reduce((n,f)=>n+f.bytes.length,0)>limit)throw fail('Source and build together exceed 48 MB.',413)
    if(!output.some(f=>f.path==='index.html'))throw fail('A completed site homepage is required.')
    const work=await safePath(root,'site/.desk/connection-uploads/'+site+'/'+randomUUID()),fresh=path.join(work,'source'),built=path.join(work,'output');await fs.mkdir(work,{recursive:true})
    try{
      await writeFiles(fresh,source);await writeFiles(built,output)
      const plan=await policy('inspect',site,{folder:fresh.replaceAll('\\','/')})
      const allowed=new Set(plan.sources);for(const f of source){const sourceId=f.path.split('/')[1];if(f.path.startsWith('portals/')&&!allowed.has(sourceId))throw fail('Transfer contains an unregistered portal.')}
      for(const p of plan.portals){if(!output.some(f=>f.path==='p/'+p.id+'/wiki/index.html'))throw fail('Missing completed wiki: '+p.id);await state('validate',p.source,incoming.states?.[p.source])}
      const result=await publish({ok:true,code:0,stdout:'Using completed local site build.\n',stderr:'',build_ms:incoming.build_ms||0},site,'full',progress,built)
      if(!result.published)return result
      const previous=await safePath(root,'site/.desk/connection-backups/'+site+'/previous');await fs.mkdir(path.dirname(previous),{recursive:true});await fs.rm(previous,{recursive:true,force:true})
      const targets=[{rel:'sites/'+site,input:path.join(fresh,'site')},...[...new Set([...plan.sources,...plan.previous_sources])].map(p=>({rel:'portals/'+p,input:plan.sources.includes(p)?path.join(fresh,'portals',p):null}))],moved=[],installed=[]
      try{for(const t of targets){const target=await safePath(path.join(root,'site'),t.rel),backup=await safePath(previous,t.rel);await fs.mkdir(path.dirname(backup),{recursive:true});try{await fs.rename(target,backup);moved.push({target,backup})}catch(e){if(e.code!=='ENOENT')throw e}if(t.input){await fs.mkdir(path.dirname(target),{recursive:true});await fs.rename(t.input,target);installed.push(target)}}}catch(error){for(const p of installed.reverse())await fs.rm(p,{recursive:true,force:true});for(const t of moved.reverse())await fs.rename(t.backup,t.target);throw error}
      for(const p of plan.portals)await state('import',p.source,incoming.states[p.source])
      return {...result,format:'multisite-v1',revision:fingerprint(source),source_synced:true}
    }finally{await fs.rm(work,{recursive:true,force:true})}
  }
  async function build(site,selected,page,progress){
    const group=await current(site);if(!group)throw fail('Unknown grouped site.');await noLinks(await safePath(root,'site/sites/'+site));for(const p of group.portals)await noLinks(await safePath(root,'site/portals/'+p.source));
    const started=performance.now(),plan=await policy('prepare',site,{portal:selected||'',page:page||''})
    const output=await safePath(root,'data/.desk/site-builds/'+site+'/next');await fs.rm(output,{recursive:true,force:true});await fs.mkdir(output,{recursive:true})
    const leases=[],completed={};let stdout='',stderr='',success=false,result
    try{
      progress({phase:'building'})
      for(const job of plan.jobs){
        const source=job.source;let jobOutput
        if(page){if(!safe(page)||!page.endsWith('.md'))throw fail('Use a relative Markdown page path.');await fs.access(await safePath(path.join(root,'site/portals',source),'content/'+page));jobOutput=path.join(output,'p',job.id,'wiki');await fs.mkdir(jobOutput,{recursive:true})}
        const env={...process.env,SHERIFF_ROOT:root.replaceAll('\\','/'),SHERIFF_RUNTIME_MODE:'cloud',SHERIFF_SKIP_DESK_SYNC:'1',GOBLIN_NONINTERACTIVE:'0',...(page?{SHERIFF_BUILD_OUTPUT:jobOutput.replaceAll('\\','/'),SHERIFF_PAGE_TARGET:page}:{SHERIFF_BUILD_DEFER_ACTIVATION:'1',SHERIFF_BUILD_OWNER_PID:String(process.pid)})}
        try{const r=await run(goblin,['run',path.join(core,'main.gbln'),source,...(page?['page']:[])],{cwd:core,env,timeout:180000,maxBuffer:16*1024*1024,onStdout:chunk=>progress({phase:'building',stream:'stdout',chunk}),onStderr:chunk=>progress({phase:'building',stream:'stderr',chunk})});stdout+=r.stdout||'';stderr+=r.stderr||''}finally{if(!page){const lease=await buildJob(source);if(lease)leases.push({source,lease});if(lease?.state==='ready')completed[source]=lease.output.replaceAll('\\','/')}}
        if(!page&&!completed[source])throw fail('Portal build did not complete: '+job.id)
      }
      if(!page)await policy('assemble',site,{portal:selected||'',output:output.replaceAll('\\','/'),completed})
      await noLinks(output)
      const build={ok:true,code:0,stdout,stderr,build_ms:performance.now()-started}
      progress({phase:'built',...build})
      result=await publish(build,site,page?'page':selected?'portal':'full',progress,output,selected||'')
      success=result.published===true
      if(success){const active=await safePath(root,'dist/'+site);if(!selected)await fs.rm(active,{recursive:true,force:true});else if(!page)await fs.rm(await safePath(active,'p/'+selected+'/wiki'),{recursive:true,force:true});await fs.mkdir(active,{recursive:true});await fs.cp(output,active,{recursive:true})}
      return result
    }catch(error){return {ok:false,code:1,published:false,build_ms:performance.now()-started,stdout:stdout+(error.stdout||''),stderr:stderr+(error.stderr||error.message)}}
    finally{for(const {source,lease} of leases)await lifecycle(source,success?'activate':'abort',lease.id).catch(()=>{});if(success)await fs.rm(output,{recursive:true,force:true})}
  }
  return {catalog,current,transfer,build,policy}
}
