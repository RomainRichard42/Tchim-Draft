import { useEffect, useState } from 'react';
import { ArrowRight, Check, Save } from 'lucide-react';
import type { MatchResult, Side, Snapshot } from '../shared/types';
import { seriesFinished } from '../shared/draft';

export function MatchResultPanel({snapshot:snap,onDraft,onNext,onError}:{snapshot:Snapshot;onDraft:()=>void;onNext:()=>void;onError:(message:string)=>void}){
 const fr=snap.settings.language==='fr',tr=(a:string,b:string)=>fr?a:b,game=snap.draft.series?.games.length??0;
 const [winner,setWinner]=useState<Side|''>(''),[rating,setRating]=useState(0),[kills,setKills]=useState({blue:'',red:''}),[notes,setNotes]=useState(''),[busy,setBusy]=useState(false);
 const saved=snap.match?.results.find(row=>row.game===game),finished=seriesFinished(snap.draft),complete=snap.draft.history.length===20;
 const [loaded,setLoaded]=useState(!saved);
 useEffect(()=>{let live=true;if(saved){setLoaded(false);void window.draftApi.coach().then(state=>{const record=state.scrims.find(row=>row.id===saved.id);if(live&&record){setWinner(record.winner??'');setRating(record.coachRating);setKills({blue:String(record.kills?.blue??''),red:String(record.kills?.red??'')});setNotes(record.notes);setLoaded(true);}}).catch(error=>{if(live)onError(String(error));});}else setLoaded(true);return()=>{live=false;};},[saved?.id]);
 async function work(task:()=>Promise<unknown>){setBusy(true);onError('');try{await task();}catch(error){onError(String(error));}finally{setBusy(false);}}
 if(!snap.match)return <section className="match-result"><h2>{tr('Sélectionne un match','Select a match')}</h2></section>;
 if(finished)return <section className="match-result"><Check size={32}/><h2>{tr('Série terminée','Series complete')}</h2><p>{snap.draft.teamNames?.ally} {snap.draft.series?.games.filter(row=>row.winner==='ally').length} — {snap.draft.series?.games.filter(row=>row.winner==='enemy').length} {snap.draft.teamNames?.enemy}</p><p>{tr('Les résultats enregistrés restent disponibles dans Matchs.','Recorded results remain available in Matches.')}</p></section>;
 if(!complete)return <section className="match-result"><h2>{tr('Termine la draft avant de saisir le résultat','Finish the draft before recording the result')}</h2><p>{snap.draft.history.length}/20 {tr('choix renseignés','choices recorded')}</p><button className="primary" onClick={onDraft}>{tr('Revenir à la draft','Back to draft')}<ArrowRight size={17}/></button></section>;
 const teamName=(side:Side)=>snap.draft.teamNames?.[snap.draft.side===side?'ally':'enemy']||(side==='blue'?tr('Équipe bleue','Blue team'):tr('Équipe rouge','Red team'));
 const valid=!!winner&&rating>0&&Object.values(kills).every(value=>value.trim()!==''&&Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=999);
 const doc:MatchResult={winner:winner||'blue',coachRating:rating,kills:{blue:Number(kills.blue),red:Number(kills.red)},notes};
 return <section className="match-result" data-testid="match-result"><div className="workspace-heading"><div><h2>{tr('Résultat','Result')} · G{game+1}</h2><p>{snap.match.name}</p></div>{saved&&<span className="match-saved"><Check size={17}/>{tr('Enregistré','Recorded')}</span>}</div>
  <form onSubmit={e=>{e.preventDefault();if(valid)void work(()=>window.draftApi.recordMatchResult(doc));}}>
   <fieldset disabled={busy||!loaded||snap.match.archived}><legend>{tr('Qui a gagné ?','Who won?')}</legend><div className="match-winner-options">{(['blue','red'] as const).map(side=><button type="button" aria-pressed={winner===side} key={side} className={`${side} ${winner===side?'selected':''}`} onClick={()=>setWinner(side)}>{teamName(side)}{winner===side&&<Check size={18}/>}</button>)}</div>
    <div className="match-kills">{(['blue','red'] as const).map(side=><label key={side}>{tr('Kills','Kills')} · {teamName(side)}<input aria-label={`${side} kills`} required type="number" min="0" max="999" value={kills[side]} onChange={e=>setKills({...kills,[side]:e.target.value})}/></label>)}</div>
    <label>{tr('Note de notre draft','Our draft rating')}</label><div className="match-rating" role="group" aria-label={tr('Note de draft sur 5','Draft rating out of 5')}>{[1,2,3,4,5].map(value=><button type="button" key={value} aria-pressed={rating===value} className={rating===value?'selected':''} onClick={()=>setRating(value)}>{value}/5</button>)}</div>
    <label>{tr('Retour du coach (facultatif)','Coach feedback (optional)')}<textarea aria-label="Coach feedback" maxLength={4000} rows={4} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
    <div className="match-create-actions"><button type="submit" className="primary" disabled={!valid}><Save size={18}/>{saved?tr('Mettre à jour le résultat','Update result'):tr('Enregistrer le résultat','Record result')}</button>{snap.draft.series?.format!=='single'&&<button type="button" disabled={!saved||!valid} onClick={()=>void work(async()=>{await window.draftApi.recordMatchResult(doc);await window.draftApi.series('next',doc.winner);onNext();})}>{tr('Manche suivante','Next game')}<ArrowRight size={18}/></button>}</div>
   </fieldset>
  </form>
 </section>;
}
