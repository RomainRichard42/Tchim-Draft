import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { mergeDataPacks } from '../shared/packs';
import { validateDataPack } from '../shared/validate-pack';
import { latestPatches } from '../shared/patches';
import { datasetSchema, publicChampionSchema, type DatasetManifest } from '../shared/dataset';
import type { DataPack } from '../shared/types';

const hash=(body:Buffer|string)=>createHash('sha256').update(body).digest('hex');
export async function exportDataset(db:Database.Database,directory:string):Promise<DatasetManifest> {
  // No Storage constructor: the editor's database remains read-only and no user kv/session/log is exported.
  const packs=(db.prepare('SELECT raw FROM packs ORDER BY imported_at').all() as {raw:string}[]).map(p=>JSON.parse(p.raw) as DataPack)
    .filter(p=>!p.provenance.demo&&/^golgg-|^lolalytics-/.test(p.id));
  if(!packs.length)throw new Error('Collect real gol.gg / Lolalytics data first');
  // Reuse the engine's exact dimension replacement rules, without touching private tables.
  const input=mergeDataPacks(packs);
  const staticRow=db.prepare("SELECT value FROM kv WHERE key = 'staticVersion'").get() as {value:string}|undefined;
  const staticVersion=staticRow?JSON.parse(staticRow.value):null;if(!staticVersion)throw new Error('Data Dragon catalog required');
  const champions=(db.prepare('SELECT json FROM champions ORDER BY id').all()).map(row=>{const {icon,...publicFields}=JSON.parse((row as {json:string}).json);return publicChampionSchema.parse(publicFields);});
  const known=new Set(champions.map(c=>c.id));
  const createdAt=packs.map(p=>p.createdAt).sort().at(-1)!;
  const parts:DatasetManifest['parts']=[],coverage:DatasetManifest['coverage']=[];
  await mkdir(directory,{recursive:true});
  let previous:DatasetManifest|undefined;
  try {previous=datasetSchema.parse(JSON.parse(await readFile(path.join(directory,'manifest.json'),'utf8')));} catch { /* First export or invalid local cache. */ }
  for(const source of ['solo','pro'] as const) {
    const patches=latestPatches(input.stats.filter(s=>s.source===source&&(source!=='solo'||s.rank==='MASTER_PLUS')).map(s=>s.patch));
    const stats=input.stats.filter(s=>s.source===source&&patches.includes(s.patch)&&(source!=='solo'||s.rank==='MASTER_PLUS'));
    const pairs=input.pairs.filter(s=>s.source===source&&patches.includes(s.patch)&&(source!=='solo'||s.rank==='MASTER_PLUS'));
    const games=source==='pro'?(input.games??[]).filter(g=>patches.includes(g.patch)):[];
    coverage.push({source,patches,stats:stats.length,pairs:pairs.length,games:games.length});
    for(const patch of patches) {
      const patchPairs=pairs.filter(p=>p.patch===patch),patchStats=stats.filter(p=>p.patch===patch),patchGames=games.filter(p=>p.patch===patch);
      const stamp=packs.filter(p=>p.stats.some(s=>s.source===source&&s.patch===patch)||p.pairs.some(s=>s.source===source&&s.patch===patch)).map(p=>p.createdAt).sort().at(-1)!;
      for(let offset=0;offset<Math.max(1,patchPairs.length);offset+=75000) {
        const pack:DataPack={schemaVersion:1,id:`shared-${source}-${patch}-${Math.floor(offset/75000)}`,createdAt:stamp,
          provenance:{name:source==='pro'?`gol.gg ${patch}`:`Lolalytics Master+ ${patch}`,url:source==='pro'?'https://gol.gg/':'https://lolalytics.com/',license:'Public statistics collected by the publisher. Source attribution retained; robots.txt is not a redistribution license.',demo:false},
          stats:offset?[]:patchStats,pairs:patchPairs.slice(offset,offset+75000),games:offset?[]:patchGames};
        const raw=JSON.stringify(validateDataPack(pack,known));let body:Buffer|undefined;
        if(Buffer.byteLength(raw)>48*1024*1024)throw new Error('Dataset part too large');
        const old=previous?.parts.find(p=>p.id===pack.id);
        if(old) try {
          const cached=await readFile(path.join(directory,`${old.sha256}.json.gz`));
          if(cached.length===old.bytes&&hash(cached)===old.sha256) {
            const oldRaw=gunzipSync(cached,{maxOutputLength:48*1024*1024}).toString('utf8');
            // A new collection timestamp alone does not require everyone to download identical statistics again.
            if(oldRaw.replace(/("createdAt":)"[^"]*"/,`$1${JSON.stringify(pack.createdAt)}`)===raw)body=cached;
          }
        } catch { /* Repair the exported part from the validated local data. */ }
        body??=gzipSync(raw,{level:9});
        const sha256=hash(body);await writeFile(path.join(directory,`${sha256}.json.gz`),body);
        parts.push({id:pack.id,sha256,bytes:body.length,stats:pack.stats.length,pairs:pack.pairs.length,games:pack.games.length});
      }
    }
  }
  const revision=hash(JSON.stringify({staticVersion,champions,parts,coverage}));
  const manifest=datasetSchema.parse({schemaVersion:2,kind:'tchim-dataset',revision,createdAt,staticVersion,champions,parts,coverage});
  await writeFile(path.join(directory,'manifest.json.tmp'),JSON.stringify(manifest,null,2));await rename(path.join(directory,'manifest.json.tmp'),path.join(directory,'manifest.json'));
  return manifest;
}

if(process.argv[1]?.endsWith('export-dataset.cjs')) {
  const flags=Object.fromEntries(process.argv.slice(2).map(a=>{const [key,...rest]=a.replace(/^--/,'').split('=');return [key,rest.join('=')]}));
  const db=new Database(path.resolve(flags.database||'data/local/tchim.sqlite'),{readonly:true});
  exportDataset(db,path.resolve(flags.output||'data/shared')).then(m=>console.log(JSON.stringify({revision:m.revision,parts:m.parts.length,bytes:m.parts.reduce((sum,p)=>sum+p.bytes,0),coverage:m.coverage},null,2))).catch(error=>{console.error(error);process.exitCode=1}).finally(()=>db.close());
}
