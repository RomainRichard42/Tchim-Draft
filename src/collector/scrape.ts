import { mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type { DataPack, Stat } from '../shared/types';
import { packSchema } from '../shared/validation';
import type { Storage } from '../main/storage';
import { ScrapeHttp } from './http';
import { scrapeGol } from './gol';
import { scrapeLolalytics } from './lolalytics';
import { latestPatches } from '../shared/patches';

export interface ScrapeOptions { patch?: string; tier?: string; details?: number; games?: number; force?: boolean; revalidate?:boolean; source?:'pro'|'solo' }
export async function scrapeSources(storage: Storage, directory: string, progress: (message: string) => void, options: ScrapeOptions = {}): Promise<{ imported: string[]; errors: string[]; busy?:boolean }> {
  const acquired=storage.db.transaction(()=>{if(storage.collecting())return false;storage.set('scrapeLease',{pid:process.pid,database:path.resolve(storage.db.name)});return true;})();
  if(!acquired){progress('Une collecte est déjà en cours dans cette base.');return {imported:[],errors:[],busy:true};}
  const externalProgress=progress;progress=message=>{storage.set('scrapeProgress',message);externalProgress(message);};
  try{return await collect(storage,directory,progress,options);}finally{storage.db.prepare('DELETE FROM kv WHERE key = ?').run('scrapeLease');}
}
async function collect(storage:Storage,directory:string,progress:(message:string)=>void,options:ScrapeOptions):Promise<{imported:string[];errors:string[]}> {
  const patch = (storage.get<string>('staticVersion') ?? storage.draft.patch).split('.').slice(0, 2).join('.');
  if (!/^\d{1,2}\.\d{1,2}$/.test(patch)) throw new Error('Refresh Data Dragon before collecting statistics');
  if(options.tier&&options.tier.toLowerCase()!=='master_plus')throw new Error('La collecte Lolalytics est fixée à Master+.');
  const patches=storage.get<string[]>('staticPatches')??latestPatches([patch,...Array.from({length:2},(_,i)=>`${patch.split('.')[0]}.${Number(patch.split('.')[1])-i-1}`)]);
  const details=options.details??Infinity,games=options.games??Infinity;
  if((details!==Infinity&&(!Number.isInteger(details)||details<0))||(games!==Infinity&&(!Number.isInteger(games)||games<0)))throw new Error('Invalid scraper budget');
  const root = path.join(directory, 'scraping'); await mkdir(root, { recursive: true });
  const http = new ScrapeHttp(root, message => storage.log('info', message), 2500, options.force ?? false);
  const imported: string[] = [], errors: string[] = [], champions = storage.champions();
  const existing=new Map(storage.packs().map(pack=>[pack.id,pack]));
  const exports=path.join(root,'exports');await mkdir(exports,{recursive:true});
  const publish=async(id:string,rows:Pick<DataPack,'stats'|'pairs'|'games'>)=>{
    const solo=id.startsWith('lolalytics'),pack:DataPack=packSchema.parse({schemaVersion:1,id,createdAt:new Date().toISOString(),provenance:{name:solo?`Lolalytics · MASTER_PLUS · ${id.replace('lolalytics-','')}`:`gol.gg · ${id.includes('stats')?'Toutes ligues · statistiques':'Matchs et synergies'} · 3 patchs`,url:solo?'https://lolalytics.com/lol/tierlist/':'https://gol.gg/',license:'Public statistics collected locally for personal analysis. No redistribution license asserted. Lolalytics wins reconstructed from published percentages. Pro role order is not draft order.',demo:false},...rows});
    storage.importPack(pack);const file=path.join(exports,`${id}.json`);await writeFile(`${file}.tmp`,JSON.stringify(pack));await rename(`${file}.tmp`,file);
    if(!imported.includes(id))imported.push(id);progress(`${id} · ${rows.stats.length} stats · ${rows.pairs.length} paires · ${rows.games.length} matchs`);
  };
  const job=async(name:string,fn:()=>Promise<unknown>)=>{try{await fn();}catch(error){const message=`${name}: ${error instanceof Error?error.message:String(error)}`;errors.push(message);storage.log('error',message);progress(message);}};
  const statistics=new Map<string,Stat[]>();
  let proStats:Stat[]|undefined;
  try{
    if(options.source!=='solo')await job('gol.gg stats',async()=>{proStats=(await scrapeGol(http,champions,patch,0,progress,publish,[],options)).stats;});
    if(options.source!=='pro')for(const p of patches)await job(`Lolalytics ${p} stats`,async()=>{const rows=await scrapeLolalytics(http,champions,p,'master_plus',0,storage.settings.pool,progress,publish,undefined,undefined,options.revalidate&&p===patches[0]);statistics.set(p,rows.stats);});
    if(statistics.size===3)for(const pack of storage.packs())if(pack.id.startsWith('lolalytics-')&&((pack.stats.some(s=>s.rank!=='MASTER_PLUS'))||!patches.some(p=>pack.id.startsWith(`lolalytics-${p}-`))))storage.removePack(pack.id);
    if(imported.some(id=>id.startsWith('golgg-stats')))storage.removePack(`golgg-S${patch.split('.')[0]}`);
    const pool={...storage.settings.pool};for(const team of Object.values(storage.teams))for(const player of team.players)for(const c of player.pool)pool[c.championId]=Math.max(pool[c.championId]??0,Math.min(5,c.games/10));
    await Promise.all([
      (async()=>{for(const p of patches){const stats=statistics.get(p);if(!stats)continue;await job(`Lolalytics ${p} détails`,()=>scrapeLolalytics(http,champions,p,'master_plus',details,pool,progress,publish,stats,id=>{
        const pack=existing.get(id);return !options.force&&!!pack&&!pack.provenance.demo&&pack.pairs.length>0&&(p!==patches[0]||(!options.revalidate&&Date.now()-Date.parse(pack.createdAt)<6*3600000));
      },options.revalidate&&p===patches[0]));}})(),
      games&&options.source!=='solo'?job('gol.gg matchs',()=>scrapeGol(http,champions,patch,games,progress,publish,storage.engineInput().games,{...options,stats:proStats,tournamentCounts:storage.get<Record<string,string>>(`golTournamentCountsS${patch.split('.')[0]}`),rememberCounts:counts=>storage.set(`golTournamentCountsS${patch.split('.')[0]}`,counts),rememberBaseline:counts=>storage.set(`golTournamentCountsS${patch.split('.')[0]}`,counts)})):Promise.resolve()
    ]);
    storage.set('scrapeWindow',{lolalytics:patches,rank:'MASTER_PLUS',complete:errors.length===0&&details===Infinity&&games===Infinity,updatedAt:new Date().toISOString()});
  }finally{http.close();}
  return { imported, errors };
}
