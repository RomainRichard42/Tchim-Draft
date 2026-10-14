import { parentPort } from 'node:worker_threads';
import { collectKnowledge } from '../collector/champion-knowledge';
parentPort!.once('message',({root}:{root:string})=>{void collectKnowledge(root,true,progress=>parentPort!.postMessage({progress})).then(result=>parentPort!.postMessage({result})).catch(error=>parentPort!.postMessage({error:String(error).slice(0,800)}));});
