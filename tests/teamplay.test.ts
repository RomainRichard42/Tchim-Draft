import { describe,it,expect } from 'vitest';
import { analyze } from '../src/engine';
import { teamplay } from '../src/engine/teamplay';
import { DEFAULT_SETTINGS,SEED_CHAMPIONS } from '../src/shared/champions';
import { newDraft,PRO_ORDER } from '../src/shared/draft';
import type { EngineInput,Role,Side,Stat,ScoutedTeam } from '../src/shared/types';
const champ=(id:string)=>SEED_CHAMPIONS.find(c=>c.id===id)!;
const stat=(championId:string,role:Role,values:Partial<Stat>={}):Stat=>({championId,role,patch:'16.20',source:'solo',rank:'MASTER_PLUS',league:'all',side:'all',games:1000,wins:500,baseline:.5,pickRate:.1,banRate:.01,...values});
const base=():EngineInput=>({draft:newDraft('16.20'),settings:structuredClone(DEFAULT_SETTINGS),champions:SEED_CHAMPIONS,stats:[],pairs:[],demo:false});
const emptyTeam=():ScoutedTeam=>({url:'',region:'euw',players:[],poolOnly:false,message:''});
describe('contextual competitive recommendations',()=>{
 it('changes the support priority to protect Jinx against Vi/Akali dive',()=>{
  const input=base();input.draft.targetRole='SUPPORT';input.draft.history=[...Array.from({length:6},()=>({championId:null})),{championId:'Jinx',role:'ADC'},{championId:'Vi',role:'JUNGLE'},{championId:'Akali',role:'MID'}];
  input.stats=[stat('Lulu','SUPPORT'),stat('Nautilus','SUPPORT')];
  const result=analyze(input);expect(result.picks[0].championId).toBe('Lulu');
  expect(result.picks[0].reasons.some(r=>r.includes('dive'))).toBe(true);
  const frontline=teamplay(champ('Maokai'),'JUNGLE',[],[],[]);expect(frontline.score).toBe(50);
 });
 it('gives last-pick Jayce priority over another AP carry in an AP-heavy lineup',()=>{
  const input=base();input.draft.side='red';input.draft.targetRole='TOP';
  const roster:Record<Side,[string,Role][]>= {blue:[['Renekton','TOP'],['Vi','JUNGLE'],['Ahri','MID'],['Ashe','ADC'],['Lulu','SUPPORT']],red:[['Lillia','JUNGLE'],['Ziggs','ADC'],['Orianna','MID'],['Nautilus','SUPPORT']]};
  input.draft.history=PRO_ORDER.slice(0,19).map(a=>{if(a.kind==='ban')return {championId:null};const [championId,role]=roster[a.side].shift()!;return {championId,role};});
  input.stats=[stat('Jayce','TOP'),stat('Gwen','TOP')];expect(analyze(input).picks[0].championId).toBe('Jayce');
 });
 it('rejects Maokai/Akali offroles with tiny usage instead of rewarding their generic flex profile',()=>{
  const input=base();input.draft.targetRole='TOP';input.draft.history=Array.from({length:6},()=>({championId:null}));
  input.stats=[stat('Gwen','TOP'),stat('Maokai','TOP',{games:3,wins:3,pickRate:.001}),stat('Akali','TOP',{source:'pro',games:6,wins:6,pickRate:.01}),stat('Akali','MID',{source:'pro',games:100,wins:50}),stat('Maokai','JUNGLE')];
  expect(analyze(input).picks.map(r=>r.championId)).toEqual(['Gwen']);
  input.draft.targetRole='MID';expect(analyze(input).picks[0].factors.flex).toBe(50);
 });
 it('uses a pool for each side and targets enemy comfort picks without using the ally pool for bans',()=>{
  const input=base();input.draft.targetRole='MID';input.stats=[stat('Ahri','MID'),stat('Orianna','MID'),stat('Zed','MID')];
  input.teams={ally:{...emptyTeam(),poolOnly:true,players:[{riotId:'ally#EUW',role:'MID',pool:[{championId:'Orianna',games:100,wins:50}],status:'loaded',message:''}]},enemy:{...emptyTeam(),poolOnly:true,players:[{riotId:'enemy#EUW',role:'MID',pool:[{championId:'Zed',games:150,wins:80}],status:'loaded',message:''}]}};
  expect(analyze(input).bans[0].championId).toBe('Zed');
  input.draft.history=Array.from({length:6},()=>({championId:null}));
  expect(analyze(input).picks.map(r=>r.championId)).toEqual(['Orianna']);
  const before=analyze(input).picks;input.draft.role='SUPPORT';expect(analyze(input).picks).toEqual(before);
 });
 it('does not let a one-game pro outlier dominate Master+ statistics',()=>{
  const input=base();input.draft.targetRole='MID';input.stats=[stat('Ahri','MID',{games:50000,wins:25000}),stat('Ahri','MID',{source:'pro',games:1,wins:1})];input.draft.history=Array.from({length:6},()=>({championId:null}));
  expect(analyze(input).picks[0].winrate).toBeLessThan(.502);
 });
});
