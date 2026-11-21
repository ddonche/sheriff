// Cloud transport for local Desk. Authentication and per-site serialization are
// supplied by the existing Desk gateway; publishing reuses its R2 uploader.
import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
const limit=48*1024*1024
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const fail=(message,status=400)=>Object.assign(Error(message),{status})
export function sourcePath(value) {
  return safe(value)&&!/(^|\/)(?:credentials(?:\.[^/]*)?|[^/]*\.pem|[^/]*\.key)$/i.test(value)&&(/^(content|blog|public|patterns|themes)\//.test(value)||/^(config|nav|assets|widgets|seeder)\.yall$/.test(value))
}
function safe(value){return typeof value==='string'&&value.length<1024&&!/[\\:\x00-\x1f]/.test(value)&&!value.startsWith('/')&&value.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!p.startsWith('.'))}
function outputPath(value){return safe(value)&&! /^(admin|api|site|data|node_modules|sheriff-core)\//.test(value)}
function revision(files){return hash(JSON.stringify(files.map(f=>[f.path,hash(f.bytes)]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0)))}
async function readSource(folder){
  const files=[];let total=0
  async function visit(dir,prefix=''){
    let entries;try{entries=await fs.readdir(dir,{withFileTypes:true})}catch(error){if(error.code==='ENOENT')return;throw error}
    for(const entry of entries){
      if(entry.isSymbolicLink())throw fail('Linked portal files cannot be synced.')
      const rel=prefix+entry.name,full=path.join(dir,entry.name)
      if(entry.isDirectory()){if(/^(content|blog|public|patterns|themes)(\/|$)/.test(rel)&&safe(rel))await visit(full,rel+'/')}
      else if(entry.isFile()&&sourcePath(rel)){const stat=await fs.stat(full);total+=stat.size;if(total>limit)throw fail('Source exceeds the current 48 MB transfer limit.',413);files.push({path:rel,bytes:await fs.readFile(full)})}
    }
  }
  await visit(folder);return files
}
function unpack(entries,allowed){
  if(!Array.isArray(entries)||entries.length>20000)throw fail('Invalid transfer file list.')
  let total=0;const seen=new Set()
  return entries.map(item=>{
    if(!item||!allowed(item.path)||typeof item.base64!=='string'||item.base64.length>limit*1.4)throw fail('Invalid transfer file.')
    const key=item.path.toLowerCase();if(seen.has(key))throw fail('Duplicate transfer file.');seen.add(key)
    const bytes=Buffer.from(item.base64,'base64');if(bytes.toString('base64')!==item.base64)throw fail('Invalid binary encoding.')
    total+=bytes.length;if(total>limit)throw fail('Transfer exceeds the current 48 MB limit.',413)
    if(hash(bytes)!==item.sha256)throw fail('Transfer checksum failed.')
    return {path:item.path,bytes}
  })
}
async function writeFiles(folder,files){for(const file of files){const dest=path.join(folder,file.path);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,file.bytes,{flag:'wx'})}}
export function createDeskSync({root,publish,state}){
  return async function sync(op,portal,payload,progress){
    const source=path.join(root,'site/portals',portal),current=await readSource(source),currentRevision=revision(current)
    if(op==='sync.inspect')return {ok:true,revision:currentRevision,files:current.length}
    if(op==='sync.download')return {ok:true,revision:currentRevision,state:await state('export',portal),files:current.map(f=>({path:f.path,base64:f.bytes.toString('base64'),sha256:hash(f.bytes)}))}
    if(op!=='sync.deploy')throw fail('Unknown sync operation.',404)
    let incoming;try{incoming=JSON.parse(payload.toString('utf8'))}catch{throw fail('Invalid deployment request.')}
    if(incoming.expected_revision!==currentRevision)throw fail('Cloud changed while you were preparing this deployment. Check changes and retry.',409)
    await state('validate',portal,incoming.state)
    const files=unpack(incoming.source,sourcePath),output=unpack(incoming.output,outputPath)
    if(!files.some(f=>f.path==='config.yall')||!output.some(f=>f.path==='index.html'))throw fail('A portal config and completed index.html are required.')
    if(files.reduce((n,f)=>n+f.bytes.length,0)+output.reduce((n,f)=>n+f.bytes.length,0)>limit)throw fail('Source and build together exceed the current 48 MB limit.',413)
    const work=path.join(root,'site/.desk/connection-uploads',portal,randomUUID()),fresh=path.join(work,'source'),built=path.join(work,'output')
    const previous=path.join(root,'site/.desk/connection-backups',portal,'previous')
    await fs.mkdir(work,{recursive:true})
    try{
      await writeFiles(fresh,files);await writeFiles(built,output)
      progress({phase:'uploading',chunk:'Uploading your local build to R2. No Cloud build is running.\n',stream:'stdout'})
      const result=await publish({ok:true,code:0,stdout:'Using completed local build.\n',stderr:'',build_ms:incoming.build_ms||0},portal,'full',progress,built)
      if(!result.published)return result
      // Keep the last source copy for recovery. This runs inside Desk's site lock.
      await fs.mkdir(path.dirname(previous),{recursive:true});await fs.rm(previous,{recursive:true,force:true})
      let hadSource=false
      try{await fs.rename(source,previous);hadSource=true}catch(error){if(error.code!=='ENOENT')throw error}
      try{await fs.mkdir(path.dirname(source),{recursive:true});await fs.rename(fresh,source)}catch(error){if(hadSource)await fs.rename(previous,source);throw error}
      await state('import',portal,incoming.state)
      return {...result,revision:revision(files),source_synced:true}
    }finally{await fs.rm(work,{recursive:true,force:true})}
  }
}
