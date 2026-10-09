import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'motion/react';
import type { Champion, Side } from '../shared/types';
import { ChampionArtwork } from './ChampionArtwork';
export interface ChampionTransfer { id:number;champion:Champion;side:Side;from:{left:number;top:number;width:number;height:number};to:{left:number;top:number;width:number;height:number} }
export function ChampionFlight({flight,onComplete}:{flight:ChampionTransfer;onComplete:()=>void}){
  const reduce=useReducedMotion();
  if(reduce)return null;
  return createPortal(<motion.div className={'champion-flight '+flight.side} data-testid="champion-flight" key={flight.id} initial={{left:flight.from.left,top:flight.from.top,width:flight.from.width,height:flight.from.height,opacity:.9,scale:1}} animate={{left:flight.to.left,top:flight.to.top,width:flight.to.width,height:flight.to.height,opacity:0,scale:.85}} transition={{duration:.48,ease:[.22,.8,.24,1]}} onAnimationComplete={onComplete}><ChampionArtwork champion={flight.champion} kind="card"/></motion.div>,document.body);
}
