import {afterEach,describe,expect,it} from 'vitest';
import {mkdir,mkdtemp,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {DEFAULT_SETTINGS,SEED_CHAMPIONS} from '../src/shared/champions';
import {newDraft} from '../src/shared/draft';
import {proStatsFromGames} from '../src/collector/pro-population';
import {golDraftFormat,golSeriesContext} from '../src/collector/pro-context';
import {proEvidence} from '../src/engine/pro-evidence';
import {teamExpectations} from '../src/engine/team-strength';
import {compositionDuties} from '../src/engine/duties';
import {coachAdjustment,feedbackTeam} from '../src/engine/coach-feedback';
import {feedbackDraftKey,proContextSchema,type CoachFeedback,type ProGameContext} from '../src/shared/coaching';
import type {EngineInput,HistoricalGame} from '../src/shared/types';
import {ROLES} from '../src/shared/types';
import {Storage} from '../src/main/storage';
import {FeedbackService} from '../src/main/feedback';
import type {CloudService} from '../src/main/cloud';

const cleanup:string[]=[];afterEach(async()=>{for(const root of cleanup.splice(0)){if(!root.startsWith(path.resolve('.test-data')+path.sep))throw Error('Unsafe cleanup');await rm(root,{recursive:true,force:true});}});
function game(id:string,offset=0):HistoricalGame{return {id,patch:'16.20',tournament:'Test 2026',league:'LEC',winner:'blue',playedAt:'2026-10-10T00:00:00.000Z',teams:{blue:{id:'alpha',name:'Alpha'},red:{id:'beta',name:'Beta'}},draftOrderKnown:false,history:[],lineups:{blue:{picks:ROLES.map((role,i)=>({role,championId:SEED_CHAMPIONS[offset+i].id})),bans:Array(5).fill(null)},red:{picks:ROLES.map((role,i)=>({role,championId:SEED_CHAMPIONS[offset+5+i].id})),bans:Array(5).fill(null)}}};}
function input(games:HistoricalGame[]=[]):EngineInput{return {draft:{...newDraft('16.20'),teamNames:{ally:'Alpha',enemy:'Beta'}},settings:structuredClone(DEFAULT_SETTINGS),champions:SEED_CHAMPIONS,stats:games.length?proStatsFromGames(games):[],pairs:[],games,demo:false};}
function context(id:string,index:number,format:ProGameContext['format']='fearless',ids=['a','b']):ProGameContext{return {seriesId:'series',index,format,gameIds:ids,source:'https://gol.gg/tournament/test/'};}

describe('Source format and Fearless exposure',()=>{
 it('uses the explicit draft-mode field, not incidental words elsewhere in a page',()=>{
  expect(golDraftFormat('<p>Fearless talent</p><table><tr><td>Draft mode:</td><td>Standard Draft</td></tr></table>')).toBe('standard');
  expect(golDraftFormat('<table><tr><td>Draft mode:</td><td>Fearless Draft</td></tr></table>')).toBe('fearless');
  expect(golDraftFormat('<p>Fearless Draft</p>')).toBe('unknown');
 });
 it('recovers real series game order from the tabs and rejects inconsistent metadata',async()=>{
  const row=golSeriesContext(await readFile('tests/fixtures/gol-game.html','utf8'),'82472','unknown','https://gol.gg/');
  expect(row?.index).toBe(2);expect(row?.gameIds).toEqual(['gol-82471','gol-82472','gol-82473','gol-82474']);
  expect(()=>proContextSchema.parse({schema:1,games:{other:row}})).toThrow();
 });
 it('does not penalise a used champion for being absent from the next Fearless game',()=>{
  const a=game('a'),b=game('b',10),state=input([a,b]);state.settings.proView='fearless';state.proContext={a:context('a',1),b:context('b',2)};
  const result=proEvidence(state),champion=a.lineups!.blue.picks[0].championId;
  expect(result.games).toHaveLength(2);expect(result.stats.find(s=>s.league==='all'&&s.championId===champion)?.pickRate).toBe(1);
  expect(result.report.champions.find(c=>c.championId===champion)?.exposure).toBe(1);
  expect(result.report.champions.find(c=>c.championId===champion)?.rawWinrate).toBe(1);expect(result.report.champions.find(c=>c.championId===champion)?.adjustedEdge).toBe(0);
 });
 it('excludes late games with missing predecessors and contradictory Fearless re-picks',()=>{
  const a=game('a'),b=game('b',10),state=input([b]);state.settings.proView='fearless';state.proContext={b:context('b',2)};
  expect(proEvidence(state).report.incompleteSeries).toBe(1);expect(proEvidence(state).stats).toEqual([]);
  const repeated=input([a,{...b,lineups:a.lineups}]);repeated.settings.proView='fearless';repeated.proContext={a:context('a',1),b:context('b',2)};
  expect(proEvidence(repeated).games).toHaveLength(1);
 });
 it('keeps unknown formats separate, supports strict filters and labels the auto fallback',()=>{
  const state=input([game('unknown')]);state.settings.proView='standard';expect(proEvidence(state).games).toHaveLength(0);
  state.settings={...state.settings,proView:'auto'};expect(proEvidence(state).report.effective).toBe('all');expect(proEvidence(state).report.knownFormats.unknown).toBe(1);expect(proEvidence(state).report.warnings.length).toBeGreaterThan(0);
 });
 it('does not replace an empty league with a different professional competition',()=>{const state=input([game('league')]);state.draft.league='LFL';expect(proEvidence(state).stats).toEqual([]);expect(proEvidence(state).report.games).toBe(0);});
});
describe('Pre-game team correction',()=>{
 it('uses only earlier results, shrinks sparse teams and ignores missing identities or dates',()=>{
  const games=Array.from({length:24},(_,i)=>({...game('g'+i),playedAt:`2026-10-${String(i+1).padStart(2,'0')}T00:00:00.000Z`}));
  const first=teamExpectations(games);expect(first.blue.get('g0')).toBe(.5);expect(first.blue.get('g20')).toBeGreaterThan(.5);expect(first.blue.get('g20')).toBeLessThanOrEqual(.75);
  const changed=teamExpectations(games.map((g,i)=>i===23?{...g,winner:'red'}:g));expect(changed.blue.get('g20')).toBe(first.blue.get('g20'));
  expect(teamExpectations([{...games[0],teams:undefined}]).blue.get('g0')).toBe(.5);
  const sameDay=teamExpectations([game('early'),{...game('late'),winner:'red'}]);expect(sameDay.blue.get('late')).toBe(.5);
 });
 it('reduces the apparent edge of a champion repeatedly played by a dominant team',()=>{
  const games=Array.from({length:24},(_,i)=>({...game('g'+i),playedAt:`2026-10-${String(i+1).padStart(2,'0')}T00:00:00.000Z`})),state=input(games);state.settings.proView='all';
  const champion=games[0].lineups!.blue.picks[0].championId,adjusted=proEvidence(state).stats.find(s=>s.league==='all'&&s.championId===champion)!;
  state.settings={...state.settings,teamStrengthCorrection:false};const raw=proEvidence(state).stats.find(s=>s.league==='all'&&s.championId===champion)!;
  expect(adjusted.games).toBe(raw.games);expect(adjusted.wins).toBe(raw.wins);expect(adjusted.baseline).toBeGreaterThan(raw.baseline);expect(raw.baseline).toBe(.5);
 });
});
describe('Actionable composition duties',()=>{
 it('assigns revealed champions and names missing jobs without guaranteeing lane priority',()=>{
  const team=['Ornn','Vi','Orianna','Jinx','Lulu'].map(id=>SEED_CHAMPIONS.find(c=>c.id===id)!);
  const duties=compositionDuties(team,[...ROLES],'fr');expect(duties).toHaveLength(6);expect(duties.find(d=>d.kind==='follow')?.championId).toBe('Jinx');expect(duties.find(d=>d.kind==='protect')?.championId).toBe('Lulu');
  expect(duties.every(d=>!d.championId||team.some(c=>c.id===d.championId))).toBe(true);expect(duties.find(d=>d.kind==='priority')?.condition).toMatch(/confirmer/);
  expect(compositionDuties([],[],'en').every(d=>d.missing)).toBe(true);
 });
});
describe('Private contextual coach feedback',()=>{
 function vote(state:EngineInput,values:Partial<CoachFeedback>={}):CoachFeedback{return {id:'a',createdAt:'2026-10-15T00:00:00.000Z',championId:'Ahri',role:'MID',side:'blue',verdict:'unplayable',reason:'comfort',note:'',teamKey:feedbackTeam(state),matchId:'m1',draft:structuredClone(state.draft),datasetRevision:'test',...values};}
 it('bounds adjustments, deduplicates a vote and never changes enemy or another team’s ranking',()=>{
  const state=input();state.feedback=[vote(state),vote(state,{id:'b'})];expect(coachAdjustment(state,'Ahri','MID','blue')).toEqual({value:-1,observations:1});expect(coachAdjustment(state,'Ahri','MID','red').value).toBe(0);
  const other={...state,draft:{...state.draft,teamNames:{ally:'Other',enemy:'Beta'}}};expect(coachAdjustment(other,'Ahri','MID','blue').value).toBe(0);
  state.feedback=Array.from({length:100},(_,i)=>vote(state,{id:String(i),matchId:'m'+i}));expect(coachAdjustment(state,'Ahri','MID','blue').value).toBeGreaterThanOrEqual(-3);
 });
 it('does not reuse a bad matchup review against a different opponent',()=>{
  const state=input();state.feedback=[vote(state,{verdict:'bad-matchup',reason:'lane'})];expect(coachAdjustment(state,'Ahri','MID','blue').value).toBe(0);
 });
 it('syncs feedback saved during an earlier request and isolates it when the account changes',async()=>{
  await mkdir('.test-data',{recursive:true});const root=await mkdtemp(path.resolve('.test-data/coach-feedback-'));cleanup.push(root);const store=new Storage(path.join(root,'test.sqlite'));
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),published:unknown[]=[];let first=true;
  const state={configured:true,authorized:true,email:'coach@example.invalid',userId:'91b7b6db-6508-4900-ab40-710da2734e42',role:'coach' as const,organizationId:'test',message:'',syncing:false,revision:'test'};
  const fake={state,request:async(_path:string,body?:{document:unknown})=>{if(body){published.push(body.document);return null;}if(first){first=false;await gate;}return published.map(document=>({document}));}} as unknown as CloudService;
  try{
   store.cloud=state;store.draft={...newDraft('16.20'),teamNames:{ally:'Alpha',enemy:'Beta'}};const service=new FeedbackService(store,fake,()=>{}),inFlight=service.sync();
   const saved=service.save({draftKey:feedbackDraftKey(store.draft,undefined,state.userId,state.revision),championId:'Ahri',role:'MID',side:'blue',verdict:'good',reason:'comfort',note:''});release();await Promise.all([inFlight,saved]);
   expect(published).toHaveLength(1);expect(service.state().entries[0].pending).toBe(false);
   state.userId='ea419204-ffdf-4212-a85d-b37707e7da71';expect(service.state().entries).toHaveLength(0);expect(store.engineInput().feedback).toHaveLength(0);
  }finally{release();store.close();}
 });
 it('persists an offline vote, replaces edits and removes its effect on deletion',async()=>{
  await mkdir('.test-data',{recursive:true});const root=await mkdtemp(path.resolve('.test-data/coach-feedback-'));cleanup.push(root);const store=new Storage(path.join(root,'test.sqlite'));
  const fake={state:{configured:false,authorized:false,userId:''}} as CloudService;
  try{
   store.draft={...newDraft('16.20'),teamNames:{ally:'Alpha',enemy:'Beta'}};store.persist();const service=new FeedbackService(store,fake,()=>{}),request={draftKey:feedbackDraftKey(store.draft,undefined,''),championId:'Ahri',role:'MID' as const,side:'blue' as const,verdict:'good' as const,reason:'comfort' as const,note:'Jouable'};
   const first=await service.save(request);expect(first.entries).toHaveLength(1);expect(first.entries[0].pending).toBe(true);expect(store.engineInput().feedback).toHaveLength(1);
   await service.save({...request,note:'Très à l’aise'});expect(service.state().entries).toHaveLength(1);
   await expect(service.save({...request,draftKey:'stale'})).rejects.toThrow(/contexte/);
   await service.remove(first.entries[0].id);expect(service.state().entries).toHaveLength(0);expect(store.engineInput().feedback).toHaveLength(0);
   store.close();const reopened=new Storage(path.join(root,'test.sqlite'));expect(reopened.feedbackRecords()).toHaveLength(0);expect(reopened.feedbackRecords(true)).toHaveLength(1);reopened.close();
  }catch(error){try{store.close();}catch{}throw error;}
 });
});
