import { describe, expect, it } from 'vitest';
import { analyze, draftBalance } from '../src/engine';
import { roleContext } from '../src/engine/role-context';
import { DEFAULT_SETTINGS, SEED_CHAMPIONS } from '../src/shared/champions';
import { newDraft, PRO_ORDER } from '../src/shared/draft';
import { ROLES, type Champion, type EngineInput, type PairStat, type Role, type Selection, type Side, type Stat } from '../src/shared/types';

const neutral = (id: string, role: Role): Champion => ({ id, name: id, key: -100, roles: [role], curated: true, tags: [],
  traits: { ad: .5, frontline: 0, engage: 0, peel: 0, poke: 0, early: 1, scaling: 1 } });
const fixture = (role: Role) => {
  const candidate = neutral(`Candidate${role}`, role);
  const allies = ROLES.filter(r => r !== role).map(r => ({ championId: `Ally${r}`, role: r }));
  const enemies = ROLES.map(r => ({ championId: `Enemy${r}`, role: r }));
  const champions = [candidate, ...allies.map(p => neutral(p.championId, p.role)), ...enemies.map(p => neutral(p.championId, p.role))];
  return { candidate, role, allies, enemies, champions, weights: { ...DEFAULT_SETTINGS.weights }, ownPlan: 50, language: 'fr',
    pair: ((_c: Champion, _r: Role, _p: { championId: string | null; role: Role }, _kind: 'matchup' | 'synergy') => null) as Parameters<typeof roleContext>[0]['pair'] };
};
const state = (): EngineInput => ({ draft: newDraft('16.20'), settings: structuredClone(DEFAULT_SETTINGS), champions: SEED_CHAMPIONS, stats: [], pairs: [], demo: false });
const stat = (championId: string, role: Role): Stat => ({ championId, role, source: 'solo', rank: 'MASTER_PLUS', league: 'all', side: 'all', patch: '16.20', games: 5000, wins: 2500, pickRate: .1, banRate: .01, baseline: .5 });
const pair = (championId: string, role: Role, otherId: string, otherRole: Role, values: Partial<PairStat> = {}): PairStat => ({ championId, role, otherId, otherRole, kind: 'matchup', source: 'solo', rank: 'MASTER_PLUS', league: 'all', side: 'all', patch: '16.20', games: 1000, wins: 700, baseline: .5, ...values });
function roster(input: EngineInput, blue: Selection[], red: Selection[], count = 20) {
  const sides: Record<Side, Selection[]> = structuredClone({ blue, red });
  input.draft.history = PRO_ORDER.slice(0, count).map(action => action.kind === 'ban' ? { championId: null } : sides[action.side].shift()!);
}

describe('competitive role context', () => {
  it('uses the agreed role profiles on fully revealed teams with default settings', () => {
    const expected = { TOP: [40, 10, 15, 35], JUNGLE: [10, 20, 30, 40], MID: [25, 15, 25, 35], ADC: [10, 25, 30, 35], SUPPORT: [40, 40, 20] };
    for (const role of ROLES) {
      const context = roleContext(fixture(role));
      expect(context.parts.map(p => Math.round(p.weight))).toEqual(expected[role]);
      expect(context.partial).toBe(false); expect(context.score).toBe(50);
    }
  });
  it('values the same direct counter more at top than jungle or ADC', () => {
    const scores = ROLES.filter(r => r !== 'SUPPORT').map(role => {
      const input = fixture(role); input.pair = (_c, _r, target, kind) => kind === 'matchup' && target.role === role ? { delta: .1, usable: true } : null;
      return [role, roleContext(input).score] as const;
    });
    const score = Object.fromEntries(scores);
    expect(score.TOP).toBeGreaterThan(score.MID); expect(score.MID).toBeGreaterThan(score.ADC); expect(score.MID).toBeGreaterThan(score.JUNGLE);
  });
  it('does not dilute the direct lane factor when unrelated enemies are revealed', () => {
    const input = fixture('TOP'); input.pair = (_c, _r, target) => target.role === 'TOP' ? { delta: .1, usable: true } : null;
    const full = roleContext(input).parts.find(p => p.key === 'lane')!;
    input.enemies = input.enemies.filter(p => p.role === 'TOP');
    expect(roleContext(input).parts.find(p => p.key === 'lane')!.score).toBe(full.score);
  });
  it('uses all four enemy bot edges and counts the ADC/support synergy only inside the duo', () => {
    const input = fixture('SUPPORT');
    for (const principal of ['CandidateSUPPORT', 'AllyADC']) for (const opposing of ['EnemyADC', 'EnemySUPPORT']) {
      input.pair = (c, _r, target, kind) => kind === 'matchup' && c.id === principal && target.championId === opposing ? { delta: .1, usable: true } : null;
      const context = roleContext(input);
      expect(context.parts.find(p => p.key === 'bot')!.score).toBeGreaterThan(50);
      expect(context.parts.filter(p => p.key !== 'bot').every(p => p.score === 50)).toBe(true);
    }
    input.pair = (_c, _r, target, kind) => kind === 'synergy' && target.role === 'ADC' ? { delta: .1, usable: true } : null;
    const result = roleContext(input);
    expect(result.parts.find(p => p.key === 'bot')!.score).toBeGreaterThan(50);
    expect(result.parts.filter(p => p.key !== 'bot').every(p => p.score === 50)).toBe(true);
  });
  it('gives mid/jungle and ADC/support synergies more influence than unrelated allies', () => {
    for (const [role, useful, other] of [['JUNGLE', 'MID', 'TOP'], ['MID', 'JUNGLE', 'TOP'], ['ADC', 'SUPPORT', 'TOP']] as const) {
      const input = fixture(role);
      input.pair = (_c, _r, p, kind) => kind === 'synergy' && p.role === useful ? { delta: .1, usable: true } : null;
      const preferred = roleContext(input).score;
      input.pair = (_c, _r, p, kind) => kind === 'synergy' && p.role === other ? { delta: .1, usable: true } : null;
      expect(preferred).toBeGreaterThan(roleContext(input).score);
    }
  });
  it('keeps missing and insufficient pair evidence neutral, including the bot duo', () => {
    for (const role of ROLES) {
      const input = fixture(role); input.pair = () => ({ delta: .4, usable: false });
      expect(roleContext(input).score).toBe(50);
      input.allies = []; input.enemies = [];
      const context = roleContext(input); expect(context.score).toBe(50); expect(context.partial).toBe(true);
      expect(context.parts.every(p => p.weight === 0)).toBe(true);
      for(const part of context.parts)expect(part.score).toBeCloseTo(50);
    }
  });
  it('adjusts support emphasis as the game is revealed and preserves the base profile', () => {
    const input = fixture('SUPPORT'); input.enemies = input.enemies.filter(p => p.role === 'ADC' || p.role === 'SUPPORT');
    const early = roleContext(input); expect(early.parts.find(p => p.key === 'bot')!.weight).toBeGreaterThan(40);
    input.enemies = fixture('SUPPORT').enemies;
    const late = roleContext(input); expect(late.parts.find(p => p.key === 'opposition')!.weight).toBeGreaterThan(early.parts.find(p => p.key === 'opposition')!.weight);
    expect(late.parts.map(p => p.baseWeight)).toEqual([40, 40, 20]);
  });
  it('respects customized sliders and removes pair effects when their criterion is disabled', () => {
    const input = fixture('SUPPORT'); input.pair = () => ({ delta: .1, usable: true });
    expect(roleContext(input).score).toBeGreaterThan(50);
    input.weights.matchup = 0; input.weights.synergy = 0;
    expect(roleContext(input).score).toBe(50);
    input.weights.composition = 0; expect(roleContext(input).score).toBe(50);
    expect(roleContext(input).parts.every(p => p.weight === 0)).toBe(true);
  });
});

