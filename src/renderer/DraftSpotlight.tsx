import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, LoaderCircle, Shield, Swords } from 'lucide-react';
import type { Champion, Recommendation, Role, Side } from '../shared/types';
import { ChampionArtwork } from './ChampionArtwork';
import { AnimatedScore } from './AnimatedScore';

export function DraftSpotlight({champion,recommendation,role,side,title,stepLabel,kind,label,description,loading,paused,automatic,complete,autoEnemy,onAutoEnemy,onConfirm,onSkip,onDrop,onDragOver,dropActive,fr}:{champion?:Champion;recommendation?:Recommendation;role?:Role;side:Side;title:string;stepLabel:string;kind?:'pick'|'ban';label:string;description:string;loading:boolean;paused:boolean;automatic:boolean;complete:boolean;autoEnemy:boolean;onAutoEnemy:(enabled:boolean)=>void;onConfirm?:()=>void;onSkip?:()=>void;onDrop:(event:React.DragEvent)=>void;onDragOver:(event:React.DragEvent)=>void;dropActive:boolean;fr:boolean}){
  const reduce=useReducedMotion(),l=(a:string,b:string)=>fr?a:b;
  return <section className={'draft-spotlight '+side+(dropActive?' drop-active':'')} data-testid="draft-spotlight" onDrop={onDrop} onDragOver={onDragOver}>
    <div className="spotlight-turn" data-testid="guided-turn-banner"><span>{kind==='ban'?<Shield size={15}/>:complete?<Check size={15}/>:<Swords size={15}/>} {stepLabel}</span><h3>{title}</h3></div>
    <div className="spotlight-art-stage" data-testid="guided-spotlight-art">
      <AnimatePresence initial={false} mode="sync"><motion.div className="spotlight-art-frame" key={champion?.id??'empty'} initial={{opacity:0,x:reduce?0:side==='blue'?-22:22,scale:reduce?1:1.035}} animate={{opacity:1,x:0,scale:1}} exit={{opacity:0}} transition={{duration:reduce?0.12:0.32}}>
        <ChampionArtwork champion={champion} kind="card"/><div className="spotlight-vignette"/>
      </motion.div></AnimatePresence>
      <div className="spotlight-kicker">{loading?<><LoaderCircle size={13} className="spin"/>{l('Recalcul en cours','Recalculating')}</>:label}</div>
      <div className="spotlight-champion"><AnimatePresence mode="wait" initial={false}><motion.h4 key={champion?.id??'empty'} initial={{opacity:0,y:reduce?0:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.12}}>{champion?.name??l('La scène est prête','The stage is ready')}</motion.h4></AnimatePresence><div>{kind&&<span>{kind==='ban'?'BAN':'PICK'}</span>}{role&&<span>{role}</span>}{recommendation&&<strong><AnimatedScore value={recommendation.score}/><small>{l('indice','index')}</small></strong>}</div></div>
      {automatic&&!loading&&<div className="spotlight-answer-progress" key={champion?.id+'-'+stepLabel}/>}
    </div>
    <p className="spotlight-reason">{description}</p>
    <div className="spotlight-actions">{onConfirm?<button className="primary" data-testid="guided-confirm" onClick={onConfirm}>{l('Valider mon choix','Confirm my choice')}<ArrowRight size={16}/></button>:onSkip?<button onClick={onSkip}>{l('Passer ce ban','Skip this ban')}</button>:<div className="spotlight-status">{complete?l('Les deux équipes sont complètes.','Both teams are complete.'):paused?l('En pause · tu gardes la main','Paused · you are in control'):automatic?l('La réponse arrive… Pause pour intervenir.','Response incoming… Pause to intervene.'):l('Choisis une proposition ou glisse ton champion.','Choose a suggestion or drag your champion.')}</div>}</div>
    <label className="spotlight-auto"><input type="checkbox" checked={autoEnemy} onChange={e=>onAutoEnemy(e.target.checked)}/>{l('Adversaire automatique','Automatic opponent')}</label>
    {dropActive&&<div className="spotlight-drop-hint">{l('Relâche pour jouer ce champion','Release to play this champion')}</div>}
  </section>;
}
