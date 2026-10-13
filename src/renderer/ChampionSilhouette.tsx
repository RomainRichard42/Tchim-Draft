import { useId } from 'react';
import type { Role, Side } from '../shared/types';

// Original, generic role emblems. No downloaded champion illustration is needed.
export function ChampionSilhouette({ role = 'MID', side = 'blue', empty = false, banned = false, className = '' }: {
  role?: Role; side?: Side; empty?: boolean; banned?: boolean; className?: string;
}) {
  const pattern = useId().replace(/:/g, '');
  return <svg className={`champion-silhouette ${side} ${banned ? 'banned' : ''} ${empty ? 'empty' : ''} ${className}`} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <defs><pattern id={pattern} width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill="currentColor" opacity=".3"/></pattern></defs>
    <rect width="100" height="100" className="silhouette-paper"/>
    <rect width="100" height="100" fill={`url(#${pattern})`}/>
    {empty ? <path d="M50 31v38M31 50h38" stroke="currentColor" strokeWidth="4"/> : <g className="silhouette-ink">
      <path d="M8 100l8-27 20-11h28l20 11 8 27z"/>
      {role === 'TOP' ? <><path d="M29 24l10-10h22l10 10-3 30-18 18-18-18z"/><path d="M32 17L20 9l5 27h12M68 17l12-8-5 27H63M15 76L4 63l3 35h26M85 76l11-13-3 35H67"/></> :
        role === 'JUNGLE' ? <><path d="M28 30l7-16 28-5 12 17-7 30-18 14-18-14z"/><path d="M27 28l-7-7 17-13 9 9M66 22l12-7-5 18M24 73l16 15-15 12M76 73L60 88l15 12"/></> :
        role === 'ADC' ? <><path d="M23 53l6-26 21-20 21 20 6 26-12 16H35z"/><path d="M66 100l17-61 7 3-16 58z"/><path d="M33 32l-4 20 21 12 21-12-4-20z" className="silhouette-cut"/><path d="M36 37h28l-4 16-10 8-10-8z"/></> :
        role === 'SUPPORT' ? <><path d="M25 52l8-28 17-13 17 13 8 28-10 15H35z"/><path d="M36 33h28v17L50 66 36 50z" className="silhouette-cut"/><path d="M16 71L5 78v22h26l4-14zM84 71l11 7v22H69l-4-14z"/></> :
        <><path d="M28 27l9-15h26l9 15-5 30-17 15-17-15z"/><path d="M28 27l-5 40 16-7-4-27M72 27l5 40-16-7 4-27"/><path d="M14 79l20 9-6 12H8M86 79l-20 9 6 12h20"/></>}
      <path d="M35 73l15 17 15-17M50 90v10" fill="none" className="silhouette-outline" strokeWidth="1.5"/>
    </g>}
    {banned && !empty && <path d="M1 99L99 1" className="ban-strike" strokeWidth="2.5"/>}
  </svg>;
}
