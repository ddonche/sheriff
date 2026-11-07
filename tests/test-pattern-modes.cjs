// Isolated pattern/rendering and Desk interaction checks; no site builds.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
let count = 0;
function check(name, run) { run(); count++; }
function between(text, start, end) {
  const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, 'Missing source section: ' + start);
  return text.slice(a, b);
}
const admin = fs.readFileSync(path.join(root, 'sheriff-core/desk/admin/admin.js'),'utf8');
const html = fs.readFileSync(path.join(root, 'sheriff-core/desk/index.html'),'utf8');
const controls = {};
function control() { return {value:'',textContent:'',hidden:false,disabled:false,classList:{toggle(name,value){this[name]=value;}}}; }
for (const id of ['patText','patName','patTokenEl','patCopyToken','patCopyScaffold','patMode','patModeHint','patnewMode','patnewTokenRow','patnewToken','patnewModeHint','patnewName','patnewErr','patnewModal','patPortal','patSave','patDirty','patDelete']) controls[id] = control();
const handlers = {};
controls.patCopyScaffold.addEventListener = (_,fn) => { handlers.copy = fn; };
controls.patCopyToken.addEventListener = (_,fn) => { handlers.token = fn; };
controls.patMode.addEventListener = (_,fn) => { handlers.mode = fn; };
const copied = [];
const context = vm.createContext({...controls,patSelected:0,patDirtyFlag:false,patItems:[{body:'saved old content'}],
  setPatDirty(value){context.dirty=value;},copyText(text,label){copied.push({text,label});},
  document:{querySelector(){return {checked:false};}},setTimeout(){},say(msg){throw new Error(msg);}});
