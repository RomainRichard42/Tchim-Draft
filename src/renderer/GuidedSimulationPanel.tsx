import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown, GripVertical, LoaderCircle, Pause, Play, RotateCcw, Save, Search, Shield, Sparkles, Users, X } from 'lucide-react';
import type { Draft, Recommendation, Role, Selection, SimulationApproach, SimulationContext, SimulationStep, SimulationTurn, Snapshot } from '../shared/types';
import { ROLES } from '../shared/types';
import { fearlessUsed, freeRoles, opposite, order, picks, seriesFinished, used } from '../shared/draft';
import { appendGuidedChoice, guidedContext, guidedRosterIssues } from '../shared/guided-simulation';
import { Portrait } from './ChampionPortrait';
import { TeamsPanel } from './TeamsPanel';
import { DraftBalancePanel } from './DraftBalancePanel';
import { GamePlanPanel } from './GamePlanPanel';
import { ChampionArtwork } from './ChampionArtwork';
import { AnimatedScore } from './AnimatedScore';
import { DraftSpotlight } from './DraftSpotlight';
import { ChampionFlight, type ChampionTransfer } from './ChampionFlight';
import { championDragImage } from './champion-drag';
import { translations } from './i18n';
import './guided-simulation.css';

const api=window.draftApi,dragType='application/x-tchim-champion';
type Session={root:Draft;draft:Draft;context:SimulationContext;steps:SimulationStep[]};
type Choice={selection:Selection;recommendation?:Recommendation};
type Movement={score:number;places:number};

