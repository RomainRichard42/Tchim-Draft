import {PRO_ORDER} from '../shared/draft';
import {coachProLeague} from '../shared/pro-leagues';
import {ROLES,type HistoricalGame,type Stat} from '../shared/types';

export function scopedProGames(games:HistoricalGame[]):HistoricalGame[]{
 const unique=new Map<string,HistoricalGame>();
 for(const game of games){
  const league=coachProLeague(game.tournament);if(!league)continue;
  const canonical={...game,league},prior=unique.get(game.id);
  if(prior&&JSON.stringify(prior)!==JSON.stringify(canonical))throw new Error(`Conflicting pro game ${game.id}`);
  unique.set(game.id,canonical);
 }
 return [...unique.values()];
}

/** Rebuild every pro statistic from the exact retained population, including bans. */
export function proStatsFromGames(games:HistoricalGame[]):Stat[]{
 const populations=new Map<string,number>(),bans=new Map<string,number>(),rows=new Map<string,Stat>();
 const seen=new Set<string>();
 for(const game of games){
  if(seen.has(game.id))throw new Error(`Duplicate pro game ${game.id}`);seen.add(game.id);
  const lineup=game.lineups??(game.draftOrderKnown===false?undefined:{
   blue:{picks:game.history.flatMap((pick,i)=>PRO_ORDER[i]?.side==='blue'&&PRO_ORDER[i]?.kind==='pick'&&pick.championId&&pick.role?[{championId:pick.championId,role:pick.role}]:[]),bans:game.history.flatMap((pick,i)=>PRO_ORDER[i]?.side==='blue'&&PRO_ORDER[i]?.kind==='ban'?[pick.championId]:[])},
   red:{picks:game.history.flatMap((pick,i)=>PRO_ORDER[i]?.side==='red'&&PRO_ORDER[i]?.kind==='pick'&&pick.championId&&pick.role?[{championId:pick.championId,role:pick.role}]:[]),bans:game.history.flatMap((pick,i)=>PRO_ORDER[i]?.side==='red'&&PRO_ORDER[i]?.kind==='ban'?[pick.championId]:[])}
  });
  if(!lineup||(['blue','red'] as const).some(side=>lineup[side].picks.length!==5||new Set(lineup[side].picks.map(p=>p.role)).size!==5||lineup[side].picks.some(p=>!ROLES.includes(p.role))))throw new Error(`Incomplete pro lineup ${game.id}`);
  const picked=[...lineup.blue.picks,...lineup.red.picks].map(p=>p.championId);
  if(new Set(picked).size!==10)throw new Error(`Duplicate pro pick ${game.id}`);
  for(const league of [...new Set(['all',game.league])]){
   const population=`${game.patch}|${league}`;populations.set(population,(populations.get(population)??0)+1);
   for(const championId of new Set([...lineup.blue.bans,...lineup.red.bans].filter((id):id is string=>Boolean(id)))){
    if(picked.includes(championId))throw new Error(`Banned pro pick ${game.id}`);
    const key=`${population}|${championId}`;bans.set(key,(bans.get(key)??0)+1);
   }
   for(const side of ['blue','red'] as const)for(const pick of lineup[side].picks){
    const key=`${population}|${pick.championId}|${pick.role}`;
    const row=rows.get(key)??{...pick,patch:game.patch,league,side:'all',source:'pro',rank:'all',games:0,wins:0,pickRate:0,banRate:0,baseline:.5,countMethod:'reported'} satisfies Stat;
    row.games++;if(game.winner===side)row.wins++;rows.set(key,row);
   }
  }
 }
 for(const row of rows.values()){
  const population=`${row.patch}|${row.league}`,total=populations.get(population)!;
  row.pickRate=row.games/total;row.banRate=(bans.get(`${population}|${row.championId}`)??0)/total;
 }
 return [...rows.values()].sort((a,b)=>[a.patch,a.league,a.championId,a.role].join('|').localeCompare([b.patch,b.league,b.championId,b.role].join('|')));
}
