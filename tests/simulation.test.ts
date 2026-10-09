import { describe, expect, it } from 'vitest';
import { simulateDrafts, simulationOptions } from '../src/engine/simulation';
import { SEED_CHAMPIONS, DEFAULT_SETTINGS } from '../src/shared/champions';
import { newDraft, picks, order } from '../src/shared/draft';
import { validateDraft } from '../src/shared/series';
import { validateSimulation } from '../src/shared/simulation';
import { simulationDocumentSchema, simulationRequestSchema } from '../src/shared/validation';
import type { EngineInput, SimulationPin, SimulationRequest } from '../src/shared/types';
const known=new Set(SEED_CHAMPIONS.map(c=>c.id));
const input=():EngineInput=>({draft:{...newDraft('16.20'),history:Array.from({length:6},()=>({championId:null}))},settings:structuredClone(DEFAULT_SETTINGS),champions:SEED_CHAMPIONS,stats:[],pairs:[],demo:false});
const request=(base:EngineInput,pins:SimulationPin[]=[],count=12):SimulationRequest=>({id:'unit-test',draft:base.draft,pins,count,seed:42});
describe('interactive draft exploration',()=>{
  it('generates 24 distinct legal complete branches and preserves the starting draft',()=>{
    const base=input(),saved=structuredClone(base),progress:number[]=[];
    const result=simulateDrafts(base,request(base,[],24),n=>progress.push(n));
    expect(result.branches).toHaveLength(24);expect(new Set(result.branches.map(b=>JSON.stringify(b.history))).size).toBe(24);
    expect(progress).toEqual(Array.from({length:24},(_,i)=>i+1));expect(base).toEqual(saved);
    for(const b of result.branches){
      expect(b.status).toBe('complete');expect(b.history.slice(0,6)).toEqual(saved.draft.history);
      const draft={...base.draft,history:b.history};expect(()=>validateDraft(draft,known)).not.toThrow();
      expect(b.history).toHaveLength(20);expect(picks(draft,'blue')).toHaveLength(5);expect(picks(draft,'red')).toHaveLength(5);
      expect(b.balance.complete).toBe(true);expect(b.plans.ally.partial).toBe(false);
    }
    expect(result.branches.some(b=>b.history[7].championId!==result.branches[0].history[7].championId)).toBe(true);
  },30000);
  it('reserves a future counter pick, its role and a future ban before generating',()=>{
    const base=input(),pins:SimulationPin[]=[{index:19,selection:{championId:'Ahri',role:'MID'}},{index:15,selection:{championId:'Malphite'}}];
    const result=simulateDrafts(base,request(base,pins,12));
    for(const branch of result.branches){
      expect(branch.status).toBe('complete');expect(branch.history[19]).toEqual(pins[0].selection);expect(branch.history[15]).toEqual(pins[1].selection);
      expect(branch.history.slice(0,19).some(s=>s.championId==='Ahri')).toBe(false);
      expect(picks({...base.draft,history:branch.history.slice(0,19)},'red').some(s=>s.role==='MID')).toBe(false);
      expect(branch.steps.find(s=>s.index===19)?.automatic).toBe(false);
    }
  },30000);
  it('rejects conflicting locks, live edits, Fearless champions and malformed IPC requests',()=>{
    const base=input();
    for(const pins of [
      [{index:0,selection:{championId:'Ahri'}}],
      [{index:6,selection:{championId:'Ahri',role:'MID' as const}},{index:9,selection:{championId:'Orianna',role:'MID' as const}}],
      [{index:6,selection:{championId:'Ahri',role:'MID' as const}},{index:8,selection:{championId:'Ahri',role:'MID' as const}}],
      [{index:6,selection:{championId:null}}],
      [{index:20,selection:{championId:'Ahri'}}],
    ])expect(()=>validateSimulation(base.draft,pins,known)).toThrow();
    base.draft.series={format:'bo3',games:[{picks:SEED_CHAMPIONS.slice(0,10).map(c=>c.id)}]};
    expect(()=>validateSimulation(base.draft,[{index:6,selection:{championId:SEED_CHAMPIONS[0].id,role:'MID'}}],known)).toThrow(/Fearless/);
    expect(simulationRequestSchema.safeParse({...request(base),count:10000}).success).toBe(false);
    expect(simulationRequestSchema.safeParse({...request(base),seed:NaN}).success).toBe(false);
    expect(simulationDocumentSchema.safeParse({name:'x',draft:base.draft,pins:[],history:[],extra:'x'}).success).toBe(false);
  });
  it('enforces both teams restricted pools and reports blocked branches rather than fake success',()=>{
    const base=input(),team={url:'',region:'euw',message:'',poolOnly:true,players:[{riotId:'Coach#EUW',role:'MID' as const,status:'manual' as const,message:'',pool:[{championId:'Ahri',games:0,wins:0,role:'MID' as const}]}]};
    // One available champion shared by both restricted mid pools makes ten picks impossible.
    base.teams={ally:structuredClone(team),enemy:structuredClone(team)};
    const result=simulateDrafts(base,request(base,[],1));
    expect(result.branches[0].status).toBe('blocked');expect(result.branches[0].history.length).toBeLessThan(20);
    expect(result.branches[0].warnings.join()).toMatch(/pool/);expect(result.branches[0].balance.complete).toBe(false);
    expect(()=>validateDraft({...base.draft,history:result.branches[0].history},known)).not.toThrow();
  });
  it('handles completed drafts, completed series and fully forced continuations without duplicates',()=>{
    const base=input(),first=simulateDrafts(base,request(base,[],1)).branches[0];
    const pins=first.history.flatMap((selection,index)=>index>=6?[{index,selection}]:[]);
    expect(simulateDrafts(base,request(base,pins,48)).branches).toHaveLength(1);
    base.draft.history=first.history;expect(simulateDrafts(base,request(base)).branches).toHaveLength(1);
    base.draft.history=[];base.draft.series={format:'bo3',games:[{picks:SEED_CHAMPIONS.slice(0,10).map(c=>c.id),winner:'ally'},{picks:SEED_CHAMPIONS.slice(10,20).map(c=>c.id),winner:'ally'}]};
    expect(order(base.draft)).toHaveLength(0);expect(simulateDrafts(base,request(base)).branches).toHaveLength(0);
  },30000);
  it('is reproducible and adapts recommendations to changed picks and reservations',()=>{
    const base=input(),req=request(base,[],2);
    expect(simulateDrafts(base,req).branches).toEqual(simulateDrafts(base,req).branches);
    const before=simulationOptions(base,[]);base.draft.history.push({championId:'Ahri',role:'MID'});
    const after=simulationOptions(base,[{index:19,selection:{championId:'Orianna',role:'MID'}}]);
    expect(after.some(r=>r.championId==='Ahri'||r.championId==='Orianna'||r.role==='MID')).toBe(false);
    expect(after).not.toEqual(before);
  },30000);
  it('supports Solo bans on both teams, but never a second ban of the same champion on one team',()=>{
    const base=input();base.draft.mode='solo';base.draft.history=[];
    const pins:SimulationPin[]=[{index:0,selection:{championId:'Ahri'}},{index:5,selection:{championId:'Ahri'}}];
    expect(()=>validateSimulation(base.draft,pins,known)).not.toThrow();
    expect(()=>validateSimulation(base.draft,[...pins,{index:1,selection:{championId:'Ahri'}}],known)).toThrow();
    const result=simulateDrafts(base,request(base,pins,1));
    expect(result.branches[0].history[0].championId).toBe('Ahri');expect(result.branches[0].history[5].championId).toBe('Ahri');
    expect(()=>validateDraft({...base.draft,history:result.branches[0].history},known)).not.toThrow();
  });
});
