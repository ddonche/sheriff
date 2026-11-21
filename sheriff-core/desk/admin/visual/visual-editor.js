import {Editor,Node,Mark,Extension} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import CodeBlock from '@tiptap/extension-code-block';
import {closeHistory} from '@tiptap/pm/history';
import {TextSelection,Plugin,PluginKey} from '@tiptap/pm/state';
import {Decoration,DecorationSet} from '@tiptap/pm/view';
import {tableEditing,isInTable,selectedRect,goToNextCell,addRowBefore,addRowAfter,deleteRow,addColumnBefore,addColumnAfter,deleteColumn,deleteTable} from '@tiptap/pm/tables';
import {parsePage,splitPage,fingerprint,serializePage,inline,protectedNode,admonitionTypes,serializeFragment,parsePattern,editPattern,validCodeLanguage,parseVideo,videoSyntax} from './visual-source.js';

const $=id=>document.getElementById(id),desk=window.SheriffDesk,context=window.SheriffPortalContext,source=$('ed-text');
const tabs=$('visual-mode-tabs'),surface=$('visual-surface'),toolbar=$('visual-toolbar'),notice=$('visual-status');
let editor=null,model=null,mode='source',key='',ownInput=false,revision=0,loaded='',switching=false,imageSelectionKey='',lastImageProperty='';
let editorScroll={source:0,visual:0};
// SVGs copied verbatim from sheriff-core/assets/icons (Lucide ISC; see visual-licenses.txt).
const editorIcons={"bold":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-bold\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M6 12h9a4 4 0 010 8H7a1 1 0 01-1-1V5a1 1 0 011-1h7a4 4 0 010 8\" />\n</svg>","italic":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-italic\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <line x1=\"19\" x2=\"10\" y1=\"4\" y2=\"4\" />\n  <line x1=\"14\" x2=\"5\" y1=\"20\" y2=\"20\" />\n  <line x1=\"15\" x2=\"9\" y1=\"4\" y2=\"20\" />\n</svg>","list":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-list\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M3 5h.01\" />\n  <path d=\"M3 12h.01\" />\n  <path d=\"M3 19h.01\" />\n  <path d=\"M8 5h13\" />\n  <path d=\"M8 12h13\" />\n  <path d=\"M8 19h13\" />\n</svg>","list-ordered":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-list-ordered\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M11 5h10\" />\n  <path d=\"M11 12h10\" />\n  <path d=\"M11 19h10\" />\n  <path d=\"M4 4h1v5\" />\n  <path d=\"M4 9h2\" />\n  <path d=\"M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02\" />\n</svg>","quote":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-quote\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z\" />\n  <path d=\"M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z\" />\n</svg>","link":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-link\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\" />\n  <path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\" />\n</svg>","undo-2":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-undo-2\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M9 14 4 9l5-5\" />\n  <path d=\"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11\" />\n</svg>","redo-2":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-redo-2\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"m15 14 5-5-5-5\" />\n  <path d=\"M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13\" />\n</svg>","image":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-image\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" ry=\"2\" />\n  <circle cx=\"9\" cy=\"9\" r=\"2\" />\n  <path d=\"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21\" />\n</svg>","star":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-star\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\" />\n</svg>","panels-top-left":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-panels-top-left\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" />\n  <path d=\"M3 9h18\" />\n  <path d=\"M9 21V9\" />\n</svg>","notebook-pen":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-notebook-pen\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4\" />\n  <path d=\"M2 6h4\" />\n  <path d=\"M2 10h4\" />\n  <path d=\"M2 14h4\" />\n  <path d=\"M2 18h4\" />\n  <path d=\"M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z\" />\n</svg>","pencil":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-pencil\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\" />\n  <path d=\"m15 5 4 4\" />\n</svg>","code-xml":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-code-xml\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"m18 16 4-4-4-4\" />\n  <path d=\"m6 8-4 4 4 4\" />\n  <path d=\"m14.5 4-5 16\" />\n</svg>","file-text":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-file-text\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\" />\n  <path d=\"M14 2v5a1 1 0 0 0 1 1h5\" />\n  <path d=\"M10 9H8\" />\n  <path d=\"M16 13H8\" />\n  <path d=\"M16 17H8\" />\n</svg>","replace":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-replace\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M14 4a1 1 0 0 1 1-1\" />\n  <path d=\"M15 10a1 1 0 0 1-1-1\" />\n  <path d=\"M21 4a1 1 0 0 0-1-1\" />\n  <path d=\"M21 9a1 1 0 0 1-1 1\" />\n  <path d=\"m3 7 3 3 3-3\" />\n  <path d=\"M6 10V5a2 2 0 0 1 2-2h2\" />\n  <rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\" />\n</svg>","trash-2":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-trash-2\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M10 11v6\" />\n  <path d=\"M14 11v6\" />\n  <path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6\" />\n  <path d=\"M3 6h18\" />\n  <path d=\"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\" />\n</svg>"};
Object.assign(editorIcons,{"plus":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-plus\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M5 12h14\" />\n  <path d=\"M12 5v14\" />\n</svg>","arrow-left":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-arrow-left\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"m12 19-7-7 7-7\" />\n  <path d=\"M19 12H5\" />\n</svg>","arrow-right":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-arrow-right\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M5 12h14\" />\n  <path d=\"m12 5 7 7-7 7\" />\n</svg>"});
editorIcons["file-code"]="<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-file-code\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\" />\n  <path d=\"M14 2v5a1 1 0 0 0 1 1h5\" />\n  <path d=\"M10 12.5 8 15l2 2.5\" />\n  <path d=\"m14 12.5 2 2.5-2 2.5\" />\n</svg>\n";
Object.assign(editorIcons,{"table-2":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-table-2\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M3 9h18\" />\n  <path d=\"M9 3v18\" />\n  <rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" />\n</svg>\n","rows-3":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-rows-3\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" />\n  <path d=\"M21 9H3\" />\n  <path d=\"M21 15H3\" />\n</svg>\n","columns-3":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-columns-3\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" />\n  <path d=\"M9 3v18\" />\n  <path d=\"M15 3v18\" />\n</svg>\n"});
// Both editor surfaces use this toolbar, command handling, and bundled Lucide artwork.
function createFormattingToolbar(element,prefix,getEditor){
  const id=name=>prefix+'-'+name;
  const button=(format,label,icon,shortcut='')=>`<button class="btn small" type="button" data-format="${format}" aria-label="${label}" title="${label}${shortcut?' ('+shortcut+')':''}"${['undo','redo'].includes(format)?'':' aria-pressed="false"'}>${editorIcons[icon]}</button>`;
  element.innerHTML=`<label class="sr-only" for="${id('block-type')}">Text style</label><select id="${id('block-type')}"><option value="paragraph">Paragraph</option>${[1,2,3,4,5,6].map(n=>`<option value="${n}">Heading ${n}</option>`).join('')}</select>`+
    button('bold','Bold','bold','Ctrl+B')+button('italic','Italic','italic','Ctrl+I')+
    button('bulletList','Bullet list','list')+button('orderedList','Numbered list','list-ordered')+button('blockquote','Blockquote','quote')+button('codeBlock','Code block','file-code','Ctrl+Alt+C')+`<button class="btn small" type="button" data-table-toggle aria-label="Table" title="Insert or edit table" aria-expanded="false" aria-pressed="false">${editorIcons['table-2']}</button>`+
    `<button class="btn small" type="button" id="${id('link-toggle')}" aria-label="Link" title="Link">${editorIcons.link}<span>Link</span></button><span class="visual-toolbar-divider" aria-hidden="true"></span>`+
    button('undo','Undo','undo-2','Ctrl+Z')+button('redo','Redo','redo-2','Ctrl+Shift+Z')+
    `<form id="${id('link-form')}" class="visual-link-form" hidden><label for="${id('link-target')}">Link to a page or URL</label><input id="${id('link-target')}" placeholder="All Pages Guide" autocomplete="off"><button class="btn small teal" type="submit">Apply link</button><button class="btn small" id="${id('link-remove')}" type="button">Remove link</button><button class="btn small" id="${id('link-cancel')}" type="button">Cancel</button><span class="visual-link-error" role="status"></span></form>`;
  const tableAction=(command,label,icon)=>`<button class="btn small" type="button" data-table-command="${command}">${editorIcons[icon]}<span>${label}</span></button>`;
  element.insertAdjacentHTML('beforeend',`<div class="visual-table-menu" hidden role="group" aria-label="Table controls">
    <div data-table-create><strong>Insert table</strong><div class="visual-table-dimensions"><label>Body rows<input data-table-field="rows" type="number" min="1" max="100" value="2"></label><label>Columns<input data-table-field="columns" type="number" min="1" max="20" value="2"></label><button type="button" class="btn small teal" data-table-insert>${editorIcons['table-2']} Insert table</button></div><p>A header row is included. Tab moves between cells; Ctrl+Enter continues below.</p><p role="status"></p></div>
    <div data-table-edit hidden><strong>Edit table</strong><div class="visual-table-actions">${tableAction('beforeRow','Row above','rows-3')}${tableAction('afterRow','Row below','rows-3')}${tableAction('deleteRow','Delete row','trash-2')}${tableAction('beforeColumn','Column left','columns-3')}${tableAction('afterColumn','Column right','columns-3')}${tableAction('deleteColumn','Delete column','trash-2')}</div><label class="visual-table-alignment">Column alignment <select data-table-field="align"><option value="">Default</option><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label><div class="visual-table-footer"><button type="button" class="btn small" data-table-source>${editorIcons['code-xml']} Edit in Source</button>${tableAction('deleteTable','Remove table','trash-2')}</div></div>
    <button class="btn small visual-table-close" type="button" data-table-close>Close</button></div>`);

  const field=name=>element.querySelector('#'+id(name)),form=field('link-form');
  // A compact Table menu stays attached to the existing formatting toolbar.
  const tableToggle=element.querySelector('[data-table-toggle]'),tableMenu=element.querySelector('.visual-table-menu');
  const tableField=name=>tableMenu.querySelector('[data-table-field="'+name+'"]');
  function closeTable(){tableMenu.hidden=true;tableToggle.setAttribute('aria-expanded','false');}
  function updateTable(){
    const target=getEditor(),inside=!!selectedTable(target);tableToggle.setAttribute('aria-pressed',String(inside));
    tableMenu.querySelector('[data-table-create]').hidden=inside;tableMenu.querySelector('[data-table-edit]').hidden=!inside;
    const disabled=source.disabled||!target||target.isActive('codeBlock');tableToggle.disabled=disabled;for(const control of tableMenu.querySelectorAll('button,input,select'))control.disabled=disabled;
    if(inside&&isInTable(target.state)){const rect=selectedRect(target.state),cell=rect.table.nodeAt(rect.map.map[rect.top*rect.map.width+rect.left]);tableField('align').value=cell?.attrs.align||'';}
    if(disabled)closeTable();
  }
  tableToggle.addEventListener('click',()=>{if(source.disabled)return;tableMenu.hidden=!tableMenu.hidden;tableToggle.setAttribute('aria-expanded',String(!tableMenu.hidden));form.hidden=true;updateTable();});
  tableMenu.querySelector('[data-table-insert]').addEventListener('click',()=>{
    const error=tableMenu.querySelector('[role=status]'),target=getEditor();if(insertTable(target,Number(tableField('rows').value),Number(tableField('columns').value))){error.textContent='';closeTable();update();}else error.textContent='Place the cursor in ordinary text. Choose 1–100 body rows and 1–20 columns.';
  });
  const commands={beforeRow:addRowBefore,afterRow:addRowAfter,deleteRow, beforeColumn:addColumnBefore,afterColumn:addColumnAfter,deleteColumn,deleteTable};
  for(const control of tableMenu.querySelectorAll('[data-table-command]'))control.addEventListener('click',()=>{tableCommand(getEditor(),commands[control.dataset.tableCommand]);closeTable();update();});
  tableField('align').addEventListener('change',()=>{alignTableColumn(getEditor(),tableField('align').value);closeTable();update();});
  tableMenu.querySelector('[data-table-source]').addEventListener('click',()=>{const selected=selectedTable(getEditor());if(!selected)return;const raw=serializeFragment(model,selected.node.toJSON());closeTable();if(getEditor()===admonitionEditor)closeAdmonitionProperties();editSource(selected.node.attrs.sourceId,raw);});
  tableMenu.querySelector('[data-table-close]').addEventListener('click',()=>{closeTable();getEditor()?.commands.focus();});
  element.addEventListener('keydown',event=>{if(event.key==='Escape'&&!tableMenu.hidden){event.preventDefault();closeTable();getEditor()?.commands.focus();}});
  document.addEventListener('pointerdown',event=>{if(!element.contains(event.target))closeTable();});


  element.addEventListener('mousedown',event=>{if(event.target.closest('button'))event.preventDefault();});
  function update(){
    const target=getEditor();if(!target)return;
    for(const control of element.querySelectorAll('button,select,input'))control.disabled=source.disabled;
    for(const name of ['bold','italic','bulletList','orderedList','blockquote','codeBlock'])element.querySelector('[data-format="'+name+'"]').setAttribute('aria-pressed',String(target.isActive(name)));
    if(target.isActive('codeBlock')){for(const control of element.querySelectorAll('select,[data-format=bold],[data-format=italic],[data-format=bulletList],[data-format=orderedList],[data-format=blockquote],#'+id('link-toggle')))control.disabled=true;form.hidden=true;}
    if(isInTable(target.state)){for(const control of element.querySelectorAll('select:not([data-table-field]),[data-format=bulletList],[data-format=orderedList],[data-format=blockquote],[data-format=codeBlock]'))control.disabled=true;}
    updateTable();
    field('block-type').value=target.isActive('heading')?String(target.getAttributes('heading').level):'paragraph';
  }
  for(const control of element.querySelectorAll('[data-format]'))control.addEventListener('click',()=>{
    const target=getEditor();if(!target||source.disabled)return;
    const type=control.dataset.format,command={bold:'toggleBold',italic:'toggleItalic',bulletList:'toggleBulletList',orderedList:'toggleOrderedList',undo:'undo',redo:'redo'}[type];
    if(type==='codeBlock')toggleCode(target);
    else if(type==='blockquote')toggleBlockquote(target);
    else if(type==='bold'||type==='italic')toggleInline(command,target);
    else target.chain().focus()[command]().run();
    update();
  });
  field('block-type').addEventListener('change',event=>{
    const target=getEditor();if(!target||source.disabled)return;
    const chain=target.chain().focus();if(event.target.value==='paragraph')chain.setParagraph().run();else chain.setHeading({level:Number(event.target.value)}).run();update();
  });
  field('link-toggle').addEventListener('click',()=>{
    const target=getEditor();if(!target||source.disabled)return;
    closeTable();form.hidden=false;form.querySelector('[role=status]').textContent='';field('link-target').value=target.getAttributes('sheriffLink').target||'';field('link-target').focus();
  });
  form.addEventListener('submit',event=>{
    event.preventDefault();const targetEditor=getEditor();if(!targetEditor||source.disabled)return;
    const target=field('link-target').value.trim();
    if(!target||/[\[\]|\r\n]/.test(target)){form.querySelector('[role=status]').textContent='Enter a page title or URL without brackets or pipes.';return;}
    const existing=targetEditor.isActive('sheriffLink');if(existing)targetEditor.commands.extendMarkRange('sheriffLink');
    if(!trimInlineSelection(targetEditor))return;
    if(existing){const range={from:targetEditor.state.selection.from,to:targetEditor.state.selection.to};targetEditor.chain().focus().extendMarkRange('sheriffLink').unsetMark('sheriffLink').setTextSelection(range).setMark('sheriffLink',{target}).run();}
    else if(targetEditor.state.selection.empty)targetEditor.chain().focus().insertContent({type:'text',text:target,marks:[{type:'sheriffLink',attrs:{target}}]}).run();
    else targetEditor.chain().focus().setMark('sheriffLink',{target}).run();
    form.hidden=true;update();
  });
  field('link-remove').addEventListener('click',()=>{const target=getEditor();if(!target||source.disabled)return;target.chain().focus().extendMarkRange('sheriffLink').unsetMark('sheriffLink').run();form.hidden=true;update();});
  field('link-cancel').addEventListener('click',()=>{form.hidden=true;getEditor()?.commands.focus();});
  return {update,closeLink:()=>{form.hidden=true;closeTable();}};
}


