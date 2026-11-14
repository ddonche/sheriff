// Browser-only binary transport. Filesystem work stays in Desk's Goblin APIs.
(function () {
  'use strict';
  const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', {fatal:true});
  const MAX_BYTES = 48 * 1024 * 1024;
  function safePath(path) {
    return typeof path === 'string' && path.length < 1024 && !/[\\:\x00-\x1f]/.test(path)
      && !path.startsWith('/') && path.split('/').every(p => p && p !== '.' && p !== '..' && !p.startsWith('.'));
  }
  function sourcePath(path) {
    return safePath(path) && !/(^|\/)(?:credentials(?:\.[^/]*)?|[^/]*\.pem|[^/]*\.key)$/i.test(path)
      && (/^(content|blog|public|patterns|themes)\//.test(path) || /^(config|nav|assets|widgets|seeder)\.yall$/.test(path));
  }
  function outputPath(path) { return safePath(path) && !/^(admin|api|site|data|node_modules|sheriff-core)\//.test(path); }
  async function hash(bytes) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2,'0')).join(''); }
  function base64(bytes) { let text=''; for(let i=0;i<bytes.length;i+=32768) text+=String.fromCharCode(...bytes.subarray(i,i+32768)); return btoa(text); }
  function bytes(text) { return Uint8Array.from(atob(text), c=>c.charCodeAt(0)); }
  async function fingerprint(files) {
    const rows=[];
    for(const file of [...files].sort((a,b)=>a.path.localeCompare(b.path,'en'))) rows.push([file.path, await hash(file.bytes)]);
    // Bytewise path sort is shared with the Cloud transport.
    rows.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
    return hash(encoder.encode(JSON.stringify(rows)));
  }
  function crc32(data) { let n=0xffffffff; for(const byte of data){n^=byte;for(let j=0;j<8;j++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0; }
  function join(chunks) { const out=new Uint8Array(chunks.reduce((n,b)=>n+b.length,0));let i=0;for(const b of chunks){out.set(b,i);i+=b.length;}return out; }
  function zip(files) {
    const local=[],central=[];let offset=0;
    for(const file of files){
      if(!sourcePath(file.path))throw Error('Unsupported source path: '+file.path);
      const name=encoder.encode(file.path),data=file.bytes,crc=crc32(data),h=new Uint8Array(30),v=new DataView(h.buffer);
      v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);
      local.push(h,name,data);
      const c=new Uint8Array(46),cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint16(14,33,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);central.push(c,name);offset+=h.length+name.length+data.length;
    }
    const directory=join(central),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,directory.length,true);v.setUint32(16,offset,true);return join([...local,directory,end]);
  }
  async function unzip(input, allowed) {
    const data=input instanceof Uint8Array?input:new Uint8Array(input),view=new DataView(data.buffer,data.byteOffset,data.byteLength);
    let end=-1;for(let i=data.length-22;i>=Math.max(0,data.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
    if(end<0||view.getUint16(end+4,true)||view.getUint16(end+6,true))throw Error('Unsupported ZIP archive.');
    const count=view.getUint16(end+10,true),files=[],seen=new Set();let at=view.getUint32(end+16,true),total=0;
    for(let i=0;i<count;i++){
      if(view.getUint32(at,true)!==0x02014b50)throw Error('Invalid ZIP directory.');
      const size=view.getUint32(at+24,true),packed=view.getUint32(at+20,true),method=view.getUint16(at+10,true),flags=view.getUint16(at+8,true),length=view.getUint16(at+28,true),start=view.getUint32(at+42,true),mode=view.getUint32(at+38,true)>>>16;
      const path=decoder.decode(data.subarray(at+46,at+46+length)).replaceAll('\\','/');at+=46+length+view.getUint16(at+30,true)+view.getUint16(at+32,true);
      if(path.endsWith('/'))continue;
      if(!allowed(path))continue;
      if(!safePath(path)||((mode&0xf000)===0xa000)||flags&1)throw Error('Unsafe ZIP entry.');
      const key=path.toLowerCase();if(seen.has(key))throw Error('Duplicate ZIP entry.');seen.add(key);
      if(!allowed(path))continue;
      total+=size;if(total>MAX_BYTES)throw Error('This transfer exceeds the current 48 MB limit.');
      if(view.getUint32(start,true)!==0x04034b50)throw Error('Invalid ZIP entry.');
      const body=start+30+view.getUint16(start+26,true)+view.getUint16(start+28,true),raw=data.subarray(body,body+packed);
      let content;
      if(method===0)content=raw.slice();
      else if(method===8)content=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      else throw Error('Unsupported ZIP compression.');
      if(content.length!==size||crc32(content)!==view.getUint32(start+14,true))throw Error('ZIP integrity check failed.');
      files.push({path,bytes:content});
    }
    return files;
  }
  window.SheriffCloudTransfer={sourcePath,outputPath,hash,base64,bytes,fingerprint,zip,unzip,MAX_BYTES};
}());
