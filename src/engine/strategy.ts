import type { EngineInput, Recommendation, Selection, Side, StrategyNode, StrategyReport, StrategyRequest } from '../shared/types';
import { freeRoles, opposite, order, used, fearlessUsed, picks } from '../shared/draft';
import { choicePolicy, choiceRolePolicy } from './policy';
import { evaluateMatch } from './evaluation';
import { clamp } from './math';
import { appendWithRoleChanges } from '../shared/placements';

/** A ban horizon must cross actual picks. Include the next pick of each camp
 * and finish its consecutive double pick rather than stopping on empty boards.
 */
export function decisionHorizon(input:EngineInput,depth:number):number {
 const sequence=order(input.draft),start=input.draft.history.length;
 let end=Math.min(sequence.length,start+depth);
 if(sequence[start]?.kind!=='ban')return end;
 const seen=new Set<Side>(),perspective=sequence[start]?.side;
 let enemyPicked=false;
 for(let i=start+1;i<sequence.length;i++){
  if(sequence[i].kind==='pick'){seen.add(sequence[i].side);if(sequence[i].side!==perspective)enemyPicked=true;}
  if(seen.size===2&&enemyPicked&&sequence[i].kind==='pick'&&sequence[i].side===perspective){
   let last=i+1;while(sequence[last]?.kind==='pick'&&sequence[last].side===sequence[i].side)last++;
   end=Math.max(end,last);break;
  }
 }
 return end;
}

export type CandidateProvider=(input:EngineInput,side:Side,kind:'pick'|'ban',restrict?:EngineInput['draft']['targetRole'])=>Recommendation[];
/** Preserve the full meta/blind/pool score. A partial composition is not a finished 5v5.
 * Branch comparisons give a bounded adjustment relative to the other searched choices.
 */
