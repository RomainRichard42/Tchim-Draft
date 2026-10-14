import type { EngineInput, Role, Side } from '../shared/types';
import { freeRoles } from '../shared/draft';
import { evidence, prepare } from './evidence';
import { clamp } from './math';

export interface MetaProfile { priority:number; roles:Role[]; roleSupport:Partial<Record<Role,number>>; rolePriority:Partial<Record<Role,number>>; proRoleGames:Partial<Record<Role,number>>; proPresence:number|null; soloPresence:number|null }
const cache=new WeakMap<object,Map<string,Map<string,MetaProfile>>>();
/** Presence is summed across pick roles; bans are counted once per champion.
 * Percentiles describe observed priority, not first-pick frequencies or win probabilities.
 */
export function metaProfiles(input:EngineInput,side:Side):Map<string,MetaProfile> {
 const prepared=prepare(input),key=input.draft.mode+'|'+side;
 let byView=cache.get(prepared);if(!byView){byView=new Map();cache.set(prepared,byView);}const saved=byView.get(key);if(saved)return saved;
 if(!input.stats.length){const fallback=new Map(input.champions.map(c=>[c.id,{priority:35,roles:c.roles,roleSupport:{},rolePriority:{},proRoleGames:{},proPresence:null,soloPresence:null} satisfies MetaProfile]));byView.set(key,fallback);return fallback;}
 const entries=input.champions.map(champion=>{
  const roles=[...prepared.roles.get(champion.id)??[]].map(role=>({role,data:evidence(input,champion.id,role,side)}));
  const sources=(['pro','solo'] as const).map(source=>{
   const rows=roles.flatMap(r=>r.data?.groups.filter(g=>g.source===source).map(g=>({role:r.role,...g}))??[]);
   const n=rows.reduce((v,r)=>v+r.n,0),picks=rows.reduce((v,r)=>v+r.pickRate,0),bans=Math.max(0,...rows.map(r=>r.banRate));
   return {source,n,presence:clamp(picks+bans,0,1),support:rows.some(r=>r.usable)?n/(n+(source==='pro'?50:200)):0,mixture:Math.max(0,...rows.map(r=>r.mixture)),rows};
  });
  return {id:champion.id,sources};
 });
 const sourceRows=new Map(['pro','solo'].map(source=>[source,entries.flatMap(e=>e.sources.filter(s=>s.source===source).flatMap(s=>s.rows))]));
 const populations=new Map(['pro','solo'].map(source=>[source,entries.flatMap(e=>e.sources.filter(s=>s.source===source&&s.rows.some(r=>r.usable&&r.pickRate>=.005)))]));
 const rolePopulations=new Map<string,typeof entries[number]['sources'][number]['rows']>();
 for(const source of ['pro','solo'])for(const role of ['TOP','JUNGLE','MID','ADC','SUPPORT'])rolePopulations.set(source+'|'+role,(sourceRows.get(source)??[]).filter(r=>r.role===role&&r.usable&&r.pickRate>=.005));
 const result=new Map<string,MetaProfile>();
 for(const entry of entries){
  const viable:Role[]=[],roleSupport:MetaProfile['roleSupport']={},rolePriority:MetaProfile['rolePriority']={},proRoleGames:MetaProfile['proRoleGames']={};let weighted=0,total=0;
  for(const source of entry.sources){
   const viableRows=source.rows.filter(r=>r.usable&&r.pickRate>=.005&&r.n/Math.max(1,source.n)>=.1);
   for(const row of viableRows){if(!viable.includes(row.role))viable.push(row.role);const share=row.n/Math.max(1,source.n)*row.support;roleSupport[row.role]=(roleSupport[row.role]??0)+share*(input.draft.mode==='pro'?(source.source==='pro'?.7:.3):(source.source==='pro'?.1:.9));}
   if(source.source==='pro')for(const row of source.rows)proRoleGames[row.role]=row.n;
   if(!source.n)continue;
   const population=populations.get(source.source)??[];
   const percentile=population.length?population.reduce((v,s)=>v+(s.presence<source.presence?1:s.presence===source.presence?.5:0),0)/population.length:0;
   const raw=20+source.presence*45+percentile*35;
   weighted+=(35+(raw-35)*source.support)*source.mixture;total+=source.mixture;
  }
  for(const role of ['TOP','JUNGLE','MID','ADC','SUPPORT'] as Role[]){
   let score=0,weight=0;
   for(const source of entry.sources){
    const population=rolePopulations.get(source.source+'|'+role)??[];
    if(!(sourceRows.get(source.source)??[]).some(r=>r.usable))continue;
    const row=source.rows.find(r=>r.role===role),share=row?row.n/Math.max(1,source.n):0;
    const presence=row?clamp(row.pickRate+Math.max(0,...source.rows.map(r=>r.banRate))*Math.min(1,share*2),0,1):0;
    const percentile=row&&population.length?population.reduce((n,r)=>n+(r.pickRate<row.pickRate?1:r.pickRate===row.pickRate?.5:0),0)/population.length:0;
    const raw=20+presence*45+percentile*35,support=row?.usable?row.support:0;
    const mixture=input.draft.mode==='pro'?(source.source==='pro'?.55:.45):(source.source==='pro'?.1:.9);
    score+=(35+(raw-35)*support)*mixture;weight+=mixture;
   }
   rolePriority[role]=weight?score/weight:35;
  }
  result.set(entry.id,{priority:total?weighted/total:35,roles:viable,roleSupport,rolePriority,proRoleGames,
   proPresence:entry.sources[0].n?entry.sources[0].presence:null,soloPresence:entry.sources[1].n?entry.sources[1].presence:null});
 }
 byView.set(key,result);return result;
}
/** A statistical offrole is not a usable flex if its seat is occupied or its known player cannot play it. */
export function playableFlex(input:EngineInput,id:string,side:Side):{roles:Role[];score:number} {
 const profile=metaProfiles(input,side).get(id),team=input.teams?.[side===input.draft.side?'ally':'enemy'];
 const roles=(input.stats.length?profile?.roles??[]:input.champions.find(c=>c.id===id)?.roles??[]).filter(role=>{
  if(!freeRoles(input.draft,side).includes(role))return false;
  const players=team?.players.filter(p=>p.role===role||(p.role==='AUTO'&&!team.players.some(other=>other.role===role)))??[];
  return !players.length||players.some(p=>!p.pool.length||p.pool.some(c=>c.championId===id&&(!c.role||c.role===role)&&(c.games>=3||(c.games===0&&p.status==='manual'))));
 });
 const mass=roles.map(role=>profile?.roleSupport[role]??1),total=mass.reduce((n,v)=>n+v,0);
 const ambiguity=total?1-mass.reduce((n,v)=>n+(v/total)**2,0):0;
 return {roles,score:clamp(50+ambiguity*45)};
}

/** Shared-data queries must cover alternative flexes, not just the six most picked champions. */
export function contextChampionIds(input:EngineInput):string[] {
 const profiles=metaProfiles(input,input.draft.side),ids=new Set<string>();
 for(const role of ['TOP','JUNGLE','MID','ADC','SUPPORT'] as Role[]){
  const ranked=[...profiles].filter(([,p])=>p.roles.includes(role)).sort((a,b)=>
   b[1].priority*(.5+(b[1].roleSupport[role]??0))-a[1].priority*(.5+(a[1].roleSupport[role]??0))||a[0].localeCompare(b[0]));
  for(const [id] of ranked.slice(0,12))ids.add(id);
 }
 for(const [id] of [...profiles].filter(([,p])=>p.roles.length>1).sort((a,b)=>b[1].priority-a[1].priority).slice(0,12))ids.add(id);
 return [...ids];
}
