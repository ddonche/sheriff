// Nested Markdown examples must remain one literal code block.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),tempRoot=path.resolve(os.tmpdir()),fixture=fs.mkdtempSync(path.join(tempRoot,'sheriff-code-fences-')),core=path.join(fixture,'sheriff-core');
const sample=['::: tabs','','@tab JavaScript','','Print a greeting:','','```javascript','console.log("Hello, world!");','```','','@tab Python','','Print a greeting:','','```python','print("Hello, world!")','```','',':::'].join('\n');
const pattern=['```javascript','console.log("Example");','```','','::: pattern horizontal Language','@mode = template','name = ALGOL',':::','','{{{SHERIFF::PATTERN_SHARED}}}'].join('\n');
const workaround='<pre><code>'+sample.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/`/g,'&#96;').replace(/:/g,'&#58;').replace(/@/g,'&#64;')+'</code></pre>';
const cases=[
 {name:'four-backtick-docs',body:'````markdown\n'+sample+'\n````\n\n## Following section',literal:sample},
 {name:'five-backtick-docs',body:'`````markdown\n````markdown\n'+sample+'\n````\n`````',literal:'````markdown\n'+sample+'\n````'},
 {name:'tilde-docs',body:'~~~markdown\n'+sample+'\n~~~',literal:sample},
 {name:'patterns-in-docs',body:'````markdown\n'+pattern+'\n````',literal:pattern},
 {name:'longer-closing',body:'```text\nLiteral content.\n`````',literal:'Literal content.'},
 {name:'unclosed',body:'```text\nLiteral to EOF.\n@tab Not a tab',literal:'Literal to EOF.\n@tab Not a tab'},
 {name:'indentation',body:'```python\ndef hello():\n    print("Hello")\n```',literal:'def hello():\n    print("Hello")'},
 {name:'no-blank-lines',body:'Before example.\n```text\nOne code block.\n```\nAfter example.',literal:'One code block.'},
 {name:'html-workaround',body:workaround,literal:sample},
 {name:'actual-tabs',body:sample,tab:true}
];
try{for(const rel of ['modules/markdown_core/markdown.gbln','modules/markdown_core/content_tabs.gbln','modules/markdown_core/fenced_code.gbln','modules/sheriff_patterns/patterns.gbln','modules/trailboss_wiki/stub_source.gbln','modules/trailboss_wiki/routes_json.gbln','modules/badge_labels/badge.gbln']){const dest=path.join(core,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,'sheriff-core',rel),dest);}
fs.writeFileSync(path.join(core,'cases.json'),JSON.stringify(cases));fs.writeFileSync(path.join(core,'verify.gbln'),String.raw`import modules/sheriff_patterns/patterns as patterns
import modules/markdown_core/markdown as markdown
import modules/badge_labels/badge as badge
register_token("SHERIFF", "PATTERN_SHARED", "<aside>Shared pattern</aside>")
for item in :read_json("cases.json")
    ctx | {"body": item{"body"}, "frontmatter": {}}
    ctx |= patterns::apply_patterns(ctx)
    ctx |= markdown::render(ctx)
    :say("FENCE_CHECK " + :json_stringify({"name": item{"name"}, "html": ctx{"body"}}))
xx
`);
const result=spawnSync('goblin',['run','verify.gbln'],{cwd:core,encoding:'utf8',timeout:30000});assert.equal(result.status,0,result.stdout+'\n'+result.stderr);const rows=result.stdout.split(/\r?\n/).filter(x=>x.startsWith('FENCE_CHECK ')).map(x=>JSON.parse(x.slice(12)));assert.equal(rows.length,cases.length);
for(const item of cases){const row=rows.find(x=>x.name===item.name);if(item.tab){assert(row.html.includes('data-sheriff-content-tabs'));assert.equal((row.html.match(/class="sheriff-page-tab sheriff-content-tab"/g)||[]).length,2);}else{assert(!row.html.includes('data-sheriff-content-tabs'),item.name);assert(!row.html.includes('data-sheriff-pattern='),item.name);assert(!row.html.includes('<aside>Shared pattern</aside>'),item.name);assert(!row.html.includes('<p><pre>'),item.name);assert(!row.html.includes('<p><div class="hl-'),item.name);}}
if(process.env.SHERIFF_FENCE_PREVIEW_DIR){const out=path.resolve(process.env.SHERIFF_FENCE_PREVIEW_DIR);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'cases.json'),JSON.stringify(cases));fs.writeFileSync(path.join(out,'rendered.json'),JSON.stringify(rows));fs.writeFileSync(path.join(out,'cloud-compatible-example.html'),workaround);}
console.log('Passed '+cases.length+' code-fence rendering checks. No site builds run.');
}finally{if(path.dirname(fixture)===tempRoot&&path.basename(fixture).startsWith('sheriff-code-fences-'))fs.rmSync(fixture,{recursive:true,force:true});}
