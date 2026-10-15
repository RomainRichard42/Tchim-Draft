import type { Champion,GamePlan } from '../shared/types';
import {Portrait} from './ChampionPortrait';
import { Target } from 'lucide-react';

export function GamePlanPanel({plan,language,champions=[],focus=false}:{plan:GamePlan;champions?:Champion[];language:'fr'|'en';focus?:boolean}) {
  const fr=language==='fr';
  const labels={lanes:fr?'Présence en lane':'Lane presence',objectives:fr?'Accès aux objectifs':'Objective access',teamfight:'Teamfight',sideLane:fr?'Side lanes':'Side lanes',execution:fr?'Simplicité d’exécution':'Execution simplicity'};
  const priorities=[...new Set([...plan.needs.slice(0,1),...plan.conditions])].slice(0,3);
  return <section className={`game-plan ${focus?'focus-context-card focus-plan':''}`} data-testid="game-plan">
    {focus&&<h2><Target size={20}/>{fr?'Notre plan':'Our plan'}</h2>}
    <div className="section-label">{fr?'PLAN DE JEU':'GAME PLAN'}<span>{plan.partial?(fr?'EN CONSTRUCTION':'IN PROGRESS'):(fr?'5 PICKS':'5 PICKS')}</span></div>
    <h3>{plan.title}</h3>{focus?<ol className="focus-plan-priorities">{priorities.map((line,i)=><li key={line}><span>{i+1}</span><p>{line}</p></li>)}</ol>:<p>{plan.conditions[0]??plan.timing}</p>}
    {!focus&&plan.needs[0]&&<p className="plan-need"><strong>{fr?'À compléter : ':'Next need: '}</strong>{plan.needs[0]}</p>}
    {plan.risks[0]&&<p className="plan-risk"><strong>{fr?'Risque : ':'Risk: '}</strong>{plan.risks[0]}</p>}
    {plan.duties&&<><h3 className="composition-duties-title">{fr?'Qui fait quoi':'Who does what'}</h3><div className="composition-duties" data-testid="composition-duties">{plan.duties.map((duty,i)=><article key={duty.kind} className={`composition-duty ${duty.missing?'missing':''}`}><div className="duty-number">{i+1}</div><div><strong>{({priority:fr?'Préparer la priorité':'Prepare priority',jungle:fr?'Accompagner le jungler':'Support the jungler',engage:fr?'Déclencher':'Initiate',follow:fr?'Suivre en dégâts':'Follow with damage',protect:fr?'Protéger':'Protect',side:fr?'Tenir la side':'Hold the side'})[duty.kind]} · {duty.championId?(champions.find(c=>c.id===duty.championId)?.name??duty.championId):(fr?'À COMPLÉTER':'MISSING')}</strong><p>{duty.instruction}</p><details><summary>{fr?'Condition et relais':'Condition and backup'}</summary><p>{duty.condition}</p>{duty.backup&&<p>{fr?'Relais possible':'Possible backup'} : {champions.find(c=>c.id===duty.backup)?.name??duty.backup}</p>}</details></div></article>)}</div></>}
    <details><summary>{fr?'Timings et points à vérifier':'Timings and review points'}</summary>
      <p>{plan.timing}</p><div className="plan-axes">{(Object.keys(labels) as (keyof typeof labels)[]).map(key=><div key={key}><span>{labels[key]}</span><meter min={0} max={100} value={plan.axes[key]}/><b>{plan.axes[key]}</b></div>)}</div>
      {[...plan.conditions.slice(1),...plan.needs.slice(1),...plan.risks.slice(1)].map(item=><p key={item}>{item}</p>)}
      <small>{fr?'Lecture qualitative des mécaniques ; priorités de lane à confirmer avec les matchups et les joueurs.':'Qualitative mechanics assessment; confirm lane priority with matchups and players.'} {plan.profiled}/5 {fr?'profils détaillés':'curated profiles'}.</small>
    </details>
  </section>;
}
