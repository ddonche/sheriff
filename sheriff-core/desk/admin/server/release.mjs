import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const lockName = 'sheriff-core.lock.json'
const embeddedLock = 'desk/admin/server/core-release.json'
const textTypes = new Set(['.gbln', '.gob', '.imports', '.yall', '.toml', '.css', '.html', '.js', '.mjs', '.cjs', '.json', '.svg', '.md', '.txt', '.ps1', '.py'])
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex')

function safePath(root, relative) {
  if (fs.existsSync(root) && fs.lstatSync(root).isSymbolicLink()) throw new Error('Core directory must not be a symlink')
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.split('/').some(p => !p || p === '.' || p === '..') || path.isAbsolute(relative)) throw new Error(`Invalid Core path: ${relative}`)
  const resolved = path.resolve(root, relative)
  if (!resolved.startsWith(path.resolve(root) + path.sep)) throw new Error(`Core path escapes its directory: ${relative}`)
  let current = root
  for (const part of relative.split('/')) {
    current = path.join(current, part)
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error(`Core symlinks are unsupported: ${relative}`)
  }
  return resolved
}

function filesUnder(root, prefix = '') {
  return fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__pycache__') return []
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (relative === embeddedLock) return []
    safePath(root, relative)
    if (entry.isDirectory()) return filesUnder(root, relative)
    if (!entry.isFile()) throw new Error(`Unsupported Core entry: ${relative}`)
    return [relative]
  }).sort()
}

function canonicalBytes(file, relative) {
  const bytes = fs.readFileSync(file)
  return textTypes.has(path.extname(relative)) || path.basename(relative) === 'README'
    ? Buffer.from(bytes.toString('utf8').replace(/\r\n?/g, '\n')) : bytes
}

function writeAtomic(file, bytes) {
  const temporary = file + '.core-update-' + crypto.randomUUID()
  try {
    fs.writeFileSync(temporary, bytes, { flag: 'wx' })
    fs.renameSync(temporary, file)
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
  }
}

function treeHash(files) {
  return hash(files.map(file => `${file.path}\0${file.sha256}\n`).join(''))
}

export function readLock(root = projectRoot) {
  const lock = JSON.parse(fs.readFileSync(fs.existsSync(path.join(root,'sheriff-core',embeddedLock)) ? safePath(path.join(root,'sheriff-core'),embeddedLock) : path.join(root,lockName), 'utf8'))
  if (lock.schema !== 1 || !Array.isArray(lock.files) || !lock.files.length || !/^[0-9a-f]{40}$/.test(lock.goblin?.ref) || !/^\d+\.\d+\.\d+$/.test(lock.goblin?.version)) throw new Error('Invalid Sheriff Core release lock')
  const seen = new Set()
  for (const file of lock.files) {
    safePath(path.join(root, 'sheriff-core'), file.path)
    if (seen.has(file.path) || !/^[0-9a-f]{64}$/.test(file.sha256)) throw new Error('Invalid Core file inventory')
    seen.add(file.path)
  }
  if (treeHash(lock.files) !== lock.coreSha256) throw new Error('Core inventory checksum mismatch')
  return lock
}

export function verifyCore({ root = projectRoot, runtime } = {}) {
  const lock = readLock(root)
  for (const entry of lock.files) {
    const file = safePath(path.join(root, 'sheriff-core'), entry.path)
    if (!fs.existsSync(file) || hash(canonicalBytes(file, entry.path)) !== entry.sha256) throw new Error(`Sheriff Core differs from its release lock: ${entry.path}`)
  }
  const actual = filesUnder(path.join(root, 'sheriff-core'))
  if (actual.length !== lock.files.length || actual.some((name,i)=>name!==lock.files[i].path)) throw new Error('Sheriff Core file inventory differs from its release lock')
  if (runtime) {
    const result = spawnSync(runtime, ['--version'], { encoding: 'utf8', timeout: 15000 })
    if (result.error) throw result.error
    if (result.status !== 0 || result.stdout.trim() !== `Goblin v${lock.goblin.version}`) throw new Error(`Expected Goblin v${lock.goblin.version}; received ${result.stdout.trim() || result.stderr.trim() || result.status}`)
  }
  return lock
}

