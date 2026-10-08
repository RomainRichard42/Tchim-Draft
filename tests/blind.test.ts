import { describe, expect, it } from 'vitest';
import { analyze } from '../src/engine';
import { assessBlind, blindDevelopment } from '../src/engine/blind';
import { DEFAULT_SETTINGS, SEED_CHAMPIONS } from '../src/shared/champions';
import { newDraft } from '../src/shared/draft';
import type { EngineInput, PairStat, Role, Stat } from '../src/shared/types';

const stat = (championId: string, role: Role, values: Partial<Stat> = {}): Stat => ({ championId, role, patch: '16.20', source: 'solo', rank: 'MASTER_PLUS', league: 'all', side: 'all', games: 5000, wins: 2500, baseline: .5, pickRate: .1, banRate: .01, ...values });
const pair = (otherId: string, values: Partial<PairStat> = {}): PairStat => ({ championId: 'Camille', role: 'TOP', otherId, otherRole: 'TOP', kind: 'matchup', patch: '16.20', source: 'solo', rank: 'MASTER_PLUS', league: 'all', side: 'all', games: 5000, wins: 1750, baseline: .5, ...values });
const state = (): EngineInput => ({ draft: { ...newDraft('16.20'), targetRole: 'TOP', history: Array.from({ length: 6 }, () => ({ championId: null })) },
  settings: structuredClone(DEFAULT_SETTINGS), champions: SEED_CHAMPIONS.map(c => ({ ...c, traits: { ad: .5, frontline: 0, engage: 0, peel: 0, poke: 0, early: 1, scaling: 1 } })),
  stats: [stat('Camille', 'TOP', { wins: 2700 }), stat('Ornn', 'TOP'), stat('Jax', 'TOP'), stat('Renekton', 'TOP')],
  pairs: [pair('Jax'), pair('Renekton', { wins: 2500 })], demo: false });
const candidate = (input: EngineInput) => analyze(input).picks.find(p => p.championId === 'Camille')!;

describe('blind response assessment', () => {
  it('distinguishes qualitative lane development from statistical counter evidence', () => {
    const champ = (id: string) => SEED_CHAMPIONS.find(c => c.id === id)!;
    expect(blindDevelopment(champ('Camille'))).toBeGreaterThan(blindDevelopment(champ('Renekton')));
    expect(blindDevelopment(champ('Kayle'))).toBeGreaterThan(blindDevelopment(champ('Ornn')));
    expect(blindDevelopment({ ...champ('Camille'), curated: false })).toBe(0);
  });
  it('does not invent a safe certificate or a matchup effect with missing or unusable evidence', () => {
    const empty = assessBlind([]); expect(empty.score).toBe(50); expect(empty.coverage).toBe(0);
    const sparse = assessBlind([{ championId: 'Jax', popularity: .1, familiarity: 0, evidence: { delta: -.4, usable: false } }]);
    expect(sparse.statisticalScore).toBe(50); expect(sparse.uncertaintyPenalty).toBe(12); expect(sparse.score).toBe(38);
    expect(sparse.assessed).toBe(0); expect(sparse.coverage).toBe(0); expect(sparse.threats).toEqual([]);
  });
  it('penalizes plausible targeted replies and reduces exposure when they are removed', () => {
    const neutral = { championId: 'Ornn', popularity: .1, familiarity: 0, evidence: { delta: 0, usable: true } };
    const counter = { championId: 'Jax', popularity: .1, familiarity: 0, evidence: { delta: -.08, usable: true } };
    expect(assessBlind([neutral, counter]).score).toBeLessThan(assessBlind([neutral]).score);
    expect(assessBlind([neutral, counter]).threats[0].championId).toBe('Jax');
    expect(assessBlind([neutral, counter], .625).score).toBeGreaterThan(assessBlind([neutral, counter], 1).score);
  });
  it('uses enemy familiarity without turning a rare statistical outlier into the sole worst case', () => {
    const replies = [{ championId: 'Common', popularity: .15, familiarity: 0, evidence: { delta: 0, usable: true } },
      { championId: 'Rare', popularity: .001, familiarity: 0, evidence: { delta: -.04, usable: true } }];
    const ordinary = assessBlind(replies).score; expect(ordinary).toBeGreaterThan(47);
    replies[1].familiarity = 1; expect(assessBlind(replies).score).toBeLessThan(ordinary);
  });
});

