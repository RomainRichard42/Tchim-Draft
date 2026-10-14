import { championKit,knowledgePatch,patchNumber,type ChampionKit,type PatchChange,type KnowledgeDataset,type Ability,type Capability } from '../shared/knowledge';
import type { EngineInput,Role } from '../shared/types';
import { latestPatches } from '../shared/patches';
import { picks } from '../shared/draft';
export interface KitInteraction {from:string;to:string;fromSlot:Ability['slot'];toSlot:Ability['slot'];kind:string;reason:string;condition:string;value:number}
const ruleSet:{from:Capability;to:Capability;kind:string;fr:string;en:string;conditionFr:string;conditionEn:string;value:number}[]=[
 {from:'antiDash',to:'dash',kind:'antiDash',fr:'peut interrompre cette mobilité',en:'can interrupt this mobility',conditionFr:'Le dash doit traverser la zone ; les déplacements imparables restent une exception.',conditionEn:'The dash must cross the area; unstoppable movement is an exception.',value:1.5},
 {from:'projectileBlock',to:'projectile',kind:'projectileBlock',fr:'peut intercepter ce projectile',en:'can intercept this projectile',conditionFr:'Placement et délai disponibles nécessaires ; les rayons et effets non projectiles restent actifs.',conditionEn:'Requires positioning and an available cooldown; beams and non-projectile effects still work.',value:1},
 {from:'spellShield',to:'hardCC',kind:'spellShield',fr:'peut absorber un contrôle',en:'can absorb a crowd-control spell',conditionFr:'Un seul sort ou une courte fenêtre ; un autre sort peut consommer la protection.',conditionEn:'One spell or a short window; another spell can consume the protection.',value:.8},
 {from:'unstoppable',to:'hardCC',kind:'unstoppable',fr:'peut traverser une fenêtre de contrôle',en:'can bypass a control window',conditionFr:'Seulement pendant l’effet concerné ; cela ne supprime ni les dégâts ni le positionnement adverse.',conditionEn:'Only during the relevant effect; damage and enemy positioning still matter.',value:.8},
 {from:'antiHeal',to:'heal',kind:'antiHeal',fr:'peut réduire ces soins',en:'can reduce this healing',conditionFr:'La réduction doit être appliquée pendant les soins ; elle ne les annule pas.',conditionEn:'The reduction must be applied while healing occurs; it does not cancel healing.',value:1},
 {from:'shieldBreak',to:'shield',kind:'shieldBreak',fr:'peut casser ce bouclier',en:'can break this shield',conditionFr:'Il faut atteindre la cible et remplir la condition du sort, notamment la fureur pour Renekton.',conditionEn:'Requires reaching the target and meeting the spell condition, including fury for Renekton.',value:1}
];
function find(kit:ChampionKit,cap:Capability){return kit.abilities.find(a=>a.capabilities.includes(cap));}
export function kitInteractions(from:ChampionKit,to:ChampionKit,fr=true):KitInteraction[]{
 const result:KitInteraction[]=[];for(const rule of ruleSet){const own=find(from,rule.from),enemy=find(to,rule.to);if(!own||!enemy)continue;if(rule.kind==='antiDash'&&enemy.capabilities.includes('unstoppable'))continue;
  result.push({from:from.id,to:to.id,fromSlot:own.slot,toSlot:enemy.slot,kind:rule.kind,reason:from.name[fr?'fr':'en']+' '+own.slot+' '+(fr?rule.fr:rule.en)+' · '+to.name[fr?'fr':'en']+' '+enemy.slot,condition:fr?rule.conditionFr:rule.conditionEn,value:rule.value});
 }
 return result;
}
export function compositionKitEdge(input:EngineInput):{value:number;interactions:KitInteraction[]}{
 const get=(side:'blue'|'red')=>picks(input.draft,side).flatMap(p=>p.championId?championKit(input.knowledge,p.championId,input.draft.patch)??[]:[]),blue=get('blue'),red=get('red'),fr=input.settings.language==='fr';
 if(!blue.length||!red.length)return {value:0,interactions:[]};
 const forward=blue.flatMap(a=>red.flatMap(b=>kitInteractions(a,b,fr))),reverse=red.flatMap(a=>blue.flatMap(b=>kitInteractions(a,b,fr)));
 const value=(forward.reduce((n,e)=>n+e.value,0)-reverse.reduce((n,e)=>n+e.value,0))/Math.max(1,Math.sqrt(blue.length*red.length));
 return {value:Math.max(-4,Math.min(4,value)),interactions:[...forward,...reverse]};
}
export function relevantChanges(data:KnowledgeDataset|undefined,id:string,patch:string):PatchChange[]{
 const rows=knowledgePatch(data,patch)?.changes.filter(c=>c.championId===id)??[],byKey=new Map<string,PatchChange>();
 for(const row of rows){const key=row.slot+':'+row.label.toLowerCase(),old=byKey.get(key);if(!old||row.hotfix||!old.hotfix)byKey.set(key,row);}return [...byKey.values()];
}
const sourceWindows=new WeakMap<EngineInput['stats'],Record<string,string|undefined>>();
const priorCache=new WeakMap<KnowledgeDataset,Map<string,{value:number;changes:PatchChange[];unseenShare:number}>>();
export function patchPrior(input:EngineInput,id:string,role:Role):{value:number;changes:PatchChange[];unseenShare:number}{
 if(!input.knowledge||!knowledgePatch(input.knowledge,input.draft.patch))return {value:0,changes:[],unseenShare:0};
 let windows=sourceWindows.get(input.stats);if(!windows){windows=Object.fromEntries(['pro','solo'].map(source=>[source,latestPatches(input.stats.filter(s=>s.source===source&&s.games>0).map(s=>s.patch))[0]]));sourceWindows.set(input.stats,windows);}
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
export function changeImplications(change:PatchChange,opponent:ChampionKit|undefined,fr=true):string[]{
 const more=change.direction==='buff',less=change.direction==='nerf';if(!more&&!less)return [fr?'Changement à examiner : le sens ne peut pas être déduit de cette ligne seule.':'Review this change: direction cannot be inferred from this line alone.'];
 const direction=more?(fr?'plus':'more'):(fr?'moins':'less'),descriptions:Record<PatchChange['axis'],[string,string]>={damage:['de pression dans les échanges','trading pressure'],physicalDefense:['de résistance aux dégâts physiques','resistance to physical damage'],magicDefense:['de résistance aux dégâts magiques','resistance to magic damage'],durability:['de résistance aux dégâts','damage resistance'],health:['de marge contre le poke et les all-ins','room against poke and all-ins'],sustain:['de récupération entre les échanges','recovery between trades'],shield:['de protection pendant un échange','protection during a trade'],cooldown:['de fenêtres pour utiliser ce sort','windows to use this spell'],resource:['de ressources disponibles pour répéter les échanges','resources for repeated trades'],mobility:['de possibilités de repositionnement','repositioning options'],control:['de possibilités de verrouiller une cible','opportunities to lock down a target'],attackSpeed:['de pression par les attaques','attack pressure'],range:['de possibilités de jouer à distance','ranged options'],jungle:['de puissance potentielle contre les monstres','potential strength against monsters'],other:['de puissance potentielle à préciser','potential strength to review']};
 const [a,b]=descriptions[change.axis],result=[fr?'Hypothèse : '+direction+' '+a+'.':'Hypothesis: '+direction+' '+b+'.'];
 if(opponent){const has=(cap:Capability)=>opponent.abilities.some(s=>s.capabilities.includes(cap));
  if(change.axis==='sustain'&&has('antiHeal'))result.push(fr?'Les soins supplémentaires restent sensibles à sa réduction de soins.':'Additional healing remains vulnerable to its healing reduction.');
  if(change.axis==='shield'&&has('shieldBreak'))result.push(fr?'Son bris de bouclier peut réduire l’intérêt de ce changement.':'Its shield break can reduce the value of this change.');
  if(change.axis==='mobility'&&has('antiDash'))result.push(fr?'Sa réponse aux dashs reste à prendre en compte.':'Its answer to dashes still matters.');
  if(change.axis==='magicDefense'&&has('trueDamage'))result.push(fr?'La résistance magique ne réduit pas ses dégâts bruts.':'Magic resistance does not reduce its true damage.');
 }
 return result;
}