export function syncCore({ source, root = projectRoot, goblinVersion, goblinRef }) {
  if (!source || !/^\d+\.\d+\.\d+$/.test(goblinVersion) || !/^[0-9a-f]{40}$/.test(goblinRef)) throw new Error('Provide --source, --goblin-version, and a full --goblin-ref commit SHA')
  source = fs.realpathSync(path.resolve(source))
  root = fs.realpathSync(root)
  const sourceCore = fs.realpathSync(path.join(source, 'sheriff-core'))
  const targetCore = path.join(root, 'sheriff-core')
  if (source === root || sourceCore.startsWith(root + path.sep) || targetCore.startsWith(source + path.sep)) throw new Error('Source and destination must be separate checkouts')
  if (!fs.readFileSync(path.join(sourceCore, 'modules/stagehand/stagehand.gbln'), 'utf8').includes('SHERIFF_RUNTIME_MODE')) throw new Error('Source Core does not support hosted mode')
  const oldLock = fs.existsSync(path.join(root, lockName)) ? verifyCore({ root }) : null
  const pending = filesUnder(sourceCore).map(relative => {
    const bytes = canonicalBytes(safePath(sourceCore, relative), relative)
    return { path: relative, bytes, sha256: hash(bytes) }
  })
  const caseNames = new Set()
  for (const entry of pending) {
    const key = entry.path.toLowerCase()
    if (caseNames.has(key)) throw new Error(`Case-conflicting Core path: ${entry.path}`)
    caseNames.add(key)
  }
  const files = pending.map(({ path, sha256 }) => ({ path, sha256 }))
  const sourceGit = args => {
    const result = spawnSync('git', ['-C', source, ...args], { encoding: 'utf8', timeout: 15000 })
    if (result.status !== 0) throw new Error(`Cannot read source Git provenance: ${result.stderr.trim()}`)
    return result.stdout.trim()
  }
  const lock = {
    schema: 1,
    source: { repository: sourceGit(['remote', 'get-url', 'origin']), commit: sourceGit(['rev-parse', 'HEAD']), workingTree: Boolean(sourceGit(['status', '--porcelain', '--untracked-files=all', '--', 'sheriff-core'])) },
    coreSha256: treeHash(files),
    goblin: { repository: 'https://github.com/ddonche/goblin-lang', version: goblinVersion, ref: goblinRef },
    files,
  }
  const kept = new Set(files.map(file => file.path))
  const removed = (oldLock?.files || []).filter(file => !kept.has(file.path)).map(file => file.path)
  const originals = new Map()
  for (const relative of [...files.map(file => file.path), ...removed]) {
    const file = safePath(targetCore, relative)
    originals.set(file, fs.existsSync(file) ? fs.readFileSync(file) : null)
  }
  const packagedLock = safePath(targetCore, embeddedLock)
  originals.set(packagedLock, fs.existsSync(packagedLock) ? fs.readFileSync(packagedLock) : null)
  const lockFile = path.join(root, lockName)
  const previousLock = fs.existsSync(lockFile) ? fs.readFileSync(lockFile) : null
  const changed = []
  let lockWritten = false
  try {
    for (const entry of pending) {
      const file = safePath(targetCore, entry.path)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      writeAtomic(file, entry.bytes)
      changed.push(file)
    }
    for (const relative of removed) {
      const file = safePath(targetCore, relative)
      fs.unlinkSync(file)
      changed.push(file)
    }
    fs.mkdirSync(path.dirname(packagedLock), { recursive: true })
    writeAtomic(packagedLock, JSON.stringify(lock, null, 2) + '\n')
    changed.push(packagedLock)
    writeAtomic(lockFile, JSON.stringify(lock, null, 2) + '\n')
    lockWritten = true
    verifyCore({ root })
  } catch (error) {
    const failures = []
    for (const file of changed.reverse()) {
      try {
        const bytes = originals.get(file)
        if (bytes === null) { if (fs.existsSync(file)) fs.unlinkSync(file) }
        else writeAtomic(file, bytes)
      } catch (rollbackError) { failures.push(rollbackError.message) }
    }
    if (lockWritten) {
      try {
        if (previousLock === null) { if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile) }
        else writeAtomic(lockFile, previousLock)
      } catch (rollbackError) { failures.push(rollbackError.message) }
    }
    if (failures.length) throw new Error(error.message + '; rollback incomplete: ' + failures.join('; '))
    throw error
  }
  return lock
}

// Package a reviewed local Core; no site files, credentials or runtime compilation.
export function packCore({root=projectRoot}={}) {
 const prior=readLock(root),core=path.join(root,'sheriff-core');
 const files=filesUnder(core).map(relative=>({path:relative,sha256:hash(canonicalBytes(safePath(core,relative),relative))}));
 const git=(...args)=>{const r=spawnSync('git',['-C',root,...args],{encoding:'utf8',timeout:15000});if(r.status!==0)throw new Error('Cannot record Core provenance');return r.stdout.trim();};
 const lock={...prior,source:{repository:git('remote','get-url','origin'),commit:git('rev-parse','HEAD'),workingTree:Boolean(git('status','--porcelain','--untracked-files=all','--','sheriff-core'))},files,coreSha256:treeHash(files)};
 writeAtomic(safePath(core,embeddedLock),JSON.stringify(lock,null,2)+'\n');
 return lock;
}

export function main(argv = process.argv.slice(2)) {
  try {
    const [command, ...args] = argv
    const option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1] }
    if (command === 'pack') {
      const lock=packCore();console.log(`Packaged ${lock.files.length} Core files; ${lock.coreSha256}; Goblin ${lock.goblin.version}`)
    } else if (command === 'sync') {
      const prior = fs.existsSync(path.join(projectRoot, lockName)) ? readLock() : null
      const lock = syncCore({ source: option('--source'), goblinVersion: option('--goblin-version') || prior?.goblin.version, goblinRef: option('--goblin-ref') || prior?.goblin.ref })
      console.log(`Synced ${lock.files.length} Core files; ${lock.coreSha256}; Goblin ${lock.goblin.version}${lock.source.workingTree ? '; working-tree snapshot' : ''}`)
    } else if (command === 'verify') {
      const lock = verifyCore({ runtime: option('--runtime') })
      console.log(`Sheriff Core verified: ${lock.coreSha256}; Goblin ${lock.goblin.version}`)
    } else if (command === 'runtime-ref') console.log(readLock().goblin.ref)
    else throw new Error('Usage: node tools/sheriff-core-release.mjs sync --source <sheriff-checkout> --goblin-version <version> --goblin-ref <commit> | verify [--runtime <goblin>] | runtime-ref')
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}

if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main();
