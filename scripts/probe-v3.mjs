import{mkdir,writeFile}from'node:fs/promises';import{load}from'cheerio';
await mkdir('artifacts/v3-probes',{recursive:true});
const urls=[
 ['robots-opgg','https://op.gg/robots.txt'],
 ...(process.env.TCHIM_OPGG_URL ? [['opgg',process.env.TCHIM_OPGG_URL]] : []),
 ['lol-team','https://lolalytics.com/lol/ahri/build/?tier=master_plus&patch=16.20&lane=middle&view=synergy'],
 ['lol-build','https://lolalytics.com/lol/ahri/build/?tier=master_plus&patch=16.20&lane=middle'],
 ['gol-tournaments','https://gol.gg/tournament/list/'],
 ['gol-matches','https://gol.gg/game/list/']];
for(const[name,url]of urls){try{const r=await fetch(url,{headers:{'User-Agent':'TchimDraft/0.3 (+local desktop draft statistics)'},redirect:'manual',signal:AbortSignal.timeout(25000)});const h=await r.text();await writeFile(`artifacts/v3-probes/${name}.html`,h);const q=load(h);console.log(name,r.status,'redirect',r.headers.get('location'),'title',q('title').text(),'size',h.length);if(name==='robots-opgg')console.log(h.slice(0,2600));
 if(name==='lol-build'){console.log('synergy-button',q('[data-type=common_synergy]').attr('on:click'));console.log('js',q('script[src]').toArray().map(e=>e.attribs.src).slice(-6));}
 if(name.startsWith('gol-')) console.log('tables',q('table').toArray().slice(-2).map(t=>({h:q(t).find('tr').first().text().replace(/\s+/g,' '),r:q(t).find('tr').eq(1).text().replace(/\s+/g,' ')})),'links',q('a[href]').toArray().map(e=>e.attribs.href).filter(h=>/stats|list|games|patch/.test(h)).slice(-15));
 if(name==='opgg')console.log('scripts',q('script').toArray().filter(e=>e.attribs.type==='application/json').map(e=>({id:e.attribs.id,size:q(e).text().length})), 'text',q('body').text().replace(/\s+/g,' ').slice(-1500));
 }catch(e){console.log(name,String(e))}await new Promise(r=>setTimeout(r,2600));}
