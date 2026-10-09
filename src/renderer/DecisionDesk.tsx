import { useEffect } from 'react';
import { AlertTriangle, Shield, Swords, Target } from 'lucide-react';
import type { Champion, Recommendation } from '../shared/types';
import { Portrait } from './ChampionPortrait';

export function DecisionDesk({ list, focused, champions, language, isBan, hasPool, disabled, choose, preview }: {
  list: Recommendation[]; focused?: Recommendation; champions: Map<string, Champion>; language: 'fr' | 'en'; isBan: boolean; hasPool: boolean; disabled: boolean;
  choose: (r: Recommendation) => void; preview: (r: Recommendation) => void;
}) {
  const fr = language === 'fr', first = list[0], remaining = list.slice(1).filter(r => r.championId !== first?.championId).slice(0, 11);
  const alternative = isBan ? [...remaining].sort((a, b) => (b.banImpact?.net ?? 0) - (a.banImpact?.net ?? 0) || b.score - a.score)[0]
    : [...remaining].sort((a, b) => (b.score - b.responseRisk * .2 + b.confidence * .05) - (a.score - a.responseRisk * .2 + a.confidence * .05))[0];
  const pool = remaining.filter(r => r.championId !== alternative?.championId && (isBan ? (r.banScouting?.appliedWeight ?? 0) > 0 : hasPool && r.factors.mastery >= 50) && r.score >= (first?.score ?? 0) - 12)
    .sort((a, b) => isBan ? (b.banScouting!.score * b.banScouting!.confidence) - (a.banScouting!.score * a.banScouting!.confidence) : b.factors.mastery - a.factors.mastery || b.score - a.score)[0];
  const third = pool ?? remaining.find(r => r.championId !== alternative?.championId);
  const options = [
    { title: fr ? 'Recommandé' : 'Recommended', rec: first },
    { title: isBan ? (fr ? 'Impact du ban' : 'Ban impact') : alternative && first && alternative.responseRisk < first.responseRisk ? (fr ? 'Moins exposé' : 'Less exposed') : 'Alternative', rec: alternative },
    { title: pool ? (isBan ? (fr ? 'Pool adverse' : 'Enemy pool') : (fr ? 'Pool connu' : 'Known pool')) : (fr ? 'Autre option' : 'Another option'), rec: third }
  ];
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (disabled || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      const rec = options[Number(e.key) - 1]?.rec;
      if (rec && ['1', '2', '3'].includes(e.key)) { e.preventDefault(); choose(rec); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [list, disabled, hasPool, language, choose]);
  const active = focused ?? first;
  if (!active) return null;
  const champion = champions.get(active.championId);
  const shortcut = options.findIndex(o => o.rec?.championId === active.championId && o.rec?.role === active.role);
  const others = [...options.filter(o => o.rec && (o.rec.championId !== active.championId || o.rec.role !== active.role)), ...list.map(rec => ({ title: 'Alternative', rec }))]
    .filter((o, i, all) => o.rec && o.rec.championId !== active.championId && all.findIndex(p => p.rec?.championId === o.rec?.championId) === i).slice(0, 2);
  const plan = active.context?.parts.find(p => p.key === 'plan')?.score ?? active.factors.composition;
  const synergy = active.context?.parts.find(p => p.key === 'synergy' || p.key === 'bot')?.score ?? active.factors.synergy;
  const scouting = active.banScouting && active.banScouting.appliedWeight > 0 ? active.banScouting.score : undefined;
  const notice = active.lowSample ? (fr ? `Échantillon insuffisant · ${active.games} parties` : `Insufficient sample · ${active.games} games`)
    : active.blind ? (active.blind.coverage < .5 ? (fr ? 'Vis-à-vis inconnu · blind peu documenté' : 'Opposing role unknown · limited blind data') : (fr ? 'Vis-à-vis inconnu · réponses à vérifier' : 'Opposing role unknown · check remaining responses'))
    : isBan && active.banImpact ? `${fr ? 'Alternative adverse' : 'Enemy alternative'} : ${champions.get(active.banImpact.replacement?.championId ?? '')?.name ?? '—'} · ${fr ? 'impact net' : 'net impact'} ${active.banImpact.net > 0 ? '+' : ''}${active.banImpact.net}`
    : active.context?.partial ? (fr ? 'Draft partielle · vérifier le plan et les rôles' : 'Partial draft · check plans and roles') : null;
  return <div className="decision-desk focus-decision" data-testid="decision-desk" aria-busy={disabled}>
    <article className="focus-featured" data-testid="focus-featured" data-champion={active.championId}>
      <div className="focus-featured-main"><Portrait champion={champion} size="featured"/>
        <div className="focus-featured-body"><div className="focus-featured-heading"><div><h3>{champion?.name ?? active.championId}</h3><span className="focus-role">{active.role}</span></div><strong className="focus-featured-score">{active.score.toFixed(1)}<small>/100</small></strong></div>
          <p>{active.summary ?? active.reasons[0]}</p>
          <div className="focus-featured-meta"><span>{fr ? 'Fiabilité' : 'Reliability'} {active.confidence}% · {active.games.toLocaleString()} {fr ? 'parties' : 'games'}</span>{shortcut >= 0 && <kbd>Ctrl + {shortcut + 1}</kbd>}</div>
        </div>
      </div>
      <div className="focus-factors"><div><Target size={17}/><span>{fr ? 'Plan de jeu' : 'Game plan'}<b>{plan.toFixed(0)}/100</b></span></div><div><Swords size={17}/><span>{isBan ? (fr ? 'Pool adverse' : 'Enemy pool') : (fr ? 'Synergie' : 'Synergy')}<b>{isBan ? scouting === undefined ? (fr ? 'Non renseigné' : 'Not provided') : `${scouting.toFixed(0)}/100` : `${synergy.toFixed(0)}/100`}</b></span></div><div><Shield size={17}/><span>{fr ? 'Fiabilité' : 'Reliability'}<b>{active.confidence}%</b></span></div></div>
      {notice && <div className="focus-risk" data-testid="focus-risk"><AlertTriangle size={17}/><span>{notice}</span></div>}
    </article>
    <div className="focus-alternatives">{others.map(option => {
      const rec = option.rec!, index = options.findIndex(o => o.rec?.championId === rec.championId && o.rec.role === rec.role);
      return <button key={`${rec.championId}:${rec.role}`} className="focus-alternative" disabled={disabled} onClick={() => preview(rec)} aria-label={`${fr ? 'Comparer' : 'Compare'} ${champions.get(rec.championId)?.name ?? rec.championId}`}>
        <Portrait champion={champions.get(rec.championId)} size="medium"/><span><strong>{champions.get(rec.championId)?.name ?? rec.championId}</strong><small>{rec.role} · {option.title}</small></span><span className="focus-alternative-score"><b>{rec.score.toFixed(1)}</b>{index >= 0 && <kbd>Ctrl + {index + 1}</kbd>}</span>
      </button>;
    })}</div>
  </div>;
}
