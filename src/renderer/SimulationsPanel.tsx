import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Copy, GitBranch, GripVertical, LayoutGrid, ListOrdered, LoaderCircle, LockKeyhole, Plus, Save, Search, Sparkles, Trash2, UnlockKeyhole, X } from 'lucide-react';
import type { Draft, Recommendation, Role, Selection, SimulationApproach, SimulationBatch, SimulationBranch, SimulationContext, SimulationPin, Snapshot } from '../shared/types';
import { ROLES } from '../shared/types';
import { fearlessUsed, opposite, order, seriesFinished } from '../shared/draft';
import { validateSimulation } from '../shared/simulation';
import { Portrait } from './ChampionPortrait';
import { GamePlanPanel } from './GamePlanPanel';
import { DraftBalancePanel } from './DraftBalancePanel';
import { translations } from './i18n';
import './simulations.css';

const api=window.draftApi, dragType='application/x-tchim-champion';
type DragChoice={championId:string|null;role?:Role;from?:number};
export function SimulationsPanel({snapshot:snap,active}:{snapshot:Snapshot;active:boolean}){
  const fr=snap.settings.language==='fr',l=(a:string,b:string)=>fr?a:b;
  const [base,setBase]=useState<Draft>(()=>structuredClone(snap.draft)),[pins,setPins]=useState<SimulationPin[]>([]);
  const [context,setContext]=useState<SimulationContext>(),[batch,setBatch]=useState<SimulationBatch>(),[chosen,setChosen]=useState(0);
  const [name,setName]=useState(l('Ma simulation','My simulation')),[count,setCount]=useState(12),[view,setView]=useState<'board'|'timeline'|'compare'>('board');
  const [target,setTarget]=useState(snap.draft.history.length),[query,setQuery]=useState(''),[roleFilter,setRoleFilter]=useState<Role|'ALL'>('ALL');
  const [manualRole,setManualRole]=useState<Role>('TOP'),[jobCount,setJobCount]=useState(12);
  const [approach,setApproach]=useState<SimulationApproach|'varied'>('varied');
  const approachLabel=(style:SimulationApproach|'varied')=>({varied:l('Plans variés','Varied plans'),balanced:l('Équilibre','Balanced'),engage:'Engage',poke:'Poke',tempo:l('Tempo / early','Tempo / early'),scaling:'Scaling'})[style];
  const [options,setOptions]=useState<Recommendation[]>([]),[optionsLoading,setOptionsLoading]=useState(false),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [compared,setCompared]=useState<number[]>([]),[dragging,setDragging]=useState(false);
  const job=useRef<string|undefined>(undefined),optionsVersion=useRef(0),initialized=useRef(false);
  const sequence=order(base),branch=batch?.branches[chosen],known=useMemo(()=>new Set(snap.champions.map(c=>c.id)),[snap.champions]);
  const byId=useMemo(()=>new Map(snap.champions.map(c=>[c.id,c])),[snap.champions]);
  const find=(id:string|null|undefined)=>id?byId.get(id):undefined;
  const selectionAt=(index:number)=>base.history[index]??pins.find(p=>p.index===index)?.selection??branch?.history[index];
  const isLocked=(index:number)=>index<base.history.length||pins.some(p=>p.index===index);
  const sequenceDone=!sequence.length||base.history.length===sequence.length;
  const stale=JSON.stringify(base)!==JSON.stringify(snap.draft);
  const contextChanged=context&&(JSON.stringify(context.settings)!==JSON.stringify(snap.settings)||JSON.stringify(context.teams)!==JSON.stringify(snap.teams));
  const autoCount=branch?.steps.filter(s=>s.automatic).length??0;
  const cleanError=(e:unknown)=>e instanceof Error?e.message.replace(/^Error invoking remote method '[^']+': Error: /,''):String(e);
  async function stop(){const id=job.current;job.current=undefined;setBusy(false);if(id)await api.cancelSimulation(id);}
  useEffect(()=>api.onSimulationProgress(p=>{if(p.id===job.current)setProgress(p.completed);}),[]);
  useEffect(()=>()=>{if(job.current)void api.cancelSimulation(job.current);},[]);
  useEffect(()=>{if(active&&!initialized.current){initialized.current=true;setBase(structuredClone(snap.draft));setTarget(snap.draft.history.length);}},[active]);
  async function generate(amount=count,override?:{draft:Draft;pins:SimulationPin[];context?:SimulationContext;approach?:SimulationApproach|'varied'}){
    const id=crypto.randomUUID();job.current=id;setBusy(true);setJobCount(amount);setError('');setMessage('');setProgress(0);
    try {
      const result=await api.simulate({id,draft:override?.draft??base,pins:override?.pins??pins,count:amount,seed:Math.floor(Math.random()*2147483647),context:override?override.context:context,approach:override?.approach??approach});
      if(job.current!==id)return;
      setBatch(result);setContext(result.context);setChosen(0);setCompared([]);
      setMessage(l(`${result.branches.length} branches · ${(result.elapsedMs/1000).toFixed(1)} s`,`${result.branches.length} branches · ${(result.elapsedMs/1000).toFixed(1)} s`));
    }catch(e){if(job.current===id)setError(cleanError(e));}
    finally{if(job.current===id){job.current=undefined;setBusy(false);}}
  }
  function create(empty=false){
    void stop();const draft=structuredClone(snap.draft);if(empty){draft.history=[];draft.targetRole='AUTO';if(seriesFinished(draft))draft.series={format:'single',games:[]};}
    setBase(draft);setPins([]);setBatch(undefined);setChosen(0);setCompared([]);setContext(undefined);setTarget(draft.history.length);setError('');setMessage('');setName(l(empty?'Draft libre':'Depuis la draft',empty?'Free draft':'From live draft'));setView('board');
  }
  // Complete prefixes only: recommendations never pretend that an unfilled future step is current.
  const prefix:Selection[]=[...base.history];
  for(let index=prefix.length;index<target;index++){const selection=selectionAt(index);if(!selection)break;prefix.push(selection);}
  const optionKey=JSON.stringify([active,prefix,target,pins,base.mode,base.series,base.side,snap.settings,snap.teams,context,branch?.history,busy]);
  useEffect(()=>{
    const id=++optionsVersion.current;setOptions([]);
    if(!active||busy||prefix.length!==target||!sequence[target]){setOptionsLoading(false);return;}
    setOptionsLoading(true);
    const timer=setTimeout(()=>{
      // All future locks are reserved. Current target is being edited, so its old lock is omitted.
      void api.simulationOptions({draft:{...base,history:prefix,targetRole:'AUTO'},pins:pins.filter(p=>p.index>target),context}).then(result=>{if(optionsVersion.current===id)setOptions(result);}).catch(e=>{if(optionsVersion.current===id)setError(cleanError(e));}).finally(()=>{if(optionsVersion.current===id)setOptionsLoading(false);});
    },100);
    return ()=>clearTimeout(timer);
  },[optionKey]);
  function setConstraints(next:SimulationPin[]){
    try{validateSimulation(base,next,known);setPins(next.sort((a,b)=>a.index-b.index));setBatch(undefined);setCompared([]);setError('');setMessage(l('Choix modifiés : complétez pour recalculer les deux équipes.','Choices changed: complete to recalculate both teams.'));}
    catch(e){setError(cleanError(e));}
  }
  function availableRoles(index:number,excluded:number[]=[]){
    const action=sequence[index];
    const taken=new Set([...base.history.map((selection,i)=>({index:i,selection})),...pins].filter(p=>!excluded.includes(p.index)&&p.index!==index&&sequence[p.index]?.kind==='pick'&&sequence[p.index].side===action?.side).map(p=>p.selection.role));
    return ROLES.filter(role=>!taken.has(role));
  }
  function place(choice:DragChoice,index=target,role?:Role){
    if(busy||index<base.history.length||!sequence[index])return;
    const action=sequence[index],source=choice.from;
    if(source===index)return;
    let next=pins.filter(p=>p.index!==index&&p.index!==source);
    const roles=availableRoles(index,source===undefined?[]:[source]);
    const assigned=role??(choice.role&&roles.includes(choice.role)?choice.role:undefined)??(roles.includes(manualRole)?manualRole:undefined)??find(choice.championId)?.roles.find(r=>roles.includes(r))??roles[0];
    if(action.kind==='pick'&&!choice.championId){setError(l('Un pick ne peut pas être vide.','A pick cannot be empty.'));return;}
    const selection:Selection={championId:choice.championId,...(action.kind==='pick'?{role:assigned}:{})};
    if(action.kind==='pick'&&assigned)setManualRole(assigned);
    // Moving a forced pick frees its origin; generated choices are recomputed after a move.
    next.push({index,selection});setConstraints(next);setTarget(index);
  }
  function drag(event:React.DragEvent,choice:DragChoice){event.dataTransfer.setData(dragType,JSON.stringify(choice));event.dataTransfer.effectAllowed='copyMove';setDragging(true);}
  function drop(event:React.DragEvent,index:number,role?:Role){event.preventDefault();setDragging(false);try{const raw=JSON.parse(event.dataTransfer.getData(dragType));if(raw&&known.has(raw.championId)&&(!raw.role||ROLES.includes(raw.role))&&(raw.from===undefined||Number.isInteger(raw.from)))place(raw,index,role);}catch{setError(l('Déplacement invalide.','Invalid move.'));}}
  function lock(index:number){const selection=selectionAt(index);if(index<base.history.length||!selection)return;setConstraints(pins.some(p=>p.index===index)?pins.filter(p=>p.index!==index):[...pins,{index,selection}]);}
  function fork(){
    if(!branch)return;
    const next=branch.history.flatMap((selection,index)=>index>=base.history.length?[{index,selection}]:[]);
    setPins(next);setName(`${name} · ${l('variante','variant')}`);setMessage(l('Branche copiée et verrouillée. Déverrouillez les choix à explorer.','Branch copied and locked. Unlock choices to explore.'));
  }
  async function save(){
    setError('');try{
      const history=branch?.history??(()=>{const history=[...base.history];while(pins.some(p=>p.index===history.length))history.push(pins.find(p=>p.index===history.length)!.selection);return history;})();
      await api.saveSimulation({name,draft:base,pins,history,context,approach});setMessage(l('Simulation sauvegardée dans la bibliothèque.','Simulation saved in the library.'));
    }catch(e){setError(cleanError(e));}
  }
  async function load(id:number){
    await stop();setError('');try{
      const document=await api.loadSimulation(id);
      setBase(document.draft);setPins(document.pins);setContext(document.context);setName(document.name);setTarget(document.draft.history.length);setBatch(undefined);setView('board');setApproach(document.approach??'varied');
      // Re-evaluate the saved completed lineup with current data, without changing its choices.
      const allPins=document.history.flatMap((selection,index)=>index>=document.draft.history.length?[{index,selection}]:[]);
      const combined=[...allPins,...document.pins.filter(p=>p.index>=document.history.length)];
      await generate(1,{draft:document.draft,pins:combined,context:document.context,approach:document.approach});
    }catch(e){setError(cleanError(e));}
  }
  function slot(index:number,role?:Role,compact=false){
    const action=sequence[index],selection=selectionAt(index),locked=isLocked(index),real=index<base.history.length;
    if(!action)return null;
    return <div key={index} className={`sim-slot ${action.side} ${target===index?'selected':''} ${locked?'locked':'automatic'} ${real?'real':''} ${compact?'compact':''}`}
      title={`${action.label} · ${find(selection?.championId)?.name??l('À définir','To choose')}`} data-testid={`sim-step-${index}`} onDragOver={e=>{if(!real&&!busy&&e.dataTransfer.types.includes(dragType))e.preventDefault();}} onDrop={e=>drop(e,index,role)}>
      <button className="sim-slot-choice" disabled={real||busy} onClick={()=>{setTarget(index);setManualRole(role??selection?.role??availableRoles(index)[0]??'TOP');}} draggable={!!selection?.championId&&!real&&!busy} onDragStart={e=>drag(e,{...selection!,from:index})} onDragEnd={()=>setDragging(false)}>
        <span className="sim-slot-step">{index+1} · {action.label}{role&&` · ${role}`}</span><span className="sim-slot-champion"><Portrait champion={find(selection?.championId)} size="medium" banned={action.kind==='ban'}/><strong>{selection?find(selection.championId)?.name??l('Ban passé','Skipped ban'):l('Déposer un champion','Drop a champion')}</strong>{selection?.role&&!role&&<small>{selection.role}</small>}</span>
      </button>
      <div className="sim-slot-actions">{real?<span title={l('Choix de la draft réelle','Live draft choice')}>LIVE</span>:<><button className="icon-button" aria-label={`${locked?l('Déverrouiller','Unlock'):l('Verrouiller','Lock')} ${action.label}`} disabled={busy||!selection} onClick={()=>lock(index)}>{locked?<LockKeyhole size={14}/>:<UnlockKeyhole size={14}/>}</button>{pins.some(p=>p.index===index)&&<button className="icon-button" aria-label={`${l('Effacer','Clear')} ${action.label}`} disabled={busy} onClick={()=>setConstraints(pins.filter(p=>p.index!==index))}><X size={14}/></button>}</>}</div>
    </div>;
  }
  function teamBoard(side:Draft['side']){
    const pickIndexes=sequence.flatMap((action,index)=>action.kind==='pick'&&action.side===side?[index]:[]),mapped=new Set<number>();
    return <section className={`sim-team ${side}`}><h3>{side===base.side?l('Notre équipe','Our team'):l('Équipe adverse','Enemy team')}<span>{side==='blue'?l('BLEU','BLUE'):l('ROUGE','RED')}</span></h3>
      {ROLES.map(role=>{let index=pickIndexes.find(i=>selectionAt(i)?.role===role);if(index===undefined)index=pickIndexes.find(i=>!mapped.has(i)&&!selectionAt(i));if(index===undefined)return <div className="sim-empty-role" key={role}>{role} · —</div>;mapped.add(index);return slot(index,role);})}
      <div className="sim-bans">{sequence.flatMap((a,index)=>a.kind==='ban'&&a.side===side?[slot(index,undefined,true)]:[])}</div>
    </section>;
  }
  function preview(b:SimulationBranch,index:number,comparison=false){
    const relative=base.side==='blue'?b.balance.value:-b.balance.value;
    return <article className={`sim-branch ${chosen===index?'active':''} ${comparison?'comparison':''}`} key={index} data-testid="simulation-branch">
      <button className="sim-branch-open" onClick={()=>{setChosen(index);if(comparison)setView('board');}}><span><GitBranch size={14}/> {l('Branche','Branch')} {index+1}<b className={relative>=0?'positive':'negative'}>{relative>0?'+':''}{relative.toFixed(1)}</b></span>
      <strong>{b.plans.ally.title}</strong><small>{approachLabel(b.approach)} · {b.status==='blocked'?l('Bloquée : pool ou contraintes','Blocked: pool or constraints'):l('10 picks · complète','10 picks · complete')}</small>
      {([base.side,opposite(base.side)] as const).map(side=><div className={`sim-mini-team ${side}`} key={side}>{sequence.flatMap((action,i)=>action.side===side&&action.kind==='pick'&&b.history[i]?.championId?[<span key={i} title={`${find(b.history[i].championId)?.name} · ${b.history[i].role}`}><Portrait champion={find(b.history[i].championId)} size="tiny"/></span>]:[])}</div>)}</button>
      {!comparison&&<label className="sim-compare-check"><input type="checkbox" checked={compared.includes(index)} disabled={!compared.includes(index)&&compared.length>=3} onChange={e=>setCompared(e.target.checked?[...compared,index]:compared.filter(i=>i!==index))}/>{l('Comparer','Compare')}</label>}
      {comparison&&<><DraftBalancePanel balance={b.balance} side={base.side} t={translations(snap.settings.language)} compact/><GamePlanPanel plan={b.plans.ally} language={snap.settings.language}/><h4>{l('Plan adverse','Enemy plan')}</h4><GamePlanPanel plan={b.plans.enemy} language={snap.settings.language}/>{b.warnings.map(w=><p className="sim-warning" key={w}>{w}</p>)}</>}
    </article>;
  }
  const disabled=new Set([...base.history.flatMap(p=>p.championId?[p.championId]:[]),...fearlessUsed(base),...pins.filter(p=>p.index!==target).flatMap(p=>p.selection.championId?[p.selection.championId]:[])]);
  const catalogue=snap.champions.filter(c=>!disabled.has(c.id)&&c.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())&&(roleFilter==='ALL'||c.roles.includes(roleFilter)));
  const targetAction=sequence[target],targetSelection=selectionAt(target),lastStep=branch?.steps.find(s=>s.index===target);
  return <section className={`simulation-studio ${dragging?'dragging':''}`} hidden={!active} data-testid="simulation-studio">
    <div className="sim-toolbar"><div><div className="eyebrow">{l('ATELIER DE DRAFT','DRAFT WORKSHOP')}</div><h2>{l('Imagine. Verrouille. Explore.','Imagine. Lock. Explore.')}</h2><p>{l('Glisse les champions sur les picks ou bans. Le moteur complète les deux équipes.','Drag champions onto picks or bans. The engine completes both teams.')}</p></div><div className="sim-create"><button onClick={()=>create()}><Plus size={15}/>{l('Depuis la draft','From live draft')}</button><button onClick={()=>create(true)}><Plus size={15}/>{l('Draft libre','Free draft')}</button></div></div>
    <div className="sim-command-bar"><input aria-label={l('Nom de la simulation','Simulation name')} value={name} maxLength={100} onChange={e=>setName(e.target.value)}/><button disabled={busy||!name.trim()} onClick={()=>void save()}><Save size={15}/>{l('Sauvegarder','Save')}</button><button disabled={busy||!branch} onClick={fork}><Copy size={15}/>{l('Dupliquer','Duplicate')}</button><span className="sim-command-space"/><select aria-label={l('Nombre de simulations','Simulation count')} value={count} disabled={busy} onChange={e=>setCount(Number(e.target.value))}>{[12,24,48].map(n=><option key={n} value={n}>{n} {l('branches','branches')}</option>)}</select><button disabled={busy||sequenceDone} onClick={()=>void generate(1)}><Check size={15}/>{l('Compléter ma branche','Complete my branch')}</button>{busy?<button onClick={()=>void stop()}><X size={15}/>{l('Arrêter','Stop')} · {progress}/{jobCount}</button>:<button className="primary" disabled={sequenceDone} onClick={()=>void generate()}><Sparkles size={16}/>{l('Explorer les suites','Explore continuations')}</button>}</div>
    <div className="sim-context"><span>{base.mode==='pro'?l('Compétitif','Competitive'):'Solo / Duo'} · {base.patch} · {base.history.length} {l('étapes de départ','starting steps')} · {base.series?.format.toUpperCase()??'SINGLE'} · {pins.length} {l('verrouillages','locks')}</span><small>{l('Scores heuristiques, sans probabilité de victoire.','Heuristic scores, no win probability.')}</small></div>
    <div className="sim-format-bar"><label>{l('Orientation de notre équipe','Our team orientation')}<select aria-label={l('Orientation de simulation','Simulation approach')} value={approach} disabled={busy} onChange={e=>setApproach(e.target.value as typeof approach)}>{(['varied','balanced','engage','poke','tempo','scaling'] as const).map(style=><option key={style} value={style}>{approachLabel(style)}</option>)}</select></label><small>{l('Préférence légère parmi les picks crédibles ; l’adversaire garde ses réponses.','Mild preference among credible picks; the enemy retains its responses.')}</small>{!base.history.length&&!pins.length&&<><label>{l('Format','Format')}<select aria-label={l('Format de la simulation','Simulation format')} value={base.mode} disabled={busy} onChange={e=>{setBase({...base,mode:e.target.value as Draft['mode'],series:{format:'single',games:[]}});setBatch(undefined);}}><option value="pro">{l('Compétitif','Competitive')}</option><option value="solo">Solo / Duo</option></select></label><label>{l('Notre côté','Our side')}<select aria-label={l('Côté simulé','Simulated side')} value={base.side} disabled={busy} onChange={e=>{setBase({...base,side:e.target.value as Draft['side']});setBatch(undefined);}}><option value="blue">{l('Bleu','Blue')}</option><option value="red">{l('Rouge','Red')}</option></select></label></>}</div>
    {(stale||contextChanged)&&<p className="sim-info">{l('Cette simulation conserve son point de départ et ses réglages.','This simulation keeps its starting point and settings.')} <button disabled={busy} onClick={()=>create()}>{l('Repartir de la draft actuelle','Start from current live draft')}</button>{contextChanged&&<button disabled={busy} onClick={()=>{setContext(undefined);setBatch(undefined);}}>{l('Utiliser les pools et poids actuels','Use current pools and weights')}</button>}</p>}
    {sequenceDone&&<p className="sim-info">{l('Point de départ terminé. Créez une draft libre ou repartez plus tôt dans la draft.','Starting point complete. Create a free draft or start earlier in the live draft.')}</p>}
    {error&&<p role="alert" className="sim-error">{error}</p>}{message&&<p className="sim-message" role="status">{message}</p>}
    {busy&&<div className="sim-progress" role="status"><LoaderCircle size={17} className="spin"/>{l('Exploration des réponses et des compositions…','Exploring responses and compositions…')}<progress max={jobCount} value={progress}/><span>{progress}</span></div>}
    <div className="sim-workspace"><aside className="sim-library"><div className="sim-section-title"><GitBranch size={16}/>{l('Branches explorées','Explored branches')}<b>{batch?.branches.length??0}</b></div>{batch?.branches.length?<div className="sim-branch-list">{batch.branches.map((b,i)=>preview(b,i))}</div>:<p className="sim-placeholder">{l('Pose tes choix, puis explore 12, 24 ou 48 suites différentes.','Set your choices, then explore 12, 24 or 48 different continuations.')}</p>}
      {batch?.warnings.map(w=><p className="sim-warning" key={w}>{w}</p>)}
      <details className="sim-saved" open><summary><Save size={14}/>{l('Bibliothèque locale','Local library')} · {snap.simulations.length}</summary>{!snap.simulations.length&&<p>{l('Sauvegarde une branche pour la retrouver plus tard.','Save a branch to return to it later.')}</p>}{snap.simulations.map(s=><div key={s.id}><button disabled={busy} onClick={()=>void load(s.id)}>{s.name}<small>{new Date(s.savedAt).toLocaleDateString(fr?'fr-FR':'en-GB')}</small></button><button className="icon-button" disabled={busy} aria-label={`${l('Supprimer','Delete')} ${s.name}`} onClick={()=>void api.deleteSimulation(s.id).catch(e=>setError(cleanError(e)))}><Trash2 size={14}/></button></div>)}</details>
    </aside><div className="sim-canvas"><div className="sim-views" role="group" aria-label={l('Format de simulation','Simulation layout')}><button className={view==='board'?'active':''} onClick={()=>setView('board')}><LayoutGrid size={15}/>{l('Face à face','Head to head')}</button><button className={view==='timeline'?'active':''} onClick={()=>setView('timeline')}><ListOrdered size={15}/>{l('Chronologie','Timeline')}</button><button className={view==='compare'?'active':''} disabled={!batch?.branches.length} onClick={()=>setView('compare')}><GitBranch size={15}/>{l('Comparer','Compare')} {compared.length?`(${compared.length})`:''}</button></div>
      <div className="sim-canvas-content">{branch&&view!=='compare'&&<DraftBalancePanel balance={branch.balance} side={base.side} t={translations(snap.settings.language)} compact/>}
      {view==='board'&&<div className="sim-board">{teamBoard(base.side)}{teamBoard(opposite(base.side))}</div>}
      {view==='timeline'&&<div className="sim-timeline">{sequence.map((_,index)=>slot(index))}</div>}
      {view==='compare'&&<div className="sim-comparison">{(compared.length?compared:batch?.branches.map((_,i)=>i).slice(0,3)??[]).map(i=>preview(batch!.branches[i],i,true))}</div>}
      {branch?.warnings.map(w=><p className="sim-warning" key={w}>{w}</p>)}
      {branch&&view!=='compare'&&<div className="sim-plans"><div><h4>{l('Notre plan','Our plan')}</h4><GamePlanPanel plan={branch.plans.ally} language={snap.settings.language}/></div><div><h4>{l('Plan adverse','Enemy plan')}</h4><GamePlanPanel plan={branch.plans.enemy} language={snap.settings.language}/></div></div>}
      <p className="sim-legend"><span>LIVE · {l('draft de départ','starting draft')}</span><span><LockKeyhole size={13}/>{l('imposé par toi','your choice')}</span><span><UnlockKeyhole size={13}/>{l('proposé par le moteur','engine choice')}</span></p></div>
    </div><aside className="sim-picker"><h3>{l('Choisir pour','Choose for')} <span className={targetAction?.side}>{targetAction?.label??'—'}</span></h3><p>{l('Clique une case, puis un champion. Ou glisse-le directement.','Click a slot, then a champion. Or drag it directly.')}</p>
      {targetAction?.kind==='pick'&&<label className="sim-role-select">{l('Rôle du pick','Pick role')}<select aria-label={l('Rôle du pick simulé','Simulated pick role')} value={availableRoles(target).includes(manualRole)?manualRole:availableRoles(target)[0]??'TOP'} disabled={busy} onChange={e=>{const role=e.target.value as Role;setManualRole(role);if(targetSelection?.championId)place({...targetSelection},target,role);}}>{availableRoles(target).map(role=><option key={role} value={role}>{role}</option>)}</select></label>}
      {targetAction?.kind==='ban'&&<button disabled={busy||target<base.history.length} onClick={()=>place({championId:null})}>{l('Passer ce ban','Skip this ban')}</button>}
      <div className="sim-search"><Search size={16}/><input aria-label={l('Rechercher un champion pour la simulation','Search simulation champions')} placeholder={l('Rechercher un champion…','Search champions…')} value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="sim-role-filters">{(['ALL',...ROLES] as const).map(role=><button key={role} className={roleFilter===role?'active':''} onClick={()=>setRoleFilter(role)}>{role==='ALL'?l('Tous','All'):role==='JUNGLE'?'JGL':role==='SUPPORT'?'SUP':role}</button>)}</div>
      <div className="sim-section-title"><Sparkles size={15}/>{l('Options du moteur','Engine options')}{optionsLoading&&<LoaderCircle size={14} className="spin"/>}</div>
      <div className="sim-options">{options.filter(r=>!disabled.has(r.championId)&&find(r.championId)?.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())&&(roleFilter==='ALL'||r.role===roleFilter)).slice(0,12).map(r=><button key={`${r.championId}:${r.role}`} disabled={busy||target<base.history.length} title={r.summary??r.reasons[0]} draggable={!busy} onDragStart={e=>drag(e,r)} onDragEnd={()=>setDragging(false)} onClick={()=>place(r)}><GripVertical size={13}/><Portrait champion={find(r.championId)} size="tiny"/><span><strong>{find(r.championId)?.name}</strong><small>{r.role} · {r.games?`${r.games} ${l('parties','games')}`:l('qualitatif','qualitative')}</small></span><b>{r.score.toFixed(1)}</b></button>)}</div>
      {!optionsLoading&&!options.length&&<p>{l('Catalogue manuel disponible. Remplis les étapes précédentes pour obtenir des scores à cette étape.','Manual catalogue available. Fill earlier steps to see scores for this step.')}</p>}
      <details open className="sim-catalogue"><summary>{l('Catalogue manuel','Manual catalogue')} · {catalogue.length}</summary><p>{l('Les choix manuels peuvent dépasser les pools connus.','Manual choices may override known pools.')}</p><div>{catalogue.map(c=><button key={c.id} data-testid={`sim-champion-${c.id}`} draggable={!busy} disabled={busy||target<base.history.length||!targetAction} title={c.roles.join(' / ')} onDragStart={e=>drag(e,{championId:c.id,role:c.roles[0]})} onDragEnd={()=>setDragging(false)} onClick={()=>place({championId:c.id})}><Portrait champion={c} size="tiny"/><span>{c.name}</span></button>)}</div></details>
      {lastStep&&<details className="sim-reasons"><summary>{l('Pourquoi ce choix ?','Why this choice?')}</summary>{lastStep.reasons.map(reason=><p key={reason}>{reason}</p>)}</details>}
    </aside></div>
  </section>;
}
