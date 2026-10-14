import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Champion, HistoricalGame } from '../shared/types';
import { ScrapeHttp } from './http';
import { parseGolGame } from './gol';

/** Offline-only recovery. Never call page(), robots(), or fetch(). */
export async function enrichCachedGames(root:string,champions:Champion[],games:HistoricalGame[]):Promise<{games:HistoricalGame[];updated:number;failed:number}> {
 if(!existsSync(path.join(root,'scrape-cache.sqlite')))return {games,updated:0,failed:0};
 const http=new ScrapeHttp(root,()=>{}),output:HistoricalGame[]=[];let updated=0,failed=0;
 try{for(const game of games){
  const id=/^gol-(\d+)$/.exec(game.id)?.[1];if(!id){output.push(game);continue;}
  try{const page=await http.peek('https://gol.gg/game/stats/'+id+'/page-game/');if(!page){output.push(game);continue;}
   const parsed=parseGolGame(page.html,champions,id);
   const direct=parsed.winner===game.winner&&JSON.stringify(parsed.lineups)===JSON.stringify(game.lineups);
   const swapped=parsed.winner!==game.winner&&JSON.stringify(parsed.lineups?.blue)===JSON.stringify(game.lineups?.red)&&JSON.stringify(parsed.lineups?.red)===JSON.stringify(game.lineups?.blue);
   if(parsed.patch!==game.patch||(!direct&&!swapped))throw new Error('Cached game identity mismatch');
   // Only the same played lineups/result may be reoriented using the explicit blue marker.
   const enriched={...game,...parsed};
   if(JSON.stringify(enriched)!==JSON.stringify(game))updated++;
   output.push(enriched);
  }catch{failed++;output.push(game);}
 }}finally{http.close();}
 return {games:output,updated,failed};
}
