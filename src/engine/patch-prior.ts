import {championKit,knowledgePatch,patchNumber,type KnowledgeDataset,type PatchChange,type Capability} from '../shared/knowledge';
import type {EngineInput,Role} from '../shared/types';
import {latestPatches} from '../shared/patches';
import {picks} from '../shared/draft';
import {prepare} from './evidence';
import {relevantChanges} from './kit-matchups';
const sourceWindows=new WeakMap<object,Map<string,Record<string,string|undefined>>>();
const priorCache=new WeakMap<KnowledgeDataset,Map<string,{value:number;changes:PatchChange[];unseenShare:number}>>();
export function patchPrior(input:EngineInput,id:string,role:Role):{value:number;changes:PatchChange[];unseenShare:number}{
 if(!input.knowledge||!knowledgePatch(input.knowledge,input.draft.patch))return {value:0,changes:[],unseenShare:0};
 const prepared=prepare(input);
 let candidates=sourceWindows.get(prepared);if(!candidates){candidates=new Map();sourceWindows.set(prepared,candidates);}
 const key=id+':'+role+':'+input.draft.patch+':'+input.draft.side;
 let windows=candidates.get(key);if(!windows){windows=Object.fromEntries(['pro','solo'].map(source=>[source,latestPatches((prepared.stats.get(id+'|'+role)??[]).filter(s=>s.source===source&&s.games>=(source==='pro'?10:200)&&(s.side==='all'||s.side===input.draft.side)&&patchNumber(s.patch)<=patchNumber(input.draft.patch)).map(s=>s.patch))[0]]));candidates.set(key,windows);}
 const opposition=picks(input.draft,input.draft.side==='blue'?'red':'blue');
 const allEnemies=opposition.flatMap(p=>p.championId?championKit(input.knowledge,p.championId,input.draft.patch)??[]:[]);
 const laneEnemies=opposition.filter(p=>p.role===role).flatMap(p=>p.championId?championKit(input.knowledge,p.championId,input.draft.patch)??[]:[]),lane=laneEnemies.length?laneEnemies:allEnemies;
 const has=(cap:Capability)=>allEnemies.some(k=>k.abilities.some(a=>a.capabilities.includes(cap))),magic=lane.some(k=>k.abilities.some(a=>a.capabilities.includes('magicDamage'))),physical=lane.some(k=>k.abilities.some(a=>a.capabilities.includes('physicalDamage')));
 const context=(c:PatchChange)=>c.axis==='magicDefense'&&physical&&!magic?.25:c.axis==='physicalDefense'&&magic&&!physical?.25:c.axis==='sustain'&&has('antiHeal')?.6:c.axis==='shield'&&has('shieldBreak')?.6:c.axis==='mobility'&&has('antiDash')?.65:1;
 let cache=priorCache.get(input.knowledge);if(!cache){cache=new Map();priorCache.set(input.knowledge,cache);}const cacheKey=JSON.stringify([id,role,input.draft.patch,input.draft.mode,windows,opposition]);const saved=cache.get(cacheKey);if(saved)return saved;
 const sources=input.draft.mode==='pro'?{pro:.55,solo:.45}:{pro:.1,solo:.9};let total=0,unseenShare=0;const used=new Map<string,PatchChange>();
 for(const [source,weight] of Object.entries(sources)){
  const observed=windows[source];
  if(!observed)continue;let local=0;
  for(const patch of input.knowledge.patches.filter(p=>patchNumber(p.patch)>patchNumber(observed)&&patchNumber(p.patch)<=patchNumber(input.draft.patch))){
   const changes=relevantChanges(input.knowledge,id,patch.patch);
   for(const c of changes){if(c.direction==='unknown'||c.direction==='mixed')continue;
    // Jungle monster modifiers are role-specific; an unspecified item build is never imputed.
    if(c.axis==='jungle'&&role!=='JUNGLE')continue;
    local+=(c.direction==='buff'?1:-1)*Math.min(1,c.magnitude*4)*.7*context(c);used.set(c.id,c);
   }
  }
  if(local){unseenShare+=weight;total+=Math.max(-2,Math.min(2,local))*weight;}
 }
 const result={value:Math.max(-2,Math.min(2,total)),changes:[...used.values()],unseenShare};if(cache.size>20000)cache.clear();cache.set(cacheKey,result);return result;
}