export function strategicPickScore(input:EngineInput,rec:Recommendation,after:number,reference:number):number {
 const revealed=picks(input.draft,'blue').length+picks(input.draft,'red').length;
 return clamp(rec.score+clamp((after-reference)*(.4+revealed*.09),-10,10));
}
export function futureCost(input:EngineInput,selection:Selection,side:Side):number {
 const series=input.draft.series;if(series?.fearless===false||series?.format==='single'||!series||!selection.role||!selection.championId)return 0;
 const remaining=(series.format==='bo3'?3:5)-series.games.length-1;if(remaining<=0)return 0;
 const players=input.teams?.[side===input.draft.side?'ally':'enemy'].players.filter(p=>p.role===selection.role)??[];
 if(!players.length)return 0;
 const unavailable=new Set([...fearlessUsed(input.draft),...used(input.draft)]);
 const alternatives=new Set(players.flatMap(p=>p.pool.filter(c=>(!c.role||c.role===selection.role)&&!unavailable.has(c.championId)&&c.championId!==selection.championId).map(c=>c.championId)));
 // Soft warning only: declared pools may be incomplete; future match wins are never assumed.
 return Math.max(0,remaining-alternatives.size)*1.5;
}
export function exploreStrategy(input:EngineInput,provider:CandidateProvider,request?:StrategyRequest):StrategyReport {
 const started=Date.now(),draft=request?.draft??input.draft,depth=request?.depth??input.settings.strategyDepth??3,risk=(request?.risk??input.settings.strategyRisk??35)/100;
 input={...input,draft};const seq=order(draft),action=seq[draft.history.length],perspective=action?.side??draft.side;
 const pins=new Map(request?.pins.map(p=>[p.index,p.selection])??[]),reserved=(state:EngineInput,side:Side,kind:'pick'|'ban',restrict:EngineInput['draft']['targetRole']='AUTO')=>{
  const at=state.draft.history.length,ids=new Set([...pins].filter(([i])=>i>at).flatMap(([,p])=>p.championId?[p.championId]:[])),roles=new Set([...pins].filter(([i])=>i>at&&seq[i]?.side===side&&seq[i]?.kind==='pick').map(([,p])=>p.role));
  return provider(state,side,kind,restrict).filter(r=>!ids.has(r.championId)&&(kind==='ban'||!roles.has(r.role)&&!r.reassignments?.some(p=>roles.has(p.role))));
 };
 const current=action?reserved(input,perspective,action.kind,input.draft.targetRole):[];
 const roots=request?.roots.length?request.roots.map(selection=>current.find(r=>r.championId===selection.championId&&(action?.kind==='ban'||r.role===selection.role))).filter((r):r is Recommendation=>!!r):current;
 const championIds=[...new Set(roots.map(r=>r.championId))],cap=request?12:8,chosenIds=new Set(championIds.slice(0,Math.min(4,cap)));
 // Preserve role, flex and scouting alternatives within the bounded beam.
 for(const role of freeRoles(input.draft,action?.kind==='ban'?opposite(perspective):perspective)){
  const rec=roots.find(r=>r.role===role);if(rec&&chosenIds.size<cap)chosenIds.add(rec.championId);
 }
 for(const rec of [...roots.filter(r=>(r.viableRoles?.length??0)>1),...roots.filter(r=>r.banScouting&&r.banScouting.appliedWeight>0).sort((a,b)=>(b.banScouting?.score??0)-(a.banScouting?.score??0)),...roots])if(chosenIds.size<cap)chosenIds.add(rec.championId);
 // Keep every eligible role of each shortlisted champion, instead of dropping flex placements.
 const selected=roots.filter(r=>chosenIds.has(r.championId)),memo=new Map<string,ReturnType<typeof walk>>();
 let evaluated=0,limited=championIds.length>cap,rootStart=0;const maxNodes=request?900:360,rootBudget=Math.max(16,Math.floor(maxNodes/Math.max(1,selected.length))),end=decisionHorizon(input,depth);
 const value=(state:EngineInput)=>{const v=evaluateMatch(state).value;return perspective==='blue'?v:-v;};
 const append=(state:EngineInput,selection:Selection,rec?:Recommendation)=>{
  const at=state.draft.history.length;
  return {...state,draft:appendWithRoleChanges(state.draft,{...selection,...(pins.has(at)&&selection.role?{roleLocked:true}:{})},seq[at].kind==='pick'?rec?.reassignments:[])};
 };
 function walk(state:EngineInput,left:number):{expected:number;worst:number;after:number;nodes:StrategyNode[]} {
  state.checkCancelled?.();
  const now=value(state),at=state.draft.history.length,next=seq[at];
  if(!left||!next)return {expected:now,worst:now,after:now,nodes:[]};
  const narrow=evaluated-rootStart>=rootBudget;if(narrow)limited=true;
  const key=JSON.stringify([state.draft.history,left]);const cached=memo.get(key);if(cached)return cached;
  const options=reserved(state,next.side,next.kind),pin=pins.get(at);
  let chosen=pin?options.filter(r=>r.championId===pin.championId&&(next.kind==='ban'||r.role===pin.role)):options;
  // Explicit locks may be off-pool; validateSimulation checks their legality before this call.
  if(pin&&!chosen.length&&pin.championId){chosen=[{...current[0],championId:pin.championId,role:pin.role??'MID',score:50}];}
  const policy=choicePolicy(state,next.side,chosen),probability=new Map(choiceRolePolicy(state,next.side,chosen).map(p=>[p.championId+':'+p.role,p.preference]));
  const ours=next.side===perspective;
  if(!pin){const bestIds=new Set([...new Set(chosen.map(r=>r.championId))].slice(0,next.kind==='ban'?1:2)),enemyIds=new Set([...policy.slice(0,2).map(p=>p.championId),...chosen.slice(0,1).map(r=>r.championId)]);chosen=chosen.filter(r=>(ours||next.kind==='ban'?bestIds:enemyIds).has(r.championId));}
  if(narrow&&!pin)chosen=chosen.slice(0,1); // Still reach the same pick milestone for every root.
  if(!chosen.length){if(next.kind==='ban'&&(!pin||pin.championId===null))return walk(append(state,{championId:null}),left-1);return {expected:now,worst:now,after:now,nodes:[{index:at,side:next.side,kind:next.kind,selection:{championId:null},preference:null,value:now,children:[],blocked:true}]};}
  const outcomes=chosen.map(r=>{evaluated++;const selection=next.kind==='ban'?{championId:r.championId}: {championId:r.championId,role:r.role};const branch=walk(append(state,selection,r),left-1);return {branch,node:{index:at,side:next.side,kind:next.kind,selection,reassignments:next.kind==='pick'?r.reassignments:undefined,preference:ours||next.kind==='ban'?null:probability.get(r.championId+':'+r.role)??0,value:branch.after,children:branch.nodes} as StrategyNode};});
  let worst=Math.min(...outcomes.map(o=>o.branch.worst));
  let expected:number,after:number;
  if(ours){const best=outcomes.reduce((a,b)=>a.branch.after>=b.branch.after?a:b);expected=best.branch.expected;after=best.branch.after;worst=best.branch.worst;}
  else{const sum=outcomes.reduce((s,o)=>s+(o.node.preference??1),0);expected=outcomes.reduce((s,o)=>s+o.branch.expected*(o.node.preference??1),0)/Math.max(.0001,sum);after=expected*(1-risk)+worst*risk;}
  const result={expected,worst,after,nodes:outcomes.map(o=>o.node)};memo.set(key,result);return result;
 }
 const searched=selected.map(r=>{
  rootStart=evaluated;
  const selection=action?.kind==='ban'?{championId:r.championId}:{championId:r.championId,role:r.role},state=append(input,selection,r),immediate=value(state),branch=walk(state,end-draft.history.length-1);
  const cost=action?.kind==='pick'?futureCost(input,selection,perspective):0;
  // Ban gain is a relative counterfactual, including the cost of denying our own option.
  const after=branch.after-cost;
  const root:StrategyNode={index:draft.history.length,selection,reassignments:action?.kind==='pick'?r.reassignments:undefined,side:perspective,kind:action!.kind,preference:null,value:after,children:branch.nodes};
  const outlook={immediate,expected:branch.expected,worst:branch.worst,after,futureCost:cost,searched:true,nodes:[root]};
  const fr=input.settings.language==='fr',reason=(fr?'Après les réponses explorées : ':'After explored replies: ')+after.toFixed(1)+(fr?' points d’avantage ; risque ':' advantage points; risk ')+Math.max(0,branch.expected-branch.worst).toFixed(1)+(cost?(fr?' · Réserve Fearless à protéger':' · Preserve Fearless reserve'):'');
  const scouting=action?.kind==='ban'&&(r.banScouting?.appliedWeight??0)>0;
  return {...r,outlook,reasons:scouting?[r.reasons[0],reason,...r.reasons.slice(1)]:[reason,...r.reasons],summary:scouting||r.blind&&r.blind.score<47?r.summary:reason};
 });
 const bestByChampion=new Map<string,number>();for(const r of searched)bestByChampion.set(r.championId,Math.max(bestByChampion.get(r.championId)??-Infinity,r.outlook.after));
 const reference=bestByChampion.size?[...bestByChampion.values()].reduce((n,v)=>n+v,0)/bestByChampion.size:0;
 const rated=searched.map(r=>({...r,score:Math.round((action?.kind==='ban'?clamp(r.score+clamp((r.outlook.after-reference)*1.3,-10,10)):strategicPickScore(input,r,r.outlook.after,reference))*10)/10})).sort((a,b)=>b.score-a.score||a.championId.localeCompare(b.championId));
 const seen=new Set<string>(),options=rated.filter(r=>!seen.has(r.championId)&&!!seen.add(r.championId)).map(r=>({...r,alternatives:rated.filter(other=>other.championId===r.championId).map(other=>({role:other.role,score:other.score,blindScore:other.blind?.score,after:other.outlook.after,reassignments:other.reassignments}))}));
 const fr=input.settings.language==='fr';
 return {horizon:end-draft.history.length,roots:options.length,evaluated,limited,elapsedMs:Date.now()-started,perspective,options,warning:fr?'Exploration limitée aux options présélectionnées. Les bans suivants suivent une continuation gloutonne jusqu’aux picks des deux camps. Les fréquences de réponse sont heuristiques ; cet indice n’est pas une probabilité de victoire.':'Search is restricted to shortlisted options. Subsequent bans use a greedy continuation through both teams’ picks. Reply preferences are heuristic; this index is not a win probability.'};
}
