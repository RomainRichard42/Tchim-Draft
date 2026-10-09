import { animate, useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

export function AnimatedScore({value,className='',signed=false}:{value:number;className?:string;signed?:boolean}){
  const motionValue=useMotionValue(value),[shown,setShown]=useState(value),reduce=useReducedMotion();
  useEffect(()=>motionValue.on('change',setShown),[motionValue]);
  useEffect(()=>{if(reduce){motionValue.set(value);return;}const control=animate(motionValue,value,{duration:.3,ease:'easeOut'});return ()=>control.stop();},[value,reduce,motionValue]);
  return <span className={className} aria-label={(signed&&value>0?'+':'')+value.toFixed(1)} data-score={value}>{signed&&shown>0?'+':''}{shown.toFixed(1)}</span>;
}
