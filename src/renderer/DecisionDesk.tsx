import { useEffect } from 'react';
import { AlertTriangle, ArrowRight, CircleHelp } from 'lucide-react';
import type { Champion, Recommendation, Side } from '../shared/types';
import { RecommendationList } from './RecommendationList';
import { ChampionArtwork } from './ChampionArtwork';
import { Portrait } from './ChampionPortrait';
import { DraftGauge } from './DraftAssessment';
import { translations } from './i18n';

export function DecisionDesk({ list, focused, champions, language, side, isBan, disabled, pending, step, complete, choose, preview, inspect }: {
  list: Recommendation[]; focused?: Recommendation; champions: Map<string, Champion>; language: 'fr' | 'en'; side: Side; isBan: boolean;
  disabled: boolean; pending: boolean; step: number; complete: boolean;
  choose: (r: Recommendation) => void; preview: (r: Recommendation) => void; inspect: (r: Recommendation) => void;
}) {
  const fr = language === 'fr', t = translations(language);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (disabled || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      const rec = list[Number(e.key) - 1];
      if (rec && ['1', '2', '3'].includes(e.key)) { e.preventDefault(); choose(rec); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [list, disabled, choose]);
  const r = complete ? undefined : focused, c = r && champions.get(r.championId);
  const rank = r ? list.findIndex(p => p.championId === r.championId && p.role === r.role) + 1 : 0;
  const roles = r?.viableRoles ?? c?.roles ?? [];
  const badge = roles.length === 1 ? (fr ? 'RÔLE FIXE' : 'FIXED ROLE') : roles.length > 1 ? roles.join(' / ') : (fr ? 'RÔLE À CONFIRMER' : 'CHECK ROLE');
  return <div className="decision-desk face-decisions" data-testid="decision-desk" aria-busy={pending}>
    {r && <article className={`draft-hero ${side}`} data-testid="draft-hero" data-champion={r.championId} aria-label={`${fr ? 'Option affichée' : 'Previewed option'} ${c?.name ?? r.championId}`}>
      <span className="hero-rank">{String(rank).padStart(2, '0')}</span><ChampionArtwork champion={c} kind="card" className={`hero-portrait ${isBan ? "banned-art" : ""}`}/>
      <div className="hero-identity"><h3>{c?.name ?? r.championId}</h3><span>{r.role}</span><span className="fixed-role">{badge}</span><strong className="hero-score">{r.score.toFixed(1).replace('.', fr ? ',' : '.')}</strong><span>{fr ? 'Score de draft /100' : 'Draft score /100'}</span></div>
      <div className="hero-reasons"><div className="hero-gauges">{[[isBan ? (fr ? 'Priorité' : 'Priority') : 'Matchup', isBan ? r.factors.meta : r.factors.matchup], [isBan ? (fr ? 'Pool ciblé' : 'Target pool') : (fr ? 'Synergie' : 'Synergy'), isBan ? r.banScouting?.score ?? r.factors.mastery : r.factors.synergy], [fr ? 'Fiabilité' : 'Reliability', r.confidence]].map(([label, value]) => <div key={label}><span>{label}</span><DraftGauge value={Number(value)} label={String(label)}/><b>{Number(value).toFixed(0)}</b></div>)}</div>
        <p className="hero-summary">{r.summary ?? r.reasons[0]}</p>
        {r.lowSample && <p className="sample-warning"><AlertTriangle size={17}/>{fr ? 'Peu de parties' : 'Few games'} · {r.games}</p>}
        {r.blind && (r.blind.coverage < .5 || r.blind.score < 47) && <p className="sample-warning"><AlertTriangle size={17}/>{r.blind.coverage < .5 ? (fr ? 'Blind peu documenté' : 'Limited blind data') : (fr ? 'Blind exposé' : 'Exposed blind')}</p>}
        <button className="hero-details" onClick={() => inspect(r)} disabled={disabled}><CircleHelp size={17}/>{fr ? 'Détails des données' : 'Data details'}</button>
      </div>
      <button className="primary face-confirm hero-prepare" data-testid="face-confirm" disabled={disabled} onClick={() => choose(r)}>{isBan ? `${t.ban} ${c?.name}` : `${fr ? 'Préparer' : 'Prepare'} ${c?.name}`}<ArrowRight size={20}/></button>
    </article>}
    <RecommendationList list={list} champions={champions} t={t} isPick={!isBan} step={step} pending={pending} complete={complete} skipFirst render={(rec, index) => {
      const active = r?.championId === rec.championId && r.role === rec.role, champ = champions.get(rec.championId);
      return <article key={`${rec.championId}:${rec.role}`} className={`recommendation face-candidate ${active ? 'selected' : ''}`} data-champion={rec.championId}>
        <button className="face-candidate-preview" onClick={() => preview(rec)} disabled={disabled} aria-label={`${fr ? 'Comparer' : 'Compare'} ${champ?.name ?? rec.championId} · ${rec.role}`} aria-pressed={active}>
          <span className="rec-position">{String(index + 1).padStart(2, '0')}</span><Portrait champion={champ} size="candidate" banned={isBan}/>
          <span className="face-candidate-name"><strong>{champ?.name ?? rec.championId}</strong><span>{rec.role}</span></span>
          <span className="rec-score"><strong>{rec.score.toFixed(1).replace('.', fr ? ',' : '.')}</strong></span>
          <span className="compact-reason">{rec.lowSample ? <span className="sample-warning"><AlertTriangle size={16}/>{fr ? 'Peu de parties' : 'Few games'} · {rec.games}</span> : rec.summary ?? rec.reasons[0]}</span>
        </button>
      </article>;
    }}/>
    {r && rank !== 1 && <button className="return-best" onClick={() => preview(list[0])} disabled={disabled}>{fr ? 'Revenir au premier choix' : 'Return to top choice'}<ArrowRight size={16}/></button>}
    {complete && <button className="primary" data-testid="face-confirm" disabled>{fr ? 'Draft terminée' : 'Draft complete'}</button>}
  </div>;
}
