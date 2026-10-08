import { load } from 'cheerio';
import type { Champion, HistoricalGame, PairStat, Role, Stat } from '../shared/types';
import { ROLES } from '../shared/types';
import { AccessError, type ScrapeHttp } from './http';
import { latestPatches } from '../shared/patches';
import type { DataPack } from '../shared/types';
import { PRO_ORDER } from '../shared/draft';

const norm = (s: string) => s.normalize('NFKD').replace(/[^a-z0-9]/gi, '').toLowerCase();
function championMap(champions: Champion[]): (name: string) => string {
  const ids = new Map(champions.flatMap(c => [[norm(c.id), c.id], [norm(c.name), c.id]] as [string, string][]));
  ids.set('wukong', 'MonkeyKing'); ids.set('nunuandwillump', 'Nunu'); ids.set('nunuetwillump', 'Nunu'); ids.set('renataglasc', 'Renata');
  return name => { const id = ids.get(norm(name)); if (!id || !champions.some(c => c.id === id)) throw new Error(`Unmapped gol.gg champion ${name}`); return id };
}
export function golPatches(html: string): string[] {
  const $ = load(html), patches = [...new Set($('select[name="patch"] option').toArray().map(o => $(o).text().trim()).filter(v => /^\d+\.\d+$/.test(v)))];
  if (!patches.length) throw new Error('gol.gg patch filter changed');
  return patches.sort((a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); return y[0] - x[0] || y[1] - x[1] });
}
export function parseGolStats(html: string, champions: Champion[], patch: string, role: Role): Stat[] {
  const $ = load(html), champ = championMap(champions);
  if ($('select[name="patch"] option:selected').text().trim() !== patch || $('input[name="role"]').attr('value') !== role) throw new Error('gol.gg did not apply the requested patch/role filter');
  const table = $('table.table_list.playerslist').first();
  const heads = table.find('tr').first().children().map((_, e) => $(e).text().trim()).get();
  if (heads.slice(0, 7).join('|') !== 'Champion|Picks|Bans|PrioScore|Wins|Losses|Winrate') throw new Error('gol.gg champion table columns changed');
  const rows = table.find('tr').slice(1).toArray().map(e => {
    const cells = $(e).children('td'), integer = (i: number) => { const n = Number(cells.eq(i).text().trim()); if (!Number.isInteger(n) || n < 0) throw new Error('Invalid gol.gg integer count'); return n };
    const id = champ(cells.eq(0).find('img').attr('alt') ?? ''), games = integer(1), bans = integer(2), wins = integer(4), losses = integer(5);
    if (wins + losses !== games) throw new Error('gol.gg wins/losses disagree with picks');
    return { id, games, bans, wins };
  });
  const total = rows.reduce((sum, r) => sum + r.games, 0) / 2;
  if (!Number.isInteger(total) || total < 1) throw new Error('gol.gg role population is incomplete');
  return rows.filter(r => r.games > 0).map(r => {
    if (r.games > total || r.bans > total) throw new Error('gol.gg pick/ban counts exceed match population');
    return { championId: r.id, role, patch, source: 'pro', rank: 'all', league: 'all', side: 'all', games: r.games, wins: r.wins,
      countMethod: 'reported', pickRate: r.games / total, banRate: r.bans / total, baseline: .5 };
  });
}
export function golGameLinks(html: string, base: string): string[] {
  const $ = load(html);
  return [...new Set($('a[href]').toArray().map(a => new URL($(a).attr('href')!, base).href)
    .filter(url => /^https:\/\/gol\.gg\/game\/stats\/\d+\/page-(game|preview|summary)\/$/.test(url)).map(url => url.replace(/\/page-(preview|summary)\//, '/page-game/')))];
}
export function parseGolGame(html: string, champions: Champion[], id: string): HistoricalGame {
  const $ = load(html), champ = championMap(champions), lineups: HistoricalGame['lineups'] = { blue: { picks: [], bans: [] }, red: { picks: [], bans: [] } };
  const draftPicks:Record<'blue'|'red',string[]>={blue:[],red:[]},draftBans:Record<'blue'|'red',(string|null)[]>={blue:[],red:[]};
  let orderKnown=true;
  const text = $('body').text().replace(/\s+/g, ' '), patch = /\bv(\d+\.\d+)\b/.exec(text)?.[1];
  const tournament = $('a[href*="tournament-stats"]').first().text().trim();
  if (!patch || !tournament) throw new Error('gol.gg game patch/tournament missing');
  let winner: HistoricalGame['winner'] | undefined;
  const objectives: Record<string, number> = {};
  for (const side of ['blue', 'red'] as const) {
    const header = $(`.${side}-line-header`).first(), team = header.closest('.col-12.col-sm-6');
    if (!team.length) throw new Error('gol.gg team panel missing');
    if (/\bWIN\b/.test(header.text())) winner = side;
    const played=$('table.playersInfosLine').eq(side==='blue'?0:1).find('a[href*="champion-stats"] img').toArray();
    if(played.length!==5)throw new Error('gol.gg incomplete played lineup');
    lineups[side].picks=played.map((icon,i)=>({championId:champ($(icon).attr('alt')??''),role:ROLES[i]}));
    const pickLabel=team.find('.col-2').filter((_,e)=>$(e).text().trim().startsWith('Picks')).first();
    const ribbon=pickLabel.siblings('.col-10');
    try{
      draftPicks[side]=ribbon.find('a img').toArray().map(icon=>champ($(icon).attr('alt')??''));
      const groups=(ribbon.html()??'').split('|').map(part=>load(part)('a img').length);
      if(groups.join(',')!==(side==='blue'?'1,2,2':'2,1,2')||draftPicks[side].length!==5||new Set(draftPicks[side]).size!==5||!draftPicks[side].every(id=>lineups[side].picks.some(p=>p.championId===id)))orderKnown=false;
    }catch{orderKnown=false;}
    for (const kind of ['Bans']) {
      const label = team.find('.col-2').filter((_, e) => $(e).text().trim().startsWith(kind)).first();
      const icons = label.siblings('.col-10').find('a img').toArray();
      if (icons.length > 5) throw new Error('gol.gg incomplete team picks/bans');
      const ids = icons.map(icon => champ($(icon).attr('alt') ?? ''));
      lineups[side].bans = [...ids, ...Array<string | null>(5 - ids.length).fill(null)];
      const banRibbon=label.siblings('.col-10');
      draftBans[side]=banRibbon.find('img').toArray().map(icon=>$(icon).attr('alt')==='No ban'?null:champ($(icon).attr('alt')??''));
      if(draftBans[side].length!==5||(banRibbon.html()??'').split('|').map(part=>load(part)('img').length).join(',')!=='3,2')orderKnown=false;
    }
    team.find('.score-box').each((_, e) => {
      const metric = $(e).find('img').attr('alt')?.toLowerCase(), value = Number($(e).text().trim().replace(/k$/, ''));
      if (metric && ['kills', 'towers', 'dragons', 'nashor'].includes(metric) && Number.isFinite(value)) objectives[`${side}_${metric}`] = value;
    });
  }
  if (!winner) throw new Error('gol.gg game result not recorded');
  const duration = /Game Time\s*(\d+):(\d{2})/.exec(text);
  const league = /^(LCK CL|LCK|LPL|LEC|LCS|LCP|LFL|NLC|CBLOL|MSI|Worlds|EMEA Masters|VCS|TCL)\b/i.exec(tournament)?.[1].toUpperCase() ?? tournament.split(' 20')[0];
  const goldScript = $('script').toArray().map(e => $(e).text()).find(s => /var golddatas\s*=/.test(s));
  const series = goldScript && /label\s*:\s*['"]Gold['"]\s*,\s*data\s*:\s*\[([\d.,\s-]+)\]/.exec(goldScript);
  const gold = series?.[1].split(',').map(Number);
  const labels = goldScript && /labels\s*:\s*\[([^\]]+)\]/.exec(goldScript)?.[1].match(/\d+/g);
  const minute15 = labels ? labels.indexOf('15') : -1;
  const turn={blue:{pick:0,ban:0},red:{pick:0,ban:0}};
  const history=orderKnown?PRO_ORDER.map(action=>{const championId=(action.kind==='pick'?draftPicks:draftBans)[action.side][turn[action.side][action.kind]++];return action.kind==='pick'?{championId,role:lineups[action.side].picks.find(p=>p.championId===championId)!.role}:{championId};}):[];
  return { id: `gol-${id}`, patch, tournament, league, winner, history, draftOrderKnown: orderKnown, lineups,
    ...(duration ? { durationSeconds: Number(duration[1]) * 60 + Number(duration[2]) } : {}),
    ...(gold && minute15 >= 0 && Number.isFinite(gold[minute15]) ? { goldDiff15: gold[minute15] } : {}), objectives };
}
export function gamePairs(games: HistoricalGame[],stats:Stat[]=[]): PairStat[] {
  const strength=new Map(stats.map(s=>[`${s.patch}|${s.championId}|${s.role}`,(s.wins+25)/(s.games+50)-.5]));
  const rows = new Map<string, PairStat>();
  for (const game of games) {
    if (!game.lineups) continue;
    for (const side of ['blue', 'red'] as const) for (const pick of game.lineups[side].picks) {
      for (const kind of ['synergy', 'matchup'] as const) {
        const others = game.lineups[kind === 'synergy' ? side : side === 'blue' ? 'red' : 'blue'].picks;
        for (const other of others) {
          if (other.championId === pick.championId) continue;
          const a=strength.get(`${game.patch}|${pick.championId}|${pick.role}`)??0,b=strength.get(`${game.patch}|${other.championId}|${other.role}`)??0;
          const baseline=Math.max(.1,Math.min(.9,.5+a+(kind==='synergy'?b:-b)));
          for(const league of [...new Set(['all',game.league])]){
            const key = [pick.championId, pick.role, other.championId, other.role, kind, game.patch,league].join('|');
            const r = rows.get(key) ?? { ...pick, otherId: other.championId, otherRole: other.role, kind, patch: game.patch, source: 'pro', rank: 'all', league, side: 'all', games: 0, wins: 0, baseline, countMethod: 'reported' };
            r.games++; if (game.winner === side) r.wins++; rows.set(key, r);
          }
        }
      }
    }
  }
  return [...rows.values()];
}
export interface GolOptions {revalidate?:boolean;force?:boolean;stats?:Stat[];tournamentCounts?:Record<string,string>;rememberCounts?:(counts:Record<string,string>)=>void;rememberBaseline?:(counts:Record<string,string>)=>void}
export async function scrapeGol(http: ScrapeHttp, champions: Champion[], patch: string, maxGames: number, progress: (m: string) => void,
  publish:(id:string,rows:Pick<DataPack,'stats'|'pairs'|'games'>)=>Promise<void>=async()=>{}, existingGames:HistoricalGame[]=[], options:GolOptions={}) {
  const url = `https://gol.gg/champion/list/season-S${patch.split('.')[0]}/split-ALL/tournament-ALL/`;
  const ttl=options.revalidate?0:6*3600000;
  const list = await http.page(url,undefined,options.stats?6*3600000:ttl), available = golPatches(list.html), stats: Stat[] = [...options.stats??[]], games: HistoricalGame[] = [];
  const target = latestPatches(available);
  if (!target.length) throw new Error('No gol.gg patch available for this season');
  if(!options.stats)for (const p of target) for (const role of ROLES) {
    progress(`gol.gg · ${p} · ${role}`);
    const body = new URLSearchParams({ patch: `${p}.`, role, side: 'ALL', draft: 'ALL', cbtournament: 'ALL', leaguePost: 'true' });
    stats.push(...parseGolStats((await http.page(url, body,ttl)).html, champions, p, role));
  }
  if(!options.stats)await publish(`golgg-stats-S${patch.split('.')[0]}`,{stats,pairs:[],games:[]});
  if (!maxGames) return { stats, pairs: [], games };
  const indexUrl='https://gol.gg/tournament/ajax.trlist.php',indexBody=new URLSearchParams({season:`S${patch.split('.')[0]}`});
  let priorCounts=options.tournamentCounts;
  if(!priorCounts){
    try {const saved=await http.peek?.(indexUrl,indexBody);if(saved){const old=JSON.parse(saved.html) as {trname:string;nbgames:string}[];if(Array.isArray(old))priorCounts=Object.fromEntries(old.map(t=>[t.trname,String(t.nbgames)]));}}
    catch {/* A missing or invalid local index requires checking series metadata. */}
  }
  // Keep the previous index as a checkpoint before the network cache is overwritten.
  if(!options.tournamentCounts)options.rememberBaseline?.(priorCounts??{});
  const tournaments=JSON.parse((await http.page(indexUrl,indexBody,ttl)).html) as {trname:string;nbgames:string}[];
  if(!Array.isArray(tournaments)||!tournaments.length||tournaments.some(t=>typeof t.trname!=='string'||!/^\d+$/.test(String(t.nbgames))))throw new Error('gol.gg tournament index changed');
  const links=new Set<string>(),visited=new Set<string>(),known=new Map(existingGames.filter(g=>target.includes(g.patch)).map(g=>[g.id,g]));
  const publishGames=async()=>{const retained=[...known.values()];await publish(`golgg-games-S${patch.split('.')[0]}`,{stats:[],pairs:gamePairs(retained,stats),games:retained});};
  let completed=0,skipped=0,consecutiveFailures=0;
  for(const tournament of tournaments){
    if(completed>=maxGames)break;
    const changed=priorCounts?.[tournament.trname]!==String(tournament.nbgames);
    progress(`gol.gg · tournois ${tournament.trname} · ${games.length} games (${target.join(' / ')})`);
    const listTtl=options.revalidate?(changed?0:Infinity):6*3600000;
    const html=(await http.page(`https://gol.gg/tournament/tournament-matchlist/${encodeURIComponent(tournament.trname)}/`,undefined,listTtl)).html,$=load(html);
    // Match lists expose the game's patch. Skip unplayed fixtures and obsolete patches before visiting games.
    for(const tr of $('table').last().find('tr').toArray()){
      const cells=$(tr).children('td');if(!cells.toArray().some(c=>target.includes($(c).text().trim())))continue;
      for(const link of golGameLinks($.html(tr),'https://gol.gg/tournament/'))links.add(link);
    }
    while(links.size){
      const link=links.values().next().value!;
      links.delete(link);const id=/\/stats\/(\d+)\//.exec(link)![1];if(visited.has(id))continue;visited.add(id);
      if(completed>=maxGames)break;
      const existing=known.get(`gol-${id}`);
      if(existing&&!options.force){
        games.push(existing);completed++;consecutiveFailures=0;
        // Only changed tournament series need a fresh page to discover games played since our last visit.
        const saved=options.revalidate&&changed?await http.page(link,undefined,0):await http.peek(link);
        if(saved)for(const related of golGameLinks(saved.html,'https://gol.gg/game/'))if(!visited.has(/\/stats\/(\d+)\//.exec(related)![1]))links.add(related);
        continue;
      }
      progress(`gol.gg · ${games.length+1} matchs · ${id}`);
      let game:HistoricalGame;
      let gameHtml:string;
      try { gameHtml=(await http.page(link,undefined,options.force||options.revalidate?0:30*86400000)).html;game=parseGolGame(gameHtml,champions,id);consecutiveFailures=0; }
      catch(error){
        if(error instanceof AccessError)throw error;
        known.delete(`gol-${id}`);
        skipped++;completed++;consecutiveFailures++;progress(`gol.gg · game ${id} exclue : ${String(error).slice(0,250)}`);
        if(consecutiveFailures>=3)throw new Error('Three consecutive invalid game pages; source structure may have changed');
        continue;
      }
      // Series summaries link all constituent games; filter each game's actual patch and result.
      if(target.includes(game.patch)){games.push(game);known.set(game.id,game);}else known.delete(game.id);completed++;
      for(const related of golGameLinks(gameHtml,'https://gol.gg/game/'))if(!visited.has(/\/stats\/(\d+)\//.exec(related)![1]))links.add(related);
      if(games.length&&games.length%25===0)await publishGames();
    }
  }
  await publishGames();
  if(skipped)throw new Error(`${skipped} invalid or unavailable games excluded; valid games were imported`);
  if(maxGames===Infinity)options.rememberCounts?.(Object.fromEntries(tournaments.map(t=>[t.trname,String(t.nbgames)])));
  const retained=[...known.values()];return { stats, pairs: gamePairs(retained,stats), games:retained };
}
