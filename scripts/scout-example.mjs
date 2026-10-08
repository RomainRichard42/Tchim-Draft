import { build } from 'esbuild';
await build({stdin:{contents:"export {scoutTeam} from './src/collector/opgg'; export {ScrapeHttp} from './src/collector/http'; export {Storage} from './src/main/storage';",resolveDir:process.cwd()},bundle:true,format:'cjs',platform:'node',outfile:'artifacts/scout-module.cjs',external:['better-sqlite3']});
const {scoutTeam,ScrapeHttp,Storage}=(await import('../artifacts/scout-module.cjs')).default;
const {mkdir,writeFile}=await import('node:fs/promises');
await mkdir('data/local/scouting',{recursive:true});
const storage=new Storage('data/local/tchim.sqlite'), http=new ScrapeHttp('data/local/scouting',()=>{});
try{
 const team=await scoutTeam(http,storage.champions(),process.env.TCHIM_OPGG_URL ?? (()=>{throw new Error('Set TCHIM_OPGG_URL to your multi OP.GG URL')})());
 await writeFile('artifacts/scouting-example.json',JSON.stringify(team,null,2));
 console.log(team.message);for(const p of team.players)console.log(p.riotId,p.role,p.status,p.pool.length,p.pool.slice(0,3));
 if(team.players.some(p=>p.status!=='loaded'))process.exitCode=1;
}finally{http.close();storage.close();}