for(const [selector,name] of Object.entries({"#ci-toggle":"image","#cx-icons-toggle":"star","#cx-patterns-toggle":"panels-top-left","#visual-admonition-insert":"notebook-pen","[data-mode=visual]":"pencil","[data-mode=source]":"code-xml",".page-details-icon":"file-text","#visual-image-replace":"replace","#visual-image-remove":"trash-2"})){const old=document.querySelector(selector+' svg');if(old){const template=document.createElement('template');template.innerHTML=editorIcons[name];old.replaceWith(template.content.firstElementChild);}}
const mainFormatting=createFormattingToolbar(toolbar,'visual',()=>editor);
const admonitionFormatting=createFormattingToolbar($('visual-admonition-toolbar'),'visual-admonition',()=>admonitionEditor);
const identity=()=>{const e=desk.contentEditor();return [e.portal,e.path,e.generation].join('\n');};
const eligible=()=>/^(content|blog)\/.+\.md$/i.test(desk.contentEditor().path||'');
function status(message,error=false){notice.textContent=message;notice.classList.toggle('err',error);}
// Browser word selection often includes the next space. Keep that whitespace
// in the document, outside inline formatting and Sheriff link labels.
function trimInlineSelection(targetEditor=editor){
  const {doc,selection}=targetEditor.state;if(selection.empty)return true;
  let {from,to}=selection;
  while(from<to){const pos=doc.resolve(from);if(!pos.parent.isTextblock||pos.parentOffset>=pos.parent.content.size||!/^\s$/.test(doc.textBetween(from,from+1,'','\uFFFC')))break;from++;}
  while(to>from){const pos=doc.resolve(to);if(!pos.parent.isTextblock||pos.parentOffset===0||!/^\s$/.test(doc.textBetween(to-1,to,'','\uFFFC')))break;to--;}
  if(from===to){status('Select text rather than only spaces.');return false;}
  targetEditor.commands.setTextSelection({from,to});return true;
}
function toggleInline(command,targetEditor=editor){if(!targetEditor||source.disabled||!trimInlineSelection(targetEditor))return false;return targetEditor.chain().focus()[command]().run();}
const InlineSelection=Extension.create({name:'sheriffInlineSelection',priority:1000,addKeyboardShortcuts(){return {'Mod-b':()=>toggleInline('toggleBold',this.editor),'Mod-i':()=>toggleInline('toggleItalic',this.editor)};}});
// Markdown tables share one schema and editing behavior in both Visual surfaces.
const TableRoles=Extension.create({name:'sheriffTableRoles',extendNodeSchema(extension){const tableRole={table:'table',tableRow:'row',tableCell:'cell',tableHeader:'header_cell'}[extension.name];return tableRole?{tableRole}:{};},addProseMirrorPlugins(){return [tableEditing({allowTableNodeSelection:true}),new Plugin({key:new PluginKey('sheriffTableHeaders'),appendTransaction(transactions,old,state){
  if(!transactions.some(tr=>tr.docChanged))return null;const tr=state.tr;
  state.doc.descendants((table,pos)=>{if(table.type.name!=='table')return;let rowPos=pos+1;table.forEach((row,offset,index)=>{let cellPos=rowPos+1;row.forEach((cell,cellOffset,column)=>{const type=state.schema.nodes[index?'tableCell':'tableHeader'],align=table.firstChild.child(column)?.attrs.align||null;if(cell.type!==type||cell.attrs.align!==align)tr.setNodeMarkup(cellPos,type,{...cell.attrs,align});cellPos+=cell.nodeSize;});rowPos+=row.nodeSize;});});return tr.docChanged?tr:null;
}})];},addKeyboardShortcuts(){
  const next=direction=>()=>{const target=this.editor;if(!isInTable(target.state))return false;if(goToNextCell(direction)(target.state,target.view.dispatch))return true;if(direction>0){addRowAfter(target.state,target.view.dispatch);return goToNextCell(1)(target.state,target.view.dispatch);}return true;};
  return {Tab:next(1),'Shift-Tab':next(-1),Enter:()=>isInTable(this.editor.state)&&this.editor.commands.setHardBreak(),'Mod-Enter':()=>{const target=this.editor,found=selectedTable(target);if(!found)return false;const after=found.pos+found.node.nodeSize,tr=target.state.tr;if(!tr.doc.nodeAt(after))tr.insert(after,target.schema.nodes.paragraph.create());tr.setSelection(TextSelection.near(tr.doc.resolve(after+1))).scrollIntoView();target.view.dispatch(tr);return true;}};
}});
const SheriffTable=Node.create({name:'table',group:'block',content:'tableRow+',isolating:true,parseHTML(){return [];},renderHTML(){return ['table',['tbody',0]];},addNodeView(){return ()=>{const dom=document.createElement('div'),table=document.createElement('table'),contentDOM=document.createElement('tbody');dom.className='visual-table-wrap';table.append(contentDOM);dom.append(table);return {dom,contentDOM};};}});
const SheriffTableRow=Node.create({name:'tableRow',content:'(tableCell | tableHeader)+',parseHTML(){return [];},renderHTML(){return ['tr',0];}});
const cellAttributes=()=>({colspan:{default:1,rendered:false},rowspan:{default:1,rendered:false},colwidth:{default:null,rendered:false},align:{default:null,renderHTML:attrs=>attrs.align?{style:'text-align:'+attrs.align}:{}}});
const SheriffTableCell=Node.create({name:'tableCell',content:'paragraph',isolating:true,addAttributes:cellAttributes,parseHTML(){return [];},renderHTML({HTMLAttributes}){return ['td',HTMLAttributes,0];}});
const SheriffTableHeader=Node.create({name:'tableHeader',content:'paragraph',isolating:true,addAttributes:cellAttributes,parseHTML(){return [];},renderHTML({HTMLAttributes}){return ['th',HTMLAttributes,0];}});
function selectedTable(target){
  if(!target)return null;const selection=target.state.selection;if(selection.node?.type.name==='table')return {node:selection.node,pos:selection.from};
  for(let depth=selection.$from.depth;depth>0;depth--)if(selection.$from.node(depth).type.name==='table')return {node:selection.$from.node(depth),pos:selection.$from.before(depth)};return null;
}
function createTable(rows,columns){return {type:'table',content:Array.from({length:rows+1},(_,row)=>({type:'tableRow',content:Array.from({length:columns},()=>({type:row?'tableCell':'tableHeader',content:[{type:'paragraph'}]}))}))};}
function insertTable(target,rows,columns){
  if(source.disabled||!target||isInTable(target.state)||target.isActive('codeBlock'))return false;
  if(!Number.isInteger(rows)||!Number.isInteger(columns)||rows<1||rows>100||columns<1||columns>20)return false;
  const {selection}=target.state;if(!selection.empty||!selection.$from.parent.isTextblock)return false;
  return target.chain().focus().command(({tr})=>{closeHistory(tr);return true;}).insertContent(createTable(rows,columns)).run();
}
function tableCommand(target,command){
  if(source.disabled||!target||!isInTable(target.state))return false;
  const original=selectedTable(target),insertFirst=command===addRowBefore&&selectedRect(target.state).top===0;
  return command(target.state,tr=>{closeHistory(tr);if(insertFirst){const row=tr.doc.nodeAt(original.pos).firstChild;let pos=original.pos+2;row.forEach((cell,offset,column)=>{tr.setNodeMarkup(pos,undefined,{...cell.attrs,align:original.node.firstChild.child(column).attrs.align});pos+=cell.nodeSize;});}target.view.dispatch(tr);target.view.focus();});
}
function pasteTableCell(view,event,target){
  if(!isInTable(view.state))return false;const text=event.clipboardData?.getData('text/plain');if(text===undefined)return false;event.preventDefault();if(source.disabled||!view.editable)return true;
  target.commands.insertContent(inline(text)||[{type:'text',text}]);return true;
}
function alignTableColumn(target,align){
  if(source.disabled||!target||!isInTable(target.state))return false;const rect=selectedRect(target.state),tr=target.state.tr;closeHistory(tr);
  for(let row=0;row<rect.map.height;row++)for(let column=rect.left;column<rect.right;column++){const pos=rect.tableStart+rect.map.map[row*rect.map.width+column],cell=tr.doc.nodeAt(pos);tr.setNodeMarkup(pos,undefined,{...cell.attrs,align:align||null});}
  target.view.dispatch(tr);target.view.focus();return true;
}

