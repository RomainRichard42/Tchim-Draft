import { describe,expect,it } from 'vitest';
import { analyze } from '../src/engine';
import { SEED_CHAMPIONS,DEFAULT_SETTINGS } from '../src/shared/champions';
import { newDraft,PRO_ORDER } from '../src/shared/draft';
import { settingsSchema } from '../src/shared/validation';
import type { EngineInput,PlayerChampion,Role,Stat } from '../src/shared/types';

const stat=(championId:string,role:Role='MID',wins=500):Stat=>({championId,role,wins,games:1000,source:'solo',rank:'MASTER_PLUS',league:'all',side:'all',patch:'16.20',baseline:.5,pickRate:.1,banRate:.01});
function input(pool:PlayerChampion[]=[]):EngineInput{
  return {draft:newDraft('16.20'),settings:structuredClone(DEFAULT_SETTINGS),champions:SEED_CHAMPIONS,stats:[stat('Ahri','MID',520),stat('Zed'),stat('Orianna')],pairs:[],demo:false,
    teams:{ally:{url:'',region:'euw',players:[],poolOnly:false,message:''},enemy:{url:'',region:'euw',players:pool.length?[{riotId:'Opponent#EUW',role:'MID',pool,status:'loaded',message:''}]:[],poolOnly:false,message:''}}};
}

describe('dedicated OP.GG ban weighting',()=>{
  it('promotes the enemy comfort pick without requiring a strict pool or pick mastery weight',()=>{
    const state=input([{championId:'Zed',games:500,wins:290},{championId:'Ahri',games:10,wins:5},{championId:'Orianna',games:50,wins:25}]);
    state.settings.weights.mastery=0;state.settings.banScoutingWeight=0;
    const baseline=analyze(state).bans;expect(baseline[0].championId).toBe('Ahri');
    expect(baseline.map(b=>[b.championId,b.score])).toEqual(analyze({...state,teams:undefined}).bans.map(b=>[b.championId,b.score]));
    state.settings.banScoutingWeight=35;
    const targeted=analyze(state).bans[0];expect(targeted.championId).toBe('Zed');
    expect(targeted.banScouting?.appliedWeight).toBeGreaterThan(20);
    expect(targeted.reasons[0]).toContain('Opponent#EUW');expect(targeted.reasons[0]).toContain('500 parties');
  });
  it('gives more priority to a champion dominating a narrow pool than the same volume in a broad pool',()=>{
    const narrow=input([{championId:'Zed',games:200,wins:100},{championId:'Ahri',games:50,wins:25}]);
    const broad=input([{championId:'Zed',games:200,wins:100},{championId:'Ahri',games:1800,wins:900}]);
    expect(analyze(narrow).bans.find(b=>b.championId==='Zed')!.score).toBeGreaterThan(analyze(broad).bans.find(b=>b.championId==='Zed')!.score);
  });
  it('dampens a one-game perfect win rate and leaves bans unchanged when profiles are unavailable',()=>{
    const state=input([{championId:'Ahri',games:300,wins:150},{championId:'Zed',games:200,wins:100},{championId:'Orianna',games:1,wins:1}]);
    const bans=analyze(state).bans;expect(bans[0].championId).toBe('Ahri');
    const sample=bans.find(b=>b.championId==='Orianna')!.banScouting!;expect(sample.appliedWeight).toBeLessThan(2);
    const empty=input();empty.settings.banScoutingWeight=100;const before=analyze(empty).bans;empty.settings.banScoutingWeight=0;expect(analyze(empty).bans).toEqual(before);
  });
  it('evaluates each flex role before selecting the champion ban and uses the targeted team on red side',()=>{
    const state=input([{championId:'Gragas',games:500,wins:260}]);state.stats=[stat('Gragas','MID',510),stat('Gragas','JUNGLE',511)];
    expect(analyze(state).bans[0].role).toBe('MID');
    state.draft.side='red';state.draft.history=[{championId:null}];
    const ban=analyze(state).bans[0];expect(ban.role).toBe('MID');expect(ban.banScouting?.riotId).toBe('Opponent#EUW');
  });
  it('stops targeting comfort picks in roles already filled during the second ban phase',()=>{
    const state=input([{championId:'Orianna',games:500,wins:300}]);state.stats.push(stat('Ornn','TOP'),stat('Sejuani','JUNGLE'));
    const picks=[{championId:'Ahri',role:'MID' as const},{championId:'Ashe',role:'ADC' as const},{championId:'Zed',role:'MID' as const},{championId:'Vi',role:'JUNGLE' as const},{championId:'Braum',role:'SUPPORT' as const},{championId:'Lulu',role:'SUPPORT' as const}];
    state.draft.history=PRO_ORDER.slice(0,13).map(a=>a.kind==='ban'?{championId:null}:picks.shift()!);
    expect(analyze(state).bans.some(b=>b.role==='MID')).toBe(false);
  });
  it('loads old settings with a default scouting weight and rejects invalid weights',()=>{
    const {banScoutingWeight,...legacy}=DEFAULT_SETTINGS;
    expect(settingsSchema.parse(legacy).banScoutingWeight).toBe(35);
    expect(settingsSchema.safeParse({...legacy,banScoutingWeight:101}).success).toBe(false);
    expect(settingsSchema.safeParse({...legacy,banScoutingWeight:-1}).success).toBe(false);
  });
});
