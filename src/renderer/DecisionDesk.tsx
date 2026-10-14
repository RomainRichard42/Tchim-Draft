import { useEffect,useRef,useState } from 'react';
import {PickHoverCard,usePickHover} from './PickHoverCard';
import { AlertTriangle, ArrowRight, CircleHelp, Info,Maximize2 } from 'lucide-react';
import type { Champion, Recommendation, Side } from '../shared/types';
import { RecommendationList } from './RecommendationList';
import { ChampionArtwork } from './ChampionArtwork';
import { Portrait } from './ChampionPortrait';
import { DraftGauge } from './DraftAssessment';
import { translations } from './i18n';

export function DecisionDesk({ list, focused, champions, language, side, isBan, disabled, pending, step, complete, contextKey, choose, preview, inspect,expand }: {
  list: Recommendation[]; focused?: Recommendation; champions: Map<string, Champion>; language: 'fr' | 'en'; side: Side; isBan: boolean;
  disabled: boolean; pending: boolean; step: number; complete: boolean; contextKey:string;
  choose: (r: Recommendation) => void; preview: (r: Recommendation) => void; inspect: (r: Recommendation) => void;
  expand?:()=>void;
}) {
  const desk=useRef<HTMLDivElement>(null),hover=usePickHover(contextKey,!isBan&&!disabled&&!pending),[view,setView]=useState<'list'|'card'>(isBan?'card':'list');
  useEffect(()=>{if(desk.current)desk.current.scrollTop=0;setView(isBan?'card':'list');},[step,isBan]);
  function compare(rec:Recommendation){hover.close();preview(rec);setView('card');desk.current?.scrollTo({top:0,behavior:'smooth'});}
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
  return <div ref={desk} onScroll={event=>{if(event.target===event.currentTarget&&!hover.value?.pinned)hover.close();}} className="decision-desk face-decisions" data-testid="decision-desk" data-view={view} data-side={side} aria-busy={pending}>
    {!isBan&&!complete&&<div className="pick-view-switch" role="group" aria-label={fr?'Vue des choix':'Choice view'}><button className={view==='list'?'active':''} onClick={()=>{hover.close();setView('list');desk.current?.scrollTo({top:0});}}>{fr?'Tous les picks':'All picks'}</button><button className={view==='card'?'active':''} disabled={!r} onClick={()=>{setView('card');desk.current?.scrollTo({top:0});}}>{fr?'Carte détaillée':'Detailed card'}</button>{expand&&<button className="pick-expand" aria-label={fr?'Agrandir les choix':'Expand choices'} title={fr?'Agrandir les choix':'Expand choices'} onClick={()=>{hover.close();expand();}}><Maximize2 size={20}/></button>}</div>}
    {r && view==='card' && <article className={`draft-hero ${side}`} data-testid="draft-hero" data-champion={r.championId} aria-label={`${fr ? 'Option affichée' : 'Previewed option'} ${c?.name ?? r.championId}`} onPointerEnter={event=>hover.show(r,event.currentTarget)} onPointerLeave={hover.leave}>
      <span className="hero-rank">{String(rank).padStart(2, '0')}</span><ChampionArtwork champion={c} kind="card" className={`hero-portrait ${isBan ? "banned-art" : ""}`}/>
      <div className="hero-identity"><h3>{c?.name ?? r.championId}</h3><span>{r.role}</span><span className="fixed-role">{badge}</span><strong className="hero-score">{r.score.toFixed(1).replace('.', fr ? ',' : '.')}</strong><span>{fr ? 'Score de draft /100' : 'Draft score /100'}</span></div>
      <div className="hero-reasons"><div className="hero-gauges">{[[isBan ? (fr ? 'Priorité' : 'Priority') : 'Matchup', isBan ? r.factors.meta : r.factors.matchup], [isBan ? (fr ? 'Pool ciblé' : 'Target pool') : (fr ? 'Synergie' : 'Synergy'), isBan ? r.banScouting?.score ?? r.factors.mastery : r.factors.synergy], [fr ? 'Fiabilité' : 'Reliability', r.confidence]].map(([label, value]) => <div key={label}><span>{label}</span><DraftGauge value={Number(value)} label={String(label)}/><b>{Number(value).toFixed(0)}</b></div>)}</div>
        <p className="hero-summary">{r.summary ?? r.reasons[0]}</p>
        {!isBan&&r.meta&&<div className="opening-evidence" data-testid="opening-evidence"><span>{fr?'MÉTA':'META'} <b>{r.factors.meta.toFixed(0)}/100</b></span>{r.blind&&<span>{fr?'BLIND':'BLIND'} <b>{r.blind.score.toFixed(0)}/100</b></span>}<span>{roles.length>1?`FLEX ${roles.join(' / ')}`:badge}</span></div>}

        {r.lowSample && <p className="sample-warning"><AlertTriangle size={17}/>{fr ? 'Peu de parties' : 'Few games'} · {r.games}</p>}
        {r.blind && (r.blind.coverage < .5 || r.blind.score < 47) && <p className="sample-warning"><AlertTriangle size={17}/>{r.blind.coverage < .5 ? (fr ? 'Blind peu documenté' : 'Limited blind data') : (fr ? 'Blind exposé' : 'Exposed blind')}</p>}
        <button className="hero-details" onClick={() => inspect(r)} disabled={disabled}><CircleHelp size={17}/>{fr ? 'Détails des données' : 'Data details'}</button>
      </div>
        {!isBan&&roles.length>1&&<div className="flex-placements" data-testid="flex-placements"><span>{fr?'Préparer dans quel rôle ?':'Prepare in which role?'}</span><div>{r.alternatives?.filter(option=>roles.includes(option.role)).map(option=><button key={option.role} disabled={disabled} onClick={()=>choose({...r,role:option.role,score:option.score})} aria-label={`${fr?'Préparer':'Prepare'} ${c?.name??r.championId} ${option.role}`}><b>{option.role}</b><span>{option.score.toFixed(1).replace('.',fr?',':'.')}</span></button>)}</div></div>}
      <button className="primary face-confirm hero-prepare" data-testid="face-confirm" disabled={disabled} onClick={() => choose(r)}>{isBan ? `${t.ban} ${c?.name}` : `${fr ? 'Préparer' : 'Prepare'} ${c?.name}`}<ArrowRight size={20}/></button>
    </article>}
    <RecommendationList list={list} champions={champions} t={t} isPick={!isBan} step={step} pending={pending} complete={complete} skipFirst={view==='card'} render={(rec, index) => {
      const active = r?.championId === rec.championId && r.role === rec.role, champ = champions.get(rec.championId);
      return <article key={`${rec.championId}:${rec.role}`} className={`recommendation face-candidate ${active ? 'selected' : ''} ${index===0?'first-choice':''}`} data-champion={rec.championId} onPointerEnter={event=>hover.show(rec,event.currentTarget)} onPointerLeave={hover.leave} onFocusCapture={event=>hover.show(rec,event.currentTarget)}>
        <button className="face-candidate-preview" onClick={() => compare(rec)} disabled={disabled} aria-label={`${fr ? 'Comparer' : 'Compare'} ${champ?.name ?? rec.championId} · ${rec.role}`} aria-pressed={active}>
          <span className="rec-position">{String(index + 1).padStart(2, '0')}</span><Portrait champion={champ} size="candidate" banned={isBan}/>
          <span className="face-candidate-name"><strong>{champ?.name ?? rec.championId}</strong><span>{!isBan&&(rec.viableRoles?.length??0)>1?`FLEX ${rec.viableRoles!.join(' / ')}`:rec.role}</span></span>
          <span className="rec-score"><strong>{rec.score.toFixed(1).replace('.', fr ? ',' : '.')}</strong></span>
          <span className="compact-reason">{rec.lowSample ? <span className="sample-warning"><AlertTriangle size={16}/>{fr ? 'Peu de parties' : 'Few games'} · {rec.games}</span> : rec.summary ?? rec.reasons[0]}</span>
        </button><div className="candidate-actions"><button className="candidate-info" disabled={disabled} aria-label={`${fr?'Infos sur':'Info about'} ${champ?.name??rec.championId} ${rec.role}`} onClick={event=>hover.show(rec,event.currentTarget.closest('article')!,true)}><Info size={20}/></button><button disabled={disabled} className="candidate-choose" aria-label={`${fr?'Préparer':'Prepare'} ${champ?.name??rec.championId} ${rec.role}`} onClick={()=>{hover.close();choose(rec);}}><ArrowRight size={20}/></button></div>
      </article>;
    }}/>
    {r && rank !== 1 && <button className="return-best" onClick={() => compare(list[0])} disabled={disabled}>{fr ? 'Revenir au premier choix' : 'Return to top choice'}<ArrowRight size={16}/></button>}
    {hover.value&&<PickHoverCard hover={hover.value} champions={champions} language={language} side={side} contextKey={contextKey} keep={hover.keep} leave={hover.leave} close={hover.close} details={inspect}/>}
    {complete && <button className="primary" data-testid="face-confirm" disabled>{fr ? 'Draft terminée' : 'Draft complete'}</button>}
  </div>;
}
