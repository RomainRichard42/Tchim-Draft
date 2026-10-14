import Database from 'better-sqlite3';
import {writeFile,readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{exportDataset}=require('../dist/collector/export-dataset.cjs');
const db=new Database('data/refresh-20261014/tchim.sqlite',{readonly:true,fileMustExist:true});
const marker=JSON.parse(db.prepare('SELECT value FROM kv WHERE key=?').get('scrapeWindow').value);
if(!marker.complete)throw new Error('Collection incomplete; do not publish');
const originals=db.prepare('SELECT raw FROM packs WHERE id LIKE ?').all('golgg-games-%').flatMap(r=>JSON.parse(r.raw).games);
const manifest=await exportDataset(db,'data/shared','data/local/scraping');db.close();
const games=[],stats=[];for(const part of manifest.parts){const pack=JSON.parse(gunzipSync(await readFile('data/shared/'+part.sha256+'.json.gz')));games.push(...pack.games);stats.push(...pack.stats);}
const before=new Map(originals.map(g=>[g.id,g]));
const report={revision:manifest.revision,createdAt:manifest.createdAt,champions:manifest.champions.length,coverage:manifest.coverage,parts:manifest.parts.length,bytes:manifest.parts.reduce((n,p)=>n+p.bytes,0),games:games.length,dated:games.filter(g=>g.playedAt).length,teams:games.filter(g=>g.teams).length,knownOrder:games.filter(g=>g.draftOrderKnown).length,correctedSides:games.filter(g=>before.get(g.id)?.winner!==g.winner).length,gamePatches:Object.fromEntries(manifest.coverage.find(c=>c.source==='pro').patches.map(p=>[p,games.filter(g=>g.patch===p).length])),soloRanks:[...new Set(stats.filter(s=>s.source==='solo').map(s=>s.rank))]};
if(report.soloRanks.length!==1||report.soloRanks[0]!=='MASTER_PLUS'||report.knownOrder<games.length*.9)throw new Error('Rank or pro order coverage failed; publication stopped');
await writeFile('artifacts/statistics-refresh-review.json',JSON.stringify(report,null,2));console.log('STATISTICS_REVIEW_OK',JSON.stringify(report));
