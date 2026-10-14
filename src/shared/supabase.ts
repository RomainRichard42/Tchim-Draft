import { z } from 'zod';
import bundled from '../../resources/supabase-public.json';
import { latestPatches } from './patches';
import type { DraftModel } from './types';
export const supabaseConfigSchema=z.object({url:z.string().refine(v=>!v||/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(v)),publishableKey:z.string().max(1000),bucket:z.literal('tchim-datasets')}).strict().refine(c=>{
 if(!c.url)return !c.publishableKey;
 if(c.publishableKey.startsWith('sb_publishable_'))return true;
 try{const payload=JSON.parse(atob(c.publishableKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return payload.role==='anon';}catch{return false;}
},'Only a public publishable/anon key can be bundled');
export type SupabaseConfig=z.infer<typeof supabaseConfigSchema>;
export const SUPABASE=supabaseConfigSchema.parse(bundled);
export function supabaseHeaders(config:SupabaseConfig):Record<string,string>{return {apikey:config.publishableKey,...(config.publishableKey.startsWith('sb_publishable_')?{}:{Authorization:'Bearer '+config.publishableKey})};}
export function modelForDataset(model:DraftModel,revision:string,proPatches:string[]):DraftModel{return {...model,active:model.active&&model.eligible&&model.datasetRevision===revision&&model.patches[0]===latestPatches(proPatches)[0]};}
