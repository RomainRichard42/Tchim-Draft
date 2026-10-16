import type { EngineInput, Role, Selection, Side } from '../shared/types';
import { ROLES } from '../shared/types';
import { picks } from '../shared/draft';
import { evidence, prepare } from './evidence';

/** Role evidence and player permission are different from win-rate confidence.
 * Three observed pro appearances can establish a possible role, never a WR bonus.
 */
export function observedRoles(input:EngineInput,id:string,side:Side):Role[] {
 const team=input.teams?.[side===input.draft.side?'ally':'enemy'];
 const totals=new Map<string,number>();
 const total=(source:string)=>{
  if(!totals.has(source))totals.set(source,[...prepare(input).roles.get(id)??[]].reduce((n,r)=>n+(evidence(input,id,r,side)?.groups.find(g=>g.source===source)?.n??0),0));
  return totals.get(source)!;
 };
 const roles=ROLES.filter(role=>{
  const players=team?.players.filter(p=>p.role===role||(p.role==='AUTO'&&!team.players.some(other=>other.role===role)))??[];
  const declared=players.some(p=>p.pool.some(c=>c.championId===id&&(!c.role||c.role===role)&&(c.games>=3||(c.games===0&&p.status==='manual'))));
  if(players.length&&players.every(p=>p.pool.length>0)&&!declared)return false;
  if(declared)return true;
  if(!input.stats.length)return input.champions.find(c=>c.id===id)?.roles.includes(role)??false;
  const groups=evidence(input,id,role,side)?.groups??[];
  return groups.some(g=>g.n>=(g.source==='pro'?3:200)&&(g.source!=='pro'||total(g.source)>=10)&&g.pickRate>=.005&&g.n/Math.max(1,total(g.source))>=.075);
 });
 return roles;
}

/** Exhaustive matching over at most five seats (at most 120 assignments).
 * The current seat remains valid for an explicit off-pool coach choice.
 */
export function teamAssignments(input:EngineInput,side:Side):Selection[][] {
 const selected=picks(input.draft,side);
 if(input.draft.mode!=='pro'||!selected.length)return [selected];
 const options=selected.map(p=>p.roleLocked?[p.role]:[...new Set([p.role,...observedRoles(input,p.championId!,side)])]);
 const results:Selection[][]=[];
 const visit=(at:number,taken:Set<Role>,rows:Selection[])=>{
  if(at===selected.length){results.push(rows);return;}
  for(const role of options[at])if(!taken.has(role))visit(at+1,new Set([...taken,role]),[...rows,{...selected[at],role}]);
 };
 visit(0,new Set(),[]);return results;
}
