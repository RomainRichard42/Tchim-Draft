import type {EngineInput,Role,Side} from '../shared/types';
import {picks,opposite} from '../shared/draft';
import type {CoachAdjustment} from '../shared/coaching';
import {latestPatches} from '../shared/patches';

export function feedbackTeam(input:Pick<EngineInput,'draft'|'teams'>):string{
 const team=input.teams?.ally;
 return JSON.stringify([(input.draft.teamNames?.ally??'').trim().toLowerCase(),(team?.players??[]).map(p=>[p.role,p.riotId.trim().toLowerCase()]).sort((a,b)=>a.join('|').localeCompare(b.join('|')))]);
}
/** An explicit coach vote is contextual advice, never another observed match result. */
export function coachAdjustment(input:EngineInput,championId:string,role:Role,side:Side):CoachAdjustment{
 if(side!==input.draft.side)return {value:0,observations:0};
 const key=feedbackTeam(input),enemies=new Set(picks(input.draft,opposite(side)).map(p=>p.championId)),team=input.draft.teamNames?.ally?.trim()||(input.teams?.ally.players.length??0)>0;
 if(!team)return {value:0,observations:0};
 const patches=latestPatches([input.draft.patch,...(input.feedback??[]).map(f=>f.draft.patch)]),votes=new Map<string,number>();
 for(const feedback of input.feedback??[]){
  if(feedback.deleted||feedback.teamKey!==key||feedback.championId!==championId||feedback.role!==role||!patches.includes(feedback.draft.patch))continue;
  if(feedback.reason==='lane'||feedback.verdict==='bad-matchup'){
   const lane=role==='SUPPORT'||role==='ADC'?['ADC','SUPPORT']:[role];
   const past=picks(feedback.draft,opposite(feedback.side)).filter(p=>lane.includes(p.role)).map(p=>p.championId);
   if(!past.length||!past.every(id=>enemies.has(id)))continue;
  }
  if(feedback.reason==='composition'){
   const current=picks(input.draft,side).map(p=>p.championId),previous=picks(feedback.draft,feedback.side).map(p=>p.championId);
   if((current.length||previous.length)&&!current.some(id=>previous.includes(id)))continue;
  }
  const discount=Math.pow(input.settings.oldPatchDecay,Math.max(0,patches.indexOf(feedback.draft.patch)));
  votes.set([feedback.matchId??(feedback.draft.seriesName?.trim()||feedback.createdAt.slice(0,10)),feedback.draft.history.length,championId,role].join('|'),(feedback.verdict==='good'?1:-1)*discount);
 }
 const n=votes.size,value=Math.max(-3,Math.min(3,[...votes.values()].reduce((a,b)=>a+b,0)/(n+3)*4));
 return {value:Math.round(value*10)/10,observations:n};
}