vm.runInContext(between(admin,'  // Modes belong to each block;','  function patternsEnter()'),context);
vm.runInContext(between(admin,'  function setPatDirty(v)','  function setPatStatus('),context);
vm.runInContext(between(admin,'  function refreshPatternMeta()','  patText.addEventListener'),context);
vm.runInContext(between(admin,"  patMode.addEventListener('change'",'  async function savePattern()'),context);
vm.runInContext(between(admin,'  function refreshPatNewMode()','  patnewMode.addEventListener'),context);
vm.runInContext(between(admin,'  function openPatNew()','  function closePatNew()'),context);
vm.runInContext(between(admin,"  patCopyScaffold.addEventListener('click'",'  // ---------- boot ----------'),context);
const legacy = '::: pattern vertical Region\ngovernment = Monarchy\nleadership = [[House]]\n:::\n';
const template = context.setPatternMode(legacy,'template');
check('legacy mode',()=>assert.equal(context.parsePatternHeader(legacy).mode,'reusable'));
check('template marker copied',()=>assert.equal(context.parsePatternHeader(template).mode,'template'));
check('fields preserved',()=>assert.equal(template.replace('@mode = template\n',''),legacy));
check('reusable round trip',()=>assert.equal(context.setPatternMode(template,'reusable').replace('@mode = reusable\n',''),legacy));
check('duplicate directives normalized',()=>assert.equal((context.setPatternMode(template.replace('@mode = template','@mode = template\n@MODE = reusable'),'template').match(/@mode\s*=/gi)||[]).length,1));
check('last valid mode wins',()=>assert.equal(context.parsePatternHeader(template.replace('@mode = template','@mode = template\n@MODE = reusable')).mode,'reusable'));
check('multiple blocks keep independent modes',()=>{
  const combined=legacy+template;
  const changed=context.setPatternMode(combined,'template');
  assert(changed.endsWith(template));
  assert.equal(context.parsePatternHeader(changed).mode,'template');
});
check('CRLF preserved',()=>assert.equal(context.setPatternMode(legacy.replace(/\n/g,'\r\n'),'template').replace(/\r\n/g,'\n'),template));
check('invalid header preserved',()=>assert.equal(context.setPatternMode('not a pattern','template'),'not a pattern'));
check('token names match existing core convention',()=>assert.equal(context.patternToken('Region-Box (pattern)'),'{{{SHERIFF::PATTERN_REGION_BOX}}}'));
check('template controls',()=>{
  controls.patText.value=template; context.refreshPatternMeta();
  assert.equal(controls.patTokenEl.hidden,true); assert.equal(controls.patTokenEl.textContent,'');
  assert.equal(controls.patCopyToken.hidden,true); assert.equal(controls.patCopyToken.disabled,true);
  assert.equal(controls.patCopyScaffold.textContent,'Copy template'); assert.equal(controls.patMode.value,'template');
});
check('reusable controls',()=>{
  controls.patText.value=legacy; context.refreshPatternMeta();
  assert.equal(controls.patTokenEl.hidden,false); assert.equal(controls.patCopyToken.hidden,false);
  assert.equal(controls.patCopyToken.disabled,false); assert.equal(controls.patMode.value,'reusable');
});
check('selector preserves current fields and marks dirty',()=>{
  controls.patMode.value='template'; handlers.mode();
  assert.equal(controls.patText.value,template); assert.equal(context.patDirtyFlag,true); assert.equal(controls.patCopyToken.disabled,true);
});
check('copy uses current unsaved template',()=>{
  controls.patText.value=template.replace('Monarchy','Republic'); handlers.copy();
  assert.equal(copied.at(-1).text,controls.patText.value); assert(copied.at(-1).text.includes('@mode = template'));
});
check('template cannot copy stale token',()=>{const n=copied.length; handlers.token(); assert.equal(copied.length,n);});
check('unsaved reusable token is unavailable',()=>{controls.patText.value=legacy; context.refreshPatternMeta(); const n=copied.length; handlers.token(); assert.equal(copied.length,n); assert.equal(controls.patCopyToken.disabled,true);});
check('reusable copy token',()=>{controls.patText.value=legacy; context.setPatDirty(false); context.refreshPatternMeta(); handlers.token(); assert.equal(copied.at(-1).text,'{{{SHERIFF::PATTERN_REGION}}}');});
check('new blank patterns default to template',()=>{
  controls.patPortal.value='fixture'; controls.patnewMode.value='reusable'; context.openPatNew();
  assert.equal(controls.patnewMode.value,'template'); assert.equal(controls.patnewTokenRow.hidden,true); assert.equal(controls.patnewToken.textContent,'');
});
check('new reusable preview',()=>{
  controls.patnewMode.value='reusable'; controls.patnewName.value='Region'; context.refreshPatNewMode();
  assert.equal(controls.patnewTokenRow.hidden,false); assert.equal(controls.patnewToken.textContent,'{{{SHERIFF::PATTERN_REGION}}}');
});
check('HTML exposes both labeled selectors',()=>{
  for(const id of ['pat-mode','pat-mode-hint','patnew-mode','patnew-mode-hint','patnew-token-row']) assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
  assert(html.includes('for="pat-mode"')); assert(html.includes('for="patnew-mode"'));
});
const tempRoot = path.resolve(os.tmpdir());
const fixture = fs.mkdtempSync(path.join(tempRoot,'sheriff-pattern-modes-'));
const core = path.join(fixture,'sheriff-core');
const moduleDest = path.join(core,'modules/sheriff_patterns/patterns.gbln');
fs.mkdirSync(path.dirname(moduleDest),{recursive:true});
fs.copyFileSync(path.join(root,'sheriff-core/modules/sheriff_patterns/patterns.gbln'),moduleDest);
const fencesDest=path.join(core,'modules/markdown_core/fenced_code.gbln');fs.mkdirSync(path.dirname(fencesDest),{recursive:true});fs.copyFileSync(path.join(root,'sheriff-core/modules/markdown_core/fenced_code.gbln'),fencesDest);
const cases = [
  {name:'Legacy',fields:'government = Monarchy',mode:'reusable',value:'Monarchy'},
  {name:'Filled',fields:'@mode = reusable\ngovernment = Republic',mode:'reusable',value:'Republic'},
  {name:'Blank',fields:'@mode = template\ngovernment =',mode:'template'},
  {name:'Filled template',fields:'@mode = template\ngovernment = Democracy',mode:'template',value:'Democracy'},
  {name:'Horizontal',orientation:'horizontal',fields:'@mode = template\nparties = [[Guild]]',mode:'template',value:'[[Guild]]'},
  {name:'Case',fields:'  @MODE = TEMPLATE  \ncreator = Ada',mode:'template',value:'Ada'},
  {name:'Last mode',fields:'@mode = template\n@mode = reusable\ncreator = Grace',mode:'reusable',value:'Grace'},
  {name:'Unknown mode',fields:'@mode = unknown\ncreator = Lin',mode:'reusable',value:'Lin'},
  {name:'Ordinary field',fields:'@model = Example\ncreator = Ada',mode:'reusable',value:'Example'}
];
fs.writeFileSync(path.join(core,'cases.json'),JSON.stringify(cases));
function portal(name,body){const dir=path.join(fixture,'site/portals',name,'patterns');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'mixed.txt'),body);}
portal('one','::: pattern vertical Shared\n@mode = reusable\ncreator = Ada\n:::\n::: pattern vertical Blank\n@mode = template\ncreator =\n:::\n::: pattern horizontal Legacy\ncreator = Grace\n:::\n');
portal('two','::: pattern vertical Shared\n@mode = template\ncreator = Elsewhere\n:::\n::: pattern vertical Other\ncreator = Lin\n:::\n');
fs.writeFileSync(path.join(core,'code_sample.txt'),['```md','::: pattern vertical Example','@mode = template','creator = Ada',':::','```'].join('\n'));
const harness = String.raw`import modules/sheriff_patterns/patterns as patterns
cases | :read_json("cases.json")
for example in cases
    html | patterns::render_pattern_block(example{"orientation"} ?? "vertical", example{"name"}, example{"fields"})
    :say("RENDER_CHECK " + :json_stringify({"name": example{"name"}, "mode": patterns::pattern_mode(example{"fields"}), "html": html}))
xx
code | :read_text("code_sample.txt")
code_ctx | patterns::apply_patterns({"body": code})
:say("CODE_CHECK " + :json_stringify({"before": code, "after": code_ctx{"body"}}))
patterns::publish_patterns({"portal": "one"})
:say("PUBLISH_CHECK " + :json_stringify({
    "phase": "first", "shared": resolve_token("{{{SHERIFF::PATTERN_SHARED}}}"),
    "blank": resolve_token("{{{SHERIFF::PATTERN_BLANK}}}"), "legacy": resolve_token("{{{SHERIFF::PATTERN_LEGACY}}}")
}))
:write_text!("../site/portals/one/patterns/mixed.txt", "::: pattern vertical Shared\n@mode = template\ncreator = Ada\n:::\n")
patterns::publish_patterns({"portal": "one"})
:say("PUBLISH_CHECK " + :json_stringify({"phase": "changed", "inline": patterns::render_pattern_block("vertical", "Shared", "creator = Page-specific"), "shared": resolve_token("{{{SHERIFF::PATTERN_SHARED}}}"), "legacy": resolve_token("{{{SHERIFF::PATTERN_LEGACY}}}")}))
patterns::publish_patterns({"portal": "two"})
:say("PUBLISH_CHECK " + :json_stringify({"phase": "second", "inline": patterns::render_pattern_block("vertical", "Shared", "creator = Page-specific"), "absent": patterns::render_pattern_block("vertical", "Blank", "creator = Standalone"), "shared": resolve_token("{{{SHERIFF::PATTERN_SHARED}}}"), "legacy": resolve_token("{{{SHERIFF::PATTERN_LEGACY}}}"), "other": resolve_token("{{{SHERIFF::PATTERN_OTHER}}}")}))
`;
fs.writeFileSync(path.join(core,'verify.gbln'),harness);
const result = spawnSync('goblin',['run','verify.gbln'],{cwd:core,encoding:'utf8',timeout:30000});
if(result.status!==0) throw new Error('Isolated Goblin checks failed in '+fixture+'\n'+result.stdout+'\n'+result.stderr);
function records(prefix){return result.stdout.split(/\r?\n/).filter(line=>line.startsWith(prefix+' ')).map(line=>JSON.parse(line.slice(prefix.length+1)));}
const rendered = records('RENDER_CHECK');
assert.equal(rendered.length,cases.length);
for(let i=0;i<cases.length;i++) check('render '+cases[i].name,()=>{
  const expected=cases[i],actual=rendered[i];
  assert.equal(actual.mode,expected.mode); assert(actual.html.includes('data-pattern-mode="'+expected.mode+'"'));
  assert.equal(actual.html.includes('sheriff-pattern-canonical'),expected.mode==='reusable');
  assert(!actual.html.includes('sheriff-pattern-row-@mode"'));
  if(expected.name!=='Ordinary field') assert(!actual.html.includes('@mode'));
  if(expected.value) assert(actual.html.includes(expected.value));
  if(expected.orientation) assert(actual.html.includes('sheriff-pattern-'+expected.orientation));
});
check('code samples remain unrendered',()=>{const [code]=records('CODE_CHECK');assert.equal(code.before,code.after);});
const phases=records('PUBLISH_CHECK'); assert.equal(phases.length,3);
check('only reusable and legacy blocks register',()=>{
  assert(phases[0].shared.includes('Ada')); assert(phases[0].legacy.includes('Grace')); assert(!phases[0].blank.includes('<aside'));
});
check('switching mode clears the former token',()=>{assert(!phases[1].shared.includes('<aside'));assert(!phases[1].legacy.includes('<aside'));});
check('older inline copies inherit template mode',()=>{assert(phases[1].inline.includes('Page-specific'));assert(!phases[1].inline.includes('sheriff-pattern-canonical'));assert(phases[1].inline.includes('data-pattern-mode="template"'));});
check('portal mode metadata is refreshed',()=>{assert(!phases[2].inline.includes('sheriff-pattern-canonical'));assert(phases[2].absent.includes('sheriff-pattern-canonical'));});
check('portal-local tokens do not leak',()=>{assert(!phases[2].shared.includes('<aside'));assert(!phases[2].legacy.includes('<aside'));assert(phases[2].other.includes('Lin'));});
check('served Desk assets match sources',()=>{
  for(const rel of ['index.html','admin/admin.js','admin/admin.css','admin/help.js']) assert.equal(fs.readFileSync(path.join(root,'sheriff-core/desk',rel),'utf8'),fs.readFileSync(path.join(root,'dist',rel),'utf8'));
});
const resolved=path.resolve(fixture);
assert.equal(path.dirname(resolved),tempRoot);assert(path.basename(resolved).startsWith('sheriff-pattern-modes-'));
fs.rmSync(resolved,{recursive:true,force:true});
console.log('Passed '+count+' pattern-mode checks covering rendering, registration, copying, mode changes, new-pattern defaults, code samples, and served assets. No site builds run.');