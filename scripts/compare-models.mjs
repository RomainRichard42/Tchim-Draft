import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
import {build} from 'esbuild';
const flags=Object.fromEntries(process.argv.slice(2).map(arg=>{const [key,...value]=arg.replace(/^--/,'').split('=');return [key,value.join('=')];}));
if(!flags.dataset||!flags.candidate||!flags.previous||!flags.output)throw Error('Required: --dataset= --candidate=directory --previous=model.json --output=directory');
const json=async file=>JSON.parse(await readFile(file,'utf8')),require=createRequire(import.meta.url);
await mkdir(flags.output,{recursive:true});await mkdir('artifacts',{recursive:true});
await build({entryPoints:['src/engine/learning.ts','src/engine/learning-weights.ts','src/engine/meta-features.ts'],bundle:true,platform:'node',format:'cjs',outdir:'artifacts/model-comparison-tools',outExtension:{'.js':'.cjs'}});
const {trainingExamples}=require('../artifacts/model-comparison-tools/learning.cjs'),{gameWeight,LEARNING_POLICY}=require('../artifacts/model-comparison-tools/learning-weights.cjs');
const manifest=await require('../dist/collector/export-dataset.cjs').readDatasetManifest(path.join(flags.dataset,'manifest.json'));
const candidate=await json(path.join(flags.candidate,'shared-model-candidate.json')),previous=await json(flags.previous),predictions=await json(path.join(flags.candidate,'chronological-predictions.json')),games=[];
if(candidate.datasetRevision!==manifest.revision||previous.datasetRevision!==manifest.revision)throw Error('Models must use the same dataset revision');
for(const p of manifest.parts.filter(p=>p.games)){const bytes=await readFile(path.join(flags.dataset,p.sha256+'.json.gz'));if(bytes.length!==p.bytes||createHash('sha256').update(bytes).digest('hex')!==p.sha256)throw Error('Invalid comparison archive');games.push(...JSON.parse(gunzipSync(bytes)).games);}
const {draftRetention,buildMetaContext}=require('../artifacts/model-comparison-tools/meta-features.cjs');
const environment=candidate.learning.meta?{snapshots:await json(path.join(flags.candidate,'meta-snapshots.json')),knowledge:await json(path.join(flags.candidate,'meta-knowledge.json'))}:undefined;
const examples=new Map(trainingExamples(manifest.champions,games,[]).map(row=>[row.id,row]));
const latest=predictions.filter(p=>p.patch===previous.patches[0]).map(p=>{const row=examples.get(p.id);if(!row||p.trainingLatestDay>=p.day)throw Error('Invalid chronological prediction');const score=Object.entries(row.x).reduce((n,[k,v])=>n+(previous.features[k]??0)*v,0);return {...p,previousFrozen:1/(1+Math.exp(-Math.max(-25,Math.min(25,score)))),relevance:gameWeight(row,candidate.learning)*(environment?draftRetention(row.lineups,row.patch,candidate.learning,environment.knowledge):1)};});
const loss=(y,p)=>-y*Math.log(Math.max(1e-10,p))-(1-y)*Math.log(Math.max(1e-10,1-p));
function metrics(rows,key,weighted=false){const total=rows.reduce((n,r)=>n+(weighted?r.relevance:1),0);return {games:rows.length,logLoss:rows.reduce((n,r)=>n+loss(r.y,r[key])*(weighted?r.relevance:1),0)/total,brier:rows.reduce((n,r)=>n+(r[key]-r.y)**2*(weighted?r.relevance:1),0)/total,accuracy:rows.reduce((n,r)=>n+Number(Number(r[key]>=.5)===r.y)*(weighted?r.relevance:1),0)/total};}
// Paired day-block bootstrap: games in a BO/day are not assumed independent.
function interval(rows){const days=[...new Set(rows.map(p=>p.day))],groups=days.map(d=>rows.filter(p=>p.day===d));if(groups.length<2)return null;let seed=20261025;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);const differences=[];for(let n=0;n<2000;n++){const sample=groups.flatMap(()=>groups[Math.floor(random()*groups.length)]);differences.push(metrics(sample,'candidate').logLoss-metrics(sample,'previousFrozen').logLoss);}differences.sort((a,b)=>a-b);return {unit:'day',days:days.length,repetitions:2000,candidateMinusPrevious95:[differences[50],differences[1949]]};}
const compare=rows=>({candidate:metrics(rows,'candidate'),previousPublished:metrics(rows,'previousFrozen'),previousRolling:metrics(rows,'previous'),unweightedSameRegularization:metrics(rows,'unweightedControl'),sideReference:metrics(rows,'side'),...(rows[0]?.recencyOnly!==undefined?{recencyOnly:metrics(rows,'recencyOnly'),metaStrengthBaseline:metrics(rows,'metaBaseline')}:{}),relevanceWeighted:{candidate:metrics(rows,'candidate',true),previousPublished:metrics(rows,'previousFrozen',true)},uncertainty:interval(rows)});
const frozen=metrics(latest,'previousFrozen');if(frozen.games!==previous.test.games||Math.abs(frozen.logLoss-previous.test.logLoss)>1e-9)throw Error('Published holdout could not be reproduced');
const report={method:candidate.learning.method,datasetRevision:manifest.revision,asOf:candidate.learning.asOf,livePatch:candidate.learning.livePatch,policy:LEARNING_POLICY,retrospective:true,alreadyInspectedData:true,productionChanged:false,finalRefitGames:candidate.train.games,finalRefitWorlds:games.filter(g=>g.league==='WORLDS').length,effectiveGames:candidate.learning.effectiveGames,eligible:candidate.eligible,reasons:candidate.reasons,weightGroups:candidate.learning.weightGroups,latestPatch:compare(latest),worlds:compare(latest.filter(p=>p.league==='WORLDS')),meta:candidate.learning.meta,rollingValidation:candidate.learning.validation};
if(environment){
 const live=buildMetaContext(games,environment,candidate.learning),roles=['TOP','JUNGLE','MID','ADC','SUPPORT'];
 const profiles=manifest.champions.flatMap(c=>roles.map(role=>({championId:c.id,role,...live.profile({championId:c.id,role})}))).filter(p=>p.proGames>0||p.soloGames>0);
 await writeFile(path.join(flags.output,'live-patch-profiles.json'),JSON.stringify({asOf:candidate.learning.asOf,patch:candidate.learning.livePatch,note:'Shrunk statistical deltas and bounded patch priors; not calibrated draft win probabilities.',snapshots:environment.snapshots.map(s=>({availableAt:s.availableAt,patches:[...new Set(s.stats.map(r=>r.patch))]})),profiles},null,2)+'\n');
}
await writeFile(path.join(flags.output,'chronological-predictions.json'),JSON.stringify(predictions,null,2)+'\n');
await writeFile(path.join(flags.output,'comparison.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(path.join(flags.output,'candidate-model.json'),JSON.stringify(candidate,null,2)+'\n');
console.log('MODEL_COMPARISON',JSON.stringify(report));
