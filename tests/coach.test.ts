import { describe, expect, it } from 'vitest';
import { analyze } from '../src/engine';
import { gamePlan } from '../src/engine/gameplan';
import { banConsequences } from '../src/engine/ban-impact';
import { DEFAULT_SETTINGS, SEED_CHAMPIONS } from '../src/shared/champions';
import { fearlessUsed, newDraft, PRO_ORDER, seriesFinished } from '../src/shared/draft';
import { changeSeries, validateDraft } from '../src/shared/series';
import { draftSchema, seriesSchema } from '../src/shared/validation';
import type { Draft, EngineInput, PairStat, Recommendation, Role, Side, Stat } from '../src/shared/types';

const champion=(id:string)=>SEED_CHAMPIONS.find(c=>c.id===id)!;
const state=():EngineInput=>({draft:newDraft('16.20'),settings:structuredClone(DEFAULT_SETTINGS),champions:SEED_CHAMPIONS,stats:[],pairs:[],demo:false});
const stat=(id='Ahri',values:Partial<Stat>={}):Stat=>({championId:id,role:'MID',patch:'16.20',source:'solo',rank:'MASTER_PLUS',league:'all',side:'all',games:1000,wins:500,baseline:.5,pickRate:.1,banRate:.01,...values});
const known=new Set(SEED_CHAMPIONS.map(c=>c.id));
const blue:[string,Role][]=[['Jinx','ADC'],['Lulu','SUPPORT'],['Orianna','MID'],['Ornn','TOP'],['Sejuani','JUNGLE']];
const red:[string,Role][]=[['Vi','JUNGLE'],['Akali','MID'],['Ashe','ADC'],['Nautilus','SUPPORT'],['Gwen','TOP']];
function completed():Draft {
  const roster:Record<Side,[string,Role][]>=structuredClone({blue,red});
  return {...newDraft('16.20'),series:{format:'bo5',games:[]},history:PRO_ORDER.map((action,i)=>action.kind==='ban'?{championId:i===0?'Zed':null}:(()=>{const [championId,role]=roster[action.side].shift()!;return {championId,role};})())};
}
function rec(championId:string,score:number):Recommendation {return {championId,role:'MID',score,confidence:50,games:1000,winrate:.5,interval:[.47,.53],factors:{winrate:50,matchup:50,synergy:50,meta:50,flex:50,order:50,composition:50,mastery:50},reasons:[],responseRisk:50,source:'fixture'};}

