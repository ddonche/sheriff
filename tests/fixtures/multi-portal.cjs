// Isolated sample sources, not user portals. Build logic runs in Goblin.
const fs=require('fs'),path=require('path');
module.exports=function prepare(repo,fixture){
const core=repo+'/sheriff-core';
for(const dir of ['modules','themes','glams','build-support'])fs.cpSync(core+'/'+dir,fixture+'/sheriff-core/'+dir,{recursive:true});
for(const file of ['main.gbln','manifest.imports','events.yall','box.toml','build-support/output.gbln','modules/site_portals/cli.gbln'])fs.copyFileSync(core+'/'+file,fixture+'/sheriff-core/'+file);
fs.mkdirSync(fixture+'/sheriff-core/assets/icons',{recursive:true});for(const icon of ['layers','compass','sun-moon','book-open','cpu','landmark','folder','notebook-pen'])fs.copyFileSync(core+'/assets/icons/'+icon+'.svg',fixture+'/sheriff-core/assets/icons/'+icon+'.svg');
for(const theme of ['compendium','outpost','siegemate']){
 const site='iveki-'+theme,siteDir=fixture+'/site/sites/'+site;fs.mkdirSync(siteDir,{recursive:true});
 fs.writeFileSync(siteDir+'/site.yall',`name: Iveki\ndescription: A place to explore ideas, share knowledge, and follow your curiosity. Start with a portal.\ntheme: ${theme}\nportals:\n  programming:\n    source: ${theme}-programming\n    name: Programming\n    icon: cpu\n    description: Explore programming languages, tools, and the ideas behind the software we build.\n  philosophy:\n    source: ${theme}-philosophy\n    name: Philosophy\n    icon: landmark\n    description: Ask questions about knowledge, ethics, and how we make sense of the world.\n`);
 for(const portal of ['programming','philosophy']){
  const id=theme+'-'+portal,p=fixture+'/site/portals/'+id;fs.mkdirSync(p+'/content/articles',{recursive:true});fs.mkdirSync(p+'/public/images',{recursive:true});fs.cpSync(repo+'/site/portals/programming/public/js',p+'/public/js',{recursive:true});fs.copyFileSync(core+'/assets/icons/'+(portal==='programming'?'cpu':'landmark')+'.svg',p+'/public/images/sample.svg');
  fs.writeFileSync(p+'/config.yall',`id: ${id}\nname: ${portal==='programming'?'Programming':'Philosophy'}\nmembership:\n  site: ${site}\n  portal: ${portal}\ntheme:\n  name: ${theme}\n  brand_name: ${portal}\n  logo: images/sample.svg\nrouting:\n  content_dir: content\n  url_root: \nbuild:\n  workers: 2\n`);
  fs.writeFileSync(p+'/nav.yall',`menus:\n  left_wiki:\n    Explore:\n      Overview: /index.html\n      Articles: /all_pages.html\n      Categories: /categories.html\n  header:\n    Home: /index.html\n`);
  const other=portal==='programming'?'philosophy':'programming',title=portal==='programming'?'Programming':'Philosophy';
  fs.writeFileSync(p+'/content/index.md',`^^^^\ntitle: ${title} Wiki\nlayout: wiki\nmeta_kind: wiki\nmeta_type: overview\nsummary: Explore the ${portal} wiki.\ncanonical: index\n^^^^\n\nWelcome to the ${title} wiki. Explore [[Overview]] and [[Ethics]].\n\n## Across Iveki\n\nRead [[p/${other}/wiki/Overview|the ${other} overview]] or visit [[p/${other}/wiki|the other wiki]].\n`);
  for(const [slug,label,text] of [['overview','Overview',portal==='programming'?'Programming turns ideas into working systems. Explore languages, algorithms, and tools.':'Philosophy examines knowledge, meaning, and the reasons behind our beliefs.'],['ethics','Ethics',portal==='programming'?'Software ethics considers privacy, accessibility, and the consequences of our technical choices.':'Ethics asks how we ought to live and what we owe to one another.']])fs.writeFileSync(p+'/content/articles/'+slug+'.md',`^^^^\ntitle: ${label}\nlayout: wiki\nmeta_kind: wiki\nmeta_type: article\ncanonical: ${slug}\nsummary: ${text}\ngloss: ${text}\ncategories: [${title}]\n^^^^\n\n${text}\n\n[[image:sample.svg|thumb|right|${title} portal]]\n\n## Explore further\n\nRead [[Overview]] and [[Ethics]]. Compare [[p/${other}/wiki/${label}|${label} in ${other}]].\n\n## Source example\n\n\x60\x60\x60text\n[[p/${other}/wiki/${label}]]\n<a href="/literal-example">This stays literal.</a>\n\x60\x60\x60\n`);
 }
}
// Menus used by the built-in layouts; explicit fixture data, never user portals.
for(const theme of ['compendium','outpost','siegemate'])for(const portal of ['programming','philosophy']){
 const p=fixture+'/site/portals/'+theme+'-'+portal;
 const menu='    Explore:\n      Overview: /index.html\n      Articles: /all_pages.html\n      Categories: /categories.html\n';
 fs.writeFileSync(p+'/nav.yall','menus:\n  left_wiki:\n'+menu+'  left_docs:\n'+menu+'  header:\n    Home: /index.html\n  footer_left:\n    Iveki: /p/\n  footer_right:\n    Portals: /p/\n');
}

};
