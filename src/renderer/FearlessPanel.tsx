import { useState } from 'react';
import type { Snapshot, Side } from '../shared/types';
import { fearlessUsed, seriesFinished, used } from '../shared/draft';
import { Ban } from 'lucide-react';
import { Portrait } from './ChampionPortrait';

export function FearlessPanel({snapshot,busy,act,focus=false}:{snapshot:Snapshot;busy:boolean;act:(task:()=>Promise<unknown>)=>Promise<void>;focus?:boolean}) {
  const {draft:d,settings,champions}=snapshot, fr=settings.language==='fr', series=d.series??{format:'single' as const,games:[]};
  const [winner,setWinner]=useState<Side|''>(''),[query,setQuery]=useState(''),[selected,setSelected]=useState<string[]>([]),[editing,setEditing]=useState(false);
  const [manageOpen,setManageOpen]=useState(false);
  if(d.mode!=='pro')return null;
  if(series.format==='single')return focus?<section className="fearless-panel focus-context-card" data-testid="fearless-panel"><h2><Ban size={20}/>Fearless <small>{fr?'Désactivé':'Disabled'}</small></h2><p className="muted">{fr?'Choisissez BO3 ou BO5 pour gérer les champions utilisés dans la série.':'Choose BO3 or BO5 to track champions used in the series.'}</p></section>:null;
  const blocked=fearlessUsed(d), maximum=series.format==='bo3'?3:5, finished=seriesFinished(d), locked=new Set([...blocked,...used(d)]);
  const name=(id:string)=>champions.find(c=>c.id===id)?.name??id;
  const choices=champions.filter(c=>!locked.has(c.id)&&(c.name.toLowerCase().includes(query.toLowerCase())||c.id.toLowerCase().includes(query.toLowerCase()))).slice(0,30);
  return <section className={`fearless-panel ${focus?'focus-context-card':''}`} data-testid="fearless-panel">
    <div className="fearless-header"><h2><Ban size={20}/>Fearless · {series.format.toUpperCase()}</h2>
      <span>{finished?(fr?'Série terminée':'Series complete'):`${fr?'Manche':'Game'} ${series.games.length+1}/${maximum}`} · {blocked.size} {fr?'champions indisponibles':'unavailable champions'}</span></div>
    {focus&&<div className="focus-fearless-used">{[...blocked].slice(0,10).map(id=><span key={id} title={name(id)}><Portrait champion={champions.find(c=>c.id===id)} banned/><small>{name(id)}</small></span>)}{!blocked.size&&<p className="muted">{fr?'Les picks des manches terminées apparaîtront ici.':'Picks from completed games will appear here.'}</p>}</div>}
    <details className="fearless-controls" open={!focus||manageOpen||d.history.length===20} onToggle={event=>setManageOpen(event.currentTarget.open)}><summary>{fr?'Gérer la série':'Manage series'}</summary><div className="button-row">
        {d.history.length===20&&!finished&&<><select aria-label={fr?'Résultat de la manche':'Game result'} value={winner} onChange={e=>setWinner(e.target.value as Side|'')}><option value="">{fr?'Résultat non renseigné':'Result not recorded'}</option><option value={d.side}>{fr?'Victoire de notre équipe':'Our team won'}</option><option value={d.side==='blue'?'red':'blue'}>{fr?'Victoire adverse':'Enemy won'}</option></select><button className="primary" disabled={busy} onClick={()=>void act(async()=>{await window.draftApi.series('next',winner||undefined);setWinner('');setSelected([]);setEditing(false);})}>{fr?'Archiver et continuer':'Archive and continue'}</button></>}
        {series.games.length>0&&<button disabled={busy} onClick={()=>void act(()=>window.draftApi.series('previous'))}>{fr?'Rouvrir la précédente':'Reopen previous'}</button>}
        <button disabled={busy} onClick={()=>void act(async()=>{await window.draftApi.series('reset');setSelected([]);setEditing(false);})}>{fr?'Nouvelle série':'New series'}</button>
        {!finished&&<button disabled={busy} aria-label={fr?'Saisir les 10 picks d’une manche précédente':'Enter 10 picks from a previous game'} onClick={()=>{setEditing(!editing);setSelected([]);setQuery('');}}>{fr?'Historique manuel':'Manual history'}</button>}
      </div>
    </details>
    {series.games.length>0&&<details className="fearless-history"><summary>{fr?'Picks utilisés et historique':'Used picks and history'} ({series.games.length})</summary>
      {series.games.map((game,i)=><div className="fearless-game" key={i}><strong>{fr?'Manche':'Game'} {i+1}{game.winner?` · ${game.winner==='ally'?(fr?'victoire':'win'):(fr?'défaite':'loss')}`:''}</strong><div>{game.picks.map(id=><span className="fearless-chip" key={id}>{name(id)}</span>)}</div></div>)}
      <small>{fr?'Les picks des deux équipes sont bloqués. Les bans ordinaires restent propres à chaque manche. Les changements de manche sont sauvegardés dans Sessions.':'Both teams’ picks are locked. Regular bans apply only to their game. Game transitions are saved in Sessions.'}</small>
    </details>
    }
    {editing&&!finished&&<div className="fearless-editor"><p>{fr?'Sélectionnez uniquement les dix picks de la manche précédente, sans ses bans.':'Select only the ten picks from the previous game, without its bans.'}</p><input className="text-input" aria-label={fr?'Rechercher dans l’historique Fearless':'Search Fearless history'} placeholder={fr?'Rechercher un champion…':'Search a champion…'} value={query} onChange={e=>setQuery(e.target.value)}/>
      <div className="fearless-selected">{selected.map(id=><button key={id} onClick={()=>setSelected(selected.filter(c=>c!==id))}>{name(id)} ×</button>)}</div>
      <div className="fearless-choices">{choices.map(c=><button key={c.id} disabled={selected.includes(c.id)||selected.length===10} onClick={()=>setSelected([...selected,c.id])}>{c.name}</button>)}</div>
      <button className="primary" disabled={busy||selected.length!==10} onClick={()=>void act(async()=>{await window.draftApi.configure({series:{...series,games:[...series.games,{picks:selected}]}});setEditing(false);setSelected([]);})}>{fr?'Enregistrer la manche':'Save previous game'} · {selected.length}/10</button>
    </div>}
  </section>;
}
