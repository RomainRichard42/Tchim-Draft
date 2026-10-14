import { describe,it,expect } from 'vitest';
import { Storage } from '../src/main/storage';
import { newDraft } from '../src/shared/draft';
import { supabaseConfigSchema,modelForDataset } from '../src/shared/supabase';
import { trainDraftModel } from '../src/engine/learning';
import { SEED_CHAMPIONS } from '../src/shared/champions';
const state=(userId:string)=>({configured:true,authorized:true,email:userId+'@example.invalid',userId,role:'coach' as const,organizationId:'org',message:'',syncing:false});
describe('cloud account boundaries',()=>{
 it('separates local draft, mastery, rosters and saved sessions by account',()=>{const db=new Storage(':memory:');try{
  db.cloud=state('a');db.account('a',false);db.draft={...newDraft('16.20'),teamNames:{ally:'Private A',enemy:'Other'},history:[{championId:'Ahri'}]};db.settings.pool={Ahri:5};db.saveSession('Private session A');db.persist();const id=db.snapshot().sessions[0].id;
  db.cloud=state('b');db.account('b',false);expect(db.draft.history).toEqual([]);expect(db.settings.pool).toEqual({});expect(db.snapshot().sessions).toEqual([]);expect(()=>db.session(id)).toThrow();db.draft.history=[{championId:'Vi'}];db.persist();
  db.cloud=state('a');db.account('a',false);expect(db.draft.history[0].championId).toBe('Ahri');expect(db.settings.pool.Ahri).toBe(5);expect(db.snapshot().sessions[0].name).toBe('Private session A');
 }finally{db.close();}});
 it('does not expose a private draft or pool through an unauthenticated snapshot',()=>{const db=new Storage(':memory:');try{db.cloud={...state('a'),authorized:false};db.draft.history=[{championId:'Ahri'}];db.settings.pool={Ahri:5};db.teams.ally.players=[{riotId:'Secret#EUW',role:'MID',status:'manual',message:'',pool:[]}];const snap=db.snapshot();expect(snap.draft.history).toEqual([]);expect(snap.settings.pool).toEqual({});expect(snap.teams.ally.players).toEqual([]);expect(snap.sessions).toEqual([]);}finally{db.close();}});
 it('allows the real administrator to adopt legacy data once without losing it',()=>{const db=new Storage(':memory:');try{db.draft.history=[{championId:'Ahri'}];db.saveSession('Legacy');db.persist();db.cloud={...state('admin'),role:'owner'};db.account('admin',true);expect(db.draft.history[0].championId).toBe('Ahri');expect(db.snapshot().sessions[0].name).toBe('Legacy');db.cloud=state('b');db.account('b',false);expect(db.snapshot().sessions).toEqual([]);}finally{db.close();}});
 it('rejects private secret keys in the distributed public configuration',()=>{const config={url:'https://project.supabase.co',bucket:'tchim-datasets'};expect(supabaseConfigSchema.safeParse({...config,publishableKey:'sb_secret_test'}).success).toBe(false);expect(supabaseConfigSchema.safeParse({...config,publishableKey:'sbp_test'}).success).toBe(false);expect(supabaseConfigSchema.safeParse({...config,publishableKey:'sb_publishable_test'}).success).toBe(true);});
 it('can use a validated shared model before historical games are loaded, and respects deactivation',()=>{const model={...trainDraftModel(SEED_CHAMPIONS,[]),active:true,eligible:true,datasetRevision:'revision',patches:['16.18','16.17','16.16']};expect(modelForDataset(model,'revision',['16.16','16.18','16.17']).active).toBe(true);expect(modelForDataset({...model,active:false},'revision',['16.18']).active).toBe(false);});
 it('disables a model after a data revision or pro patch changes, or when validation fails',()=>{const model={...trainDraftModel(SEED_CHAMPIONS,[]),active:true,eligible:true,datasetRevision:'revision',patches:['16.18']};expect(modelForDataset(model,'new-revision',['16.18']).active).toBe(false);expect(modelForDataset(model,'revision',['16.19']).active).toBe(false);expect(modelForDataset({...model,eligible:false},'revision',['16.18']).active).toBe(false);});
});