const SourceIds=Extension.create({name:'sheriffSourceIds',addGlobalAttributes(){return [{types:['paragraph','heading','bulletList','orderedList','horizontalRule','blockquote','codeBlock','table','sheriffBlock','sheriffVideo','sheriffImage','sheriffAdmonition'],attributes:{sourceId:{default:null,rendered:false}}}];}});
// One editable code node for the page and the callout editor. Code is always literal.
const codeLanguages=['goblin','javascript','typescript','html','css','json','yall','yaml','python','rust','go','c','cpp','csharp','java','bash','powershell','sql','text'];
const languageChoices=document.createElement('datalist');languageChoices.id='visual-code-languages';
for(const language of codeLanguages){const option=document.createElement('option');option.value=language;languageChoices.append(option);}document.body.append(languageChoices);
function pasteLiteralCode(view,event){
  if(view.state.selection.$from.parent.type.name!=='codeBlock')return false;
  const text=event.clipboardData?.getData('text/plain');if(text===undefined)return false;
  event.preventDefault();if(source.disabled||!view.editable)return true;
  view.dispatch(view.state.tr.insertText(text.replace(/\r\n?/g,'\n')).scrollIntoView());return true;
}
function toggleCode(target){
  const {selection,doc}=target.state;let unsafe=false;
  doc.nodesBetween(selection.from,selection.to,(node,pos)=>{if(['sheriffBlock','sheriffVideo','sheriffImage','sheriffModalSource','sheriffInline','sheriffCitation'].includes(node.type.name)||node.type.name==='sheriffAdmonition'&&pos>=selection.from)unsafe=true;});
  if(unsafe){status('Click in editable text to insert a code block. Existing Sheriff components stay intact.');return;}
  target.chain().focus().command(({tr})=>{closeHistory(tr);return true;}).toggleCodeBlock().run();
}
const SheriffCodeBlock=CodeBlock.extend({
  addKeyboardShortcuts(){return {...this.parent?.(),'Mod-Enter':()=>this.editor.commands.exitCode(),
    'Mod-Home':()=>this.editor.isActive(this.name)&&this.editor.commands.setTextSelection(TextSelection.atStart(this.editor.state.doc)),
    'Mod-End':()=>this.editor.isActive(this.name)&&this.editor.commands.setTextSelection(TextSelection.atEnd(this.editor.state.doc))};},
  addNodeView(){return ({node,getPos,editor:viewEditor})=>{
    const dom=document.createElement('div'),head=document.createElement('div'),label=document.createElement('label'),language=document.createElement('input'),hint=document.createElement('span'),pre=document.createElement('pre'),contentDOM=document.createElement('code');
    dom.className='visual-code-block';head.className='visual-code-head';head.contentEditable='false';label.append('Language ',language);language.type='text';language.setAttribute('aria-label','Code language');language.setAttribute('list','visual-code-languages');language.autocomplete='off';language.spellcheck=false;language.placeholder='Plain text';
    hint.className='visual-code-hint';hint.textContent='Tab indents · Ctrl+Enter continues below';
    const raw=patternButton('Edit in Source','code-xml',()=>{if(viewEditor===admonitionEditor)closeAdmonitionProperties();editSource(node.attrs.sourceId,serializeFragment(model,node.toJSON()));});raw.append(' Edit in Source');
    head.append(label,raw);pre.append(contentDOM);pre.spellcheck=false;dom.append(head,pre,hint);let editingLanguage=false;
    language.addEventListener('input',()=>{
      if(source.disabled||!viewEditor.isEditable)return;
      const value=language.value,extraOptions=model?.records.get(node.attrs.sourceId)?.code?.suffix.trim(),valid=validCodeLanguage(value)&&!!(value||!extraOptions);language.setAttribute('aria-invalid',String(!valid));language.title=valid?'Any language name; leave empty for plain text.':!value&&extraOptions?'This fence has extra options. Remove its language in Source.':'Use a name without spaces or fence characters.';if(!valid)return;
      const pos=getPos();if(typeof pos!=='number'||value===(node.attrs.language||''))return;
      const tr=viewEditor.state.tr;if(!editingLanguage)closeHistory(tr);editingLanguage=true;
      viewEditor.view.dispatch(tr.setNodeMarkup(pos,undefined,{...node.attrs,language:value}));
    });
    language.addEventListener('blur',()=>{editingLanguage=false;language.value=node.attrs.language||'';language.removeAttribute('aria-invalid');});
    function paint(){if(language.value!==(node.attrs.language||'')&&language.getAttribute('aria-invalid')!=='true')language.value=node.attrs.language||'';language.disabled=raw.disabled=source.disabled||!viewEditor.isEditable;}
    paint();return {dom,contentDOM,stopEvent:event=>head.contains(event.target),ignoreMutation:mutation=>mutation.type!=='selection'&&!contentDOM.contains(mutation.target)&&mutation.target!==contentDOM,update(next){if(next.type!==node.type)return false;node=next;paint();return true;}};
  };}
}).configure({defaultLanguage:'',enableTabIndentation:true,exitOnTripleEnter:false});

// Editor-only decorations: adjacent halves share a row without changing source.
function videoPairs(doc){
  const pairs=[];
  function scan(parent,start){
    let pos=start;
    for(let i=0;i<parent.childCount;i++){
      const left=parent.child(i),right=i+1<parent.childCount?parent.child(i+1):null;
      if(left.type.name==='sheriffVideo'&&left.attrs.size==='half'&&right?.type.name==='sheriffVideo'&&right.attrs.size==='half'){
        pairs.push({pos,left,right});pos+=left.nodeSize+right.nodeSize;i++;
      }else pos+=left.nodeSize;
    }
  }
  scan(doc,0);doc.descendants((node,pos)=>{if(!node.isLeaf)scan(node,pos+1);});return pairs;
}
const VideoRows=Extension.create({name:'sheriffVideoRows',addProseMirrorPlugins(){return [new Plugin({key:new PluginKey('sheriffVideoRows'),props:{decorations(state){
  const decorations=[];for(const {pos,left,right} of videoPairs(state.doc)){
    decorations.push(Decoration.node(pos,pos+left.nodeSize,{class:'visual-video-pair-start'}),Decoration.node(pos+left.nodeSize,pos+left.nodeSize+right.nodeSize,{class:'visual-video-pair-end'}));
  }return DecorationSet.create(state.doc,decorations);
}}})];}});

