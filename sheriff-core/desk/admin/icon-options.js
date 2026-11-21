// Shared syntax and preview rules for Desk's icon browser, insert picker, and editor.
(function () {
  'use strict';
  function size(value) { const raw=String(value||'').trim(),n=Number(raw);return /^\d+$/.test(raw)&&n>=8&&n<=256?String(n):''; }
  function color(value) { const raw=String(value||'').trim();return raw.toLowerCase()==='brand'?'brand':raw.length<=120&&/^[a-zA-Z0-9#(),.% /+\-]+$/.test(raw)&&CSS.supports('color',raw)?raw:''; }
  function previewColor(icon,value) { const tint=color(value);return tint==='brand'?icon?.brandColor||'':tint; }
  function linkValid(value) {
    const raw=String(value||'').trim();if(!raw)return true;
    if(raw.length>2048||!/^[-a-zA-Z0-9:/?#@!$&()*+,._~=%]+$/.test(raw)||raw.startsWith('//'))return false;
    if(raw.startsWith('/')||raw.startsWith('#'))return true;
    if(!/^https?:\/\//i.test(raw))return false;
    try{return !!new URL(raw).hostname;}catch(_){return false;}
  }
  function syntax(icon,tint,pixels,link) {
    const parts=['icon',icon.name],c=icon.format==='png'?'':color(tint),s=size(pixels),url=String(link||'').trim();
    if(c||s||url)parts.push(c);if(s||url)parts.push(s);if(url)parts.push(url);
    return '[['+parts.join('|')+']]';
  }
  function parse(token) {
    const parts=token.replace(/^\[\[icon\|/i,'').replace(/\]\]$/,'').split('|');
    return {name:parts[0],color:size(parts[1])?color(parts[2]):color(parts[1]),size:size(parts[1])||size(parts[2]),link:parts[3]||''};
  }
  function matches(icon,query,collection) {
    const group=icon.collection||(icon.source==='Portal'?'portal':'core');
    return (!collection||group===collection)&&(icon.name+' '+(icon.title||'')+' '+(icon.filename||'')).toLowerCase().includes(query.toLowerCase());
  }
  window.SheriffIconOptions=Object.freeze({size,color,previewColor,linkValid,syntax,parse,matches});
}());
