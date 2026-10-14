import { existsSync,readFileSync } from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { knowledgeSchema,type KnowledgeDataset,type KnowledgeState } from '../shared/knowledge';
import type { Storage } from './storage';
export class KnowledgeService{
 collecting=false;message='';private worker?:Worker;
 constructor(private storage:Storage,private notify:()=>void){
  const local=storage.get<KnowledgeDataset>('championKnowledge'),seed=path.join(__dirname,'champion-knowledge.json');
  const bundled=existsSync(seed)?knowledgeSchema.parse(JSON.parse(readFileSync(seed,'utf8'))):undefined;
  storage.knowledge=local?knowledgeSchema.parse(local):bundled;
 }
 state():KnowledgeState{return {dataset:this.storage.knowledge??null,staged:this.storage.get<KnowledgeDataset>('knowledgeStaged')??null,message:this.message,collecting:this.collecting,shared:this.storage.knowledgeShared};}
 async prepare(root:string):Promise<KnowledgeState>{
  if(this.collecting)throw new Error('Une lecture est déjà en cours / Collection already running');this.collecting=true;this.message='Lecture des données officielles / Reading official data';this.storage.knowledgeMessage=this.message;this.notify();
  const job=new Worker(path.join(__dirname,'knowledge-worker.cjs'));this.worker=job;
  try{
   const result=await new Promise<KnowledgeDataset>((resolve,reject)=>{const timer=setTimeout(()=>{void job.terminate();reject(new Error('Lecture interrompue : délai dépassé / Collection timed out'));},300000);
    job.on('message',value=>{if(value.progress){if(/^Parameters/.test(value.progress)){this.message=value.progress.replace('Parameters','Compétences / Abilities');this.storage.knowledgeMessage=this.message;this.notify();}return;}clearTimeout(timer);value.error?reject(new Error(value.error)):resolve(knowledgeSchema.parse(value.result));});
    job.once('error',error=>{clearTimeout(timer);reject(error);});job.postMessage({root});
   });
   this.storage.set('knowledgeStaged',result);this.message='Lecture prête à examiner / Ready to review';this.storage.knowledgeMessage=this.message;return this.state();
  }finally{this.collecting=false;this.worker=undefined;void job.terminate();this.notify();}
 }
 useLocal(){const data=this.storage.get<KnowledgeDataset>('knowledgeStaged');if(!data)throw new Error('Prépare les données d’abord / Prepare data first');this.storage.set('championKnowledge',knowledgeSchema.parse(data));this.storage.knowledge=data;this.storage.knowledgeShared=false;this.storage.dataRevision++;this.message='Analyse active sur cet ordinateur / Analysis active on this computer';this.notify();return this.state();}
 stop(){void this.worker?.terminate();}
}
