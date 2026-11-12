/* Prospector search engine. Pure data operations shared by Web Workers and fallback clients. */
(function(root){
  'use strict';
  const delimiters=/[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~…“”‘’—–]+/u;
  const words=value=>String(value||'').toLowerCase().split(delimiters).filter(Boolean);
  const normalize=value=>words(value).join(' ');
  const safeHref=href=>typeof href==='string'&&href.startsWith('/')&&!href.startsWith('//')&&!/[\\\u0000-\u001f\u007f]/u.test(href);
  function legacy(text){
    const documents=[];for(const line of text.split(/\r?\n/)){if(!line.trim())continue;try{const item=JSON.parse(line);if(safeHref(item.href)&&typeof item.title==='string')documents.push({...item,text:item.summary||'',aliases:[],headings:[],categories:item.categories||[]});}catch{}}
    if(!documents.length&&text.trim())throw Error('Unsupported search index.');const unique=[...new Map(documents.map(doc=>[doc.href,doc])).values()],postings=Object.create(null);
    unique.forEach((doc,id)=>{const counts=Object.create(null);for(const [text,weight]of [[doc.title,8],[doc.summary,2]])for(const term of words(text))counts[term]=(counts[term]||0)+weight;for(const [term,score]of Object.entries(counts))(postings[term]||(postings[term]=[])).push([id,score]);});return {version:1,documents:unique,postings};
  }
  function parse(text){let data;try{data=JSON.parse(text);}catch{return legacy(text);}if(data&&data.version===undefined&&safeHref(data.href)&&typeof data.title==='string')return legacy(text);if(!data||data.version!==1||!Array.isArray(data.documents)||!data.postings||typeof data.postings!=='object')throw Error('Unsupported search index.');return data;}
  function distanceOne(a,b){if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,edits=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++edits>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}return edits+(a.length-i)+(b.length-j)<=1;}
  function create(index){
    if(!index||index.version!==1||!Array.isArray(index.documents)||!index.postings||typeof index.postings!=='object')throw Error('Unsupported search index.');
    const docs=index.documents,postings=index.postings,vocabulary=Object.keys(postings).sort(),categories=[...new Set(docs.flatMap(doc=>Array.isArray(doc.categories)?doc.categories.filter(c=>typeof c==='string'):[]))].sort((a,b)=>a.localeCompare(b));
    function lowerBound(value){let low=0,high=vocabulary.length;while(low<high){const mid=(low+high)>>>1;if(vocabulary[mid]<value)low=mid+1;else high=mid;}return low;}
    function expand(term,prefix){const matches=[];if(Object.hasOwn(postings,term))matches.push([term,1]);if(prefix){let i=lowerBound(term);for(;i<vocabulary.length&&vocabulary[i].startsWith(term)&&matches.length<64;i++)if(vocabulary[i]!==term)matches.push([vocabulary[i],.7]);}if(!matches.length&&term.length>=4){let checked=0;for(const word of vocabulary){if(Math.abs(word.length-term.length)>1)continue;if(++checked>5000)break;if(distanceOne(term,word))matches.push([word,.35]);if(matches.length>=16)break;}}return matches;}
    function query(raw,options={}){
      const source=String(raw||'').trim().slice(0,500),phrases=[...source.matchAll(/"([^"]+)"/g)].map(m=>normalize(m[1])).filter(Boolean),queryWords=words(source.replaceAll('"','')).slice(0,16),unique=[...new Set(queryWords)];if(!unique.length)return {results:[],total:0,categories};
      let scores=null;
      for(const term of unique){const hits=new Map();for(const [word,factor]of expand(term,term===queryWords.at(-1)&&!source.endsWith('"'))){const rows=postings[word];if(!Array.isArray(rows))continue;const idf=Math.log(1+docs.length/(1+rows.length));for(const row of rows){if(!Array.isArray(row)||!Number.isInteger(row[0])||!Number.isFinite(row[1])||row[0]<0||row[0]>=docs.length)continue;const weight=factor*idf*(1+Math.log(1+Math.max(0,row[1])));hits.set(row[0],Math.max(hits.get(row[0])||0,weight));}}
        if(scores===null)scores=hits;else for(const [id,score]of scores){if(!hits.has(id))scores.delete(id);else scores.set(id,score+hits.get(id));}if(!scores.size)break;
      }
      const normalized=normalize(source),found=[];
      for(const [id,score]of scores||[]){const doc=docs[id];if(!doc||!safeHref(doc.href)||typeof doc.title!=='string')continue;const cats=Array.isArray(doc.categories)?doc.categories:[];if(options.category&&!cats.includes(options.category))continue;const aliases=Array.isArray(doc.aliases)?doc.aliases:[],title=normalize(doc.title),all=normalize([doc.title,...aliases,...(doc.headings||[]),doc.text||doc.summary||''].join(' '));if(phrases.some(phrase=>!all.includes(phrase)))continue;
        let rank=score;if(title===normalized)rank+=100;else if(aliases.some(alias=>normalize(alias)===normalized))rank+=80;else if(title.startsWith(normalized))rank+=20;if(doc.default_version)rank+=.25;
        const body=String(doc.text||doc.summary||''),lower=body.toLowerCase();let match=-1;for(const term of queryWords){const at=lower.indexOf(term);if(at>=0&&(match<0||at<match))match=at;}let start=Math.max(0,match-70),end=Math.min(body.length,start+230);if(start>0){const gap=body.indexOf(' ',start);if(gap>=0&&gap<start+25)start=gap+1;}const excerpt=(start?'…':'')+body.slice(start,end).trim()+(end<body.length?'…':'');found.push({href:doc.href,title:doc.title,excerpt,score:rank,categories:cats,version:doc.version||'',thumbnail:typeof doc.thumbnail==='string'?doc.thumbnail:''});
      }
      found.sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title)||a.href.localeCompare(b.href));return {results:found.slice(0,Math.min(50,Math.max(1,options.limit||10))),total:found.length,categories};
    }
    return {query,categories,count:docs.length};
  }
  const api={words,normalize,parse,create};if(typeof module==='object'&&module.exports)module.exports=api;else root.ProspectorEngine=api;
}(typeof globalThis==='object'?globalThis:this));
