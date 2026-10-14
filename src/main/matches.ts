import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { MatchPreparation, MatchLibrary, MatchSetup, MatchResult } from '../shared/types';
import { matchDocumentSchema, matchSetupSchema, matchResultSchema, scrimSchema } from '../shared/validation';
import { newDraft, seriesFinished } from '../shared/draft';
import { validateDraft } from '../shared/series';
import type { Storage } from './storage';
import type { CloudService } from './cloud';

const rowSchema=z.object({id:z.string().uuid(),author:z.string().uuid(),updated_at:z.string(),revision:z.number().int(),document:matchDocumentSchema});
const copy=<T>(value:T):T=>structuredClone(value);
/** Private match documents; statistical datasets are never published by this service. */
export class MatchService {
  private timer?:ReturnType<typeof setTimeout>;
  private running?:Promise<void>;
  private message='';
  private recording=false;
  constructor(private storage:Storage,private cloud:CloudService,private notify:()=>void){}
  private owner(){this.cloud.requireAccess();return this.cloud.state.configured?this.cloud.state.userId:'local';}
  private key(owner=this.owner()){return 'matches:'+owner;}
  private cached(owner=this.owner()){return this.storage.get<MatchPreparation[]>(this.key(owner))??[];}
  private write(rows:MatchPreparation[],owner=this.owner()){this.storage.set(this.key(owner),rows);}
  private active(owner=this.owner()){return this.storage.get<string>('activeMatch:'+owner)??null;}
  private summary(){
    if(this.cloud.state.configured&&!this.cloud.state.authorized){this.storage.match=undefined;return;}
    const row=this.cached().find(row=>row.id===this.active());
    this.storage.match=row?{id:row.id,name:row.document.name,kind:row.document.kind,archived:row.document.archived,results:row.document.results,message:this.message}:undefined;
  }
  detach(){clearTimeout(this.timer);this.storage.match=undefined;this.storage.set('activeMatch:'+this.owner(),null);}
  capture(){
    if(this.cloud.state.configured&&!this.cloud.state.authorized){this.storage.match=undefined;return;}
    const rows=this.cached(),row=rows.find(row=>row.id===this.active());
    if(!row||row.author!==this.owner()||row.document.archived)return;
    const draft=copy(this.storage.draft),teams=copy(this.storage.teams);
    if(JSON.stringify([row.document.draft,row.document.teams])===JSON.stringify([draft,teams])){this.summary();return;}
    row.document={...row.document,name:draft.seriesName?.trim()||row.document.name,draft,teams};row.updatedAt=new Date().toISOString();row.pending=true;
    this.write(rows);this.summary();this.schedule();
  }
  private schedule(){clearTimeout(this.timer);this.timer=setTimeout(()=>{void this.flush().catch(()=>{});},900);}
  async flush():Promise<void>{
    clearTimeout(this.timer);
    if(this.running){await this.running;return this.flush();}
    if(!this.cloud.state.configured||!this.cloud.state.authorized)return;
    const owner=this.owner();
    this.running=this.push(owner);
    try{await this.running;}finally{this.running=undefined;}
  }
  private async push(owner:string){
    try{
      for(const pending of this.cached(owner).filter(row=>row.pending&&!row.conflict&&row.author===owner)){
        const sent=copy(pending);
        const endpoint=sent.revision===0?'/rest/v1/draft_preparations':'/rest/v1/draft_preparations?id=eq.'+sent.id+'&revision=eq.'+sent.revision;
        const body=sent.revision===0?{id:sent.id,author:owner,document:sent.document}:{document:sent.document};
        let response:z.infer<typeof rowSchema>[];
        try{response=z.array(rowSchema).parse(await this.cloud.request(endpoint,body,sent.revision===0?'POST':'PATCH',true,owner,'return=representation'));}
        catch(error){if(sent.revision!==0||!String(error).includes('409'))throw error;response=[];}
        if(!response.length){
          // A timed-out request may already have committed. Reconcile only identical documents.
          const remote=z.array(rowSchema).parse(await this.cloud.request('/rest/v1/draft_preparations?id=eq.'+sent.id+'&select=id,author,document,updated_at,revision',undefined,'GET',true,owner));
          if(remote[0]?.author===owner&&JSON.stringify(remote[0].document)===JSON.stringify(matchDocumentSchema.parse(sent.document)))response=remote;
          else{const rows=this.cached(owner),current=rows.find(row=>row.id===sent.id);if(current){current.conflict=true;this.write(rows,owner);}throw new Error('Ce match a été modifié ailleurs. Ouvre-le pour conserver ton brouillon dans une copie / This match changed elsewhere; open it to keep your draft as a copy');}
        }
        const server=response[0],rows=this.cached(owner),current=rows.find(row=>row.id===sent.id);
        if(current){current.revision=server.revision;current.pending=JSON.stringify(current.document)!==JSON.stringify(sent.document);if(!current.pending)current.updatedAt=server.updated_at;this.write(rows,owner);}
      }
      if(this.cloud.state.userId===owner){this.message=this.cached(owner).some(row=>row.conflict)?'Un brouillon a été modifié ailleurs. Ouvre-le pour en conserver une copie / A draft changed elsewhere; open it to keep a copy':'';this.summary();this.notify();if(this.cached(owner).some(row=>row.pending&&!row.conflict&&row.author===owner))this.schedule();}
    }catch(error){if(this.cloud.state.userId===owner){this.message=String(error).includes('changed elsewhere')?String(error):'Sauvegardé sur cet ordinateur ; synchronisation à réessayer / Saved locally; sync will retry';this.summary();this.notify();}throw error;}
  }
  async list():Promise<MatchLibrary>{
    const owner=this.owner();
    if(this.cloud.state.configured){
      try{
        await this.flush();
        const remote=z.array(rowSchema).parse(await this.cloud.request('/rest/v1/draft_preparations?select=id,author,document,updated_at,revision&order=updated_at.desc&limit=500',undefined,'GET',true,owner));
        if(owner!==this.owner())throw new Error('Account changed');
        const rows=this.cached(owner),active=rows.find(row=>row.id===this.active(owner)),map=new Map(rows.filter(row=>row.pending).map(row=>[row.id,row]));
        for(const row of remote)if(!map.has(row.id))map.set(row.id,{id:row.id,author:row.author,updatedAt:row.updated_at,revision:row.revision,document:row.document});
        const next=map.get(this.active(owner)??'');
        if(next&&active&&!active.pending&&next.revision>active.revision&&next.author===owner){
          this.storage.draft=validateDraft(copy(next.document.draft),new Set(this.storage.champions().map(champ=>champ.id)));this.storage.teams=copy(next.document.teams);this.storage.persist();
        }
        this.write([...map.values()],owner);this.message='';
      }catch{this.message ||= 'Liste locale ; connexion à réessayer / Local list; retry connection';}
    }
    this.summary();return {matches:this.cached().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),activeId:this.active(),message:this.message};
  }
  async create(raw:unknown){
    const setup=matchSetupSchema.parse(raw),owner=this.owner();this.capture();await this.flush().catch(()=>{});
    if(owner!==this.owner())throw new Error('Account changed');
    const rows=this.cached();if(rows.filter(row=>row.author===owner).length>=500)throw new Error('Limite de 500 préparations / 500 preparations maximum');
    if(this.storage.draft.history.length&&!this.active())this.storage.saveSession('Avant nouveau match / Before new match');
    const draft={...newDraft(setup.patch),side:setup.side,teamNames:{ally:setup.ally,enemy:setup.enemy},seriesName:setup.name,series:{format:setup.format,fearless:setup.fearless&&setup.format!=='single',games:[]}};
    const teams={ally:{url:setup.urls.ally,region:'euw',players:[],poolOnly:false,message:''},enemy:{url:setup.urls.enemy,region:'euw',players:[],poolOnly:false,message:''}};
    const row:MatchPreparation={id:randomUUID(),author:owner,updatedAt:new Date().toISOString(),revision:0,pending:true,document:{name:setup.name,kind:setup.kind,draft,teams,archived:false,results:[]}};
    this.write([...rows,row]);this.storage.set('activeMatch:'+owner,row.id);this.storage.draft=draft;this.storage.teams=teams;this.storage.persist();this.summary();this.schedule();
  }
  async open(id:string){
    const owner=this.owner();this.capture();await this.flush().catch(()=>{});if(owner!==this.owner())throw new Error('Account changed');
    const row=this.cached().find(row=>row.id===id);if(!row)throw new Error('Match introuvable / Match not found');let opened=row;
    if(this.storage.draft.history.length&&!this.active())this.storage.saveSession('Avant ouverture du match / Before opening match');
    // The administrator reviews another coach by creating a private copy, never editing their document.
    if(row.author!==this.owner()||row.conflict){
      const own={...copy(row),id:randomUUID(),author:this.owner(),revision:0,pending:true,conflict:false,updatedAt:new Date().toISOString(),document:{...copy(row.document),name:row.document.name.slice(0,92)+' · copie',archived:false,results:[]}};
      own.document.draft.seriesName=own.document.name;opened=own;
      this.write([...this.cached(),own]);this.storage.set('activeMatch:'+this.owner(),own.id);this.schedule();
    }else this.storage.set('activeMatch:'+this.owner(),id);
    this.storage.draft=validateDraft(copy(opened.document.draft),new Set(this.storage.champions().map(champ=>champ.id)));this.storage.teams=copy(opened.document.teams);this.storage.persist();this.summary();
  }
  async archive(id:string,archived:boolean){
    this.capture();const rows=this.cached(),row=rows.find(row=>row.id===id&&row.author===this.owner());if(!row)throw new Error('Match introuvable / Match not found');
    row.document.archived=archived;row.pending=true;row.updatedAt=new Date().toISOString();this.write(rows);this.summary();await this.flush().catch(()=>{});return this.list();
  }
  async result(raw:unknown){
    if(this.recording)throw new Error('Enregistrement en cours / Recording in progress');
    this.recording=true;
    try{await this.storeResult(raw);}finally{this.recording=false;}
  }
  private async storeResult(raw:unknown){
    const result=matchResultSchema.parse(raw),owner=this.owner(),row=this.cached().find(row=>row.id===this.active()&&row.author===owner);
    if(!row||row.document.archived)throw new Error('Ouvre un match actif / Open an active match');
    if(seriesFinished(this.storage.draft))throw new Error('Série déjà terminée / Series complete');
    const draft=validateDraft(copy(this.storage.draft),new Set(this.storage.champions().map(c=>c.id))),game=draft.series?.games.length??0;
    const old=row.document.results.find(result=>result.game===game);
    let playedAt=new Date().toISOString(),existingId=old?.id;
    if(old){const previous=this.cloud.state.configured?((await this.cloud.request('/rest/v1/draft_matches?id=eq.'+old.id+'&select=document',undefined,'GET',true,owner)) as {document:{playedAt:string}}[])[0]?.document:this.storage.scrims().find(record=>record.id===old.id);if(previous)playedAt=previous.playedAt;else existingId=undefined;}
    const document=scrimSchema.parse({name:row.document.name+' · G'+(game+1),playedAt,draft,teams:copy(this.storage.teams),winner:result.winner,coachRating:result.coachRating,kills:result.kills,notes:result.notes,rival:draft.teamNames?.enemy??'',blueTeam:draft.teamNames?.[draft.side==='blue'?'ally':'enemy'],redTeam:draft.teamNames?.[draft.side==='red'?'ally':'enemy'],seriesName:row.document.name});
    let id=existingId;
    if(this.cloud.state.configured){
      if(id)await this.cloud.request('/rest/v1/draft_matches?id=eq.'+id,{document},'PATCH',true,owner);
      else {const saved=await this.cloud.request('/rest/v1/draft_matches',{organization_id:this.cloud.state.organizationId,author:owner,document},'POST',true,owner,'return=representation') as {id:number}[];id=z.number().int().positive().parse(saved[0]?.id);}
    }else if(id)this.storage.updateScrim(id,document);else{this.storage.saveScrim(document);id=this.storage.scrims()[0]?.id;}
    if(owner!==this.owner())throw new Error('Account changed');
    const rows=this.cached(),current=rows.find(candidate=>candidate.id===row.id)!;
    current.document.results=[...current.document.results.filter(result=>result.game!==game),{game,id:id!}];current.pending=true;current.updatedAt=new Date().toISOString();this.write(rows);this.capture();this.summary();await this.flush().catch(()=>{});
  }
  async completedWinner(){
    const owner=this.owner(),id=this.active(),row=this.cached().find(row=>row.id===id&&row.author===owner);
    if(!row)return undefined;
    const result=row.document.results.find(result=>result.game===(this.storage.draft.series?.games.length??0));
    if(!result)throw new Error('Enregistre le résultat avant de passer à la manche suivante / Record the result before the next game');
    const document=this.cloud.state.configured?((await this.cloud.request('/rest/v1/draft_matches?id=eq.'+result.id+'&select=document',undefined,'GET',true,owner)) as {document:unknown}[])[0]?.document:this.storage.scrims().find(record=>record.id===result.id);
    if(owner!==this.owner()||id!==this.active())throw new Error('Match changed');
    const {id:recordId,author:recordAuthor,...raw}=(document as Record<string,unknown>)??{};
    const parsed=scrimSchema.parse(raw);
    if(!parsed.winner||JSON.stringify(parsed.draft.history)!==JSON.stringify(this.storage.draft.history))throw new Error('La draft a changé. Enregistre à nouveau le résultat / Draft changed; record the result again');
    return parsed.winner;
  }
  stop(){clearTimeout(this.timer);}
}
