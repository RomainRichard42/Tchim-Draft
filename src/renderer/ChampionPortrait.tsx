import { useEffect, useState } from 'react';
import { ImageOff, Plus } from 'lucide-react';
import type { Champion } from '../shared/types';

export function Portrait({ champion, size = '', banned = false }: { champion?: Champion; size?: string; banned?: boolean }) {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [champion?.id, champion?.icon]);
  const sources = champion ? [...(champion.icon ? [champion.icon] : []), `./icons/${champion.id}.png`, `./art/card/${champion.id}.webp`] : [];
  return <span className={`portrait ${size} ${banned ? 'banned' : ''} ${champion ? '' : 'empty'}`}>
    {sources[attempt] ? <img draggable={false} src={sources[attempt]} alt={champion!.name} onError={() => setAttempt(i => i + 1)}/> : champion ? <ImageOff aria-label={champion.name}/> : <Plus aria-hidden="true"/>}
    {banned && champion && <span className="ban-slash"/>}
  </span>;
}
