import { useEffect } from 'react';
import { motion } from 'motion/react';
import { ChampionArtwork } from './ChampionArtwork';
import { AnimatedScore } from './AnimatedScore';
import { AlertTriangle, Check, CircleHelp } from 'lucide-react';
import type { Champion, Recommendation } from '../shared/types';
import { RecommendationList } from './RecommendationList';
import { translations } from './i18n';

export function DecisionDesk({ list, focused, champions, language, isBan, disabled, pending, step, complete, choose, preview, inspect }: {
  list: Recommendation[]; focused?: Recommendation; champions: Map<string, Champion>; language: 'fr' | 'en'; isBan: boolean;
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
  return <div className="decision-desk face-decisions" data-testid="decision-desk" aria-busy={pending}>
    <RecommendationList list={list} champions={champions} t={t} isPick={!isBan} step={step} pending={pending} complete={complete} render={(rec, index) => {
      const active = focused?.championId === rec.championId && focused.role === rec.role;
      const warning = rec.lowSample ? (fr ? `Échantillon insuffisant · ${rec.games} parties` : `Insufficient sample · ${rec.games} games`)
        : rec.blind ? (rec.blind.coverage < .5 ? (fr ? 'Blind peu documenté' : 'Limited blind data') : rec.blind.score < 47 ? (fr ? 'Blind exposé' : 'Exposed blind') : (fr ? 'Vis-à-vis encore inconnu' : 'Opposing role still unknown')) : null;
      return <motion.article layout={index<60?"position":false} transition={{duration:.24}} key={`${rec.championId}:${rec.role}`} className={`recommendation face-candidate ${active ? 'selected' : ''}`} data-champion={rec.championId}>
        <button className="face-candidate-preview" onClick={() => preview(rec)} disabled={disabled} aria-label={`${fr ? 'Comparer' : 'Compare'} ${champions.get(rec.championId)?.name ?? rec.championId} · ${rec.role}`} aria-pressed={active}>
          <span className="rec-position">{String(index + 1).padStart(2, '0')}</span><ChampionArtwork champion={champions.get(rec.championId)} kind="card" className="face-candidate-art"/>
          <span className="face-candidate-name"><strong>{champions.get(rec.championId)?.name ?? rec.championId}</strong><span className="role-tag">{rec.role}</span></span>
          <span className="rec-score"><strong><AnimatedScore value={rec.score}/></strong><span>/100</span></span>
        </button>
        <div className="face-candidate-caption"><span className={warning ? 'face-warning' : 'face-candidate-status'}>{warning ? <AlertTriangle size={16}/> : active ? <Check size={16}/> : null}{warning ?? (index === 0 ? (fr ? 'Recommandé par le moteur' : 'Engine recommendation') : active ? (fr ? 'Option affichée' : 'Previewed option') : (fr ? 'Autre option' : 'Another option'))}</span>
          <div className="rec-meta"><button disabled={disabled} onClick={() => { preview(rec); inspect(rec); }} aria-label={`${t.why} ${champions.get(rec.championId)?.name}`}><CircleHelp size={17}/><span>{fr ? 'Pourquoi' : 'Why'}</span></button>{index < 3 && <kbd>Ctrl+{index + 1}</kbd>}</div>
        </div>
      </motion.article>;
    }}/>
  </div>;
}
