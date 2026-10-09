import { useEffect,useRef,useState,type ReactNode } from 'react';
import { Search,X } from 'lucide-react';
import { motion } from 'motion/react';
import type { Champion,Recommendation } from '../shared/types';
import type { Labels } from './i18n';

const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function RecommendationList({list,champions,t,isPick,step,pending,complete=false,render}:{list:Recommendation[]|undefined;champions:Map<string,Champion>;t:Labels;isPick:boolean;step:number;pending:boolean;complete?:boolean;render:(rec:Recommendation,index:number)=>ReactNode}){
  const [query,setQuery]=useState('');const scroll=useRef<HTMLDivElement>(null);
  useEffect(()=>{setQuery('');if(scroll.current)scroll.current.scrollTop=0;},[step,isPick]);
  useEffect(()=>{if(scroll.current)scroll.current.scrollTop=0;},[query]);
  const rows=(list??[]).map((rec,index)=>({rec,index})).filter(({rec})=>normalize(`${champions.get(rec.championId)?.name??''} ${rec.championId}`).includes(normalize(query.trim())));
  return <div className="recommendation-browser">
    {isPick&&!complete&&<div className="recommendation-search"><Search size={16}/><input aria-label={t.searchPicks} placeholder={t.searchPicks} value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button className="icon-button" onClick={()=>setQuery('')} aria-label={t.clearSearch}><X size={14}/></button>}</div>}
    {!complete&&<div className="recommendation-count"><span>{rows.length} {isPick?t.pickOptions:t.banOptionsCount}</span><small>{isPick?t.scrollPicks:t.sortedByScore}</small></div>}
    <motion.div layoutScroll ref={scroll} className={`recommendations recommendation-scroll ${pending?'updating':''}`} role="region" aria-label={isPick?t.pickOptions:t.banOptionsCount} aria-busy={pending} tabIndex={0} data-testid="recommendation-scroll">
      {rows.map(({rec,index})=>render(rec,index))}{!pending&&rows.length===0&&<p className="empty-state">{complete?t.draftCompleteHelp:query?t.noSearchResults:t.noPicks}</p>}
    </motion.div>
  </div>;
}