export function GuidedSimulationPanel({snapshot:snap,active}:{snapshot:Snapshot;active:boolean}){
  const fr=snap.settings.language==='fr',l=(a:string,b:string)=>fr?a:b;
  const [session,setSession]=useState<Session>(),sessionRef=useRef(session);sessionRef.current=session;
  const [side,setSide]=useState(snap.draft.side),[startingPoint,setStartingPoint]=useState<'empty'|'current'>('empty');
  const [result,setResult]=useState<{key:string;turn:SimulationTurn}>(),[loading,setLoading]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [selected,setSelected]=useState<Choice>(),[query,setQuery]=useState(''),[manualRole,setManualRole]=useState<Role>('TOP');
  const [autoEnemy,setAutoEnemy]=useState(true),[autoplay,setAutoplay]=useState(false),[paused,setPaused]=useState(false);
  const [approach,setApproach]=useState<SimulationApproach>('balanced'),[name,setName]=useState(l('Scrim guidée','Guided scrim')),[saving,setSaving]=useState(false);
  const proposalList=useRef<HTMLDivElement>(null),catalogueDetails=useRef<HTMLDetailsElement>(null);
  const reduceMotion=useReducedMotion(),arenaRef=useRef<HTMLDivElement>(null);
  const [dragging,setDragging]=useState<Selection>(),[dropTarget,setDropTarget]=useState(''),dragCleanup=useRef<()=>void>(undefined),dragOrigin=useRef<DOMRect>(undefined);
  const [flight,setFlight]=useState<ChampionTransfer>(),flightId=useRef(0);
  const previousOptions=useRef(new Map<string,Recommendation[]>()),[movements,setMovements]=useState(new Map<string,Movement>());
  const byId=useMemo(()=>new Map(snap.champions.map(c=>[c.id,c])),[snap.champions]),known=useMemo(()=>new Set(byId.keys()),[byId]);
  const find=(id:string|null|undefined)=>id?byId.get(id):undefined;
  const issues=guidedRosterIssues(snap.teams,snap.settings.language);
  const draft=session?.draft,sequence=draft?order(draft):[],index=draft?.history.length??0,action=sequence[index];
  const turnKey=session?JSON.stringify([session.draft,session.context,approach,snap.settings.language]):'';
  const turn=result?.key===turnKey?result.turn:undefined;
  const ours=action?.side===draft?.side,complete=!!draft&&index===sequence.length;
  const roles=draft&&action?freeRoles(draft,action.side):[],assignedRole=roles.includes(manualRole)?manualRole:roles[0];
  const cleanError=(e:unknown)=>e instanceof Error?e.message.replace(/^Error invoking remote method '[^']+': Error: /,''):String(e);
  const last=session?.steps.at(-1);
  useEffect(()=>{if(proposalList.current)proposalList.current.scrollTop=0;if(catalogueDetails.current)catalogueDetails.current.open=false;},[index]);
  useEffect(()=>()=>{dragCleanup.current?.();},[]);
  useEffect(()=>{if(!active){finishDrag();setFlight(undefined);}},[active]);

  useEffect(()=>{
    if(!active||!session)return;
    let cancelled=false;setLoading(true);setError('');
    const context={...session.context,settings:{...session.context.settings,language:snap.settings.language}};
    void api.simulationTurn({draft:session.draft,pins:[],context,approach}).then(value=>{
      if(cancelled)return;
      const comparison=action?.side+':'+action?.kind,previous=previousOptions.current.get(comparison);
      const oldByChoice=new Map(previous?.map((r,i)=>[r.championId+':'+r.role,{score:r.score,rank:i}]));
      const changes=new Map<string,Movement>();
      value.options.forEach((r,i)=>{const key=r.championId+':'+r.role,old=oldByChoice.get(key);if(old)changes.set(key,{score:r.score-old.score,places:old.rank-i});});
      previousOptions.current.set(comparison,value.options);setMovements(changes);setResult({key:turnKey,turn:value});
    }).catch(e=>{if(!cancelled)setError(cleanError(e));}).finally(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;};
  },[active,turnKey]);

  function start(){
    if(issues.length)return;
    let root=structuredClone(snap.draft);
    if(startingPoint==='empty')root={...root,history:[],mode:'pro',side,targetRole:'AUTO'};
    if(seriesFinished(root)){setError(l('La série Fearless est terminée. Prépare une nouvelle manche dans la draft avant de lancer.','The Fearless series is finished. Prepare a new game in the draft before starting.'));return;}
    const next={root,draft:structuredClone(root),context:guidedContext(snap.settings,snap.teams),steps:[]};
    previousOptions.current.clear();setMovements(new Map());finishDrag();setFlight(undefined);
    sessionRef.current=next;setSession(next);setResult(undefined);setPaused(false);setAutoplay(false);setSelected(undefined);setError('');setMessage('');setQuery('');
  }
  function commit(selection:Selection,automatic=false,recommendation?:Recommendation){
    if(!session||sessionRef.current!==session||!action)return;
    try{
      const nextDraft=appendGuidedChoice(session.draft,selection,known);
      const player=session.context.teams?.[ours?'ally':'enemy'].players.find(p=>p.role===selection.role);
      const exception=action.kind==='pick'&&!player?.pool.some(p=>p.championId===selection.championId&&(!p.role||p.role===selection.role));
      const reasons=exception?[l('Hors du pool connu de ','Outside the known pool of ')+(player?.riotId??'—')+l(' ; choix imposé par le coach.','; coach choice.')]:recommendation?.reasons.slice(0,3)??[automatic?l('Aucun ban disponible dans ce contexte.','No available ban in this context.'):l('Choix imposé par le coach.','Coach choice.')];
      const step:SimulationStep={index,selection,automatic,score:recommendation?.score??null,reasons};
      const champion=find(selection.championId);
      if(champion&&!reduceMotion&&arenaRef.current){
        const target=arenaRef.current.querySelector<HTMLElement>('[data-testid="'+(action.kind==='pick'?'guided-slot-'+action.side+'-'+selection.role:'guided-ban-'+index)+'"]');
        target?.scrollIntoView({block:'nearest',inline:'nearest'});
        const source=dragOrigin.current??arenaRef.current.querySelector<HTMLElement>('[data-testid="guided-spotlight-art"]')?.getBoundingClientRect(),to=target?.getBoundingClientRect();
        if(source&&to)setFlight({id:++flightId.current,champion,side:action.side,from:{left:source.left,top:source.top,width:source.width,height:source.height},to:{left:to.left,top:to.top,width:to.width,height:to.height}});
      }
      const next={...session,draft:nextDraft,steps:[...session.steps,step]};sessionRef.current=next;setSession(next);
      finishDrag();
      setSelected(undefined);setQuery('');setError('');setMessage('');
    }catch(e){finishDrag();setAutoplay(false);setPaused(true);setError(cleanError(e));}
  }
  const automatic=!!action&&!paused&&(autoplay||(!ours&&autoEnemy));
  useEffect(()=>{
    if(!active||!automatic||!turn||loading||error||(!turn.options.length&&action?.kind==='pick'))return;
    const choice=turn.options[0],expected=session;
    // Give the coach time to see the answer and pause; one choice is then committed and rescored.
    const timer=setTimeout(()=>{if(sessionRef.current===expected)commit(choice?{championId:choice.championId,...(action!.kind==='pick'?{role:choice.role}:{})}:{championId:null},true,choice);},1100);
    return ()=>clearTimeout(timer);
  },[active,automatic,turnKey,turn,loading,error]);

  function choose(selection:Selection,recommendation?:Recommendation){
    if(!action)return;
    if(!ours||autoplay){setPaused(true);setAutoplay(false);}
    setSelected({selection,recommendation});setError('');
  }
  function rewind(to:number){
    if(!session||to<session.root.history.length||to>=index)return;
    const next={...session,draft:{...session.draft,history:session.draft.history.slice(0,to)},steps:session.steps.filter(s=>s.index<to)};
    finishDrag();setFlight(undefined);sessionRef.current=next;setSession(next);setPaused(true);setAutoplay(false);setSelected(undefined);setError('');setMessage(l('Choix retirés : essaie une autre idée, la suite sera recalculée.','Choices removed: try another idea and the continuation will be recalculated.'));
  }
  function finishDrag(){dragCleanup.current?.();dragCleanup.current=undefined;dragOrigin.current=undefined;setDragging(undefined);setDropTarget('');}
  function over(event:React.DragEvent,target:string){
    if(!action||!event.dataTransfer.types.includes(dragType))return;
    event.preventDefault();event.dataTransfer.dropEffect='copy';setDropTarget(target);
  }
  function drag(event:React.DragEvent,selection:Selection){
    finishDrag();const champion=find(selection.championId);if(!champion||!action){event.preventDefault();return;}
    event.dataTransfer.setData(dragType,JSON.stringify(selection));event.dataTransfer.effectAllowed='copy';
    dragOrigin.current=event.currentTarget.getBoundingClientRect();dragCleanup.current=championDragImage(event,champion,selection);setDragging(selection);
    if(automatic){setPaused(true);setAutoplay(false);}
  }
  function drop(event:React.DragEvent,role?:Role){
    event.preventDefault();
    try{
      const data=JSON.parse(event.dataTransfer.getData(dragType));
      if(!action||typeof data.championId!=='string'||!known.has(data.championId))throw new Error(l('Champion invalide.','Invalid champion.'));
      const assigned=role??data.role??assignedRole;
      if(action.kind==='pick'&&!roles.includes(assigned))throw new Error(l('Choisis un rôle encore libre.','Choose a free role.'));
      setAutoplay(false);if(!ours)setPaused(true);
      const selection:Selection={championId:data.championId,...(action.kind==='pick'?{role:assigned}:{})};
      commit(selection,false,turn?.options.find(r=>r.championId===data.championId&&(action.kind==='ban'||r.role===assigned)));
    }catch(e){finishDrag();setError(cleanError(e));}
  }
  async function save(){
    if(!session||!name.trim())return;
    setSaving(true);setPaused(true);setAutoplay(false);
    try{await api.saveSimulation({name,draft:session.root,history:session.draft.history,pins:session.steps.filter(s=>!s.automatic).map(s=>({index:s.index,selection:s.selection})),context:session.context,approach});setMessage(l('Sauvegardée. Tu peux aussi l’explorer dans la bibliothèque de l’atelier.','Saved. You can also explore it in the workshop library.'));}catch(e){setError(cleanError(e));}finally{setSaving(false);}
  }
  async function load(id:number){
    setPaused(true);setAutoplay(false);
    try{
      const document=await api.loadSimulation(id),context=document.context??guidedContext(snap.settings,snap.teams);
      const invalid=guidedRosterIssues(context.teams,snap.settings.language);
      if(invalid.length)throw new Error(invalid.join('\n'));
      if(document.pins.some(p=>p.index>=document.history.length))throw new Error(l('Cette branche contient des choix réservés plus tard. Ouvre-la dans l’atelier de variantes.','This branch reserves future choices. Open it in the variations workshop.'));
      const next={root:document.draft,draft:{...document.draft,history:document.history},context:guidedContext(context.settings,context.teams!),steps:document.history.flatMap((selection,i)=>i>=document.draft.history.length?[{index:i,selection,automatic:!document.pins.some(p=>p.index===i),score:null,reasons:[]}]:[])};
      previousOptions.current.clear();setMovements(new Map());finishDrag();setFlight(undefined);
      sessionRef.current=next;setSession(next);setName(document.name);setApproach(document.approach&&document.approach!=='varied'?document.approach:'balanced');setSelected(undefined);setResult(undefined);setError('');setMessage('');
    }catch(e){setError(cleanError(e));}
  }
  const savedPicker=<select aria-label={l('Reprendre une simulation','Resume a simulation')} value="" onChange={e=>{if(e.target.value)void load(Number(e.target.value));}}><option value="">{l('Reprendre une simulation…','Resume a simulation…')}</option>{snap.simulations.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>;

  if(!active&&!session)return null;
  if(!session)return <section className="guided-simulation guided-setup" hidden={!active} data-testid="guided-setup">
    <div className="guided-intro"><div><span className="eyebrow"><Users size={14}/> OP.GG × OP.GG</span><h2>{l('Prépare ton face à face.','Prepare your head-to-head.')}</h2><p>{l('Importe les deux équipes, confirme les rôles, puis prends les décisions. L’adversaire répond à chacun de tes choix.','Import both teams, confirm roles, then make decisions. The enemy responds to every choice.')}</p></div><button className="primary" data-testid="guided-start" disabled={issues.length>0} onClick={start}><Play size={17}/>{l('Lancer la simulation','Start simulation')}</button></div>
    <div className="guided-setup-controls"><label>{l('Point de départ','Starting point')}<select value={startingPoint} onChange={e=>setStartingPoint(e.target.value as typeof startingPoint)}><option value="empty">{l('Draft compétitive vide','Empty competitive draft')}</option><option value="current">{l('Continuer la draft actuelle','Continue current draft')}</option></select></label><label>{l('Notre côté','Our side')}<select aria-label={l('Côté de la draft guidée','Guided draft side')} disabled={startingPoint==='current'} value={startingPoint==='current'?snap.draft.side:side} onChange={e=>setSide(e.target.value as typeof side)}><option value="blue">{l('Bleu','Blue')}</option><option value="red">{l('Rouge','Red')}</option></select></label>{snap.simulations.length>0&&savedPicker}</div>
    <div className="guided-roster-state" role="status">{issues.length?<><strong>{l('Avant de commencer','Before starting')}</strong><ul>{issues.map(issue=><li key={issue}>{issue}</li>)}</ul></>:<><Check size={17}/>{l('Deux équipes prêtes. Les propositions et les réponses restent dans leurs pools connus.','Both teams are ready. Suggestions and responses stay within their known pools.')}</>}</div>
    {error&&<p className="guided-error" role="alert">{error}</p>}
    <div className="guided-rosters"><TeamsPanel snapshot={snap} onError={setError} combined/></div>
  </section>;

  const unavailable=new Set([...used(session.draft),...fearlessUsed(session.draft)]);
  const catalogue=snap.champions.filter(c=>!unavailable.has(c.id)&&c.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const suggestions=(turn??result?.turn)?.options.filter(r=>find(r.championId)?.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))??[];
  const stale=!turn||loading;
  const picked=selected?.selection,selectedPlayer=session.context.teams?.[ours?'ally':'enemy'].players.find(p=>p.role===(picked?.role??assignedRole));
  const offPool=action?.kind==='pick'&&picked?.championId&&!selectedPlayer?.pool.some(p=>p.championId===picked.championId&&(!p.role||p.role===picked.role));
  const featured=selected?.selection??(turn?.options[0]?{championId:turn.options[0].championId,role:action?.kind==='pick'?turn.options[0].role:undefined}:last?.selection);
  const featuredRecommendation=selected?.recommendation??(!selected?turn?.options[0]:undefined);
  const featuredLabel=selected?l('TON CHOIX À CONFIRMER','YOUR CHOICE TO CONFIRM'):complete?l('DERNIER CHOIX VALIDÉ','LAST CONFIRMED CHOICE'):!turn?l('DERNIER CHOIX VALIDÉ','LAST CONFIRMED CHOICE'):automatic&&!ours?l('RÉPONSE ENVISAGÉE','EXPECTED RESPONSE'):l('PROPOSITION À EXAMINER','SUGGESTION TO CONSIDER');
  const featuredReason=selected?(offPool?l('Hors du pool connu : ton choix sera conservé et la suite s’adaptera.','Outside the known pool: your choice is kept and the continuation adapts.'):featuredRecommendation?.reasons[0]??l('Tu imposes cette idée. Valide pour voir la réponse adverse.','Force this idea. Confirm to see the enemy response.')):featuredRecommendation?.reasons[0]??l('Chaque choix déclenche une nouvelle analyse des deux équipes.','Every choice triggers a new analysis of both teams.');
  function teamBoard(teamSide:Draft['side']){
    const ally=teamSide===session!.draft.side,roster=session!.context.teams![ally?'ally':'enemy'],members=picks(session!.draft,teamSide);
    return <section className={'guided-team '+teamSide} data-testid={ally?'guided-ally':'guided-enemy'}><div className="guided-team-heading"><h3>{ally?l('Notre équipe','Our team'):l('Équipe adverse','Enemy team')}</h3><span>{teamSide==='blue'?l('BLEU','BLUE'):l('ROUGE','RED')}</span></div>
      <div className="guided-team-slots">{ROLES.map(role=>{const player=roster.players.find(p=>p.role===role),member=members.find(p=>p.role===role),droppable=action?.kind==='pick'&&action.side===teamSide&&!member,champion=find(member?.championId),target=teamSide+'-'+role;
        return <div key={role} className={'guided-player '+(member?'filled':'')+' '+(droppable?'drop-ready':'')+' '+(dropTarget===target?'drop-active':'')} data-testid={'guided-slot-'+teamSide+'-'+role} onDragOver={e=>{if(droppable)over(e,target);}} onDragLeave={()=>{if(dropTarget===target)setDropTarget('');}} onDrop={e=>{if(droppable)drop(e,role);}}>
          <AnimatePresence initial={false}>{champion&&<motion.div className="guided-player-art" key={champion.id} initial={{opacity:0,scale:reduceMotion?1:1.05}} animate={{opacity:1,scale:1}} exit={{opacity:0}} transition={{duration:.35}}><ChampionArtwork champion={champion}/></motion.div>}</AnimatePresence>
          <Portrait champion={champion} size="medium"/><div className="guided-player-copy"><small>{role} <span title={player?.riotId}>{player?.riotId}</span></small><strong>{member?champion?.name:l('À choisir','To choose')}</strong>{!member&&<span className="guided-pool-hint">{player?.pool.length} {l('champions dans le pool','champions in pool')}</span>}</div>{droppable&&<GripVertical size={15}/>}
          {dropTarget===target&&<span className="guided-slot-drop-label">{l('Jouer ici','Play here')}</span>}
        </div>;})}</div>
      <div className="guided-team-bans"><span><Shield size={12}/> BANS</span><div>{sequence.flatMap((a,i)=>a.kind==='ban'&&a.side===teamSide?[<div key={i} className={'guided-ban '+(i===index?'current':'')+' '+(dropTarget==='ban-'+i?'drop-active':'')} data-testid={'guided-ban-'+i} title={a.label+' · '+(find(session!.draft.history[i]?.championId)?.name??'—')} onDragOver={e=>{if(i===index)over(e,'ban-'+i);}} onDrop={e=>{if(i===index)drop(e);}}><Portrait champion={find(session!.draft.history[i]?.championId)} size="tiny" banned/><small>{i<index&&!session!.draft.history[i].championId?'—':a.label.split(' ').at(-1)}</small></div>]:[])}</div></div>
    </section>;
  }
  return <section className={'guided-simulation cinematic-guide '+(dragging?'is-dragging':'')} hidden={!active} data-testid="guided-simulation">
    {flight&&<ChampionFlight flight={flight} onComplete={()=>setFlight(current=>current?.id===flight.id?undefined:current)}/>}
    <div className="guided-topbar"><div><span className="eyebrow">{l('DRAFT GUIDÉE','GUIDED DRAFT')} · OP.GG × OP.GG</span><h2>{complete?l('Les deux plans sont posés.','Both game plans are set.'):l('Tes choix. Leurs réponses.','Your choices. Their answers.')}</h2></div><div className="guided-controls"><button disabled={index<=session.root.history.length} onClick={()=>rewind(index-1)}><RotateCcw size={15}/>{l('Annuler','Undo')}</button><button disabled={complete} onClick={()=>{setPaused(!paused);if(!paused)setAutoplay(false);}}>{paused?<Play size={15}/>:<Pause size={15}/>} {paused?l('Continuer','Continue'):l('Pause','Pause')}</button><button disabled={complete||loading||!!error} onClick={()=>{setAutoplay(true);setPaused(false);setSelected(undefined);}}><Sparkles size={15}/>{l('Dérouler la suite','Play out the rest')}</button><button onClick={()=>{sessionRef.current=undefined;setSession(undefined);setAutoplay(false);setPaused(true);setError('');setMessage('');}}>{l('Équipes / nouvelle draft','Teams / new draft')}</button></div></div>
    <div className="guided-step-rail" aria-label={l('Étapes de la simulation','Simulation steps')}>{sequence.map((a,i)=><button key={i} className={a.side+' '+(i===index?'current':i<index?'done':'future')} data-testid={'guided-step-'+i} aria-label={l('Revenir à ','Return to ')+a.label} disabled={i<session.root.history.length||i>=index} title={a.label+' · '+(find(draft!.history[i]?.championId)?.name??l('À venir','Upcoming'))} onClick={()=>rewind(i)}><span>{i+1}</span>{i<index?<Portrait champion={find(draft!.history[i].championId)} size="tiny" banned={a.kind==='ban'}/>:a.kind==='ban'?<X size={13}/>:<span className="guided-pick-dot"/>}</button>)}</div>
    {error&&<p className="guided-error" role="alert">{error}</p>}{message&&<p className="guided-message" role="status">{message}</p>}
    <div className="guided-stage"><div className="guided-arena" ref={arenaRef}><DraftBalancePanel balance={(turn??result?.turn)?.balance} side={session.draft.side} t={translations(snap.settings.language)} compact pending={loading} face/><div className="guided-board-scroll">
      <div className="guided-faceoff">{teamBoard(session.draft.side)}
      <DraftSpotlight champion={find(featured?.championId)} recommendation={featuredRecommendation} role={featured?.role} side={action?.side??session.draft.side}
        title={complete?l('Draft terminée','Draft complete'):ours?l('À toi de ','Your turn to ')+(action?.kind==='ban'?l('bannir','ban'):l('choisir un pick','pick')):l('Réponse adverse','Enemy response')}
        stepLabel={action?String(index+1)+'/20 · '+action.label+' · '+l('Phase ','Phase ')+action.phase:l('20/20 · Terminé','20/20 · Complete')}
        kind={action?.kind} label={featuredLabel} description={featuredReason} loading={loading} paused={paused} automatic={automatic&&!error} complete={complete}
        autoEnemy={autoEnemy} onAutoEnemy={setAutoEnemy} onConfirm={selected?()=>commit(selected.selection,false,selected.recommendation):undefined}
        onSkip={!selected&&action?.kind==='ban'?()=>{setAutoplay(false);if(!ours)setPaused(true);commit({championId:null});}:undefined}
        onDragOver={e=>over(e,'spotlight')} onDrop={e=>{if(action)drop(e);}} dropActive={dropTarget==='spotlight'} fr={fr}/>
      {teamBoard(opposite(session.draft.side))}</div>

      <details className="guided-plans"><summary><ChevronDown size={14}/>{l('Plans de jeu des deux équipes','Both teams’ game plans')}</summary>{turn&&<div><GamePlanPanel plan={turn.plans.ally} language={snap.settings.language}/><GamePlanPanel plan={turn.plans.enemy} language={snap.settings.language}/></div>}{turn?.warnings.map(w=><p key={w} className="guided-warning">{w}</p>)}</details>

    </div></div><aside className="guided-decisions"><div className="guided-decision-heading"><h3>{complete?l('Bilan de la simulation','Simulation review'):ours?l('Tes propositions','Your suggestions'):l('Leurs réponses possibles','Their possible responses')}</h3><span>{suggestions.length} {l('options','options')}</span></div>
      {last&&<div className="guided-last-choice" role="status"><span className="guided-last-tag">{last.automatic?l('RÉPONSE DU MOTEUR','ENGINE RESPONSE'):l('TON CHOIX','YOUR CHOICE')}</span><strong>{find(last.selection.championId)?.name??l('Ban passé','Skipped ban')}</strong><span>{last.selection.role??'BAN'} · {last.reasons[0]}</span></div>}
      <div className="guided-search"><Search size={16}/><input aria-label={l('Chercher dans les propositions','Search suggestions')} placeholder={l('Chercher un champion…','Search champions…')} value={query} onChange={e=>setQuery(e.target.value)}/></div>
      <label className="guided-approach">{l('Notre plan','Our plan')}<select aria-label={l('Plan de la draft guidée','Guided draft plan')} value={approach} onChange={e=>{setPaused(true);setAutoplay(false);setApproach(e.target.value as SimulationApproach);setSelected(undefined);}}>{(['balanced','engage','poke','tempo','scaling'] as const).map(style=><option key={style} value={style}>{({balanced:l('Équilibre','Balanced'),engage:'Engage',poke:'Poke',tempo:'Tempo / early',scaling:'Scaling'})[style]}</option>)}</select></label>
      {stale&&!complete&&<div className="guided-recalculating" role="status"><LoaderCircle size={13} className="spin"/>{l('Recalcul des propositions…','Recalculating suggestions…')}</div>}
      <motion.div layoutScroll className={'guided-proposal-list '+(stale?'pending':'')} ref={proposalList}>
      {!suggestions.length&&loading?<div className="guided-empty"><LoaderCircle className="spin"/>{l('Analyse des pools, des bans et des compositions…','Analyzing pools, bans and compositions…')}</div>:<AnimatePresence initial={false} mode="popLayout">{suggestions.map((r,rank)=>{
        const player=session.context.teams![ours?'ally':'enemy'].players.find(p=>p.role===r.role),familiar=player?.pool.find(p=>p.championId===r.championId);
        const chosen=picked?.championId===r.championId&&(action?.kind==='ban'||picked.role===r.role),change=movements.get(r.championId+':'+r.role);
        const delta=change&&Math.abs(change.score)>=.05?change.score:0;
        return <motion.button layout={rank<60?'position':false} initial={{opacity:0,y:reduceMotion?0:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:reduceMotion?0.01:0.24}}
          key={r.championId+':'+r.role} className={'guided-proposal '+(chosen?'selected':'')} data-testid="guided-proposal" data-champion={r.championId} data-role={r.role}
          disabled={stale} draggable={!stale} onDragStartCapture={e=>drag(e,{championId:r.championId,role:r.role})} onDragEndCapture={finishDrag}
          onClick={()=>choose({championId:r.championId,...(action?.kind==='pick'?{role:r.role}:{})},r)} title={r.reasons.join('\n')}>
          <ChampionArtwork champion={find(r.championId)} kind="card" className="proposal-art"/>
          <div><strong>{find(r.championId)?.name}<small>{r.role}</small></strong><span>{r.summary??r.reasons[0]}</span><small>{familiar?player!.riotId+' · '+(familiar.games?familiar.games+' '+l('parties','games'):l('pool déclaré','declared pool')):r.banScouting?.riotId??l('Lecture de la draft','Draft assessment')}</small></div>
          <b><AnimatedScore value={r.score}/><small>{l('indice','index')}</small>{!stale&&delta!==0&&<span className={'proposal-movement '+(delta>0?'up':'down')} data-testid="guided-score-change" title={l('Évolution depuis les dernières propositions de cette équipe','Change since this team’s previous suggestions')}>{delta>0?'↑ +':'↓ '}{delta.toFixed(1)}</span>}{!stale&&change&&change.places!==0&&<small className="proposal-rank-change" title={l('Changement de place dans les propositions de cette équipe','Rank change in this team’s suggestions')}>{change.places>0?'↑ ':'↓ '}{Math.abs(change.places)} {l('places','places')}</small>}</b>
        </motion.button>;
      })}</AnimatePresence>}
      {!loading&&!suggestions.length&&<p className="guided-empty">{complete?l('Compare les plans de jeu, sauvegarde ou reviens sur un choix.','Compare game plans, save or return to a choice.'):query?l('Aucune proposition pour cette recherche. Le catalogue reste disponible.','No suggestions for this search. The catalogue is still available.'):l('Aucun choix dans les pools restants. Impose une exception ou reviens sur un ban.','No choices in the remaining pools. Force an exception or revisit a ban.')}</p>}
      {!complete&&<details className="guided-catalogue" ref={catalogueDetails}><summary>{l('Imposer mon idée','Force my idea')} · {catalogue.length}</summary><p>{l('Une exception au pool est signalée, puis la suite s’adapte.','A pool exception is highlighted, then the continuation adapts.')}</p>{action?.kind==='pick'&&<label>{l('Rôle','Role')}<select aria-label={l('Rôle du choix manuel guidé','Guided manual choice role')} value={assignedRole} onChange={e=>setManualRole(e.target.value as Role)}>{roles.map(role=><option key={role} value={role}>{role}</option>)}</select></label>}<div>{catalogue.map(c=><button key={c.id} data-testid={'guided-champion-'+c.id} draggable onDragStart={e=>drag(e,{championId:c.id,...(action?.kind==='pick'?{role:assignedRole}:{})})} onDragEnd={finishDrag} onClick={()=>choose({championId:c.id,...(action?.kind==='pick'?{role:assignedRole}:{})})}><Portrait champion={c} size="tiny"/>{c.name}</button>)}</div></details>}
      </motion.div>
      {selected&&<div className="guided-confirm"><div><Portrait champion={find(picked?.championId)} size="medium"/><strong>{find(picked?.championId)?.name}<small>{picked?.role??'BAN'}</small></strong><button className="icon-button" aria-label={l('Fermer le choix','Close choice')} onClick={()=>setSelected(undefined)}><X size={15}/></button></div>{selected.recommendation&&<p>{selected.recommendation.reasons.slice(0,2).join(' · ')}</p>}{selected.recommendation?.lowSample&&<p className="guided-warning">{l('Peu de parties : ce score reste incertain.','Few games: this score remains uncertain.')}</p>}{offPool&&<p className="guided-warning">{l('Hors du pool connu de ce joueur : choix imposé par toi.','Outside this player’s known pool: your forced choice.')}</p>}</div>}

    </aside></div>
    <div className="guided-bottom"><input aria-label={l('Nom de la draft guidée','Guided draft name')} value={name} maxLength={100} onChange={e=>setName(e.target.value)}/><button disabled={saving||!name.trim()} onClick={()=>void save()}><Save size={15}/>{l('Sauvegarder','Save')}</button>{savedPicker}<span>{l('Pools des deux équipes · Fearless respecté · indice de draft, pas une chance de victoire.','Both team pools · Fearless respected · draft index, not win probability.')}</span></div>
  </section>;
}
