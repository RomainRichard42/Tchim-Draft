import { useEffect, useState } from 'react';
import type { ScoutedTeam, Snapshot, Teams } from '../shared/types';
import { ROLES } from '../shared/types';

export function TeamsPanel({snapshot,onError}:{snapshot:Snapshot;onError:(error:string)=>void}) {
  const fr=snapshot.settings.language==='fr';
  const [urls,setUrls]=useState({ally:snapshot.teams.ally.url,enemy:snapshot.teams.enemy.url});
  const [loading,setLoading]=useState<'ally'|'enemy'|null>(null);
  const [add,setAdd]=useState<Record<string,string>>({});
  useEffect(()=>setUrls({ally:snapshot.teams.ally.url,enemy:snapshot.teams.enemy.url}),[snapshot.teams.ally.url,snapshot.teams.enemy.url]);
  async function save(key:'ally'|'enemy',team:ScoutedTeam){try{await window.draftApi.teams({...snapshot.teams,[key]:team});}catch(e){onError(String(e));}}
  async function scout(key:'ally'|'enemy') {setLoading(key);onError('');try{await window.draftApi.scout(key,urls[key]);}catch(e){onError(String(e));}finally{setLoading(null);}}
  return <div className="teams-layout">{(['ally','enemy'] as const).map(key=>{
    const team=snapshot.teams[key];
    const modify=(index:number,patch:Partial<ScoutedTeam['players'][number]>)=>void save(key,{...team,players:team.players.map((p,i)=>i===index?{...p,...patch}:p)});
    return <section className="surface scouting-team" key={key} data-testid={`scouting-${key}`}>
      <div className="section-heading"><h2>{key==='ally'?(fr?'Notre équipe':'Our team'):(fr?'Équipe adverse':'Enemy team')}</h2><span className="source-badge">MULTI OP.GG</span></div>
      <label className="scouting-url">{fr?'Lien multi OP.GG':'Multi OP.GG link'}<input className="text-input" aria-label={`${key} multi OP.GG`} placeholder="https://op.gg/lol/multisearch/euw?summoners=…" value={urls[key]} disabled={!!loading} onChange={e=>setUrls({...urls,[key]:e.target.value})}/></label>
      <div className="button-row"><button className="primary" disabled={!!loading||!urls[key].trim()} onClick={()=>void scout(key)}>{loading===key?(fr?'Import en cours…':'Importing…'):(fr?'Importer les joueurs et leurs pools':'Import players and pools')}</button>{team.players.length>0&&<button disabled={!!loading} onClick={()=>void save(key,{url:'',region:'euw',players:[],poolOnly:false,message:''})}>{fr?'Effacer':'Clear'}</button>}</div>
      <p className="muted small-text">{team.message}</p>
      {team.players.length>0&&<label className="toggle"><input type="checkbox" disabled={!!loading} checked={team.poolOnly} onChange={e=>void save(key,{...team,poolOnly:e.target.checked})}/><span/>{fr?'Limiter les propositions aux pools renseignés':'Limit suggestions to recorded pools'}</label>}
      {team.players.map((p,i)=>{const token=`${key}-${i}`;return <article className="scouting-player" key={p.riotId}>
        <div className="section-heading"><strong>{p.riotId}</strong><select aria-label={`${p.riotId} role`} disabled={!!loading} value={p.role} onChange={e=>modify(i,{role:e.target.value as typeof p.role})}><option value="AUTO">{fr?'Rôle à confirmer':'Confirm lane'}</option>{ROLES.map(role=><option key={role} disabled={team.players.some((other,j)=>j!==i&&other.role===role)}>{role}</option>)}</select></div>
        <small className="muted">{p.message}</small>
        <div className="scouting-pool">{p.pool.map(c=>{const champ=snapshot.champions.find(ch=>ch.id===c.championId);return <span className="scouting-chip" key={`${c.championId}-${c.role??''}`} title={c.games?`${c.wins}/${c.games} wins · ${c.role??p.role}`:'Manuel / Manual'}>{champ?.icon&&<img src={champ.icon} alt=""/>}<span>{champ?.name??c.championId}<small>{c.games?`${c.games} ${fr?'parties':'games'}`:(fr?'déclaré':'declared')}</small></span><button disabled={!!loading} aria-label={`Remove ${p.riotId} ${c.championId}`} onClick={()=>modify(i,{pool:p.pool.filter(row=>row!==c),status:'manual'})}>×</button></span>;})}</div>
        <div className="manual-pool-entry"><input className="text-input" list="scouting-champions" disabled={!!loading} aria-label={`${p.riotId} champion`} placeholder={fr?'Ajouter un champion maîtrisé…':'Add a playable champion…'} value={add[token]??''} onChange={e=>setAdd({...add,[token]:e.target.value})}/><button disabled={!!loading||!add[token]} onClick={()=>{const name=add[token].trim(),c=snapshot.champions.find(c=>c.name.toLowerCase()===name.toLowerCase()||c.id.toLowerCase()===name.toLowerCase());if(!c){onError(fr?'Champion inconnu.':'Unknown champion.');return;}if(!p.pool.some(ch=>ch.championId===c.id))modify(i,{pool:[...p.pool,{championId:c.id,games:0,wins:0,...(p.role==='AUTO'?{}:{role:p.role})}],status:'manual'});setAdd({...add,[token]:''});}}>+</button></div>
      </article>;})}
      {!team.players.length&&<p className="empty-state">{fr?'Collez le multi de cette équipe. Les deux équipes influencent les picks, les bans et les réponses adverses.':'Paste this team’s multi link. Both rosters affect picks, bans and enemy replies.'}</p>}
    </section>;
  })}<datalist id="scouting-champions">{snapshot.champions.map(c=><option key={c.id} value={c.name}/>)}</datalist></div>;
}
