import type { EngineInput, PickInsight, PickInsightRequest, PickInteraction, Role } from '../shared/types';
import { ROLES } from '../shared/types';
import { fearlessUsed, freeRoles, opposite, picks, used } from '../shared/draft';
import { evidence, interaction, prepare } from './evidence';
import { rankCandidates, composition } from './index';
import { gamePlan } from './gameplan';
import { championKit } from '../shared/knowledge';
import { kitInteractions } from './kit-matchups';
import { metaProfiles } from './meta';

/** Same corrected, shrunk pair evidence as draft scoring. No raw winrate becomes a counter. */
export function pickInsight(input:EngineInput,request:PickInsightRequest):PickInsight{
 const {championId,role,side}=request,candidate=input.champions.find(champ=>champ.id===championId);
 if(!candidate)throw new Error('Unknown champion');
 const fr=input.settings.language==='fr',tr=(a:string,b:string)=>fr?a:b;
 const own=picks(input.draft,side),enemy=picks(input.draft,opposite(side)),locked=new Set([...used(input.draft),...fearlessUsed(input.draft)]);
 const ownFree=freeRoles(input.draft,side),enemyFree=freeRoles(input.draft,opposite(side)),meta={own:metaProfiles(input,side),enemy:metaProfiles(input,opposite(side))};
 const pair:(champion:string,targetRole:Role,kind:'matchup'|'synergy')=>PickInteraction|null=(id,targetRole,kind)=>{
  const rows=interaction(input,championId,role,id,targetRole,side,kind);if(!rows?.usable||Math.abs(rows.delta*100)<.35)return null;
  const roster=(kind==='matchup'?enemy:own),target=roster.some(pick=>pick.championId===id&&pick.role===targetRole);
  const free=kind==='matchup'?enemyFree:ownFree,profile=(kind==='matchup'?meta.enemy:meta.own).get(id);
  const other=input.champions.find(champ=>champ.id===id),observed=input.stats.length?profile?.roles.includes(targetRole):other?.roles.includes(targetRole);
  if(!target&&(locked.has(id)||!free.includes(targetRole)||kind==='synergy'&&targetRole===role||!observed))return null;
  const team=input.teams?.[(kind==='matchup'?opposite(side):side)===input.draft.side?'ally':'enemy'];
  const inPool=team?.players.some(player=>(player.role===targetRole||player.role==='AUTO')&&player.pool.some(champ=>champ.championId===id&&(!champ.role||champ.role===targetRole)&&(champ.games>=3||champ.games===0&&player.status==='manual')))??false;
  // A rare ladder offrole should not dominate a general counter list. Real picks and declared pools remain contextual.
  if(!target&&!inPool&&other?.curated&&!other.roles.includes(targetRole)&&(profile?.proRoleGames[targetRole]??0)<10)return null;
  return {championId:id,role:targetRole,effect:rows.delta*100,games:Math.round(rows.n),confidence:Math.round(rows.confidence*100),source:rows.sources,present:target,inPool,scope:kind==='matchup'&&targetRole===role?'lane':'composition'};
 };
 const matchups:PickInteraction[]=[],synergies:PickInteraction[]=[],conflicts:PickInteraction[]=[];
 for(const champion of input.champions){if(champion.id===championId)continue;for(const otherRole of ROLES){const match=pair(champion.id,otherRole,'matchup');if(match)matchups.push(match);const synergy=pair(champion.id,otherRole,'synergy');if(synergy&&synergy.effect>0)synergies.push(synergy);else if(synergy?.present)conflicts.push(synergy);}}
 const relevance=(row:PickInteraction,kind:'matchup'|'synergy')=>kind==='matchup'?(role==='ADC'||role==='SUPPORT'?Number(row.role==='ADC'||row.role==='SUPPORT'):Number(row.role===role)):(role==='SUPPORT'?Number(row.role==='ADC'):role==='ADC'?Number(row.role==='SUPPORT'):role==='JUNGLE'?Number(row.role==='MID'):role==='MID'||role==='TOP'?Number(row.role==='JUNGLE'):0);
 const priority=(row:PickInteraction,kind:'matchup'|'synergy')=>Number(row.present)*1000+Number(row.inPool)*100+relevance(row,kind)*20+Math.abs(row.effect)*Math.sqrt(row.confidence/100);
 const unique=(rows:PickInteraction[],kind:'matchup'|'synergy')=>[...rows.sort((a,b)=>priority(b,kind)-priority(a,kind)).reduce((map,row)=>{if(!map.has(row.championId))map.set(row.championId,row);return map;},new Map<string,PickInteraction>()).values()].slice(0,3);
 const counters=unique(matchups.filter(row=>row.effect<0),'matchup'),favourable=unique(matchups.filter(row=>row.effect>0),'matchup'),partners=unique(synergies,'synergy');
 const names=(id:string)=>input.champions.find(champ=>champ.id===id)?.name??id;
 const stats=evidence(input,championId,role,side),recommendation=rankCandidates(input,side,role,true,true,championId).find(row=>row.role===role);
 const ownChampions=own.flatMap(pick=>input.champions.find(champ=>champ.id===pick.championId)??[]),enemyChampions=enemy.flatMap(pick=>input.champions.find(champ=>champ.id===pick.championId)??[]);
 const before=composition(ownChampions,input.settings.language,own.map(pick=>pick.role));
 const plan=gamePlan([...ownChampions,candidate],[...own.map(pick=>pick.role),role],enemyChampions,enemy.map(pick=>pick.role),input.settings.language);
 const strengths:string[]=[],risks:string[]=[];
 for(const row of matchups.filter(row=>row.present)){(row.effect>0?strengths:risks).push(row.effect>0?tr(`Matchup favorable observé contre ${names(row.championId)} (${row.role}).`,`Observed favourable matchup against ${names(row.championId)} (${row.role}).`):tr(`${names(row.championId)} (${row.role}) gêne ce pick dans les résultats observés.`,`${names(row.championId)} (${row.role}) threatens this pick in observed results.`));}
 for(const row of synergies.filter(row=>row.present))strengths.push(tr(`Synergie observée avec ${names(row.championId)} (${row.role}).`,`Observed synergy with ${names(row.championId)} (${row.role}).`));
 for(const row of conflicts)risks.push(tr(`Association peu favorable observée avec ${names(row.championId)} (${row.role}).`,`Observed unfavourable pairing with ${names(row.championId)} (${row.role}).`));
 if(candidate.curated&&own.length){if(before.frontline<3&&candidate.traits.frontline>=2)strengths.push(tr('Ajoute une frontline qui manque à la composition.','Adds frontline currently missing from the composition.'));if(before.engage<3&&candidate.traits.engage>=2)strengths.push(tr('Ajoute une initiation pour lancer les combats.','Adds engage to start fights.'));if(before.peel<3&&candidate.traits.peel>=2)strengths.push(tr('Renforce la protection des carries.','Improves carry protection.'));}
 if(own.length>=2){strengths.push(tr(`Plan proposé : ${plan.title}. ${plan.conditions[0]??plan.timing}`,`Proposed plan: ${plan.title}. ${plan.conditions[0]??plan.timing}`));risks.push(...plan.risks.slice(0,2));}
 const comfort=input.teams?.[side===input.draft.side?'ally':'enemy']?.players.filter(player=>player.role===role||player.role==='AUTO');
 if(comfort?.length&&comfort.every(player=>player.pool.length&&!player.pool.some(champ=>champ.championId===championId&&(!champ.role||champ.role===role))))risks.push(tr('Absent du pool renseigné pour ce rôle : jouabilité à confirmer.','Missing from the recorded pool for this role: confirm playability.'));
 if(recommendation?.blind){if(recommendation.blind.coverage<.5)risks.push(tr('Vis-à-vis inconnu et réponses peu documentées : ce blind reste incertain.','Opposing role unknown and limited response evidence: this blind remains uncertain.'));else if(recommendation.blind.score<47)risks.push(tr('Le blind est exposé aux réponses encore disponibles.','This blind is exposed to remaining replies.'));}
 const mechanics:PickInsight['mechanics']=[],kit=championKit(input.knowledge,championId,input.draft.patch);
 if(kit)for(const pick of enemy){const other=championKit(input.knowledge,pick.championId!,input.draft.patch);if(!other)continue;for(const edge of kitInteractions(kit,other,fr).slice(0,1))mechanics.push({championId:other.id,direction:'good',reason:edge.reason,condition:edge.condition});for(const edge of kitInteractions(other,kit,fr).slice(0,1))mechanics.push({championId:other.id,direction:'risk',reason:edge.reason,condition:edge.condition});}
 const windows=prepare(input).windows;
 const warnings=[tr('Effets ajustés et lissés sur les trois derniers patchs disponibles. Ils décrivent des victoires de partie, pas une domination de lane.','Adjusted, shrunk effects over the latest three available patches. They describe game wins, not lane dominance.')];
 if(input.demo)warnings.push(tr('Données de démonstration.','Demonstration data.'));
 if(!stats?.usable)risks.push(tr('Échantillon insuffisant pour juger sa force statistique dans ce rôle.','Insufficient sample to judge statistical strength in this role.'));
 if(!strengths.length)strengths.push(tr('La valeur de ce choix dépend encore des prochains picks et du plan final.','This choice still depends on later picks and the final game plan.'));
 return {championId,role,side,windows:(['solo','pro'] as const).map(source=>({source,patches:windows[source]})),counters,favourable,synergies:partners,strengths:[...new Set(strengths)].slice(0,4),risks:[...new Set(risks)].slice(0,4),mechanics:mechanics.slice(0,3),confidence:Math.round((stats?.confidence??0)*100),games:Math.round(stats?.n??0),warnings};
}
