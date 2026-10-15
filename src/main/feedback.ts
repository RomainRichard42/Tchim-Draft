import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Storage} from './storage';
import type {CloudService} from './cloud';
import {feedbackDraftKey,feedbackRequestSchema,type CoachFeedback,type FeedbackRequest,type FeedbackState} from '../shared/coaching';
import {draftSchema} from '../shared/validation';
import {feedbackTeam} from '../engine/coach-feedback';
import {freeRoles,used,fearlessUsed} from '../shared/draft';

export const feedbackDocumentSchema=feedbackRequestSchema.omit({draftKey:true}).extend({id:z.string().uuid(),createdAt:z.string().datetime(),teamKey:z.string().max(4000),matchId:z.string().uuid().nullable(),draft:draftSchema,datasetRevision:z.string().max(100),deleted:z.boolean().optional()}).strict();
export class FeedbackService{
 private syncing?:Promise<void>;private message='';
 constructor(private storage:Storage,private cloud:CloudService,private notify:()=>void){}
 private actor(){return this.cloud.state.configured?this.cloud.state.userId:'';}
 private put(document:CoachFeedback,owner:string,dirty:number){const {pending,...safe}=document;this.storage.db.prepare('INSERT INTO coach_feedback(id,owner,json,dirty) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json,dirty=excluded.dirty WHERE coach_feedback.owner=excluded.owner').run(document.id,owner,JSON.stringify(safe),dirty);}
 state():FeedbackState{return {entries:this.storage.feedbackRecords(),syncing:!!this.syncing,message:this.message,shared:this.cloud.state.configured};}
 async list(all=false){
  await this.sync();if(!all)return this.state();
  if(this.cloud.state.role!=='owner')throw Error('Accès administrateur requis / Administrator required');
  const actor=this.actor(),rows=await this.cloud.request('/rest/v1/draft_coach_feedback?select=author,document&order=updated_at.desc&limit=2000',undefined,'GET',true,actor) as {author:string;document:unknown}[];
  if(this.actor()!==actor)throw Error('Account changed');
  return {...this.state(),entries:rows.map(row=>({...feedbackDocumentSchema.parse(row.document),author:row.author})).filter(row=>!row.deleted)};
 }
 async save(raw:FeedbackRequest){
  const {draftKey,...request}=feedbackRequestSchema.parse(raw),draft=this.storage.draft,owner=this.actor();
  if(draftKey!==feedbackDraftKey(draft,this.storage.match?.id,this.cloud.state.userId,this.cloud.state.revision))throw Error('Le contexte de la draft a changé / Draft context changed');
  if(this.storage.match?.archived)throw Error('Match archivé / Archived match');
  if(request.side!==draft.side||!freeRoles(draft,request.side).includes(request.role)||used(draft).has(request.championId)||fearlessUsed(draft).has(request.championId)||!this.storage.champions().some(c=>c.id===request.championId))throw Error('Le contexte du pick a changé / Pick context changed');
  if(!draft.teamNames?.ally?.trim()&&!this.storage.teams.ally.players.length)throw Error('Nomme ton équipe ou renseigne ses joueurs / Name your team or add its players');
  const matchId=this.storage.match?.id??null,teamKey=feedbackTeam({draft,teams:this.storage.teams});
  const previous=this.storage.feedbackRecords(true).find(f=>!f.deleted&&f.teamKey===teamKey&&f.matchId===matchId&&f.draft.history.length===draft.history.length&&f.championId===request.championId&&f.role===request.role&&JSON.stringify(f.draft.history)===JSON.stringify(draft.history));
  if(!previous&&this.storage.feedbackRecords(true).length>=2000)throw Error('Limite de retours atteinte / Feedback limit reached');
  const document=feedbackDocumentSchema.parse({...request,id:previous?.id??randomUUID(),createdAt:previous?.createdAt??new Date().toISOString(),teamKey,matchId,draft:structuredClone(draft),datasetRevision:this.cloud.state.revision??'local'});
  this.put(document,owner,1);this.storage.coachChanged();this.notify();await this.sync();return this.state();
 }
 async remove(id:string){const owner=this.actor(),row=this.storage.feedbackRecords(true).find(f=>f.id===id);if(!row)throw Error('Retour introuvable / Feedback not found');this.put({...row,deleted:true},owner,1);this.storage.coachChanged();this.notify();await this.sync();return this.state();}
 async sync():Promise<void>{
  if(!this.cloud.state.configured||!this.cloud.state.authorized)return;
  if(this.syncing){const waitingActor=this.actor();await this.syncing;if(this.actor()===waitingActor)await this.sync();return;}
  const actor=this.actor();
  const job=async()=>{try{
   for(const row of this.storage.feedbackRecords(true).filter(f=>f.pending)){
    const {pending,...document}=row;
    await this.cloud.request('/rest/v1/draft_coach_feedback?on_conflict=id',{id:row.id,author:actor,document},'POST',true,actor,'resolution=merge-duplicates');
    if(this.actor()!==actor)return;
    // Do not clear a newer local edit made while this request was pending.
    const current=this.storage.feedbackRecords(true).find(f=>f.id===row.id);if(current&&JSON.stringify({...current,pending:undefined})===JSON.stringify({...row,pending:undefined}))this.put(document,actor,0);
   }
   const rows=await this.cloud.request('/rest/v1/draft_coach_feedback?author=eq.'+actor+'&select=document&order=updated_at.desc&limit=2000',undefined,'GET',true,actor) as {document:unknown}[];
   if(this.actor()!==actor)return;
   const validated=rows.map(row=>feedbackDocumentSchema.parse(row.document));
   for(const document of validated){const local=this.storage.feedbackRecords(true).find(f=>f.id===document.id);if(!local?.pending)this.put(document,actor,0);}
   this.message='';this.storage.coachChanged();this.notify();
  }catch{if(this.actor()===actor)this.message='Retours conservés sur ce poste ; synchronisation à réessayer / Feedback kept on this device; sync will retry';}};
  this.syncing=job();try{await this.syncing;}finally{this.syncing=undefined;}
 }
}