// Visible insertion points are editor decorations, never authored source nodes.
const ParagraphGaps=Extension.create({name:'sheriffParagraphGaps',addProseMirrorPlugins(){return [new Plugin({key:new PluginKey('sheriffParagraphGaps'),props:{decorations(state){
  const pairedBoundaries=new Set(videoPairs(state.doc).map(({pos,left})=>pos+left.nodeSize));
  const positions=new Set(),framed=node=>node&&['sheriffBlock','sheriffVideo','sheriffImage','sheriffAdmonition','blockquote','codeBlock','table'].includes(node.type.name);
  function boundaries(parent,start){
    if(!['doc','sheriffAdmonition','blockquote'].includes(parent.type.name))return;
    let pos=start;for(let i=0;i<=parent.childCount;i++){
      const left=i?parent.child(i-1):null,right=i<parent.childCount?parent.child(i):null;
      if(!pairedBoundaries.has(pos)&&(framed(left)||framed(right))&&(!left?.isTextblock||left.type.name==='codeBlock')&&(!right?.isTextblock||right.type.name==='codeBlock'))positions.add(pos);
      if(right)pos+=right.nodeSize;
    }
  }
  boundaries(state.doc,0);state.doc.descendants((node,pos)=>{if(!node.isLeaf)boundaries(node,pos+1);});
  return DecorationSet.create(state.doc,[...positions].map(pos=>Decoration.widget(pos,(view,getPos)=>{
    const button=document.createElement('button');button.type='button';button.className='visual-paragraph-gap';button.contentEditable='false';button.setAttribute('aria-label','Add paragraph here');button.title='Add a paragraph here';button.textContent='+ Add paragraph';button.disabled=source.disabled||!view.editable;
    button.addEventListener('mousedown',event=>event.preventDefault());button.addEventListener('click',()=>{
      const at=getPos();if(source.disabled||!view.editable||mode!=='visual'||typeof at!=='number')return;
      const place=view.state.doc.resolve(at),paragraph=view.state.schema.nodes.paragraph;if(!place.parent.canReplaceWith(place.index(),place.index(),paragraph))return;
      const tr=view.state.tr.insert(at,paragraph.create());closeHistory(tr);tr.setSelection(TextSelection.create(tr.doc,at+1)).scrollIntoView();view.dispatch(tr);view.focus();
    });return button;
  },{side:-1,key:'paragraph-gap-'+pos,stopEvent:()=>true})));
}}})];}});
const SheriffLink=Mark.create({name:'sheriffLink',inclusive:false,addAttributes(){return {target:{default:''}};},parseHTML(){return [];},renderHTML({mark}){return ['a',{'data-sheriff-target':mark.attrs.target,title:'[['+mark.attrs.target+']]'},0];}});
function editSource(id,raw){void setMode('source').then(()=>{const record=model?.records.get(id);raw=record?.latestRaw??raw;let start=record?.start;if(start===undefined||source.value.slice(start,start+raw.length)!==raw)start=source.value.indexOf(raw,model?.prefix.length||0);if(start>=0)desk.revealContentRange(start,start+raw.length);else source.focus({preventScroll:true});});}
// Inline patterns keep their authored source; tokens still refer to their
// separately managed definitions. All form edits use the page's Undo history.
let patternTarget=null,patternSection=0,patternRaw='',patternSequence=0,lastPatternProperty='';
function patternButton(label,icon,action){
  const button=document.createElement('button');button.type='button';button.className='btn small';button.title=label;button.setAttribute('aria-label',label);button.innerHTML=editorIcons[icon];
  button.addEventListener('click',action);return button;
}
function patternValue(value){
  const container=document.createElement('span'),nodes=inline(value);
  if(!nodes){container.textContent=value;return container;}
  for(const node of nodes){
    let child;
    if(node.type==='text'){
      child=document.createTextNode(node.text);
      for(const mark of node.marks||[]){const wrap=document.createElement(({bold:'strong',italic:'em',code:'code',sheriffLink:'span'})[mark.type]||'span');if(mark.type==='sheriffLink'){wrap.className='visual-pattern-link';wrap.title='[['+mark.attrs.target+']]';}wrap.append(child);child=wrap;}
    }else{
      const image=/^\[\[(?:_image|image):([^|\]]+)(?:\|[^\]]*)?\]\]$/i.exec(node.attrs.raw);
      let path=image?.[1];try{if(path)path=decodeURIComponent(path);}catch{path=null;}
      if(path&&!path.startsWith('/')&&!path.split('/').some(p=>p==='..')&&!/^[a-z]+:/i.test(path)){
        child=document.createElement('img');child.src=window.SheriffDeskBackend.assetUrl(context.current,'public/images/'+path);child.alt=image[1];child.loading='lazy';
      }else {child=document.createElement('code');child.textContent=node.attrs.raw;}
    }
    container.append(child);
  }
  return container;
}
function patternNodeView({node,getPos,editor:viewEditor}){
  const dom=document.createElement('div'),head=document.createElement('div'),title=document.createElement('strong'),actions=document.createElement('span'),body=document.createElement('section');
  dom.className='visual-protected visual-pattern';dom.contentEditable='false';actions.className='visual-pattern-actions';body.className='visual-pattern-content';let active=parsePattern(node.attrs.raw).sections.length>1?1:0;
  const settings=patternButton('Edit pattern','panels-top-left',()=>{const pos=getPos();if(typeof pos!=='number'||source.disabled)return;viewEditor.commands.setNodeSelection(pos);openPattern({node:viewEditor.state.doc.nodeAt(pos),pos});});settings.append(' Edit pattern');
  const sourceButton=patternButton('Edit in Source','code-xml',()=>editSource(node.attrs.sourceId,node.attrs.raw));sourceButton.append(' Edit in Source');actions.append(settings,sourceButton);head.append(title,actions);dom.append(head,body);
  function paint(){
    const pattern=parsePattern(node.attrs.raw);if(!pattern)return;
    title.textContent=pattern.name;body.replaceChildren();active=Math.min(active,pattern.sections.length-1);
    if(pattern.sections.length>1){const tabs=document.createElement('div');tabs.className='visual-pattern-tabs';tabs.setAttribute('aria-label',pattern.name+' sections');pattern.sections.forEach((section,index)=>{const button=document.createElement('button');button.type='button';button.textContent=section.tab?.label||'Shared fields';button.setAttribute('aria-pressed',String(index===active));button.addEventListener('click',()=>{active=index;paint();});tabs.append(button);});body.append(tabs);}
    const table=document.createElement('dl');table.className='visual-pattern-preview';
    for(const section of pattern.sections.filter((section,index)=>index===0||index===active))for(const line of section.lines){if(!line.field)continue;const row=document.createElement('div'),label=document.createElement('dt'),value=document.createElement('dd');label.textContent=line.field.key.replace(/^_+/,'');value.append(patternValue(line.field.value));row.append(label,value);table.append(row);}
    body.append(table);
  }
  paint();return {dom,stopEvent:event=>!!event.target.closest('button'),update(next){if(next.type!==node.type||!parsePattern(next.attrs.raw))return false;node=next;paint();return true;}};
}
function resolvePattern(){
  if(!patternTarget||patternTarget.key!==identity()||mode!=='visual'||!editor)return null;
  let found;editor.state.doc.descendants((node,pos)=>{if(node.type.name==='sheriffBlock'&&node.attrs.sourceId===patternTarget.id)found={node,pos};});
  return found&&parsePattern(found.node.attrs.raw)?found:null;
}
function openPattern(selected){
  if(!selected||source.disabled||!parsePattern(selected.node.attrs.raw))return;
  if(!selected.node.attrs.sourceId){editor.view.dispatch(editor.state.tr.setNodeMarkup(selected.pos,undefined,{...selected.node.attrs,sourceId:'inserted-pattern-'+(++patternSequence)}).setMeta('addToHistory',false));selected={node:editor.state.doc.nodeAt(selected.pos),pos:selected.pos};}
  window.dispatchEvent(new CustomEvent('sheriff:content-picker-open',{detail:{kind:'pattern-settings'}}));
  const parsed=parsePattern(selected.node.attrs.raw);
  patternTarget={key:identity(),id:selected.node.attrs.sourceId};patternSection=parsed.sections.length>1&&!parsed.sections[0].lines.some(line=>line.field)?1:0;patternRaw='';lastPatternProperty='';renderPatternProperties();$('visual-pattern-name').focus({preventScroll:true});
}
function closePatternProperties(){
  const selected=resolvePattern();patternTarget=null;patternRaw='';lastPatternProperty='';$('visual-pattern-properties').hidden=true;
  if(selected)editor.view.nodeDOM(selected.pos)?.querySelector('button')?.focus({preventScroll:true});
}
function applyPattern(change,separate=false){
  const selected=resolvePattern();if(!selected||source.disabled)return false;
  try{
    const next=editPattern(selected.node.attrs.raw,change);$('visual-pattern-status').textContent='Changes stay unsaved until Save.';$('visual-pattern-status').classList.remove('err');
    if(next===selected.node.attrs.raw)return true;
    const property=change.type+'\n'+change.section+'\n'+change.line;patternRaw=next;
    editor.commands.command(({tr})=>{if(separate||property!==lastPatternProperty)closeHistory(tr);tr.setNodeMarkup(selected.pos,undefined,{...selected.node.attrs,raw:next});return true;});lastPatternProperty=property;return true;
  }catch(error){$('visual-pattern-status').textContent=error.message;$('visual-pattern-status').classList.add('err');return false;}
}
function renderPatternProperties(force=false){
  const panel=$('visual-pattern-properties'),selected=resolvePattern();panel.hidden=!selected;if(!selected)return;
  const parsed=parsePattern(selected.node.attrs.raw);patternSection=Math.min(patternSection,parsed.sections.length-1);
  if(force||patternRaw!==selected.node.attrs.raw){
    patternRaw=selected.node.attrs.raw;lastPatternProperty='';$('visual-pattern-name').value=parsed.name;$('visual-pattern-orientation').value=parsed.orientation;
    const tabs=$('visual-pattern-tabs');tabs.replaceChildren();
    parsed.sections.forEach((section,index)=>{const button=document.createElement('button');button.type='button';button.className='btn small';button.textContent=section.tab?.label||'Shared fields';button.setAttribute('aria-pressed',String(index===patternSection));button.addEventListener('click',()=>{patternSection=index;renderPatternProperties(true);});tabs.append(button);});
    const section=parsed.sections[patternSection];$('visual-pattern-tab-controls').hidden=!section.tab;
    $('visual-pattern-tab-name').value=section.tab?.label||'';
    const fields=$('visual-pattern-fields');fields.replaceChildren();
    section.lines.forEach((line,index)=>{
      if(!line.field)return;const row=document.createElement('div');row.className='visual-pattern-field';row.dataset.line=String(index);
      for(const [type,label,value] of [['key','Field name',line.field.key],['value','Value',line.field.value]]){
        const input=document.createElement(type==='value'?'textarea':'input');input.value=value;input.setAttribute('aria-label',label);input.dataset.property=type;input.autocomplete='off';if(type==='value'){input.rows=2;input.spellcheck=true;}row.append(input);
        input.addEventListener('input',()=>applyPattern({type,value:input.value,section:patternSection,line:index}));input.addEventListener('blur',()=>{lastPatternProperty='';});
      }
      row.append(patternButton('Remove field','trash-2',()=>{if(applyPattern({type:'remove-field',section:patternSection,line:index},true))renderPatternProperties(true);}));fields.append(row);
    });
    $('visual-pattern-empty').hidden=!!fields.childElementCount;
    $('visual-pattern-extra').hidden=!section.lines.some(line=>!line.field&&line.text.trim()&&!/^\s*@mode\s*=/.test(line.text));
  }
  panel.querySelectorAll('input,textarea,select,button').forEach(control=>control.disabled=source.disabled);
  $('visual-pattern-tab-left').disabled=source.disabled||patternSection<=1;$('visual-pattern-tab-right').disabled=source.disabled||patternSection===0||patternSection>=parsed.sections.length-1;
}
for(const [id,type] of [['visual-pattern-name','name'],['visual-pattern-orientation','orientation'],['visual-pattern-tab-name','tab']]){
  $(id).addEventListener(type==='orientation'?'change':'input',event=>{if(applyPattern({type,value:event.target.value,section:patternSection})){if(type==='tab')$('visual-pattern-tabs').children[patternSection].textContent=event.target.value;}});
  $(id).addEventListener('blur',()=>{lastPatternProperty='';});
}
$('visual-pattern-add-field').addEventListener('click',()=>{if(applyPattern({type:'add-field',section:patternSection},true)){renderPatternProperties(true);$('visual-pattern-fields').lastElementChild?.querySelector('input')?.select();}});
$('visual-pattern-add-tab').addEventListener('click',()=>{const selected=resolvePattern();if(!selected)return;const count=parsePattern(selected.node.attrs.raw).sections.length;if(applyPattern({type:'add-tab',value:'Edition '+count},true)){patternSection=count;renderPatternProperties(true);$('visual-pattern-tab-name').select();}});
for(const [id,delta] of [['visual-pattern-tab-left',-1],['visual-pattern-tab-right',1]])$(id).addEventListener('click',()=>{if(applyPattern({type:'move-tab',section:patternSection,delta},true)){patternSection+=delta;renderPatternProperties(true);}});
$('visual-pattern-remove-tab').addEventListener('click',()=>{if(applyPattern({type:'remove-tab',section:patternSection},true)){patternSection=Math.max(0,patternSection-1);renderPatternProperties(true);}});
$('visual-pattern-remove').addEventListener('click',()=>{const selected=resolvePattern();if(!selected||source.disabled)return;editor.commands.command(({tr})=>{closeHistory(tr);tr.delete(selected.pos,selected.pos+selected.node.nodeSize);return true;});closePatternProperties();status('Pattern removed from this page · not saved yet. Undo restores it.');});
$('visual-pattern-source').addEventListener('click',()=>{const selected=resolvePattern();if(selected)editSource(selected.node.attrs.sourceId,selected.node.attrs.raw);});
for(const id of ['visual-pattern-close','visual-pattern-done'])$(id).addEventListener('click',closePatternProperties);
$('visual-pattern-properties').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closePatternProperties();}});
for(const [id,icon] of [['visual-pattern-add-field','plus'],['visual-pattern-add-tab','plus'],['visual-pattern-tab-left','arrow-left'],['visual-pattern-tab-right','arrow-right'],['visual-pattern-remove-tab','trash-2'],['visual-pattern-remove','trash-2'],['visual-pattern-source','code-xml']])$(id).insertAdjacentHTML('afterbegin',editorIcons[icon]);

