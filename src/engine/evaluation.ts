import type { Champion, DraftBalance, EngineInput, MatchAxis, MatchEvaluation, Role, Side } from '../shared/types';
import { picks } from '../shared/draft';
import { clamp } from './math';
import { evidence, interaction } from './evidence';
import { mechanics } from './mechanics';
import { compositionKitEdge,patchPrior } from './kit-matchups';

import { damageShare } from './teamplay';

export type Member={champion:Champion;role:Role};
export function members(input:EngineInput,side:Side):Member[] {return picks(input.draft,side).flatMap(p=>{const champion=input.champions.find(c=>c.id===p.championId);return champion?[{champion,role:p.role}]:[];});}
const avg=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
const scale=(value:number)=>clamp(50+value*12);
export function confrontationFeatures(blue:Member[],red:Member[]):Record<string,number> {
 const axes=(own:Member[],enemy:Member[])=>{
  if(!own.length)return {lanes:50,bot:50,objectives:50,fight:50,access:50,side:50,execution:50,early:50,mid:50,late:50};
  const profiles=own.map(m=>mechanics(m.champion,m.role)),opponents=enemy.map(m=>mechanics(m.champion,m.role));
  const mean=(key:keyof Omit<ReturnType<typeof mechanics>,'provenance'>)=>avg(profiles.map(p=>p[key]));
  const sum=(key:keyof Omit<ReturnType<typeof mechanics>,'provenance'>)=>profiles.reduce((v,p)=>v+p[key],0);
  const threat=avg(opponents.map(p=>p.access)),enemyRange=avg(opponents.map(p=>p.range));
  const front=own.reduce((s,m)=>s+m.champion.traits.frontline,0),protect=sum('disengage'),reach=sum('access');
  const ad=damageShare(own.map(m=>m.champion),own.map(m=>m.role)),mix=own.length>=3?Math.abs(ad-.5)*2:0;
  const bot=own.filter(m=>m.role==='ADC'||m.role==='SUPPORT'),adc=bot.find(m=>m.role==='ADC'),support=bot.find(m=>m.role==='SUPPORT');
  const botScore=adc&&support?scale((mechanics(adc.champion,'ADC').range+mechanics(support.champion,'SUPPORT').control+mechanics(support.champion,'SUPPORT').disengage)/3-1.5):50;
  const carry=own.some(m=>m.role==='ADC'&&m.champion.traits.scaling>=2);
  const protection=protect/own.length,frontline=front/own.length;
  return {lanes:scale(avg(own.map(m=>m.champion.traits.early))-1.5),bot:botScore,
   objectives:scale(mean('waveclear')*.4+mean('control')*.4+mean('sustained')*.2-1.4),
   fight:clamp(50+frontline*1.5+protection*(4+(carry?threat*8:0))-mix*12-Math.max(0,threat-protection)*(carry?10:3)),
   access:scale(Math.min(3,reach/Math.max(1,own.length))-1.4-Math.max(0,enemyRange-mean('range'))*.45),
   side:scale((mean('mobility')+mean('sustained'))/2-1.5),execution:scale(2-mean('demand')),
   early:scale(avg(own.map(m=>m.champion.traits.early))-1.5),mid:scale((mean('control')+mean('waveclear'))/2-1.5),late:scale(avg(own.map(m=>m.champion.traits.scaling))-1.5)};
 };
 const b=axes(blue,red),r=axes(red,blue),features:Record<string,number>={};
 for(const key of Object.keys(b) as (keyof typeof b)[])features[key]=(b[key]-r[key])/50;
 for(const [list,sign] of [[blue,1],[red,-1]] as const)for(const m of list){const key='champ:'+m.champion.id+':'+m.role;features[key]=(features[key]??0)+sign;}
 return features;
}
export function evaluateMatch(input:EngineInput,lineups?:Record<Side,Member[]>):MatchEvaluation {
 const blue=lineups?.blue??members(input,'blue'),red=lineups?.red??members(input,'red'),features=confrontationFeatures(blue,red);
 const base=(side:Side,list:Member[])=>avg(list.map(m=>evidence(input,m.champion.id,m.role,side)?.delta??0));
 const synergies=(side:Side,list:Member[])=>{const values:number[]=[];for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)values.push(interaction(input,list[i].champion.id,list[i].role,list[j].champion.id,list[j].role,side,'synergy')?.delta??0);return avg(values);};
 const laneWeight:Record<Role,number>={TOP:1,MID:.7,JUNGLE:.3,ADC:.35,SUPPORT:.15};
 let matchup=0,total=0,covered=0;
 for(const b of blue)for(const r of red){const effect=interaction(input,b.champion.id,b.role,r.champion.id,r.role,'blue','matchup');const weight=b.role===r.role?laneWeight[b.role]:b.role==='SUPPORT'||r.role==='SUPPORT'?.35:.15;total+=weight;matchup+=(effect?.delta??0)*weight;if(effect?.usable)covered+=weight;}
 matchup=total?matchup/total:0;
 // The bot lane is assessed as four interactions, including opposing support/ADC.
 const bot: number[]=[];for(const b of blue.filter(m=>m.role==='ADC'||m.role==='SUPPORT'))for(const r of red.filter(m=>m.role==='ADC'||m.role==='SUPPORT'))bot.push(interaction(input,b.champion.id,b.role,r.champion.id,r.role,'blue','matchup')?.delta??0);
 features.bot=clamp(50+features.bot*30+avg(bot)*400)/50-1;
 const axes=(['lanes','bot','objectives','fight','access','side','execution'] as MatchAxis[]).map(key=>({key,blue:clamp(50+features[key]*25),red:clamp(50-features[key]*25),value:features[key]*50}));
 const weights=input.settings.weights,den=Math.max(1,weights.winrate+weights.matchup+weights.synergy+weights.composition);
 const composition=features.lanes*.08+features.bot*.16+features.objectives*.18+features.fight*.36+features.access*.06+features.side*.08+features.execution*.08;
 const raw=((base('blue',blue)-base('red',red))*400*weights.winrate+matchup*450*weights.matchup+(synergies('blue',blue)-synergies('red',red))*450*weights.synergy+composition*40*weights.composition)/den;
 const complete=blue.length===5&&red.length===5,model=input.model?.active&&input.model.eligible&&!input.demo&&complete?input.model:undefined;
 let adjustment=0;if(model&&input.teamContext)for(const side of ['blue','red'] as const){const profile=input.teamProfiles?.find(p=>p.key===input.teamContext![side]);if(profile&&profile.games>=20){const support=profile.games/(profile.games+50);const effect=Object.entries(profile.features).reduce((v,[key,w])=>v+w*(features[key]??0)*(side==='blue'?1:-1),0);adjustment+=Math.max(-4,Math.min(4,effect*support*4))*(side==='blue'?1:-1);}}
 const learned=model?Object.entries(features).reduce((v,[key,value])=>v+value*(model.features[key]??0),model.features.bias??0):0;
 const kit=compositionKitEdge(input),prior=(side:'blue'|'red',list:Member[])=>list.length?list.reduce((n,m)=>n+patchPrior({...input,draft:{...input.draft,side}},m.champion.id,m.role).value,0)/list.length:0;
 const patchEdge=prior('blue',blue)-prior('red',red);
 const value=Math.round(Math.max(-40,Math.min(40,raw*.85+(model?Math.tanh(learned/2)*30:raw)*.15+adjustment+kit.value+patchEdge))*10)/10;
 const fr=input.settings.language==='fr',names:Record<MatchAxis,string>=fr?{lanes:'pression des lanes',bot:'duo bot',objectives:'contrôle des objectifs',fight:'combat et protection',access:'accès aux carries',side:'pression latérale',execution:'facilité d’exécution'}:{lanes:'lane pressure',bot:'bot duo',objectives:'objective control',fight:'fighting and protection',access:'carry access',side:'side pressure',execution:'ease of execution'};
 const reasons=axes.filter(a=>Math.abs(a.value)>4).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)).slice(0,3).map(a=>(fr?'Avantage ':'Edge: ')+(a.value>0?(fr?'bleu':'blue'):(fr?'rouge':'red'))+' · '+names[a.key]);
 if(adjustment)reasons.push(fr?'Adaptation prudente aux résultats et notes de cette équipe.':'Conservative adaptation to this team’s results and coach ratings.');
 if(kit.interactions.length)reasons.push(fr?'Interactions de sorts prises en compte, sous conditions de placement et de délai.':'Spell interactions included, subject to positioning and cooldown conditions.');
 if(patchEdge)reasons.push(fr?'Effet de patch estimé et limité : les statistiques pro ne couvrent pas encore tous ces changements.':'Bounded patch estimate: pro statistics do not yet cover all these changes.');
 if(!complete)reasons.push(fr?'Composition incomplète : les réponses restantes peuvent inverser cet indice.':'Incomplete draft: remaining replies can reverse this index.');
 if([...blue,...red].some(m=>mechanics(m.champion,m.role).provenance==='generic'))reasons.push(fr?'Certains profils de capacités restent génériques.':'Some kit profiles remain generic.');
 return {value,axes,windows:{early:features.early*50,mid:features.mid*50,late:features.late*50},evidence:total?covered/total:0,partial:!complete,reasons,features,modelUsed:!!model};
}
export function matchBalance(input:EngineInput):DraftBalance {const evaluation=evaluateMatch(input),b=picks(input.draft,'blue').length,r=picks(input.draft,'red').length;return {value:evaluation.value,blue:{score:50+evaluation.value/2,count:b},red:{score:50-evaluation.value/2,count:r},revealed:b+r,complete:b+r===10};}
