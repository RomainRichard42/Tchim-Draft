/** Policy choices, not measured league-strength estimates. Frozen before evaluation. */
export const LEARNING_POLICY = {
  version:'recency-tier-v1',halfLifeDays:30,halfLifePatches:2,regularization:.1,
  tiers:{worldsMain:1.5,worldsPlayIn:1.25,major:1,masters:.6,regional:.45,unknown:.4,scrim:.25}
} as const;

// Riot's 2026 schedule, checked 2026-10-25 against published patch notes.
// Internal Data Dragon 16.xx corresponds to Riot's display version 26.xx.
// Day-precision games use the OLD live patch on a release day (regional rollout times differ).
export const PATCH_CALENDAR_SOURCE='https://support.riotgames.com/en-us/league-of-legends/gameplay/patch-schedule-league-of-legends';
const calendar=[
 ['16.1','2026-01-08'],['16.2','2026-01-22'],['16.3','2026-02-04'],['16.4','2026-02-19'],
 ['16.5','2026-03-04'],['16.6','2026-03-18'],['16.7','2026-04-01'],['16.8','2026-04-15'],
 ['16.9','2026-04-29'],['16.10','2026-05-13'],['16.11','2026-05-28'],['16.12','2026-06-10'],
 ['16.13','2026-06-24'],['16.14','2026-07-15'],['16.15','2026-07-29'],['16.16','2026-08-12'],
 ['16.17','2026-08-26'],['16.18','2026-09-10'],['16.19','2026-09-23'],['16.20','2026-10-07'],['16.21','2026-10-21']
] as const;
export function historicalLivePatch(day:string):string|undefined {
  // No extrapolation into unverified seasons or beyond this schedule's observation window.
  if(day>'2026-10-25'||day<'2026-01-01')return undefined;
  return [...calendar].reverse().find(([,release])=>release<day)?.[0];
}
export function patchReleaseDay(patch:string):string|undefined{return calendar.find(([p])=>p===patch)?.[1];}
export interface WeightedGame {patch:string;playedAt?:string;league?:string;tournament?:string;source?:'pro'|'scrim'}
export interface WeightContext {asOf:string;livePatch:string}
export function competitionWeight(row:WeightedGame):number {
  const t=LEARNING_POLICY.tiers,league=(row.league??'').toUpperCase();
  if(row.source==='scrim')return t.scrim;
  if(league==='WORLDS')return /play[ -]?in/i.test(row.tournament??'')?t.worldsPlayIn:t.worldsMain;
  if(['LCK','LPL','LEC','LCS'].includes(league))return t.major;
  if(league==='EMEA MASTERS')return t.masters;
  if(league==='LFL')return t.regional;
  return t.unknown;
}
export function gameWeight(row:WeightedGame,context:WeightContext):number {
  const at=Date.parse(context.asOf),date=Date.parse(row.playedAt??'');
  const patch=/^(\d+)\.(\d+)(?:\.\d+)?$/.exec(row.patch),live=/^(\d+)\.(\d+)(?:\.\d+)?$/.exec(context.livePatch);
  if(!Number.isFinite(at)||!Number.isFinite(date)||date>at||!patch||!live||patch[1]!==live[1])return 0;
  const gap=Number(live[2])-Number(patch[2]);if(gap<0)return 0;
  return competitionWeight(row)*2**(-(at-date)/86400000/LEARNING_POLICY.halfLifeDays-gap/LEARNING_POLICY.halfLifePatches);
}
export function effectiveSample(weights:number[]):number {
  const sum=weights.reduce((a,b)=>a+b,0),squares=weights.reduce((a,b)=>a+b*b,0);return squares?sum*sum/squares:0;
}
