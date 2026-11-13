// Stub notice only: exercise actual renderers and both full/page schedules in disposable portals.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-stubs-')),core=path.join(tmp,'sheriff-core'),token='{{{SHERIFF::STUB}}}';
function put(rel,text){const p=path.join(tmp,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text);}
function run(file,args=[],mode='local'){const r=spawnSync(process.env.SHERIFF_GOBLIN||'goblin',['run',file,...args],{cwd:core,env:{...process.env,SHERIFF_RUNTIME_MODE:mode,SHERIFF_BUILD_WORKERS:'2',SHERIFF_BUILD_OUTPUT:'',SHERIFF_BUILD_DEFER_ACTIVATION:'',GOBLIN_NONINTERACTIVE:'0'},encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);return r.stdout;}
try{
 fs.cpSync(path.join(root,'sheriff-core'),core,{recursive:true});
 for(const theme of ['compendium','outpost','siegemate'])put('site/portals/'+theme+'/config.yall','theme:\n  name: '+theme+'\n');
 for(const name of ['custom','disabled','empty']){put('site/portals/'+name+'/config.yall','theme:\n  name: compendium\n');put('site/portals/'+name+'/themes/compendium/templates.yall','wiki_icons:\n  stub: '+({custom:'feather',disabled:'false',empty:'""'}[name])+'\n');}
 const cases=['compendium','outpost','siegemate','custom','disabled','empty'].map(portal=>({name:portal,portal,body:token+'\n\nA short article.'}));
 const notice=(title,text)=>'stub_notice:\n'+(title===undefined?'':'  title: '+JSON.stringify(title)+'\n')+(text===undefined?'':'  text: '+JSON.stringify(text)+'\n');
 const customTitle='This article needs more detail',customText='Help expand this article with sources, examples, and information that will be useful to other readers.';
 for(const theme of ['compendium','outpost','siegemate']){const portal=theme+'-wording';put('site/portals/'+portal+'/config.yall','theme:\n  name: '+theme+'\n');put('site/portals/'+portal+'/themes/'+theme+'/templates.yall',notice(customTitle,customText));cases.push({name:portal,portal,body:token+'\n\nA short article.'});}
 put('sheriff-core/themes/wording-theme/templates.yall',notice('Theme default title','Theme default message.'));
 const extra={titleOnly:{theme:'compendium',settings:notice('Work in progress')},textOnly:{theme:'compendium',settings:notice(undefined,'Please add reliable sources.')},blankWording:{theme:'compendium',settings:notice('','  ')},invalidWording:{theme:'compendium',settings:'stub_notice:\n  title: false\n  text: []\n'},themeInherit:{theme:'wording-theme',settings:notice('Local title')},themeInvalid:{theme:'wording-theme',settings:'stub_notice:\n  title: 123\n  text: false\n'},noThemeDefaults:{theme:'missing-theme',settings:''},literalWording:{theme:'compendium',settings:notice('<b>Draft</b>','Ask "Ada" & [[No Such Page]] {{{SHERIFF::STUB}}}.')},unicodeWording:{theme:'siegemate',settings:notice('Ébauche — à compléter','Ajoutez des références et partagez vos connaissances.')},noIconWording:{theme:'outpost',settings:notice('Please contribute','Add more details here.')+'wiki_icons:\n  stub: false\n'}};
 for(const [portal,{theme,settings}]of Object.entries(extra)){put('site/portals/'+portal+'/config.yall','theme:\n  name: '+theme+'\n');put('site/portals/'+portal+'/themes/'+theme+'/templates.yall',settings);cases.push({name:portal,portal,body:token});}
 const protectedBodies={inline:'`'+token+'`',twoInline:'`'+token+'` and `'+token+'`',backticks:'`` '+token+' ``',fenced:'```text\n'+token+'\n```',tilde:'~~~md\n'+token+'\n~~~',unfinished:'```md\n'+token,indented:'    '+token,pre:'<pre>'+token+'</pre>',code:'<code>'+token+'</code>',comment:'<!-- '+token+' -->',openComment:'<!-- '+token};
 for(const [name,body]of Object.entries(protectedBodies))cases.push({name,portal:'compendium',body});
 cases.push({name:'plain',portal:'compendium',body:'An ordinary article.'},{name:'multiple',portal:'compendium',body:token+'\n\n'+token},{name:'mixed',portal:'compendium',body:'`'+token+'`\n\n'+token+'\n\n<!-- '+token+' -->'},{name:'collision',portal:'compendium',body:'@@SHERIFF_STUB_PROTECTED_0@@\n\n`'+token+'`\n\n'+token});
 put('sheriff-core/cases.json',JSON.stringify(cases));
 put('sheriff-core/verify.gbln',`import modules/markdown_core/markdown as markdown
import modules/sheriff_patterns/patterns as patterns
import modules/trailboss_wiki/stubs as stubs
import modules/trailboss_wiki/stub_source as stub_source
import modules/trailboss_wiki/trailboss as trailboss
for row in :read_json("cases.json")
    ctx | {"portal":row{"portal"},"body":row{"body"},"frontmatter":{},"build_mode":"page"}
    ctx |= patterns::apply_patterns(ctx)
    ctx |= stubs::prepare(ctx)
    ctx |= markdown::render(ctx)
    before | ctx{"body"}
    ctx |= stubs::render(ctx)
    once | ctx{"body"}
    ctx |= stubs::render(ctx)
    ctx |= trailboss::process_wikilinks(ctx)
    :say("STUB_CHECK " + :json_stringify({"name":row{"name"},"html":ctx{"body"},"before":before,"once":once,"is_stub":stub_source::has_stub(row{"body"})}))
xx
`);
 const rows=run('verify.gbln').split(/\r?\n/).filter(l=>l.startsWith('STUB_CHECK ')).map(l=>JSON.parse(l.slice(11)));
 assert.equal(rows.length,cases.length);const row=name=>rows.find(r=>r.name===name),count=html=>(html.match(/class="sheriff-stub"/g)||[]).length;
 for(const [theme,icon]of Object.entries({compendium:'notebook-pen',outpost:'file-pen-line',siegemate:'scroll-text',custom:'feather'})){const html=row(theme).html;assert.equal(count(html),1);assert(html.includes('role="note"'));assert(html.includes('Stub article'));assert(html.includes('data-sheriff-icon="'+icon+'"'));assert(!html.includes(token));assert(fs.existsSync(path.join(tmp,'dist',theme,'public/icons',icon+'.svg')));}
 for(const name of ['disabled','empty']){assert.equal(count(row(name).html),1);assert(!row(name).html.includes('sheriff-stub-icon'));}
 for(const name of [...Object.keys(protectedBodies),'plain']){assert.equal(row(name).once,row(name).before.replaceAll(/X*@@SHERIFF_STUB_LITERAL@@/g,token),name+' must remain unchanged');assert.equal(count(row(name).html),0,name+' must remain protected on repeated rendering');assert.equal(row(name).is_stub,false,name+' must not be indexed as a stub');}
 for(const name of ['compendium','outpost','siegemate','custom','disabled','empty','multiple','mixed','collision'])assert.equal(row(name).is_stub,true,name+' must be indexed as a stub');assert.equal(count(row('multiple').html),2);assert.equal(count(row('mixed').html),1);assert(row('mixed').html.includes(token));assert.equal(count(row('collision').html),1);assert(row('collision').html.includes('@@SHERIFF_STUB_PROTECTED_0@@'));
 const title=html=>html.match(/class="sheriff-stub-title">([^]*?)<\/strong>/)[1],text=html=>html.match(/class="sheriff-stub-text">([^]*?)<\/span>/)[1];
 for(const theme of ['compendium','outpost','siegemate']){assert.equal(title(row(theme+'-wording').html),customTitle);assert.equal(text(row(theme+'-wording').html),customText);assert.equal(row(theme+'-wording').is_stub,true);}
 assert.equal(title(row('titleOnly').html),'Work in progress');assert.equal(text(row('titleOnly').html),'This article is a stub. You can help expand it.');assert.equal(title(row('textOnly').html),'Stub article');assert.equal(text(row('textOnly').html),'Please add reliable sources.');
 for(const name of ['blankWording','invalidWording','noThemeDefaults']){assert.equal(title(row(name).html),'Stub article');assert.equal(text(row(name).html),'This article is a stub. You can help expand it.');}
 assert.equal(title(row('themeInherit').html),'Local title');assert.equal(text(row('themeInherit').html),'Theme default message.');assert.equal(title(row('themeInvalid').html),'Theme default title');assert.equal(text(row('themeInvalid').html),'Theme default message.');
 assert.equal(title(row('literalWording').html),'&lt;b&gt;Draft&lt;/b&gt;');assert(text(row('literalWording').html).includes('&amp;'));assert(text(row('literalWording').html).includes('&#91;&#91;No Such Page&#93;&#93;'));assert(!row('literalWording').html.includes('sheriff-missing-link'));assert(!row('literalWording').html.includes('<b>Draft</b>'));assert.equal(count(row('literalWording').html),1);
 assert.equal(title(row('unicodeWording').html),'Ébauche — à compléter');assert.equal(text(row('unicodeWording').html),'Ajoutez des références et partagez vos connaissances.');assert.equal(title(row('noIconWording').html),'Please contribute');assert(!row('noIconWording').html.includes('sheriff-stub-icon'));
 // Real full build and single-page removal; another page must remain untouched.
 put('site/portals/test/config.yall','name: Stub preview\ntheme:\n  name: compendium\n');
 const source=body=>'^^^^\ntitle: Preview article\nlayout: wiki\n^^^^\n\n'+body+'\n';
 put('site/portals/test/content/preview.md',source(token+'\n\nThis article is being written.'));
 put('site/portals/test/content/other.md',source('Another page.'));
 run('main.gbln',['test']);
 const output=rel=>fs.readFileSync(path.join(tmp,'dist/test',rel),'utf8');assert.equal(count(output('preview.html')),1);let other=output('other.html');
 assert(fs.existsSync(path.join(tmp,'site/portals/test/content/categories/stub-pages.md')),'Active stub creates its derived category');
 const stubSource=fs.readFileSync(path.join(tmp,'site/portals/test/content/preview.md'),'utf8'),stubDirectory=output('categories/stub-pages.html');
 put('site/portals/test/themes/compendium/templates.yall',notice('Keep expanding this page','The wording has changed; this page is still a stub.'));
 run('main.gbln',['test','page','preview.md']);assert.equal(title(output('preview.html')),'Keep expanding this page');assert.equal(text(output('preview.html')),'The wording has changed; this page is still a stub.');assert.equal(output('categories/stub-pages.html'),stubDirectory,'Page build leaves the shared directory unchanged');assert.equal(output('other.html'),other);assert.equal(fs.readFileSync(path.join(tmp,'site/portals/test/content/preview.md'),'utf8'),stubSource);
 run('main.gbln',['test']);const indexed=JSON.parse(fs.readFileSync(path.join(tmp,'site/portals/test/routes.json'),'utf8')).routes;const stubRoute=indexed.find(r=>r.slug==='preview');assert.equal(stubRoute.is_stub,true);assert(stubRoute.categories.includes('Stub pages'));assert(output('categories/stub-pages.html').includes('Preview article'));assert.equal(title(output('preview.html')),'Keep expanding this page');const localMessage=text(output('preview.html'));run('main.gbln',['test'],'cloud');assert.equal(title(output('preview.html')),'Keep expanding this page');assert.equal(text(output('preview.html')),localMessage);assert.equal(JSON.parse(fs.readFileSync(path.join(tmp,'site/portals/test/routes.json'),'utf8')).routes.find(r=>r.slug==='preview').is_stub,true);other=output('other.html');

 put('site/portals/test/content/preview.md',source('The stub marker has been removed.'));
 const pageLog=run('main.gbln',['test','page','preview.md']);assert(!pageLog.includes('RUNNING PRE ACT'));assert(!pageLog.includes('RUNNING POST ACT'));assert.equal(count(output('preview.html')),0);assert.equal(output('other.html'),other);
 if(process.env.SHERIFF_STUB_PREVIEW_DIR){const dest=path.resolve(process.env.SHERIFF_STUB_PREVIEW_DIR);fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'rendered-stubs.json'),JSON.stringify(rows,null,2));}
 console.log('Passed '+cases.length+' stub render cases and real full/page builds: custom/default/fallback wording, local/Cloud builds, theme/custom/disabled icons, code/comment protection, multiple markers, idempotence, asset publication, marker removal, and unchanged unrelated pages. Only temporary portals modified.');
}finally{assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));assert(path.basename(tmp).startsWith('sheriff-stubs-'));fs.rmSync(tmp,{recursive:true,force:true});}
