import { useState } from 'react';
import { Check, History, Sparkles, Wrench } from 'lucide-react';
import type { Lang, ReleaseNotesStatus } from '../shared/types';
import './release-notes.css';

export function ReleaseNotesPanel({status,language,closing,error,close}:{status:ReleaseNotesStatus;language:Lang;closing:boolean;error:string;close:()=>void}){
  const [history,setHistory]=useState(false),fr=language==='fr';
  const entries=history?status.history:status.entries;
  const labels=fr?{new:'Nouveautés',improved:'Plus pratique',fixed:'Corrections'}:{new:'New features',improved:'Easier to use',fixed:'Fixes'};
  return <div className="release-notes" data-testid="release-notes">
    <div className="release-welcome"><span className="release-symbol"><Sparkles size={25}/></span><div><strong>{fr?'Qu’est-ce qui change pour toi ?':'What has changed for you?'}</strong><p>{status.lastSeenVersion&&status.pending?(fr?`Voici les nouveautés depuis la version ${status.lastSeenVersion}.`:`Here is what is new since version ${status.lastSeenVersion}.`):(fr?'Découvre les nouveautés et comment les utiliser.':'Discover new features and how to use them.')}</p></div><span className="release-version">v{status.currentVersion}</span></div>
    <div className="release-entries">{entries.map(note=><article key={note.version} className="release-entry"><div className="release-entry-heading"><h3>{note.title[language]}</h3><span>v{note.version}</span></div><p>{note.summary[language]}</p>{note.sections.map(section=><section className={`release-section ${section.kind}`} key={section.kind}><h4>{section.kind==='new'?<Sparkles size={17}/>:section.kind==='fixed'?<Wrench size={17}/>:<Check size={17}/>} {labels[section.kind]}</h4><ul>{section.items.map(item=><li key={item.fr}>{item[language]}</li>)}</ul></section>)}</article>)}{!entries.length&&<p>{fr?'Cette version est installée. Les détails de ses nouveautés ne sont pas disponibles ici.':'This version is installed. Details of its changes are not available here.'}</p>}</div>
    <div className="release-footer"><button onClick={()=>setHistory(!history)}><History size={16}/>{history?(fr?'Revenir aux nouveautés':'Back to what is new'):(fr?'Voir l’historique':'View history')}</button><button className="primary" data-testid="release-notes-close" disabled={closing} onClick={close}>{closing?(fr?'Enregistrement…':'Saving…'):(fr?'C’est parti':'Let’s go')}<Check size={16}/></button></div>
    {error&&<p className="error-inline" role="alert">{error}</p>}
  </div>;
}