describe('Fearless series lifecycle and untrusted imports',()=>{
  it('archives ten picks from both sides, retains ordinary bans for the next game and preserves filters',()=>{
    const draft=completed(),next=changeSeries(validateDraft(draft,known),'next','blue');
    expect(next.history).toEqual([]);expect(next.patch).toBe('16.20');expect(next.series!.games[0].winner).toBe('ally');
    expect(fearlessUsed(next)).toEqual(new Set([...blue,...red].map(p=>p[0])));expect(fearlessUsed(next).has('Zed')).toBe(false);
    expect(()=>validateDraft({...next,history:[{championId:'Zed'}]},known)).not.toThrow();
    expect(()=>validateDraft({...next,history:[{championId:'Jinx'}]},known)).toThrow(/Fearless/);
  });
  it('excludes prior-game picks from all recommendations, predictions, duos and simulated continuations',()=>{
    const input=state();input.draft=changeSeries(completed(),'next');
    const blocked=fearlessUsed(input.draft),analysis=analyze(input);
    expect(analysis.bans.length).toBeGreaterThan(0);
    for(const id of [...analysis.picks,...analysis.bans,...analysis.enemies].map(r=>r.championId))expect(blocked.has(id)).toBe(false);
    for(const scenario of analysis.scenarios)for(const pick of scenario.history)if(pick.championId)expect(blocked.has(pick.championId)).toBe(false);
    input.draft.history=Array.from({length:6},()=>({championId:null}));
    const first=analyze(input).picks[0];input.draft.history.push({championId:first.championId,role:first.role});input.draft.side='red';
    for(const duo of analyze(input).duos){expect(blocked.has(duo.first.championId)).toBe(false);expect(blocked.has(duo.second.championId)).toBe(false);}
  });
  it('restores the exact previous draft when reopening and keeps legacy sessions loadable',()=>{
    const original=completed(),next=changeSeries(original,'next'),reopened=changeSeries(next,'previous');
    expect(reopened.history).toEqual(original.history);expect(fearlessUsed(reopened).size).toBe(0);
    expect(changeSeries({...next,side:'red'},'previous').side).toBe('blue');
    const {series,...legacy}=newDraft();expect(draftSchema.parse(legacy).series?.format).toBe('single');
    expect(draftSchema.parse(JSON.parse(JSON.stringify(next)))).toEqual(next);
    expect(()=>changeSeries({...original,history:original.history.slice(0,19)},'next')).toThrow(/Finish/);
  });
  it('counts wins by team even if the team changes side between games',()=>{
    const next=changeSeries({...completed(),series:{format:'bo3',games:[]}},'next','blue');
    const ids=SEED_CHAMPIONS.filter(c=>!fearlessUsed(next).has(c.id)).slice(0,10).map(c=>c.id);
    const finished={...next,side:'red' as const,series:{...next.series!,games:[...next.series!.games,{picks:ids,winner:'ally' as const}]}};
    expect(seriesFinished(finished)).toBe(true);expect(analyze({...state(),draft:finished}).next).toBeNull();
    expect(analyze({...state(),draft:finished}).picks).toEqual([]);
    const third=SEED_CHAMPIONS.filter(c=>!fearlessUsed(finished).has(c.id)).slice(0,10).map(c=>c.id);
    expect(()=>validateDraft({...finished,series:{...finished.series,games:[...finished.series.games,{picks:third}]}},known)).toThrow(/already won/);
  });
  it('rejects repeated, unknown, forged and incompatible series histories',()=>{
    const next=changeSeries(completed(),'next'),game=next.series!.games[0];
    expect(seriesSchema.safeParse({format:'bo3',games:[game,game]}).success).toBe(false);
    expect(seriesSchema.safeParse({format:'single',games:[game]}).success).toBe(false);
    expect(()=>validateDraft({...next,mode:'solo'},known)).toThrow(/competitive/);
    expect(()=>validateDraft({...next,series:{...next.series!,games:[{picks:game.picks.map((p,i)=>i===0?'Unknown':p)}]}},known)).toThrow(/Unknown/);
    expect(()=>validateDraft({...next,series:{...next.series!,games:[{...game,picks:game.picks.map((p,i)=>i===0?'Ahri':p)}]}},known)).toThrow(/match/);
  });
});

describe('small-sample scores and presence',()=>{
  it('does not recommend an unscouted role supported only by a handful of pro games',()=>{
    for(const games of [1,2,5,9]){const input=state();input.stats=[stat('Ahri',{source:'pro',games,wins:games,pickRate:1,banRate:1})];
      input.draft.history=Array.from({length:6},()=>({championId:null}));input.draft.targetRole='MID';expect(analyze(input).picks).toEqual([]);}
  });
  it('neutralizes perfect one- and two-game pro win rates and meta presence, even with a declared pool',()=>{
    for(const games of [1,2]){
      const input=state();input.draft.history=Array.from({length:6},()=>({championId:null}));input.draft.targetRole='MID';
      input.stats=[stat('Ahri',{source:'pro',games,wins:games,pickRate:1,banRate:1})];
      const empty={url:'',region:'euw',poolOnly:false,message:'',players:[]};
      input.teams={ally:{...empty,players:[{riotId:'Coach#EUW',role:'MID',pool:[{championId:'Ahri',role:'MID',games:0,wins:0}],status:'manual',message:''}]},enemy:empty};
      const choice=analyze(input).picks[0];expect(choice.championId).toBe('Ahri');expect(choice.factors.winrate).toBe(50);expect(choice.factors.meta).toBe(35);
      expect(choice.winrate).toBeNull();expect(choice.interval).toBeNull();expect(choice.confidence).toBe(0);expect(choice.lowSample).toBe(true);
      expect(choice.reasons.some(r=>r.includes('échantillon insuffisant'))).toBe(true);
    }
  });
  it('does not replace a large Master+ meta estimate with a one-game pro outlier',()=>{
    const input=state();input.draft.history=Array.from({length:6},()=>({championId:null}));input.draft.targetRole='MID';input.stats=[stat('Ahri',{games:50000,wins:25000})];
    const before=analyze(input).picks[0];input.stats=[...input.stats,stat('Ahri',{source:'pro',games:1,wins:1,pickRate:1,banRate:1})];
    const after=analyze(input).picks[0];expect(Math.abs(after.factors.meta-before.factors.meta)).toBeLessThan(1);expect(after.factors.winrate).toBe(50);
  });
  it('gives no counter or synergy bonus to perfect one- and two-game pairs',()=>{
    const input=state();input.draft.history=[...Array.from({length:6},()=>({championId:null})),{championId:'Jinx',role:'ADC'},{championId:'Vi',role:'JUNGLE'},{championId:'Akali',role:'MID'}];input.draft.targetRole='MID';input.stats=[stat('Ahri')];
    const before=analyze(input).picks[0];
    const pair=(kind:PairStat['kind'],otherId:string,otherRole:Role,games:number):PairStat=>({championId:'Ahri',role:'MID',otherId,otherRole,kind,patch:'16.20',source:'pro',rank:'all',league:'all',side:'all',games,wins:games,baseline:.5});
    input.pairs=[pair('matchup','Akali','MID',1),pair('synergy','Jinx','ADC',2)];
    const after=analyze(input).picks[0];expect(after.factors.matchup).toBe(before.factors.matchup);expect(after.factors.synergy).toBe(before.factors.synergy);
  });
});

