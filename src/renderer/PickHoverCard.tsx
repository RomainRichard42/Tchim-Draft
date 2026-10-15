import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {AlertTriangle,Check,Info,LoaderCircle,X} from 'lucide-react';
import type {Champion,PickInsight,PickInteraction,Recommendation,Side} from '../shared/types';
import {Portrait} from './ChampionPortrait';
type Hover={recommendation:Recommendation;anchor:DOMRect;pinned:boolean};
export function usePickHover(contextKey:string,enabled:boolean){
 const [value,setValue]=useState<Hover|null>(null),opening=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),closing=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const clear=()=>{clearTimeout(opening.current);clearTimeout(closing.current);};
 const close=()=>{clear();setValue(null);};
 useEffect(()=>{close();},[contextKey,enabled]);
 useEffect(()=>()=>clear(),[]);
 function show(recommendation:Recommendation,target:HTMLElement,pinned=false){if(!enabled)return;clear();const anchor=target.getBoundingClientRect();if(pinned)setValue({recommendation,anchor,pinned:true});else opening.current=setTimeout(()=>setValue(current=>current?.pinned?current:{recommendation,anchor,pinned:false}),220);}
 const leave=()=>{clearTimeout(opening.current);closing.current=setTimeout(()=>setValue(current=>current?.pinned?current:null),220);};
 const keep=()=>{clearTimeout(closing.current);};
 return {value,show,leave,keep,close};
}
export function PickHoverCard({hover,champions,language,side,contextKey,keep,leave,close,details,review}:{hover:Hover;champions:Map<string,Champion>;language:'fr'|'en';side:Side;contextKey:string;keep:()=>void;leave:()=>void;close:()=>void;details:(recommendation:Recommendation)=>void;review?:(recommendation:Recommendation)=>void}){
 const fr=language==='fr',tr=(a:string,b:string)=>fr?a:b,r=hover.recommendation,champion=champions.get(r.championId),box=useRef<HTMLElement>(null);
 const [insight,setInsight]=useState<PickInsight>(),[error,setError]=useState(false),[position,setPosition]=useState({left:12,top:12});
 const key=`${contextKey}|${r.championId}|${r.role}|${side}`;
 useEffect(()=>{let live=true;setInsight(undefined);setError(false);void window.draftApi.pickInsight({championId:r.championId,role:r.role,side}).then(value=>{if(live)setInsight(value);}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[key]);
 useLayoutEffect(()=>{const place=()=>{const rect=box.current?.getBoundingClientRect();if(!rect)return;const margin=12,width=rect.width,height=rect.height,a=hover.anchor;let left=a.right+12;if(left+width>innerWidth-margin)left=a.left-width-12;if(left<margin)left=Math.max(margin,innerWidth-width-margin);setPosition({left:Math.min(left,innerWidth-width-margin),top:Math.max(margin,Math.min(a.top,innerHeight-height-margin))});};place();const observer=new ResizeObserver(place);if(box.current)observer.observe(box.current);window.addEventListener('resize',place);return()=>{observer.disconnect();window.removeEventListener('resize',place);};},[hover.anchor]);
 useEffect(()=>{const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();close();}};window.addEventListener('keydown',escape,true);return()=>window.removeEventListener('keydown',escape,true);},[close]);
 function group(title:string,rows:PickInteraction[],kind:'risk'|'good'|'synergy',empty:string){return <section className={`pick-hover-group ${kind}`}><h3>{title}</h3>{rows.length?rows.map(row=><div className="pick-hover-pair" key={`${row.championId}:${row.role}`}><Portrait champion={champions.get(row.championId)} size="scouting"/><div><strong>{champions.get(row.championId)?.name??row.championId}</strong><span>{row.role} · {row.present?tr(kind==='synergy'?'Allié révélé':'Ennemi révélé',kind==='synergy'?'Revealed ally':'Revealed enemy'):row.inPool?tr('Pool renseigné','Recorded pool'):tr('Option disponible','Available option')}</span><span>{row.scope==='lane'?tr('Même rôle','Same role'):tr('Composition','Composition')} · {row.games.toLocaleString(language)} {tr('parties pondérées','weighted games')}</span></div><div className="pick-hover-effect"><b>{row.effect>0?'+':''}{row.effect.toFixed(1)} {tr('pts','pts')}</b><span>{row.confidence}% {tr('fiabilité','reliability')}</span></div></div>):<p className="pick-hover-empty">{empty}</p>}</section>;}
 return createPortal(<aside ref={box} className={`pick-hover-card ${side}`} style={position} data-testid="pick-hover-card" data-champion={r.championId} data-pinned={hover.pinned} role="dialog" aria-modal="false" aria-label={`${champion?.name??r.championId} · ${tr('Informations du pick','Pick information')}`} onPointerEnter={keep} onPointerLeave={leave} onFocusCapture={keep}>
  <header><Portrait champion={champion} size="medium"/><div><h2>{champion?.name??r.championId} · {r.role}</h2><span>{tr('Score dans cette draft','Score in this draft')} {r.score.toFixed(1)}/100</span></div><button aria-label={tr('Fermer les informations','Close pick information')} onClick={close}><X size={18}/></button></header>
  {!insight&&!error&&<p className="pick-hover-loading" role="status"><LoaderCircle size={18}/>{tr('Lecture des matchups et synergies…','Loading matchups and synergies…')}</p>}
  {error&&<p role="status">{tr('Informations indisponibles pour le moment. Les détails du score restent consultables.','Information is unavailable right now. Score details remain available.')}</p>}
  {insight&&<><div className="pick-hover-fit"><section><h3><Check size={17}/>{tr('Pourquoi le jouer ici','Why pick it here')}</h3>{insight.strengths.map(reason=><p key={reason}>{reason}</p>)}</section><section><h3><AlertTriangle size={17}/>{tr('Ce qui peut mal se passer','What can go wrong')}</h3>{insight.risks.length?insight.risks.map(reason=><p key={reason}>{reason}</p>):<p>{tr('Aucune faiblesse nette documentée dans ce contexte ; les prochains choix peuvent changer cette lecture.','No clear weakness documented in this context; later choices can change this assessment.')}</p>}</section></div>
   {group(tr('Qui peut contrer ce pick','Who can counter this pick'),insight.counters,'risk',tr('Aucun contre suffisamment documenté parmi les options disponibles.','No counter has enough evidence among the available options.'))}
   {group(tr('Ce pick est bon contre','This pick is good against'),insight.favourable,'good',tr('Pas de matchup favorable assez documenté ici.','No favourable matchup has enough evidence here.'))}
   {group(tr('Avec qui il fonctionne','Who it works with'),insight.synergies,'synergy',tr('Pas de synergie positive assez documentée ici.','No positive synergy has enough evidence here.'))}
   {!!insight.mechanics.length&&<section className="pick-hover-mechanics"><h3>{tr('Interactions de sorts · sous conditions','Spell interactions · conditional')}</h3>{insight.mechanics.map((item,index)=><p key={index} className={item.direction}><strong>{item.reason}</strong><span>{item.condition}</span></p>)}</section>}
   <footer>{insight.windows.map(window=><span key={window.source}>{window.source==='solo'?'Lolalytics Master+':'gol.gg'} · {window.patches.join(' / ')||'—'}</span>)}{insight.warnings.map(warning=><p key={warning}>{warning}</p>)}<p>{tr('Les points indiquent un effet ajusté pour le champion affiché, pas un winrate brut.','Points indicate an adjusted effect for the displayed champion, not a raw winrate.')}</p></footer>
  </>}
  {review&&<button className="pick-hover-details" onClick={()=>{close();review(r);}}>{tr('Donner mon avis sur ce pick','Give feedback on this pick')}</button>}
  <button className="pick-hover-details" onClick={()=>{close();details(r);}}><Info size={17}/>{tr('Ouvrir les détails du score','Open score details')}</button>
 </aside>,document.querySelector('[data-testid=app]')??document.body);
}
