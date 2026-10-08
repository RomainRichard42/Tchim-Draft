import Database from 'better-sqlite3';
import {load} from 'cheerio';
import {mkdir,readFile,writeFile}from'node:fs/promises';
await mkdir('tests/fixtures',{recursive:true});
// Pin public-page data captured during development, strip tracking and executable scripts.
const db=new Database('data/local/scraping/scrape-cache.sqlite',{readonly:true});
for(const [name,predicate]of[
 ['lol-tierlist',r=>r.url.includes('/tierlist/')&&r.url.includes('lane=top')],
 ['lol-build',r=>r.url.includes('/build/')],
 ['gol-stats',r=>r.url.includes('/champion/list/')],
 ['gol-game',r=>r.url.includes('/stats/82471/page-game/')]]){
 for(const r of db.prepare('SELECT * FROM pages ORDER BY at').all().filter(predicate)){
  const q=load(await readFile(`data/local/scraping/raw/${r.hash}.html`,'utf8'));
  if(name==='gol-stats'&&q('input[name=role]').attr('value')!=='TOP')continue;
  if(name.startsWith('lol')){await writeFile(`tests/fixtures/${name}.html`,`<html><script type="qwik/json">${q('script[type="qwik/json"]').text()}</script></html>`);}
  else{const gold=q('script').toArray().map(e=>q(e).text()).find(s=>/var golddatas\s*=/.test(s));q('script,style,link,iframe,ins').remove();if(gold)q('body').append(`<script type="text/plain">${gold}</script>`);await writeFile(`tests/fixtures/${name}.html`,q.html());}
  console.log(name,r.url);break;
 }
}
db.close();
const d=JSON.parse(await readFile('data/local/raw/ddragon-16.20.1.json','utf8'));
await writeFile('tests/fixtures/champion-ids.json',JSON.stringify(Object.values(d.data).map(c=>({id:c.id,key:Number(c.key),name:c.name}))));
