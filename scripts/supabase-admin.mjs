import { readFile,writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

export async function adminConfig(){return parseEnv(await readFile('.env.supabase.local','utf8'));}
export async function management(endpoint,body,method=body?'POST':'GET'){
 const env=await adminConfig();if(!env.SUPABASE_ACCESS_TOKEN)throw new Error('Missing local management token');
 const response=await fetch('https://api.supabase.com/v1/'+endpoint,{method,headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(120000)});
 if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error('Supabase management failed ('+response.status+'): '+String(body.message??body.error??'Request rejected').replace(/sb[p_]\S+|eyJ\S+/g,'[redacted]').slice(0,800));}return response.json();
}
export async function sql(query,parameters=[]){const env=await adminConfig(),ref=new URL(env.SUPABASE_URL).hostname.split('.')[0];return management('projects/'+ref+'/database/query',{query,parameters});}
export async function setup(){
 const env=await adminConfig(),ref=new URL(env.SUPABASE_URL).hostname.split('.')[0];
 const keys=await management('projects/'+ref+'/api-keys?reveal=true');
 const publicKey=keys.find(k=>k.type==='publishable')??keys.find(k=>k.name==='anon');
 const secret=keys.find(k=>k.type==='secret')??keys.find(k=>k.name==='service_role');
 if(!publicKey?.api_key||!secret?.api_key)throw new Error('Could not retrieve project keys');
 // Private key remains outside the app bundle and Git. Never print API responses containing keys.
 await writeFile('.env.supabase.local',Object.entries({...env,SUPABASE_SECRET_KEY:secret.api_key}).map(([k,v])=>k+'='+v).join('\n')+'\n');
 await writeFile('resources/supabase-public.json',JSON.stringify({url:env.SUPABASE_URL,publishableKey:publicKey.api_key,bucket:'tchim-datasets'},null,2)+'\n');
 console.log('Project keys configured: public bundle + private local publisher');
}
