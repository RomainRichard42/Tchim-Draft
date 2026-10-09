import { useEffect, useState } from 'react';
import type { Champion } from '../shared/types';
import { Portrait } from './ChampionPortrait';

/** Bundled game illustrations only: no runtime fetch from Riot or third-party sites. */
export function ChampionArtwork({champion,kind='splash',className='',position}:{champion?:Champion;kind?:'splash'|'card';className?:string;position?:string}){
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[champion?.id,kind]);
  return <span className={'champion-art '+kind+' '+className+(failed?' art-fallback':'')} aria-hidden="true">
    {champion&&!failed?<img draggable={false} decoding="async" src={'./art/'+kind+'/'+champion.id+'.webp'} alt="" style={position?{objectPosition:position}:undefined} onError={()=>setFailed(true)}/>:<Portrait champion={champion} size="large"/>}
  </span>;
}
