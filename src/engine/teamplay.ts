import type { Champion, Role } from '../shared/types';
import { clamp } from './math';

const group=(ids:string)=>new Set(ids.split(' '));
// Explicit mechanics, qualitative expert rules. These are not scraped win rates or a trained model.
const delivery=group('JarvanIV Malphite Rakan Vi Wukong MonkeyKing Zac Diana Hecarim Nocturne Camille Alistar Rell Amumu');
const aoe=group('Orianna MissFortune Rumble Kennen Diana Yasuo Yone Neeko Viktor Hwei Brand Seraphine Zyra Fiddlesticks Karthus');
const hypercarry=group('Jinx Aphelios KogMaw Twitch Zeri Vayne Sivir Smolder');
const dive=group('Akali Camille Irelia Jax Vi Nocturne Hecarim Diana MonkeyKing JarvanIV Rengar Khazix Zed Talon Renekton Riven Yone Yasuo');
const initiation=new Set([...delivery,...group('Nautilus Leona Sejuani Ornn Maokai Blitzcrank Thresh')]);
const disengage=group('Janna Poppy Gragas Braum Milio Renata Lulu TahmKench Thresh Taric Xayah');
const immobile=group('Jinx Aphelios KogMaw Varus Ashe MissFortune Xerath Velkoz Ziggs Viktor Orianna Syndra Lux Hwei');
const siege=group('Jayce Varus Ezreal Caitlyn Xerath Velkoz Ziggs Lux Hwei Zoe Nidalee Karma');
const antiTank=group('KogMaw Vayne Gwen Fiora Trundle Brand Cassiopeia Varus Velkoz Lillia');
const split=group('Fiora Tryndamere Yorick Jax Camille Nasus Trundle');
const damageWeight:Record<Role,number>={TOP:1,JUNGLE:.85,MID:1.3,ADC:1.6,SUPPORT:.18};
export function damageShare(team:Champion[],roles:Role[]=[]):number{
  let ad=0,total=0;team.forEach((c,i)=>{const w=roles[i]?damageWeight[roles[i]]:c.tags.includes('Support')?.2:1;ad+=c.traits.ad*w;total+=w;});return total?ad/total:.5;
}
export function teamplay(candidate:Champion,role:Role,allies:Champion[],allyRoles:Role[],enemies:Champion[],language='fr'):{score:number;synergy:number;reasons:string[]}{
  let value=0,synergy=0;const reasons:string[]=[];
  const sum=(team:Champion[],key:keyof Champion['traits'])=>team.reduce((s,c)=>s+c.traits[key],0);
  const add=(delta:number,reason:string,combo=false)=>{value+=delta;if(combo)synergy+=delta;reasons.push(reason);};
  const damage=damageShare(allies,allyRoles),isCarry=role!=='SUPPORT',alliedCarry=allies.filter((_,i)=>allyRoles[i]!=='SUPPORT');
  if(alliedCarry.length>=2&&isCarry){
    const after=damageShare([...allies,candidate],[...allyRoles,role]),improvement=Math.abs(damage-.5)-Math.abs(after-.5);
    if(improvement>.08)add(Math.min(20,improvement*65),'Diversifie les dégâts des carries ; rend l’itemisation adverse moins simple.');
    if((damage>.78&&candidate.traits.ad>.75)||(damage<.22&&candidate.traits.ad<.25))add(-16,'Renforce un profil de dégâts déjà trop homogène.');
  }
  // No automatic bonus for the first tank: it depends on revealed carries, frontline and opponent threats.
  if(allies.length>=2&&sum(allies,'frontline')<3&&candidate.traits.frontline>=2)add(8,'Une frontline est nécessaire pour les carries déjà révélés.');
  if(sum(allies,'frontline')>=5&&candidate.traits.frontline>=2&&role!=='SUPPORT')add(-10,'Frontline déjà suffisante : risque de manquer de dégâts.');
  if(allies.some(c=>hypercarry.has(c.id))){
    if(candidate.traits.peel>=2)add(10,'Protège le carry principal dans les combats prolongés.',true);
    if(role==='SUPPORT'&&candidate.traits.peel<1.5&&enemies.some(c=>dive.has(c.id)))add(-12,'Protection insuffisante du carry face au dive adverse.');
  }
  if((delivery.has(candidate.id)&&allies.some(c=>aoe.has(c.id)))||(aoe.has(candidate.id)&&allies.some(c=>delivery.has(c.id))))add(12,'Combine une entrée de combat avec les dégâts de zone alliés.',true);
  if(candidate.id==='Yasuo'&&allies.some(c=>delivery.has(c.id)||c.id==='Gragas'))add(7,'Les projections alliées permettent d’activer l’ultime de Yasuo.',true);
  if(enemies.filter(c=>dive.has(c.id)).length>=2){
    if(disengage.has(candidate.id))add(16,'Protège contre plusieurs menaces de dive adverses.');
    if(immobile.has(candidate.id)&&sum(allies,'peel')<3)add(-18,'Carry immobile exposé à plusieurs menaces de dive.');
  }
  if(enemies.filter(c=>c.traits.frontline>=2).length>=2&&antiTank.has(candidate.id))add(14,'Dégâts soutenus ou adaptés à la double frontline adverse.');
  if(siege.has(candidate.id)&&allies.filter(c=>siege.has(c.id)).length>=1){
    add(10,'Renforce un plan de poke et de siège cohérent.',true);
    if(enemies.filter(c=>delivery.has(c.id)).length>=2&&sum(allies,'peel')<3)add(-12,'Le poke reste vulnérable aux initiations adverses.');
  }
  if(enemies.filter(c=>siege.has(c.id)).length>=2&&initiation.has(candidate.id)&&sum(allies,'engage')<4)add(12,'Permet de forcer un combat avant de subir le poke adverse.');
  if(split.has(candidate.id)&&allies.filter(c=>split.has(c.id)).length>=1)add(-10,'Deux champions de side lane compliquent le regroupement et le contrôle des objectifs.');
  const early=sum(allies,'early'),late=sum(allies,'scaling');
  if(allies.length>=2&&late>early+3&&candidate.traits.early>=2.5)add(7,'Apporte de la présence avant les pics de puissance tardifs.');
  if(role==='JUNGLE'&&candidate.traits.scaling>=2.5&&allies.length>=2&&allies.every(c=>c.traits.early<=1))add(-9,'Jungle lente avec des lanes peu actives en début de partie.');
  const english:Record<string,string>={
    'Diversifie les dégâts des carries ; rend l’itemisation adverse moins simple.':'Diversifies carry damage and makes enemy itemization harder.',
    'Renforce un profil de dégâts déjà trop homogène.':'Adds more of a damage type already dominating the team.',
    'Une frontline est nécessaire pour les carries déjà révélés.':'Revealed carries need a frontline.',
    'Frontline déjà suffisante : risque de manquer de dégâts.':'Frontline is already sufficient: risks lacking damage.',
    'Protège le carry principal dans les combats prolongés.':'Protects the primary carry in sustained fights.',
    'Protection insuffisante du carry face au dive adverse.':'Insufficient carry protection against enemy dive.',
    'Combine une entrée de combat avec les dégâts de zone alliés.':'Combines fight initiation with allied area damage.',
    'Les projections alliées permettent d’activer l’ultime de Yasuo.':'Allied knockups enable Yasuo’s ultimate.',
    'Protège contre plusieurs menaces de dive adverses.':'Protects against multiple enemy dive threats.',
    'Carry immobile exposé à plusieurs menaces de dive.':'Immobile carry exposed to multiple dive threats.',
    'Dégâts soutenus ou adaptés à la double frontline adverse.':'Sustained damage suited to the enemy double frontline.',
    'Renforce un plan de poke et de siège cohérent.':'Strengthens a coherent poke and siege plan.',
    'Le poke reste vulnérable aux initiations adverses.':'Poke remains vulnerable to enemy engage.',
    'Permet de forcer un combat avant de subir le poke adverse.':'Can force fights before taking enemy poke.',
    'Deux champions de side lane compliquent le regroupement et le contrôle des objectifs.':'Two side lane specialists complicate grouping and objective control.',
    'Apporte de la présence avant les pics de puissance tardifs.':'Adds presence before the team’s late power spikes.',
    'Jungle lente avec des lanes peu actives en début de partie.':'Slow jungle with lanes that lack early pressure.'
  };
  return {score:clamp(50+value),synergy:clamp(50+synergy),reasons:language==='fr'?reasons:reasons.map(r=>english[r]??r)};
}
