import { z } from 'zod';
import { ROLES } from './types';
const role = z.enum(ROLES);
const side = z.enum(['blue', 'red']);
const id = z.string().regex(/^[A-Za-z0-9_]+$/).max(80);
export const patchSchema = z.string().regex(/^(unknown|\d{1,2}\.\d{1,2}(\.\d{1,3})?)$/);
export const selectionSchema = z.object({ championId: id.nullable(), role: role.optional() }).strict();
export const seriesSchema = z.object({ format: z.enum(['single','bo3','bo5']), games: z.array(z.object({
  picks: z.array(id).length(10).refine(p => new Set(p).size === 10, 'Ten distinct picks required'),
  history: z.array(selectionSchema).length(20).optional(), winner: z.enum(['ally','enemy']).optional(), side: side.optional()
}).strict()).max(5) }).strict().refine(s => s.games.length <= (s.format === 'single' ? 0 : s.format === 'bo3' ? 3 : 5)
  && new Set(s.games.flatMap(g => g.picks)).size === s.games.length * 10, 'Invalid Fearless series');
export const draftSchema = z.object({ mode: z.enum(['pro', 'solo']), side, role, patch: patchSchema,
  rank: z.string().min(1).max(50), league: z.string().min(1).max(80), history: z.array(selectionSchema).max(20), targetRole: z.union([role, z.literal('AUTO')]),
  series: seriesSchema.default({format:'single',games:[]}) }).strict();
export const configureSchema = draftSchema.omit({ history: true }).partial();
const player = z.object({ riotId: z.string().min(1).max(100), role: z.union([role,z.literal('AUTO')]), pool: z.array(z.object({ championId: id, games: z.number().int().min(0).max(100000), wins: z.number().int().min(0).max(100000), role: role.optional() }).strict().refine(p=>p.wins<=p.games)).max(200), status: z.enum(['loaded','manual','unavailable']), message: z.string().max(1000) }).strict();
const scoutedTeam = z.object({ url: z.string().max(2000), region: z.string().max(20), players: z.array(player).max(5), poolOnly: z.boolean(), fetchedAt: z.string().datetime().optional(), message: z.string().max(1000) }).strict();
export const teamsSchema = z.object({ ally: scoutedTeam, enemy: scoutedTeam }).strict().refine(t => Object.values(t).every(team => new Set(team.players.filter(p=>p.role!=='AUTO').map(p=>p.role)).size===team.players.filter(p=>p.role!=='AUTO').length), 'Assign each team role once');
const weight = z.number().finite().min(0).max(100);
export const settingsSchema = z.object({ language: z.enum(['fr', 'en']), weights: z.object({ winrate: weight, matchup: weight, synergy: weight,
  meta: weight, flex: weight, order: weight, composition: weight, mastery: weight }).refine(w => Object.values(w).some(v => v > 0), 'At least one weight must be positive'),
  pool: z.record(id, z.number().min(0).max(5)), poolOnly: z.boolean(), overlayOpacity: z.number().min(0.4).max(1),
  feedUrl: z.string().max(1000).refine(v => !v || (() => { try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password } catch { return false } })(), 'HTTPS URL required'),
  oldPatchDecay: z.number().min(0).max(1), scrapingEnabled: z.boolean().default(true), dataSource: z.enum(['shared','scrape']).default('shared'), banScoutingWeight: weight.default(35), banImpactWeight: weight.default(40) }).strict();
const counts = { games: z.number().int().min(1).max(1e9), wins: z.number().int().min(0).max(1e9), countMethod: z.enum(['reported', 'rounded_rate']).optional(), reportedWinRate: z.number().min(0).max(1).optional() };
const dimensions = { patch: patchSchema.refine(p => p !== 'unknown'), source: z.enum(['solo', 'pro']), rank: z.string().min(1).max(50), league: z.string().min(1).max(80), side: z.enum(['blue', 'red', 'all']) };
const statSchema = z.object({ championId: id, role, ...dimensions, ...counts, pickRate: z.number().min(0).max(1), banRate: z.number().min(0).max(1), baseline: z.number().min(0.1).max(0.9) }).strict().refine(s => s.wins <= s.games, 'Wins exceed games');
const pairSchema = z.object({ championId: id, otherId: id, role, otherRole: role, kind: z.enum(['synergy', 'matchup']), ...dimensions, ...counts, baseline: z.number().min(0.1).max(0.9) }).strict()
  .refine(s => s.wins <= s.games && s.championId !== s.otherId, 'Invalid pair counts or IDs');
export const packSchema = z.object({ schemaVersion: z.literal(1), id: z.string().regex(/^[a-zA-Z0-9._-]+$/).max(100), createdAt: z.string().datetime(),
  provenance: z.object({ name: z.string().min(1).max(150), url: z.string().url().max(1000), license: z.string().min(1).max(1000), demo: z.boolean() }).strict(),
  stats: z.array(statSchema).max(100000), pairs: z.array(pairSchema).max(300000), games: z.array(z.object({ id: z.string().max(100), patch: patchSchema,
    league: z.string().max(80), tournament: z.string().max(150), winner: side, durationSeconds: z.number().positive().optional(), goldDiff15: z.number().finite().optional(),
    objectives: z.record(z.string(), z.number().finite()).optional(), history: z.array(selectionSchema).max(20), draftOrderKnown: z.boolean().optional(),
    lineups: z.object({ blue: z.object({ picks: z.array(z.object({ championId: id, role }).strict()).length(5), bans: z.array(id.nullable()).length(5) }).strict(),
      red: z.object({ picks: z.array(z.object({ championId: id, role }).strict()).length(5), bans: z.array(id.nullable()).length(5) }).strict() }).strict().optional()
    }).strict().refine(g => g.draftOrderKnown === false ? g.history.length === 0 && !!g.lineups : g.history.length === 20, 'Unknown order requires lineups and empty history')).max(20000) }).strict();
