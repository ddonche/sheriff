// Frontend-only source adapter. Unsupported Sheriff syntax stays opaque.
// Original top-level slices are reused whenever their document nodes are unchanged.
export function splitPage(text) {
  const first=/^\uFEFF?\^\^\^\^[ \t]*\n/.exec(text);
  if(!first)return {prefix:'',body:text};
  const end=/^\^\^\^\^[ \t]*(?:\n|$)/gm;end.lastIndex=first[0].length;
  const close=end.exec(text);if(!close)throw Error('Close the frontmatter with ^^^^ in Source before using Visual.');
  return {prefix:text.slice(0,close.index+close[0].length),body:text.slice(close.index+close[0].length)};
}
const plain=text=>text?{type:'text',text}:null;
function textNode(text,marks){return text?{type:'text',text,...(marks.length?{marks}: {})}:null;}
export function inline(text,marks=[],escaped=false) {
  const out=[];let i=0,buffer='';const flush=()=>{if(buffer)out.push(textNode(buffer,marks));buffer='';};
  while(i<text.length){
    if(escaped&&text[i]==='\\'&&/[\\*`_[\]{}<>|~]/.test(text[i+1]||'')){buffer+=text[i+1];i+=2;continue;}
    if(text.startsWith('[^',i)){
      const citation=/^\[\^([^\]\r\n]+)\]/.exec(text.slice(i));if(!citation)return null;
      flush();out.push({type:'sheriffCitation',attrs:{raw:citation[0],label:citation[1]},...(marks.length?{marks}: {})});i+=citation[0].length;continue;
    }
    if(text.startsWith('[[',i)){
      const end=text.indexOf(']]',i+2);if(end<0)return null;flush();const raw=text.slice(i,end+2),inner=raw.slice(2,-2),parts=inner.split('|');
      if(/^(icon\||image:|video:|category:)/i.test(inner))out.push({type:'sheriffInline',attrs:{raw,label:parts[0].replace(/:.*$/,'')}});
      else {const target=parts[0],label=parts.slice(1).join('|')||target;if(!target||/[\[\]\n]/.test(label))return null;out.push(textNode(label,[...marks,{type:'sheriffLink',attrs:{target}}]));}
      i=end+2;continue;
    }
    if(text.startsWith('{{{',i)){
      const end=text.indexOf('}}}',i+3);if(end<0)return null;flush();const raw=text.slice(i,end+3);out.push({type:'sheriffInline',attrs:{raw,label:raw.slice(3,-3)}});i=end+3;continue;
    }
    const delimiter=text.startsWith('**',i)?'**':text[i]==='*'?'*':text[i]==='`'?'`':null;
    if(delimiter){let end=text.indexOf(delimiter,i+delimiter.length);while(escaped&&end>=0&&(text.slice(0,end).match(/\\+$/)?.[0].length||0)%2)end=text.indexOf(delimiter,end+delimiter.length);if(end<0||end===i+delimiter.length)return null;flush();const value=text.slice(i+delimiter.length,end),mark={type:delimiter==='**'?'bold':delimiter==='*'?'italic':'code'};const children=delimiter==='`'?[textNode(value,[...marks,mark])]:inline(value,[...marks,mark],escaped);if(!children)return null;out.push(...children);i=end+delimiter.length;continue;}
    // Protect constructs we cannot faithfully edit yet (HTML, Markdown links, escapes…).
    if(/[\[\]<>\\_~{}]/.test(text[i]))return null;
    buffer+=text[i++];
  }
  flush();return out;
}
export function protectedNode(raw,label='Sheriff source') {return {type:'sheriffBlock',attrs:{raw,label}};}
// Forms edit only the requested pattern line. Keep spacing, directives, and
// unrecognized rows verbatim; this is an editor adapter, not a build renderer.
export function parsePattern(raw){
  const lines=raw.match(/[^\n]*(?:\n|$)/g)?.filter(Boolean)||[];
  const header=/^([ \t]*:::[ \t]+pattern[ \t]+)(vertical|horizontal)([ \t]+)([^\r\n]+?)([ \t]*\r?\n)$/i.exec(lines[0]||'');
  if(!header||!/^[ \t]*:::[ \t]*(?:\r?\n)?$/.test(lines.at(-1)||''))return null;
  const result={header:lines[0],footer:lines.at(-1),name:header[4],orientation:header[2].toLowerCase(),eol:lines[0].endsWith('\r\n')?'\r\n':'\n',sections:[{tab:null,lines:[]}]};
  for(const text of lines.slice(1,-1)){
    const ending=text.endsWith('\r\n')?'\r\n':text.endsWith('\n')?'\n':'';
    const body=text.slice(0,text.length-ending.length);
    if(/^\s*:::|^\s*(?:```|~~~)/.test(body))return null;
    const tab=/^([ \t]*@tab [ \t]*)(.*?)([ \t]*)$/.exec(body);
    if(tab){if(!tab[2].trim())return null;result.sections.push({tab:{text,prefix:tab[1],label:tab[2],suffix:tab[3],ending},lines:[]});continue;}
    if(/^\s*@tab\s*$/.test(body))return null;
    const match=/^([ \t]*)([^=@\r\n][^=\r\n]*?)([ \t]*=[ \t]*)(.*?)([ \t]*)$/.exec(body);
    const field=match&&!/^\s*[#@]/.test(body)?{key:match[2],value:match[4],prefix:match[1],separator:match[3],suffix:match[5]}:null;
    result.sections.at(-1).lines.push({text,ending,field});
  }
  return result;
}
export function editPattern(raw,change){
  const pattern=parsePattern(raw);if(!pattern)throw Error('Edit this pattern in Source to preserve its structure.');
  const oneLine=value=>{if(/[\r\n]/.test(value))throw Error('Pattern fields and tab names must stay on one line.');return value;};
  const label=value=>{value=oneLine(value).trim();if(!value)throw Error('Enter a name.');return value;};
  const fieldKey=value=>{value=label(value);if(/[=@]/.test(value)||/^#|^:::/.test(value))throw Error('Field names cannot contain = or @, or start with # or :::.');return value;};
  const section=pattern.sections[change.section],line=section?.lines[change.line];
  switch(change.type){
    case 'name': {const name=label(change.value);if(name!==pattern.name){const match=/^([ \t]*:::[ \t]+pattern[ \t]+\S+[ \t]+).*?([ \t]*\r?\n)$/.exec(pattern.header);pattern.header=match[1]+name+match[2];}break;}
    case 'orientation': if(!['vertical','horizontal'].includes(change.value))throw Error('Choose vertical or horizontal.');if(change.value!==pattern.orientation)pattern.header=pattern.header.replace(/^(\s*:::\s+pattern\s+)\S+/i,'$1'+change.value);break;
    case 'value': case 'key': {
      if(!line?.field)throw Error('This field is no longer available.');
      const value=change.type==='value'?oneLine(change.value):fieldKey(change.value),field=line.field;
      if(value!==field[change.type==='value'?'value':'key']){field[change.type==='value'?'value':'key']=value;line.text=field.prefix+field.key+field.separator+field.value+field.suffix+line.ending;}break;
    }
    case 'tab': if(!section?.tab)throw Error('Choose an edition tab.');if(change.value!==section.tab.label){const value=label(change.value);section.tab.text=section.tab.prefix+value+section.tab.suffix+section.tab.ending;}break;
    case 'add-field': if(!section)throw Error('Choose a section.');section.lines.push({text:'field = '+pattern.eol});break;
    case 'remove-field': if(!line?.field)throw Error('This field is no longer available.');section.lines.splice(change.line,1);break;
    case 'add-tab': pattern.sections.push({tab:{text:'@tab '+label(change.value)+pattern.eol},lines:[]});break;
    case 'remove-tab': if(!section?.tab)throw Error('Choose an edition tab.');pattern.sections.splice(change.section,1);break;
    case 'move-tab': {const to=change.section+change.delta;if(!section?.tab||!pattern.sections[to]?.tab)throw Error('This tab cannot move further.');pattern.sections.splice(change.section,1);pattern.sections.splice(to,0,section);break;}
    default: throw Error('Unknown pattern edit.');
  }
  return pattern.header+pattern.sections.map(section=>(section.tab?.text||'')+section.lines.map(line=>line.text).join('')).join('')+pattern.footer;
}
export const admonitionTypes=['note','tip','warning','important','example','strategy','lore','spoiler'];
export function admonitionHeader(raw){
  const match=/^[ \t]*:::[ \t]*(?:(\[\[icon\|[^\n]*?\]\])[ \t]*)?([a-z]+)(?:[ \t]+([^\n]*))?\n/i.exec(raw);
  if(!match||!admonitionTypes.includes(match[2].toLowerCase())||!/(?:^|\n)[ \t]*:::[ \t]*$/.test(raw))return null;
  return {header:match[0],kind:match[2].toLowerCase(),title:match[3]||'',icon:match[1]||''};
}
// Languages are suggestions, never an allowlist. Keep fence syntax out of this field.
export const validCodeLanguage=value=>typeof value==='string'&&!/[\s`~\x00-\x1f\x7f]/.test(value);
export function parseCodeFence(raw){
  const opening=/^( {0,3})(`{3,}|~{3,})([ \t]*)([^\r\n]*)(\r?\n)/.exec(raw);
  if(!opening||opening[2][0]==='`'&&opening[4].includes('`'))return null;
  const closing=/(?:^|\n)( {0,3})(`{3,}|~{3,})([ \t]*\r?)$/.exec(raw.slice(opening[0].length));
  // An empty block's closing line immediately follows its opener.
  const rest=raw.slice(opening[0].length),close=closing||/^( {0,3})(`{3,}|~{3,})([ \t]*\r?)$/.exec(rest);
  if(!close||close[2][0]!==opening[2][0]||close[2].length<opening[2].length)return null;
  const info=/^(\S*)(.*)$/.exec(opening[4]),language=info[1];if(!validCodeLanguage(language))return null;
  const code=rest.slice(0,close.index).replace(/\r$/,'');
  return {indent:opening[1],marker:opening[2],spacing:opening[3],language,suffix:info[2],eol:opening[5],code,closingIndent:close[1],closingMarker:close[2],closingSpace:close[3]};
}
function codeSource(node,record){
  const language=node.attrs?.language||'';if(!validCodeLanguage(language))throw Error('Use a language name without spaces or fence characters.');
  const old=record?.code,code=(node.content||[]).map(n=>n.text||'').join('');
  if(!language&&old?.suffix.trim())throw Error('This code fence has extra options. Remove its language in Source to preserve those options.');
  if(old&&old.code===code){const start=old.indent.length+old.marker.length+old.spacing.length;return record.raw.slice(0,start)+language+record.raw.slice(start+old.language.length);}
  const char=old?.marker[0]||'`';let length=old?.marker.length||3;
  for(const line of code.split('\n')){const run=/^ {0,3}(`+|~+)/.exec(line)?.[1];if(run?.[0]===char)length=Math.max(length,run.length+1);}
  const marker=char.repeat(length),spacing=old?.spacing||'';
  const header=(old?.indent||'')+marker+spacing+language+(old?.suffix||'')+(old?.eol||'\n');
  return header+code+(code?(old?.eol||'\n'):'')+(old?.closingIndent||'')+char.repeat(Math.max(length,old?.closingMarker.length||0))+(old?.closingSpace||'');
}
// Split only table separators, keeping Sheriff link/token pipes and inline code intact.
export function tableCells(line){
  const text=line.trim(),cells=[];let value='',separators=0;
  for(let i=0;i<text.length;){
    if(text[i]==='\\'&&i+1<text.length){value+=text.slice(i,i+2);i+=2;continue;}
    const open=text.startsWith('[[',i)?'[[':text.startsWith('{{{',i)?'{{{':text[i]==='`'?'`':null;
    if(open){const marker=open==='`'?/^`+/.exec(text.slice(i))[0]:open,close=open==='[['?']]':open==='{{{'?'}}}':marker,end=text.indexOf(close,i+marker.length);if(end<0)return null;value+=text.slice(i,end+close.length);i=end+close.length;continue;}
    if(text[i]==='|'){cells.push(value.trim());value='';separators++;i++;}else value+=text[i++];
  }
  if(!separators)return null;cells.push(value.trim());if(text.startsWith('|'))cells.shift();if(!value&&text.endsWith('|'))cells.pop();return cells;
}
function tableInline(text){
  const result=[];for(const [i,part] of text.split(/<br\s*\/?>/i).entries()){const nodes=inline(part,[],true);if(!nodes)return null;if(i)result.push({type:'hardBreak'});result.push(...nodes);}return result;
}
export function parseTable(raw){
  const lines=raw.split('\n'),header=tableCells(lines[0]||''),divider=tableCells(lines[1]||'');
  if(!header?.length||divider?.length!==header.length||!divider.every(c=>/^:?-+:?$/.test(c)))return null;
  const align=divider.map(c=>c.startsWith(':')?(c.endsWith(':')?'center':'left'):c.endsWith(':')?'right':null),rows=[header,...lines.slice(2).map(tableCells)];
  if(rows.some(row=>!row||row.length!==header.length))return null;
  const content=[];for(const [index,row] of rows.entries()){const cells=[];for(const [column,text] of row.entries()){const content=tableInline(text);if(!content)return null;cells.push({type:index?'tableCell':'tableHeader',attrs:{align:align[column]},content:[{type:'paragraph',content}]});}content.push({type:'tableRow',content:cells});}
  return {type:'table',content};
}
function tableSource(node){
  const rows=node.content||[],width=rows[0]?.content?.length;if(!width)throw Error('A table needs at least one column.');
  const line=row=>'| '+row.content.map(cell=>{if(cell.attrs?.colspan>1||cell.attrs?.rowspan>1||cell.content?.length!==1||cell.content[0].type!=='paragraph')throw Error('Edit complex tables in Source to preserve their structure.');return inlineSource(cell.content[0].content,true);}).join(' | ')+' |';
  if(rows.some(row=>row.content.length!==width))throw Error('Each table row needs the same number of columns.');
  const divider='| '+rows[0].content.map(cell=>({left:':---',center:':---:',right:'---:'})[cell.attrs?.align]||'---').join(' | ')+' |';
  return [line(rows[0]),divider,...rows.slice(1).map(line)].join('\n');
}
export function videoSyntax(attrs){return '[[video:'+attrs.provider+'|'+attrs.id+'|'+attrs.size+'|'+attrs.align+'|'+attrs.caption+']]';}
export function parseVideo(raw){
  const m=/^\[\[video:(youtube|vimeo)\|([^|\]\r\n]+)(?:\|([^|\]\r\n]*))?(?:\|([^|\]\r\n]*))?(?:\|([^|\[\]\r\n]*))?\]\]$/i.exec(raw);if(!m)return null;
  const provider=m[1].toLowerCase(),id=m[2].trim(),size=(m[3]||'full').trim().toLowerCase(),align=(m[4]||'center').trim().toLowerCase(),caption=m[5]||'';
  if(!(provider==='youtube'?/^[a-z0-9_-]{1,128}$/i:/^[0-9]{1,32}$/).test(id)||!['full','half','thumb'].includes(size)||!['left','center','right'].includes(align))return null;
  return {raw,provider,id,size,align,caption};
}
function block(raw) {
  const video=parseVideo(raw);if(video)return {type:'sheriffVideo',attrs:video};
  const table=parseTable(raw);if(table)return table;
  const image=/^\[\[image:([^|\]]+)(?:\|([^|\]]*))?(?:\|([^|\]]*))?(?:\|([^\]]*))?\]\]$/i.exec(raw);
  if(image)return {type:'sheriffImage',attrs:{raw,path:image[1],size:image[2]||'full',align:image[3]||'center',caption:image[4]||''}};
  const fence=/^\s*:::\s*(.*)/.exec(raw);if(fence)return protectedNode(raw,fence[1]||'Sheriff block');
  if(/^\s*(`{3,}|~{3,})/.test(raw)){const code=parseCodeFence(raw);return code?{type:'codeBlock',attrs:{language:code.language},content:code.code?[plain(code.code)]:[]}:protectedNode(raw,'Code block · edit in Source');}
  if(/^\s*\{\{\{/.test(raw))return protectedNode(raw,'Sheriff token');
  if(/^\s*(?:<|\||>| {4}|\t)/.test(raw)||/\n\s*(?:[-=]{3,}|\|)/.test(raw))return protectedNode(raw);
  const heading=/^(#{1,6}) +(.+)$/.exec(raw);
  if(heading){const content=inline(heading[2]);return content?{type:'heading',attrs:{level:heading[1].length},content}:protectedNode(raw);}
  if(/^(?:---+|\*\*\*+|___+)$/.test(raw))return {type:'horizontalRule'};
  const lines=raw.split('\n'),list=lines[0].match(/^(?:([-+*]) |(\d+)\. )/);
  if(list){const ordered=!!list[2],items=[];for(const line of lines){const item=(ordered?/^\d+\. (.+)$/:/^[-+*] (.+)$/).exec(line);if(!item)return protectedNode(raw,'List · edit in Source');const content=inline(item[1]);if(!content)return protectedNode(raw,'List · edit in Source');items.push({type:'listItem',content:[{type:'paragraph',content}]});}return {type:ordered?'orderedList':'bulletList',...(ordered?{attrs:{start:Number(list[2])}}:{}),content:items};}
  const content=inline(raw);return content?{type:'paragraph',content}:protectedNode(raw);
}
export function fingerprint(node){const clean=n=>{const out={...n};if(out.attrs){out.attrs={...out.attrs};delete out.attrs.sourceId;if(!Object.keys(out.attrs).length)delete out.attrs;}if(out.content)out.content=out.content.map(clean);return out;};return JSON.stringify(clean(node));}
export function parsePage(text,{frontmatter=true}={}) {
  const {prefix,body}=frontmatter?splitPage(text):{prefix:'',body:text},records=new Map();let sequence=0;
  function parseBlocks(body,base,level=0){const content=[];
  const lines=body.match(/[^\n]*(?:\n|$)/g)?.filter(Boolean)||[];let i=0,offset=0,cursor=0;
  while(i<lines.length){if(!lines[i].trim()){offset+=lines[i++].length;continue;}
    const start=offset;let end=i+1,complete=true;const first=lines[i].trim(),fence=/^(`{3,}|~{3,})/.exec(first),definition=/^[ \t]{0,3}\[\^[^\]\r\n]+\]:/.test(lines[i]),quote=/^ {0,3}>/.test(lines[i]);
    if(definition){
      // Keep a run of definitions and indented continuation paragraphs together,
      // including their original blank lines. Never move definitions past prose.
      while(end<lines.length){
        if(/^[ \t]{0,3}\[\^[^\]\r\n]+\]:|^(?: {4}|\t)/.test(lines[end])){end++;continue;}
        if(!lines[end].trim()){let next=end;while(next<lines.length&&!lines[next].trim())next++;if(next<lines.length&&/^[ \t]{0,3}\[\^[^\]\r\n]+\]:|^(?: {4}|\t)/.test(lines[next])){end=next;continue;}}
        break;
      }
    }
    else if(quote){while(end<lines.length){if(/^ {0,3}>/.test(lines[end])){end++;continue;}if(!lines[end].trim()){let next=end;while(next<lines.length&&!lines[next].trim())next++;if(next<lines.length&&/^ {0,3}>/.test(lines[next])){end=next;continue;}}break;}}
    else if(/^:::\s*\S/.test(first)){let depth=1,code=null;while(end<lines.length&&depth){const t=lines[end++].trim(),f=/^(`{3,}|~{3,})/.exec(t);if(code){if(new RegExp('^'+code[0]+'{'+code.length+',}\\s*$').test(t))code=null;continue;}if(f){code=f[1];continue;}if(/^:::\s*\S/.test(t))depth++;else if(t===':::')depth--;}complete=depth===0;}
    else if(fence){while(end<lines.length){if(new RegExp('^'+fence[1][0]+'{'+fence[1].length+',}\\s*$').test(lines[end++].trim()))break;}}
    else if(tableCells(first)&&tableCells(lines[i+1]||'')?.every(c=>/^:?-+:?$/.test(c))){end=i+2;while(end<lines.length&&lines[end].trim()&&tableCells(lines[end]))end++;}
    else if(/^#{1,6} |^\[\[(?:image:|video:).*\]\]$|^(?:---+|\*\*\*+)$/i.test(first)){}
    else {while(end<lines.length&&lines[end].trim()&&!/^#{1,6} |^\[\[video:.*\]\]\s*$|^:::|^```|^~~~|^ {0,3}>|^[ \t]{0,3}\[\^[^\]\r\n]+\]:/.test(lines[end]))end++;}
    const chunk=lines.slice(i,end).join(''),raw=chunk.replace(/\n$/,''),id='source-'+sequence++;
    const admon=complete&&level<32?admonitionHeader(raw):null;let node,extra={};
    if(definition)node=protectedNode(raw,'References & footnotes');
    else if(quote&&level<32){
      const parsed=parseBlocks(raw.split('\n').map(line=>line.replace(/^ {0,3}>[ \t]?/,'')).join('\n'),base+start,level+1);
      const supported=n=>!['sheriffBlock','sheriffImage','sheriffAdmonition'].includes(n.type)&&(n.content||[]).every(supported);
      if(parsed.content.every(supported)){node={type:'blockquote',content:parsed.content};extra={quote:true,tail:parsed.tail};}else node=protectedNode(raw,'Blockquote · edit in Source');
    }
    else if(admon){const close=raw.lastIndexOf(':::');const footer=raw.slice(raw.lastIndexOf('\n',close)+1),inner=raw.slice(admon.header.length,raw.length-footer.length),parsed=parseBlocks(inner,base+start+admon.header.length,level+1);node={type:'sheriffAdmonition',attrs:{kind:admon.kind,title:admon.title,icon:admon.icon},content:parsed.content};extra={admon,footer,tail:parsed.tail};}
    else node=block(raw);
    if(node.type==='codeBlock')extra.code=parseCodeFence(raw);
    node.attrs={...node.attrs,sourceId:id};content.push(node);
    records.set(id,{raw,leading:body.slice(cursor,start),start:base+start,previousId:content.at(-2)?.attrs?.sourceId??null,fingerprint:null,...extra});
    offset+=chunk.length;cursor=offset-(chunk.endsWith('\n')?1:0);i=end;
  }
  if(!content.length)content.push({type:'paragraph'});
  return {tail:body.slice(cursor),content};}
  const parsed=parseBlocks(body,prefix.length);
  return {prefix,tail:parsed.tail,records,doc:{type:'doc',content:parsed.content}};
}
function inlineSource(nodes=[],inTable=false) {
  let out='',active=[];const delimiter={bold:'**',italic:'*',code:'`'};
  const append=(value,next)=>{let common=0;while(common<active.length&&common<next.length&&active[common]===next[common])common++;for(let n=active.length-1;n>=common;n--)out+=delimiter[active[n]];for(let n=common;n<next.length;n++)out+=delimiter[next[n]];active=next;out+=value;};
  for(let i=0;i<nodes.length;){const node=nodes[i];
    // Keep one Sheriff link around adjacent marked text runs.
    const link=node.marks?.find(m=>m.type==='sheriffLink');
    if(link){const group=[];while(i<nodes.length&&nodes[i].marks?.some(m=>m.type==='sheriffLink'&&m.attrs.target===link.attrs.target)){const n=nodes[i++];group.push({...n,marks:n.marks.filter(m=>m.type!=='sheriffLink')});}const outer=(group[0].marks||[]).map(m=>m.type).filter(type=>delimiter[type]&&group.every(n=>n.marks.some(m=>m.type===type)));const label=inlineSource(group.map(n=>({...n,marks:n.marks.filter(m=>!outer.includes(m.type))})));append('[['+link.attrs.target+(label===link.attrs.target?'':'|'+label)+']]',outer);continue;}
    const next=(node.marks||[]).map(m=>m.type).filter(m=>delimiter[m]);
    if(node.type==='text'){let text=next.includes('code')?node.text:node.text.replace(/[\\*`_[\]{}<>]/g,'\\$&');if(inTable){if(!next.includes('code'))text=text.replace(/[|~]/g,'\\$&');text=text.replace(/\r?\n/g,'<br>');}append(text,next);}else if(node.type==='hardBreak')append(inTable?'<br>':'  \n',next);else if(node.type==='sheriffInline'||node.type==='sheriffCitation')append(node.attrs.raw,next);
    i++;
  }
  for(const mark of active.reverse())out+=delimiter[mark];return out;
}
function serializeBlock(node,model,seen,base){
  if(node.type==='table')return tableSource(node);
  if(node.type==='codeBlock')return codeSource(node,model.records.get(node.attrs?.sourceId));
  if(node.type==='blockquote'){
    const record=model.records.get(node.attrs?.sourceId),inner=serializeNodes(model,node.content,seen,base,!record?.quote)+(record?.quote?record.tail:'');
    return inner.split('\n').map(line=>'>'+ (line?' '+line:'')).join('\n');
  }
  if(node.type==='sheriffAdmonition'){
    const a=node.attrs,record=model.records.get(a.sourceId),old=record?.admon;
    const header=old&&old.kind===a.kind&&old.title===a.title&&old.icon===a.icon?old.header:'::: '+(a.icon?a.icon+' ':'')+a.kind+(a.title?' '+a.title:'')+'\n';
    let body=serializeNodes(model,node.content,seen,base+header.length)+(record?.tail??'\n');
    if(body&&!body.endsWith('\n'))body+='\n';
    return header+body+(record?.footer||':::');
  }
  if(node.type==='sheriffBlock'||node.type==='sheriffVideo'||node.type==='sheriffImage')return node.attrs.raw;
  if(node.type==='heading')return '#'.repeat(node.attrs.level)+' '+inlineSource(node.content);
  if(node.type==='paragraph')return inlineSource(node.content);
  if(node.type==='horizontalRule')return '---';
  if(node.type==='bulletList'||node.type==='orderedList')return (node.content||[]).map((item,i)=>{const children=item.content||[];return (node.type==='orderedList'?((node.attrs?.start||1)+i)+'. ':'- ')+children.map((c,j)=>{const value=serializeBlock(c,model,seen,base);return j?'\n'+value.split('\n').map(l=>'  '+l).join('\n'):value;}).join('');}).join('\n');
  throw Error('This content cannot be written safely. Switch to Source.');
}
function serializeNodes(model,nodes=[],seen,base,stripFirst=false){
  let body='',previousId=null,first=true;for(const node of nodes){const id=node.attrs?.sourceId,record=!seen.has(id)&&model.records.get(id);seen.add(id);let leading=record?record.leading:body?'\n\n':'';
    if(first&&stripFirst)leading='';else if(body&&record&&record.previousId!==previousId&&!leading.startsWith('\n\n'))leading='\n\n'+leading.replace(/^\n/,'');
    const start=base+body.length+leading.length;
    let raw;if(record&&record.fingerprint===fingerprint(node)){raw=record.raw;const delta=start-record.start;const shift=n=>{for(const child of n.content||[]){const r=model.records.get(child.attrs?.sourceId);if(r){r.start+=delta;r.latestRaw=r.raw;}shift(child);}};shift(node);}else raw=serializeBlock(node,model,seen,start);
    if(record){record.start=start;record.latestRaw=raw;}body+=leading+raw;previousId=record?id:'new-block';first=false;
  }return body;
}
export function serializePage(model,doc) {
  const separator=model.prefix&&!model.prefix.endsWith('\n')?'\n':'';
  const body=serializeNodes(model,doc.content,new Set(),model.prefix.length+separator.length);
  return model.prefix+(body?separator:'')+body+model.tail;
}
// Source selection for a newly inserted callout must work before it is reloaded.
// Clone positional records so selecting a fragment cannot move document offsets.
export function serializeFragment(model,node){
  const records=new Map([...model.records].map(([id,record])=>[id,{...record}]));
  const record=records.get(node.attrs?.sourceId);if(record)record.leading='';
  return serializePage({prefix:'',tail:'',records},{content:[node]});
}
