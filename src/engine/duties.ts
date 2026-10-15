import type {Champion,Role} from '../shared/types';
import type {CompositionDuty,DutyKind} from '../shared/coaching';
import {mechanics} from './mechanics';

export function compositionDuties(team:Champion[],roles:Role[],language:string):CompositionDuty[]{
 const tr=(a:string,b:string)=>language==='fr'?a:b;
 const members=team.map((champion,i)=>({champion,role:roles[i],kit:mechanics(champion,roles[i])}));
 const choose=(kind:DutyKind,score:(m:typeof members[number])=>number,instruction:string,condition:string):CompositionDuty=>{
  const options=members.map(m=>({...m,score:score(m)})).filter(m=>m.score>0&&!!m.role).sort((a,b)=>b.score-a.score);
  return {kind,championId:options[0]?.champion.id??null,role:options[0]?.role??null,backup:options[1]?.champion.id??null,instruction,condition,missing:!options.length};
 };
 return [
  choose('priority',m=>['TOP','MID','ADC'].includes(m.role)&&m.kit.waveclear>=2?m.kit.waveclear+m.champion.traits.early*.5:0,tr('Préparer la vague pour libérer un déplacement.','Prepare the wave to free a rotation.'),tr('Potentiel de priorité, à confirmer avec le matchup et les ressources de lane.','Potential priority; confirm the matchup and lane resources.')),
  choose('jungle',m=>['MID','SUPPORT'].includes(m.role)&&m.kit.control>=2?m.kit.control+m.kit.mobility*.5+(m.role==='SUPPORT'?.5:0):0,tr('Accompagner le jungler sur la vision et les entrées de rivière.','Accompany the jungler for vision and river entrances.'),tr('Bouger seulement si la vague et la position adverse le permettent.','Move only when the wave and enemy position allow it.')),
  choose('engage',m=>m.champion.traits.engage>=2?m.champion.traits.engage+m.kit.control*.5+m.kit.access*.25:0,tr('Annoncer la cible et déclencher le combat sur un angle préparé.','Call the target and start the fight from a prepared angle.'),tr('Attendre la portée de suivi et vérifier les outils de fuite adverses.','Wait for follow-up range and check enemy escape tools.')),
  choose('follow',m=>['MID','ADC'].includes(m.role)&&m.kit.sustained>=2?m.kit.sustained+m.kit.range*.3:0,tr('Garder ses dégâts disponibles pour suivre l’initiation.','Keep damage available to follow the initiation.'),tr('Ne pas engager hors de portée des dégâts ; vérifier les délais des sorts.','Do not engage outside damage range; check ability cooldowns.')),
  choose('protect',m=>m.champion.traits.peel>=2?m.champion.traits.peel+m.kit.disengage*.5+(m.role==='SUPPORT'?1:0):0,tr('Garder un outil pour arrêter l’accès aux carries.','Keep a tool to stop access to carries.'),tr('Choisir avant le combat quel carry protéger et quel ennemi interrompre.','Choose which carry to protect and which enemy to interrupt before fighting.')),
  choose('side',m=>['TOP','MID'].includes(m.role)&&m.kit.waveclear>=2?m.kit.waveclear+m.kit.mobility*.3+m.kit.sustained*.3:0,tr('Tenir la vague latérale puis annoncer sa disponibilité pour rejoindre.','Hold the side wave, then call availability to join.'),tr('Attribuer la side selon le duel, la vision et la téléportation ; aucun duel gagné garanti.','Assign the side lane based on the duel, vision and teleport; no guaranteed winning duel.'))
 ];
}