const SheriffBlock=Node.create({name:'sheriffBlock',group:'block',atom:true,selectable:true,addAttributes(){return {raw:{default:''},label:{default:'Sheriff source'}};},parseHTML(){return [];},renderHTML(){return ['div',{'data-sheriff-block':''},'Sheriff source'];},addNodeView(){return (props)=>{let {node}=props;if(parsePattern(node.attrs.raw))return patternNodeView(props);const dom=document.createElement('div');dom.className='visual-protected';dom.contentEditable='false';const head=document.createElement('div'),title=document.createElement('strong'),button=document.createElement('button'),pre=document.createElement('pre');title.textContent=node.attrs.label;button.type='button';button.className='btn small';button.textContent='Edit in Source';button.addEventListener('click',()=>editSource(node.attrs.sourceId,node.attrs.raw));head.append(title,button);pre.textContent=node.attrs.raw;dom.append(head,pre);return {dom};};}});
const SheriffInline=Node.create({name:'sheriffInline',group:'inline',inline:true,atom:true,selectable:true,addAttributes(){return {raw:{default:''},label:{default:'Sheriff syntax'}};},parseHTML(){return [];},renderHTML({node}){return ['span',{class:'visual-inline-token',title:node.attrs.raw,contenteditable:'false'},node.attrs.label];}});
const SheriffCitation=Node.create({name:'sheriffCitation',group:'inline',inline:true,atom:true,selectable:true,addAttributes(){return {raw:{default:''},label:{default:''}};},parseHTML(){return [];},renderHTML({node}){return ['sup',{class:'visual-citation',title:node.attrs.raw,'aria-label':'Citation '+node.attrs.label,contenteditable:'false'},node.attrs.label];}});
Object.assign(editorIcons,{"clapperboard":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-clapperboard\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"m12.296 3.464 3.02 3.956\" />\n  <path d=\"M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3z\" />\n  <path d=\"M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\" />\n  <path d=\"m6.18 5.276 3.1 3.899\" />\n</svg>\n","play":"<svg aria-hidden=\"true\" focusable=\"false\"\n  class=\"lucide lucide-play\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z\" />\n</svg>\n"});
// One video dialog for insertion and existing embeds; only Apply changes the document.
let videoTarget=null;
const videoPanel=$('visual-video-properties');
const videoFields=['provider','id','size','align','caption'];
function videoValues(){return Object.fromEntries(videoFields.map(name=>[name,name==='id'?$('visual-video-'+name).value.trim():$('visual-video-'+name).value]));}
function videoAttributes(){const values=videoValues();return parseVideo(videoSyntax(values));}
function closeVideo(){videoTarget=null;videoPanel.hidden=true;$('visual-video-preview').replaceChildren();$('visual-video-insert').setAttribute('aria-expanded','false');}
function videoCurrent(){
  if(!videoTarget||videoTarget.key!==identity()||source.disabled||!eligible())return false;
  if(videoTarget.owner?.isDestroyed)return false;
  return videoTarget.owner?videoTarget.snapshot===fingerprint(videoTarget.owner.getJSON()):videoTarget.snapshot===source.value;
}
function refreshVideo(){
  if(videoPanel.hidden)return;
  if(!videoCurrent()){closeVideo();return;}
  const attrs=videoAttributes();$('visual-video-syntax').textContent=attrs?attrs.raw:'Enter a YouTube video ID or a numeric Vimeo ID. Captions cannot contain pipes, brackets, or line breaks.';
  $('visual-video-apply').disabled=!attrs;$('visual-video-play').disabled=!attrs;
}
function openVideo(owner=null,pos=null){
  if(source.disabled||!eligible())return;
  const node=typeof pos==='number'?owner?.state.doc.nodeAt(pos):null;
  if(node&&node.type.name!=='sheriffVideo')return;
  const target={key:identity(),owner,pos,raw:node?.attrs.raw,id:node?.attrs.sourceId,from:owner?.state.selection.from,to:owner?.state.selection.to,start:source.selectionStart,end:source.selectionEnd,snapshot:owner?fingerprint(owner.getJSON()):source.value};
  // Keep the callout editor alive when a video inside it is selected.
  videoTarget=target;window.dispatchEvent(new CustomEvent('sheriff:content-picker-open',{detail:{kind:'video'}}));videoTarget=target;
  if(owner?.isDestroyed)return closeVideo();
  videoPanel.hidden=false;$('visual-video-insert').setAttribute('aria-expanded','true');
  const attrs=node?.attrs||{provider:'youtube',id:'',size:'full',align:'center',caption:''};
  for(const name of videoFields)$('visual-video-'+name).value=attrs[name];
  $('visual-video-title').textContent=node?'Video settings':'Insert video';$('visual-video-apply').textContent=node?'Apply changes':'Insert video';
  $('visual-video-remove').hidden=!node;$('visual-video-source').hidden=!node;
  $('visual-video-preview').replaceChildren();refreshVideo();$('visual-video-id').focus({preventScroll:true});
}
function insertVideo(){openVideo(admonitionPanelOpen&&admonitionEditor?admonitionEditor:mode==='visual'?editor:null);}
function applyVideo(){
  const attrs=videoAttributes();if(!attrs||!videoCurrent())return;
  const target=videoTarget;
  if(target.raw&&videoSyntax(parseVideo(target.raw))===videoSyntax(attrs))attrs.raw=target.raw;
  if(target.owner){
    const owner=target.owner;
    if(typeof target.pos==='number'){
      const node=owner.state.doc.nodeAt(target.pos);if(node?.type.name!=='sheriffVideo'||node.attrs.raw!==target.raw)return closeVideo();
      if(attrs.raw!==target.raw)owner.view.dispatch(closeHistory(owner.state.tr).setNodeMarkup(target.pos,undefined,{...node.attrs,...attrs}));
    }else{
      const code=owner.state.doc.resolve(target.from).parent.type.name==='codeBlock';
      if(code)owner.view.dispatch(closeHistory(owner.state.tr).insertText(attrs.raw,target.from,target.to));
      else owner.chain().command(({tr})=>{closeHistory(tr);return true;}).insertContentAt({from:target.from,to:target.to},isInTable(owner.state)?inline(attrs.raw):{type:'sheriffVideo',attrs}).run();
    }
    closeVideo();owner.view.focus();
  }else{
    closeVideo();desk.insertContent(attrs.raw,{...desk.contentEditor(),start:target.start,end:target.end});source.focus({preventScroll:true});
  }
}
const SheriffVideo=Node.create({
  name:'sheriffVideo',group:'block',atom:true,selectable:true,
  addAttributes(){return {raw:{default:''},provider:{default:'youtube'},id:{default:''},size:{default:'full'},align:{default:'center'},caption:{default:''}};},
  parseHTML(){return [];},renderHTML(){return ['figure',{},'Video'];},
  addNodeView(){return ({node,getPos,editor:owner})=>{
    const dom=document.createElement('figure');dom.contentEditable='false';dom.className='visual-video';
    const frame=document.createElement('button'),label=document.createElement('span'),caption=document.createElement('figcaption'),actions=document.createElement('div');
    frame.type='button';frame.className='visual-video-frame';frame.innerHTML=editorIcons['clapperboard'];frame.append(label);
    const settings=patternButton('Video settings','pencil',()=>openVideo(owner,getPos()));
    const raw=patternButton('Edit in Source','code-xml',()=>{const id=node.attrs.sourceId,text=node.attrs.raw;closeVideo();if(owner===admonitionEditor)closeAdmonitionProperties();editSource(id,text);});
    actions.className='visual-video-actions';actions.append(settings,raw);dom.append(frame,caption,actions);
    frame.addEventListener('click',()=>openVideo(owner,getPos()));
    function paint(){label.textContent=(node.attrs.provider==='vimeo'?'Vimeo':'YouTube')+' · '+node.attrs.id;caption.textContent=node.attrs.caption;caption.hidden=!node.attrs.caption;dom.dataset.size=node.attrs.size;dom.dataset.align=node.attrs.align;frame.setAttribute('aria-label','Edit video '+(node.attrs.caption||node.attrs.id));}
    paint();return {dom,update(next){if(next.type.name!=='sheriffVideo')return false;node=next;paint();return true;},stopEvent:event=>event.target.closest('button')!==null,ignoreMutation:()=>true};
  }}
});
$('visual-video-insert').innerHTML=editorIcons['clapperboard']+'Insert video';
$('visual-video-insert').addEventListener('mousedown',event=>event.preventDefault());
$('visual-video-insert').addEventListener('click',insertVideo);
for(const name of videoFields)$('visual-video-'+name).addEventListener('input',()=>{$('visual-video-preview').replaceChildren();refreshVideo();});
for(const id of ['visual-video-close','visual-video-cancel'])$(id).addEventListener('click',closeVideo);
$('visual-video-apply').addEventListener('click',applyVideo);
$('visual-video-remove').addEventListener('click',()=>{if(!videoCurrent())return;const {owner,pos}=videoTarget,node=owner?.state.doc.nodeAt(pos);if(node?.type.name!=='sheriffVideo')return;owner.view.dispatch(closeHistory(owner.state.tr).delete(pos,pos+node.nodeSize));closeVideo();owner.view.focus();});
$('visual-video-source').addEventListener('click',()=>{if(!videoCurrent())return;const {id,raw,owner}=videoTarget;closeVideo();if(owner===admonitionEditor)closeAdmonitionProperties();editSource(id,raw);});
$('visual-video-play').addEventListener('click',()=>{const attrs=videoAttributes();if(!attrs||!videoCurrent())return;const frame=document.createElement('iframe');frame.src=(attrs.provider==='vimeo'?'https://player.vimeo.com/video/':'https://www.youtube-nocookie.com/embed/')+encodeURIComponent(attrs.id);frame.title=attrs.caption||'Video preview';frame.allow='fullscreen; picture-in-picture';frame.referrerPolicy='strict-origin-when-cross-origin';frame.allowFullscreen=true;$('visual-video-preview').replaceChildren(frame);});
videoPanel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeVideo();}});
for(const [id,icon] of [['visual-video-play','play'],['visual-video-source','code-xml'],['visual-video-remove','trash-2']])$(id).insertAdjacentHTML('afterbegin',editorIcons[icon]);

