import {afterEach,describe,expect,it,vi} from 'vitest';
import {mkdir,mkdtemp,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {coachProLeague} from '../src/shared/pro-leagues';
import {proStatsFromGames,scopedProGames} from '../src/collector/pro-population';
import {gamePairs,parseGolGame,scrapeGol} from '../src/collector/gol';
import {ScrapeHttp} from '../src/collector/http';
import {Storage} from '../src/main/storage';
import {exportDataset} from '../src/collector/export-dataset';
import {SEED_CHAMPIONS} from '../src/shared/champions';
import type {Champion,HistoricalGame} from '../src/shared/types';
import ids from './fixtures/champion-ids.json';

const champions:Champion[]=ids.map(c=>({...SEED_CHAMPIONS.find(s=>s.id===c.id)??SEED_CHAMPIONS[0],...c}));
const cleanup:string[]=[];
afterEach(async()=>{for(const directory of cleanup.splice(0)){if(!directory.startsWith(path.resolve('.test-data')+path.sep))throw Error('Unsafe cleanup');await rm(directory,{recursive:true,force:true});}});
async function game(id='1',tournament='LEC 2026 Summer Playoffs'):Promise<HistoricalGame>{return {...parseGolGame(await readFile('tests/fixtures/gol-game.html','utf8'),champions,id),tournament,league:'UNTRUSTED_LEAGUE'};}

describe('Selected professional competition population',()=>{
 it('recognises the requested main competitions and rejects similarly named minor events',()=>{
  for(const [name,league] of Object.entries({'LFL 2026 Summer Split':'LFL','EMEA Masters 2026 Summer Main Event':'EMEA MASTERS','LCK 2026 Season Playoffs':'LCK','LCK Cup 2026':'LCK','LCS 2026 Summer':'LCS','LTA North 2025 Split 3':'LCS','LEC 2026 Summer Playoffs':'LEC','Worlds 2026 Main Event':'WORLDS'}))expect(coachProLeague(name)).toBe(league);
  for(const name of ['LCK CL 2026 Playoffs','LFL Division 2 2026 Summer','NACL 2026 Summer','LTA South 2025','LPL 2026 Summer','2026 World Star Challengers Invitational','Demacia Cup Global Invitational 2026','EMEA Masters Academy 2026','Worlds Academy 2026'])expect(coachProLeague(name)).toBeNull();
 });
 it('uses tournament identity, removes excluded leagues and deduplicates games',async()=>{
  const kept=await game(),outside=await game('2','LCK CL 2026 Playoffs');outside.league='LCK';
  expect(scopedProGames([kept,kept,outside])).toEqual([{...kept,league:'LEC'}]);
  expect(()=>scopedProGames([kept,{...kept,winner:kept.winner==='red'?'blue':'red'}])).toThrow(/Conflicting/);
 });
 it('recounts wins, pick rates and bans from retained games with an exact per-league denominator',async()=>{
  const first=await game(),second={...await game('2','LCS 2026 Summer'),winner:'blue' as const};
  const games=scopedProGames([first,second]),stats=proStatsFromGames(games),pick=first.lineups!.blue.picks[0];
  const all=stats.find(s=>s.league==='all'&&s.championId===pick.championId&&s.role===pick.role)!;
  expect(all.games).toBe(2);expect(all.wins).toBe(1);expect(all.pickRate).toBe(1);
  expect(stats.find(s=>s.league==='LEC'&&s.championId===pick.championId)?.games).toBe(1);
  const changed={...second,lineups:structuredClone(second.lineups!)};changed.lineups.blue.bans[0]=pick.championId;changed.lineups.blue.picks[0]={...pick,championId:first.lineups!.blue.bans[0]!};
  const adjusted=proStatsFromGames(scopedProGames([first,changed])).find(s=>s.league==='all'&&s.championId===pick.championId)!;
  expect(adjusted.games).toBe(1);expect(adjusted.pickRate).toBe(.5);expect(adjusted.banRate).toBe(.5);
  expect(()=>proStatsFromGames([games[0],games[0]])).toThrow(/Duplicate/);
  expect(()=>proStatsFromGames([{...games[0],lineups:undefined,history:[],draftOrderKnown:false}])).toThrow(/Incomplete/);
 });
 it('does not let a league-specific aggregate replace the global pair baseline',async()=>{
  const games=scopedProGames([await game()]),stats=proStatsFromGames(games);
  expect(gamePairs(games,stats)).toEqual(gamePairs(games,stats.map(s=>s.league==='all'?s:{...s,games:1000,wins:1000})));
 });
 it('never visits excluded tournament lists and never publishes all-league tables in coach collection',async()=>{
  const html=await readFile('tests/fixtures/gol-stats.html','utf8'),existing=await game();
  const page=vi.fn(async(url:string)=>({url,html:url.includes('ajax.trlist')?JSON.stringify([{trname:existing.tournament,nbgames:'1'},{trname:'LCK CL 2026 Summer',nbgames:'3'}]):url.includes('tournament-matchlist')?'<table></table>':html,cached:false,fetchedAt:new Date().toISOString()}));
  const output:any[]=[];
  const result=await scrapeGol({page} as unknown as ScrapeHttp,champions,'16.20',Infinity,()=>{},async(id,rows)=>{output.push({id,rows});},[existing],{leagueScope:'coach',revalidate:true});
  expect(page.mock.calls.every(([url])=>!url.includes('LCK%20CL'))).toBe(true);
  expect(output).toHaveLength(1);expect(output[0].id).toBe('golgg-coach-S16');expect(result.stats.every(s=>['all','LEC'].includes(s.league))).toBe(true);
 });
 it('reuses completed series even when the tournament gains other matches',async()=>{
  const selector=await readFile('tests/fixtures/gol-stats.html','utf8'),games=await Promise.all(['1','2','3'].map(id=>game(id)));
  const tabs=games.map(g=>`<a href="https://gol.gg/game/stats/${g.id.slice(4)}/page-game/">Game</a>`).join('');
  const peek=vi.fn(async(url:string)=>({url,html:url.includes('/champion/')?selector:tabs,cached:true,fetchedAt:'2026-10-14T00:00:00.000Z'}));
  const page=vi.fn(async(url:string)=>({url,html:url.includes('ajax.trlist')?JSON.stringify([{trname:games[0].tournament,nbgames:'3'}]):url.includes('tournament-matchlist')?'<table><tr><td>2 - 1</td><td>16.17</td><td><a href="https://gol.gg/game/stats/1/page-game/">Series</a></td></tr></table>':selector,cached:false,fetchedAt:'2026-10-15T00:00:00.000Z'}));
  const result=await scrapeGol({page,peek} as unknown as ScrapeHttp,champions,'16.20',Infinity,()=>{},async()=>{},games,{leagueScope:'coach',revalidate:true,tournamentCounts:{[games[0].tournament]:'2'}});
  expect(result.games).toHaveLength(3);expect(page.mock.calls.some(([url])=>url.includes('/game/stats/'))).toBe(false);
 });
 it('rebuilds the public export from selected histories, preserving solo statistics and an empty current pro patch',async()=>{
  await mkdir('.test-data',{recursive:true});const directory=await mkdtemp(path.resolve('.test-data/pro-scope-'));cleanup.push(directory);
  const storage=new Storage(path.join(directory,'test.sqlite'));
  try{
   storage.set('staticVersion','16.20.1');storage.set('golProPatches',['16.20','16.19','16.17']);for(const champ of champions)storage.db.prepare('INSERT OR REPLACE INTO champions(id,json) VALUES (?,?)').run(champ.id,JSON.stringify(champ));
   const kept=await game(),outside=await game('2','LCK CL 2026 Summer');
   const global=proStatsFromGames([{...kept,league:'all'},{...outside,league:'all'}]);
   const solo={...global[0],source:'solo' as const,rank:'MASTER_PLUS',patch:'16.20',games:1000,wins:550};
   storage.importPack({schemaVersion:1,id:'golgg-old',createdAt:'2026-10-15T00:00:00.000Z',provenance:{name:'old source',url:'https://gol.gg/',license:'test',demo:false},stats:[...global,{...global[0],patch:'16.20'}],pairs:gamePairs([kept,outside],global),games:[kept,outside]});
   storage.importPack({schemaVersion:1,id:'lolalytics-new',createdAt:'2026-10-15T00:00:00.000Z',provenance:{name:'solo',url:'https://lolalytics.com/',license:'test',demo:false},stats:[solo],pairs:[],games:[]});
   const signature=storage.db.prepare('SELECT raw FROM packs ORDER BY id').all(),output=path.join(directory,'export'),manifest=await exportDataset(storage.db,output);
   const packs=await Promise.all(manifest.parts.map(async part=>JSON.parse(gunzipSync(await readFile(path.join(output,part.sha256+'.json.gz'))).toString('utf8'))));
   const stats=packs.flatMap(p=>p.stats),games=packs.flatMap(p=>p.games),pairs=packs.flatMap(p=>p.pairs);
   expect(games.map(g=>g.id)).toEqual([kept.id]);expect(stats.filter(s=>s.source==='solo')).toEqual([solo]);expect(stats.filter(s=>s.source==='pro'&&s.league==='all').every(s=>s.games===1)).toBe(true);
   expect(pairs.every(p=>p.league==='all'||p.league==='LEC')).toBe(true);expect(manifest.coverage.find(c=>c.source==='pro')?.patches).toEqual(['16.20','16.19','16.17']);
   expect(storage.db.prepare('SELECT raw FROM packs ORDER BY id').all()).toEqual(signature);
  }finally{storage.close();}
 });
});