describe('competitive blind picks in the engine', () => {
  it('demotes a vulnerable Camille at the first pick and after two allied picks, despite a better general win rate', () => {
    const input = state();
    for (const late of [false, true]) {
      if (late) input.draft.history.push({ championId: 'Sejuani', role: 'JUNGLE' }, { championId: 'Ashe', role: 'ADC' }, { championId: 'Nautilus', role: 'SUPPORT' }, { championId: 'Ahri', role: 'MID' });
      const result = analyze(input), camille = result.picks.find(p => p.championId === 'Camille')!, ornn = result.picks.find(p => p.championId === 'Ornn')!;
      expect(camille.factors.winrate).toBeGreaterThan(ornn.factors.winrate); expect(camille.score).toBeLessThan(ornn.score);
      expect(camille.blind!.threats[0].championId).toBe('Jax'); expect(camille.summary).toContain('Blind exposé');
      expect(camille.context!.parts.find(p => p.key === 'lane')!.weight).toBeGreaterThan(0);
    }
  });
  it('takes bans and Fearless exclusions into account without banning the champion from suggestions', () => {
    const input = state(), exposed = candidate(input);
    input.draft.history[0] = { championId: 'Jax' };
    const protectedByBan = candidate(input); expect(protectedByBan.blind!.score).toBeGreaterThan(exposed.blind!.score);
    expect(protectedByBan.score).toBeGreaterThan(exposed.score); expect(protectedByBan.blind!.threats.some(p => p.championId === 'Jax')).toBe(false);
    input.draft.history[0] = { championId: null };
    input.draft.series = { format: 'bo3', games: [{ picks: ['Jax', 'Ahri', 'Ashe', 'Nautilus', 'Sejuani', 'Jinx', 'Lulu', 'Orianna', 'Vi', 'Gwen'] }] };
    expect(candidate(input).blind!.score).toBe(protectedByBan.blind!.score);
  });
  it('uses the revealed matchup instead of speculative counters once the enemy top is known', () => {
    const input = state(); input.draft.side = 'red'; input.draft.history.push({ championId: 'Renekton', role: 'TOP' });
    const result = candidate(input); expect(result.blind).toBeUndefined();
    expect(result.context!.parts.find(p => p.key === 'lane')!.label).toBe('Matchup contre le vis-à-vis');
  });
  it('restricts possible responses to an explicit enemy top pool and reacts when the pool changes', () => {
    const input = state(), empty = { url: '', region: 'euw', players: [], poolOnly: false, message: '' };
    input.teams = { ally: empty, enemy: { ...empty, poolOnly: true, players: [{ riotId: 'Fixture#TEST', role: 'TOP', status: 'manual', message: '', pool: [{ championId: 'Renekton', role: 'TOP', games: 0, wins: 0 }] }] } };
    const protectedByPool = candidate(input); expect(protectedByPool.blind!.threats).toEqual([]);
    input.teams.enemy.players[0].pool = [{ championId: 'Jax', role: 'TOP', games: 0, wins: 0 }];
    expect(candidate(input).score).toBeLessThan(protectedByPool.score);
  });
  it('weights actual enemy comfort rather than treating confidence in an absent pool champion as familiarity', () => {
    const input = state(); input.pairs[0].wins = 2250; const unscouted = candidate(input);
    const empty = { url: '', region: 'euw', players: [], poolOnly: false, message: '' };
    input.teams = { ally: empty, enemy: { ...empty, players: [{ riotId: 'Fixture#TEST', role: 'TOP', status: 'manual', message: '', pool: [{ championId: 'Renekton', role: 'TOP', games: 500, wins: 250 }] }] } };
    const neutralComfort = candidate(input);
    expect(neutralComfort.blind!.score).toBeGreaterThan(unscouted.blind!.score);
    expect(neutralComfort.blind!.available).toBe(unscouted.blind!.available);
    input.teams.enemy.players[0].pool = [{ championId: 'Jax', role: 'TOP', games: 500, wins: 250 }];
    expect(candidate(input).blind!.score).toBeLessThan(unscouted.blind!.score);
  });
  it('filters the response population on the opponent side and rejects tiny offrole observations', () => {
    const input = state(); input.stats = input.stats.map(s => s.championId === 'Jax' ? { ...s, side: 'blue' } : s);
    input.stats.push(stat('Qiyana', 'TOP', { source: 'pro', games: 2, wins: 2, pickRate: .001 }), stat('Qiyana', 'JUNGLE'));
    input.pairs.push(pair('Qiyana', { wins: 0 }));
    expect(candidate(input).blind!.threats).toEqual([]);
  });
  it('does not amplify perfect one- or two-game counter results', () => {
    for (const games of [1, 2]) {
      const input = state(); input.pairs = []; const before = candidate(input);
      input.pairs = [pair('Jax', { source: 'pro', rank: 'all', games, wins: 0 })];
      const after = candidate(input); expect(after.blind).toEqual(before.blind); expect(after.score).toBe(before.score);
    }
  });
  it('keeps the existing solo scoring path and never adds an individual blind assessment to support', () => {
    const input = state(); input.draft.targetRole = 'SUPPORT'; input.stats.push(stat('Lulu', 'SUPPORT'));
    expect(analyze(input).picks.every(p => p.blind === undefined)).toBe(true);
    input.draft.mode = 'solo'; input.draft.targetRole = 'TOP'; input.draft.history = Array.from({ length: 10 }, () => ({ championId: null }));
    expect(candidate(input).blind).toBeUndefined();
  });
});
