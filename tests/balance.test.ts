import { describe,it,expect } from 'vitest';
import { analyze,draftBalance } from '../src/engine';
import { DEFAULT_SETTINGS,SEED_CHAMPIONS } from '../src/shared/champions';
import { newDraft,PRO_ORDER } from '../src/shared/draft';
import { ROLES,type Champion,type EngineInput,type Role,type Selection,type Side,type Stat } from '../src/shared/types';

const base=():EngineInput=>({draft:newDraft('16.20'),settings:structuredClone(DEFAULT_SETTINGS),champions:SEED_CHAMPIONS,stats:[],pairs:[],demo:false});
const stat=(championId:string,role:Role,wins=500):Stat=>({championId,role,patch:'16.20',source:'solo',rank:'MASTER_PLUS',league:'all',side:'all',games:1000,wins,baseline:.5,pickRate:.1,banRate:.01});
const neutralChampions:Champion[]=['blue','red'].flatMap((side,s)=>ROLES.map((role,i)=>({id:`Test${side}${role}`,name:`Test ${side} ${role}`,key:10000+s*5+i,roles:[role],traits:{ad:.5,frontline:0,engage:0,peel:0,poke:0,early:1,scaling:1},tags:[],curated:true})));
function fill(input:EngineInput,rosters:Record<Side,Selection[]>,length=20){
  const remaining=structuredClone(rosters);
  input.draft.history=PRO_ORDER.slice(0,length).map(a=>a.kind==='ban'?{championId:null}:remaining[a.side].shift()!);
}
const neutralRoster:Record<Side,Selection[]>={blue:ROLES.map(role=>({championId:`Testblue${role}`,role})),red:ROLES.map(role=>({championId:`Testred${role}`,role}))};

describe('live draft advantage and expanded suggestions',()=>{
  it('starts neutral before picks and does not count bans as team strength',()=>{
    const input=base();input.draft.history=[{championId:'Ahri'},{championId:'Vi'}];
    expect(draftBalance(input)).toEqual({value:0,blue:{score:50,count:0},red:{score:50,count:0},revealed:0,complete:false});
  });
  it('does not give an automatic advantage to the side that has picked more champions',()=>{
    const input=base();input.champions=neutralChampions;fill(input,neutralRoster,11);
    const balance=draftBalance(input);
    expect(balance.blue.count).toBe(3);expect(balance.red.count).toBe(2);
    expect(balance.blue.score).toBe(50);expect(balance.red.score).toBe(50);expect(balance.value).toBe(0);
  });
  it('rewards protection against revealed dive and recalculates after undo',()=>{
    const input=base();input.draft.history=[...Array.from({length:6},()=>({championId:null})),{championId:'Jinx',role:'ADC'},{championId:'Vi',role:'JUNGLE'},{championId:'Akali',role:'MID'}];
    const exposed=draftBalance(input);
    input.draft.history.push({championId:'Lulu',role:'SUPPORT'});const protectedCarry=draftBalance(input);
    expect(protectedCarry.blue.score).toBeGreaterThan(exposed.blue.score);
    expect(protectedCarry.value).toBeGreaterThan(exposed.value);
    input.draft.history[9]={championId:'Nautilus',role:'SUPPORT'};
    expect(protectedCarry.value).toBeGreaterThan(draftBalance(input).value);
    input.draft.history.pop();expect(draftBalance(input)).toEqual(exposed);
  });
  it('reverses the advantage when the compositions swap sides and stays independent of the viewing side',()=>{
    const input=base();input.champions=neutralChampions;
    input.stats=neutralChampions.flatMap(c=>c.roles.map(r=>stat(c.id,r,c.id.includes('blue')?600:400)));
    fill(input,neutralRoster);const first=draftBalance(input);expect(first.complete).toBe(true);expect(first.value).toBeGreaterThan(0);expect(first.value).toBeCloseTo(first.blue.score-first.red.score,1);
    input.draft.side='red';expect(draftBalance(input)).toEqual(first);
    fill(input,{blue:neutralRoster.red,red:neutralRoster.blue});const reversed=draftBalance(input);
    expect(reversed.value).toBe(-first.value);expect(reversed.blue.score).toBe(first.red.score);expect(reversed.red.score).toBe(first.blue.score);
  });
  it('still evaluates an actual manual offrole outside the suggested player pool',()=>{
    const input=base();input.stats=[stat('Ahri','MID'),stat('Akali','TOP',650)];
    input.teams={ally:{url:'',region:'euw',poolOnly:true,message:'',players:[{riotId:'player#EUW',role:'TOP',status:'loaded',message:'',pool:[{championId:'Gwen',games:100,wins:50}]}]},enemy:{url:'',region:'euw',poolOnly:false,message:'',players:[]}};
    input.draft.history=[...Array.from({length:6},()=>({championId:null})),{championId:'Akali',role:'TOP'}];
    const result=draftBalance(input);expect(result.blue.count).toBe(1);expect(result.blue.score).toBeGreaterThan(50);
    input.settings.weights={winrate:0,matchup:0,synergy:0,composition:0,meta:1,flex:0,order:0,mastery:0};
    expect(Number.isFinite(draftBalance(input).value)).toBe(true);
  });
  it('returns every eligible unique pick in score order while respecting used champions and role filters',()=>{
    const input=base();input.draft.history=[{championId:'Ahri'},...Array.from({length:5},()=>({championId:null}))];
    const result=analyze(input);expect(result.picks.length).toBeGreaterThan(5);
    expect(new Set(result.picks.map(p=>p.championId)).size).toBe(result.picks.length);
    expect(result.picks.some(p=>p.championId==='Ahri')).toBe(false);
    expect(result.picks.every((p,i)=>i===0||p.score<=result.picks[i-1].score)).toBe(true);
    expect(result.picks.every(p=>p.summary&&p.score>=0&&p.score<=100)).toBe(true);
    input.draft.targetRole='SUPPORT';expect(analyze(input).picks.every(p=>p.role==='SUPPORT')).toBe(true);
    expect(result.bans.length).toBe(5);expect(result.scenarios.every(s=>s.winProbability===null)).toBe(true);
  });
});
