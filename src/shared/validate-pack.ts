import { packSchema } from './validation';
import { order, newDraft } from './draft';
import type { DataPack } from './types';

export function validateDataPack(raw:unknown,known:Set<string>):DataPack {
  const pack = packSchema.parse(raw);
  const rows = [...pack.stats, ...pack.pairs];
  for (const r of rows) {
    if (!known.has(r.championId) || ('otherId' in r && !known.has(r.otherId))) throw new Error(`Unknown champion: ${r.championId}. Refresh Data Dragon first.`);
  }
  const keys = new Set<string>();
  for (const r of rows) {
    const key = [r.championId, r.role, r.patch, r.source, r.rank, r.league, r.side, 'kind' in r ? `${r.kind}|${r.otherId}|${r.otherRole}` : 'stat'].join('|');
    if (keys.has(key)) throw new Error(`Duplicate aggregate: ${key}`); keys.add(key);
  }
  for (const game of pack.games) {
    const ids = new Set<string>(), roles = new Set<string>();
    if (game.draftOrderKnown === false && game.lineups) {
      for (const side of ['blue', 'red'] as const) {
        for (const pick of game.lineups[side].picks) {
          if (!known.has(pick.championId) || ids.has(pick.championId) || roles.has(`${side}:${pick.role}`)) throw new Error('Invalid historical lineup');
          ids.add(pick.championId); roles.add(`${side}:${pick.role}`);
        }
      }
      for (const team of Object.values(game.lineups)) for (const id of team.bans) {
        if (id && (!known.has(id) || ids.has(id))) throw new Error('Invalid historical ban'); if (id) ids.add(id);
      }
      continue;
    }
    const sequence = order(newDraft(game.patch));
    game.history.forEach((s, i) => {
      if (!s.championId && sequence[i].kind === 'pick') throw new Error('Historical picks cannot be empty');
      if (s.championId) {
        if (!known.has(s.championId) || ids.has(s.championId)) throw new Error('Invalid historical champion'); ids.add(s.championId);
        if (sequence[i].kind === 'pick') {
          if (!s.role || roles.has(`${sequence[i].side}:${s.role}`)) throw new Error('Invalid historical role');
          roles.add(`${sequence[i].side}:${s.role}`);
        }
      }
    });
  }
  return pack;
}
