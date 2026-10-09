import { describe, expect, it } from 'vitest';
import { simulationTurn } from '../src/engine/simulation';
import { appendGuidedChoice, guidedContext, guidedRosterIssues } from '../src/shared/guided-simulation';
import { simulationTurnSchema } from '../src/shared/validation';
import { SEED_CHAMPIONS, DEFAULT_SETTINGS } from '../src/shared/champions';
import { newDraft } from '../src/shared/draft';
import { ROLES } from '../src/shared/types';
import type { EngineInput, Teams } from '../src/shared/types';

function teams():Teams {
  const team=(key:string)=>({url:'https://op.gg/lol/multisearch/euw?summoners='+encodeURIComponent(key+'0#EUW,'+key+'1#EUW,'+key+'2#EUW,'+key+'3#EUW,'+key+'4#EUW'),region:'euw',poolOnly:false,message:'Fixture',players:ROLES.map((role,i)=>({riotId:key+i+'#EUW',role,status:'manual' as const,message:'Fixture',pool:SEED_CHAMPIONS.filter(c=>c.roles.includes(role)).map(c=>({championId:c.id,role,games:40,wins:20}))}))});
  return {ally:team('Ally'),enemy:team('Enemy')};
}
function input():EngineInput{return {draft:{...newDraft('16.20'),history:Array.from({length:6},()=>({championId:null}))},settings:structuredClone(DEFAULT_SETTINGS),teams:teams(),champions:SEED_CHAMPIONS,stats:[],pairs:[],demo:false};}
const known=new Set(SEED_CHAMPIONS.map(c=>c.id));

describe('guided OP.GG scrims',()=>{
  it('requires two complete rosters with five confirmed roles and usable pools',()=>{
    const roster=teams();expect(guidedRosterIssues(roster)).toEqual([]);
    roster.enemy.players[0].role='AUTO';roster.ally.players[2].pool=[];
    expect(guidedRosterIssues(roster).join()).toMatch(/cinq rôles/);expect(guidedRosterIssues(roster).join()).toMatch(/pool absent/);
    expect(guidedRosterIssues(undefined,'en').join()).toMatch(/OP.GG/);
    roster.enemy.url='https://example.com/lol/multisearch/euw';expect(guidedRosterIssues(roster).join()).toMatch(/lien multi OP.GG/);
  });
  it('captures and restricts both pools without changing live settings or teams',()=>{
    const base=input(),before=structuredClone(base);const context=guidedContext(base.settings,base.teams!);
    expect(context.teams?.ally.poolOnly).toBe(true);expect(context.teams?.enemy.poolOnly).toBe(true);expect(base).toEqual(before);
    base.teams!.enemy.players[0].pool=[];expect(context.teams!.enemy.players[0].pool.length).toBeGreaterThan(0);
  });
  it('scores only the current turn and responds to the actual imposed pick',()=>{
    const base=input();base.settings.weights={winrate:0,matchup:100,synergy:0,meta:0,flex:0,order:0,composition:0,mastery:0};
    base.teams!.enemy.players.find(p=>p.role==='MID')!.pool=[{championId:'Akali',role:'MID',games:50,wins:25},{championId:'Orianna',role:'MID',games:50,wins:25}];
    base.pairs=['Ahri','Azir'].flatMap((otherId,i)=>['Akali','Orianna'].map((championId,j)=>({championId,otherId,role:'MID' as const,otherRole:'MID' as const,kind:'matchup' as const,patch:'16.20',source:'pro' as const,rank:'all',league:'all',side:'all' as const,games:5000,wins:i===j?3500:1500,baseline:.5})));
    const turn=(championId:string)=>simulationTurn(base,{draft:{...base.draft,history:[...base.draft.history,{championId,role:'MID'}]},pins:[]});
    const ahri=turn('Ahri'),azir=turn('Azir'),score=(t:typeof ahri,id:string)=>t.options.find(r=>r.championId===id&&r.role==='MID')!.score;
    expect(score(ahri,'Akali')).toBeGreaterThan(score(ahri,'Orianna'));expect(score(azir,'Orianna')).toBeGreaterThan(score(azir,'Akali'));
    expect(ahri.balance.revealed).toBe(1);expect(ahri.balance.blue.count).toBe(1);expect(ahri.options.some(r=>r.championId==='Ahri')).toBe(false);
    expect(base.draft.history).toHaveLength(6);
  });
  it('uses the correct opponent pool on red side and respects Fearless and past bans',()=>{
    const base=input();base.draft.side='red';base.draft.series={format:'bo3',games:[{picks:SEED_CHAMPIONS.slice(0,10).map(c=>c.id)}]};
    const reserved=base.draft.series.games[0].picks,ban=SEED_CHAMPIONS.find(c=>!reserved.includes(c.id))!.id;base.draft.history[0]={championId:ban};
    const turn=simulationTurn(base,{draft:base.draft,pins:[]});
    for(const r of turn.options){const player=base.teams!.enemy.players.find(p=>p.role===r.role)!;expect(player.pool.some(c=>c.championId===r.championId)).toBe(true);expect([...reserved,ban]).not.toContain(r.championId);}
    expect(turn.options.length).toBeGreaterThan(0);
  });
  it('validates manual exceptions while refusing illegal or duplicate choices',()=>{
    const base=input(),before=structuredClone(base.draft);
    const next=appendGuidedChoice(base.draft,{championId:'Ahri',role:'MID'},known);
    expect(next.history).toHaveLength(7);expect(base.draft).toEqual(before);
    expect(()=>appendGuidedChoice(next,{championId:'Ahri',role:'MID'},known)).toThrow();
    expect(()=>appendGuidedChoice(base.draft,{championId:'NotAChampion',role:'MID'},known)).toThrow();
    expect(()=>appendGuidedChoice(base.draft,{championId:null},known)).toThrow();
    expect(simulationTurnSchema.safeParse({draft:base.draft,pins:[],approach:'poke',execute:'unsafe'}).success).toBe(false);
    base.teams!.enemy.players[0].pool=[];expect(()=>simulationTurn(base,{draft:base.draft,pins:[]})).toThrow(/pool/);
  });
});
