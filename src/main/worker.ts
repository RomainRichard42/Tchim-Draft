import { parentPort } from 'node:worker_threads';
import { analyze } from '../engine';
import type { EngineInput } from '../shared/types';
let cached:EngineInput|undefined;
parentPort!.on('message', ({ id, input,generation }: { id: number; generation?:Int32Array;input: EngineInput | Pick<EngineInput,'draft'|'settings'|'teams'|'model'|'teamContext'|'teamProfiles'> }) => {
  try { if('stats' in input)cached=input;else if(cached)cached={...cached,...input};else throw new Error('Missing worker dataset');const checkCancelled=()=>{if(generation&&Atomics.load(generation,0)!==id)throw Error('Analysis superseded');};checkCancelled();parentPort!.postMessage({ id, result: analyze({...cached!,checkCancelled}) }) }
  catch (error) { parentPort!.postMessage({ id, error: error instanceof Error ? error.message : String(error) }) }
});
