import { useState } from 'react';
import type { Snapshot, Side } from '../shared/types';
import { fearlessUsed, seriesFinished, used } from '../shared/draft';

export function FearlessPanel({snapshot,busy,act}:{snapshot:Snapshot;busy:boolean;act:(task:()=>Promise<unknown>)=>Promise<void>}) {
  const {draft:d,settings,champions}=snapshot, fr=settings.language==='fr', series=d.series??{format:'single' as const,games:[]};
  const [winner,setWinner]=useState<Side|''>(''),[query,setQuery]=useState(''),[selected,setSelected]=useState<string[]>([]),[editing,setEditing]=useState(false);
  if(d.mode!=='pro'||series.format==='single')return null;
  const blocked=fearlessUsed(d), maximum=series.format==='bo3'?3:5, finished=seriesFinished(d), locked=new Set([...blocked,...used(d)]);
  const name=(id:string)=>champions.find(c=>c.id===id)?.name??id;
  const choices=champions.filter(c=>!locked.has(c.id)&&(c.name.toLowerCase().includes(query.toLowerCase())||c.id.toLowerCase().includes(query.toLowerCase()))).slice(0,30);
  return <section className="fearless-panel" data-testid="fearless-panel">
    <div className="fearless-header"><strong>Fearless · {series.format.toUpperCase()}</strong>
      <span>{finished?(fr?'Série terminée':'Series complete'):`${fr?'Manche':'Game'} ${series.games.length+1}/${maximum}`} · {blocked.size} {fr?'champions indisponibles':'unavailable champions'}</span><div className="button-row">
        {d.history.length===20&&!finished&&<><select aria-label={fr?'Résultat de la manche':'Game result'} value={winner} onChange={e=>setWinner(e.target.value as Side|'')}><option value="">{fr?'Résultat non renseigné':'Result not recorded'}</option><option value={d.side}>{fr?'Victoire de notre équipe':'Our team won'}</option><option value={d.side==='blue'?'red':'blue'}>{fr?'Victoire adverse':'Enemy won'}</option></select><button className="primary" disabled={busy} onClick={()=>void act(async()=>{await window.draftApi.series('next',winner||undefined);setWinner('');setSelected([]);setEditing(false);})}>{fr?'Archiver et continuer':'Archive and continue'}</button></>}
        {series.games.length>0&&<button disabled={busy} onClick={()=>void act(()=>window.draftApi.series('previous'))}>{fr?'Rouvrir la précédente':'Reopen previous'}</button>}
        <button disabled={busy} onClick={()=>void act(async()=>{await window.draftApi.series('reset');setSelected([]);setEditing(false);})}>{fr?'Nouvelle série':'New series'}</button>
        {!finished&&<button disabled={busy} aria-label={fr?'Saisir les 10 picks d’une manche précédente':'Enter 10 picks from a previous game'} onClick={()=>{setEditing(!editing);setSelected([]);setQuery('');}}>{fr?'Historique manuel':'Manual history'}</button>}
      </div>
    </div>
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
