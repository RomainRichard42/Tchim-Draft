import { Eye } from 'lucide-react';
import type { Analysis, Champion, Recommendation } from '../shared/types';
import { Portrait } from './ChampionPortrait';

export function FocusResponses({ analysis, focused, champions, language }: { analysis?: Analysis; focused?: Recommendation; champions: Map<string, Champion>; language: 'fr' | 'en' }) {
  const fr = language === 'fr', blind = focused?.blind?.threats, replacement = focused?.banImpact?.replacement;
  const candidates = blind?.length ? blind.map(t => ({ championId: t.championId, role: focused!.role, label: fr ? 'Matchup à surveiller' : 'Matchup to watch' }))
    : [...(replacement ? [{ ...replacement, label: fr ? 'Remplacement après ce ban' : 'Replacement after this ban' }] : []), ...(analysis?.enemies ?? []).map(p => ({ ...p, label: fr ? 'Réponse prioritaire du modèle' : 'Model priority response' }))];
  const rows = candidates.filter((p, i) => candidates.findIndex(other => other.championId === p.championId) === i);
  const row = (p: typeof rows[number]) => <div className="focus-response" key={p.championId}>
    <Portrait champion={champions.get(p.championId)} size="medium"/>
    <div><strong>{champions.get(p.championId)?.name ?? p.championId}</strong><p>{p.label}</p><small>{p.role} · {fr ? 'Encore disponible' : 'Still available'}</small></div>
  </div>;
  return <section className="focus-context-card focus-responses" data-testid="focus-responses">
    <h2><Eye size={20}/>{fr ? 'Réponses adverses à surveiller' : 'Enemy responses to watch'}</h2>
    {rows.slice(0, 2).map(row)}
    {rows.length > 2 && <details><summary>{fr ? 'Voir les autres réponses' : 'More responses'} ({rows.length - 2})</summary>{rows.slice(2).map(row)}</details>}
    {!rows.length && <p className="muted">{!analysis ? (fr ? 'Analyse en cours…' : 'Analyzing…') : fr ? 'Aucune réponse disponible dans les rôles et pools évalués.' : 'No response available in the assessed roles and pools.'}</p>}
    <small className="focus-context-note">{fr ? 'Lecture statistique et qualitative de la draft.' : 'Statistical and qualitative draft assessment.'}</small>
  </section>;
}
