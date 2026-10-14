import { createHash } from 'node:crypto';
import { mkdir,readFile,writeFile,rename } from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';
import { z } from 'zod';
import robotsParser from 'robots-parser';
import { knowledgeSchema,sourceUrlSchema,type Ability,type Capability,type ChampionKit,type KnowledgeDataset,type KnowledgePatch } from '../shared/knowledge';
import { parsePatchNotes } from './patch-notes';

const localized=(fr:string,en:string)=>({fr,en});
export function plainText(value:string){return load('<div>'+value+'</div>').text().replace(/\s+/g,' ').trim();}
const numArray=(value:unknown):number[]=>Array.isArray(value)?value.filter((n):n is number=>typeof n==='number'&&Number.isFinite(n)):[];
const dictionary=z.object({version:z.string(),data:z.record(z.object({id:z.string(),key:z.string(),name:z.string(),stats:z.record(z.number()),partype:z.string(),passive:z.object({name:z.string(),description:z.string()}),spells:z.array(z.object({id:z.string(),name:z.string(),description:z.string(),tooltip:z.string(),cooldown:z.array(z.number()),cost:z.array(z.number()),range:z.array(z.number()),resource:z.string(),effect:z.array(z.unknown()),vars:z.array(z.object({key:z.string(),link:z.string(),coeff:z.union([z.number(),z.array(z.number())])})).default([])})).length(4)}))});
type RawChampion=z.infer<typeof dictionary>['data'][string];
export function detectCapabilities(id:string,slot:Ability['slot'],description:string):Capability[]{
 const text=description.toLowerCase(),caps=new Set<Capability>();
 const patterns:Partial<Record<Capability,RegExp>>={dash:/\b(dash(?:es|ing)?|leaps?|lunges?)\b/,hardCC:/\b(stun(?:s|ned|ning)?|root(?:s|ed|ing)?|knock(?:s|ed)? (?:up|back)|airborne|suppress(?:es|ed|ion)?|charm(?:s|ed)?|fear(?:s|ed)?)\b/,slow:/\bslow(?:s|ed|ing)?\b/,heal:/\b(heal(?:s|ing)?|restore(?:s)? (?:their |his |her )?health)\b/,shield:/\bshield(?:s|ed|ing)?\b/,trueDamage:/\btrue damage\b/,percentHealth:/\b(max(?:imum)?|current|missing) health\b/,antiDash:/\b(interrupt(?:s)?|stop(?:s)?|prevent(?:s)?)\b.*\bdash/,spellShield:/spell shield/,projectileBlock:/block.*projectiles/,projectile:/\b(projectile|missile|orb|arrow|boomerang|bullet)\b/,unstoppable:/\b(unstoppable|immune to (?:disables|crowd control))\b/,antiHeal:/grievous wounds|reduc.*healing/,shieldBreak:/destroy.*shield|remov.*shield/,untargetable:/untargetable/,invulnerable:/invulnerable/};
 for(const [cap,pattern] of Object.entries(patterns))if(pattern.test(text))caps.add(cap as Capability);
 if(/magic damage|magicdamage>/.test(text))caps.add('magicDamage');if(/physical damage|physicaldamage>/.test(text))caps.add('physicalDamage');if(/truedamage>/.test(text))caps.add('trueDamage');
 // Explicit mechanics where the short summary omits the necessary qualifier. These are
 // tied to an ability, retain its source, and are conditional interactions, never counters.
 const verified:Record<string,Capability[]>={'Poppy:W':['antiDash'],'Yasuo:W':['projectileBlock'],'Samira:W':['projectileBlock'],'Braum:E':['projectileBlock'],'Sivir:E':['spellShield'],'Nocturne:W':['spellShield'],'Olaf:R':['unstoppable'],'Renekton:W':['shieldBreak'],'Blitzcrank:R':['shieldBreak'],'Katarina:R':['antiHeal']};
 for(const cap of verified[id+':'+slot]??[])caps.add(cap);
 // A wind wall itself is neither a dash nor a projectile just because its description names them.
 if(caps.has('antiDash'))caps.delete('dash');if(caps.has('projectileBlock'))caps.delete('projectile');
 if(caps.has('spellShield')||caps.has('shieldBreak'))caps.delete('shield');if(caps.has('antiHeal'))caps.delete('heal');
 return [...caps];
}
function ability(id:string,slot:Ability['slot'],en:RawChampion['spells'][number]|RawChampion['passive'],fr:typeof en):Ability{
 const active='tooltip' in en,other='tooltip' in fr;
 const unresolved=active?[...new Set([...en.tooltip.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map(m=>m[1]))].filter(k=>!['cost','cooldown'].includes(k)):[];
 return {slot,key:active?en.id:id+'Passive',name:localized(fr.name,en.name),description:localized(plainText(fr.description),plainText(en.description)),tooltip:localized(plainText(other?fr.tooltip:fr.description).replace(/\{\{[^}]*\}\}/g,'…'),plainText(active?en.tooltip:en.description).replace(/\{\{[^}]*\}\}/g,'…')),cooldown:active?en.cooldown:[],cost:active?en.cost:[],range:active?en.range:[],resource:localized(other?plainText(fr.resource).replace(/\{\{[^}]*\}\}/g,'…'):'',active?plainText(en.resource).replace(/\{\{[^}]*\}\}/g,'…'):''),effects:active?en.effect.map(v=>v===null?null:numArray(v)):[],variables:active?en.vars.map(v=>({...v,coeff:typeof v.coeff==='number'?[v.coeff]:v.coeff})):[],parameters:{},capabilities:detectCapabilities(id,slot,en.description+' '+(active?en.tooltip:'')),unresolved};
}
export function parseChampionKits(enRaw:unknown,frRaw:unknown,version:string):ChampionKit[]{
 const en=dictionary.parse(enRaw),fr=dictionary.parse(frRaw);if(en.version!==version||fr.version!==version)throw new Error('Champion file version mismatch');
 return Object.values(en.data).map(c=>{const translated=fr.data[c.id];if(!translated)throw new Error('Missing translated champion');return {id:c.id,key:Number(c.key),name:localized(translated.name,c.name),stats:c.stats,resource:localized(translated.partype,c.partype),source:'https://ddragon.leagueoflegends.com/cdn/'+version+'/data/en_US/champion/'+c.id+'.json',abilities:[ability(c.id,'P',c.passive,translated.passive),...c.spells.map((s,i)=>ability(c.id,(['Q','W','E','R'] as const)[i],s,translated.spells[i]))]};});
}
export class KnowledgeHttp{
 private last=0;
 private robots=new Map<string,ReturnType<typeof robotsParser>>();
 constructor(private root:string,private force=false,private log:(message:string)=>void=()=>{}){}
 async get(url:string,immutable=false):Promise<string>{
  sourceUrlSchema.parse(url);await mkdir(this.root,{recursive:true});const hash=createHash('sha256').update(url).digest('hex'),file=path.join(this.root,hash+'.json');
  const cached=await readFile(file,'utf8').then(s=>JSON.parse(s) as {text:string;etag?:string;at:string}).catch(()=>undefined);
  if(cached&&(immutable||!this.force&&Date.now()-Date.parse(cached.at)<3600000)){this.log('Cache '+new URL(url).pathname);return cached.text;}
  const origin=new URL(url).origin;
  // Data Dragon is Riot's documented static-data API (its absent robots resource returns
  // 403). Robots rules apply to the article/archive crawling; API refusals still stop get().
  if(!this.robots.has(origin)){if(origin==='https://ddragon.leagueoflegends.com')this.robots.set(origin,robotsParser(origin+'/robots.txt',''));else{const res=await fetch(origin+'/robots.txt',{redirect:'error',signal:AbortSignal.timeout(20000)});if([401,403,429].includes(res.status))throw new Error('Robots access refused');this.robots.set(origin,robotsParser(origin+'/robots.txt',res.ok?await res.text():''));}}
  const robots=this.robots.get(origin)!;if(robots.isAllowed(url,'TchimDraft')===false)throw new Error('Source robots excludes this page');
  const wait=Math.max(0,Math.max(350,(robots.getCrawlDelay('TchimDraft')??0)*1000)-(Date.now()-this.last));if(wait)await new Promise(resolve=>setTimeout(resolve,wait));this.last=Date.now();
  const response=await fetch(url,{headers:{'User-Agent':'TchimDraft/0.12 (+champion data and patch analysis)','Accept':'application/json,text/html;q=0.8',...(cached?.etag?{'If-None-Match':cached.etag}:{})},redirect:'error',signal:AbortSignal.timeout(30000)});
  if(response.status===304&&cached)return cached.text;if(!response.ok)throw new Error('Knowledge source HTTP '+response.status+' '+new URL(url).pathname);
  let length=0;const chunks:Uint8Array[]=[];if(!response.body)throw new Error('Empty knowledge response');for await(const bytes of response.body as unknown as AsyncIterable<Uint8Array>){length+=bytes.length;if(length>16000000)throw new Error('Knowledge response exceeds limit');chunks.push(bytes);}
  const text=Buffer.concat(chunks).toString('utf8');await writeFile(file+'.tmp',JSON.stringify({url,text,etag:response.headers.get('etag'),at:new Date().toISOString()}));await rename(file+'.tmp',file);this.log('Collected '+new URL(url).pathname);return text;
 }
}
export function enrichKitParameters(kit:ChampionKit,raw:unknown,url:string){
 const entries=Object.entries(z.record(z.unknown()).parse(raw)).flatMap(([key,value])=>value&&typeof value==='object'&&'mSpell' in value?[{key,spell:(value as {mSpell:Record<string,unknown>}).mSpell}]:[]);
 for(const ability of kit.abilities){const main=entries.find(e=>e.key.toLowerCase().endsWith('/'+ability.key.toLowerCase()))??entries.find(e=>e.key.toLowerCase().endsWith('/'+(kit.id+ability.slot).toLowerCase()));if(!main||!Array.isArray(main.spell.DataValues))continue;
  for(const value of main.spell.DataValues as {name?:unknown;values?:unknown}[])if(typeof value.name==='string'&&value.name.length<=100){const numbers=numArray(value.values);if(numbers.length&&numbers.length<=20)ability.parameters[value.name]=numbers.map(n=>Math.round(n*1000000)/1000000);}
 }
 if(kit.abilities.some(a=>Object.keys(a.parameters).length))kit.parameterSource=url;
}
export async function collectKnowledge(root:string,force=false,log:(message:string)=>void=()=>{},enrich=true):Promise<KnowledgeDataset>{
 const http=new KnowledgeHttp(root,force,log),versions=z.array(z.string()).parse(JSON.parse(await http.get('https://ddragon.leagueoflegends.com/api/versions.json'))).filter(v=>/^\d{1,2}\.\d{1,2}\.\d+$/.test(v));
 const selected:string[]=[];for(const v of versions)if(!selected.some(p=>p.split('.').slice(0,2).join('.')===v.split('.').slice(0,2).join('.'))){selected.push(v);if(selected.length===3)break;}
 if(selected.length!==3)throw new Error('Three valid static-data versions required');
 const patches:KnowledgePatch[]=[];
 for(const version of selected){
  const patch=version.split('.').slice(0,2).join('.'),[major,minor]=patch.split('.').map(Number),displayPatch=(major>=15?major+10:major)+'.'+minor;
  const base='https://ddragon.leagueoflegends.com/cdn/'+version+'/data/';
  const en=JSON.parse(await http.get(base+'en_US/championFull.json',true)),fr=JSON.parse(await http.get(base+'fr_FR/championFull.json',true)),kits=parseChampionKits(en,fr,version);
  const notesUrl='https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-'+displayPatch.replace('.','-')+'-notes/';
  let changes:KnowledgePatch['changes']=[],notesAvailable=false;const warnings:string[]=[];
  try{changes=parsePatchNotes(await http.get(notesUrl),patch,kits,notesUrl);notesAvailable=true;}catch(error){warnings.push('Patch notes unavailable or unreadable: '+String(error).slice(0,250));}
  patches.push({patch,displayPatch,version,fetchedAt:new Date().toISOString(),notesUrl,notesAvailable,kits,changes,warnings});log(patch+' · '+kits.length+' champions · '+changes.length+' changes');
  if(enrich&&version===selected[0]){let failed=0;for(const [i,kit] of kits.entries()){const url='https://raw.communitydragon.org/'+patch+'/game/data/characters/'+kit.id.toLowerCase()+'/'+kit.id.toLowerCase()+'.bin.json';try{enrichKitParameters(kit,JSON.parse(await http.get(url)),url);}catch(error){failed++;if(/HTTP (401|403|429)/.test(String(error)))throw error;}if(i%20===0)log('Parameters '+(i+1)+'/'+kits.length);}if(failed)warnings.push(failed+' champion parameter files unavailable; Data Dragon facts retained.');}
 }
 const canonical=JSON.stringify(patches.map(p=>({...p,fetchedAt:undefined}))),revision=createHash('sha256').update(canonical).digest('hex');return knowledgeSchema.parse({schema:1,revision,createdAt:new Date().toISOString(),patches});
}
