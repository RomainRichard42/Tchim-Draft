import { teamKey } from '../engine/team-learning';
import { order } from '../shared/draft';
import { safeStorage } from 'electron';
import { z } from 'zod';
import { SUPABASE, supabaseHeaders, modelForDataset } from '../shared/supabase';
import type { CloudState, CoachState, Draft, DraftModel, ScrimDocument, ScrimRecord, Selection, TeamProfile, Teams } from '../shared/types';
import { datasetSchema } from '../shared/dataset';
import { scrimSchema, draftSchema, settingsSchema, teamsSchema } from '../shared/validation';
import type { Storage } from './storage';
import { knowledgeSchema } from '../shared/knowledge';
import { contextChampionIds } from '../engine/meta';

const authSchema=z.object({access_token:z.string(),refresh_token:z.string(),expires_in:z.number(),user:z.object({id:z.string().uuid(),email:z.string().email()})});
type Session=z.infer<typeof authSchema>&{expiresAt:number};
export class CloudService {
 readonly state:CloudState={configured:!!SUPABASE.url&&process.env.TCHIM_OFFLINE!=='1',authorized:false,email:'',userId:'',role:null,organizationId:'',message:'',syncing:false};
 private session?:Session;private candidates=new Set<string>();private pending?:Promise<void>;private checkedAt=0;private gamesRevision?:string;
 private workspaceTimer?:ReturnType<typeof setTimeout>;
 private async restoreAccount(){
  const saved=this.storage.get<{savedAt?:string}>('account:'+this.state.userId);
  this.storage.account(this.state.userId,this.state.role==='owner');
  const rows=await this.request('/rest/v1/draft_workspaces?user_id=eq.'+this.state.userId+'&select=draft,teams,settings,updated_at') as {draft:unknown;teams:unknown;settings:unknown;updated_at:string}[];
  if(rows[0]&&(!saved||!saved.savedAt||rows[0].updated_at>saved.savedAt)){
   this.storage.draft=draftSchema.parse(rows[0].draft);this.storage.teams=teamsSchema.parse(rows[0].teams);this.storage.settings=settingsSchema.parse(rows[0].settings);this.storage.persist();
  }
 }
 scheduleWorkspace(){if(!this.state.configured||!this.state.authorized)return;clearTimeout(this.workspaceTimer);this.workspaceTimer=setTimeout(()=>{void this.flushWorkspace().catch(()=>{this.state.message='Brouillon conservé sur cet ordinateur ; synchronisation à réessayer / Draft kept locally; sync will retry';this.notify();});},1200);}
 async flushWorkspace(){clearTimeout(this.workspaceTimer);this.workspaceTimer=undefined;if(!this.state.configured||!this.state.authorized)return;await this.request('/rest/v1/draft_workspaces?on_conflict=user_id',{user_id:this.state.userId,label:this.state.email,draft:this.storage.draft,teams:this.storage.teams,settings:this.storage.settings});}
 async workspaces(){this.requireAccess();return this.request('/rest/v1/draft_workspaces?select=user_id,label,draft,teams,updated_at&order=updated_at.desc&limit=2000');}
 constructor(private storage:Storage,private notify:()=>void){storage.cloud=this.state;}
 private persist(){if(this.session&&safeStorage.isEncryptionAvailable())this.storage.set('cloudSession',safeStorage.encryptString(JSON.stringify(this.session)).toString('base64'));else this.storage.db.prepare('DELETE FROM kv WHERE key=?').run('cloudSession');}
 async request(endpoint:string,body?:unknown,method=body===undefined?'GET':'POST',withSession=true,expectedUser?:string,prefer?:string):Promise<unknown>{
  if(!this.state.configured)throw new Error('Supabase is not configured');
  if(withSession&&this.session&&this.session.expiresAt<Date.now()+60000)await this.refresh();
  if(expectedUser && (!this.state.authorized||this.session?.user.id!==expectedUser))throw new Error('Account changed');
  const requestUser=withSession?this.session?.user.id:undefined;
  const response=await fetch(SUPABASE.url+endpoint,{method,headers:{...supabaseHeaders(SUPABASE),'Content-Type':'application/json',...(endpoint.includes('on_conflict=')?{Prefer:'resolution=merge-duplicates'}:{}),...(prefer?{Prefer:prefer}:{}),...(withSession&&this.session?{Authorization:'Bearer '+this.session.access_token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(90000)});
  if(!response.ok){if(response.status===401&&withSession){this.state.authorized=false;this.notify();}throw new Error('Supabase '+response.status+(response.status===400?' · Vérifie tes informations / Check your details':response.status===403?' · Accès refusé / Access denied':''));}
  const responseBody=await response.text();if(requestUser&&this.session?.user.id!==requestUser)throw new Error('Account changed');return responseBody?JSON.parse(responseBody):null;
 }
 private async refresh(){if(!this.session)throw new Error('Sign in first');const data=authSchema.parse(await this.request('/auth/v1/token?grant_type=refresh_token',{refresh_token:this.session.refresh_token},'POST',false));this.session={...data,expiresAt:Date.now()+data.expires_in*1000};this.persist();}
 async initialize(){
  if(!this.state.configured)return;
  const stored=this.storage.get<string>('cloudSession');
  if(stored&&safeStorage.isEncryptionAvailable())try{this.session=JSON.parse(safeStorage.decryptString(Buffer.from(stored,'base64'))) as Session;await this.identify();if(this.state.authorized)await this.restoreAccount();}catch{this.session=undefined;this.state.authorized=false;this.state.message='Reconnecte-toi / Sign in again';}
  this.notify();
 }
 private async identify(){
  if(!this.session)throw new Error('Sign in first');
  await this.request('/rest/v1/rpc/draft_claim_invitation',{});
  const rows=z.array(z.object({organization_id:z.string().uuid(),role:z.enum(['owner','coach'])})).parse(await this.request('/rest/v1/draft_members?select=organization_id,role&user_id=eq.'+this.session.user.id));
  const membership=rows.find(m=>m.role==='owner')??rows[0];
  Object.assign(this.state,{email:this.session.user.email,userId:this.session.user.id,role:membership?.role??null,organizationId:membership?.organization_id??'',authorized:!!membership,message:membership?'':'Compte créé. Ton administrateur doit t’autoriser / Ask your administrator for access.'});
 }
 async login(email:string,password:string){
  if(this.state.authorized)await this.flushWorkspace();
  const data=authSchema.parse(await this.request('/auth/v1/token?grant_type=password',{email,password},'POST',false));
  this.session={...data,expiresAt:Date.now()+data.expires_in*1000};this.persist();this.candidates.clear();this.checkedAt=0;
  this.storage.cloudData=undefined;this.storage.teamProfiles=[];await this.identify();if(this.state.authorized)await this.restoreAccount();this.notify();
 }
 async signup(email:string,password:string,code:string){await this.request('/functions/v1/draft-register',{email,password,code},'POST',false);await this.login(email,password);return {message:'Compte créé, bienvenue / Account created, welcome'};}
 async logout(){try{await this.flushWorkspace();if(this.session)await this.request('/auth/v1/logout',{},'POST');}finally{this.storage.persist();this.session=undefined;this.persist();Object.assign(this.state,{authorized:false,email:'',userId:'',role:null,organizationId:'',message:'',syncing:false,revision:undefined});this.storage.cloudData=undefined;this.storage.teamProfiles=[];this.candidates.clear();this.checkedAt=0;this.storage.draft={...this.storage.draft,history:[]};this.storage.teams={ally:{url:'',region:'euw',players:[],poolOnly:false,message:''},enemy:{url:'',region:'euw',players:[],poolOnly:false,message:''}};this.storage.persist();this.notify();}}
 requireAccess(){if(this.state.configured&&!this.state.authorized)throw new Error('Connecte-toi avec un compte autorisé / Sign in with an approved account');}
 async refreshStatistics(){this.checkedAt=0;await this.sync();}
 async prepareDraft(){await this.sync(this.storage.draft,[],this.storage.teams,true);this.state.message='Matchups préparés pour la draft / Draft matchups ready';this.notify();}
 async invite(email:string){this.requireAccess();if(this.state.role!=='owner')throw new Error('Administrator only');return z.object({code:z.string().regex(/^TD-[a-f0-9]{32}$/),email:z.string().email(),expiresAt:z.string()}).parse(await this.request('/rest/v1/rpc/draft_issue_invitation',{target_email:email}));}
 async syncKnowledge(){
  try{const rows=await this.request('/rest/v1/draft_knowledge?slot=eq.stable&select=revision') as {revision:string}[];if(rows[0])this.storage.knowledgeShared=true;if(rows[0]&&rows[0].revision!==this.storage.knowledge?.revision){const data=await this.request('/rest/v1/draft_knowledge?slot=eq.stable&select=payload') as {payload:unknown}[];const parsed=knowledgeSchema.parse(data[0].payload);if(parsed.revision!==rows[0].revision)throw new Error('Knowledge revision changed');this.storage.knowledge=parsed;this.storage.set('championKnowledge',parsed);this.storage.dataRevision++;this.notify();}}
  catch(error){if(String(error).includes('404'))return;this.storage.log('info','Fiches conservées localement ; synchronisation à réessayer / Local champion data retained; sync will retry');}
 }
 async publishKnowledge(){this.requireAccess();if(this.state.role!=='owner')throw new Error('Administrator only');const candidate=knowledgeSchema.parse(this.storage.get('knowledgeStaged'));const existing=await this.request('/rest/v1/draft_knowledge?slot=eq.stable&select=revision') as {revision:string}[];await this.request('/rest/v1/rpc/draft_publish_knowledge',{candidate,expected_revision:existing[0]?.revision??null});this.storage.knowledge=candidate;this.storage.knowledgeShared=true;this.storage.set('championKnowledge',candidate);this.storage.db.prepare('DELETE FROM kv WHERE key=?').run('knowledgeStaged');this.storage.dataRevision++;this.notify();}
 private async contextSlices(ids:Set<string>,includeGames:boolean){
  const candidates=[...ids],batches=candidates.length?Array.from({length:Math.ceil(candidates.length/6)},(_,i)=>candidates.slice(i*6,i*6+6)):[[]];
  let result:{revision:string;manifest:unknown;stats:unknown[];pairs:unknown[];games:unknown[]}|undefined;
  for(const [i,origins] of batches.entries()){
   const page=await this.request('/rest/v1/rpc/draft_context_slice',{candidates,origins,previous:[...this.candidates],known_revision:this.state.revision,include_metadata:i===0,include_games:includeGames&&i===0}) as {revision:string;manifest:unknown;stats:unknown[];pairs:unknown[];games:unknown[]};
   if(!result)result=page;else{if(result.revision!==page.revision)throw new Error('Statistics changed during collection; retry');result.pairs.push(...page.pairs);}
  }
  return result!;
 }
 async sync(draft:Draft=this.storage.draft,ideas:Selection[]=[],teams:Teams=this.storage.teams,preparePicks=false):Promise<void>{
  if(!this.state.configured)return;this.requireAccess();
  const needsPairs=preparePicks||order(draft)[draft.history.length]?.kind==='pick'||ideas.length>0||draft.history.some((s,i)=>s.championId&&order(draft)[i]?.kind==='pick');
  if(this.pending){if(!needsPairs&&this.storage.cloudData)return;await this.pending;return this.sync(draft,ideas,teams,preparePicks);}
  const ids=new Set([...draft.history,...ideas].flatMap(s=>s.championId?[s.championId]:[]));
  // Keep explicitly prepared matchups through the ban phase; picks replace stale contexts.
  if(!needsPairs)for(const id of this.candidates)ids.add(id);
  if(needsPairs)for(const team of Object.values(teams))for(const player of team.players)for(const champ of player.pool)if(champ.games>=3||(champ.games===0&&player.status==='manual'))ids.add(champ.championId);
  const names=draft.teamNames??{ally:'',enemy:''};this.storage.teamContext={blue:teamKey(names[draft.side==='blue'?'ally':'enemy'],this.storage.teams[draft.side==='blue'?'ally':'enemy']),red:teamKey(names[draft.side==='red'?'ally':'enemy'],this.storage.teams[draft.side==='red'?'ally':'enemy'])};
  if(needsPairs&&this.storage.cloudData)for(const id of contextChampionIds({...this.storage.engineInput(),draft,teams}))ids.add(id);
  if(ids.size===this.candidates.size&&[...ids].every(id=>this.candidates.has(id))&&this.storage.cloudData&&(!needsPairs||this.gamesRevision===this.state.revision)&&Date.now()-this.checkedAt<60000)return;
  const generation=this.state.userId;
  this.pending=(async()=>{this.state.syncing=true;this.notify();try{
   const includeGames=needsPairs&&(!this.storage.cloudData||this.gamesRevision!==this.state.revision);
   const data=await this.contextSlices(ids,includeGames);
   if(this.state.userId!==generation)return;
   const manifest=datasetSchema.parse(data.manifest);if(data.revision!==manifest.revision)throw new Error('Cloud dataset revision mismatch');
   const retained=data.revision===this.state.revision?(this.storage.cloudData?.pairs??[]).filter(p=>ids.has(p.championId)&&ids.has(p.otherId)):[];
   const pack=this.storage.validatePack({schemaVersion:1,id:'cloud-'+data.revision.slice(0,32),createdAt:manifest.createdAt,provenance:{name:'Supabase · gol.gg + Lolalytics Master+',url:SUPABASE.url,license:'Source attribution retained. Shared only with approved accounts.',demo:false},stats:data.stats,pairs:[...retained,...data.pairs],games:data.games.length?data.games:data.revision===this.state.revision?this.storage.cloudData?.games??[]:[]},new Set(manifest.champions.map(c=>c.id)));
   const models=await this.request('/rest/v1/draft_models?kind=eq.active&select=model') as {model:DraftModel}[];const profiles=await this.request('/rest/v1/draft_model_profiles?select=profile&user_id=eq.'+this.state.userId) as {profile:TeamProfile}[];if(this.state.userId!==generation||!this.state.authorized)return;
   this.storage.cloudData=pack;this.storage.cloudCoverage=manifest.coverage;this.storage.cloudChampions=manifest.champions;this.storage.dataRevision++;await this.syncKnowledge();
   const model=models[0]?.model;if(model){this.storage.set('draftModel',modelForDataset(model,data.revision,pack.stats.filter(s=>s.source==='pro').map(s=>s.patch)));}else this.storage.db.prepare('DELETE FROM kv WHERE key=?').run('draftModel');this.storage.teamProfiles=profiles.map(p=>p.profile);
   if(!draft.history.length&&draft.patch==='unknown'){this.storage.draft.patch=manifest.staticVersion.split('.').slice(0,2).join('.');this.storage.persist();}
   this.state.revision=data.revision;if(includeGames)this.gamesRevision=data.revision;this.state.message='Statistiques centrales à jour / Central statistics ready';this.candidates=ids;this.checkedAt=Date.now();
  }finally{this.state.syncing=false;this.notify();}})();
  try{await this.pending;}finally{this.pending=undefined;}
  // Initial metadata query then targeted context, automatically and without scraping.
  if(needsPairs&&this.storage.cloudData){const needed=contextChampionIds({...this.storage.engineInput(),draft,teams});if(this.gamesRevision!==this.state.revision||needed.some(id=>!this.candidates.has(id)))await this.sync(draft,ideas,teams,preparePicks);}
 }
 async records():Promise<ScrimRecord[]>{this.requireAccess();const rows=await this.request('/rest/v1/draft_matches?select=id,author,document&order=id.desc&limit=2000') as {id:number;author:string;document:unknown}[];return rows.map(r=>({...scrimSchema.parse(r.document),id:r.id,author:r.author}));}
 async pickPairs(championId:string){
  this.requireAccess();const user=this.state.userId,revision=this.state.revision;
  const data=await this.request('/rest/v1/rpc/draft_context_slice',{candidates:this.storage.champions().map(champ=>champ.id),origins:[championId],previous:[],known_revision:revision,include_metadata:false,include_games:false},'POST',true,user) as {revision:string;pairs:unknown[]};
  if(data.revision!==revision)throw new Error('Statistics changed: refresh draft');
  // This independent slice does not replace the live draft dataset or change its ranking on hover.
  return this.storage.validatePack({schemaVersion:1,id:'hover-'+championId,createdAt:new Date().toISOString(),provenance:{name:'Supabase · interactions',url:SUPABASE.url,license:'Approved accounts',demo:false},stats:[],pairs:data.pairs,games:[]}).pairs;
 }
 async save(document:ScrimDocument){this.requireAccess();await this.request('/rest/v1/draft_matches',{organization_id:this.state.organizationId,author:this.state.userId,document:scrimSchema.parse(document)});}
 async update(id:number,document:ScrimDocument){this.requireAccess();await this.request('/rest/v1/draft_matches?id=eq.'+id,{document:scrimSchema.parse(document)},'PATCH');}
 async remove(id:number){this.requireAccess();await this.request('/rest/v1/draft_matches?id=eq.'+id,undefined,'DELETE');}
 async loadGames(){this.requireAccess();if(this.storage.cloudData?.games.length)return;await this.sync();const data=await this.request('/rest/v1/rpc/draft_context_delta',{candidates:[],previous:[],known_revision:this.state.revision,include_games:true}) as {games:unknown[];revision:string};if(this.storage.cloudData&&data.revision===this.state.revision){this.storage.cloudData=this.storage.validatePack({...this.storage.cloudData,games:data.games});this.storage.dataRevision++;}}
 async coach():Promise<CoachState>{await this.loadGames();const local=this.storage.coach();const models=await this.request('/rest/v1/draft_models?select=kind,model') as {kind:string;model:DraftModel}[];const activeModel=models.find(m=>m.kind==='active')?.model;return {...local,activeModel,workspaces:await this.workspaces() as import('../shared/types').CloudWorkspace[],model:(this.state.role==='owner'?models.find(m=>m.kind==='candidate')?.model:undefined)??activeModel??null,scrims:await this.records()};}
 async storeCandidate(model:DraftModel,profiles:{userId:string;profile:TeamProfile}[]){if(this.state.role!=='owner')throw new Error('Administrator only');const sanitized={...model,features:Object.fromEntries(Object.entries(model.features).filter(([k])=>!k.startsWith('team:'))),datasetRevision:this.state.revision};await this.request('/rest/v1/draft_models?on_conflict=kind',{kind:'candidate',model:sanitized},'POST');for(const item of profiles)await this.request('/rest/v1/draft_model_profiles?on_conflict=user_id,team_key',{user_id:item.userId,team_key:item.profile.key,profile:item.profile},'POST');}
 async activate(active:boolean){if(this.state.role!=='owner')throw new Error('Administrator only');const coach=await this.coach(),candidate=active?coach.model:coach.activeModel??coach.model;if(!candidate||(active&&(!candidate.eligible||candidate.datasetRevision!==this.state.revision)))throw new Error('Model validation or dataset revision mismatch');await this.request('/rest/v1/draft_models?on_conflict=kind',{kind:'active',model:{...candidate,active}},'POST');this.checkedAt=0;await this.sync();}

}
