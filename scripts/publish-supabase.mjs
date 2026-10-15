import Database from 'better-sqlite3';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { adminConfig } from './supabase-admin.mjs';
if(!process.argv.includes('--publish'))throw new Error('Explicit --publish required; no automatic publication');
const require=createRequire(import.meta.url),{exportDataset,readDatasetManifest,proContextSchema}=require('../dist/collector/export-dataset.cjs');
const env=await adminConfig();if(!env.SUPABASE_SECRET_KEY)throw new Error('Run setup-supabase first');
const flags=Object.fromEntries(process.argv.slice(2).filter(arg=>arg.includes('=')).map(arg=>{const [key,...value]=arg.replace(/^--/,'').split('=');return [key,value.join('=')];}));
const database=path.resolve(flags.database??'data/local/tchim.sqlite'),output=path.resolve(flags.output??'data/shared'),cache=path.resolve(flags.cache??path.join(path.dirname(database),'scraping'));
let manifest;if(process.argv.includes('--prepared'))manifest=await readDatasetManifest(path.join(output,'manifest.json'));
else{const db=new Database(database,{readonly:true,fileMustExist:true});try{manifest=await exportDataset(db,output,process.argv.includes('--enrich')?cache:undefined);}finally{db.close();}}
const context=flags.context?proContextSchema.parse(JSON.parse(await readFile(path.resolve(flags.context),'utf8'))):undefined;
if(context&&context.datasetRevision!==manifest.revision)throw new Error('Pro context and dataset revisions differ');
const headers={apikey:env.SUPABASE_SECRET_KEY,'Content-Type':'application/json',...(env.SUPABASE_SECRET_KEY.startsWith('eyJ')?{Authorization:'Bearer '+env.SUPABASE_SECRET_KEY}:{})};
async function request(path,body,extra={},attempt=0){const r=await fetch(env.SUPABASE_URL+path,{headers:{...headers,...extra},...(body!==undefined?{method:'POST',body:Buffer.isBuffer(body)?body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(120000)});if(!r.ok){if([429,500,502,503,504].includes(r.status)&&attempt<3){await r.body?.cancel();await new Promise(resolve=>setTimeout(resolve,1000*2**attempt));return request(path,body,extra,attempt+1);}const error=await r.json().catch(()=>({}));throw new Error('Supabase publication failed ('+r.status+'): '+String(error.message??error.error??'request rejected').slice(0,500));}return r;}
const current=await (await request('/rest/v1/draft_channels?name=eq.stable&select=revision')).json(),expected=current[0]?.revision??null;
const stored=await (await request('/rest/v1/draft_packs?select=sha256&limit=1000')).json(),present=new Set(stored.map(p=>p.sha256));
for(const [i,part] of manifest.parts.entries()){
 if(present.has(part.sha256)){console.log('Already stored',i+1,manifest.parts.length,part.id);continue;}
 const body=await readFile(path.join(output,part.sha256+'.json.gz'));
 if(body.length!==part.bytes||createHash('sha256').update(body).digest('hex')!==part.sha256)throw new Error('Invalid local dataset block');
 const pack=JSON.parse(gunzipSync(body,{maxOutputLength:48*1024*1024}).toString('utf8'));
 await request('/rest/v1/rpc/draft_ingest',{new_hash:part.sha256,new_pack:pack,new_bytes:part.bytes});
 await request('/storage/v1/object/tchim-datasets/'+part.sha256+'.json.gz',body,{'Content-Type':'application/gzip','x-upsert':'true'});
 const verified=await (await request('/rest/v1/draft_packs?sha256=eq.'+part.sha256+'&select=sha256,stats_count,pairs_count,games_count,bytes')).json();
 if(verified.length!==1||verified[0].bytes!==part.bytes||verified[0].pairs_count!==part.pairs)throw new Error('Stored part mismatch');
 console.log('Stored + verified',i+1,manifest.parts.length,part.id);
}
await request(context?'/rest/v1/rpc/draft_publish_with_context':'/rest/v1/rpc/draft_publish',{new_manifest:manifest,expected_revision:expected,...(context?{new_context:context}:{})});
const stable=await (await request('/rest/v1/draft_channels?name=eq.stable&select=revision')).json();if(stable[0]?.revision!==manifest.revision)throw new Error('Published pointer mismatch');
console.log('SUPABASE_PUBLISHED',JSON.stringify({revision:manifest.revision,coverage:manifest.coverage,bytes:manifest.parts.reduce((n,p)=>n+p.bytes,0)}));
