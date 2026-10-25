import type {EngineInput,HistoricalGame,MetaEnvironment,MetaSnapshot,Role,Side,Stat} from '../shared/types';
import type {KnowledgeDataset} from '../shared/knowledge';
import {gameWeight,type WeightContext} from './learning-weights';
import {picks} from '../shared/draft';

export const META_POLICY={version:'patch-meta-v2',championPrior:20,soloPrior:500,pairPrior:24,proShare:.55,soloShare:.45,significantChange:.08} as const;
export type MetaPick={championId:string;role:Role};
export type MetaLineups=Record<Side,MetaPick[]>;
const key=(p:MetaPick)=>p.championId+':'+p.role;
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
const patchNumber=(p:string)=>{const [s,n]=p.split('.').map(Number);return s*100+n;};
const knownBefore=(date:string,asOf:string)=>Number.isFinite(Date.parse(date))&&Date.parse(date)<Date.parse(asOf);
export function gameLineups(game:HistoricalGame):MetaLineups{
 return game.lineups?{blue:game.lineups.blue.picks,red:game.lineups.red.picks}:{blue:picks({mode:'pro',history:game.history} as EngineInput['draft'],'blue').flatMap(p=>p.championId&&p.role?[{championId:p.championId,role:p.role}]:[]),red:picks({mode:'pro',history:game.history} as EngineInput['draft'],'red').flatMap(p=>p.championId&&p.role?[{championId:p.championId,role:p.role}]:[])};
}
function changesBetween(knowledge:KnowledgeDataset|undefined,id:string,from:string,context:WeightContext){
 return (knowledge?.patches??[]).filter(p=>knownBefore(p.fetchedAt,context.asOf)&&patchNumber(p.patch)>patchNumber(from)&&patchNumber(p.patch)<=patchNumber(context.livePatch)).flatMap(p=>p.changes.filter(c=>(c.championId===id||c.kind==='item'||c.kind==='system')&&c.magnitude>=META_POLICY.significantChange));
}
/** Changed champions lose historical support; unknown builds never imply a specific item buff. */
export function championRetention(id:string,from:string,context:WeightContext,knowledge?:KnowledgeDataset){
 const changes=changesBetween(knowledge,id,from,context);
 const direct=changes.filter(c=>c.championId===id).reduce((n,c)=>n+Math.min(1,c.magnitude*4),0);
 const environment=Math.min(1,changes.filter(c=>c.kind!=='champion').reduce((n,c)=>n+c.magnitude*.25,0));
 return 2**(-Math.min(3,direct+environment));
}
export function draftRetention(lineups:MetaLineups,from:string,context:WeightContext,knowledge?:KnowledgeDataset){
 const members=[...lineups.blue,...lineups.red];return members.length?members.reduce((n,p)=>n+championRetention(p.championId,from,context,knowledge),0)/members.length:1;
}
export interface ChampionMeta {proDelta:number;soloDelta:number;priority:number;patchDelta:number;proGames:number;soloGames:number;soloAvailable:boolean;newestProPatch?:string}
export interface MetaContext {profile:(pick:MetaPick)=>ChampionMeta;features:(lineups:MetaLineups)=>Record<string,number>;snapshotCount:number;historyGames:number}
type Count={n:number;residual:number};
const add=(map:Map<string,Count>,id:string,n:number,residual:number)=>{const row=map.get(id)??{n:0,residual:0};row.n+=n;row.residual+=residual*n;map.set(id,row);};
const pairKey=(a:MetaPick,b:MetaPick)=>[key(a),key(b)].sort().join('|');
const average=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0;

