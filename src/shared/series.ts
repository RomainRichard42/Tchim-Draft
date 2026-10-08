import type { Draft, Side } from './types';
import { fearlessUsed, order, picks, PRO_ORDER, seriesFinished } from './draft';

// Shared by the IPC boundary and unit tests. A historical ban is not a Fearless ban.
export function validateDraft(draft: Draft, known: Set<string>): Draft {
  const s = draft.series;
  if (draft.mode === 'solo' && s && s.format !== 'single') throw new Error('Fearless requires competitive mode');
  const previous = new Set<string>();
  for (const [index,game] of (s?.games ?? []).entries()) {
    if(seriesFinished({...draft,history:[],series:{format:s!.format,games:s!.games.slice(0,index)}}))throw new Error('Series already won before this game');
    for (const id of game.picks) {
      if (!known.has(id) || previous.has(id)) throw new Error('Unknown or repeated Fearless pick');
      previous.add(id);
    }
    if (game.history) {
      const historical: Draft = {...draft,side:game.side??draft.side,series:{format:s!.format,games:s!.games.slice(0,index)},history:game.history};
      validateDraft(historical,known);
      const actual = PRO_ORDER.flatMap((a,i) => a.kind === 'pick' ? [game.history![i].championId!] : []);
      if (actual.length !== 10 || actual.some(id => !game.picks.includes(id))) throw new Error('Fearless picks do not match archived draft');
    }
  }
  if (seriesFinished(draft) && draft.history.length) throw new Error('Series is complete');
  const sequence = order(draft), ids = new Set<string>(), roles = new Set<string>(), bans = new Map<string,Set<string>>();
  if (draft.history.length > sequence.length) throw new Error('Draft is complete');
  draft.history.forEach((selection,i) => {
    const action = sequence[i], id = selection.championId;
    if (!id) { if (action.kind === 'pick') throw new Error('A pick must have a champion'); return; }
    if (!known.has(id) || fearlessUsed(draft).has(id)) throw new Error('Champion unavailable in Fearless or unknown');
    if (ids.has(id) && !(draft.mode === 'solo' && action.kind === 'ban')) throw new Error('Champion already selected');
    if (action.kind === 'ban') {
      const own = bans.get(action.side) ?? new Set<string>();
      if (own.has(id)) throw new Error('Duplicate ban in one team'); own.add(id); bans.set(action.side,own);
    } else {
      if (!selection.role || roles.has(`${action.side}:${selection.role}`)) throw new Error('Role already assigned or missing');
      roles.add(`${action.side}:${selection.role}`);
    }
    ids.add(id);
  });
  return draft;
}

export function changeSeries(draft: Draft, command: 'next'|'previous'|'reset', winner?: Side): Draft {
  const series = draft.series ?? {format:'single' as const,games:[]};
  if (command === 'reset') return {...draft,history:[],targetRole:'AUTO',series:{...series,games:[]}};
  if (draft.mode !== 'pro' || series.format === 'single') throw new Error('Enable Fearless BO3 or BO5');
  if (command === 'previous') {
    const last = series.games.at(-1); if (!last) throw new Error('No previous game');
    return {...draft,side:last.side??draft.side,history:last.history ?? [],targetRole:'AUTO',series:{...series,games:series.games.slice(0,-1)}};
  }
  if (seriesFinished(draft) || draft.history.length !== 20) throw new Error('Finish the current draft before advancing');
  const ids = [...picks(draft,'blue'),...picks(draft,'red')].map(p => p.championId!);
  if (ids.length !== 10 || new Set(ids).size !== 10) throw new Error('Ten distinct picks required');
  return {...draft,history:[],targetRole:'AUTO',series:{...series,games:[...series.games,{picks:ids,side:draft.side,history:draft.history.map(p=>({...p})),...(winner ? {winner:winner===draft.side?'ally' as const:'enemy' as const} : {})}]}};
}
