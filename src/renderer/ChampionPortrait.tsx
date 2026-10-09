import { useEffect, useState, type CSSProperties } from 'react';
import type { Champion } from '../shared/types';

export function Portrait({ champion, size = '', banned = false }: { champion?: Champion; size?: string; banned?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [champion?.icon]);
  return <span className={`portrait ${size} ${banned ? 'banned' : ''}`} style={{ '--portrait-hue': `${(champion?.key ?? 4) * 37 % 360}deg` } as CSSProperties}>
    {champion?.icon && !failed ? <img src={champion.icon} alt={champion.name} onError={() => setFailed(true)}/> : <span>{champion ? champion.name.slice(0, 2).toUpperCase() : '+'}</span>}
    {banned && champion && <span className="ban-slash"/>}
  </span>;
}