const SheriffImage=Node.create({
  name:'sheriffImage',group:'block',atom:true,selectable:true,
  addAttributes(){return {raw:{default:''},path:{default:''},size:{default:'full'},align:{default:'center'},caption:{default:''}};},
  parseHTML(){return [];},renderHTML(){return ['figure',{},'Image'];},
  addNodeView(){return ({node,getPos,editor:viewEditor})=>{
    const dom=document.createElement('figure');dom.className='visual-image';dom.contentEditable='false';
    const image=document.createElement('img'),caption=document.createElement('figcaption'),actions=document.createElement('div'),settings=document.createElement('button'),raw=document.createElement('button');
    actions.className='visual-image-node-actions';for(const button of [settings,raw]){button.type='button';button.className='btn small';}
    settings.textContent='Image settings';raw.textContent='Edit in Source';actions.append(settings,raw);dom.append(image,caption,actions);
    function select(){const pos=getPos();if(typeof pos!=='number'||source.disabled||mode!=='visual')return;imagePanelOpen=true;window.dispatchEvent(new CustomEvent('sheriff:content-picker-open',{detail:{kind:'image-settings'}}));viewEditor.commands.setNodeSelection(pos);renderImageProperties();renderAdmonitionProperties();renderPatternProperties();}
    dom.addEventListener('click',event=>{if(!event.target.closest('button'))select();});
    settings.addEventListener('click',()=>{select();if(selectedImage()){$('visual-image-size').focus({preventScroll:true});$('visual-image-properties').scrollIntoView({block:'nearest'});}});
    raw.addEventListener('click',()=>editSource(node.attrs.sourceId,node.attrs.raw));
    image.addEventListener('error',()=>{image.hidden=true;caption.textContent='Image unavailable · '+node.attrs.path;});
    function paint(){
      dom.dataset.imagePath=node.attrs.path;dom.dataset.imageCaption=node.attrs.caption;
      for(const size of ['full','half','thumb','mini','icon'])dom.classList.toggle('visual-image-'+size,(node.attrs.size||'full')===size);
      let path;try{path=decodeURIComponent(node.attrs.path);}catch{path=node.attrs.path;}
      if(!path.startsWith('/')&&!path.split('/').some(p=>p==='..')&&!/^[a-z]+:/i.test(path)){const url=window.SheriffDeskBackend.assetUrl(context.current,'public/images/'+path);if(image.getAttribute('src')!==url){image.hidden=false;image.src=url;}}
      else {image.removeAttribute('src');image.hidden=true;}
      image.alt=node.attrs.caption||node.attrs.path;caption.textContent=node.attrs.caption||node.attrs.path;
      dom.style.marginLeft=node.attrs.align==='left'?'0':'auto';dom.style.marginRight=node.attrs.align==='right'?'0':'auto';
    }
    paint();return {dom,stopEvent:event=>!!event.target.closest('button'),update(next){if(next.type!==node.type)return false;node=next;paint();return true;}};
  };}
});

