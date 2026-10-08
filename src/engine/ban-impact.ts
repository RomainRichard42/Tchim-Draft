import type { BanImpact, EngineInput, Recommendation, Side } from '../shared/types';
import { fearlessUsed, opposite, picks, used } from '../shared/draft';
import { clamp } from './math';
import { gamePlan } from './gameplan';

// Bounded one-pick counterfactual: remove a champion, compare the opponent's
// best replacement in that role and overall, then subtract our opportunity cost.
// The scope is explicit; this is not a full-series search or win probability.
export function banConsequences(input:EngineInput, banningSide:Side, enemy:Recommendation[], own:Recommendation[]):Map<string,BanImpact> {
  const enemySide=opposite(banningSide), revealed=picks(input.draft,enemySide), ours=picks(input.draft,banningSide);
  const lineup=(members:typeof revealed)=>members.flatMap(p=>input.champions.find(c=>c.id===p.championId)??[]);
  const enemyTeam=lineup(revealed), ownTeam=lineup(ours), enemyRoles=revealed.map(p=>p.role), ownRoles=ours.map(p=>p.role);
  const before=gamePlan(enemyTeam,enemyRoles,ownTeam,ownRoles);
  const threat=(r:Recommendation)=>{
    const c=input.champions.find(c=>c.id===r.championId);
    return r.score+(c&&revealed.length?clamp((gamePlan([...enemyTeam,c],[...enemyRoles,r.role],ownTeam,ownRoles).score-before.score)*.25,-6,6):0);
  };
  const threats=enemy.map(r=>({r,value:threat(r)})).sort((a,b)=>b.value-a.value);
  const best=threats[0]?.value??50, result=new Map<string,BanImpact>();
  const scout=input.teams?.[enemySide===input.draft.side?'ally':'enemy'];
  const locked=new Set([...used(input.draft),...fearlessUsed(input.draft)]);
  for(const candidate of enemy){
    const sameRole=threats.filter(t=>t.r.role===candidate.role&&t.r.championId!==candidate.championId);
    const overall=threats.find(t=>t.r.championId!==candidate.championId);
    const withValue=threats.find(t=>t.r===candidate)!.value;
    const targeted=scout?.players.filter(p=>p.role===candidate.role)??[];
    const poolExhausted=!!scout?.poolOnly&&targeted.length>0&&targeted.every(p=>p.pool.length>0&&p.pool.every(c=>locked.has(c.championId)||c.championId===candidate.championId||!!c.role&&c.role!==candidate.role));
    const roleLoss=sameRole.length?Math.max(0,withValue-sameRole[0].value):poolExhausted?20:0;
    const overallLoss=overall?Math.max(0,best-overall.value):poolExhausted?20:0;
    const enemyLoss=clamp(roleLoss*.7+overallLoss*.3,0,25);
    const oursOnChampion=own.filter(r=>r.championId===candidate.championId);
    const ownLoss=oursOnChampion.reduce((max,r)=>{
      const alternative=own.find(o=>o.role===r.role&&o.championId!==candidate.championId);
      return Math.max(max,alternative?Math.max(0,r.score-alternative.score):15);
    },0);
    result.set(`${candidate.championId}:${candidate.role}`,{replacement:sameRole[0]?{championId:sameRole[0].r.championId,role:sameRole[0].r.role}:null,
      alternatives:new Set(sameRole.map(t=>t.r.championId)).size,enemyLoss:Math.round(enemyLoss*10)/10,ownLoss:Math.round(ownLoss*10)/10,
      net:Math.round(clamp(enemyLoss-ownLoss,-25,25)*10)/10,poolExhausted});
  }
  return result;
}
