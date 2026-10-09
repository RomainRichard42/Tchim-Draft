import { Worker } from 'node:worker_threads';
import path from 'node:path';
import type { EngineInput, Recommendation, SimulationBatch, SimulationRequest, SimulationPin } from '../shared/types';

/** Separate worker: long explorations never block the live analysis or Electron main thread. */
export class SimulationService {
  private worker?:Worker;
  private revision='';
  private serial=0;
  private active?:{key:string;id:number};
  private pending=new Map<number,{resolve:(result:unknown)=>void;reject:(error:Error)=>void;progress?:(completed:number)=>void}>();
  private start(){
    const worker=new Worker(path.join(__dirname,'simulation-worker.cjs'));this.worker=worker;this.revision='';
    worker.on('message',({id,result,error,progress})=>{
      const task=this.pending.get(id);if(!task)return;
      if(progress!==undefined){task.progress?.(progress);return;}
      this.pending.delete(id);if(this.active?.id===id)this.active=undefined;
      error?task.reject(new Error(error)):task.resolve(result);
    });
    const fail=(error:Error)=>{if(this.worker!==worker)return;this.stop(error);};
    worker.on('error',fail);worker.on('exit',code=>{if(code)fail(new Error('Simulation worker stopped'));});
  }
  stop(error=new Error('Simulation annulée / Simulation cancelled')){
    const worker=this.worker;this.worker=undefined;this.revision='';this.active=undefined;
    this.pending.forEach(task=>task.reject(error));this.pending.clear();void worker?.terminate();
  }
  cancel(key:string){if(this.active?.key===key)this.stop();}
  private run<T>(kind:'generate'|'options',input:EngineInput,revision:string,request:SimulationRequest|{pins:SimulationPin[]},progress?:(completed:number)=>void):Promise<T>{
    if(!this.worker)this.start();
    const id=++this.serial;
    if(kind==='generate')this.active={key:(request as SimulationRequest).id,id};
    return new Promise<T>((resolve,reject)=>{
      const timer=setTimeout(()=>this.stop(new Error('Simulation trop longue / Simulation timed out')),180000);
      this.pending.set(id,{resolve:result=>{clearTimeout(timer);resolve(result as T);},reject:error=>{clearTimeout(timer);reject(error);},progress});
      this.worker!.postMessage({id,kind,input:this.revision===revision?{draft:input.draft,settings:input.settings,teams:input.teams}:input,request});this.revision=revision;
    });
  }
  generate(input:EngineInput,revision:string,request:SimulationRequest,progress:(completed:number)=>void):Promise<SimulationBatch>{
    if(this.active)this.stop();
    return this.run('generate',input,revision,request,progress);
  }
  options(input:EngineInput,revision:string,pins:SimulationPin[]):Promise<Recommendation[]>{return this.run('options',input,revision,{pins});}
}
