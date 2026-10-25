import { Worker } from 'node:worker_threads';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import { adminConfig } from './supabase-admin.mjs';
const flags=Object.fromEntries(process.argv.slice(2).filter(arg=>arg.includes('=')).map(arg=>{const [key,...value]=arg.replace(/^--/,'').split('=');return [key,value.join('=')];}));
const directory=path.resolve(flags.dataset??'data/shared'),output=path.resolve(flags.output??'artifacts');
const {readDatasetManifest}=createRequire(import.meta.url)('../dist/collector/export-dataset.cjs');
const manifest=await readDatasetManifest(path.join(directory,'manifest.json')),games=[],snapshots=[];
for(const part of manifest.parts.filter(p=>p.games||p.stats)){
 const bytes=await readFile(path.join(directory,part.sha256+'.json.gz'));
 if(bytes.length!==part.bytes||createHash('sha256').update(bytes).digest('hex')!==part.sha256)throw new Error('Invalid training archive');
 const pack=JSON.parse(gunzipSync(bytes,{maxOutputLength:48*1024*1024}));
 if(pack.games.length!==part.games)throw new Error('Training game count differs from manifest');
 games.push(...pack.games);if(pack.stats.some(s=>s.source==='solo'))snapshots.push({availableAt:pack.createdAt,stats:pack.stats.filter(s=>s.source==='solo')});
}
if(new Set(games.map(game=>game.id)).size!==games.length)throw new Error('Duplicate training games');
for(const history of (flags['history-datasets']??'').split(',').filter(Boolean)){
 const historical=await readDatasetManifest(path.join(history,'manifest.json'));
 for(const part of historical.parts.filter(p=>p.stats&&p.id.startsWith('shared-solo-'))){const bytes=await readFile(path.join(history,part.sha256+'.json.gz'));if(bytes.length!==part.bytes||createHash('sha256').update(bytes).digest('hex')!==part.sha256)throw Error('Invalid historical statistics archive');const pack=JSON.parse(gunzipSync(bytes,{maxOutputLength:48*1024*1024}));snapshots.push({availableAt:pack.createdAt,stats:pack.stats.filter(s=>s.source==='solo')});}
}
try{snapshots.push(...JSON.parse(await readFile(flags['history-snapshots']??path.join(output,'meta-snapshots.json'),'utf8')));}catch(error){if(flags['history-snapshots']||error.code!=='ENOENT')throw error;}
const metaSnapshots=[...new Map(snapshots.map(s=>[createHash('sha256').update(JSON.stringify(s)).digest('hex'),s])).values()];
const knowledge=JSON.parse(await readFile(flags.knowledge??'resources/champion-knowledge.json','utf8'));
const job=new Worker(path.resolve('dist/main/training-worker.cjs'));
let result;
try{result=await new Promise((resolve,reject)=>{job.once('message',r=>r.error?reject(new Error(r.error)):resolve(r.result));job.once('error',reject);job.once('exit',code=>reject(new Error('Training worker exited before result ('+code+')')));job.postMessage({kind:'train',root:'data/local/scraping',champions:manifest.champions,games,scrims:[],trainingOptions:{livePatch:manifest.staticVersion,asOf:flags['as-of']??new Date().toISOString(),...(flags['legacy-recency']?{}:{meta:{snapshots:metaSnapshots,knowledge}})}});});}finally{await job.terminate();}
// A refresh always stages a candidate. Activation keeps its separate validation gate.
const model={...result.model,active:false,datasetRevision:manifest.revision,features:Object.fromEntries(Object.entries(result.model.features).filter(([key])=>!key.startsWith('team:')))};
await mkdir(output,{recursive:true});
await writeFile(path.join(output,'meta-snapshots.json'),JSON.stringify(metaSnapshots)+'\n');
await writeFile(path.join(output,'meta-knowledge.json'),JSON.stringify(knowledge)+'\n');
await writeFile(path.join(output,'initial-model-validation.json'),JSON.stringify({...model,features:undefined},null,2)+'\n');
await writeFile(path.join(output,'shared-model-candidate.json'),JSON.stringify(model,null,2)+'\n');
if(result.predictions)await writeFile(path.join(output,'chronological-predictions.json'),JSON.stringify(result.predictions,null,2)+'\n');
if(process.argv.includes('--publish')){
 const config=await adminConfig(),key=config.SUPABASE_SECRET_KEY;
 if(!key)throw new Error('Missing local publisher key');
 const headers={apikey:key,'Content-Type':'application/json',...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{})};
 async function request(endpoint,body){const response=await fetch(config.SUPABASE_URL+endpoint,{headers:{...headers,...(body?{Prefer:'resolution=merge-duplicates'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('Shared model request failed ('+response.status+')');return response;}
 const [channel]=await (await request('/rest/v1/draft_channels?name=eq.stable&select=revision')).json();
 if(channel?.revision!==model.datasetRevision)throw new Error('Publish the matching dataset before its candidate model');
 await request('/rest/v1/draft_models?on_conflict=kind',{kind:'candidate',model,updated_at:model.trainedAt});
 const [stored]=await (await request('/rest/v1/draft_models?kind=eq.candidate&select=model')).json();
 // JSONB key order differs from the local object; compare every value recursively.
 if(!isDeepStrictEqual(stored?.model,model))throw new Error('Stored candidate differs from validated model');
 console.log('SHARED_MODEL_CANDIDATE_PUBLISHED',model.fingerprint);
}
console.log('INITIAL_MODEL_VALIDATED',JSON.stringify({train:model.train,test:model.test,baseline:model.baseline,eligible:model.eligible,reasons:model.reasons,active:model.active,teamsCoverage:model.teamsCoverage,datesCoverage:model.datesCoverage,learning:model.learning}));
