const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-prospector-fallbacks-')),core=path.join(temp,'sheriff-core');
const cases=[
 {key:'untitled',frontmatter:{},body:'An article with no title or heading.',title:'untitled'},
 {key:'blank-title',frontmatter:{title:''},body:'Another article without headings.',title:'blank-title'},
 {key:'empty-page',frontmatter:{title:''},body:'',title:'empty-page'},
 {key:'heading-title',frontmatter:{},body:'# First heading\n\nBody.',title:'First heading'},
 {key:'explicit-title',frontmatter:{title:'Page title'},body:'# Different heading',title:'Page title'},
 {key:'code-only',frontmatter:{},body:'```text\n# This is code\n```',title:'code-only'},
 {key:'image-short',frontmatter:{},body:'[[image:cover.png]]',title:'image-short'},
 {key:'video-short',frontmatter:{},body:'[[video:https://youtu.be/example]]',title:'video-short'},
 {key:'empty-link',frontmatter:{},body:'[[]]',title:'empty-link'},
 {key:'empty-image',frontmatter:{},body:'[[image:]]',title:'empty-image'}
].map(item=>({...item,href:'/'+item.key+'.html',output_rel_no_ext:item.key}));
function put(rel,text){const file=path.join(temp,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function run(file){const r=spawnSync(process.env.SHERIFF_GOBLIN||'goblin',['run',file],{cwd:core,encoding:'utf8',timeout:15000,windowsHide:true});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);}
try {
 fs.cpSync(path.join(root,'sheriff-core/glams/prospector'),path.join(core,'glams/prospector'),{recursive:true});
 put('sheriff-core/cases.json',JSON.stringify(cases));
 put('sheriff-core/direct.gbln','import glams/prospector/prospector as prospector\nrecords | []\nfor message in :read_json("cases.json")\n    :put_last!(records, prospector::prepare_record(message))\nxx\n:write_json!("records.json", records)\n');
 run('direct.gbln');const records=JSON.parse(fs.readFileSync(path.join(core,'records.json'),'utf8'));assert.deepEqual(records.map(item=>item.title),cases.map(item=>item.title));
 put('sheriff-core/actors.gbln','import glams/prospector/prospector as prospector\nctx | prospector::init({"portal":"test"})\nfor message in :read_json("cases.json")\n    :update!(message{"prospector_jobs"}, ctx{"prospector_jobs"})\n    :update!(message{"portal"}, "test")\n    prospector::index_page(message)\nxx\nprospector::finalize(ctx)\n');
 let expected;
 for(const workers of [1,2]) {
  put('site/portals/test/config.yall','search:\n  workers: '+workers+'\n');run('actors.gbln');
  const bytes=fs.readFileSync(path.join(temp,'dist/test/public/search-index.json'),'utf8'),data=JSON.parse(bytes);
  assert.equal(data.documents.length,cases.length);for(const item of cases)assert.equal(data.documents.find(doc=>doc.href===item.href)?.title,item.title);
  if(expected)assert.equal(bytes,expected);else expected=bytes;
 }
 console.log('Passed '+cases.length+' Prospector fallback cases directly and with 1/2 workers: missing/blank titles, no headings, empty pages, code headings, shorthand media, and empty links.');
}finally{assert.equal(path.dirname(temp),path.resolve(os.tmpdir()));assert(path.basename(temp).startsWith('sheriff-prospector-fallbacks-'));fs.rmSync(temp,{recursive:true,force:true});}
