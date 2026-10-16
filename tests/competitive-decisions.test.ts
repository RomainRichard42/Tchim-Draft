import { describe, expect, it } from 'vitest';
import { rankCandidates, strategyAnalysis } from '../src/engine';
import { observedRoles, teamAssignments } from '../src/engine/assignments';
import { metaProfiles } from '../src/engine/meta';
import { choiceRolePolicy } from '../src/engine/policy';
import { decisionHorizon, exploreStrategy } from '../src/engine/strategy';
import { DEFAULT_SETTINGS, SEED_CHAMPIONS } from '../src/shared/champions';
import { freeRoles, newDraft, order, used } from '../src/shared/draft';
import { appendWithRoleChanges, rewindDraft } from '../src/shared/placements';
import { validateDraft } from '../src/shared/series';
import type { Champion, EngineInput, Recommendation, Role, Stat } from '../src/shared/types';

const row=(championId:string,role:Role,games=1000,wins=games/2):Stat=>({championId,role,games,wins,source:'pro',rank:'all',league:'all',side:'all',patch:'16.20',pickRate:.1,banRate:.1,baseline:.5});
const base=():EngineInput=>({draft:{...newDraft('16.20'),history:[...Array.from({length:6},()=>({championId:null})),{championId:'Gragas',role:'TOP'}]},settings:structuredClone(DEFAULT_SETTINGS),champions:SEED_CHAMPIONS,stats:[row('Gragas','TOP'),row('Gragas','JUNGLE'),row('Gwen','TOP'),row('Jax','TOP')],pairs:[],demo:false});
const rec=(championId:string,role:Role):Recommendation=>({championId,role,score:50,games:1000,winrate:.5,confidence:70,interval:null,factors:DEFAULT_SETTINGS.weights,reasons:[],responseRisk:0,source:'pro'});

describe('Competitive flex placements',()=>{
 it('releases top by moving an existing flex to jungle without changing draft order',()=>{
  const input=base(),candidate=rankCandidates(input,'blue','TOP').find(r=>r.championId==='Gwen')!;
  expect(candidate.reassignments).toEqual([{championId:'Gragas',role:'JUNGLE'}]);
  const next=appendWithRoleChanges({...input.draft,history:input.draft.history.slice(0,6)}, {championId:'Gragas',role:'TOP'});
  // Blue picks again after R1/R2.
  next.history.push({championId:'Ahri',role:'MID'},{championId:'Varus',role:'ADC'});
  const after=appendWithRoleChanges(next,{championId:'Gwen',role:'TOP'},candidate.reassignments);
  validateDraft(after,new Set(input.champions.map(c=>c.id)));
  expect(after.history[6]).toMatchObject({championId:'Gragas',role:'JUNGLE'});
  expect(after.history[9]).toMatchObject({championId:'Gwen',role:'TOP'});
  expect(rewindDraft(after,9)).toEqual(next);
 });
 it('honors a coach role lock and a known player who cannot play the flex',()=>{
  const input=base();input.draft.history[6].roleLocked=true;
  expect(rankCandidates(input,'blue','TOP')).toEqual([]);
  input.draft.history[6].roleLocked=false;
  input.teams={ally:{url:'',region:'euw',poolOnly:true,message:'',players:[{riotId:'Jungler#EUW',role:'JUNGLE',status:'manual',message:'',pool:[{championId:'Vi',games:0,wins:0,role:'JUNGLE'}]}]},enemy:{url:'',region:'euw',poolOnly:false,message:'',players:[]}};
  expect(teamAssignments(input,'blue')).toHaveLength(1);
  expect(rankCandidates(input,'blue','TOP')).toEqual([]);
 });
 it('permits multiple simultaneous flex moves with one seat per role',()=>{
  const input=base();input.stats.push(row('Poppy','TOP'),row('Poppy','SUPPORT'));
  input.draft.history.push({championId:'Poppy',role:'TOP'}); // Red side, must not move with blue.
  input.draft.history.push({championId:'Ahri',role:'MID'});
  input.draft.history.push({championId:'Gwen',role:'JUNGLE'});input.stats.push(row('Gwen','MID'));
  const assignments=teamAssignments(input,'blue');
  expect(assignments.some(rows=>rows.some(p=>p.championId==='Gragas'&&p.role==='JUNGLE')&&rows.some(p=>p.championId==='Gwen'&&p.role==='MID'))).toBe(true);
  for(const rows of assignments)expect(new Set(rows.map(p=>p.role)).size).toBe(rows.length);
 });
 it('separates a newly observed role from win-rate confidence',()=>{
  const input=base();input.draft.history=input.draft.history.slice(0,6);input.stats=[row('Gragas','TOP',20),row('Gragas','JUNGLE',3,3)];
  expect(observedRoles(input,'Gragas','blue')).toContain('JUNGLE');
  const jungle=rankCandidates(input,'blue','JUNGLE').find(r=>r.championId==='Gragas')!;
  expect(jungle.factors.winrate).toBe(50);expect(jungle.lowSample).toBe(true);expect(jungle.factors.flex).toBe(50);
  input.stats=[row('Gragas','TOP',20),row('Gragas','JUNGLE',1,1)];
  expect(observedRoles(input,'Gragas','blue')).not.toContain('JUNGLE');
 });
 it('keeps both possible enemy flex roles in the response policy',()=>{
  const input=base(),policy=choiceRolePolicy(input,'red',[rec('Gragas','TOP'),rec('Gragas','JUNGLE')]);
  expect(policy).toHaveLength(2);expect(policy.every(p=>p.preference>0)).toBe(true);expect(policy.reduce((n,p)=>n+p.preference,0)).toBeCloseTo(1);
 });
 it('does not certify the lane of an already revealed enemy flex until its role is locked',()=>{
  const input=base();input.draft.history=[...input.draft.history.slice(0,6),{championId:'Varus',role:'ADC'},{championId:'Gragas',role:'TOP'},{championId:'Ahri',role:'MID'}];
  input.stats.push(row('Ahri','MID'));
  input.pairs=[{championId:'Gwen',role:'TOP',otherId:'Gragas',otherRole:'TOP',kind:'matchup',source:'pro',rank:'all',league:'all',side:'all',patch:'16.20',games:100,wins:20,baseline:.5}];
  let candidate=rankCandidates(input,'blue','TOP').find(r=>r.championId==='Gwen')!;
  expect(candidate.blind).toBeDefined();expect(candidate.blind!.threats.some(t=>t.championId==='Gragas')).toBe(true);
  expect(candidate.reasons.some(r=>r.includes('Flex adverse non fixé'))).toBe(true);
  input.draft.history[7].roleLocked=true;
  candidate=rankCandidates(input,'blue','TOP').find(r=>r.championId==='Gwen')!;
  expect(candidate.blind).toBeUndefined();expect(candidate.reasons.some(r=>r.includes('Flex adverse non fixé'))).toBe(false);
 });
 it('can observe heavy bans over many drafts without awarding a one-game win-rate bonus',()=>{
  const input=base();input.draft.history=input.draft.history.slice(0,6);
  input.stats=[{...row('Gragas','TOP',1,1),pickRate:.001,banRate:.9},row('Gragas','JUNGLE',30,15)];
  expect(metaProfiles(input,'blue').get('Gragas')!.priority).toBeGreaterThan(50);
  const candidate=rankCandidates(input,'blue','TOP',false,true,'Gragas')[0];
  expect(candidate.factors.winrate).toBe(50);expect(candidate.winrate).toBeNull();
 });
});

