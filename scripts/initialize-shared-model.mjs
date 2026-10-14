import { Worker } from 'node:worker_threads';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { adminConfig } from './supabase-admin.mjs';
const manifest=JSON.parse(await readFile('data/shared/manifest.json','utf8')),games=[];
for(const part of manifest.parts.filter(p=>p.games)){const pack=JSON.parse(gunzipSync(await readFile('data/shared/'+part.sha256+'.json.gz')));games.push(...pack.games);}
const job=new Worker(path.resolve('dist/main/training-worker.cjs'));
const result=await new Promise((resolve,reject)=>{job.once('message',r=>r.error?reject(new Error(r.error)):resolve(r.result));job.once('error',reject);job.postMessage({kind:'train',root:'data/local/scraping',champions:manifest.champions,games,scrims:[]});});await job.terminate();
const model={...result.model,datasetRevision:manifest.revision,features:Object.fromEntries(Object.entries(result.model.features).filter(([key])=>!key.startsWith('team:')))};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/initial-model-validation.json',JSON.stringify({...model,features:undefined},null,2));
if(process.argv.includes('--publish')){
 const config=await adminConfig(),key=config.SUPABASE_SECRET_KEY;
 const response=await fetch(config.SUPABASE_URL+'/rest/v1/draft_models?on_conflict=kind',{method:'POST',headers:{apikey:key,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates',...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{})},body:JSON.stringify({kind:'candidate',model}),redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error('Shared model candidate upload failed ('+response.status+')');
}
console.log('INITIAL_MODEL_VALIDATED',JSON.stringify({train:model.train,test:model.test,baseline:model.baseline,eligible:model.eligible,reasons:model.reasons,active:model.active,teamsCoverage:model.teamsCoverage,datesCoverage:model.datesCoverage}));
