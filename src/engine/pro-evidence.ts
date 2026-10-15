import bundled from '../../resources/pro-context.json';
import type {EngineInput,HistoricalGame,Stat,PairStat} from '../shared/types';
import type {CoachingMeta,MetaChampion,ProFormat,ProGameContext,ProView} from '../shared/coaching';
import {latestPatches} from '../shared/patches';
import {PRO_ORDER} from '../shared/draft';
import {proStatsFromGames} from '../collector/pro-population';
import {gamePairs} from '../collector/gol';
import {teamExpectations} from './team-strength';
import {proContextSchema} from '../shared/coaching';

export const PRO_CONTEXT:Record<string,ProGameContext>=proContextSchema.parse(bundled).games;
type PreparedPro={stats:Stat[];pairs:PairStat[];games:HistoricalGame[];report:CoachingMeta};
const cache=new WeakMap<object,{games:EngineInput['games'];context:EngineInput['proContext'];views:Map<string,PreparedPro>}>();
export function proEvidence(input:EngineInput):PreparedPro{
 const desired:ProFormat=input.draft.series?.fearless!==false&&input.draft.series?.format!=='single'&&input.draft.series?'fearless':'standard';
 const requested=input.settings.proView??'auto',correction=input.settings.teamStrengthCorrection!==false;
 const key=JSON.stringify([input.draft.league,desired,requested,correction,input.settings.proRules,input.settings.language]);
 let entry=cache.get(input.stats);if(!entry||entry.games!==input.games||entry.context!==input.proContext){entry={games:input.games,context:input.proContext,views:new Map()};cache.set(input.stats,entry);}const byKey=entry.views,prior=byKey.get(key);if(prior)return prior;
 const patches=latestPatches(input.stats.filter(s=>s.source==='pro').map(s=>s.patch).concat((input.games??[]).map(g=>g.patch)));
 const all=[...new Map((input.games??[]).filter(g=>patches.includes(g.patch)&&(input.draft.league==='all'||g.league===input.draft.league)).map(g=>[g.id,g])).values()];
 const fr=input.settings.language==='fr',tr=(a:string,b:string)=>fr?a:b;
 const context=(g:HistoricalGame)=>{const base=input.proContext?.[g.id]??PRO_CONTEXT[g.id],rule=input.settings.proRules?.[g.tournament];return {...base,...(rule?{format:rule.format,source:rule.source}:{}),format:rule?.format??base?.format??'unknown'} as Partial<ProGameContext>&{format:ProFormat};};
 const known={standard:0,fearless:0,unknown:0};for(const game of all)known[context(game).format]++;
 let effective:Exclude<ProView,'auto'>=requested==='auto'?desired:requested;
 const warnings:string[]=[];
 if(all.some(g=>input.settings.proRules?.[g.tournament]))warnings.push(tr('Certains formats sont déclarés dans tes réglages : les liens fournis ne sont pas vérifiés automatiquement.','Some formats were declared in your settings: the supplied links are not automatically verified.'));
 if(requested==='auto'&&known[desired]<20){
  effective=all.filter(g=>context(g).index===1).length>=10?'opening':'all';
  warnings.push(effective==='opening'?tr('Pas assez de matchs vérifiés dans ce format : référence limitée aux premières manches de BO.','Too few verified games in this format: using series opening games.'):tr('Formats insuffisamment documentés : référence pro groupée, sans prétendre isoler le classique du Fearless.','Insufficient format evidence: pooled pro reference, without claiming a classic/Fearless split.'));
 }
 const selected=all.filter(g=>effective==='all'||effective==='opening'?effective==='all'||context(g).index===1:context(g).format===effective);
 const index=new Map((input.games??[]).map(g=>[g.id,g]));let incompleteSeries=0;
 const availability=new Map<string,Set<string>>();
 const games=selected.filter(game=>{
  if(!game.lineups&&(game.draftOrderKnown===false||game.history.length!==20)){incompleteSeries++;return false;}
  const info=context(game);
  if(info.format!=='fearless'||info.index===1){availability.set(game.id,new Set());return true;}
  if(!info.index||!info.gameIds||info.gameIds.length<info.index){incompleteSeries++;return false;}
  const before=info.gameIds.slice(0,info.index-1).map(id=>index.get(id));
  if(before.some(g=>!g?.lineups)){incompleteSeries++;return false;}
  const spent=new Set(before.flatMap(g=>[...g!.lineups!.blue.picks,...g!.lineups!.red.picks].map(p=>p.championId)));
  if(game.lineups&&[...game.lineups.blue.picks,...game.lineups.red.picks].some(p=>spent.has(p.championId))){incompleteSeries++;return false;}
  availability.set(game.id,spent);return true;
 });
 const expectations=teamExpectations(all),stats=games.length?proStatsFromGames(games):[];
 const baseline=new Map<string,{n:number;sum:number}>();
 for(const game of games)if(game.lineups)for(const side of ['blue','red'] as const)for(const pick of game.lineups[side].picks)for(const league of new Set(['all',game.league])){
  const id=[game.patch,league,pick.championId,pick.role].join('|'),row=baseline.get(id)??{n:0,sum:0};row.n++;row.sum+=side==='blue'?(expectations.blue.get(game.id)??.5):1-(expectations.blue.get(game.id)??.5);baseline.set(id,row);
 }
 for(const stat of stats){
  const population=games.filter(g=>g.patch===stat.patch&&(stat.league==='all'||g.league===stat.league)&&!availability.get(g.id)?.has(stat.championId)).length;
  if(population){const old=stat.games/stat.pickRate;stat.pickRate=stat.games/population;stat.banRate=Math.min(1,stat.banRate*old/population);}
  const base=baseline.get([stat.patch,stat.league,stat.championId,stat.role].join('|'));if(correction&&base)stat.baseline=base.sum/base.n;
 }
 const pairs=gamePairs(games,stats,correction?expectations.blue:undefined);
 const champions:MetaChampion[]=input.champions.map(champion=>{
  const current=games.filter(g=>g.patch===patches[0]),older=games.filter(g=>g.patch!==patches[0]);
  const count=(list:HistoricalGame[])=>{let exposure=0,picks=0,bans=0;for(const g of list){if(availability.get(g.id)?.has(champion.id))continue;exposure++;if(g.lineups){picks+=Number([...g.lineups.blue.picks,...g.lineups.red.picks].some(p=>p.championId===champion.id));bans+=Number([...g.lineups.blue.bans,...g.lineups.red.bans].includes(champion.id));}}return {exposure,picks,bans};};
  const now=count(current),past=count(older),roles=new Map<string,number>();let wins=0,played=0,expected=0,firstPicks=0,blindPicks=0,earlyPicks=0,orderGames=0;
  for(const g of current){for(const side of ['blue','red'] as const){const pick=g.lineups?.[side].picks.find(p=>p.championId===champion.id);if(!pick)continue;played++;wins+=Number(g.winner===side);expected+=correction?(side==='blue'?(expectations.blue.get(g.id)??.5):1-(expectations.blue.get(g.id)??.5)):.5;roles.set(pick.role,(roles.get(pick.role)??0)+1);}
   if(g.draftOrderKnown!==false&&g.history.length===20){const revealed={blue:new Set<string>(),red:new Set<string>()};g.history.forEach((pick,i)=>{const action=PRO_ORDER[i];if(action.kind!=='pick')return;if(pick.championId===champion.id){orderGames++;firstPicks+=Number(i===6);earlyPicks+=Number(action.phase===1);blindPicks+=Number(!!pick.role&&!revealed[action.side==='blue'?'red':'blue'].has(pick.role));}if(pick.role)revealed[action.side].add(pick.role);});}
  }
  const presence=now.exposure?(now.picks+now.bans)/now.exposure:0,previousPresence=past.exposure?(past.picks+past.bans)/past.exposure:null;
  return {championId:champion.id,games:played,wins,exposure:now.exposure,unknownExposure:incompleteSeries,picks:now.picks,bans:now.bans,presence,previousPresence,trend:previousPresence===null||now.exposure<10||past.exposure<10?null:presence-previousPresence,rawWinrate:played?wins/played:null,adjustedEdge:played>=10?(wins-expected)/(played+50):0,confidence:played/(played+50),roles:[...roles].map(([role,games])=>({role:role as Stat['role'],games})),firstPicks,blindPicks,earlyPicks,orderGames,status:played<10?'limited':played<30?'emerging':'observed'};
 });
 if(incompleteSeries)warnings.push(tr(`${incompleteSeries} manches Fearless exclues : série incomplète ou picks contradictoires.`,`${incompleteSeries} Fearless games excluded: incomplete series or contradictory picks.`));
 if(known.unknown)warnings.push(tr(`${known.unknown} matchs ont un format non vérifié.`,`${known.unknown} games have an unverified format.`));
 const report:CoachingMeta={requested,effective,format:desired,patches,games:games.length,currentGames:games.filter(g=>g.patch===patches[0]).length,knownFormats:known,excluded:all.length-games.length,incompleteSeries,teamCoverage:all.length?expectations.covered/all.length:0,correctedGames:correction?games.filter(g=>g.teams&&g.playedAt).length:0,leagueCounts:Object.fromEntries([...new Set(games.map(g=>g.league))].map(league=>[league,games.filter(g=>g.league===league).length])),warnings,champions};
 const rawFallback=!(input.games?.length)&&(requested==='auto'||requested==='all');
  const result={stats:rawFallback?input.stats.filter(s=>s.source==='pro'):stats,pairs:rawFallback?input.pairs.filter(p=>p.source==='pro'):pairs,games,report};
 byKey.set(key,result);while(byKey.size>8)byKey.delete(byKey.keys().next().value!);return result;
}
