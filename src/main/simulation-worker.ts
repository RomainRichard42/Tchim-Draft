import { parentPort } from 'node:worker_threads';
import { simulateDrafts, simulationOptions } from '../engine/simulation';
import type { EngineInput, SimulationRequest, SimulationPin } from '../shared/types';
let cached:EngineInput|undefined;
parentPort!.on('message',({id,kind,input,request}:{id:number;kind:'generate'|'options';input:EngineInput|Pick<EngineInput,'draft'|'settings'|'teams'>;request:SimulationRequest|{pins:SimulationPin[]}})=>{
  try {
    if('stats' in input)cached=input;else if(cached)cached={...cached,...input};else throw new Error('Missing simulation dataset');
    const result=kind==='generate'?simulateDrafts(cached!,request as SimulationRequest,completed=>parentPort!.postMessage({id,progress:completed})):simulationOptions(cached!,request.pins);
    parentPort!.postMessage({id,result});
  }catch(error){parentPort!.postMessage({id,error:error instanceof Error?error.message:String(error)});}
});
