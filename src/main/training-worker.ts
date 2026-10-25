import { teamProfiles } from '../engine/team-learning';
import { enrichCachedGames } from '../collector/enrich';
import { parentPort } from 'node:worker_threads';
import { trainDraftModelWithReport, type TrainingOptions } from '../engine/learning';
import type { Champion, HistoricalGame, ScrimRecord } from '../shared/types';
parentPort!.once('message',async ({kind,root,champions,games,scrims,trainingOptions}:{kind:'train'|'enrich';root:string;champions:Champion[];games:HistoricalGame[];scrims:ScrimRecord[];trainingOptions?:TrainingOptions})=>{
 try{if(kind==='enrich')parentPort!.postMessage({result:await enrichCachedGames(root,champions,games)});else{const result=trainDraftModelWithReport(champions,games,scrims,trainingOptions);parentPort!.postMessage({result:{...result,profiles:teamProfiles(champions,scrims,result.model,trainingOptions?.meta?{games,meta:trainingOptions.meta}:undefined)}});}}catch(error){parentPort!.postMessage({error:error instanceof Error?error.message:String(error)});}
});
