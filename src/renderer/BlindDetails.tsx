import type { BlindAssessment, Champion } from '../shared/types';

export function BlindDetails({ blind, champions, language }: { blind: BlindAssessment; champions: Champion[]; language: string }) {
  const fr = language === 'fr';
  return <section className="role-context-detail" data-testid="blind-detail">
    <div className="role-context-heading"><strong>{fr ? 'Vis-à-vis encore inconnu' : 'Opposing role still unknown'}</strong><b>{blind.score.toFixed(0)}/100</b></div>
    <p>{fr ? `${blind.assessed}/${blind.available} réponses disponibles avec un matchup exploitable.` : `${blind.assessed}/${blind.available} available responses with usable matchup evidence.`}</p>
    {blind.threats.length > 0 && <p><strong>{fr ? 'Réponses à surveiller : ' : 'Watch for: '}</strong>{blind.threats.map(t => champions.find(c => c.id === t.championId)?.name ?? t.championId).join(' · ')}</p>}
    {blind.uncertaintyPenalty > .5 && <p className="muted small-text">{fr ? `Couverture pondérée ${Math.round(blind.coverage * 100)} % · coût d’incertitude ${blind.uncertaintyPenalty.toFixed(1)} dans le critère blind. Les paires absentes ne prouvent pas que le pick est sûr.` : `Weighted coverage ${Math.round(blind.coverage * 100)}% · uncertainty cost ${blind.uncertaintyPenalty.toFixed(1)} in the blind criterion. Missing pairs do not establish a safe pick.`}</p>}
    {blind.developmentPenalty > .5 && <p className="muted small-text">{fr ? `Développement du top : coût qualitatif ${blind.developmentPenalty.toFixed(1)}. Prévoir comment lui assurer les ressources nécessaires pendant la lane.` : `Top development: qualitative cost ${blind.developmentPenalty.toFixed(1)}. Plan how to secure its required lane resources.`}</p>}
    <p className="muted small-text">{fr ? 'Les bans, le Fearless et le pool adverse modifient les réponses possibles. Estimation à partir des résultats de partie ; 50 est neutre. Les probabilités de réponse et pertes de lane ne sont pas mesurées.' : 'Bans, Fearless and the enemy pool change available responses. Estimated from game outcomes; 50 is neutral. Response probabilities and lane losses are not measured.'}</p>
  </section>;
}
