import { load } from 'cheerio';
import type { ChampionKit,PatchChange } from '../shared/knowledge';
const clean=(s:string)=>s.replace(/\s+/g,' ').trim();
const normal=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
export function classifyChange(label:string,before:string,after:string):Pick<PatchChange,'axis'|'direction'|'magnitude'|'confidence'>{
 const key=label.toLowerCase();let axis:PatchChange['axis']='other',polarity=1;
 if(/monster|jungle/.test(key))axis='jungle';
 else if(/cooldown|recharge/.test(key)){axis='cooldown';polarity=-1;}
 else if(/cost/.test(key)){axis='resource';polarity=-1;}
 else if(/magic resist/.test(key))axis='magicDefense';
 else if(/armor/.test(key))axis='physicalDefense';
 else if(/damage reduction|damage taken/.test(key)){axis='durability';if(/damage taken/.test(key))polarity=-1;}
 else if(/heal|regen|lifesteal|omnivamp/.test(key))axis='sustain';
 else if(/shield/.test(key))axis='shield';
 else if(/damage|ad ratio|ap ratio/.test(key))axis='damage';
 else if(/health|hp/.test(key))axis='health';
 else if(/attack speed/.test(key))axis='attackSpeed';
 else if(/move.*speed|dash|distance/.test(key))axis='mobility';
 else if(/range/.test(key))axis='range';
 else if(/stun|root|slow|knock|duration/.test(key))axis='control';
 const values=(s:string)=>[...s.replace(/(?<=\d),(?=\d{3}\b)/g,'').matchAll(/(?<![a-zA-Z])\d*\.?\d+/g)].map(m=>Number(m[0]));
 const previous=values(before);let next=values(after);
 if(previous.length>1&&next.length===1&&before.includes('/')&&/^\d+(?:\.\d+)?(?:s|%)?$/.test(after.trim()))next=Array(previous.length).fill(next[0]);
 // A textual rework or a changed number of terms is reviewed, not assigned a fabricated sign.
 if(axis==='other'||!previous.length||previous.length!==next.length)return {axis,direction:'unknown',magnitude:0,confidence:'unclassified'};
 const deltas=previous.map((v,i)=>(next[i]-v)*polarity),positive=deltas.some(d=>d>0),negative=deltas.some(d=>d<0);
 const magnitude=Math.min(1,previous.reduce((n,v,i)=>n+Math.abs(next[i]-v)/Math.max(1,Math.abs(v)),0)/previous.length);
 return {axis,direction:positive&&negative?'mixed':positive?'buff':negative?'nerf':'unknown',magnitude,confidence:positive||negative?'numeric':'unclassified'};
}
export function parsePatchNotes(html:string,patch:string,kits:ChampionKit[],source:string):PatchChange[]{
 const $=load(html),heading=clean($('h1').first().text());
 const display=patch.split('.').map(Number);if(display[0]>=15)display[0]+=10;
 if(!heading.includes(display.join('.')))throw new Error('Patch page title does not match the requested version');
 const aliases=new Map(kits.flatMap(c=>[[normal(c.name.en),c.id],[normal(c.id),c.id]])),changes:PatchChange[]=[];
 let scope='',subject='',championId:string|undefined,section='',slot:PatchChange['slot']='other';
 for(const node of $('h2,h3,h4,li').toArray()){
  const tag=node.tagName,text=clean($(node).text());
  if(tag==='h2'){scope=text.toLowerCase();subject='';championId=undefined;section='';slot='other';continue;}
  const allowed=/^(champions|items|runes|summoner spells|system changes|systems|mid.patch updates)/.test(scope);if(!allowed)continue;
  if(tag==='h3'||tag==='h4'){
   const identified=aliases.get(normal(text));
   if(identified){championId=identified;subject=text;section='';slot='base';continue;}
   if(tag==='h3'&&!/mid.patch/.test(scope)){subject=text;championId=undefined;section='';slot='other';continue;}
   section=text;const letter=/^(?:Image\s*)?([QWER])\s*[-–]/.exec(text)?.[1];slot=letter as PatchChange['slot']??(/passive/i.test(text)?'P':/base stats/i.test(text)?'base':'other');continue;
  }
  if(!subject||$(node).find('li').length||!text.includes('⇒'))continue;
  const split=text.indexOf('⇒'),old=text.slice(0,split),colon=old.indexOf(':'),label=colon>=0?old.slice(0,colon).trim():section||subject,before=colon>=0?old.slice(colon+1).trim():old.trim(),after=text.slice(split+1).trim();
  const classified=classifyChange(label,before,after);
  changes.push({id:patch+'-'+changes.length,championId,subject,section,slot,hotfix:/mid.patch/.test(scope),label,before,after,kind:championId?'champion':scope==='items'?'item':'system',...classified,source});
 }
 if(!changes.length)throw new Error('Patch notes structure changed or contains no supported changes');
 return changes;
}
