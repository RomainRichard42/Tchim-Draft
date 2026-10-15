import Database from 'better-sqlite3';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
import {ScrapeHttp} from '../src/collector/http';
import {golDraftFormat,golSeriesContext} from '../src/collector/pro-context';
import type {HistoricalGame} from '../src/shared/types';
import type {ProGameContext} from '../src/shared/coaching';

async function main(){
 const flags=Object.fromEntries(process.argv.slice(2).map(arg=>{const [key,...value]=arg.replace(/^--/,'').split('=');return [key,value.join('=')];}));
 const directory=path.resolve(flags.dataset??'data/shared-scope-20261015'),cache=path.resolve(flags.cache??'data/refresh-20261014/scraping');
 const manifest=JSON.parse(await readFile(path.join(directory,'manifest.json'),'utf8'));
 const games:HistoricalGame[]=[];
 for(const part of manifest.parts.filter((p:{id:string})=>p.id.startsWith('shared-pro-')))games.push(...JSON.parse(gunzipSync(await readFile(path.join(directory,part.sha256+'.json.gz'))).toString('utf8')).games);
 await mkdir(cache,{recursive:true});const http=new ScrapeHttp(cache,message=>console.log(message),2500),context:Record<string,ProGameContext>={};
 const formats:Record<string,{format:ProGameContext['format'];source:string}>={};
 try{
  for(const tournament of new Set(games.map(g=>g.tournament))){
   const url='https://gol.gg/tournament/tournament-stats/'+encodeURIComponent(tournament)+'/';
   const page=await http.page(url,undefined,6*3600000);formats[tournament]={format:golDraftFormat(page.html),source:url};
   console.log(tournament,formats[tournament].format);
  }
  for(const game of games){const id=/^gol-(\d+)$/.exec(game.id)?.[1];if(!id)continue;const page=await http.peek('https://gol.gg/game/stats/'+id+'/page-game/');if(!page)continue;const rule=formats[game.tournament],series=golSeriesContext(page.html,id,rule.format,rule.source);if(series)context[game.id]=series;}
 }finally{http.close();}
 const result={schema:1,datasetRevision:manifest.revision,games:context,tournaments:formats};
 await writeFile(flags.output??'resources/pro-context.json',JSON.stringify(result,null,2)+'\n');
 console.log('PRO_CONTEXT_READY',JSON.stringify({games:games.length,identified:Object.keys(context).length,formats:Object.fromEntries(['standard','fearless','unknown'].map(format=>[format,Object.values(context).filter(g=>g.format===format).length]))}));
}
void main().catch(error=>{console.error(error.message);process.exitCode=1;});
