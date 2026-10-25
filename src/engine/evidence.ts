import type { EngineInput, Stat, PairStat, Side, Role, Champion } from '../shared/types';
import { opposite, PRO_ORDER } from '../shared/draft';
import { posterior, wilson } from './math';
import { latestPatches } from '../shared/patches';
import {proEvidence} from './pro-evidence';
interface Prepared {
  stats: Map<string, Stat[]>; pairs: Map<string, PairStat[]>; roles: Map<string, Set<Role>>;
  aggregates: Map<string, ReturnType<typeof aggregate>>;
  historical: Map<string, { first:number; early: number; blind:number; total: number }>;
  windows: Record<'solo'|'pro',string[]>;
  configuration: string;
  pairsInput: PairStat[]; gamesInput: EngineInput['games']; counts: string;
  contextInput:EngineInput['proContext'];
}
const preparedCache = new WeakMap<Stat[], Prepared>();
export function prepare(input: EngineInput): Prepared {
  input.checkCancelled?.();
  const configuration=JSON.stringify([input.draft.league,input.settings.oldPatchDecay,input.settings.proView,input.settings.proRules,input.settings.teamStrengthCorrection,input.draft.series?.format,input.draft.series?.fearless]);
  const counts=`${input.stats.length}|${input.pairs.length}|${input.games?.length??0}`;
  const existing = preparedCache.get(input.stats); if (existing?.configuration===configuration&&existing.pairsInput===input.pairs&&existing.gamesInput===input.games&&existing.contextInput===input.proContext&&existing.counts===counts) return existing;
  const patches=(source:'solo'|'pro')=>{const stat=input.stats.filter(s=>s.source===source&&(source==='pro'||s.rank==='MASTER_PLUS'||s.rank==='all'));return latestPatches((stat.length?stat:input.pairs.filter(p=>p.source===source)).map(s=>s.patch));};
  const data: Prepared = { stats: new Map(), pairs: new Map(), roles: new Map(), aggregates: new Map(), historical: new Map(),windows:{solo:patches('solo'),pro:patches('pro')},configuration,pairsInput:input.pairs,gamesInput:input.games,contextInput:input.proContext,counts };
  const pro=proEvidence(input);
  for (const row of [...input.stats.filter(s=>s.source!=='pro'),...pro.stats]) {
    const key = `${row.championId}|${row.role}`, values = data.stats.get(key) ?? []; values.push(row); data.stats.set(key, values);
    const roles = data.roles.get(row.championId) ?? new Set<Role>(); roles.add(row.role); data.roles.set(row.championId, roles);
  }
  for (const row of [...input.pairs.filter(s=>s.source!=='pro'),...pro.pairs]) {
    const key = `${row.kind}|${row.championId}|${row.role}|${row.otherId}|${row.otherRole}`, values = data.pairs.get(key) ?? []; values.push(row); data.pairs.set(key, values);
  }
  for (const game of pro.games) {
    if (game.draftOrderKnown === false) continue;
    const age = data.windows.pro.indexOf(game.patch);
    if (age < 0 || (game.league !== input.draft.league && input.draft.league !== 'all')) continue;
    const weight = Math.pow(input.settings.oldPatchDecay, age), seq = PRO_ORDER;
    const revealed:Record<Side,Set<Role>>={blue:new Set(),red:new Set()};
    game.history.forEach((s, i) => {
      if (!s.championId || seq[i].kind !== 'pick') return;
      const side=seq[i].side,key = `${s.championId}|${s.role}|${side}`, current = data.historical.get(key) ?? { first:0,early: 0,blind:0,total: 0 };
      current.total += weight;if(!revealed[side].size)current.first+=weight;
      if(seq[i].phase===1)current.early+=weight;
      if(s.role&&!revealed[opposite(side)].has(s.role))current.blind+=weight;
      if(s.role)revealed[side].add(s.role);data.historical.set(key, current);
    });
  }
  preparedCache.set(input.stats, data); return data;
}
function eligible<T extends Stat | PairStat>(rows: T[], input: EngineInput, side: Side): { row: T; age: number }[] {
  const selected = rows.filter(r => {
    const window=prepare(input).windows[r.source],age = window.indexOf(r.patch.split('.').slice(0,2).join('.'));
    return age >= 0 && (age === 0 || input.settings.oldPatchDecay > 0) &&
      (r.side === side || r.side === 'all') && (r.source==='pro'||r.rank==='MASTER_PLUS'||r.rank==='all') &&
      (r.league === input.draft.league || r.league === 'all');
  });
  // Prefer the most specific slice, never add a global aggregate to its subset.
  const best = new Map<string, T>();
  const specificity = (r: T) => Number(r.side === side) * 4 + Number(r.rank === 'MASTER_PLUS') * 2 + Number(r.league === input.draft.league && r.league !== 'all');
  for (const row of selected) {
    const key = [row.source, row.patch.split('.').slice(0, 2).join('.'), row.championId, row.role, 'otherId' in row ? `${row.otherId}:${row.otherRole}:${row.kind}` : ''].join('|');
    const current = best.get(key); if (!current || specificity(row) > specificity(current)) best.set(key, row);
  }
  return [...best.values()].map(row => ({ row, age: prepare(input).windows[row.source].indexOf(row.patch.split('.').slice(0,2).join('.')) }));
}
export function aggregate(rows: (Stat | PairStat)[], input: EngineInput, side: Side) {
  const filtered = eligible(rows, input, side);
  const groups = (['solo', 'pro'] as const).flatMap(source => {
    const selected = filtered.filter(r => r.row.source === source);
    if (!selected.length) return [];
    let n = 0, wins = 0, baselineTotal = 0, pickRate = 0, banRate = 0, exposure=0;
    for (const { row, age } of selected) {
      const discount = Math.pow(input.settings.oldPatchDecay, age);
      n += row.games * discount; wins += row.wins * discount; baselineTotal += row.baseline * row.games * discount;
      if ('pickRate' in row) { const population=row.pickRate>0?row.games/row.pickRate:row.games;exposure+=population*discount;pickRate += row.pickRate * population * discount; banRate += row.banRate * population * discount }
    }
    const baseline = baselineTotal / n, estimate = posterior(wins, n, baseline, source === 'pro' ? 50 : 200);
    const desired = input.draft.mode === 'pro' ? (source === 'pro' ? .55 : .45) : (source === 'solo' ? .9 : .1);
    const mixture=desired*n/(n+(source==='pro'?80:800));
    const usable=n >= (source==='pro'?10:200), support=usable?n/(n+(source==='pro'?50:200)):0;
    return [{ source, n, wins, baseline, estimate, exposure, pickRate: exposure?pickRate / exposure:0, banRate: exposure?banRate / exposure:0, mixture, usable, support }];
  });
  if (!groups.length) return null;
  const totalWeight = groups.reduce((s, g) => s + g.mixture, 0);
  const avg = (fn: (g: typeof groups[number]) => number) => groups.reduce((s, g) => s + fn(g) * g.mixture, 0) / totalWeight;
  // Each source gets a prior of its own. The mixture never lets the larger solo sample swamp pro data.
  const uncertainty = groups.map(g => wilson(g.wins, g.n));
  return { estimate: avg(g => g.estimate), delta: avg(g => (g.estimate - g.baseline)*g.support), n: groups.reduce((s, g) => s + g.n, 0), usable:groups.some(g=>g.usable),
    confidence: avg(g => g.usable?g.n / (g.n + (g.source === 'pro' ? 100 : 1000)):0),
    interval: [avg(g => uncertainty[groups.indexOf(g)][0]), avg(g => uncertainty[groups.indexOf(g)][1])] as [number, number],
    pickRate: avg(g => g.pickRate), banRate: avg(g => g.banRate), groups, sources: groups.map(g => g.source).join(' + '), old: filtered.some(r => r.age > 0), rounded: filtered.some(r => r.row.countMethod === 'rounded_rate') };
}
export function pairRows(input: EngineInput, candidate: Champion, role: Role, target: { championId: string | null; role: Role }, kind: PairStat['kind']): PairStat[] {
  const prepared = prepare(input);
  const direct = prepared.pairs.get(`${kind}|${candidate.id}|${role}|${target.championId}|${target.role}`) ?? [];
  if (direct.length) return direct;
  return (prepared.pairs.get(`${kind}|${target.championId}|${target.role}|${candidate.id}|${role}`) ?? [])
    .map(p => ({ ...p, championId: candidate.id, otherId: target.championId!, role, otherRole: target.role,
      wins: kind === 'matchup' ? p.games - p.wins : p.wins, baseline: kind === 'matchup' ? 1 - p.baseline : p.baseline,
      side: kind === 'matchup' && p.side !== 'all' ? opposite(p.side) : p.side }));
}

export function evidence(input:EngineInput,id:string,role:Role,side:Side) {
 const p=prepare(input),key=`${input.draft.mode}|${input.draft.league}|${side}|stat|${id}|${role}`;
 if(!p.aggregates.has(key))p.aggregates.set(key,aggregate(p.stats.get(`${id}|${role}`)??[],input,side));
 return p.aggregates.get(key)??null;
}
export function interaction(input:EngineInput,id:string,role:Role,otherId:string,otherRole:Role,side:Side,kind:PairStat['kind']) {
 const p=prepare(input),key=`${input.draft.mode}|${input.draft.league}|${side}|${kind}|${id}|${role}|${otherId}|${otherRole}`;
 if(!p.aggregates.has(key)){const champion=input.champions.find(c=>c.id===id);p.aggregates.set(key,champion?aggregate(pairRows(input,champion,role,{championId:otherId,role:otherRole},kind),input,side):null);}
 return p.aggregates.get(key)??null;
}