describe('actionable composition plans',()=>{
  it('identifies poke preparation and its exposure to several dive threats',()=>{
    const plan=gamePlan(['Jayce','Varus','Ziggs'].map(champion),['TOP','ADC','MID'],['Vi','Akali','Camille'].map(champion),['JUNGLE','MID','TOP']);
    expect(plan.kind).toBe('poke');expect(plan.partial).toBe(true);expect(plan.conditions.some(c=>c.includes('vision'))).toBe(true);
    expect(plan.risks.length).toBeGreaterThan(0);expect(plan.needs.some(n=>n.includes('protection'))).toBe(true);
  });
  it('values carry protection against dive and explains the sustained-fight win condition',()=>{
    const enemy=['Vi','Akali','Camille'].map(champion),roles:Role[]=['ADC','SUPPORT','JUNGLE','MID','TOP'];
    const protectedPlan=gamePlan(['Jinx','Braum','Sejuani','Orianna','Ornn'].map(champion),roles,enemy);
    const exposedPlan=gamePlan(['Jinx','Nautilus','Lillia','Akali','Gwen'].map(champion),roles,enemy);
    expect(protectedPlan.kind).toBe('front-to-back');expect(protectedPlan.axes.teamfight).toBeGreaterThan(exposedPlan.axes.teamfight);
    expect(protectedPlan.conditions[0]).toContain('protection');expect(protectedPlan.partial).toBe(false);
  });
  it('describes how the group must hold waves for a side-lane plan and supports English',()=>{
    const plan=gamePlan(['Fiora','Ryze','Ashe','Braum','Sejuani'].map(champion),['TOP','MID','ADC','SUPPORT','JUNGLE'],[],[],'en');
    expect(plan.kind).toBe('side');expect(plan.conditions[0]).toContain('holds waves');expect(plan.profiled).toBe(5);
  });
});

describe('ban counterfactuals',()=>{
  it('measures a role replacement, available options and our opportunity cost',()=>{
    const impacts=banConsequences(state(),'blue',[rec('Ahri',80),rec('Orianna',65),rec('Zed',60)],[rec('Ahri',75),rec('Orianna',72)]);
    const ban=impacts.get('Ahri:MID')!;expect(ban.replacement?.championId).toBe('Orianna');expect(ban.alternatives).toBe(2);
    expect(ban.enemyLoss).toBe(15);expect(ban.ownLoss).toBe(3);expect(ban.net).toBe(12);
  });
  it('penalizes removing our unique strong option and handles unknown replacement coverage conservatively',()=>{
    const ban=banConsequences(state(),'blue',[rec('Ahri',80),rec('Orianna',79)],[rec('Ahri',90),rec('Orianna',60)]).get('Ahri:MID')!;
    expect(ban.net).toBeLessThan(0);
    const uncovered=banConsequences(state(),'blue',[rec('Ahri',80)],[]).get('Ahri:MID')!;
    expect(uncovered.enemyLoss).toBe(0);expect(uncovered.poolExhausted).toBe(false);
  });
});
