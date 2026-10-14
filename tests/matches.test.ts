import { describe, it, expect, vi } from 'vitest';
import { Storage } from '../src/main/storage';
import { MatchService } from '../src/main/matches';
import type { CloudService } from '../src/main/cloud';
import type { Draft, MatchSetup } from '../src/shared/types';
import { order, fearlessUsed } from '../src/shared/draft';
import { changeSeries, validateDraft } from '../src/shared/series';
import { draftSchema } from '../src/shared/validation';

const setup=(name='Atlas vs Nova',fearless=true):MatchSetup=>({name,kind:'scrim',ally:'Atlas',enemy:'Nova',format:'bo3',fearless,side:'blue',patch:'16.20',urls:{ally:'https://op.gg/lol/multisearch/euw?summoners=A%23EUW',enemy:''}});
function complete(draft:Draft):Draft{
 const roles=['TOP','JUNGLE','MID','ADC','SUPPORT'] as const,blue=['Aatrox','Vi','Ahri','Jinx','Leona'],red=['Camille','LeeSin','Orianna','Ezreal','Nautilus'],at={blue:0,red:0};
 return {...draft,history:order(draft).map(action=>{if(action.kind==='ban')return {championId:null};const index=at[action.side]++;return {championId:(action.side==='blue'?blue:red)[index],role:roles[index]};})};
}
function offline(){const storage=new Storage(':memory:'),cloud={state:{configured:false,authorized:false},requireAccess(){}} as CloudService,service=new MatchService(storage,cloud,()=>{});return {storage,service,close(){service.stop();storage.close();}};}
describe('per-match preparations',()=>{
 it('retains each partial draft and both rosters when switching matches, without copying pools to a new match',async()=>{const f=offline();try{
  await f.service.create(setup());const id=(await f.service.list()).activeId!;
  f.storage.teams.ally.players=[{riotId:'Player#EUW',role:'MID',status:'manual',message:'',pool:[{championId:'Ahri',comfort:5,games:0,wins:0}]}];f.storage.draft.history=[{championId:'Zed'}];f.service.capture();
  await f.service.create(setup('Second match'));expect(f.storage.teams.ally.players).toEqual([]);expect(f.storage.draft.history).toEqual([]);
  await f.service.open(id);expect(f.storage.draft.history).toEqual([{championId:'Zed'}]);expect(f.storage.teams.ally.players[0].pool[0].comfort).toBe(5);expect((await f.service.list()).matches).toHaveLength(2);
  await f.service.archive(id,true);expect(f.storage.match?.archived).toBe(true);
 }finally{f.close();}});
 it('records a result only after a complete draft, edits it without duplicates and preserves its date',async()=>{const f=offline();try{
  await f.service.create(setup());const result={winner:'blue' as const,kills:{blue:20,red:11},coachRating:4,notes:'Good engage'};
  await expect(f.service.result(result)).rejects.toThrow('Finish the draft');expect(f.storage.scrims()).toHaveLength(0);await expect(f.service.completedWinner()).rejects.toThrow('Record the result');
  f.storage.draft=complete(f.storage.draft);f.service.capture();await f.service.result(result);const first=f.storage.scrims()[0];
  await f.service.result({...result,coachRating:3});expect(f.storage.scrims()).toHaveLength(1);expect(f.storage.scrims()[0].playedAt).toBe(first.playedAt);expect(f.storage.scrims()[0].coachRating).toBe(3);expect(f.storage.match?.results).toEqual([{game:0,id:first.id}]);
  await expect(f.service.completedWinner()).resolves.toBe('blue');f.storage.draft.history[0]={championId:'Zed'};await expect(f.service.completedWinner()).rejects.toThrow('record the result again');
  const library=await f.service.list();expect(library.matches[0].document.teams).toEqual(first.teams);
 }finally{f.close();}});
 it('supports a normal best-of series with repeated champions and still enforces Fearless',async()=>{const f=offline();try{
  const known=new Set(f.storage.champions().map(c=>c.id));await f.service.create(setup('Normal',false));
  const next=changeSeries(complete(f.storage.draft),'next','blue'),repeated=complete(next);
  expect(fearlessUsed(next).size).toBe(0);expect(()=>validateDraft(draftSchema.parse(repeated),known)).not.toThrow();
  const fearless={...repeated,series:{...repeated.series!,fearless:true}};expect(()=>validateDraft(fearless,known)).toThrow('unavailable');
 }finally{f.close();}});
 it('preserves the two rosters in new backups and still reads legacy draft-only backups',()=>{const f=offline();try{
  f.storage.teams.enemy.players=[{riotId:'Rival#EUW',role:'TOP',status:'manual',message:'',pool:[]}];f.storage.saveSession('With teams');const id=f.storage.snapshot().sessions[0].id;expect(f.storage.sessionContext(id).teams?.enemy.players[0].riotId).toBe('Rival#EUW');
  const legacy=Number(f.storage.db.prepare('INSERT INTO sessions(name,saved_at,json,owner) VALUES(?,?,?,?)').run('Old','2026-01-01',JSON.stringify(f.storage.draft),'').lastInsertRowid);expect(f.storage.sessionContext(legacy).teams).toBeUndefined();
 }finally{f.close();}});
 it('keeps a private local copy when cloud writing fails, then sends it with the original account guard',async()=>{const storage=new Storage(':memory:'),owner='11111111-1111-4111-8111-111111111111';
  const request=vi.fn().mockRejectedValueOnce(new Error('Offline')).mockImplementation(async (_endpoint:string,body:{id:string;document:unknown})=>[{id:body.id,author:owner,document:body.document,revision:1,updated_at:new Date().toISOString()}]);
  const cloud={state:{configured:true,authorized:true,userId:owner},requireAccess(){},request} as unknown as CloudService;storage.cloud=cloud.state;const service=new MatchService(storage,cloud,()=>{});
  try{await service.create(setup());await expect(service.flush()).rejects.toThrow();expect(storage.get<{pending:boolean}[]>('matches:'+owner)?.[0].pending).toBe(true);await service.flush();expect(request.mock.calls[1][4]).toBe(owner);expect(storage.get<{pending:boolean}[]>('matches:'+owner)?.[0].pending).toBe(false);storage.cloud.authorized=false;expect(storage.snapshot().match).toBeUndefined();}finally{service.stop();storage.close();}
 });
 it('never overwrites a newer remote draft and opens the conflicting local version as a separate copy',async()=>{
  const storage=new Storage(':memory:'),owner='11111111-1111-4111-8111-111111111111',remote=new Map<string,{id:string;author:string;document:unknown;revision:number;updated_at:string}>();
  const request=vi.fn(async(endpoint:string,body?:{id?:string;document:unknown},method?:string)=>{
   if(method==='POST'){const row={id:body!.id!,author:owner,document:structuredClone(body!.document),revision:1,updated_at:new Date().toISOString()};remote.set(row.id,row);return [row];}
   const id=/id=eq\.([a-f0-9-]+)/.exec(endpoint)?.[1];
   if(method==='PATCH')return [];
   return id?[remote.get(id)!]:[...remote.values()];
  });
  const cloud={state:{configured:true,authorized:true,userId:owner},requireAccess(){},request} as unknown as CloudService;storage.cloud=cloud.state;const service=new MatchService(storage,cloud,()=>{});
  try{await service.create(setup());await service.flush();const original=storage.match!.id,server=remote.get(original)!;server.revision=2;(server.document as {name:string}).name='Edited elsewhere';storage.draft.history=[{championId:'Zed'}];service.capture();await expect(service.flush()).rejects.toThrow('copy');expect(storage.get<{conflict:boolean}[]>('matches:'+owner)?.[0].conflict).toBe(true);
   await service.open(original);expect(storage.match!.id).not.toBe(original);expect(storage.match!.name).toContain('copie');expect(storage.draft.history).toEqual([{championId:'Zed'}]);await service.flush();expect((remote.get(original)!.document as {name:string}).name).toBe('Edited elsewhere');expect(remote.size).toBe(2);
  }finally{service.stop();storage.close();}
 });
 it('reconciles an already committed creation after a lost network response without duplicating it',async()=>{
  const storage=new Storage(':memory:'),owner='11111111-1111-4111-8111-111111111111';let saved:unknown;
  const request=vi.fn(async(_endpoint:string,body?:{id:string;document:unknown},method?:string)=>{
   if(method==='POST'){if(saved)throw new Error('Supabase 409');saved=[{id:body!.id,author:owner,document:structuredClone(body!.document),revision:1,updated_at:new Date().toISOString()}];throw new Error('Connection lost after commit');}return saved;
  });
  const cloud={state:{configured:true,authorized:true,userId:owner},requireAccess(){},request} as unknown as CloudService;storage.cloud=cloud.state;const service=new MatchService(storage,cloud,()=>{});
  try{await service.create(setup());await expect(service.flush()).rejects.toThrow('Connection lost');await service.flush();const rows=storage.get<{pending:boolean;conflict?:boolean}[]>('matches:'+owner)!;expect(rows).toHaveLength(1);expect(rows[0].pending).toBe(false);expect(rows[0].conflict).not.toBe(true);}finally{service.stop();storage.close();}
 });
});
