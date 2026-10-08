import { parentPort } from 'node:worker_threads';
import { analyze } from '../engine';
import type { EngineInput } from '../shared/types';
let cached:EngineInput|undefined;
parentPort!.on('message', ({ id, input }: { id: number; input: EngineInput | Pick<EngineInput,'draft'|'settings'|'teams'> }) => {
  try { if('stats' in input)cached=input;else if(cached)cached={...cached,...input};else throw new Error('Missing worker dataset');parentPort!.postMessage({ id, result: analyze(cached!) }) }
  catch (error) { parentPort!.postMessage({ id, error: error instanceof Error ? error.message : String(error) }) }
});
