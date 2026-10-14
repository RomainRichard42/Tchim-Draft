import {parentPort} from 'node:worker_threads';
import {pickInsight} from '../engine/pick-insight';
import type {EngineInput,PairStat,PickInsightRequest} from '../shared/types';
let cached:EngineInput|undefined;
parentPort!.on('message',({id,input,request,pairs}:{id:number;input:EngineInput|Pick<EngineInput,'draft'|'settings'|'teams'>;request:PickInsightRequest;pairs:PairStat[]})=>{
 try{if('stats' in input)cached=input;else if(cached)cached={...cached,...input};else throw new Error('Missing insight data');parentPort!.postMessage({id,result:pickInsight({...cached!,pairs},request)});}catch(error){parentPort!.postMessage({id,error:error instanceof Error?error.message:String(error)});}
});
