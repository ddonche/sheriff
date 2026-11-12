// Real glam builds and pure query engine, using disposable portals only.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-prospector-')),core=path.join(temp,'sheriff-core'),engineApi=require('../sheriff-core/glams/prospector/prospector-engine.js');
let checks=0;const reports=[];
function put(relative,body){const file=path.join(temp,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);}
function run(args=[]){const start=performance.now(),result=spawnSync(process.env.SHERIFF_GOBLIN||'C:/Users/kc516/.cargo/bin/goblin.exe',['run','main.gbln','test',...args],{cwd:core,encoding:'utf8',timeout:60000,env:{...process.env,SHERIFF_RUNTIME_MODE:'cloud'}});assert.equal(result.status,0,result.stdout+'\n'+result.stderr);return {ms:performance.now()-start,stdout:result.stdout};}
function page(title,layout,body,extra=''){return '^^^^\ntitle: '+title+'\nlayout: '+layout+'\n'+extra+'^^^^\n\n'+body;}
try{
 fs.cpSync(path.join(root,'sheriff-core'),core,{recursive:true});
 const config=n=>'name: Search test\nsite_url: https://search.test\ntheme:\n  name: outpost\nsearch:\n  workers: '+n+'\n';put('site/portals/test/config.yall',config(2));put('site/portals/test/nav.yall','menus:\n  header:\n    Navigation Furniture Sentinel: /book.html\n');
 put('site/portals/test/content/book.md',page('Path of the Outrider','wiki','# A journey\n\n'+('Introduction. '.repeat(50))+'\n\nCryptobiology research on crimson harbors. Café résumé. [[Other Page|Visible Wiki Label]].\n\n<script>ForbiddenScriptSentinel()</script>\n\n::: pattern vertical Book\n@mode = template\nappears = *[[Path of the Outrider]]*\n:::', 'aliases: [Outrider Tale, The First Book]\ncanonical: outrider-book\ncategories: [Books, Everwind]\nsummary: A short introduction.\nthumb: /public/images/cover.png\n'));
 put('site/portals/test/content/guide.md',page('Cryptobiology','docs','## Harbor notes\n\nCrimson harbors concern several animals.\n\n::: note\nAn animal advisory.\n:::\n','categories: [Science]\n'));
 put('site/portals/test/content/blog.md',page('Latest dispatch','blog','The hidden harbor expedition returned.'));
 put('site/portals/test/content/hidden.md',page('Secret document','wiki','SearchFalseSentinel','search: false\n'));
 put('site/portals/test/content/draft.md',page('Draft document','wiki','DraftSentinel','draft: true\n'));
 const first=run(),output=path.join(temp,'dist/test'),indexFile=path.join(output,'public/search-index.json'),cacheFile=path.join(temp,'site/.desk/prospector/test/records.json');let data=JSON.parse(fs.readFileSync(indexFile,'utf8'));assert.equal(data.version,1);assert.equal(data.documents.length,3,JSON.stringify(data.documents));assert.equal(new Set(data.documents.map(d=>d.href)).size,3);checks++;
 const bytes=fs.readFileSync(indexFile,'utf8');assert(bytes.includes('Cryptobiology research'));assert(!bytes.includes('ForbiddenScriptSentinel'));assert(!bytes.includes('Navigation Furniture Sentinel'));assert(!bytes.includes('SearchFalseSentinel'));assert(!bytes.includes('DraftSentinel'));assert(!bytes.includes('::: note'));assert(!bytes.includes('[[Other Page'));assert(bytes.includes('Visible Wiki Label'));checks++;
 const book=data.documents.find(d=>d.href==='/book.html');assert.equal(book.thumbnail,'/public/images/cover.png');assert.equal(data.documents.find(d=>d.href==='/guide.html').thumbnail,'');assert.deepEqual(book.categories,['Books','Everwind']);assert(book.aliases.includes('Outrider Tale'),JSON.stringify(book));assert(book.headings.includes('A journey'));checks++;
 let search=engineApi.create(data);assert.equal(search.query('Path of the Outrider').results[0].href,'/book.html');assert.equal(search.query('Path of the Outrider').results[0].thumbnail,'/public/images/cover.png');assert.equal(search.query('Outrider Tale').results[0].href,'/book.html');assert.equal(search.query('outrider-book').results[0].href,'/book.html');checks++;
 assert.equal(search.query('cryptobiology').results[0].href,'/guide.html');assert(search.query('cryptobiolgy').results.some(d=>d.href==='/book.html'));assert(search.query('xryptobiology').results.some(d=>d.href==='/book.html'));assert(search.query('crimson harb').results.some(d=>d.href==='/book.html'));checks++;
 assert.equal(search.query('"crimson harbors"').total,2);assert.equal(search.query('"harbors crimson"').total,0);assert.equal(search.query('crimson cryptobiology',{category:'Books'}).total,1);assert.equal(search.query('crimson',{category:'Science'}).results[0].href,'/guide.html');assert.equal(search.query('noexistentterm').total,0);checks++;
 assert(search.query('research').results[0].excerpt.includes('research'));assert(search.query('résumé').total>0);assert(search.query('Visible Wiki Label').total>0);checks++;
 const html=fs.readFileSync(path.join(output,'book.html'),'utf8');assert(html.includes('data-prospector-client'));assert(html.includes('/public/prospector-engine.js'));assert(html.includes('role="combobox"'));assert(fs.existsSync(path.join(output,'public/prospector-worker.js')));assert(fs.existsSync(cacheFile));checks++;
 // Native extraction covers preference, infoboxes, content syntax, code and icon exclusions.
 const imageCases=[
  {thumb:'/public/images/chosen.png',body:'[[image:fallback.png|full|center|]]',expected:'/public/images/chosen.png'},
  {body:'[[image:ordinary.png|half|left|]]\n\n<aside class="sheriff-pattern sheriff-pattern-vertical"><img src="/public/images/infobox.jpg"></aside>',expected:'/public/images/infobox.jpg'},
  {body:'`[[image:code.png|full|center|]]`\n\n```html\n<img src="/wrong.png">\n```\n\n[[icon|book]] [[image:books/cover.avif|full|center|]]',expected:'/public/images/books/cover.avif'},
  {body:'![First](/public/images/markdown.png)\n\n[[image:later.png|full|center|]]',expected:'/public/images/markdown.png'},
  {body:'<img data-src="/wrong.png" alt="example src=wrong" SRC = \'/public/images/html.png\'>',expected:'/public/images/html.png'},
  {body:'<img class="sheriff-icon" src="/public/icons/avatar.png"><img src="javascript:alert(1)"><img src="/public/images/real.png">',expected:'/public/images/real.png'},
  {thumb:'data:image/png;base64,abc',body:'![Relative](images/relative.png)',expected:'/docs/images/relative.png'},
  {thumb:'https://images.example/cover.png?a=1&amp;b=2',body:'',expected:'https://images.example/cover.png?a=1&b=2'},
  {body:'<script>"<img src="/wrong.png">"</script>\n\n<!-- <img src="/wrong.png"> -->\n\n[[icon|book]]',expected:''},
  {body:'<img src="/public/icons/custom.png"> No article image.',expected:''},
 ];
 put('sheriff-core/image-cases.json',JSON.stringify(imageCases));
 put('sheriff-core/check-images.gbln','import glams/prospector/prospector as prospector\nresults | []\nfor item in :read_json("image-cases.json")\n    result | prospector::prepare_record({"href":"/docs/page.html", "body":item{"body"}, "frontmatter":{"title":"Images", "thumb":item{"thumb"}}})\n    :put_last!(results, result{"thumbnail"})\nxx\n:write_json!("image-results.json", results)\n');
 const imageRun=spawnSync(process.env.SHERIFF_GOBLIN||'C:/Users/kc516/.cargo/bin/goblin.exe',['run','check-images.gbln'],{cwd:core,encoding:'utf8',timeout:10000});
 assert.equal(imageRun.status,0,imageRun.stdout+'\n'+imageRun.stderr);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(core,'image-results.json'),'utf8')),imageCases.map(c=>c.expected));checks++;
 // Worker counts must not change index content or duplicate post-generated pages.
 put('site/portals/test/config.yall',config(1));const serial=run();assert.equal(fs.readFileSync(indexFile,'utf8'),bytes);reports.push({pages:3,workers:1,ms:serial.ms});put('site/portals/test/config.yall',config(2));const parallel=run();assert.equal(fs.readFileSync(indexFile,'utf8'),bytes);reports.push({pages:3,workers:2,ms:parallel.ms});checks++;
 const untouched=JSON.stringify(data.documents.filter(d=>d.href!=='/book.html'));
 put('site/portals/test/content/book.md',page('Path of the Outrider','wiki','ReplacementNebulaOnly deep new content.','categories: [Books]\n'));
 fs.rmSync(output,{recursive:true,force:true});const partial=run(['page','book.md']);assert(!partial.stdout.includes('RUNNING PRE ACT'));assert(!partial.stdout.includes('RUNNING POST ACT'));data=JSON.parse(fs.readFileSync(indexFile,'utf8'));search=engineApi.create(data);assert.equal(data.documents.length,3);assert.equal(JSON.stringify(data.documents.filter(d=>d.href!=='/book.html')),untouched);assert.equal(search.query('ReplacementNebulaOnly').results[0].href,'/book.html');assert(!search.query('research').results.some(d=>d.href==='/book.html'));assert.equal(search.query('ReplacementNebulaOnly').results[0].thumbnail,'','Page updates remove obsolete thumbnails');assert(!fs.existsSync(path.join(output,'guide.html')));assert(fs.existsSync(path.join(output,'.prospector-search-ready')));checks++;
 // Save-only drafts of other pages are not swept into a single-page update.
 put('site/portals/test/content/guide.md',page('Unbuilt changed guide','docs','UnbuiltDraftSentinel'));
 run(['page','book.md']);data=JSON.parse(fs.readFileSync(indexFile,'utf8'));assert(!JSON.stringify(data).includes('UnbuiltDraftSentinel'));assert(data.documents.some(d=>d.title==='Cryptobiology'));checks++;
 put('site/portals/test/content/new.md',page('Brand new page','wiki','CometUnique'));run(['page','new.md']);data=JSON.parse(fs.readFileSync(indexFile,'utf8'));assert.equal(data.documents.length,4);assert.equal(engineApi.create(data).query('CometUnique').total,1);checks++;
 put('site/portals/test/content/new.md',page('Brand new page','wiki','CometUnique','search: false\n'));run(['page','new.md']);assert.equal(engineApi.create(JSON.parse(fs.readFileSync(indexFile,'utf8'))).query('CometUnique').total,0);checks++;
 // No baseline means no partial index can be published over a complete remote one.
 fs.rmSync(cacheFile);fs.rmSync(output,{recursive:true,force:true});const fresh=run(['page','book.md']);assert(fresh.stdout.includes('Build this portal once'));assert(!fs.existsSync(indexFile));assert(!fs.existsSync(path.join(output,'.prospector-search-ready')));checks++;
 // Legacy indexes still work during the initial upgrade.
 const old=engineApi.create(engineApi.parse('{"href":"/legacy.html","title":"Legacy page","summary":"Original search text"}\n'));assert.equal(old.query('original').total,1);checks++;
 const unsafe=engineApi.create({version:1,documents:[{href:'javascript:alert(1)',title:'Malicious'}],postings:{malicious:[[0,100]]}});assert.equal(unsafe.query('malicious').total,0);const spaced=engineApi.create({version:1,documents:[{href:'/space file.html',title:'Space file'}],postings:{space:[[0,8]]}});assert.equal(spaced.query('space').total,1);assert.equal(search.query('').total,0);checks++;
 if(process.env.SHERIFF_PROSPECTOR_FIXTURES){const dest=path.resolve(process.env.SHERIFF_PROSPECTOR_FIXTURES);fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'index.json'),bytes);fs.writeFileSync(path.join(dest,'page.html'),html);fs.writeFileSync(path.join(dest,'build-timings.json'),JSON.stringify(reports,null,2));}
 console.log('Passed '+checks+' Prospector integration groups: full text, wiki/docs/blog, aliases, ranking, phrases/prefixes/typos, categories, Unicode, exclusions, deterministic actors, incremental updates, no-baseline protection, legacy migration, and safe links. Timings: '+JSON.stringify(reports));
}finally{assert.equal(path.dirname(temp),path.resolve(os.tmpdir()));assert(path.basename(temp).startsWith('sheriff-prospector-'));fs.rmSync(temp,{recursive:true,force:true});}
