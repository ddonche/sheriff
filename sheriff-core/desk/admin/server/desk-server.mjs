// Authenticated backend for the shared Sheriff Desk. No browser receives R2 credentials.
import {createMultisiteBridge} from './desk-multisite.mjs'
import {createDeskSync} from './desk-sync.mjs'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {spawn} from 'node:child_process'
import {StringDecoder} from 'node:string_decoder'

// Deliver process output as it arrives while retaining the final API result.
export function runCommand(command,args,options={}) {
  const {onStdout=()=>{},onStderr=()=>{},timeout=180000,maxBuffer=16*1024*1024,...settings}=options
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{...settings,windowsHide:true,stdio:['ignore','pipe','pipe']})
    const decoders=[new StringDecoder('utf8'),new StringDecoder('utf8')],output=['',''];let bytes=0,failure=null
    let completed=null,teardown;
    const script=args[0]==='run'&&path.basename(args[1]||'')==='main.gbln'?args[1]:null;
    const footer=script?new RegExp('^goblin run '+script.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' → exit (\\d+) in \\d+ms \\([\\d.]+s\\)\\r?$','m'):null;
    const timer=setTimeout(()=>{failure=Error('Process timed out.');child.kill()},timeout);timer.unref()
    function append(i,text){if(!text)return;output[i]+=text;(i===0?onStdout:onStderr)(text);if(i===1&&footer&&completed===null){const match=output[1].match(footer);if(match){completed=Number(match[1]);teardown=setTimeout(()=>{if(child.exitCode===null)child.kill()},300);teardown.unref();}}}
    for(const [i,stream] of [child.stdout,child.stderr].entries())stream.on('data',chunk=>{bytes+=chunk.length;if(bytes>maxBuffer){failure=Error('Process output exceeded the limit.');child.kill();return}append(i,decoders[i].write(chunk))})
    child.on('error',error=>{failure=error})
    child.on('close',(code,signal)=>{clearTimeout(timer);clearTimeout(teardown);if(completed!==null)code=completed;decoders.forEach((decoder,i)=>append(i,decoder.end()));const result={stdout:output[0],stderr:output[1]};if(failure||code!==0)reject(Object.assign(failure||Error('Process exited unsuccessfully.'),result,{code:code??1,signal}));else resolve(result)})
  })
}
const operations = new Set(['sites.list','sites.create','sites.add','sites.logo','sites.delete','portals.create','portals.rename','portals.delete','sites.config_read','sites.config_write','sites.theme','sites.build','howdy.settings','howdy.access.manage','howdy.access.policy','howdy.access.page','howdy.access.grant','howdy.access.revoke','howdy.access.lock','content.read','content.library','content.save','modules.inspect','modules.patch','modules.panel','modules.action','frontmatter.inspect','frontmatter.patch','sync.inspect','sync.download','sync.deploy','files.list','files.read','files.write','files.upload','files.move','files.delete','files.mkdir','themes.list','themes.ensure','themes.config','layouts.list','icons.list','patterns.list','seed.load','seed.example','seed.save','seed.preview','seed.create','changes.status','changes.begin','changes.finish','changes.touch','changes.publish','page.build','portal.init','portal.build','portal.publish','snapshots.list','snapshots.create','snapshots.download','snapshots.restore','snapshots.delete'])
const publicTypes={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.avif':'image/avif','.ico':'image/x-icon','.mp4':'video/mp4','.webm':'video/webm','.mp3':'audio/mpeg','.ogg':'audio/ogg'}
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
function unwrap(value) {
  for(let n=0;n<8;n++) {
    if(typeof value==='string'){try{value=JSON.parse(value);continue}catch{break}}
    if(value && typeof value.body==='string' && typeof value.status==='number'){value=value.body;continue}
    break
  }
  return value
}
async function body(req,limit=50*1024*1024) {
  const chunks=[];let size=0
  for await(const chunk of req){size+=chunk.length;if(size>limit)throw fail('Upload is too large.',413);chunks.push(chunk)}
  return Buffer.concat(chunks)
}
function relative(value) {
  if(typeof value!=='string'||!value||value.startsWith('/')||value.includes('..')||!/^[-\p{L}\p{N}_./ ]+$/u.test(value)||value.split('/').some(p=>!p||p==='.'||p.startsWith('.')))throw fail('Invalid portal file path.')
  if(!/^(content|blog|public|patterns|themes)\//.test(value)&&!['config.yall','nav.yall','assets.yall','widgets.yall'].includes(value))throw fail('Path is outside managed portal files.')
  return value
}
async function safePath(base,rel='') {
  const resolved=path.resolve(base,rel)
  if(resolved!==base&&!resolved.startsWith(base+path.sep))throw fail('Path escapes its portal.')
  let part=base
  for(const name of ['',...rel.split('/').filter(Boolean)]) {
    if(name)part=path.join(part,name)
    try{if((await fs.lstat(part)).isSymbolicLink())throw fail('Linked portal paths are not supported.')}catch(error){if(error.code!=='ENOENT')throw error}
  }
  return resolved
}
async function noLinks(base) {
  await safePath(base)
  for(const entry of await fs.readdir(base,{withFileTypes:true})) {
    if(entry.isSymbolicLink())throw fail('Linked portal paths are not supported.')
    if(entry.isDirectory())await noLinks(path.join(base,entry.name))
  }
}
function send(res,status,data) {res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
export function createDeskHandler({root='/app',getUser,ownsSite,siteAccount,getSite,resolveAccount,accountProfiles,run=runCommand,goblin=path.join(root,'goblin'),secureCookies=true}) {
  root=path.resolve(root)
  const queues=new Map()
  async function serial(portal,work) {
    const previous=queues.get(portal)||Promise.resolve(),current=previous.catch(()=>{}).then(work)
    queues.set(portal,current)
    try{return await current}finally{if(queues.get(portal)===current)queues.delete(portal)}
  }
  async function invoke(endpoint,query,payload,cloudApi=false,trusted={}) {
    const temp=await fs.mkdtemp(path.join(os.tmpdir(),'sheriff-desk-body-'))
    try{
      const requestFile=path.join(temp,'body');await fs.writeFile(requestFile,payload)
      const script=endpoint==='sites_logo'?path.join(root,'sheriff-core/desk/admin/requests/site_logo_request.gbln'):endpoint==='changes'?path.join(root,'sheriff-core/desk/admin/requests/changes_request.gbln'):endpoint==='desk_modules_request'?path.join(root,'sheriff-core/desk/admin/requests/desk_modules_request.gbln'):endpoint==='howdy_access_request'?path.join(root,'sheriff-core/desk/admin/requests/howdy_access_request.gbln'):endpoint==='howdy_request'?path.join(root,'sheriff-core/desk/admin/requests/howdy_request.gbln'):endpoint==='site_cloud_request'?path.join(root,'sheriff-core/desk/admin/requests/site_cloud_request.gbln'):endpoint==='cloud_state'?path.join(root,'sheriff-core/desk/admin/requests/cloud_state.gbln'):cloudApi?path.join(root,'dist/admin/api',endpoint+'.gbln'):path.join(root,'sheriff-core/desk/api',endpoint+'.gbln')
      const started=performance.now()
      const result=await run(goblin,['run',script],{cwd:path.join(root,'sheriff-core'),env:{...process.env,SHERIFF_ROOT:root.replaceAll('\\','/'),SHERIFF_RUNTIME_MODE:'cloud',SHERIFF_ACCESS_OWNER:trusted.owner?'1':'0',SHERIFF_ACCESS_SUBJECT:trusted.subject||'',GOBLIN_QUERY_STRING:query,GOBLIN_METHOD:'POST',GOBLIN_BODY:'',GOBLIN_REQUEST_FILE:requestFile},timeout:180000,maxBuffer:16*1024*1024})
      const parsed=unwrap(result.stdout.trim())
      if(!parsed||typeof parsed!=='object')throw fail('The build runtime returned an unreadable response.',502)
      if(endpoint==='build') {
        const footer=String(parsed.stderr||'').match(/goblin run .+ → exit \d+ in (\d+)ms \([\d.]+s\)/)
        parsed.build_ms=footer?Number(footer[1]):performance.now()-started
      }
      return parsed
    }finally{await fs.rm(temp,{recursive:true,force:true})}
  }
  async function lifecycle(portal,phase,id) {
    const windows=process.platform==='win32'
    const command=windows?'powershell.exe':'python3'
    const args=windows?['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File','build-support/lifecycle.ps1']:['build-support/lifecycle.py']
    const result=await run(command,args,{cwd:path.join(root,'sheriff-core'),env:{...process.env,SHERIFF_BUILD_PORTAL:portal,SHERIFF_BUILD_PHASE:phase,SHERIFF_BUILD_ID:id},timeout:30000,maxBuffer:1024*1024})
    return JSON.parse(result.stdout)
  }
  async function buildJob(portal) {
    const directory=await safePath(root,'data/.desk/builds/'+portal)
    try {
      const job=JSON.parse(await fs.readFile(path.join(directory,'lease/job.json'),'utf8'))
      if(job.portal!==portal||!/^[a-f0-9]{32}$/.test(job.id)||String(job.owner?.pid)!==String(process.pid))throw fail('Build ownership changed.')
      return job
    }catch(error){if(error.code==='ENOENT')return null;throw error}
  }
  async function publish(build,portal,mode='full',progress=()=>{},output=null,scope='') {
    build={...build,build_code:build.code,build_stdout:build.stdout||'',build_stderr:build.stderr||''}
    if(build.ok===false||build.code!==0)return build
    progress({phase:'uploading',...build})
    const started=performance.now()
    try{
      const uploaded=await run('sh',[path.join(root,'sync_portal.sh'),portal,...(mode!=='full'?[mode]:[])],{cwd:root,env:{...process.env,...(output?{SHERIFF_PUBLISH_OUTPUT:output,SHERIFF_KEEP_BUILD_OUTPUT:'1'}:{}),SHERIFF_PUBLISH_PORTAL:scope},timeout:300000,maxBuffer:16*1024*1024,onStdout:chunk=>progress({phase:'uploading',stream:'stdout',chunk}),onStderr:chunk=>progress({phase:'uploading',stream:'stderr',chunk})})
      return {...build,ok:true,published:true,upload_ms:performance.now()-started,upload_stdout:uploaded.stdout||'',upload_stderr:uploaded.stderr||'',stdout:(build.stdout||'')+'\n'+uploaded.stdout,stderr:[build.stderr,uploaded.stderr].filter(Boolean).join('\n')}
    }catch(error){
      const message='Publishing failed. Your source is saved; retry the build.\n'+(error.stderr||error.message||'R2 upload failed.')
      return {...build,ok:false,published:false,code:typeof error.code==='number'?error.code:1,upload_ms:performance.now()-started,upload_stdout:error.stdout||'',upload_stderr:message,stdout:(build.stdout||'')+'\n'+(error.stdout||''),stderr:[build.stderr,message].filter(Boolean).join('\n')}
    }
  }
  async function buildPortal(portal,progress,saved=false) {
    progress({phase:'building'})
    const started=performance.now();let build
    const settings={cwd:path.join(root,'sheriff-core'),env:{...process.env,SHERIFF_ROOT:root.replaceAll('\\','/'),SHERIFF_RUNTIME_MODE:'cloud',GOBLIN_NONINTERACTIVE:'0',SHERIFF_BUILD_DEFER_ACTIVATION:'1',SHERIFF_BUILD_OWNER_PID:String(process.pid)},timeout:180000,maxBuffer:16*1024*1024,onStdout:chunk=>progress({phase:'building',stream:'stdout',chunk}),onStderr:chunk=>progress({phase:'building',stream:'stderr',chunk})}
    try{const result=await run(goblin,['run',path.join(root,'sheriff-core/main.gbln'),portal],settings);build={ok:true,code:0,...result}}
    catch(error){build={ok:false,code:typeof error.code==='number'?error.code:1,stdout:error.stdout||'',stderr:error.stderr||error.message}}
    const footer=String(build.stderr||'').match(/goblin run .+ → exit \d+ in (\d+)ms/)
    build.build_ms=footer?Number(footer[1]):performance.now()-started
    const job=await buildJob(portal)
    if(build.ok===false) {
      if(job)await lifecycle(portal,'abort',job.id)
      return publish({...build,...(saved?{saved:true}:{})},portal,'full',progress)
    }
    if(!job||job.state!=='ready')throw fail('Build did not produce a completed output directory.',502)
    const output=await safePath(root,'data/.desk/builds/'+portal+'/next')
    if(path.resolve(job.output)!==output)throw fail('Unexpected build output directory.')
    await noLinks(output)
    const result=await publish({...build,...(saved?{saved:true}:{})},portal,'full',progress,output)
    try { await lifecycle(portal,result.published?'activate':'upload-failed',job.id) }
    catch(error) {
      await lifecycle(portal,'upload-failed',job.id).catch(()=>{})
      result.stderr+=(result.stderr?'\n':'')+'Local build retention: '+error.message
    }
    return result
  }
  async function savePage(portal,portalRoot,source,payload,progress) {
    const destination=await safePath(portalRoot,source)
    if(payload!==null){await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,payload)}
    else await fs.access(destination)
    const output=await safePath(root,'data/.desk/page-builds/'+portal+'/next')
    await fs.rm(output,{recursive:true,force:true});await fs.mkdir(output,{recursive:true})
    let published=false
    try {
      let build
      progress({phase:'building'})
      const started=performance.now()
      try {
        const result=await run(goblin,['run',path.join(root,'sheriff-core/main.gbln'),portal,'page',source.slice('content/'.length)],{cwd:path.join(root,'sheriff-core'),env:{...process.env,SHERIFF_ROOT:root.replaceAll('\\','/'),SHERIFF_RUNTIME_MODE:'cloud',GOBLIN_NONINTERACTIVE:'0',SHERIFF_BUILD_OUTPUT:output.replaceAll('\\','/')},timeout:180000,maxBuffer:16*1024*1024,onStdout:chunk=>progress({phase:'building',stream:'stdout',chunk}),onStderr:chunk=>progress({phase:'building',stream:'stderr',chunk})})
        build={ok:true,saved:true,code:0,build_ms:performance.now()-started,stdout:result.stdout,stderr:result.stderr}
      }catch(error){return {ok:false,saved:true,published:false,build_ms:performance.now()-started,code:typeof error.code==='number'?error.code:1,stdout:error.stdout||'',stderr:error.stderr||error.message||'Page build failed.'}}
      await noLinks(output)
      const result=await publish(build,portal,'page',progress,output)
      published=result.published
      if(published) {
        const active=await safePath(path.join(root,'dist'),portal)
        try {await fs.access(path.join(root,'data/.desk/builds',portal,'current.json'));await fs.cp(output,active,{recursive:true})}catch(error){if(error.code!=='ENOENT')throw error}
      }
      return result
    }finally{
      if(published)await fs.rm(output,{recursive:true,force:true})
    }
  }
  async function access(verb,portal,payload,user,owner) {
    const result=await invoke('howdy_access_request',verb+'&'+new URLSearchParams({portal}),Buffer.from(JSON.stringify(payload||{})),false,{subject:user.id,owner});
    if(result.ok===false){const error=fail(result.stderr||'Editing is unavailable.',result.error==='conflict'?409:result.error==='not_found'?404:403);error.accessCode=result.error;throw error;}
    return result;
  }
  const state=async(mode,portal,payload)=>{const result=await invoke('cloud_state',new URLSearchParams({mode,portal}).toString(),Buffer.from(JSON.stringify(payload||{})));if(result.ok===false)throw fail(result.stderr||'Build metadata could not be transferred.');return result.state||result};
  const sync=createDeskSync({root,publish,state});
  const multi=createMultisiteBridge({root,goblin,run,invoke,publish,buildJob,lifecycle,safePath,noLinks,state});
  return async function handle(req,res) {
    const url=new URL(req.url,'http://desk.internal')
    if(!url.pathname.startsWith('/api/desk/'))return false
    const syncRequest=url.pathname.startsWith("/api/desk/sync.")
    const accessRequest=url.pathname.startsWith('/api/desk/howdy.access.');
    const contentRequest=url.pathname.startsWith('/api/desk/content.');
    if(contentRequest&&req.headers.origin){
      const origin=req.headers.origin,site=url.searchParams.get('site')||url.searchParams.get('portal'),record=await Promise.resolve().then(()=>getSite&&getSite(site)).catch(()=>null);
      let allowed=false;try{const u=new URL(origin);allowed=u.origin===origin&&((u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))||(u.protocol==='https:'&&record&&[record.subdomain+'.sheriffcloud.com',record.subdomain+'.spur.ink',...(record.custom_domain_status==='active'?[record.custom_domain]:[])].includes(u.host)));}catch{}
      if(!allowed){send(res,403,{ok:false,stderr:'This origin is not part of the selected site.'});return true;}
      res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, Accept');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
      if(req.method==='OPTIONS'){res.writeHead(204);res.end();return true;}
    }
    if(syncRequest||accessRequest){
      const origin=req.headers.origin||""
      if(origin){let allowed=false;try{const u=new URL(origin);allowed=u.origin===origin&&((u.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(u.hostname))||(accessRequest&&["https://admin.sheriffcloud.com","https://sheriffcloud.com","https://spur.ink"].includes(origin)))}catch{}
        if(!allowed){send(res,403,{ok:false,stderr:"Open Cloud Sync from local Desk."});return true}
        res.setHeader("Access-Control-Allow-Origin",origin);res.setHeader("Vary","Origin");res.setHeader("Access-Control-Allow-Headers","Authorization, Content-Type, Accept");res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS")
      }
      if(req.method==="OPTIONS"){res.writeHead(204);res.end();return true}
    }
    let progress=()=>{}
    try{
      const op=url.pathname.slice('/api/desk/'.length)
      if(op==='session'&&req.method==='DELETE'){res.setHeader('Set-Cookie','sheriff_desk_preview=; HttpOnly; SameSite=Strict; Path=/api/desk/asset; Max-Age=0'+(secureCookies?'; Secure':''));send(res,200,{ok:true});return true}
      let auth=req.headers.authorization
      if(op==='asset'&&!auth){const match=String(req.headers.cookie||'').match(/(?:^|;\s*)sheriff_desk_preview=([^;]+)/);if(match)auth='Bearer '+decodeURIComponent(match[1])}
      if(!/^Bearer [^\s]+$/.test(auth||''))throw fail('Sign in to Sheriff Cloud.',401)
      const user=await getUser(auth)
      if(!user)throw fail('Your Cloud session has expired. Sign in again.',401)
      {let claims={};try{claims=JSON.parse(Buffer.from(auth.split('.')[1]||'', 'base64url').toString())}catch{}if(claims.client_id&&(!contentRequest||claims.client_id!=='ee0767ae-d4e4-4c7e-88a6-4c5a3152b6ea'))throw fail('Use the internal Desk sign-in for this operation.',403)}
      if(op==='session') {
        if(req.method!=='POST')throw fail('Use POST for a Desk session.',405)
        res.setHeader('Set-Cookie','sheriff_desk_preview='+encodeURIComponent(auth.slice(7))+'; HttpOnly; SameSite=Strict; Path=/api/desk/asset; Max-Age=120'+(secureCookies?'; Secure':''))
        send(res,200,{ok:true});return true
      }
      if(op!=='asset'&&!operations.has(op))throw fail('Unknown Desk operation.',404)
      if(req.method!==(op==='asset'?'GET':'POST'))throw fail('Incorrect Desk request method.',405)
      if(op==='sites.list') {
        const payload=JSON.parse((await body(req,65536)).toString()||'{}');
        if(!Array.isArray(payload.ids)||payload.ids.length>20000)throw fail('Invalid site list.');
        const accountSites=siteAccount?await siteAccount(user,'list',{},auth):null;
        const ids=[];for(const candidate of [...new Set(accountSites?accountSites.map(s=>s.subdomain):payload.ids)]){if(!/^[a-z0-9][a-z0-9_-]*$/.test(candidate||''))throw fail('Invalid site name.');if(await ownsSite(user,candidate))ids.push(candidate);}
        await safePath(root,'site/sites');await safePath(root,'site/portals');
        send(res,200,{ok:true,sites:await multi.catalog(ids),...(accountSites?{accountSites}:{})});return true;
      }
      const requested=url.searchParams.get('portal')||'';
      const siteId=url.searchParams.get('site')||requested;
      const siteOperation=op.startsWith('sites.');
      if(!/^[a-z0-9][a-z0-9_-]*$/.test(siteId))throw fail('Invalid site name.');
      if(op==='portals.create'||op==='sites.create'){
        if(!siteAccount)throw fail('Cloud account operations are unavailable.',503);
        if(!/^[a-z0-9][a-z0-9-]{1,61}$/.test(siteId)||['admin','api','public','data'].includes(siteId))throw fail('Choose a valid Cloud address.');
        if(await safePath(root,'site/portals/'+siteId).then(p=>fs.stat(p).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e})))throw fail('That portal source already exists.');
        const payload=await body(req);let value={};if(op==='sites.create'){try{value=JSON.parse(payload)}catch{throw fail('Invalid site request.')}if(value.id!==siteId)throw fail('Site address does not match.');}
        const theme=value.theme||url.searchParams.get('theme')||'outpost',name=value.name||url.searchParams.get('brand')||siteId;
        if(!/^[a-z][a-z0-9-]*$/.test(theme)||!await fs.stat(path.join(root,'sheriff-core/themes',theme)).then(p=>p.isDirectory(),()=>false))throw fail('Choose an installed theme.');
        if(typeof name!=='string'||!name.trim()||name.length>160||/[\r\n]/.test(name))throw fail('Enter a site name.');
        const data=await serial(siteId,async()=>{
          const created=await siteAccount(user,'create',{portal:siteId,name:value.name||url.searchParams.get('brand')||siteId},auth);
          try{
            const result=op==='sites.create'?await invoke('site_cloud_request','create&'+new URLSearchParams({site:siteId}),Buffer.from(JSON.stringify({...value,mode:'operation',site:siteId}))):await invoke('portal','create&'+siteId+'&'+(url.searchParams.get('theme')||'outpost')+'&'+encodeURIComponent(url.searchParams.get('brand')||siteId),Buffer.alloc(0));
            if(result.ok===false)throw fail(result.stderr||'Portal creation failed.');return result;
          }catch(error){if(op==='portals.create')await fs.rm(await safePath(root,'site/portals/'+siteId),{recursive:true,force:true});await siteAccount(user,'undo_create',{id:created.id,portal:siteId},auth);throw error;}
        });
        send(res,200,{...data,accountSites:await siteAccount(user,'list',{},auth).catch(()=>undefined)});return true;
      }
      const owned=await ownsSite(user,siteId);
      const parent=owned||(contentRequest&&getSite?await getSite(siteId):null);
      if(!parent)throw fail('You do not have access to this Sheriff site.',403);
      await safePath(root,'site/sites/'+siteId);await safePath(root,'site/portals');
      const group=await multi.current(siteId);
      const member=group?.portals.find(p=>p.source===requested||(siteOperation||contentRequest)&&p.id===requested);
      if(group&&!siteOperation&&!op.startsWith('sync.')&&!member&&!(op==='asset'&&url.searchParams.get('scope')==='site'))throw fail('Select a portal in this site.');
      if(!group&&requested&&requested!==siteId)throw fail('Portal is not part of this site.',403);
      const portal=member?.source||siteId;
      if(!/^[a-z0-9][a-z0-9_-]*$/.test(portal))throw fail('Invalid portal name.')
      const site=parent;
      const portalsBase=path.join(root,'site/portals');await safePath(path.join(root,'site'),'portals');const portalRoot=await safePath(portalsBase,portal)
      const params=Object.fromEntries(url.searchParams)
      for(const key of ['path','from','to'])if(params[key])await safePath(portalRoot,relative(params[key]))
      if(['themes.ensure','layouts.list'].includes(op)||op==='themes.config'&&params.theme) {
        if(!/^[a-z][a-z0-9-]*$/.test(params.theme||''))throw fail('Invalid theme.')
        await safePath(path.join(root,'sheriff-core/themes'),params.theme)
      }
      if(op==='asset') {
        const rel=relative(params.path),type=publicTypes[path.extname(rel).toLowerCase()]
        if(!rel.startsWith('public/')||!type)throw fail('Only portal media can be previewed.',403)
        const file=await safePath(group&&params.scope==='site'?path.join(root,'site/sites',siteId):portalRoot,rel),bytes=await fs.readFile(file)
        res.writeHead(200,{'Content-Type':type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"});res.end(bytes);return true
      }
      let payload=await body(req,syncRequest?70*1024*1024:50*1024*1024)
      const building=op==='content.save'||op==='sites.build'||op==='sync.deploy'||op==='portal.build'||op==='portal.publish'||op==='page.build'||(op==='files.write'&&['page','portal'].includes(params.build))
      if(building&&String(req.headers.accept||'').includes('application/x-ndjson')) {
        res.writeHead(200,{'Content-Type':'application/x-ndjson','Cache-Control':'no-store','X-Accel-Buffering':'no'})
        progress=data=>{if(!res.destroyed)res.write(JSON.stringify(data)+'\n')}
        progress({phase:'queued'})
      }
      const data=await serial(siteId,async()=>{
        // Recheck ownership after waiting, then let Goblin decide page access.
        const stillOwned=await ownsSite(user,siteId);
        if(!stillOwned&&!contentRequest)throw fail('Your site access has changed.',403);
        if(op.startsWith('howdy.access.')){
          let value;try{value=JSON.parse(payload.toString()||'{}')}catch{throw fail('Invalid access request.');}
          const verb=op.slice(13);
          if(verb==='grant'){
            if(!resolveAccount||typeof value.username!=='string'||!value.username.trim()||value.username.length>80)throw fail('Enter an existing Sheriff username.');
            const account=await resolveAccount(value.username.trim());if(!account)throw fail('That Sheriff username was not found.',404);
            value={subject:account.id,label:account.username};
          }
          const result=await access(verb,portal,value,user,!!stillOwned);
          if(result.editors&&accountProfiles){
            const profiles=await accountProfiles(Object.keys(result.editors));
            const labels=new Map(profiles.map(account=>[account.id,account.username]));
            result.editors=Object.fromEntries(Object.keys(result.editors).map(id=>[id,labels.get(id)||'Unavailable account ('+id.slice(0,8)+')']));
          }
          return result;
        }
        if(contentRequest){
          let value;try{value=JSON.parse(payload.toString()||'{}')}catch{throw fail('Invalid content request.');}
          await safePath(portalRoot,relative(value.path));
          if(!value.path.startsWith('content/')||!value.path.endsWith('.md'))throw fail('Select a Markdown content page.');
          if(op==='content.read')return access('read',portal,value,user,!!stillOwned);
          if(op==='content.library'){await noLinks(portalRoot);return access('library',portal,value,user,!!stillOwned);}
          const prepared=await access('prepare',portal,value,user,!!stillOwned);
          const ticket=await invoke('changes','begin&'+new URLSearchParams({portal}),Buffer.from(JSON.stringify({mode:'page',path:value.path,text:prepared.content})));
          if(ticket.ok===false)throw fail(ticket.stderr||'Could not track this page build.',503);
          let result,built;
          try{
            result=await access('save',portal,value,user,!!stillOwned);
            // A contributor can request only this page's schedule and publication.
            built=group?await multi.build(siteId,member.id,value.path.slice(8),progress):await savePage(portal,portalRoot,value.path,null,progress);

          }catch(error){
            if(!result?.saved)throw error;
            built={ok:false,saved:true,published:false,stderr:error.message||'Source saved, but the page could not be built or published.'};
          }finally{
            const recorded=await invoke('changes','finish&'+new URLSearchParams({portal}),Buffer.from(JSON.stringify({id:ticket.id,success:built?.ok!==false&&built?.published===true,build_success:built?.build_code===0,published:built?.published===true,build_ms:built?.build_ms,upload_ms:built?.upload_ms}))).catch(()=>null);
            if(built&&recorded?.ok!==true)built.history_warning='The page build completed, but its status could not be recorded.';
          }
          return {...built,saved:true,base:result.base};
        }
        let checkedSave=null;
        if(op==='files.write'&&params.checked==='1'){
          try{checkedSave=JSON.parse(payload.toString());}catch{throw fail('Invalid checked save.');}
          if(typeof checkedSave.content!=='string')throw fail('Missing source text.');
          await safePath(portalRoot,relative(checkedSave.base_path));
        }
        const paths=op==='files.move'?[params.from,params.to]:['files.write','files.delete'].includes(op)?[params.path]:[];
        if(paths.length||op==='snapshots.restore'||op==='sync.deploy'){
          const members=op==='sync.deploy'&&group?group.portals.map(p=>p.source):[portal];
          for(const source of members)await access('guard',source,{...(checkedSave||{}),path:params.path,paths:[...paths,...(checkedSave?[checkedSave.base_path]:[])],checked:!!checkedSave,replace_source:op==='snapshots.restore'||op==='sync.deploy'},user,true);
          if(checkedSave){payload=Buffer.from(checkedSave.content);delete params.checked;}
        }
        if(op==='portals.rename'||op==='portals.delete'||op==='sites.delete'){
          if(!siteAccount)throw fail('Cloud account operations are unavailable.',503);
          if(group&&op!=='sites.delete')throw fail('Manage member portals inside their site.');
          const target=params.target||'';
          if(op==='portals.rename'){if(!/^[a-z0-9][a-z0-9-]{1,61}$/.test(target)||['admin','api','public','data'].includes(target))throw fail('Choose a valid Cloud address.');await siteAccount(user,'check_rename',{portal:siteId,target},auth);}
          const rels=['site/portals/'+portal,'dist/'+siteId,'site/.desk/changes/'+portal,'data/.desk/changes/'+portal,'site/.desk/howdy/'+portal,'data/.desk/howdy/'+portal];
          if(group){rels.push('site/sites/'+siteId);for(const p of group.portals)rels.push('site/portals/'+p.source,'site/.desk/changes/'+p.source,'site/.desk/howdy/'+p.source);}
          if(target){for(const rel of ['site/portals/'+target,'dist/'+target,'site/sites/'+target,'site/.desk/howdy/'+target,'data/.desk/howdy/'+target]){try{await fs.access(await safePath(root,rel));throw fail('That target source or output already exists.')}catch(e){if(e.code!=='ENOENT')throw e;}}}
          const backup=await fs.mkdtemp(path.join(await fs.mkdir(path.join(root,'site/.desk/lifecycle'),{recursive:true}).then(()=>path.join(root,'site/.desk/lifecycle')),'operation-')),copies=[];
          try{
            for(const rel of [...new Set(rels)]){const file=await safePath(root,rel);try{await noLinks(file);await fs.mkdir(path.dirname(path.join(backup,rel)),{recursive:true});await fs.cp(file,path.join(backup,rel),{recursive:true});copies.push(rel)}catch(e){if(e.code!=='ENOENT')throw e;}}
            let result;
            if(op==='sites.delete'){let value;try{value=JSON.parse(payload)}catch{throw fail('Invalid site request.')}result=await invoke('site_cloud_request','delete&site='+siteId,Buffer.from(JSON.stringify({...value,id:siteId,mode:'operation',site:siteId})));}
            else result=await invoke('portal',op.slice(8)+'&'+portal+(target?'&'+target:''),Buffer.alloc(0));
            if(result.ok===false)throw fail(result.stderr||'Portal operation failed.');
            for(const source of group?group.portals.map(p=>p.source):[portal])for(const base of ['site/.desk/howdy','data/.desk/howdy']){
            const policy=await safePath(root,base+'/'+source);
            try{if(target)await fs.rename(policy,await safePath(root,base+'/'+target));else await fs.rm(policy,{recursive:true,force:true});}catch(error){if(error.code!=='ENOENT')throw error;}
          }
          await siteAccount(user,target?'rename':'delete',{portal:siteId,target},auth);
            return {...result,accountSites:await siteAccount(user,'list',{},auth).catch(()=>undefined)};
          }catch(error){
            for(const rel of copies){const file=await safePath(root,rel);await fs.rm(file,{recursive:true,force:true});await fs.mkdir(path.dirname(file),{recursive:true});await fs.cp(path.join(backup,rel),file,{recursive:true});}
            if(target){for(const rel of ['site/portals/'+target,'site/.desk/changes/'+target,'data/.desk/changes/'+target,'site/.desk/howdy/'+target,'data/.desk/howdy/'+target])await fs.rm(await safePath(root,rel),{recursive:true,force:true});}throw error;
          }finally{await fs.rm(backup,{recursive:true,force:true});}
        }
        if(siteOperation){
          if(!group)throw fail('This site does not have grouped portals.');
          if(op==='sites.build'){if(requested&&!member)throw fail('Unknown portal.');return multi.build(siteId,member?.id||'',params.path||'',progress);}
          if(op==='sites.logo')return invoke('sites_logo','logo&'+new URLSearchParams({site:siteId,extension:params.extension||''}),payload);
          let value={};if(payload.length){try{value=JSON.parse(payload.toString())}catch{throw fail('Invalid site request.')}}
          if(op==='sites.theme')value.id=siteId;
          if(op==='sites.add'&&value.id!==siteId)throw fail('Site address does not match.');
          const query=op.slice(6)+'&'+new URLSearchParams({site:siteId});
          return invoke('site_cloud_request',query,Buffer.from(JSON.stringify({...value,mode:'operation',site:siteId})));
        }
        if(group&&(op==='portal.build'||op==='portal.publish'||op==='page.build'||op==='files.write'&&['page','portal'].includes(params.build))){
          const page=op==='page.build'||params.build==='page';
          if(page&&(!params.path?.startsWith('content/')||!params.path.endsWith('.md')))throw fail('Page build requires a Markdown content page.');
          if(op==='files.write'){const file=await safePath(portalRoot,relative(params.path));await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,payload);}
          return {...await multi.build(siteId,member.id,page?params.path.slice(8):'',progress),saved:op==='files.write'};
        }
        if(op==='files.list') {
          try{await fs.access(portalRoot)}catch(error){if(error.code!=='ENOENT')throw error;const initialized=await invoke('portal','create&'+portal+'&outpost&'+portal,Buffer.alloc(0));if(initialized.ok===false)throw fail(initialized.stderr||'Portal could not be initialized.',500)}
        }
        // Saving a document is a direct file write, with no runtime or build invocation.
        if(op==='files.write'&&(params.build||'none')==='none') {
          const p=relative(params.path);
          if(!/^(?:config|nav|assets|widgets)\.yall$|^content\/.+\.(?:md|html)$|^(?:blog|public)\/.+|^patterns\/.+\.txt$|^themes\/.+\/(?:override\.css|templates\.yall)$/.test(p))throw fail('File is not editable.');
          const destination=await safePath(portalRoot,p);
          await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,payload);
          return {ok:true,saved:true,published:false,code:0,stdout:'',stderr:''};
        }
        // Shared helpers walk entire portal trees. Reject links before either reads or builds.
        try{await noLinks(portalRoot)}catch(error){if(error.code!=='ENOENT')throw error}
        if(op.startsWith('sync.')){const grouped=await multi.transfer(op,siteId,payload,progress);const value=grouped||await sync(op,portal,payload,progress);if(op==='sync.deploy'&&value.published){const incoming=JSON.parse(payload.toString());try{const members=grouped?(await multi.current(siteId)).portals.map(p=>p.source):[portal];for(const source of members){const recorded=await invoke('changes','publish&'+new URLSearchParams({portal:source}),Buffer.from(JSON.stringify({adopt:true,build_ms:incoming.build_ms,upload_ms:value.upload_ms})));if(recorded.ok===false)value.history_warning=recorded.stderr;}}catch{value.history_warning='Published successfully; build history could not be saved.';}}return value}
        if(op==='portal.init') {try{await fs.access(portalRoot);return {ok:true,already_exists:true}}catch(error){if(error.code!=='ENOENT')throw error;return invoke('portal','create&'+portal+'&outpost&'+portal,Buffer.alloc(0))}}
        if(op==='portal.build'||op==='portal.publish') return buildPortal(portal,progress)
        if(op.startsWith('changes.'))return invoke('changes',op.slice(8)+'&'+new URLSearchParams({portal}),payload)
        if(op==='page.build') {
          const p=params.path||''
          if(!p.startsWith('content/')||!p.endsWith('.md'))throw fail('Page build requires a Markdown content page.')
          return {...await savePage(portal,portalRoot,p,null,progress),saved:false}
        }
        if(op.startsWith('files.')) {
          const verb=op.slice(6),p=params.path||''
          if(verb!=='list'&&!p&&verb!=='move')throw fail('Missing file path.')
          if(verb==='move'&&(!params.from||!params.to))throw fail('Missing move paths.')
          const build=params.build||'none'
          if(verb==='write'&&!['none','page','portal'].includes(build))throw fail('Invalid build mode.')
          if(verb==='write'&&build==='page'){
            if(!p.startsWith('content/')||!p.endsWith('.md'))throw fail('Page build requires a Markdown content page.')
            return savePage(portal,portalRoot,p,payload,progress)
          }
          const positional=[portal,verb==='move'?params.from:p,params.to].filter(Boolean).map(encodeURIComponent).join('&')
          const query=verb+'&'+(['read','write'].includes(verb)?'portal='+encodeURIComponent(portal)+'&path='+encodeURIComponent(p):verb==='list'?portal:positional)+(params.no_overwrite==='1'?'&no_overwrite=1':'')+(verb==='write'?'&build=none':'')
          const result=await invoke('file',query,payload)
          if(verb==='write'&&build==='portal'&&result.ok!==false)return buildPortal(portal,progress,true)
          if(verb==='write')return {...result,saved:result.ok!==false,published:false}
          return result
        }
        if(op==='howdy.settings')return invoke('howdy_request','settings',payload);
        if(op.startsWith('modules.'))return invoke('desk_modules_request',op.slice(8)+'&'+new URLSearchParams({portal}),payload,false,{owner:true,subject:user.id});
        if(op.startsWith('frontmatter.'))return invoke('frontmatter',op.slice(12)+'&'+new URLSearchParams({portal}),payload);
        if(op.startsWith('seed.')) return invoke('seed',op.slice(5)+'&'+new URLSearchParams({portal}),payload)
        if(op.startsWith('snapshots.')) {
          if(op!=='snapshots.list'&&op!=='snapshots.create'&&!/^[a-f0-9]{32}$/.test(params.id||''))throw fail('Invalid snapshot ID.')
          // Snapshot helpers use site/.desk/snapshots in hosted mode, on the persistent volume.
          return invoke('snapshots',op.slice(10)+'&'+new URLSearchParams({portal,id:params.id||''}),payload)
        }
        const endpoint={'themes.list':'list_themes','themes.ensure':'ensure_theme','themes.config':'theme_config','layouts.list':'list_layouts','icons.list':'list_icons','patterns.list':'list_patterns'}[op]
        const query=op==='themes.list'?'':op==='layouts.list'?params.theme:['themes.ensure','themes.config'].includes(op)?portal+'&'+(params.theme||''):portal
        return invoke(endpoint,query,payload)
      })
      if(res.headersSent){progress({phase:'result',...data});res.end()}else send(res,data.ok===false?400:200,data)
    }catch(error){
      const data={ok:false,...(error.accessCode?{error:error.accessCode}:{}),stderr:error.status?error.message:error.code==='ENOENT'?'Portal file not found.':'The Cloud operation failed. Check the server log.'}
      if(res.headersSent){progress({phase:'result',...data});res.end()}else send(res,error.status||(error.code==='ENOENT'?404:500),data)
      if(!error.status&&error.code!=='ENOENT')console.error('Desk backend:',error.message)}
    return true
  }
}

