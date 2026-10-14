import {Worker} from 'node:worker_threads';import path from 'node:path';
import type {EngineInput,PairStat,PickInsight,PickInsightRequest} from '../shared/types';
/** One database read at a time. Mouse movements replace queued reads; successful pair slices are cached. */
export class PickInsightService{
 private worker?:Worker;private revision='';private serial=0;private latest=0;private loading?:Promise<PairStat[]>;
 private cache=new Map<string,PairStat[]>();private pending=new Map<number,{resolve:(value:PickInsight)=>void;reject:(error:Error)=>void}>();
 async inspect(input:EngineInput,revision:string,request:PickInsightRequest,fetchPairs:()=>Promise<PairStat[]>,current:()=>boolean){
  const ticket=++this.latest,key=revision+'|'+request.championId;
  let pairs=this.cache.get(key);
  if(!pairs){if(this.loading)await this.loading.catch(()=>{});if(ticket!==this.latest||!current())throw new Error('Preview changed');pairs=this.cache.get(key);
   if(!pairs){const task=fetchPairs();this.loading=task;try{pairs=await task;this.cache.set(key,pairs);while(this.cache.size>12)this.cache.delete(this.cache.keys().next().value!);}finally{if(this.loading===task)this.loading=undefined;}}
  }
  if(ticket!==this.latest||!current())throw new Error('Preview changed');
  if(!this.worker){const worker=new Worker(path.join(__dirname,'pick-insight-worker.cjs'));this.worker=worker;this.revision='';worker.on('message',({id,result,error})=>{const task=this.pending.get(id);if(!task)return;this.pending.delete(id);error?task.reject(new Error(error)):task.resolve(result);});worker.on('error',error=>this.stop(error));worker.on('exit',code=>{if(code&&this.worker===worker)this.stop(new Error('Insight worker stopped'));});}
  const id=++this.serial;
  return new Promise<PickInsight>((resolve,reject)=>{const timer=setTimeout(()=>{this.stop(new Error('Insight timed out'));},25000);this.pending.set(id,{resolve:value=>{clearTimeout(timer);if(ticket!==this.latest||!current())reject(new Error('Preview changed'));else resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});this.worker!.postMessage({id,input:this.revision===revision?{draft:input.draft,settings:input.settings,teams:input.teams}:{...input,pairs:[],games:[]},request,pairs});this.revision=revision;});
 }
 stop(error=new Error('Preview closed')){const worker=this.worker;this.worker=undefined;this.revision='';this.latest++;this.cache.clear();this.pending.forEach(task=>task.reject(error));this.pending.clear();void worker?.terminate();}
}
