import type { DraftContext } from '../shared/types';

export function RoleContextDetails({ context, language }: { context: DraftContext; language: string }) {
  const fr = language === 'fr';
  return <section className="role-context-detail" data-testid="role-context-detail">
    <div className="role-context-heading"><strong>{fr ? 'Adaptation à la draft' : 'Draft fit'} · {context.role}</strong><b>{context.score.toFixed(0)}/100</b></div>
    <p className="muted small-text">{fr ? 'Les poids suivent les picks révélés et vos réglages. Les informations absentes restent neutres.' : 'Weights follow revealed picks and your settings. Missing information stays neutral.'}</p>
    {context.parts.map(part => <div className="role-context-part" key={part.key} data-context-part={part.key}>
      <span>{part.label}<small>{fr ? 'Poids' : 'Weight'} {part.weight.toFixed(0)} % · {fr ? 'base' : 'base'} {part.baseWeight} %{part.coverage < 1 ? ` · ${fr ? 'partiel' : 'partial'}` : ''}</small></span>
      <progress max="100" value={part.score} aria-label={part.label}/><b>{part.score.toFixed(0)}</b>
    </div>)}
    {context.role === 'SUPPORT' && <p className="muted small-text">{fr ? 'Le 2v2 combine les matchups des deux duos et la synergie ADC/support. Cette synergie est comptée dans ce bloc uniquement. Lecture estimée, sans mesure directe de domination de lane.' : 'The 2v2 combines both duos’ matchups and ADC/support synergy. That synergy is counted in this block only. Estimated assessment, without direct lane-dominance measurements.'}</p>}
  </section>;
}
