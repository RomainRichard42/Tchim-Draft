import type { DraftBalance,Side } from '../shared/types';
import type { Labels } from './i18n';

export function DraftBalancePanel({balance,side,t,compact=false,pending=false,face=false}:{balance:DraftBalance|undefined;side:Side;t:Labels;compact?:boolean;pending?:boolean;face?:boolean}){
  if(!balance)return null;
  const {blue,red,value,revealed,complete}=balance;
  const leader=Math.abs(value)<3?t.balanceEven:`${value>0?t.blue:t.red} +${Math.abs(value)}`;
  const ours=side==='blue'?blue:red,theirs=side==='blue'?red:blue,relative=side==='blue'?value:-value;
  const position=50+relative/2;
  const describe=revealed?`${t.balanceTitle} : ${leader}. ${revealed}/10 ${t.revealedPicks}. ${t.balanceNote}`:t.balanceWaiting;
  return <section className={`draft-balance ${side} ${compact?'compact-balance':''} ${face?'face-balance':''} ${pending?'pending':''}`} data-testid="draft-balance" aria-label={t.balanceTitle}>
    <div className="balance-heading"><span>{t.balanceTitle}</span><strong className={Math.abs(relative)<3?'even':relative>0?'ours':'theirs'}>{face ? `${relative>0?'+':''}${relative.toFixed(1)}` : revealed?leader:t.balanceWaiting}</strong></div>
    <div className="balance-team-labels"><span>{t.ally} · {side==='blue'?t.blue:t.red}<b>{ours.score.toFixed(1)}<small>/100</small></b></span><span>{t.enemy} · {side==='blue'?t.red:t.blue}<b>{theirs.score.toFixed(1)}<small>/100</small></b></span></div>
    <div className="balance-track" role="meter" aria-label={t.balanceTitle} aria-valuemin={-100} aria-valuemax={100} aria-valuenow={relative} aria-valuetext={describe}>
      <span className="balance-fill ours-fill" style={{width:`${position}%`}}/><span className="balance-midpoint"/><span className="balance-marker" style={{left:`${position}%`}}/>
    </div>
    <div className="balance-caption"><span>{complete?t.balanceComplete:`${revealed}/10 ${t.revealedPicks} · ${t.balanceProgressive}`}</span>{!compact&&<small>{t.balanceNote}</small>}</div>
  </section>;
}
