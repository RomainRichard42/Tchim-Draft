import { createHash } from 'node:crypto';
import type { DraftModel, ScrimRecord, ScoutedTeam, TeamProfile } from '../shared/types';
import { latestPatches } from '../shared/patches';
import { trainingExamples } from './learning';
import type { Champion } from '../shared/types';
import type {HistoricalGame,MetaEnvironment} from '../shared/types';
import {buildMetaContext} from './meta-features';

export function teamKey(name:string,team:ScoutedTeam):string {return createHash('sha256').update(JSON.stringify([name.trim().toLowerCase(),team.players.map(p=>[p.role,p.riotId.trim().toLowerCase()]).sort((a,b)=>a.join('|').localeCompare(b.join('|')))])).digest('hex');}
/** Residual kit affinities from actual results and explicit coach assessments.
 * Bounded and strongly shrunk. One game is one observation, never one per duo.
 */
export function teamProfiles(champions:Champion[],scrims:ScrimRecord[],model:DraftModel,environment?:{games:HistoricalGame[];meta:MetaEnvironment}):{userId:string;profile:TeamProfile}[]{
 const patches=latestPatches(scrims.map(s=>s.draft.patch)),recent=scrims.filter(s=>s.winner&&patches.includes(s.draft.patch));
 const examples=new Map(trainingExamples(champions,[],recent).map(e=>[e.id,e]));
 const buckets=new Map<string,{games:number;sums:Record<string,number>;users:Set<string>}>();
 for(const game of recent){const example=examples.get('scrim:'+game.id);if(!example)continue;
  if(model.learning?.method==='patch-meta-v2'&&environment)example.x={...example.x,...buildMetaContext(environment.games,environment.meta,{asOf:game.playedAt.slice(0,10)+'T00:00:00.000Z',livePatch:game.draft.patch}).features(example.lineups)};
  const base=1/(1+Math.exp(-Object.entries(example.x).reduce((s,[k,v])=>s+(model.features[k]??0)*v,0)));
  const rating=(game.coachRating-1)/4,coachBlue=game.draft.side==='blue'?rating:1-rating;
  const residual=example.y*.7+coachBlue*.3-base;
  for(const side of ['blue','red'] as const){const ally=side===game.draft.side,team=game.teams[ally?'ally':'enemy'],name=side==='blue'?game.blueTeam:game.redTeam;if(!name||!team.players.length)continue;
   const key=teamKey(name,team),bucket=buckets.get(key)??{games:0,sums:{},users:new Set<string>()};bucket.games++;if(game.author)bucket.users.add(game.author);
   for(const axis of ['lanes','bot','objectives','fight','access','side','execution'])bucket.sums[axis]=(bucket.sums[axis]??0)+residual*(side==='blue'?1:-1)*(example.x[axis]??0);
   buckets.set(key,bucket);
  }
 }
 return [...buckets].flatMap(([key,bucket])=>{const profile={key,games:bucket.games,features:Object.fromEntries(Object.entries(bucket.sums).map(([axis,sum])=>[axis,sum/Math.max(1,bucket.games)*2]))};return [...bucket.users].map(userId=>({userId,profile}));});
}
