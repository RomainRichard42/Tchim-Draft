import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';
await mkdir('artifacts',{recursive:true});
await build({entryPoints:['src/engine/index.ts','src/engine/selection.ts','src/shared/champions.ts','src/shared/draft.ts'],bundle:true,platform:'node',format:'cjs',outdir:'artifacts/lock-benchmark',outExtension:{'.js':'.cjs'}});
const require=createRequire(import.meta.url),{rankCandidates}=require('../artifacts/lock-benchmark/engine/index.cjs'),{commitSelection}=require('../artifacts/lock-benchmark/engine/selection.cjs'),{DEFAULT_SETTINGS}=require('../artifacts/lock-benchmark/shared/champions.cjs'),{newDraft}=require('../artifacts/lock-benchmark/shared/draft.cjs');
const root='data/shared-20261025',manifest=JSON.parse(await readFile(root+'/manifest.json','utf8')),stats=[],pairs=[],games=[];
for(const part of manifest.parts){const pack=JSON.parse(gunzipSync(await readFile(root+'/'+part.sha256+'.json.gz')));stats.push(...pack.stats);for(const p of pack.pairs)pairs.push(p);games.push(...pack.games);}
const input={draft:{...newDraft('16.21'),history:Array.from({length:6},()=>({championId:null}))},settings:DEFAULT_SETTINGS,champions:manifest.champions,stats,pairs,games,demo:false};
const before=performance.now();rankCandidates(input,'blue','TOP',false,true,'Gragas');const previousMs=performance.now()-before;
const timings=[];for(let i=0;i<30;i++){const at=performance.now();commitSelection(input,{championId:'Gragas',role:'TOP'});timings.push(performance.now()-at);}
const report={games:games.length,pairs:pairs.length,previousSynchronousScoringMs:previousMs,commitMeanMs:timings.reduce((a,b)=>a+b,0)/timings.length,commitMaxMs:Math.max(...timings),scope:'engine commit only; see desktop regression for IPC and visible confirmation'};
await writeFile('artifacts/lock-benchmark.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
