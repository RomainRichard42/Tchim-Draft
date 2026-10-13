import { ArrowRight, AlertTriangle } from 'lucide-react';
import type { Analysis, Champion, Lang, Side } from '../shared/types';
import { Portrait } from './ChampionPortrait';

export function DraftGauge({ value, label }: { value: number; label: string }) {
  return <span className="draft-gauge" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }}/></span>;
}

export function DraftComposition({ analysis, language, details }: { analysis?: Analysis; language: Lang; details: () => void }) {
  const fr = language === 'fr', c = analysis?.ally, plan = analysis?.plans.ally;
  return <aside className="draft-assessment composition-summary" data-testid="composition-summary">
    <h2>{fr ? 'Notre composition' : 'Our composition'}</h2>
    {c && plan ? <><p className="plan-title">{plan.title} · {c.count}/5</p><p className="assessment-note">{plan.partial ? (fr ? 'Plan provisoire' : 'Provisional plan') : (fr ? 'Profil estimé' : 'Estimated profile')}</p>
      <div className="damage-split"><span>AD <strong>{Math.round(c.adShare * 100)} %</strong></span><span>AP <strong>{Math.round((1 - c.adShare) * 100)} %</strong></span></div>
      <div className="composition-axes">{[[fr ? 'Frontline' : 'Frontline', c.frontline], [fr ? 'Engage' : 'Engage', c.engage], [fr ? 'Protection' : 'Peel', c.peel], ['Poke', c.poke]].map(([label, value]) => <div key={label} title={`${label} : ${value}/15`}><span>{label}</span><DraftGauge label={`${label} /15`} value={Number(value) / 15 * 100}/><b>{Number(value).toFixed(0)}</b></div>)}</div>
      <p>{fr ? 'Courbe de puissance estimée' : 'Estimated power curve'}</p><div className="power-columns">{[[fr ? 'Début' : 'Early', c.early], [fr ? 'Fin' : 'Late', c.scaling]].map(([label, value]) => <div key={label}><b>{Number(value).toFixed(0)}</b><span className="power-column"><span style={{ height: `${Math.max(0, Math.min(100, Number(value)))}%` }}/></span><span>{label}</span></div>)}</div>
      <p className="plan-need">{plan.needs[0] ?? plan.conditions[0] ?? plan.timing}</p>
    </> : <p>{fr ? 'Le plan se construit avec les picks révélés.' : 'The plan develops as picks are revealed.'}</p>}
    <button className="assessment-details" onClick={details}>{fr ? 'Plans des équipes' : 'Team plans'}<ArrowRight size={18}/></button>
  </aside>;
}

export function DraftResponses({ analysis, champions, language, enemySide, pending, details }: { analysis?: Analysis; champions: Map<string, Champion>; language: Lang; enemySide: Side; pending: boolean; details: () => void }) {
  const fr = language === 'fr', responses = analysis?.enemies.slice(0, 3) ?? [], risk = analysis?.plans.ally.risks[0];
  return <aside className="draft-assessment enemy-responses" data-testid="enemy-responses" aria-busy={pending}>
    <h2>{fr ? 'Réponse adverse' : 'Enemy response'}</h2><p className="assessment-note">{fr ? 'Préférences estimées · pas des chances de victoire' : 'Estimated preferences · not win chances'}</p>
    <div className="enemy-response-list">{responses.map(p => <div key={`${p.championId}:${p.role}`}><Portrait champion={champions.get(p.championId)} size="response"/><span><strong>{champions.get(p.championId)?.name ?? p.championId}</strong><span>{p.role}</span></span><b>{Math.round(p.preference * 100)} %</b><DraftGauge value={p.preference * 100} label={`${champions.get(p.championId)?.name ?? p.championId} ${fr ? 'préférence' : 'preference'}`}/></div>)}</div>
    {!responses.length && <p>{fr ? 'Aucune réponse disponible pour ce contexte.' : 'No response available in this context.'}</p>}
    {risk && <div className="draft-threat"><AlertTriangle size={23}/><div><strong>{fr ? 'À anticiper' : 'Watch for'}</strong><p>{risk}</p></div></div>}
    <button className="assessment-details" onClick={details}>{fr ? 'Explorer les réponses' : 'Explore responses'}<ArrowRight size={18}/></button>
  </aside>;
}
