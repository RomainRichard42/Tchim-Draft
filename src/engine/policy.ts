import type { EngineInput, Prediction, Recommendation, Side } from '../shared/types';
import { evidence } from './evidence';

/** Choice likelihood is a preference heuristic. It does not estimate game outcomes. */
export function choicePolicy(input:EngineInput,side:Side,candidates:Recommendation[]):Prediction[] {
 const team=input.teams?.[side===input.draft.side?'ally':'enemy'];
 const rated=candidates.map(rec=>{
  const players=team?.players.filter(p=>p.role===rec.role||p.role==='AUTO')??[];
  const observations=players.flatMap(p=>p.pool.filter(c=>c.championId===rec.championId&&(!c.role||c.role===rec.role)).map(c=>({p,c})));
  const total=players.reduce((v,p)=>v+p.pool.filter(c=>!c.role||c.role===rec.role).reduce((s,c)=>s+c.games,0),0);
  const games=observations.reduce((v,o)=>v+o.c.games,0),declared=observations.some(o=>o.p.status==='manual');
  const meta=evidence(input,rec.championId,rec.role,side),confidence=total/(total+80);
  const pool=(games+2)/(total+Math.max(10,players.reduce((s,p)=>s+p.pool.length,0))*2);
  const comfort=observations.length?Math.max(...observations.map(o=>o.c.comfort??3))/5:.4;
  const popularity=meta?.pickRate??0;
  const mass=confidence*pool*(.8+comfort*.4)+(1-confidence)*(popularity>0?popularity:.005)+(declared&&games===0?.04:0);
  return {...rec,mass,basis:(games>0||declared?'pool':meta?'meta':'fallback') as Prediction['basis']};
 });
 // A flex champion consumes one pick, so combine role probabilities before selecting its likely role.
 const unique=new Map<string,typeof rated[number]>();
 for(const rec of rated){const old=unique.get(rec.championId);if(!old)unique.set(rec.championId,rec);else {const best=rec.mass>old.mass?rec:old;unique.set(rec.championId,{...best,mass:old.mass+rec.mass});}}
 const ordered=[...unique.values()].sort((a,b)=>b.mass-a.mass||b.score-a.score||a.championId.localeCompare(b.championId));
 const total=ordered.reduce((v,r)=>v+r.mass,0);
 return ordered.map(r=>({championId:r.championId,role:r.role,preference:total?r.mass/total:0,basis:r.basis,quality:r.score}));
}
