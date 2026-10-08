import { useEffect } from 'react';
import type { Champion, Recommendation } from '../shared/types';

export function DecisionDesk({list,champions,language,isBan,hasPool,disabled,choose}:{list:Recommendation[];champions:Map<string,Champion>;language:'fr'|'en';isBan:boolean;hasPool:boolean;disabled:boolean;choose:(r:Recommendation)=>void}) {
  const fr=language==='fr', first=list[0], remaining=list.slice(1,12);
  const alternative=isBan?[...remaining].sort((a,b)=>(b.banImpact?.net??0)-(a.banImpact?.net??0)||b.score-a.score)[0]:[...remaining].sort((a,b)=>(b.score-b.responseRisk*.2+b.confidence*.05)-(a.score-a.responseRisk*.2+a.confidence*.05))[0];
  const pool=remaining.filter(r=>r.championId!==alternative?.championId&&(isBan?(r.banScouting?.appliedWeight??0)>0:hasPool&&r.factors.mastery>=50)&&r.score>=(first?.score??0)-12)
    .sort((a,b)=>isBan?(b.banScouting!.score*b.banScouting!.confidence)-(a.banScouting!.score*a.banScouting!.confidence):b.factors.mastery-a.factors.mastery||b.score-a.score)[0];
  const options=[{title:fr?'Recommandé':'Recommended',rec:first},{title:isBan?(fr?'Impact du ban':'Ban impact'):alternative&&first&&alternative.responseRisk<first.responseRisk?(fr?'Moins exposé':'Less exposed'):(fr?'Alternative':'Alternative'),rec:alternative},{title:isBan?(fr?'Pool adverse':'Enemy pool'):(fr?'Pool connu':'Known pool'),rec:pool}];
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{if(disabled||!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey||['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName))return;
      const rec=options[Number(e.key)-1]?.rec;if(rec&&['1','2','3'].includes(e.key)){e.preventDefault();choose(rec);}};
    window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
  },[list,disabled,hasPool,language]);
  if(!first)return null;
  return <div className="decision-desk" data-testid="decision-desk" aria-busy={disabled}>{options.map((option,i)=><button key={i} className={`decision-option ${i===0?'preferred':''}`} disabled={disabled||!option.rec} onClick={()=>option.rec&&choose(option.rec)} aria-label={`${option.title} · ${option.rec?champions.get(option.rec.championId)?.name??option.rec.championId:fr?'indisponible':'unavailable'}`}>
    <span className="decision-label">{option.title}<kbd>{i+1}</kbd></span>
    <strong>{option.rec?champions.get(option.rec.championId)?.name??option.rec.championId:'—'} {option.rec&&<small>{option.rec.role}</small>}</strong>
    <span>{option.rec?`${option.rec.score.toFixed(1)}/100${option.rec.lowSample?(fr?' · peu de données':' · limited data'):''}`:fr?'Aucune option distincte':'No distinct option'}</span>
  </button>)}<small className="decision-shortcuts">{fr?'Ctrl + 1 / 2 / 3 pour préparer un choix · validation manuelle':'Ctrl + 1 / 2 / 3 to prepare a choice · manual confirmation'}</small></div>;
}
