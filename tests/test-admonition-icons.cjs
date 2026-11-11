// Actual rendering and inherited theme configuration; all writes stay in temporary fixtures.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sheriff-admonition-icons-')),core=path.join(tmp,'sheriff-core');
const kinds=['note','tip','warning','important','example','strategy','lore','spoiler'];
let checks=0;
const put=(rel,text)=>{const p=path.join(tmp,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text);};
const defaults={outpost:['info','lightbulb','triangle-alert','circle-alert','code','target','book-open-text','eye-off'],compendium:['notebook-pen','lightbulb','triangle-alert','bookmark-check','file-code','map','library-big','eye-off'],siegemate:['scroll-text','flame','shield-alert','shield-check','book-open','swords','book-open-text','eye-off']};
try{
 fs.cpSync(path.join(root,'sheriff-core'),core,{recursive:true});
 for(const theme of Object.keys(defaults)){
  put('site/portals/'+theme+'/config.yall','theme:\n  name: "'+theme+'"\n');
  put('site/portals/'+theme+'/themes/'+theme+'/templates.yall','layouts:\n  docs:\n    slots:\n      LOGO: []\n');
 }
 put('site/portals/custom/config.yall','theme:\n  name: outpost\n');
 put('site/portals/custom/themes/outpost/templates.yall','admonition_icons:\n  note: rocket\n  warning: false\n  tip: ""\n  important: []\n  example: custom-mark\n  strategy: ../invalid\n');
 put('site/portals/disabled/config.yall','theme:\n  name: outpost\n');
 put('site/portals/disabled/themes/outpost/templates.yall','admonition_icons:\n  note: false\n');
 put('site/portals/custom/public/icons/custom-mark.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>');
 const cases=[];
 for(const theme of Object.keys(defaults))for(const kind of kinds)cases.push({name:theme+'-'+kind,portal:theme,kind,body:'::: '+kind+'\nBody.\n:::'});
 for(const kind of kinds)cases.push({name:'custom-'+kind,portal:'custom',kind,body:'::: '+kind+' Custom heading\nBody.\n:::'});
 cases.push({name:'explicit-after',portal:'outpost',body:'::: warning [[icon|heart|red|24]] Explicit\nBody.\n:::'},
 {name:'explicit-before',portal:'outpost',body:'::: [[icon|heart|red|24]] warning Explicit\nBody.\n:::'},
 {name:'body-icon',portal:'outpost',body:'::: note Body icon\n[[icon|heart]] Body.\n:::'},
 {name:'explicit-disabled',portal:'custom',body:'::: warning [[icon|heart]] Explicit\nBody.\n:::'},
 {name:'disabled-note',portal:'disabled',body:'::: note\nBody.\n:::'},
 {name:'other-portal',portal:'outpost',body:'::: note\nBody.\n:::'},
 {name:'code',portal:'outpost',body:'```md\n::: warning\nExample only.\n:::\n```'},
 {name:'unknown',portal:'outpost',body:'::: not-a-kind\nKeep literal.\n:::'});
 put('sheriff-core/cases.json',JSON.stringify(cases));
 put('sheriff-core/verify.gbln',String.raw`import modules/markdown_core/markdown as markdown
import modules/trailboss_wiki/trailboss as trailboss
for item in :read_json("cases.json")
    ctx | {"portal":item{"portal"},"body":item{"body"},"frontmatter":{}}
    ctx |= markdown::render(ctx)
    ctx |= trailboss::render_fences(ctx)
    ctx |= trailboss::process_wikilinks(ctx)
    :say("ADMON_ICON " + :json_stringify({"name":item{"name"},"html":ctx{"body"}}))
xx
`);
 const result=spawnSync(process.env.SHERIFF_GOBLIN||'goblin',['run','verify.gbln'],{cwd:core,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
 const rows=result.stdout.split(/\r?\n/).filter(line=>line.startsWith('ADMON_ICON ')).map(line=>JSON.parse(line.slice(11)));
 const html=name=>rows.find(row=>row.name===name).html;
 for(const theme of Object.keys(defaults))for(const [n,kind]of kinds.entries()){
  const text=html(theme+'-'+kind);assert.equal((text.match(/data-sheriff-icon=/g)||[]).length,1,theme+' '+kind+' needs one default: '+text);assert(text.includes('data-sheriff-icon="'+defaults[theme][n]+'"'));assert(!text.includes('sheriff-icon-missing'));assert(text.includes(kind==='spoiler'?' Show</span>':kind[0].toUpperCase()+kind.slice(1)+'</span>'));checks++;
 }
 for(const kind of ['warning','tip','important','strategy']){assert(!html('custom-'+kind).includes('data-sheriff-icon='));checks++;}
 for(const [kind,name]of [['note','rocket'],['example','custom-mark'],['lore','book-open-text'],['spoiler','eye-off']]){assert(html('custom-'+kind).includes('data-sheriff-icon="'+name+'"'));checks++;}
 for(const name of ['explicit-after','explicit-before','explicit-disabled']){assert.equal((html(name).match(/data-sheriff-icon=/g)||[]).length,1);assert(html(name).includes('data-sheriff-icon="heart"'));checks++;}
 assert(html('explicit-after').includes('--sheriff-icon-size:24px;'));assert(html('explicit-after').includes('color:red;'));checks++;
 assert.equal((html('body-icon').match(/data-sheriff-icon=/g)||[]).length,2);assert(html('body-icon').includes('data-sheriff-icon="info"'));assert(!html('disabled-note').includes('data-sheriff-icon='));assert(html('other-portal').includes('data-sheriff-icon="info"'));checks++;
 for(const name of ['code','unknown']){assert(!html(name).includes('data-sheriff-icon='));assert(html(name).includes(':::'));checks++;}
 const files=fs.readdirSync(path.join(tmp,'dist/outpost/public/icons'));assert(files.includes('info.svg'));assert(!files.includes('accessibility.svg'));assert(files.includes('LUCIDE-LICENSE.txt'));checks++;
 if(process.env.SHERIFF_ADMON_ICON_FIXTURES){fs.mkdirSync(process.env.SHERIFF_ADMON_ICON_FIXTURES,{recursive:true});fs.writeFileSync(path.join(process.env.SHERIFF_ADMON_ICON_FIXTURES,'rendered.json'),JSON.stringify(rows));}
 console.log('Passed '+checks+' admonition icon checks: all types/themes, partial portal overrides, false/empty disable, explicit header icons and sizes, body icons, spoilers, code examples, custom assets, portal isolation, and referenced-only publishing. No user sites changed.');
}finally{assert.equal(path.dirname(tmp),path.resolve(os.tmpdir()));assert(path.basename(tmp).startsWith('sheriff-admonition-icons-'));fs.rmSync(tmp,{recursive:true,force:true});}
