import { teamProfiles } from '../engine/team-learning';
import { enrichCachedGames } from '../collector/enrich';
import { parentPort } from 'node:worker_threads';
import { trainDraftModel } from '../engine/learning';
import type { Champion, HistoricalGame, ScrimRecord } from '../shared/types';
parentPort!.once('message',async ({kind,root,champions,games,scrims}:{kind:'train'|'enrich';root:string;champions:Champion[];games:HistoricalGame[];scrims:ScrimRecord[]})=>{
 try{if(kind==='enrich')parentPort!.postMessage({result:await enrichCachedGames(root,champions,games)});else{const model=trainDraftModel(champions,games,scrims);parentPort!.postMessage({result:{model,profiles:teamProfiles(champions,scrims,model)}});}}catch(error){parentPort!.postMessage({error:error instanceof Error?error.message:String(error)});}
});
