import { afterEach,describe,it,expect,vi } from 'vitest';
vi.mock('electron',()=>({safeStorage:{isEncryptionAvailable:()=>true,encryptString:(value:string)=>Buffer.from(value),decryptString:(value:Buffer)=>value.toString()}}));
import { CloudService } from '../src/main/cloud';
import { Storage } from '../src/main/storage';
import { newDraft,PRO_ORDER } from '../src/shared/draft';
import type { Role,ScrimDocument } from '../src/shared/types';
afterEach(()=>vi.unstubAllGlobals());
describe('Supabase response handling',()=>{
 it('handles empty successful writes and logout without leaking tokens to the renderer',async()=>{
  const database=new Storage(':memory:');
  const empty={url:'',region:'euw',players:[],poolOnly:false,message:''};
  const roster={blue:[['Ornn','TOP'],['Vi','JUNGLE'],['Orianna','MID'],['Jinx','ADC'],['Lulu','SUPPORT']],red:[['Renekton','TOP'],['LeeSin','JUNGLE'],['Ahri','MID'],['Varus','ADC'],['Nautilus','SUPPORT']]};
  const document:ScrimDocument={name:'Result',playedAt:'2026-10-14T00:00:00.000Z',draft:{...newDraft('16.20'),history:PRO_ORDER.map(a=>{if(a.kind==='ban')return {championId:null};const [championId,role]=roster[a.side].shift()!;return {championId,role:role as Role};})},teams:{ally:empty,enemy:empty},winner:'blue',coachRating:4,notes:'',rival:'Nova'};
  vi.stubGlobal('fetch',vi.fn(async(url:string,options?:RequestInit)=>{
   if(url.includes('/auth/v1/token'))return new Response(JSON.stringify({access_token:'private-test-access',refresh_token:'private-test-refresh',expires_in:3600,user:{id:'e7445d5e-829f-4ed3-9531-ab83d468b577',email:'coach@example.invalid'}}));
   if(url.includes('/draft_members'))return new Response(JSON.stringify([{organization_id:'d308eaf0-51fa-4bda-9728-cf6a3fbac947',role:'coach'}]));
   if(url.includes('/draft_workspaces')&&options?.method==='GET')return new Response('[]');
   if(url.includes('/auth/v1/logout'))return new Response(null,{status:204});
   return new Response('',{status:201});
  }));
  try{const cloud=new CloudService(database,()=>{});await cloud.login('coach@example.invalid','ValidPassword123');expect(cloud.state.authorized).toBe(true);await expect(cloud.save(document)).resolves.toBeUndefined();expect(JSON.stringify(database.snapshot())).not.toContain('private-test-access');expect(JSON.stringify(database.snapshot())).not.toContain('private-test-refresh');await cloud.logout();expect(cloud.state.authorized).toBe(false);expect(database.snapshot().teams.ally.players).toEqual([]);}finally{database.close();}
 });
});
