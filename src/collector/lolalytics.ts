import { z } from 'zod';
import type { Champion, PairStat, Role, Stat, DataPack } from '../shared/types';
import { qwikData } from './qwik';
import type { ScrapeHttp } from './http';

export const LANES: Record<Role, string> = { TOP: 'top', JUNGLE: 'jungle', MID: 'middle', ADC: 'bottom', SUPPORT: 'support' };
const laneRole = Object.fromEntries(Object.entries(LANES).map(([role, lane]) => [lane, role])) as Record<string, Role>;
const pct = z.number().finite().min(0).max(100), count = z.number().int().min(1).max(1e9);
const rowSchema = z.object({ lane: z.enum(['top', 'jungle', 'middle', 'bottom', 'support']), wr: pct, pr: pct, br: pct, games: z.number().int().min(0).max(1e9) });
const navSchema = z.object({ patch: z.string(), tier: z.string(), region: z.literal('all'), mode: z.literal('ranked'), lane: z.string() });
function find(records: Record<string, unknown>[], keys: string[]): Record<string, unknown> {
  const found = records.find(r => r.raw && typeof r.raw === 'object' && keys.every(k => k in (r.raw as object)));
  if (!found) throw new Error(`Lolalytics HTML changed: missing ${keys.join('/')}`);
  return found.value as Record<string, unknown>;
}
export function parseTierlist(html: string, champions: Champion[], expected: { patch: string; tier: string; lane: string }): { stats: Stat[]; analysed: number; unknown: string[] } {
  const objects = qwikData(html), nav = navSchema.parse(find(objects, ['currentPatch', 'modeName', 'page']));
  if (nav.patch !== expected.patch || nav.tier !== expected.tier || nav.lane !== expected.lane) throw new Error('Lolalytics returned a different patch/rank/role');
  const data = find(objects, ['cid', 'fields', 'avgWr', 'analysed']), baseline = pct.parse(data.avgWr) / 100;
  const analysed = count.parse(data.analysed);
  if (baseline < .4 || baseline > .65 || !data.cid || typeof data.cid !== 'object') throw new Error('Invalid Lolalytics population');
  const byKey = new Map(champions.map(c => [String(c.key), c.id])), stats: Stat[] = [], unknown: string[] = [];
  for (const [key, raw] of Object.entries(data.cid)) {
    const r = rowSchema.parse(raw), id = byKey.get(key);
    if (!r.games) continue;
    if (!id) { unknown.push(key); continue }
    if (expected.lane !== 'all' && r.lane !== expected.lane) throw new Error('Lolalytics mixed role populations');
    stats.push({ championId: id, role: laneRole[r.lane], patch: nav.patch, source: 'solo', rank: nav.tier.toUpperCase(), league: 'all', side: 'all',
      games: r.games, wins: Math.round(r.games * r.wr / 100), reportedWinRate: r.wr / 100, countMethod: 'rounded_rate', pickRate: r.pr / 100, banRate: r.br / 100, baseline });
  }
  if (stats.length < 20) throw new Error('Lolalytics HTML changed: fewer than 20 champions in role table');
  return { stats, analysed, unknown };
}
export function parseBuild(html: string, champions: Champion[], expected: { patch: string; tier: string; championId: string; role: Role }): PairStat[] {
  const objects = qwikData(html), nav = navSchema.parse(find(objects, ['currentPatch', 'modeName', 'page']));
  if (nav.patch !== expected.patch || nav.tier !== expected.tier || nav.lane !== LANES[expected.role]) throw new Error('Lolalytics build dimensions differ');
  const data = find(objects, ['header', 'enemy_h', 'enemy']), header = z.object({ cid: z.number(), patch: z.string(), lane: z.string() }).parse(data.header);
  const byKey = new Map(champions.map(c => [c.key, c.id]));
  if (byKey.get(header.cid) !== expected.championId || header.patch !== expected.patch || header.lane !== LANES[expected.role]) throw new Error('Wrong Lolalytics champion build');
  const fields = z.array(z.string()).parse(data.enemy_h);
  if (fields.join(',') !== 'id,wr,d1,d2,pr,n') throw new Error('Lolalytics matchup columns changed');
  const enemy = z.record(z.array(z.tuple([z.number().int(), pct, z.number(), z.number(), pct, count]))).parse(data.enemy);
  const pairs: PairStat[] = [];
  for (const [lane, rows] of Object.entries(enemy)) {
    if (!laneRole[lane]) throw new Error('Unknown matchup role');
    for (const [key, wr, , delta2, , games] of rows) {
      const otherId = byKey.get(key); if (!otherId || otherId === expected.championId) continue;
      // delta2 removes both champions' baseline strength from the matchup effect.
      const baseline = (wr - delta2) / 100;
      // Extremely sparse off-role opponents can make the site's delta model degenerate.
      // Exclude that pair; never clamp it into an invented expected probability.
      if (!Number.isFinite(baseline) || baseline < .1 || baseline > .9) continue;
      pairs.push({ championId: expected.championId, otherId, role: expected.role, otherRole: laneRole[lane], kind: 'matchup', patch: expected.patch,
        source: 'solo', rank: nav.tier.toUpperCase(), league: 'all', side: 'all', games, wins: Math.round(games * wr / 100),
        countMethod: 'rounded_rate', reportedWinRate: wr / 100, baseline });
    }
  }
  if (pairs.length < 20) throw new Error('Lolalytics matchups unexpectedly empty');
  return pairs;
}
export function parseTeam(json: string, champions: Champion[], expected: {patch:string;tier:string;championId:string;role:Role}): PairStat[] {
  const data=z.object({team_h:z.array(z.string()),team:z.record(z.array(z.tuple([z.number().int(),pct,z.number(),z.number(),pct,count])))}).parse(JSON.parse(json));
  if(data.team_h.join(',')!=='id,wr,d1,d2,pr,n')throw new Error('Lolalytics synergy columns changed');
  const byKey=new Map(champions.map(c=>[c.key,c.id]));const pairs:PairStat[]=[];
  for(const [lane,rows] of Object.entries(data.team)){
    if(!laneRole[lane])throw new Error('Unknown synergy role');
    if(laneRole[lane]===expected.role)continue;
    for(const [key,wr,,delta2,,games] of rows){const otherId=byKey.get(key),baseline=(wr-delta2)/100;if(!otherId||otherId===expected.championId||baseline<.1||baseline>.9)continue;
      pairs.push({championId:expected.championId,otherId,role:expected.role,otherRole:laneRole[lane],kind:'synergy',patch:expected.patch,source:'solo',rank:'MASTER_PLUS',league:'all',side:'all',games,wins:Math.round(games*wr/100),countMethod:'rounded_rate',reportedWinRate:wr/100,baseline});
    }
  }
  if(!pairs.length)throw new Error('Lolalytics synergies unexpectedly empty');return pairs;
}
export async function scrapeLolalytics(http: ScrapeHttp, champions: Champion[], patch: string, tier: string, details: number, pool: Record<string, number>, progress: (m: string) => void,
  publish:(id:string,rows:Pick<DataPack,'stats'|'pairs'|'games'>)=>Promise<void>=async()=>{}, allStats?:Stat[], fresh:(id:string)=>boolean=()=>false, revalidate=false) {
  const ttl=revalidate?0:6*3600000;
  const stats: Stat[] = [], pairs: PairStat[] = [];
  if(allStats)stats.push(...allStats);else for (const [role, lane] of Object.entries(LANES)) {
    progress(`Lolalytics · ${tier} · ${role}`);
    const url = `https://lolalytics.com/lol/tierlist/?patch=${patch}&tier=${tier}&lane=${lane}`;
    const parsed = parseTierlist((await http.page(url,undefined,ttl)).html, champions, { patch, tier, lane });
    stats.push(...parsed.stats); if (parsed.unknown.length) progress(`Lolalytics: ${parsed.unknown.length} champion IDs absent from Data Dragon, excluded`);
  }
  if(!allStats)await publish(`lolalytics-${patch}-master_plus`,{stats,pairs:[],games:[]});
  const wanted = [...stats].sort((a, b) => (pool[b.championId] ?? 0) - (pool[a.championId] ?? 0) || b.pickRate - a.pickRate);
  // No arbitrary ten-champion shortlist. Include every champion/role with a usable sample, and every declared pool.
  const selected = wanted.filter(s=>pool[s.championId]>0||(s.games>=100&&s.pickRate>=.005&&s.games/Math.max(1,stats.filter(t=>t.championId===s.championId).reduce((n,t)=>n+t.games,0))>=.1)).slice(0,details);
  let index=0;
  for (const s of selected) {
    const id=`lolalytics-${patch}-${s.championId}-${s.role}`;index++;if(fresh(id))continue;
    const champ = champions.find(c => c.id === s.championId)!;
    const slug = champ.id === 'MonkeyKing' ? 'wukong' : champ.id.toLowerCase();
    progress(`Lolalytics Master+ · ${patch} · ${index}/${selected.length} · ${champ.name} (${s.role})`);
    const html = (await http.page(`https://lolalytics.com/lol/${slug}/build/?patch=${patch}&tier=${tier}&lane=${LANES[s.role]}`,undefined,ttl)).html;
    const expected={patch,tier,championId:s.championId,role:s.role};
    const counters=parseBuild(html, champions, expected);
    // The same public request used when clicking "Common Teammates" on the site's build page.
    const query=new URLSearchParams({ep:'build-team',v:'1',patch,c:slug,lane:LANES[s.role],tier,queue:'ranked',region:'all'});
    const synergy=parseTeam((await http.page(`https://a1.lolalytics.com/mega/?${query}`,undefined,ttl)).html,champions,expected);
    const rows=[...counters,...synergy];pairs.push(...rows);await publish(id,{stats:[],pairs:rows,games:[]});
  }
  return { stats, pairs };
}
