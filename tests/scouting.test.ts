import { describe,it,expect } from 'vitest';
import { parseMultiUrl,parsePlayer,nextRecords } from '../src/collector/opgg';
import { SEED_CHAMPIONS } from '../src/shared/champions';
const html=(data:unknown)=>`<html><title>Test User#EUW - champion information</title><script>self.__next_f.push(${JSON.stringify([1,`6:${JSON.stringify(data)}\n`])})</script></html>`;
const champions=SEED_CHAMPIONS.map(c=>({...c,key:c.id==='Ahri'?103:c.key}));
describe('OP.GG public profile import',()=>{
 // Fictional Riot IDs; no real player profile or pool is included.
 it('accepts a German multi URL, preserves Riot IDs and rejects external/credential URLs',()=>{
  const parsed=parseMultiUrl('https://op.gg/de/lol/multisearch/euw?summoners=Fixture+One%23TEST1%2CFixtureTwo%23TEST2%2CFixtureThree%23TEST3%2CFixtureFour%23TEST4%2CFixtureFive%23TEST5');
  expect(parsed.riotIds).toEqual(['Fixture One#TEST1','FixtureTwo#TEST2','FixtureThree#TEST3','FixtureFour#TEST4','FixtureFive#TEST5']);
  expect(()=>parseMultiUrl('https://op.gg.evil.test/lol/multisearch/euw?summoners=x%23EUW')).toThrow();
  expect(()=>parseMultiUrl('https://user@op.gg/lol/multisearch/euw?summoners=x%23EUW')).toThrow();
 });
 it('extracts only the player played-champion table, excluding opponents and site recommendations',()=>{
  const data={profile:{game_type:'RANKED',season_id:33,my_champion_stats:[{champion_id:103,play:100,win:55,lose:45}],opponent_champion_stats:[{champion_id:103,play:100,win:99,lose:1}]},meta:{summoner_profile_position_hints:[{position:'MID',tag:'MAIN'}]}};
  const player=parsePlayer(html(data),champions,'Test User#EUW');expect(player.pool).toEqual([{championId:'Ahri',games:100,wins:55}]);expect(player.role).toBe('MID');
  expect(()=>parsePlayer(html(data),champions,'Other#EUW')).toThrow(/autre joueur/);
 });
 it('never evaluates source JavaScript, and rejects inconsistent counters',()=>{
  expect(nextRecords('<script>self.__next_f.push(alert("evil"))</script>')).toEqual([]);
  const data={game_type:'RANKED',season_id:33,my_champion_stats:[{champion_id:103,play:100,win:99,lose:99}]};
  expect(()=>parsePlayer(html(data),champions,'Test User#EUW')).toThrow(/incohérents/);
 });
});