export function buildMetaContext(games:HistoricalGame[],environment:MetaEnvironment,context:WeightContext):MetaContext{
 const prior=[...new Map(games.filter(g=>g.playedAt&&knownBefore(g.playedAt,context.asOf)).map(g=>[g.id,g])).values()].map(game=>({game,lineups:gameLineups(game),weight:gameWeight({...game,source:'pro'},context)})).filter(g=>g.weight>0&&g.lineups.blue.length===5&&g.lineups.red.length===5);
 const total=prior.reduce((n,g)=>n+g.weight,0),blueRate=(prior.reduce((n,g)=>n+Number(g.game.winner==='blue')*g.weight,0)+1)/(total+2);
 const pro=new Map<string,Count>(),priority=new Map<string,number>(),bans=new Map<string,number>(),newest=new Map<string,string>();
 for(const {game,lineups,weight} of prior){
  for(const side of ['blue','red'] as const)for(const p of lineups[side]){
   const id=key(p),w=weight*championRetention(p.championId,game.patch,context,environment.knowledge);
   add(pro,id,w,Number(game.winner===side)-(side==='blue'?blueRate:1-blueRate));priority.set(id,(priority.get(id)??0)+w);
   if(!newest.has(id)||patchNumber(game.patch)>patchNumber(newest.get(id)!))newest.set(id,game.patch);
  }
  const excluded=game.lineups?[...game.lineups.blue.bans,...game.lineups.red.bans]:game.history.filter((_,i)=>[0,1,2,3,4,5,12,13,14,15].includes(i)).map(p=>p.championId);
  for(const id of new Set(excluded))if(id)bans.set(id,(bans.get(id)??0)+weight*championRetention(id,game.patch,context,environment.knowledge));
 }
 // An aggregate's collection time is its availability time, even if its patch is older.
 const available=(environment.snapshots??[]).filter(s=>knownBefore(s.availableAt,context.asOf));
 const observations=new Map<string,{row:Stat;at:string}>();
 for(const snapshot of available)for(const row of snapshot.stats){
  if(row.source!=='solo'||row.rank!=='MASTER_PLUS'||row.league!=='all'||row.games<=0||!Number.isFinite(row.wins)||row.wins<0||row.wins>row.games)continue;
  if(row.patch.split('.')[0]!==context.livePatch.split('.')[0]||patchNumber(row.patch)>patchNumber(context.livePatch))continue;
  const id=[row.championId,row.role,row.patch,row.side].join('|'),previous=observations.get(id);
  if(!previous||snapshot.availableAt>previous.at)observations.set(id,{row,at:snapshot.availableAt});
 }
 const solo=new Map<string,Count>();
 for(const {row,at} of observations.values()){
  if(row.side!=='all'&&observations.has([row.championId,row.role,row.patch,'all'].join('|')))continue;
  const weight=gameWeight({patch:row.patch,playedAt:at,league:'LPL'},context)*championRetention(row.championId,row.patch,context,environment.knowledge);
  add(solo,key(row),row.games*weight,row.wins/row.games-row.baseline);
 }
 const profiles=new Map<string,ChampionMeta>();
 const profile=(p:MetaPick):ChampionMeta=>{
  const id=key(p),cached=profiles.get(id);if(cached)return cached;
  const proRow=pro.get(id),soloRow=solo.get(id),observed=newest.get(id);
  // Directional notes are a bounded prior, not a fabricated post-patch win rate.
  const change=observed?changesBetween(environment.knowledge,p.championId,observed,context).filter(c=>c.championId===p.championId&&(c.direction==='buff'||c.direction==='nerf')&&(c.axis!=='jungle'||p.role==='JUNGLE')).reduce((n,c)=>n+(c.direction==='buff'?1:-1)*Math.min(.015,c.magnitude*.03),0):0;
  const result={proDelta:clamp((proRow?.residual??0)/((proRow?.n??0)+META_POLICY.championPrior),-.2,.2),soloDelta:clamp((soloRow?.residual??0)/((soloRow?.n??0)+META_POLICY.soloPrior),-.2,.2),priority:clamp(((priority.get(id)??0)+(bans.get(p.championId)??0))/Math.max(1,total),0,1),patchDelta:clamp(change,-.03,.03)*META_POLICY.soloPrior/((soloRow?.n??0)+META_POLICY.soloPrior),proGames:proRow?.n??0,soloGames:soloRow?.n??0,soloAvailable:!!soloRow,newestProPatch:observed};
  profiles.set(id,result);return result;
 };
 const synergy=new Map<string,Count>(),matchup=new Map<string,Count>();
 for(const {game,lineups,weight} of prior){
  for(const side of ['blue','red'] as const){const own=lineups[side],enemy=lineups[side==='blue'?'red':'blue'],y=Number(game.winner===side),sideRate=side==='blue'?blueRate:1-blueRate;
   for(let i=0;i<own.length;i++)for(let j=i+1;j<own.length;j++){const a=own[i],b=own[j],w=weight*Math.sqrt(championRetention(a.championId,game.patch,context,environment.knowledge)*championRetention(b.championId,game.patch,context,environment.knowledge));add(synergy,pairKey(a,b),w,y-sideRate-(profile(a).proDelta+profile(b).proDelta)/2);}
   for(const a of own)for(const b of enemy){const w=weight*Math.sqrt(championRetention(a.championId,game.patch,context,environment.knowledge)*championRetention(b.championId,game.patch,context,environment.knowledge));add(matchup,key(a)+'>'+key(b),w,y-sideRate-(profile(a).proDelta-profile(b).proDelta));}
  }
 }
 const residual=(row:Count|undefined)=>(row?.residual??0)/((row?.n??0)+META_POLICY.pairPrior);
 const ownSynergy=(members:MetaPick[])=>{const values:number[]=[];for(let i=0;i<members.length;i++)for(let j=i+1;j<members.length;j++)values.push(residual(synergy.get(pairKey(members[i],members[j]))));return average(values);};
 return {profile,snapshotCount:available.length,historyGames:prior.length,features:lineups=>{
  const strength=(members:MetaPick[])=>average(members.map(p=>{const m=profile(p);return m.proDelta*META_POLICY.proShare+m.soloDelta*META_POLICY.soloShare+m.patchDelta;}));
  const lane=lineups.blue.flatMap(a=>lineups.red.filter(b=>b.role===a.role).map(b=>residual(matchup.get(key(a)+'>'+key(b)))));
  return {'meta:strength':10*(strength(lineups.blue)-strength(lineups.red)),'meta:priority':average(lineups.blue.map(p=>profile(p).priority))-average(lineups.red.map(p=>profile(p).priority)),'meta:synergy':10*(ownSynergy(lineups.blue)-ownSynergy(lineups.red)),'meta:matchup':10*average(lane)};
 }};
}

const liveCache=new WeakMap<Stat[],{games:EngineInput['games'];snapshots:MetaSnapshot[]|undefined;knowledge:KnowledgeDataset|undefined;key:string;context:MetaContext}>();
export function liveMetaContext(input:EngineInput,asOf=new Date().toISOString()):MetaContext{
 const id=input.draft.patch+'|'+asOf.slice(0,10),cached=liveCache.get(input.stats);
 if(cached?.key===id&&cached.games===input.games&&cached.snapshots===input.metaSnapshots&&cached.knowledge===input.knowledge)return cached.context;
 const context=buildMetaContext(input.games??[],{snapshots:input.metaSnapshots,knowledge:input.knowledge},{asOf,livePatch:input.draft.patch});
 liveCache.set(input.stats,{games:input.games,snapshots:input.metaSnapshots,knowledge:input.knowledge,key:id,context});return context;
}
