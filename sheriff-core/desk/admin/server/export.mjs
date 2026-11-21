// Export the Desk packaged with this exact Sheriff Core. Never export server handlers.
import fs from 'node:fs';
import path from 'node:path';
export function exportSharedDesk(root,destination=path.join(root,'dist/desk')) {
 const source=path.join(root,'sheriff-core/desk');fs.mkdirSync(destination,{recursive:true});
 fs.cpSync(path.join(source,'admin'),path.join(destination,'admin'),{recursive:true,filter:file=>!['requests','server'].includes(path.relative(path.join(source,'admin'),file).split(path.sep)[0])});
 const html=fs.readFileSync(path.join(source,'index.html'),'utf8').replaceAll('/admin/','/desk/admin/').replace('<script src="/desk/admin/backend.js','<script src="/desk/cloud-host.js"></script>\n<script src="/desk/admin/backend.js');
 fs.writeFileSync(path.join(destination,'index.html'),html);fs.copyFileSync(path.join(source,'admin/cloud-host.js'),path.join(destination,'cloud-host.js'));
}
