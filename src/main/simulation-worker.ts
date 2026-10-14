import { strategyAnalysis } from '../engine';
import { parentPort } from 'node:worker_threads';
import { simulateDrafts, simulationOptions, simulationTurn } from '../engine/simulation';
import type { EngineInput, SimulationRequest, SimulationPin, SimulationTurnRequest, StrategyRequest } from '../shared/types';
let cached:EngineInput|undefined;
parentPort!.on('message',({id,kind,input,request}:{id:number;kind:'generate'|'options'|'turn'|'strategy';input:EngineInput|Pick<EngineInput,'draft'|'settings'|'teams'|'model'|'teamContext'|'teamProfiles'>;request:StrategyRequest|SimulationRequest|SimulationTurnRequest|{pins:SimulationPin[]}})=>{
  try {
    if('stats' in input)cached=input;else if(cached)cached={...cached,...input};else throw new Error('Missing simulation dataset');
    const result=kind==='strategy'?strategyAnalysis(cached!,request as StrategyRequest):kind==='generate'?simulateDrafts(cached!,request as SimulationRequest,completed=>parentPort!.postMessage({id,progress:completed})):kind==='turn'?simulationTurn(cached!,request as SimulationTurnRequest):simulationOptions(cached!,request.pins);
    parentPort!.postMessage({id,result});
  }catch(error){parentPort!.postMessage({id,error:error instanceof Error?error.message:String(error)});}
});