describe('Bans across real pick milestones',()=>{
 it('reserves future coach champions and seats at the root as well as inside the tree',()=>{
  const input=base();input.draft.history=input.draft.history.slice(0,6);input.stats.push(row('Ahri','MID'),row('Ornn','TOP'));
  const report=strategyAnalysis(input,{draft:input.draft,pins:[{index:9,selection:{championId:'Ornn',role:'TOP'}}],roots:[],depth:2,risk:35});
  expect(report.options.length).toBeGreaterThan(0);
  expect(report.options.every(r=>r.championId!=='Ornn'&&r.role!=='TOP'&&!r.reassignments?.some(p=>p.role==='TOP'))).toBe(true);
 });
 it('does not treat an inferior choice we can decline as an unavoidable enemy risk',()=>{
  const input=base();input.draft.history[6]={championId:'Gragas',role:'TOP'};
  const original=input.champions.find(c=>c.id==='Gragas')!;
  input.champions=[original,...['Root','Strong','Weak'].map(id=>({...original,id,name:id}))];
  input.stats=[row('Gragas','TOP'),row('Root','MID'),row('Strong','TOP',1000,800),row('Weak','TOP',1000,200)];
  const report=exploreStrategy(input,state=>state.draft.history.length===7?[rec('Root','MID')]:[rec('Strong','TOP'),rec('Weak','TOP')],{draft:input.draft,pins:[],roots:[],depth:2,risk:100});
  const outlook=report.options[0].outlook!;
  expect(outlook.expected).toBeGreaterThan(0);expect(outlook.worst).toBe(outlook.expected);expect(outlook.after).toBe(outlook.expected);
 });
 it('crosses the remaining bans, both enemy picks and our response',()=>{
  const input=base();input.draft.history=[];
  expect(decisionHorizon(input,3)).toBe(11);
  input.draft.history=[{championId:null}];expect(decisionHorizon(input,3)).toBe(9);
 });
 it('prefers denying a strong enemy option after its replacement and our answer',()=>{
  const input=base();input.draft.history=[];
  const champion=(id:string,role:Role):Champion=>({id,name:id,key:1,roles:[role],curated:false,tags:[],traits:{ad:.5,frontline:1.5,engage:1.5,peel:1.5,poke:1.5,early:1.5,scaling:1.5}});
  input.champions=['Power','Weak','Unused',...Array.from({length:20},(_,i)=>'Filler'+i)].map(id=>champion(id,'MID'));
  input.stats=input.champions.map(c=>row(c.id,'TOP',1000,c.id==='Power'?800:500));
  const report=exploreStrategy(input,(state,side,kind)=>{
   const at=state.draft.history.length,locked=used(state.draft);
   if(at===0)return [rec('Power','MID'),rec('Unused','MID')];
   if(kind==='ban')return [rec('Filler'+at,'MID')];
   const role=freeRoles(state.draft,side)[0];
   const id=side==='red'&&!locked.has('Power')?'Power':side==='red'&&!locked.has('Weak')?'Weak':'Filler'+at;
   return [rec(id,role)];
  },{draft:input.draft,pins:[],roots:[],depth:3,risk:35});
  expect(report.horizon).toBe(11);
  const denied=report.options.find(r=>r.championId==='Power')!,left=report.options.find(r=>r.championId==='Unused')!;
  expect(denied.outlook!.after).toBeGreaterThan(left.outlook!.after);
  expect(denied.score).toBeGreaterThan(left.score);
  const kinds:string[]=[];const visit=(nodes:NonNullable<Recommendation['outlook']>['nodes'])=>{for(const node of nodes){kinds.push(node.kind);visit(node.children);}};
  visit(denied.outlook!.nodes);expect(kinds.filter(k=>k==='pick').length).toBeGreaterThanOrEqual(5);
 });
});
