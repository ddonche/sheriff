/* All index parsing and query scoring happen off the page's UI thread. */
'use strict';
importScripts('prospector-engine.js');
let engine=null,loading=null;
async function load(){if(engine)return engine;if(!loading)loading=fetch('search-index.json',{cache:'no-cache'}).then(response=>{if(!response.ok)throw Error('Search index unavailable.');return response.text();}).then(text=>engine=ProspectorEngine.create(ProspectorEngine.parse(text))).catch(error=>{loading=null;throw error;});return loading;}
self.onmessage=async event=>{const {id,query,category}=event.data||{};try{const search=await load();self.postMessage({id,...search.query(query,{category,limit:10})});}catch{self.postMessage({id,error:'Search is unavailable right now. Try again shortly.'});}};