describe('role profiles inside the actual draft engine', () => {
  it('changes support ordering with the opposing duo while win rates and all other context are identical', () => {
    const input = state(); input.draft.targetRole = 'SUPPORT';
    roster(input, [{ championId: 'Ezreal', role: 'ADC' }], [{ championId: 'Ashe', role: 'ADC' }, { championId: 'Nautilus', role: 'SUPPORT' }], 9);
    input.stats = [stat('Lulu', 'SUPPORT'), stat('Janna', 'SUPPORT')];
    input.pairs = [pair('Lulu', 'SUPPORT', 'Ashe', 'ADC'), pair('Janna', 'SUPPORT', 'Ashe', 'ADC', { wins: 300 })];
    expect(analyze(input).picks[0].championId).toBe('Lulu');
    input.draft.history[7] = { championId: 'Caitlyn', role: 'ADC' };
    input.pairs.push(pair('Lulu', 'SUPPORT', 'Caitlyn', 'ADC', { wins: 300 }), pair('Janna', 'SUPPORT', 'Caitlyn', 'ADC'));
    expect(analyze(input).picks[0].championId).toBe('Janna');
  });
  it('neutralizes one- and two-game pro duo outliers in the same ranking', () => {
    for (const games of [1, 2]) {
      const input = state(); input.draft.targetRole = 'SUPPORT';
      roster(input, [{ championId: 'Ezreal', role: 'ADC' }], [{ championId: 'Ashe', role: 'ADC' }, { championId: 'Nautilus', role: 'SUPPORT' }], 9);
      input.stats = [stat('Lulu', 'SUPPORT')];
      const baseline = analyze(input).picks[0];
      input.pairs = [pair('Lulu', 'SUPPORT', 'Ashe', 'ADC', { source: 'pro', rank: 'all', games, wins: games }), pair('Lulu', 'SUPPORT', 'Ezreal', 'ADC', { kind: 'synergy', source: 'pro', rank: 'all', games, wins: games })];
      const outlier = analyze(input).picks[0];
      expect(outlier.context).toEqual(baseline.context); expect(outlier.score).toBe(baseline.score);
    }
  });
  it('uses the support context in the gauge and preserves side symmetry', () => {
    const input = state();
    const blue: Selection[] = [{ championId: 'Ezreal', role: 'ADC' }, { championId: 'Lulu', role: 'SUPPORT' }, { championId: 'Ornn', role: 'TOP' }, { championId: 'Sejuani', role: 'JUNGLE' }, { championId: 'Orianna', role: 'MID' }];
    const red: Selection[] = [{ championId: 'Ashe', role: 'ADC' }, { championId: 'Nautilus', role: 'SUPPORT' }, { championId: 'Gwen', role: 'TOP' }, { championId: 'Vi', role: 'JUNGLE' }, { championId: 'Ahri', role: 'MID' }];
    roster(input, blue, red); input.stats = [...blue, ...red].map(p => stat(p.championId!, p.role!));
    const before = draftBalance(input);
    input.pairs = [pair('Lulu', 'SUPPORT', 'Ashe', 'ADC')];
    const after = draftBalance(input); expect(after.value).toBeGreaterThan(before.value);
    roster(input, red, blue); expect(draftBalance(input).value).toBe(-after.value);
  });
  it('leaves solo queue on its existing scoring path', () => {
    const input = state(); input.draft.mode = 'solo'; input.draft.history = Array.from({ length: 10 }, () => ({ championId: null }));
    expect(analyze(input).picks.every(p => p.context === undefined)).toBe(true);
  });
});
