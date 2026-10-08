import { describe, expect, it } from 'vitest';
import { analyze } from '../src/engine';
import { patchDistance, posterior, wilson } from '../src/engine/math';
import { DEFAULT_SETTINGS, SEED_CHAMPIONS } from '../src/shared/champions';
import { newDraft, order, picks, PRO_ORDER, used } from '../src/shared/draft';
import { packSchema, settingsSchema } from '../src/shared/validation';
import type { DataPack, EngineInput, Stat } from '../src/shared/types';

function input(): EngineInput { return { draft: newDraft('16.20'), settings: structuredClone(DEFAULT_SETTINGS), champions: SEED_CHAMPIONS, stats: [], pairs: [], demo: false } }
function stat(value: Partial<Stat> = {}): Stat { return { championId: 'Ahri', role: 'MID', patch: '16.20', source: 'solo', rank: 'all', league: 'all', side: 'all', games: 1000, wins: 510, pickRate: 0.1, banRate: 0.1, baseline: 0.5, ...value } }
function pickPhase(base = input()): EngineInput { base.draft.history = Array.from({ length: 6 }, () => ({ championId: null })); base.draft.targetRole = 'MID'; return base }
describe('draft rules and constrained simulations', () => {
  it('uses the exact tournament B1/R1/R2/B2/B3/R3, R4/B4/B5/R5 order and second-ban phase', () => {
    expect(PRO_ORDER.filter(a => a.kind === 'pick').map(a => a.label)).toEqual(['B1','R1','R2','B2','B3','R3','R4','B4','B5','R5']);
    expect(PRO_ORDER.slice(12, 16).map(a => a.side)).toEqual(['red','blue','red','blue']);
    expect(PRO_ORDER.filter(a => a.kind === 'ban')).toHaveLength(10);
  });
  it('completes three branches with ten distinct picks, ten bans, and all roles on both sides', () => {
    const base = input(), result = analyze(base); expect(result.scenarios).toHaveLength(3);
    for (const s of result.scenarios) {
      const d = { ...base.draft, history: s.history }; expect(d.history).toHaveLength(20);
      expect(used(d).size).toBe(d.history.filter(h => h.championId).length);
      expect(new Set(picks(d, 'blue').map(p => p.role)).size).toBe(5); expect(new Set(picks(d, 'red').map(p => p.role)).size).toBe(5);
      expect(s.winProbability).toBeNull();
    }
  });
  it('excludes every previously picked or banned champion', () => {
    const base = pickPhase(); base.draft.history[0] = { championId: 'Ahri' };
    expect(analyze(base).picks.some(p => p.championId === 'Ahri')).toBe(false);
  });
  it('recommends pairs for consecutive tournament picks with different roles and champions', () => {
    const base = input(); base.draft.side = 'red'; base.draft.history = [...Array.from({ length: 6 }, () => ({ championId: null })), { championId: 'Ahri', role: 'MID' }];
    const result = analyze(base); expect(result.duos).toHaveLength(3);
    for (const duo of result.duos) { expect(duo.first.role).not.toBe(duo.second.role); expect(duo.first.championId).not.toBe(duo.second.championId); expect(duo.response?.championId).not.toBe(duo.first.championId) }
  });
  it('restricts playable suggestions but never bans to the declared pool', () => {
    const base = pickPhase(); base.draft.mode='solo';base.draft.role='MID';base.draft.history=Array.from({length:10},()=>({championId:null}));base.settings.poolOnly = true; base.settings.pool = { Ahri: 5 };
    const result = analyze(base); expect(result.picks.map(r => r.championId)).toEqual(['Ahri']);
    expect(result.bans.some(r => r.championId !== 'Ahri')).toBe(true);
  });
});
describe('statistics, uncertainty, source weighting and dimensions', () => {
  it('shrinks an extreme small sample and gives it a wide Wilson interval', () => {
    expect(posterior(3, 3)).toBeLessThan(0.52);
    const small = wilson(3, 3), large = wilson(800, 1000);
    expect(small[1] - small[0]).toBeGreaterThan(large[1] - large[0]);
    expect(wilson(0, 0)).toEqual([0, 1]);
  });
  it('does not invent statistics or probabilities for qualitative profiles', () => {
    const result = analyze(pickPhase()); expect(result.picks.every(r => r.winrate === null && r.confidence === 0 && r.games === 0)).toBe(true);
    expect(result.scenarios.every(s => s.winProbability === null)).toBe(true);
  });
  it('excludes incompatible rank/side/league while fixing the collection population to Master+', () => {
    const base = pickPhase(); base.stats = [stat({ rank: 'GOLD' }), stat({ side: 'red' }), stat({ league: 'LCK' })];
    expect(analyze(base).picks.every(r=>r.winrate===null)).toBe(true);
    expect(patchDistance('16.20.1', '16.19.1')).toBe(1);
  });
  it('prefers the exact aggregate over its global parent, without double counting', () => {
    const base = pickPhase(); base.settings.poolOnly = true; base.settings.pool = { Ahri: 5 };
    base.stats = [stat({ games: 10000, wins: 9000 }), stat({ side: 'blue', rank: 'MASTER_PLUS', games: 1000, wins: 400 })];
    const rec = analyze(base).picks[0]; expect(rec.games).toBe(1000); expect(rec.winrate).toBeCloseTo(500 / 1200);
  });
  it('weights pro sources more strongly in pro mode even when solo games are much more numerous', () => {
    const base = pickPhase(); base.settings.poolOnly = true; base.settings.pool = { Ahri: 5 };
    base.stats = [stat({ games: 100000, wins: 40000 }), stat({ source: 'pro', games: 1000, wins: 650 })];
    const pro = analyze(base).picks[0].winrate!; base.draft.mode = 'solo'; base.draft.history = Array.from({ length: 10 }, () => ({ championId: null }));
    const solo = analyze(base).picks[0].winrate!; expect(pro).toBeGreaterThan(solo + .1);
  });
  it('uses exactly three latest available source patches regardless of selected patch', () => {
    const base = pickPhase(); base.settings.poolOnly = true; base.settings.pool = { Ahri: 5 }; base.settings.oldPatchDecay = .5;
    base.stats = ['16.20','16.19','16.18','16.15'].map(patch=>stat({patch,games:1000}));expect(analyze(base).picks[0].games).toBe(1750);
    base.draft.patch='16.01';expect(analyze(base).picks[0].games).toBe(1750);
    base.settings.oldPatchDecay = 0; expect(analyze(base).picks[0].games).toBe(1000);
  });
  it('applies observed synergy and reverses a matchup with swapped sides', () => {
    const base = pickPhase(); base.draft.side = 'red'; base.draft.history.push({ championId: 'Jayce', role: 'TOP' }); base.draft.targetRole = 'TOP';
    base.settings.poolOnly = true; base.settings.pool = { Malphite: 5 };
    base.pairs = [{ championId: 'Jayce', role: 'TOP', otherId: 'Malphite', otherRole: 'TOP', kind: 'matchup', source: 'solo', side: 'blue', patch: '16.20', rank: 'all', league: 'all', games: 1000, wins: 400, baseline: .5 }];
    expect(analyze(base).picks[0].factors.matchup).toBeGreaterThan(70);
  });
});
describe('untrusted import and settings validation', () => {
  it('rejects invalid counts, executable IDs and unsupported schema versions', () => {
    const pack: DataPack = { schemaVersion: 1, id: 'test', createdAt: new Date().toISOString(), provenance: { name: 'test', url: 'https://example.org', license: 'test fixture', demo: true }, stats: [stat()], pairs: [], games: [] };
    expect(packSchema.safeParse(pack).success).toBe(true);
    expect(packSchema.safeParse({ ...pack, stats: [stat({ wins: 1001 })] }).success).toBe(false);
    expect(packSchema.safeParse({ ...pack, stats: [stat({ championId: '../../evil' })] }).success).toBe(false);
    expect(packSchema.safeParse({ ...pack, schemaVersion: 2 }).success).toBe(false);
  });
  it('rejects unsafe feeds, opacity and zeroed scoring weights', () => {
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, feedUrl: 'http://example.org' }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, overlayOpacity: .1 }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, weights: Object.fromEntries(Object.keys(DEFAULT_SETTINGS.weights).map(k => [k, 0])) }).success).toBe(false);
  });
});
