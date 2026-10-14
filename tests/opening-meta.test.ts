import { describe,it,expect } from 'vitest';
import { metaProfiles,playableFlex,contextChampionIds } from '../src/engine/meta';
import { analyze,strategyAnalysis } from '../src/engine';
import { strategicPickScore } from '../src/engine/strategy';
import { DEFAULT_SETTINGS,SEED_CHAMPIONS } from '../src/shared/champions';
import { newDraft } from '../src/shared/draft';
import { prepare } from '../src/engine/evidence';
import type { EngineInput,Stat,Role } from '../src/shared/types';
const stat=(id:string,role:Role,values:Partial<Stat>={}):Stat=>({championId:id,role,patch:'16.20',source:'pro',rank:'all',league:'all',side:'all',games:100,wins:50,baseline:.5,pickRate:.1,banRate:.2,...values});
const input=():EngineInput=>({draft:{...newDraft('16.20'),history:Array.from({length:6},()=>({championId:null}))},champions:SEED_CHAMPIONS,stats:[stat('Gragas','TOP'),stat('Gragas','JUNGLE'),stat('Ornn','TOP')],pairs:[],demo:false,settings:structuredClone(DEFAULT_SETTINGS)});
const empty={url:'',region:'euw',poolOnly:false,message:'',players:[]};
describe('competitive opening evidence',()=>{
 it('combines actual pick presence across roles and counts shared bans once',()=>{const p=metaProfiles(input(),'blue').get('Gragas')!;expect(p.proPresence).toBeCloseTo(.4);expect(p.roles.sort()).toEqual(['JUNGLE','TOP']);});
 it('gives no meta lift or flex certification to one or two perfect pro games',()=>{for(const games of [1,2]){const state=input();state.stats=[stat('Gragas','TOP',{games,wins:games,pickRate:.9,banRate:.9}),stat('Gragas','MID',{games,wins:games})];const p=metaProfiles(state,'blue').get('Gragas')!;expect(p.priority).toBe(35);expect(p.roles).toEqual([]);expect(playableFlex(state,'Gragas','blue').score).toBe(50);}});
 it('does not certify a tiny offrole beside a well-sampled primary role',()=>{const state=input();state.stats=[stat('Gragas','TOP'),stat('Gragas','MID',{games:2,wins:2,pickRate:.002})];expect(playableFlex(state,'Gragas','blue').roles).toEqual(['TOP']);});
 it('removes occupied seats from the value of a flex',()=>{const state=input();expect(playableFlex(state,'Gragas','blue').score).toBeGreaterThan(50);state.draft.history.push({championId:'Ornn',role:'TOP'});expect(playableFlex(state,'Gragas','blue')).toEqual({roles:['JUNGLE'],score:50});});
 it('does not claim a flex in a known player pool that cannot play it',()=>{const state=input();state.teams={ally:{...empty,players:[{riotId:'Top#TEST',role:'TOP',status:'manual',message:'',pool:[{championId:'Ornn',role:'TOP',games:20,wins:10}]},{riotId:'Jungle#TEST',role:'JUNGLE',status:'manual',message:'',pool:[{championId:'Gragas',role:'JUNGLE',games:20,wins:10}]}]},enemy:empty};expect(playableFlex(state,'Gragas','blue').roles).toEqual(['JUNGLE']);});
 it('explores both observed flex placements and exposes their scores',()=>{const state=input();state.settings.strategyDepth=2;const report=strategyAnalysis(state),g=report.options.find(r=>r.championId==='Gragas')!;expect(g.alternatives!.map(r=>r.role).sort()).toEqual(['JUNGLE','TOP']);expect(g.alternatives!.every(r=>Number.isFinite(r.after))).toBe(true);expect(report.options.filter(r=>r.championId==='Gragas')).toHaveLength(1);});
 it('preserves opening meta and blind scores when branch evidence is equal',()=>{const state=input(),rec=analyze(state).picks[0];expect(strategicPickScore(state,{...rec,score:72},1,1)).toBe(72);expect(strategicPickScore(state,{...rec,score:42},1,1)).toBe(42);expect(strategicPickScore(state,{...rec,score:42},999,0)).toBe(52);});
 it('loads context for credible flex champions as well as the role meta',()=>{expect(contextChampionIds(input())).toContain('Gragas');expect(contextChampionIds(input())).toContain('Ornn');});
 it('does not borrow a champion’s pro priority for an unsupported solo offrole',()=>{const state=input();state.stats.push(stat('Gragas','ADC',{source:'solo',rank:'MASTER_PLUS',games:5000,wins:2900,pickRate:.04,banRate:.2}));const before=metaProfiles(state,'blue').get('Gragas')!;state.stats=state.stats.map(s=>s.source==='pro'?{...s,banRate:.9}:s);const after=metaProfiles(state,'blue').get('Gragas')!;expect(after.priority).toBeGreaterThan(before.priority);expect(after.rolePriority.ADC).toBe(before.rolePriority.ADC);expect(after.proRoleGames.ADC??0).toBe(0);});
 it('keeps explicit role filters while allowing all placements in AUTO',()=>{const state=input();state.draft.targetRole='TOP';const report=strategyAnalysis(state);expect(report.options.find(r=>r.championId==='Gragas')!.alternatives!.map(r=>r.role)).toEqual(['TOP']);});
 it('separates the real first pick, phase-one choices and blind frequency from lineup order',()=>{
  const state=input();state.games=[{id:'order',patch:'16.20',league:'all',tournament:'Fixture',winner:'blue',draftOrderKnown:true,history:[...state.draft.history,{championId:'Gragas',role:'JUNGLE'},{championId:'Ornn',role:'TOP'},{championId:'Jax',role:'JUNGLE'},{championId:'Ahri',role:'MID'},{championId:'Ashe',role:'ADC'},{championId:'Lulu',role:'SUPPORT'},...Array.from({length:4},()=>({championId:null})),{championId:'Jinx',role:'ADC'},{championId:'Renekton',role:'TOP'},{championId:'Nautilus',role:'SUPPORT'},{championId:'Orianna',role:'MID'}]}];
  const h=prepare(state).historical;expect(h.get('Gragas|JUNGLE|blue')).toEqual({first:1,early:1,blind:1,total:1});expect(h.get('Ahri|MID|blue')!.first).toBe(0);expect(h.get('Renekton|TOP|blue')!.early).toBe(0);expect(h.get('Renekton|TOP|blue')!.blind).toBe(0);
  state.games[0].draftOrderKnown=false;state.games=[...state.games];expect(prepare(state).historical.size).toBe(0);
 });
});
