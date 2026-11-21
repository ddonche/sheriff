import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const repo=process.argv[2]||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-core-only-'));
const embedded='desk/admin/server/core-release.json';
try{
 const installed=path.join(root,'sheriff-core');fs.cpSync(path.join(repo,'sheriff-core'),installed,{recursive:true,filter:file=>!path.relative(path.join(repo,'sheriff-core'),file).split(path.sep).some(p=>p.startsWith('.')||['node_modules','__pycache__'].includes(p))});
 const inventory=JSON.parse(fs.readFileSync(path.join(installed,embedded),'utf8'));
 // An old Cloud checkout's lock remains untouched when only Core is replaced.
 const legacy=JSON.stringify({...inventory,coreSha256:'0'.repeat(64)});fs.writeFileSync(path.join(root,'sheriff-core.lock.json'),legacy);
 const {verifyCore}=await import(pathToFileURL(path.join(installed,'desk/admin/server/release.mjs')));
 const {exportSharedDesk}=await import(pathToFileURL(path.join(installed,'desk/admin/server/export.mjs')));
 assert.equal(verifyCore({root}).coreSha256,inventory.coreSha256);
 const host=path.join(installed,'desk/admin/cloud-host.js'),original=fs.readFileSync(host,'utf8'),updated=original+'\n// Core-only upgrade fixture\n';
 fs.writeFileSync(host,updated);assert.throws(()=>verifyCore({root}),/differs from its release lock/);
 const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
 inventory.files.find(f=>f.path==='desk/admin/cloud-host.js').sha256=hash(Buffer.from(updated.replace(/\r\n?/g,'\n')));
 inventory.coreSha256=hash(inventory.files.map(f=>f.path+'\0'+f.sha256+'\n').join(''));
 fs.writeFileSync(path.join(installed,embedded),JSON.stringify(inventory));
 assert.equal(verifyCore({root}).coreSha256,inventory.coreSha256);
 fs.mkdirSync(path.join(root,'dist'),{recursive:true});fs.writeFileSync(path.join(root,'dist/index.html'),'EXISTING CLOUD FRONTEND');
 exportSharedDesk(root);
 assert.equal(fs.readFileSync(path.join(root,'dist/desk/cloud-host.js'),'utf8'),updated);
 assert.equal(fs.readFileSync(path.join(root,'dist/index.html'),'utf8'),'EXISTING CLOUD FRONTEND');
 assert(!fs.existsSync(path.join(root,'dist/desk/admin/server')));
 assert(!fs.existsSync(path.join(root,'dist/desk/admin/requests')));
 assert.equal(fs.readFileSync(path.join(root,'sheriff-core.lock.json'),'utf8'),legacy);
 assert(!fs.existsSync(path.join(root,'site')),'Installing Core must not create/import portal source');
 const gateway=await import(pathToFileURL(path.join(installed,'desk/admin/server/desk-server.mjs')));
 assert.equal(typeof gateway.createDeskHandler,'function');
 console.log('Core-only replacement passed: packaged inventory, tamper rejection, refreshed Desk host/UI, Core-owned gateway, private handler exclusion, unchanged Cloud frontend/legacy lock, no site import.');
}finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
