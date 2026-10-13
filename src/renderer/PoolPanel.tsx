import { useState } from 'react';
import { ArrowRight, Info, Search } from 'lucide-react';
import type { Role, Settings, Snapshot } from '../shared/types';
import { ROLES } from '../shared/types';
import { Portrait } from './ChampionPortrait';
import { translations } from './i18n';

export function PoolPanel({ snapshot, busy, onSettings, onParameters }: { snapshot:Snapshot; busy:boolean; onSettings:(value:Settings)=>void; onParameters:()=>void }) {
  const [query,setQuery]=useState(''),[role,setRole]=useState<Role|'ALL'>('ALL');
  const fr=snapshot.settings.language==='fr',t=translations(snapshot.settings.language),pool=snapshot.settings.pool;
  const mastered=snapshot.champions.filter(c=>(pool[c.id]??0)>0);
  const catalogue=snapshot.champions.filter(c=>c.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())&&(role==='ALL'||c.roles.includes(role)))
    .sort((a,b)=>Number(!!pool[b.id])-Number(!!pool[a.id])||a.name.localeCompare(b.name));
  const change=(id:string,value:number)=>{const next={...pool};if(!value)delete next[id];else next[id]=value;onSettings({...snapshot.settings,pool:next});};
  return <section className="pool-page" data-testid="pool-page"><div className="pool-toolbar"><div className="picker-search"><Search size={18}/><input aria-label={t.search} placeholder={t.search} value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="role-filters">{(['ALL',...ROLES] as const).map(r=><button key={r} className={role===r?'active':''} onClick={()=>setRole(r)}>{r==='ALL'?t.all:r}</button>)}</div><label className="toggle"><input type="checkbox" checked={snapshot.settings.poolOnly} disabled={busy} onChange={e=>onSettings({...snapshot.settings,poolOnly:e.target.checked})}/><span/>{t.poolOnly}</label></div>
    <p className="page-note"><Info size={18}/>{fr?'Maîtrise déclarée par toi. Les pools des deux équipes se gèrent dans Équipes.':'You declare your proficiency. Manage both team pools in Teams.'}</p>
    <div className="pool-layout"><div className="pool-grid">{catalogue.map(c=><article className={`pool-card ${pool[c.id]?'in-pool':''}`} key={c.id}><Portrait champion={c} size="large"/><div><strong>{c.name}</strong><small>{c.roles.join(' / ')||t.profiles}</small><div className="mastery-dots">{[1,2,3,4,5].map(v=><button key={v} disabled={busy} className={(pool[c.id]??0)>=v?'on':''} title={`${t.proficiency} ${v}/5`} aria-label={`${c.name} ${v}/5`} aria-pressed={(pool[c.id]??0)>=v} onClick={()=>change(c.id,pool[c.id]===v?0:v)}/>)}</div><span>{fr?'Maîtrise':'Proficiency'} {pool[c.id]??0}/5</span></div><button disabled={busy} className="pool-remove" onClick={()=>change(c.id,pool[c.id]?0:1)}>{pool[c.id]?t.remove:(fr?'Ajouter':'Add')}</button></article>)}</div>
    <aside className="surface pool-recap"><h2>{fr?'Mon récap':'My overview'}</h2><div className="pool-totals"><span><strong>{mastered.length}</strong>{t.poolCount}</span><span><strong>{ROLES.filter(r=>mastered.some(c=>c.roles.includes(r))).length}</strong>{fr?'rôles couverts':'roles covered'}</span></div><p>{fr?'Ajuste la maîtrise pour guider les propositions.':'Adjust proficiency to guide suggestions.'}</p><div className="pool-roles">{ROLES.map(r=><div key={r}><b>{r}</b><span>{mastered.filter(c=>c.roles.includes(r)).length} champions</span></div>)}</div><button className="primary" onClick={onParameters}>{fr?'Voir les paramètres de draft':'Draft settings'}<ArrowRight size={18}/></button><p className="page-note"><Info size={18}/>{fr?'Clique sur une pastille pour ajuster ta maîtrise.':'Click a dot to adjust proficiency.'}</p></aside></div>
  </section>;
}
