import { createHash } from 'node:crypto';
import type { Champion, DraftModel, HistoricalGame, ModelMetrics, ScrimRecord } from '../shared/types';
import { latestPatches } from '../shared/patches';
import { picks } from '../shared/draft';
import { confrontationFeatures, type Member } from './evaluation';

type Example={id:string;patch:string;playedAt?:string;teams?:HistoricalGame['teams'];y:number;x:Record<string,number>};
const sigmoid=(z:number)=>1/(1+Math.exp(-Math.max(-25,Math.min(25,z))));
const dot=(weights:Record<string,number>,x:Record<string,number>)=>Object.entries(x).reduce((s,[key,v])=>s+(weights[key]??0)*v,0);
function fit(rows:Example[],interactions:boolean):Record<string,number> {
 const weights:Record<string,number>={};
 // Fixed regularization and epochs; no hyperparameter tuning on held-out results.
 for(let epoch=0;epoch<100;epoch++){
  const gradient:Record<string,number>={};
  for(const row of rows){const error=sigmoid(dot(weights,row.x))-row.y;for(const [key,value] of Object.entries(row.x))if(interactions||key==='bias'||key.startsWith('champ:')||key.startsWith('team:'))gradient[key]=(gradient[key]??0)+error*value;}
  for(const [key,g] of Object.entries(gradient))weights[key]=(weights[key]??0)-.8*(g/Math.max(1,rows.length)+.025*(weights[key]??0));
 }
 return weights;
}
function metrics(rows:Example[],weights:Record<string,number>):ModelMetrics {
 let loss=0,brier=0,correct=0;for(const row of rows){const p=sigmoid(dot(weights,row.x));loss-=row.y*Math.log(p)+(1-row.y)*Math.log(1-p);brier+=(p-row.y)**2;if((p>=.5?1:0)===row.y)correct++;}
 const n=Math.max(1,rows.length);return {games:rows.length,logLoss:loss/n,brier:brier/n,accuracy:correct/n};
}
export function trainingExamples(champions:Champion[],games:HistoricalGame[],scrims:ScrimRecord[]):Example[] {
 const catalog=new Map(champions.map(c=>[c.id,c])),unique=new Map(games.map(g=>[g.id,g]));
 const resolve=(list:{championId:string|null;role:Member['role']}[])=>list.flatMap(m=>{const champion=m.championId?catalog.get(m.championId):undefined;return champion?[{champion,role:m.role}]:[];});
 const rows:Example[]=[];
 for(const game of unique.values()){
  const blue=resolve(game.lineups?.blue.picks??picks({mode:'pro',history:game.history} as Parameters<typeof picks>[0],'blue'));
  const red=resolve(game.lineups?.red.picks??picks({mode:'pro',history:game.history} as Parameters<typeof picks>[0],'red'));
  if(blue.length!==5||red.length!==5)continue;
  const x:Record<string,number>={bias:1,...confrontationFeatures(blue,red)};
  if(game.teams){x['team:'+game.teams.blue.id]=1;x['team:'+game.teams.red.id]=-1;}
  // Never use result-time gold, duration or objectives as pre-draft predictors.
  rows.push({id:game.id,patch:game.patch,playedAt:game.playedAt,teams:game.teams,y:game.winner==='blue'?1:0,x});
 }
 for(const scrim of scrims){if(!scrim.winner)continue;const blue=resolve(picks(scrim.draft,'blue')),red=resolve(picks(scrim.draft,'red'));if(blue.length===5&&red.length===5)rows.push({id:'scrim:'+scrim.id,patch:scrim.draft.patch,playedAt:scrim.playedAt,y:scrim.winner==='blue'?1:0,x:{bias:1,...confrontationFeatures(blue,red)}});}
 const pro=latestPatches(games.map(g=>g.patch)),local=latestPatches(scrims.map(s=>s.draft.patch));return rows.filter(r=>(r.id.startsWith('scrim:')?local:pro).includes(r.patch));
}
export function trainDraftModel(champions:Champion[],games:HistoricalGame[],scrims:ScrimRecord[]=[]):DraftModel {
 const rows=trainingExamples(champions,games,scrims),patches=latestPatches((games.length?games:scrims.map(s=>({patch:s.draft.patch}))).map(r=>r.patch));
 // Forward split: previous two available patches train, newest patch is never seen in training.
 const heldout=rows.filter(r=>!r.id.startsWith('scrim:')&&r.patch===patches[0]),firstDate=heldout.map(r=>r.playedAt).filter((d):d is string=>!!d).sort()[0];
 const training=rows.filter(r=>r.id.startsWith('scrim:')?!!firstDate&&!!r.playedAt&&r.playedAt<firstDate:r.patch!==patches[0]);
 // Team coefficients control skill during fitting but are not shipped. Validate exactly
 // the portable coefficients used by every account, without private team identifiers.
 const weights=Object.fromEntries(Object.entries(fit(training,true)).filter(([key])=>!key.startsWith('team:'))),baselineWeights=fit(training,false),test=metrics(heldout,weights);
 const blueRate=(training.reduce((sum,row)=>sum+row.y,0)+1)/(training.length+2);
 const references=[{name:'champions-teams',value:metrics(heldout,baselineWeights)},{name:'neutral',value:metrics(heldout,{})},{name:'side',value:metrics(heldout,{bias:Math.log(blueRate/(1-blueRate))})}];
 const reference=references.sort((a,b)=>a.value.logLoss-b.value.logLoss)[0],baseline=reference.value;
 const teamsCoverage=rows.length?rows.filter(r=>!!r.teams).length/rows.length:0,datesCoverage=rows.length?rows.filter(r=>!!r.playedAt).length/rows.length:0;
 const reasons:string[]=[];
 if(training.length<200||heldout.length<100)reasons.push('sample');
 if(teamsCoverage<.8)reasons.push('teams');if(datesCoverage<.8)reasons.push('dates');
 if(!heldout.length||test.logLoss>=baseline.logLoss*.99||test.brier>baseline.brier)reasons.push('validation');
 const fingerprint=createHash('sha256').update(JSON.stringify(rows.map(r=>[r.id,r.patch,r.playedAt,r.teams,r.y,r.x]))).digest('hex');
 return {schema:1,id:fingerprint.slice(0,16),fingerprint,trainedAt:new Date().toISOString(),features:weights,train:metrics(training,weights),test,baseline,baselineName:reference.name,patches,teamsCoverage,datesCoverage,eligible:reasons.length===0,reasons,active:false};
}
