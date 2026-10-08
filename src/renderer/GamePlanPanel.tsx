import type { GamePlan } from '../shared/types';

export function GamePlanPanel({plan,language}:{plan:GamePlan;language:'fr'|'en'}) {
  const fr=language==='fr';
  const labels={lanes:fr?'Présence en lane':'Lane presence',objectives:fr?'Accès aux objectifs':'Objective access',teamfight:'Teamfight',sideLane:fr?'Side lanes':'Side lanes',execution:fr?'Simplicité d’exécution':'Execution simplicity'};
  return <section className="game-plan" data-testid="game-plan">
    <div className="section-label">{fr?'PLAN DE JEU':'GAME PLAN'}<span>{plan.partial?(fr?'EN CONSTRUCTION':'IN PROGRESS'):(fr?'5 PICKS':'5 PICKS')}</span></div>
    <h3>{plan.title}</h3><p>{plan.conditions[0]??plan.timing}</p>
    {plan.needs[0]&&<p className="plan-need"><strong>{fr?'À compléter : ':'Next need: '}</strong>{plan.needs[0]}</p>}
    {plan.risks[0]&&<p className="plan-risk"><strong>{fr?'Risque : ':'Risk: '}</strong>{plan.risks[0]}</p>}
    <details><summary>{fr?'Timings et points à vérifier':'Timings and review points'}</summary>
      <p>{plan.timing}</p><div className="plan-axes">{(Object.keys(labels) as (keyof typeof labels)[]).map(key=><div key={key}><span>{labels[key]}</span><meter min={0} max={100} value={plan.axes[key]}/><b>{plan.axes[key]}</b></div>)}</div>
      {[...plan.conditions.slice(1),...plan.needs.slice(1),...plan.risks.slice(1)].map(item=><p key={item}>{item}</p>)}
      <small>{fr?'Lecture qualitative des mécaniques ; priorités de lane à confirmer avec les matchups et les joueurs.':'Qualitative mechanics assessment; confirm lane priority with matchups and players.'} {plan.profiled}/5 {fr?'profils détaillés':'curated profiles'}.</small>
    </details>
  </section>;
}
