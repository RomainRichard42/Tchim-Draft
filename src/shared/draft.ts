import type { Action, Draft, Role, Selection, Side } from './types';
import { ROLES } from './types';

export const PRO_ORDER: Action[] = [
  ...Array.from({ length: 6 }, (_, i) => ({ kind: 'ban' as const, side: (i % 2 ? 'red' : 'blue') as Side, label: `${i % 2 ? 'R' : 'B'} ban ${Math.floor(i / 2) + 1}`, phase: 1 })),
  ...(['blue', 'red', 'red', 'blue', 'blue', 'red'] as Side[]).map((side, i) => ({ kind: 'pick' as const, side, label: ['B1', 'R1', 'R2', 'B2', 'B3', 'R3'][i], phase: 1 })),
  ...(['red', 'blue', 'red', 'blue'] as Side[]).map((side, i) => ({ kind: 'ban' as const, side, label: `${side === 'blue' ? 'B' : 'R'} ban ${4 + Math.floor(i / 2)}`, phase: 2 })),
  ...(['red', 'blue', 'blue', 'red'] as Side[]).map((side, i) => ({ kind: 'pick' as const, side, label: ['R4', 'B4', 'B5', 'R5'][i], phase: 2 }))
];
export const SOLO_ORDER: Action[] = [
  ...Array.from({ length: 10 }, (_, i) => ({ kind: 'ban' as const, side: (i < 5 ? 'blue' : 'red') as Side, label: `${i < 5 ? 'B' : 'R'} ban ${i % 5 + 1}`, phase: 1 })),
  ...(['blue', 'red', 'red', 'blue', 'blue', 'red', 'red', 'blue', 'blue', 'red'] as Side[]).map((side, i) => ({ kind: 'pick' as const, side, label: ['B1', 'R1', 'R2', 'B2', 'B3', 'R3', 'R4', 'B4', 'B5', 'R5'][i], phase: 1 }))
];
export function seriesFinished(draft: Draft): boolean {
  const s = draft.series;
  if (draft.mode !== 'pro' || !s || s.format === 'single') return false;
  const limit = s.format === 'bo3' ? 3 : 5, required = Math.ceil(limit / 2);
  return s.games.length >= limit || (['ally','enemy'] as const).some(side => s.games.filter(g => g.winner === side).length >= required);
}
export function fearlessUsed(draft: Draft): Set<string> {
  return new Set(draft.mode === 'pro' && draft.series?.format !== 'single' ? draft.series?.games.flatMap(g => g.picks) ?? [] : []);
}
export function order(draft: Draft): Action[] { return seriesFinished(draft) ? [] : draft.mode === 'pro' ? PRO_ORDER : SOLO_ORDER }
export function used(draft: Draft): Set<string> { return new Set(draft.history.flatMap(s => s.championId ? [s.championId] : [])) }
export function picks(draft: Draft, side: Side): (Selection & { role: Role })[] {
  return draft.history.flatMap((s, i) => order(draft)[i]?.kind === 'pick' && order(draft)[i].side === side && s.championId && s.role ? [{ ...s, role: s.role }] : []);
}
export function freeRoles(draft: Draft, side: Side): Role[] {
  const assigned = new Set(picks(draft, side).map(s => s.role)); return ROLES.filter(r => !assigned.has(r));
}
export function opposite(side: Side): Side { return side === 'blue' ? 'red' : 'blue' }
export const DEFAULT_WEIGHTS = { winrate: 14, matchup: 18, synergy: 18, meta: 16, flex: 3, order: 8, composition: 18, mastery: 5 };
export function newDraft(patch = 'unknown'): Draft {
  return { mode: 'pro', side: 'blue', role: 'MID', patch, rank: 'MASTER_PLUS', league: 'all', history: [], targetRole: 'AUTO', series:{format:'single',games:[]} };
}