let admonitionSettings={icons:{},previews:{}},iconPortal='',iconRequest=0,catalog=null,catalogRequest=null,lastAdmonitionProperty='',admonitionPanelOpen=false,insertedAdmonitions=0,admonitionEditor=null,admonitionTarget=null,modalSync=false,imagePanelOpen=false;
const typeTitle=kind=>kind==='spoiler'?'Show':kind.charAt(0).toUpperCase()+kind.slice(1);
function iconName(value){return typeof value==='string'?value.trim().replace(/^"(.*)"$/,'$1'):'';}
function refreshAdmonitionIcons(){for(const dom of surface.querySelectorAll('.visual-admonition'))paintAdmonitionIcon(dom);}
async function loadAdmonitionSettings(force=false){
  const portal=context.current;if(!portal||!force&&iconPortal===portal)return;
  iconPortal=portal;const request=++iconRequest;admonitionSettings={icons:{},previews:{}};catalog=null;catalogRequest=null;refreshAdmonitionIcons();
  try{const response=await window.SheriffDeskBackend.request('themes.config',{portal}),data=await response.json();if(request!==iconRequest||portal!==context.current)return;if(!response.ok||data.ok===false)throw Error('Theme icons unavailable');admonitionSettings=data.admonitions||{icons:{},previews:{}};refreshAdmonitionIcons();}catch{if(request===iconRequest){admonitionSettings={icons:{},previews:{}};refreshAdmonitionIcons();}}
}
function paintAdmonitionIcon(dom){
  const icon=dom.querySelector(':scope > .visual-admonition-head .visual-admonition-icon'),explicit=dom.dataset.explicitIcon,kind=dom.dataset.kind;
  const token=explicit?.match(/^\[\[icon\|([^\]]+)\]\]$/i),parts=token?token[1].split('|'):[],name=token?parts[0]:iconName(admonitionSettings.icons?.[kind]);
  icon.hidden=true;icon.removeAttribute('style');icon.replaceChildren();icon.dataset.iconName=name||'';
  if(!name||!/^[-a-z0-9]+$/.test(name))return;
  const asset=admonitionSettings.previews?.[name]||catalog?.get(name)||(name.startsWith('brand-')?catalog?.get(name.slice(6)):null);
  if(!asset){if(catalog===null&&!catalogRequest){const portal=context.current,request=iconRequest;catalogRequest=window.SheriffDeskBackend.request('icons.list',{portal}).then(r=>r.json()).then(data=>{if(request!==iconRequest)return;catalog=new Map((data.icons||[]).map(item=>[item.name,item]));refreshAdmonitionIcons();}).catch(()=>{if(request===iconRequest)catalog=new Map();});}return;}
  const options=window.SheriffIconOptions,appearance=options.parse(explicit||'[[icon|'+name+']]');icon.style.color=options.previewColor(asset,appearance.color);
    if(appearance.size){icon.style.width=appearance.size+'px';icon.style.height=appearance.size+'px';}
  if(asset.svg){const mask='url("data:image/svg+xml,'+encodeURIComponent(asset.svg)+'")';icon.style.maskImage=mask;icon.style.webkitMaskImage=mask;icon.style.backgroundColor='currentColor';}
  else if(asset.path||asset.png){const img=document.createElement('img');img.alt='';img.src=asset.png||window.SheriffDeskBackend.assetUrl(context.current,asset.path);icon.append(img);}else return;
  icon.hidden=false;
}
const SheriffAdmonition=Node.create({
  name:'sheriffAdmonition',group:'block',content:'block+',defining:true,isolating:true,selectable:true,
  addAttributes(){return {kind:{default:'note'},title:{default:''},icon:{default:''}};},parseHTML(){return [];},renderHTML(){return ['aside',{'data-sheriff-admonition':''},0];},
  addNodeView(){return ({node,getPos,editor:viewEditor})=>{
    const dom=document.createElement('aside'),head=document.createElement('div'),icon=document.createElement('span'),title=document.createElement('strong'),actions=document.createElement('div'),settings=document.createElement('button'),raw=document.createElement('button'),contentDOM=document.createElement('div');
    dom.className='visual-admonition';head.className='visual-admonition-head';head.contentEditable='false';icon.className='visual-admonition-icon';icon.setAttribute('aria-hidden','true');actions.className='visual-admonition-actions';contentDOM.className='visual-admonition-body';
    for(const button of [settings,raw]){button.type='button';button.className='btn small';}settings.textContent='Callout settings';raw.textContent='Edit in Source';actions.append(settings,raw);head.append(icon,title,actions);dom.append(head,contentDOM);
    settings.addEventListener('click',()=>{const pos=getPos();if(typeof pos!=='number'||source.disabled)return;viewEditor.commands.setNodeSelection(pos);openAdmonition({node:viewEditor.state.doc.nodeAt(pos),pos});});
    raw.addEventListener('click',()=>editSource(node.attrs.sourceId,serializeFragment(model,node.toJSON())));
    function paint(){const a=node.attrs;dom.dataset.kind=a.kind;dom.dataset.empty=String(node.childCount===1&&node.firstChild.type.name==='paragraph'&&node.firstChild.content.size===0);const explicit=a.icon||a.title.match(/\[\[icon\|[^\]]+\]\]/i)?.[0]||'';dom.dataset.explicitIcon=explicit;title.textContent=a.title.replace(/\[\[icon\|[^\]]+\]\]/gi,'').trim()||typeTitle(a.kind);paintAdmonitionIcon(dom);}
    paint();return {dom,contentDOM,stopEvent:event=>head.contains(event.target),ignoreMutation:mutation=>mutation.type!=='selection'&&!contentDOM.contains(mutation.target)&&mutation.target!==contentDOM,update(next){if(next.type!==node.type)return false;node=next;paint();return true;}};
  };}
});
function selectedAdmonition(){
  if(mode!=='visual'||!editor||selectedImage())return null;const selection=editor.state.selection;
  if(selection.node?.type.name==='sheriffAdmonition')return {node:selection.node,pos:selection.from};
  for(let depth=selection.$from.depth;depth>0;depth--){const node=selection.$from.node(depth);if(node.type.name==='sheriffAdmonition')return {node,pos:selection.$from.before(depth)};}return null;
}
function resolveAdmonition(){
  if(!admonitionTarget||admonitionTarget.key!==identity()||mode!=='visual'||!editor)return null;
  let node=editor.state.doc.nodeAt(admonitionTarget.pos);
  if(node?.type.name==='sheriffAdmonition'&&node.attrs.sourceId===admonitionTarget.id)return {node,pos:admonitionTarget.pos};
  let found;editor.state.doc.descendants((node,pos)=>{if(node.type.name==='sheriffAdmonition'&&node.attrs.sourceId===admonitionTarget.id)found={node,pos};});if(found)admonitionTarget.pos=found.pos;return found||null;
}
const ModalSource=Node.create({name:'sheriffModalSource',group:'block',atom:true,selectable:true,addAttributes(){return {original:{default:null},raw:{default:''},label:{default:'Sheriff source'}};},parseHTML(){return [];},renderHTML(){return ['div',{},'Sheriff source'];},addNodeView(){return ({node})=>{const dom=document.createElement('div');dom.className='visual-protected';dom.contentEditable='false';const head=document.createElement('div'),title=document.createElement('strong'),raw=document.createElement('pre');title.textContent=node.attrs.label;head.append(title);raw.textContent=node.attrs.raw;dom.append(head,raw);return {dom};};}});
function modalNodes(nodes){return nodes.map(node=>{
  if(['sheriffBlock','sheriffImage','sheriffAdmonition'].includes(node.type))return {type:'sheriffModalSource',attrs:{original:node,raw:serializeFragment(model,node),label:node.attrs?.label|| (node.type==='sheriffImage'?'Image':'Nested admonition')}};
  return {...node,...(node.content?{content:modalNodes(node.content)}:{})};
});}
function authoredNodes(nodes){return nodes.map(node=>node.type==='sheriffModalSource'?node.attrs.original:{...node,...(node.content?{content:authoredNodes(node.content)}:{})});}
function publishAdmonition(){
  const selected=resolveAdmonition();if(modalSync||!selected||source.disabled||!admonitionEditor)return;
  const nodes=authoredNodes(admonitionEditor.getJSON().content||[]);
  if(fingerprint({content:nodes})===fingerprint({content:selected.node.toJSON().content||[]}))return;
  modalSync=true;try{const replacement=nodes.map(node=>editor.schema.nodeFromJSON(node));editor.view.dispatch(editor.state.tr.replaceWith(selected.pos+1,selected.pos+selected.node.nodeSize-1,replacement));}finally{modalSync=false;}
}
function makeAdmonitionEditor(node){
  admonitionEditor?.destroy();admonitionEditor=new Editor({element:$('visual-admonition-content'),extensions:[StarterKit.configure({trailingNode:false,codeBlock:false,link:false,underline:false,strike:false}),SourceIds,VideoRows,TableRoles,SheriffTable,SheriffTableRow,SheriffTableCell,SheriffTableHeader,SheriffCodeBlock,InlineSelection,SheriffLink,SheriffInline,SheriffCitation,SheriffVideo,ModalSource],content:{type:'doc',content:modalNodes(node.toJSON().content||[])},enableInputRules:false,enablePasteRules:false,editorProps:{attributes:{class:'visual-admonition-document desk-rich-document',role:'textbox','aria-label':'Admonition content','aria-multiline':'true'},handlePaste(view,event){if(pasteLiteralCode(view,event)||pasteTableCell(view,event,admonitionEditor))return true;const text=event.clipboardData?.getData('text/plain');if(text===undefined)return false;event.preventDefault();const content=/^\[\[video:/i.test(text.trim())?null:inline(text);admonitionEditor.commands.insertContent(content||modalNodes(inserted(parsePage(text,{frontmatter:false}).doc.content)));return true;}},onUpdate(){publishAdmonition();updateAdmonitionToolbar();},onSelectionUpdate:updateAdmonitionToolbar});updateAdmonitionToolbar();
}
function openAdmonition(selected){
  if(!selected||source.disabled)return;
  // Pasted/inserted callouts also need a stable, editor-only identity.
  if(!selected.node.attrs.sourceId){const attrs={...selected.node.attrs,sourceId:'inserted-callout-'+(++insertedAdmonitions)};editor.view.dispatch(editor.state.tr.setNodeMarkup(selected.pos,undefined,attrs).setMeta('addToHistory',false));selected={node:editor.state.doc.nodeAt(selected.pos),pos:selected.pos};}
  window.dispatchEvent(new CustomEvent('sheriff:content-picker-open',{detail:{kind:'admonition'}}));
  admonitionTarget={key:identity(),id:selected.node.attrs.sourceId,pos:selected.pos};admonitionPanelOpen=true;makeAdmonitionEditor(selected.node);renderAdmonitionProperties();admonitionEditor.view.focus();
}
function renderAdmonitionProperties(){
  const panel=$('visual-admonition-properties'),selected=resolveAdmonition();panel.hidden=!admonitionPanelOpen||!selected;if(panel.hidden)return;
  for(const name of ['kind','title']){const field=$('visual-admonition-'+name),value=selected.node.attrs[name];if(field.value!==value)field.value=value;}
  $('visual-admonition-title').placeholder=typeTitle(selected.node.attrs.kind);
  panel.querySelectorAll('input,select,button').forEach(control=>control.disabled=source.disabled);admonitionEditor?.setEditable(!source.disabled);
  if(admonitionEditor&&!modalSync&&fingerprint({content:authoredNodes(admonitionEditor.getJSON().content||[])})!==fingerprint({content:selected.node.toJSON().content||[]}))makeAdmonitionEditor(selected.node);
}
function updateAdmonitionToolbar(){admonitionFormatting.update();}
function closeAdmonitionProperties(){
  if(admonitionEditor&&videoTarget?.owner===admonitionEditor)closeVideo();
  const selected=resolveAdmonition();admonitionPanelOpen=false;admonitionTarget=null;admonitionEditor?.destroy();admonitionEditor=null;$('visual-admonition-properties').hidden=true;
  if(selected)editor.view.nodeDOM(selected.pos)?.querySelector('button')?.focus({preventScroll:true});
}
function insertAdmonition(){
  if(!eligible()||source.disabled)return;
  if(mode!=='visual'){
    const target={...desk.contentEditor(),start:source.selectionStart,end:source.selectionEnd},before=source.value.slice(0,target.start),after=source.value.slice(target.end);
    const lead=before&&!before.endsWith('\n\n')?(before.endsWith('\n')?'\n':'\n\n'):'',tail=after&&!after.startsWith('\n\n')?(after.startsWith('\n')?'\n':'\n\n'):'';
    const body=source.value.slice(target.start,target.end),text=lead+'::: note\n'+body+'\n:::'+tail;
    if(desk.insertContent(text,target)){source.focus();const caret=target.start+lead.length+9;source.setSelectionRange(caret,caret+body.length);}return;
  }
  const current=selectedAdmonition(),pos=current?current.pos+current.node.nodeSize:editor.state.selection.to,id='inserted-callout-'+(++insertedAdmonitions);
  const node={type:'sheriffAdmonition',attrs:{kind:'note',title:'',icon:'',sourceId:id},content:[{type:'paragraph'}]};
  editor.chain().command(({tr})=>{closeHistory(tr);return true;}).insertContentAt(pos,node,{updateSelection:false}).run();
  let added;editor.state.doc.descendants((node,pos)=>{if(node.attrs.sourceId===id)added={node,pos};});
  if(added)openAdmonition(added);
}
function selectedImage(){const selection=editor?.state.selection;return mode==='visual'&&selection?.node?.type.name==='sheriffImage'?{node:selection.node,pos:selection.from}:null;}
function renderImageProperties(){
  const panel=$('visual-image-properties'),selected=selectedImage();panel.hidden=!selected||!imagePanelOpen;
  if(!selected){imageSelectionKey='';return;}
  const selectedKey=identity()+'\n'+selected.pos;
  if(selectedKey!==imageSelectionKey){imageSelectionKey=selectedKey;$('visual-image-status').textContent='Changes update this image in Source. Save when ready.';$('visual-image-status').classList.remove('err');}
  const attrs=selected.node.attrs;$('visual-image-path').textContent=attrs.path;
  for(const name of ['size','align','caption']){const field=$('visual-image-'+name);if(field.tagName==='SELECT'){for(const option of field.querySelectorAll('[data-custom]'))option.remove();if(!Array.from(field.options).some(option=>option.value===attrs[name])){const option=new Option(attrs[name],attrs[name]);option.dataset.custom='true';field.add(option);}}if(field.value!==attrs[name])field.value=attrs[name];}
  panel.querySelectorAll('input,select,button').forEach(control=>control.disabled=source.disabled);
}
function imageSyntax(attrs){return '[[image:'+attrs.path+'|'+attrs.size+'|'+attrs.align+'|'+attrs.caption+']]';}
function updateImage(changes,separate=false){
  const selected=selectedImage();if(!selected||source.disabled)return false;
  if(Object.entries(changes).every(([name,value])=>selected.node.attrs[name]===value))return true;
  const attrs={...selected.node.attrs,...changes};attrs.raw=imageSyntax(attrs);
  return editor.commands.command(({tr})=>{if(separate)closeHistory(tr);tr.setNodeMarkup(selected.pos,undefined,attrs);return true;});
}
function inserted(nodes){return nodes.map(node=>({...node,...(node.attrs?{attrs:{...node.attrs,sourceId:null}}:{}),...(node.content?{content:inserted(node.content)}:{})}));}
function toggleBlockquote(targetEditor=editor){
  if(!targetEditor||source.disabled)return;const {selection,doc}=targetEditor.state;let unsafe=false;
  doc.nodesBetween(selection.from,selection.to,(node,pos)=>{if(pos>=selection.from&&['sheriffBlock','sheriffVideo','sheriffImage','sheriffAdmonition','sheriffModalSource'].includes(node.type.name))unsafe=true;});
  if(unsafe){status('Click in editable text to make a blockquote. Protected source blocks stay intact.');return;}
  targetEditor.chain().focus().toggleBlockquote().run();
}
function markBaselines(){editor.state.doc.descendants(node=>{const record=model.records.get(node.attrs?.sourceId);if(record)record.fingerprint=fingerprint(node.toJSON());});}
function publish(){if(ownInput||!editor||mode!=='visual'||source.disabled)return;try{const next=serializePage(model,editor.getJSON());if(next!==source.value){source.value=next;loaded=next;revision++;ownInput=true;source.dispatchEvent(new Event('input',{bubbles:true}));ownInput=false;}status('Visual changes update Source. Save when you’re ready.');updateToolbar();}catch(error){status(error.message,true);}}
function load(){closeVideo();const text=source.value,next=parsePage(text);model=next;loaded=text;closeAdmonitionProperties();closePatternProperties();imagePanelOpen=false;
  // A new source document starts a new history. Undo must never restore a body
  // from before a Source edit or an earlier Visual session.
  if(editor){editor.destroy();editor=null;}
  if(!editor){editor=new Editor({element:surface,extensions:[StarterKit.configure({trailingNode:false,codeBlock:false,link:false,underline:false,strike:false,heading:{levels:[1,2,3,4,5,6]}}),SourceIds,VideoRows,TableRoles,SheriffTable,SheriffTableRow,SheriffTableCell,SheriffTableHeader,SheriffCodeBlock,ParagraphGaps,InlineSelection,SheriffLink,SheriffBlock,SheriffInline,SheriffCitation,SheriffImage,SheriffVideo,SheriffAdmonition],content:model.doc,enableInputRules:false,enablePasteRules:false,editorProps:{attributes:{class:'visual-document desk-rich-document',role:'textbox','aria-label':'Visual page content','aria-multiline':'true'},handlePaste(view,event){if(pasteLiteralCode(view,event)||pasteTableCell(view,event,editor))return true;const text=event.clipboardData?.getData('text/plain');if(text===undefined)return false;event.preventDefault();const content=/^\[\[video:/i.test(text.trim())?null:inline(text);if(content)editor.commands.insertContent(content);else editor.commands.insertContent(inserted(parsePage(text,{frontmatter:false}).doc.content));return true;}},onUpdate:publish,onSelectionUpdate:updateToolbar});}
  markBaselines();void loadAdmonitionSettings();editor.setEditable(!source.disabled);revision++;updateToolbar();
}
function render(){refreshVideo();$('visual-video-insert').disabled=source.disabled||!eligible();const show=mode==='visual'&&eligible();tabs.hidden=!eligible();source.hidden=show;surface.hidden=!show;$('visual-admonition-insert').disabled=source.disabled||!eligible();toolbar.hidden=!show;notice.hidden=!show;for(const button of tabs.querySelectorAll('button')){const active=button.dataset.mode===mode;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;button.disabled=source.disabled;}if(editor)editor.setEditable(!source.disabled);surface.querySelectorAll('.visual-paragraph-gap,.visual-code-head input,.visual-code-head button').forEach(button=>button.disabled=source.disabled);toolbar.querySelectorAll('button,select,input').forEach(control=>control.disabled=source.disabled);mainFormatting.update();mainFormatting.closeLink();renderImageProperties();renderAdmonitionProperties();renderPatternProperties();}
async function setMode(next){if(switching)return;editorScroll[mode]=(mode==='visual'?surface:source).scrollTop;switching=true;try{if(next==='visual'){if(source.disabled||!eligible())return;if(window.SheriffPageDetails&&!await window.SheriffPageDetails.flush())return;if(mode!=='visual'||source.value!==loaded)load();mode='visual';status('Edit text and callout bodies directly. Select an image, pattern, or callout for its settings.');}else {publish();closeVideo();mode='source';closeAdmonitionProperties();closePatternProperties();imagePanelOpen=false;}render();if(next==='visual')editor.view.focus();else source.focus({preventScroll:true});const destination=next==='visual'?surface:source,position=editorScroll[next],documentKey=identity();destination.scrollTop=position;requestAnimationFrame(()=>{if(mode===next&&documentKey===identity())destination.scrollTop=position;});}catch(error){mode='source';render();desk.notify(error.message);}finally{switching=false;}}
function synchronize(){const nextKey=identity();if(nextKey!==key){closeVideo();closeAdmonitionProperties();closePatternProperties();imagePanelOpen=false;key=nextKey;mode='source';editorScroll={source:0,visual:0};surface.scrollTop=0;loaded='';model=null;editor?.destroy();editor=null;revision++;render();return;}if(ownInput||mode!=='visual'||loaded===source.value){render();return;}try{const next=splitPage(source.value),old=splitPage(loaded);if(next.body===old.body){model.prefix=next.prefix;loaded=source.value;}else load();render();}catch(error){mode='source';render();desk.notify(error.message);}}
function updateToolbar(){refreshVideo();mainFormatting.update();renderImageProperties();renderAdmonitionProperties();renderPatternProperties();}
tabs.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>void setMode(button.dataset.mode)));
tabs.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?'visual':event.key==='End'?'source':mode==='visual'?'source':'visual';void setMode(next);tabs.querySelector('[data-mode="'+next+'"]').focus();});
for(const name of ['size','align','caption'])$('visual-image-'+name).addEventListener(name==='caption'?'input':'change',event=>{
  const selected=selectedImage();if(!selected||source.disabled)return;
  const message=$('visual-image-status'),value=event.target.value;
  if(name==='caption'&&/[|\[\]\r\n]/.test(value)){event.target.value=selected.node.attrs.caption;message.textContent='Captions cannot contain pipes, brackets, or newlines. The image is unchanged.';message.classList.add('err');return;}
  const propertyKey=identity()+'\n'+selected.pos+'\n'+name;
  updateImage({[name]:value},lastImageProperty!==propertyKey);lastImageProperty=propertyKey;message.textContent='Image updated in Source · not saved yet';message.classList.remove('err');
});
for(const name of ['size','align','caption'])$('visual-image-'+name).addEventListener('blur',()=>{lastImageProperty='';});
$('visual-image-replace').addEventListener('click',()=>{const selected=selectedImage();if(!selected||source.disabled)return;const capture={...window.SheriffVisualEditor.capture(),replaceImage:true};void window.SheriffContentImages.replace(capture,{...selected.node.attrs});});
$('visual-image-remove').addEventListener('click',()=>{if(!selectedImage()||source.disabled)return;editor.chain().focus().command(({tr})=>{closeHistory(tr);return true;}).deleteSelection().run();closeImageProperties();status('Image removed from this page · not saved yet. Undo restores it.');});
for(const name of ['kind','title'])$('visual-admonition-'+name).addEventListener(name==='title'?'input':'change',event=>{
  const selected=resolveAdmonition();if(!selected||source.disabled)return;const value=event.target.value;
  if(name==='title'&&/[\r\n]/.test(value)){event.target.value=selected.node.attrs.title;status('Callout titles must stay on one line.',true);return;}
  if(name==='kind'&&!admonitionTypes.includes(value))return;
  if(selected.node.attrs[name]===value)return;
  const property=identity()+'\n'+selected.pos+'\n'+name;
  editor.commands.command(({tr})=>{if(property!==lastAdmonitionProperty)closeHistory(tr);tr.setNodeMarkup(selected.pos,undefined,{...selected.node.attrs,[name]:value});return true;});lastAdmonitionProperty=property;
});
for(const name of ['kind','title'])$('visual-admonition-'+name).addEventListener('blur',()=>{lastAdmonitionProperty='';});
$('visual-admonition-insert').addEventListener('mousedown',event=>event.preventDefault());
$('visual-admonition-insert').addEventListener('click',insertAdmonition);
$('visual-admonition-close').addEventListener('click',closeAdmonitionProperties);
$('visual-admonition-done').addEventListener('click',closeAdmonitionProperties);
function closeImageProperties(){imagePanelOpen=false;$('visual-image-properties').hidden=true;const selected=selectedImage();if(selected)editor.view.nodeDOM(selected.pos)?.querySelector('button')?.focus({preventScroll:true});}
$('visual-image-close').addEventListener('click',closeImageProperties);$('visual-image-done').addEventListener('click',closeImageProperties);
$('visual-image-properties').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeImageProperties();}});
for(const id of ['visual-image-properties','visual-admonition-properties','visual-pattern-properties','visual-video-properties']){document.body.append($(id));desk.makeFloatingPanel($(id),'desk.'+id+'.position');}
window.addEventListener('sheriff:content-picker-open',event=>{if(event.detail.kind!=='pattern-settings')closePatternProperties();if(event.detail.kind!=='admonition'&&!(event.detail.kind==='video'&&videoTarget?.owner===admonitionEditor))closeAdmonitionProperties();if(event.detail.kind!=='video')closeVideo();if(event.detail.kind!=='image-settings')closeImageProperties();});
$('visual-admonition-properties').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeAdmonitionProperties();}});
$('visual-admonition-remove').addEventListener('click',()=>{const selected=resolveAdmonition();if(!selected||source.disabled)return;editor.chain().focus().command(({tr})=>{closeHistory(tr);tr.delete(selected.pos,selected.pos+selected.node.nodeSize);return true;}).run();closeAdmonitionProperties();status('Callout removed from this page · not saved yet. Undo restores it.');});
window.addEventListener('sheriff:saved-changes',event=>{if(event.detail?.portal===context.current)void loadAdmonitionSettings(true);});
source.addEventListener('input',()=>{if(!ownInput)synchronize();});
window.addEventListener('sheriff:editor-change',synchronize);context.subscribe(synchronize);new MutationObserver(synchronize).observe($('ed-path'),{childList:true,characterData:true,subtree:true});new MutationObserver(()=>{if(!source.disabled)synchronize();else render();}).observe(source,{attributes:true,attributeFilter:['disabled']});
window.SheriffVisualEditor={
  mode:()=>mode,
  scrollToTop(){if(mode!=='visual'||!editor)return;editor.commands.focus('start',{scrollIntoView:false});surface.scrollTop=0;editorScroll.visual=0;},
  capture(){if(mode!=='visual'||!editor)return null;return {key:identity(),revision,from:editor.state.selection.from,to:editor.state.selection.to};},
  insert(text,capture){
    if(mode!=='visual'||!editor||source.disabled||capture.key!==identity()||capture.revision!==revision)return false;
    if(editor.state.doc.resolve(capture.from).parent.type.name==='codeBlock'){editor.view.dispatch(editor.state.tr.insertText(text,capture.from,capture.to));editor.view.focus();return true;}
    if(isInTable(editor.state)){const content=inline(text)||[{type:'text',text}];editor.chain().focus().setTextSelection({from:capture.from,to:capture.to}).insertContent(inserted(content)).run();return true;}
    const normalized=text.trim(),image=/^\[\[image:/i.test(normalized),block=image||/^\[\[video:|^:::|^\{\{\{/.test(normalized);
    const content=block?parsePage(normalized,{frontmatter:false}).doc.content:inline(normalized)||[protectedNode(normalized)];
    if(capture.replaceImage){const current=editor.state.doc.nodeAt(capture.from),replacement=content[0];if(current?.type.name!=='sheriffImage'||content.length!==1||replacement.type!=='sheriffImage')return false;editor.commands.setNodeSelection(capture.from);const attrs=replacement.attrs;const result=updateImage({path:attrs.path,size:attrs.size,align:attrs.align,caption:attrs.caption},true);editor.commands.focus();return result;}
    editor.chain().focus().setTextSelection({from:capture.from,to:capture.to}).insertContent(inserted(content)).run();return true;
  },
  focus(){if(mode==='visual')editor?.commands.focus();else source.focus();},
  // Pure adapter exposed for regression checks and future frontend integrations.
  adapter:{parsePage,serializePage,parsePattern,editPattern},
};
synchronize();render();
