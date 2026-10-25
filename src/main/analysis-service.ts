import {Worker} from 'node:worker_threads';
import type {Analysis,EngineInput} from '../shared/types';

/** One current draft, never a queue of expensive obsolete analyses. */
export class AnalysisService {
 private worker?:Worker;private revision='';private serial=0;private generation=new Int32Array(new SharedArrayBuffer(4));
 private current?:{id:number;key:string;promise:Promise<Analysis>;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>;cleanup:()=>void};
 private cached?:{key:string;promise:Promise<Analysis>};
 constructor(private factory:()=>Worker,private timeoutMs=30000){}
 invalidate(){this.cached=undefined;}
 private cancel(){const current=this.current;this.current=undefined;if(current){clearTimeout(current.timer);current.cleanup();current.reject(Error('Analysis superseded'));}this.cached=undefined;}
 stop(){Atomics.add(this.generation,0,1);this.cancel();const worker=this.worker;this.worker=undefined;this.revision='';if(worker)void worker.terminate();}
 run(input:EngineInput,revision:string):Promise<Analysis>{
  const key=JSON.stringify([revision,input.draft,input.settings,input.teams,input.teamContext]);
  if(this.cached?.key===key)return this.cached.promise;
  if(this.current)this.cancel();
  if(!this.worker){this.worker=this.factory();const active=this.worker;const idleExit=()=>{if(this.worker===active&&!this.current){this.worker=undefined;this.revision='';this.cached=undefined;}};active.on('error',idleExit);active.on('exit',idleExit);}
  const worker=this.worker,id=++this.serial;
  Atomics.store(this.generation,0,id);
  const promise=new Promise<Analysis>((resolve,reject)=>{
   const finish=(error?:Error,result?:Analysis)=>{if(this.current?.id!==id)return;clearTimeout(this.current.timer);this.current=undefined;worker.off('message',message);worker.off('error',failed);worker.off('exit',exited);if(error){this.stop();reject(error);}else resolve(result!);};
   const message=(value:{id:number;result:Analysis;error?:string})=>{if(value.id===id)finish(value.error?Error(value.error):undefined,value.result);};
   const failed=(error:Error)=>finish(error),exited=()=>finish(Error('Analysis worker stopped'));
   const timer=setTimeout(()=>finish(Error('Analysis timed out')),this.timeoutMs);
   this.current={id,key,promise:undefined!,reject,timer,cleanup:()=>{worker.off('message',message);worker.off('error',failed);worker.off('exit',exited);}};
   worker.on('message',message);worker.once('error',failed);worker.once('exit',exited);
   try{worker.postMessage({id,generation:this.generation,input:this.revision===revision?{draft:input.draft,settings:input.settings,teams:input.teams,model:input.model,teamContext:input.teamContext,teamProfiles:input.teamProfiles}:input});this.revision=revision;}catch(error){finish(error as Error);}
  });
  if(this.current?.id===id){this.current.promise=promise;this.cached={key,promise};}
  return promise;
 }
}

/** Refresh local evidence in the background, coalescing changes during a download. */
export class BackgroundRefresh {
 private active?:string;private next?:{key:string;run:()=>Promise<void>};
 constructor(private onError:(error:unknown)=>void){}
 request(key:string,run:()=>Promise<void>){
  if(this.active!==undefined){if(key!==this.active)this.next={key,run};else this.next=undefined;return;}
  this.active=key;
  void Promise.resolve().then(run).catch(this.onError).finally(()=>{this.active=undefined;const next=this.next;this.next=undefined;if(next)this.request(next.key,next.run);});
 }
}
