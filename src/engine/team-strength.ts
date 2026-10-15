import type {HistoricalGame} from '../shared/types';

/** Chronological, pre-game expectations. No current/future result enters its own prior. */
export function teamExpectations(games:HistoricalGame[]):{blue:Map<string,number>;covered:number}{
 const ratings=new Map<string,{rating:number;games:number}>(),blue=new Map<string,number>();let covered=0;
 const ordered=[...new Map(games.map(g=>[g.id,g])).values()].sort((a,b)=>(a.playedAt??'9999').localeCompare(b.playedAt??'9999')||a.id.localeCompare(b.id,undefined,{numeric:true}));
 const days=new Map<string,HistoricalGame[]>();for(const game of ordered){const day=game.playedAt?.slice(0,10)??'unknown',rows=days.get(day)??[];rows.push(game);days.set(day,rows);}
 for(const daily of days.values()){
 for(const game of daily){
  if(!game.teams||!game.playedAt||game.teams.blue.id===game.teams.red.id){blue.set(game.id,.5);continue;}
  const a=ratings.get(game.teams.blue.id)??{rating:0,games:0},b=ratings.get(game.teams.red.id)??{rating:0,games:0};
  const skill=(a.rating*a.games/(a.games+8)-b.rating*b.games/(b.games+8));
  const expected=Math.max(.25,Math.min(.75,1/(1+Math.exp(-skill))));
  blue.set(game.id,expected);covered++;
 }
 // Source dates have day precision. Updating only after the whole day prevents
 // an arbitrary ID order from leaking another same-day result into a prior.
 for(const game of daily){
  if(!game.teams||!game.playedAt||game.teams.blue.id===game.teams.red.id)continue;
  const a=ratings.get(game.teams.blue.id)??{rating:0,games:0},b=ratings.get(game.teams.red.id)??{rating:0,games:0};
  const error=(game.winner==='blue'?1:0)-(blue.get(game.id)??.5);
  ratings.set(game.teams.blue.id,{rating:Math.max(-1.5,Math.min(1.5,a.rating*.995+.16*error)),games:a.games+1});
  ratings.set(game.teams.red.id,{rating:Math.max(-1.5,Math.min(1.5,b.rating*.995-.16*error)),games:b.games+1});
 }
 }
 return {blue,covered};
}
