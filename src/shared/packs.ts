import type { DataPack, EngineInput } from './types';

export function mergeDataPacks(packs:DataPack[]):Pick<EngineInput,'stats'|'pairs'|'games'|'demo'> {
  // Real packs take precedence; synthetic packs never contaminate real data.
  const real = packs.filter(p => !p.provenance.demo), selected = real.length ? real : packs;
  const stats = new Map<string, DataPack['stats'][number]>(), pairs = new Map<string, DataPack['pairs'][number]>();
  for (const p of selected) {
    for (const s of p.stats) stats.set([s.championId, s.role, s.patch, s.source, s.rank, s.league, s.side].join('|'), s);
    for (const s of p.pairs) pairs.set([s.championId, s.otherId, s.role, s.otherRole, s.kind, s.patch, s.source, s.rank, s.league, s.side].join('|'), s);
  }
  const games = new Map<string, DataPack['games'][number]>();
  selected.forEach(p => p.games.forEach(g => games.set(g.id, g)));
  return {stats:[...stats.values()],pairs:[...pairs.values()],games:[...games.values()],demo:!real.length&&selected.some(p=>p.provenance.demo)};
}
