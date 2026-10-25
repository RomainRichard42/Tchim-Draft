import {buildMetaContext,draftRetention,gameLineups,META_POLICY,type MetaLineups} from './meta-features';
import { createHash } from 'node:crypto';
import type { Champion, DraftModel, HistoricalGame, ModelMetrics, ScrimRecord, MetaEnvironment } from '../shared/types';
import { latestPatches } from '../shared/patches';
import { picks } from '../shared/draft';
import { confrontationFeatures, type Member } from './evaluation';
import {effectiveSample,gameWeight,historicalLivePatch,patchReleaseDay,LEARNING_POLICY,type WeightContext} from './learning-weights';

export type Example={id:string;patch:string;playedAt?:string;league:string;tournament:string;source:'pro'|'scrim';lineups:MetaLineups;soloCoverage?:number;teams?:HistoricalGame['teams'];y:number;x:Record<string,number>};
export interface TrainingOptions {asOf?:string;livePatch?:string;meta?:MetaEnvironment}
export interface ModelPrediction {id:string;day:string;patch:string;league:string;y:number;candidate:number;previous:number;unweightedControl:number;recencyOnly:number;metaBaseline:number;soloCoverage:number;neutral:number;side:number;championsTeams:number;trainingGames:number;trainingLatestDay:string;livePatch:string}
const sigmoid=(z:number)=>1/(1+Math.exp(-Math.max(-25,Math.min(25,z))));
const dot=(weights:Record<string,number>,x:Record<string,number>)=>Object.entries(x).reduce((s,[key,v])=>s+(weights[key]??0)*v,0);
function fit(rows:Example[],context:WeightContext,weighted:boolean,penalty:number,interactions=true,portable=true,dynamic=false,environment?:MetaEnvironment):Record<string,number> {
 const weights:Record<string,number>={},prepared=rows.map(row=>({y:row.y,weight:weighted?learningWeight(row,context,environment):1,entries:Object.entries(row.x).filter(([key])=>(dynamic?!key.startsWith('champ:'):!key.startsWith('meta:'))&&(interactions||key==='bias'||key.startsWith('champ:')||key.startsWith('team:')))}));
 const total=prepared.reduce((n,r)=>n+r.weight,0);if(!total)return weights;
 // Policy and optimizer are fixed before the chronological evaluation.
 for(let epoch=0;epoch<100;epoch++){
  const gradient:Record<string,number>={};
  for(const row of prepared){let score=0;for(const [key,value] of row.entries)score+=(weights[key]??0)*value;const error=(sigmoid(score)-row.y)*row.weight;for(const [key,value] of row.entries)gradient[key]=(gradient[key]??0)+error*value;}
  for(const [key,g] of Object.entries(gradient))weights[key]=(weights[key]??0)-.8*(g/total+penalty*(weights[key]??0));
 }
 // Team coefficients are nuisance controls; validate exactly the exported coefficients.
 return portable?Object.fromEntries(Object.entries(weights).filter(([key])=>!key.startsWith('team:'))):weights;
}
function metrics(rows:{y:number;p:number}[]):ModelMetrics {
 let loss=0,brier=0,correct=0;for(const row of rows){const p=Math.max(1e-10,Math.min(1-1e-10,row.p));loss-=row.y*Math.log(p)+(1-row.y)*Math.log(1-p);brier+=(p-row.y)**2;if((p>=.5?1:0)===row.y)correct++;}
 const n=Math.max(1,rows.length);return {games:rows.length,logLoss:loss/n,brier:brier/n,accuracy:correct/n};
}
function learningWeight(row:Example,context:WeightContext,environment?:MetaEnvironment){return gameWeight(row,context)*(environment?draftRetention(row.lineups,row.patch,context,environment.knowledge):1);}
type Predictor='candidate'|'previous'|'unweightedControl'|'recencyOnly'|'metaBaseline'|'neutral'|'side'|'championsTeams';
export function predictionMetrics(rows:ModelPrediction[],key:Predictor):ModelMetrics{return metrics(rows.map(r=>({y:r.y,p:r[key]})));}
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
  rows.push({id:game.id,patch:game.patch,playedAt:game.playedAt,league:game.league,tournament:game.tournament,source:'pro',lineups:gameLineups(game),teams:game.teams,y:game.winner==='blue'?1:0,x});
 }
 for(const scrim of scrims){if(!scrim.winner)continue;const blue=resolve(picks(scrim.draft,'blue')),red=resolve(picks(scrim.draft,'red'));if(blue.length===5&&red.length===5)rows.push({id:'scrim:'+scrim.id,patch:scrim.draft.patch,playedAt:scrim.playedAt,league:'SCRIM',tournament:'',source:'scrim',lineups:{blue:blue.map(m=>({championId:m.champion.id,role:m.role})),red:red.map(m=>({championId:m.champion.id,role:m.role}))},y:scrim.winner==='blue'?1:0,x:{bias:1,...confrontationFeatures(blue,red)}});}
 const pro=latestPatches(games.map(g=>g.patch)),local=latestPatches(scrims.map(s=>s.draft.patch));return rows.filter(r=>(r.id.startsWith('scrim:')?local:pro).includes(r.patch));
}
export function trainDraftModelWithReport(champions:Champion[],games:HistoricalGame[],scrims:ScrimRecord[]=[],options:TrainingOptions={}):{model:DraftModel;predictions:ModelPrediction[]} {
 const asOf=options.asOf??new Date().toISOString();if(!Number.isFinite(Date.parse(asOf)))throw new Error('Invalid training reference date');
 const all=trainingExamples(champions,games,scrims),patches=latestPatches((games.length?games:scrims.map(s=>({patch:s.draft.patch}))).map(r=>r.patch));
 const livePatch=options.livePatch?.split('.').slice(0,2).join('.')??historicalLivePatch(asOf.slice(0,10))??patches[0]??'unknown',context={asOf,livePatch};
 const rows=all.filter(row=>gameWeight(row,context)>0).sort((a,b)=>a.playedAt!.localeCompare(b.playedAt!)||a.id.localeCompare(b.id));
 if(options.meta){
  const contexts=new Map<string,ReturnType<typeof buildMetaContext>>();
  for(const row of rows){const day=row.playedAt!.slice(0,10),key=day+'|'+row.patch;let context=contexts.get(key);if(!context){context=buildMetaContext(games,options.meta,{asOf:day+'T00:00:00.000Z',livePatch:row.patch});contexts.set(key,context);}row.x={...row.x,...context.features(row.lineups)};row.soloCoverage=[...row.lineups.blue,...row.lineups.red].filter(p=>context!.profile(p).soloAvailable).length/10;}
 }
 const predictions:ModelPrediction[]=[],days=[...new Set(rows.filter(r=>r.source==='pro').map(r=>r.playedAt!.slice(0,10)))];let skippedDays=0;
 for(const day of days){
  const historicalPatch=historicalLivePatch(day);if(!historicalPatch){skippedDays++;continue;}
  const fold={asOf:day+'T00:00:00.000Z',livePatch:historicalPatch};
  // Whole dates stay together. Same-day results and future patch releases cannot enter fitting.
  const training=rows.filter(r=>r.playedAt!.slice(0,10)<day&&gameWeight(r,fold)>0);
  if(training.length<200){skippedDays++;continue;}
  const test=rows.filter(r=>r.source==='pro'&&r.playedAt!.slice(0,10)===day);
  const candidate=fit(training,fold,true,LEARNING_POLICY.regularization,true,true,!!options.meta,options.meta),recency=fit(training,fold,true,LEARNING_POLICY.regularization),previous=fit(training,fold,false,.025),control=fit(training,fold,false,LEARNING_POLICY.regularization),simple=fit(training,fold,false,.025,false,false);
  const side=(training.reduce((n,r)=>n+r.y,0)+1)/(training.length+2);
  for(const row of test)predictions.push({id:row.id,day,patch:row.patch,league:row.league,y:row.y,candidate:sigmoid(dot(candidate,row.x)),previous:sigmoid(dot(previous,row.x)),unweightedControl:sigmoid(dot(control,row.x)),recencyOnly:sigmoid(dot(recency,row.x)),metaBaseline:sigmoid(row.x['meta:strength']??0),soloCoverage:row.soloCoverage??0,neutral:.5,side,championsTeams:sigmoid(dot(simple,row.x)),trainingGames:training.length,trainingLatestDay:training.at(-1)!.playedAt!.slice(0,10),livePatch:historicalPatch});
 }
 // Refit once on ALL currently available games, including the latest Worlds. These are
 // production-candidate coefficients, never used to calculate the out-of-sample scores above.
 const weights=fit(rows,context,true,LEARNING_POLICY.regularization,true,true,!!options.meta,options.meta),recent=predictions.filter(p=>p.patch===patches[0]),worlds=predictions.filter(p=>p.league==='WORLDS');
 const test=predictionMetrics(recent,'candidate');
 const references=([{key:'championsTeams',name:'champions-teams'},{key:'neutral',name:'neutral'},{key:'side',name:'side'},...(options.meta?[{key:'metaBaseline' as const,name:'patch-strength' as const}]:[])] as const).map(r=>({name:r.name,value:predictionMetrics(recent,r.key)}));
 const reference=references.sort((a,b)=>a.value.logLoss-b.value.logLoss)[0],baseline=reference.value;
 const teamsCoverage=all.length?all.filter(r=>!!r.teams).length/all.length:0,datesCoverage=all.length?all.filter(r=>Number.isFinite(Date.parse(r.playedAt??''))).length/all.length:0;
 const weighted=rows.map(r=>learningWeight(r,context,options.meta)),effectiveGames=effectiveSample(weighted),total=weighted.reduce((a,b)=>a+b,0);
 const groups=new Map<string,{league:string;patch:string;games:number;totalWeight:number;share:number}>();
 rows.forEach((r,i)=>{const key=r.league+'|'+r.patch,g=groups.get(key)??{league:r.league,patch:r.patch,games:0,totalWeight:0,share:0};g.games++;g.totalWeight+=weighted[i];groups.set(key,g);});
 const reasons:string[]=[];
 if(rows.length<200||effectiveGames<200||test.games<100)reasons.push('sample');
 if(teamsCoverage<.8)reasons.push('teams');if(datesCoverage<.8)reasons.push('dates');
 if(!test.games||test.logLoss>=baseline.logLoss*.99||test.brier>baseline.brier)reasons.push('validation');
 if(!options.livePatch&&!historicalLivePatch(asOf.slice(0,10)))reasons.push('live-patch');
 if(days.length&&skippedDays===days.length)reasons.push('chronology');
 if(options.meta&&(!predictions.length||predictions.filter(p=>p.soloCoverage>=.8).length/predictions.length<.8))reasons.push('meta-history');
 const transition=predictions.filter(p=>{const release=patchReleaseDay(p.patch);return release&&Date.parse(p.day)-Date.parse(release)>=0&&Date.parse(p.day)-Date.parse(release)<7*86400000;});
 const meta=options.meta?{policy:META_POLICY,availableSnapshots:(options.meta.snapshots??[]).filter(s=>Date.parse(s.availableAt)<Date.parse(asOf)).length,validationWithSolo:predictions.filter(p=>p.soloCoverage>=.8).length,validationGames:predictions.length,firstWeek:{candidate:predictionMetrics(transition,'candidate'),recencyOnly:predictionMetrics(transition,'recencyOnly'),strengthBaseline:predictionMetrics(transition,'metaBaseline')},recencyOnly:predictionMetrics(predictions,'recencyOnly'),latestRecencyOnly:predictionMetrics(recent,'recencyOnly'),strengthBaseline:predictionMetrics(predictions,'metaBaseline'),latestStrengthBaseline:predictionMetrics(recent,'metaBaseline'),byPatch:[...new Set(predictions.map(p=>p.patch))].map(patch=>({patch,candidate:predictionMetrics(predictions.filter(p=>p.patch===patch),'candidate'),recencyOnly:predictionMetrics(predictions.filter(p=>p.patch===patch),'recencyOnly'),strengthBaseline:predictionMetrics(predictions.filter(p=>p.patch===patch),'metaBaseline')}))}:undefined;
 const fingerprint=createHash('sha256').update(JSON.stringify({policy:LEARNING_POLICY,metaPolicy:options.meta?META_POLICY:undefined,metaEnvironment:options.meta?createHash('sha256').update(JSON.stringify(options.meta)).digest('hex'):undefined,weights:weighted,context,rows:rows.map(r=>[r.id,r.patch,r.playedAt,r.league,r.tournament,r.source,r.teams,r.y,r.x])})).digest('hex');
 const model:DraftModel={schema:1,id:fingerprint.slice(0,16),fingerprint,trainedAt:new Date().toISOString(),features:weights,train:metrics(rows.map(r=>({y:r.y,p:sigmoid(dot(weights,r.x))}))),test,baseline,baselineName:reference.name,patches,teamsCoverage,datesCoverage,eligible:reasons.length===0,reasons,active:false,
  learning:{method:options.meta?META_POLICY.version:LEARNING_POLICY.version,meta,asOf,livePatch,halfLifeDays:LEARNING_POLICY.halfLifeDays,halfLifePatches:LEARNING_POLICY.halfLifePatches,regularization:LEARNING_POLICY.regularization,effectiveGames,excludedGames:all.length-rows.length,refitIncludesLatestPatch:rows.some(r=>r.source==='pro'&&r.patch===patches[0]),weightGroups:[...groups.values()].map(g=>({...g,share:total?g.totalWeight/total:0})),validation:{method:'expanding-days',days:new Set(predictions.map(p=>p.day)).size,overall:predictionMetrics(predictions,'candidate'),previous:predictionMetrics(predictions,'previous'),unweightedControl:predictionMetrics(predictions,'unweightedControl'),latestPrevious:predictionMetrics(recent,'previous'),latestUnweightedControl:predictionMetrics(recent,'unweightedControl'),worlds:predictionMetrics(worlds,'candidate'),worldsPrevious:predictionMetrics(worlds,'previous'),skippedDays}}};
 return {model,predictions};
}
export function trainDraftModel(champions:Champion[],games:HistoricalGame[],scrims:ScrimRecord[]=[],options:TrainingOptions={}):DraftModel{return trainDraftModelWithReport(champions,games,scrims,options).model;}
