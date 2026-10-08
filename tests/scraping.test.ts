import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';
import { Storage } from '../src/main/storage';
import { SEED_CHAMPIONS } from '../src/shared/champions';
import type { Champion } from '../src/shared/types';
import { parseTierlist, parseBuild } from '../src/collector/lolalytics';
import * as soloCollector from '../src/collector/lolalytics';
import { golGameLinks, golPatches, parseGolGame, parseGolStats, gamePairs, scrapeGol } from '../src/collector/gol';
import { AccessError, ScrapeHttp } from '../src/collector/http';
import { scrapeSources } from '../src/collector/scrape';
import { analyze } from '../src/engine';
import championIds from './fixtures/champion-ids.json';

const champions: Champion[] = championIds.map(c => ({ ...(SEED_CHAMPIONS.find(s => s.id === c.id) ?? SEED_CHAMPIONS[0]), ...c }));
const fixture = (name: string) => readFile(path.resolve(`tests/fixtures/${name}.html`), 'utf8');
const cleanup: string[] = [];
async function temp() { await mkdir('.test-data', { recursive: true }); const dir = await mkdtemp(path.resolve('.test-data/scrape-')); cleanup.push(dir); return dir }
afterEach(async () => { vi.unstubAllGlobals(); for (const dir of cleanup.splice(0)) { if (!dir.startsWith(path.resolve('.test-data') + path.sep)) throw new Error('Unsafe cleanup'); await rm(dir, { recursive: true, force: true }) } });

describe('public HTML source contracts', () => {
  it('decodes real Qwik references, role sample sizes, percentages and rank baseline', async () => {
    const data = parseTierlist(await fixture('lol-tierlist'), champions, { patch: '16.20', tier: 'emerald_plus', lane: 'top' });
    expect(data.stats.length).toBeGreaterThan(150);
    expect(data.stats.every(s => s.role === 'TOP' && s.rank === 'EMERALD_PLUS' && s.wins <= s.games)).toBe(true);
    const yone = data.stats.find(s => s.championId === 'Yone')!;
    expect(yone.games).toBeGreaterThan(1000); expect(yone.baseline).toBeCloseTo(.513); expect(yone.countMethod).toBe('rounded_rate');
  });
  it('rejects wrong dimensions and missing graph without treating it as empty valid data', async () => {
    const html = await fixture('lol-tierlist');
    expect(() => parseTierlist(html, champions, { patch: '16.19', tier: 'emerald_plus', lane: 'top' })).toThrow(/different patch/);
    expect(() => parseTierlist(html, champions, { patch: '16.20', tier: 'diamond_plus', lane: 'top' })).toThrow(/different patch/);
    expect(() => parseTierlist('<html>Maintenance</html>', champions, { patch: '16.20', tier: 'emerald_plus', lane: 'top' })).toThrow(/Qwik/);
  });
  it('extracts role-specific matchup counts and normalizes against delta2', async () => {
    const pairs = parseBuild(await fixture('lol-build'), champions, { patch: '16.20', tier: 'emerald_plus', championId: 'Yone', role: 'TOP' });
    expect(pairs.length).toBeGreaterThan(300); expect(new Set(pairs.map(p => p.otherRole)).size).toBe(5);
    expect(pairs.every(p => p.kind === 'matchup' && p.championId === 'Yone' && p.wins <= p.games && p.baseline >= .1 && p.baseline <= .9)).toBe(true);
    expect(() => parseBuild('<html/>', champions, { patch: '16.20', tier: 'emerald_plus', championId: 'Yone', role: 'TOP' })).toThrow();
  });
  it('uses gol.gg reported wins/losses and the correct match denominator', async () => {
    const html = await fixture('gol-stats'), stats = parseGolStats(html, champions, '16.18', 'TOP');
    const rumble = stats.find(s => s.championId === 'Rumble')!;
    expect(rumble.games).toBe(109); expect(rumble.wins).toBe(47); expect(rumble.pickRate).toBeCloseTo(109 / 341); expect(rumble.banRate).toBeCloseTo(74 / 341);
    expect(golPatches(html).slice(0, 2)).toEqual(['16.18', '16.17']);
    expect(() => parseGolStats(html, champions, '16.20', 'TOP')).toThrow(/filter/);
    const $ = load(html); $('table.playerslist tr').eq(1).children('td').eq(4).text('999');
    expect(() => parseGolStats($.html(), champions, '16.18', 'TOP')).toThrow(/wins\/losses/);
  });
  it('preserves real lineups and results without inventing a draft order', async () => {
    const game = parseGolGame(await fixture('gol-game'), champions, '82471');
    expect(game.patch).toBe('16.17'); expect(game.winner).toBe('blue'); expect(game.durationSeconds).toBeGreaterThan(1000);
    expect(game.goldDiff15).toBe(4314);
    expect(game.draftOrderKnown).toBe(false); expect(game.history).toEqual([]);
    expect(game.lineups!.blue.picks.map(p=>p.championId)).toEqual(['Jayce','JarvanIV','Anivia','Ashe','Seraphine']);
    const broken=load(await fixture('gol-game'));
    const panel=broken('.blue-line-header').first().closest('.col-12.col-sm-6');
    panel.find('.col-2').filter((_,e)=>broken(e).text().trim().startsWith('Picks')).first().siblings('.col-10').find('a img').first().attr('alt','Warwick');
    const partial=parseGolGame(broken.html(),champions,'82471');expect(partial.draftOrderKnown).toBe(false);expect(partial.history).toEqual([]);
    expect(partial.lineups).toEqual(game.lineups);
    const complete=load(await fixture('gol-game'));
    for(const side of ['blue','red']){
      const p=complete(`.${side}-line-header`).first().closest('.col-12.col-sm-6'),ribbon=p.find('.col-2').filter((_,e)=>complete(e).text().trim().startsWith('Picks')).first().siblings('.col-10');
      const icons=ribbon.find('a').toArray().map(e=>complete.html(e));const cut=side==='blue'?[1,3]:[2,3];
      ribbon.html(icons.map((icon,i)=>`${cut.includes(i)?'|':''}${icon}`).join(''));
    }
    const ordered=parseGolGame(complete.html(),champions,'82471');expect(ordered.draftOrderKnown).toBe(true);expect(ordered.history[6]).toEqual({championId:'JarvanIV',role:'JUNGLE'});
    expect(game.lineups!.blue.picks.map(p => p.role)).toEqual(['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT']);
    expect(gamePairs([game]).filter(p=>p.league==='all')).toHaveLength(90);
    expect(gamePairs([game]).filter(p=>p.league===game.league)).toHaveLength(90);
    expect(gamePairs([game]).filter(p => p.championId === game.lineups!.blue.picks[0].championId).every(p => p.wins === 1 && p.games === 1)).toBe(true);
    expect(golGameLinks('<a href="../game/stats/82471/page-preview/">Game</a>', 'https://gol.gg/tournament/')).toEqual(['https://gol.gg/game/stats/82471/page-game/']);
  });
});

describe('HTTP access, cache and import rollback', () => {
  it('retains played games without a request and still discovers a new game from the local series page',async()=>{
    const statHtml=await fixture('gol-stats'),gameHtml=await fixture('gol-game');
    const previous=parseGolGame(gameHtml,champions,'1');
    const page=vi.fn(async(url:string)=>({url,cached:false,fetchedAt:new Date().toISOString(),html:url.includes('/champion/list/')?statHtml:url.includes('ajax.trlist')?'[{"trname":"Test League","nbgames":"2"}]':url.includes('tournament-matchlist')?'<table><tr><td>16.17</td><td><a href="https://gol.gg/game/stats/1/page-game/">Game</a></td></tr></table>':gameHtml}));
    const peek=vi.fn(async(url:string)=>({url,cached:true,fetchedAt:'2000-01-01T00:00:00Z',html:'<a href="https://gol.gg/game/stats/2/page-game/">Next game</a>'}));
    const result=await scrapeGol({page,peek} as unknown as ScrapeHttp,champions,'16.20',2,()=>{},async()=>{},[previous],{revalidate:true,stats:[],tournamentCounts:{'Test League':'2'}});
    expect(result.games.map(g=>g.id).sort()).toEqual(['gol-1','gol-2']);
    expect(page.mock.calls.some(([url])=>url.includes('/stats/1/'))).toBe(false);
    expect(page.mock.calls.filter(([url])=>url.includes('/stats/2/'))).toHaveLength(1);
    expect(peek).toHaveBeenCalledOnce();
  });
  it('checks a changed series and discovers its newly played game even when the old raw page has no link',async()=>{
    const statHtml=await fixture('gol-stats'),gameHtml=await fixture('gol-game'),previous=parseGolGame(gameHtml,champions,'1');
    const page=vi.fn(async(url:string)=>({url,cached:false,fetchedAt:new Date().toISOString(),html:url.includes('/champion/list/')?statHtml:url.includes('ajax.trlist')?'[{"trname":"Test League","nbgames":"2"}]':url.includes('tournament-matchlist')?'<table><tr><td>16.17</td><td><a href="https://gol.gg/game/stats/1/page-game/">Series</a></td></tr></table>':url.includes('/stats/1/')?'<a href="https://gol.gg/game/stats/2/page-game/">New game</a>'+gameHtml:gameHtml}));
    const peek=vi.fn(async()=>undefined);
    const result=await scrapeGol({page,peek} as unknown as ScrapeHttp,champions,'16.20',2,()=>{},async()=>{},[previous],{revalidate:true,stats:[],tournamentCounts:{'Test League':'1'}});
    expect(result.games.map(g=>g.id).sort()).toEqual(['gol-1','gol-2']);
    expect(page.mock.calls.filter(([url])=>url.includes('/stats/1/'))).toHaveLength(1);
    expect(page.mock.calls.filter(([url])=>url.includes('/stats/2/'))).toHaveLength(1);
    expect(peek).not.toHaveBeenCalled();
  });
  it('keeps the old tournament checkpoint when a first incremental crawl is interrupted',async()=>{
    const statHtml=await fixture('gol-stats'),gameHtml=await fixture('gol-game'),previous=parseGolGame(gameHtml,champions,'1');
    const $=load(gameHtml);$('a[href*="/game/stats/"]').remove();const pureGame=$.html();
    let cachedCount='1',fail=true,checkpoint:Record<string,string>|undefined;
    const page=vi.fn(async(url:string)=>{
      if(url.includes('/stats/1/')&&fail)throw new AccessError('Interrupted series check');
      let html=pureGame;
      if(url.includes('/champion/list/'))html=statHtml;
      else if(url.includes('ajax.trlist')){cachedCount='2';html='[{"trname":"Test League","nbgames":"2"}]';}
      else if(url.includes('tournament-matchlist'))html='<table><tr><td>16.17</td><td><a href="https://gol.gg/game/stats/1/page-game/">Series</a></td></tr></table>';
      else if(url.includes('/stats/1/'))html='<a href="https://gol.gg/game/stats/2/page-game/">New game</a>'+pureGame;
      return {url,html,cached:false,fetchedAt:new Date().toISOString()};
    });
    const peek=vi.fn(async(url:string)=>({url,html:url.includes('ajax.trlist')?JSON.stringify([{trname:'Test League',nbgames:cachedCount}]):pureGame,cached:true,fetchedAt:'2000-01-01T00:00:00Z'}));
    const options={revalidate:true,stats:[],rememberBaseline:(c:Record<string,string>)=>{checkpoint=c;},rememberCounts:(c:Record<string,string>)=>{checkpoint=c;}};
    const http={page,peek} as unknown as ScrapeHttp;
    await expect(scrapeGol(http,champions,'16.20',Infinity,()=>{},async()=>{},[previous],options)).rejects.toThrow(/Interrupted/);
    expect(checkpoint).toEqual({'Test League':'1'});expect(cachedCount).toBe('2');
    fail=false;const result=await scrapeGol(http,champions,'16.20',Infinity,()=>{},async()=>{},[previous],{...options,tournamentCounts:checkpoint});
    expect(result.games.map(g=>g.id).sort()).toEqual(['gol-1','gol-2']);expect(checkpoint).toEqual({'Test League':'2'});
  });
  it('reads an expired raw cache without network and revalidates with ETag when requested',async()=>{
    const dir=await temp(),http=new ScrapeHttp(dir,()=>{},0);
    const fetchMock=vi.fn(async(url:string,options?:RequestInit)=>url.endsWith('robots.txt')?new Response('User-agent: *\nAllow: /'):(options?.headers as Record<string,string>)['If-None-Match']==='fixture-v1'?new Response(null,{status:304}):new Response('<html>saved result</html>',{headers:{ETag:'fixture-v1'}}));
    vi.stubGlobal('fetch',fetchMock);let now:ReturnType<typeof vi.spyOn>|undefined;
    try{
      const first=await http.page('https://gol.gg/game/stats/1/page-game/');const timestamp=Date.now();now=vi.spyOn(Date,'now').mockReturnValue(timestamp+90*86400000);
      expect(await http.peek(first.url)).toEqual({...first,cached:true});expect(fetchMock).toHaveBeenCalledTimes(2);
      const refreshed=await http.page(first.url,undefined,0);expect(refreshed.html).toBe(first.html);expect(refreshed.cached).toBe(true);expect(fetchMock).toHaveBeenCalledTimes(3);
    }finally{now?.mockRestore();http.close();}
  });
  it('reuses older Lolalytics detail packs, fills missing ones and revalidates the active patch',async()=>{
    const dir=await temp(),storage=new Storage(path.join(dir,'db.sqlite'));
    storage.set('staticVersion','16.20.1');storage.set('staticPatches',['16.20','16.19','16.18']);
    for(const patch of ['16.20','16.19'])storage.importPack({schemaVersion:1,id:`lolalytics-${patch}-Ahri-MID`,createdAt:'2000-01-01T00:00:00Z',provenance:{name:'Test cache',url:'https://lolalytics.com/',license:'Unit test only',demo:false},stats:[],games:[],pairs:[{championId:'Ahri',otherId:'Jinx',role:'MID',otherRole:'ADC',kind:'synergy',patch,source:'solo',rank:'MASTER_PLUS',league:'all',side:'all',games:100,wins:50,baseline:.5}]});
    const observed:{patch:string;skip:boolean;revalidate:boolean|undefined}[]=[];
    const probe=vi.spyOn(soloCollector,'scrapeLolalytics').mockImplementation(async(_http,_champions,patch,_tier,_details,_pool,_progress,_publish,allStats,fresh,revalidate)=>{
      const stats=allStats??[{championId:'Ahri',role:'MID' as const,patch,source:'solo' as const,rank:'MASTER_PLUS',league:'all',side:'all' as const,games:1000,wins:500,baseline:.5,pickRate:.1,banRate:.01}];
      if(allStats)observed.push({patch,skip:fresh!(`lolalytics-${patch}-Ahri-MID`),revalidate});
      return {stats,pairs:[]};
    });
    try{
      const result=await scrapeSources(storage,dir,()=>{},{source:'solo',revalidate:true});expect(result.errors).toEqual([]);
      expect(observed).toEqual([{patch:'16.20',skip:false,revalidate:true},{patch:'16.19',skip:true,revalidate:false},{patch:'16.18',skip:false,revalidate:false}]);
      observed.length=0;await scrapeSources(storage,dir,()=>{},{source:'solo',revalidate:true,force:true});expect(observed.every(row=>!row.skip)).toBe(true);
    }finally{probe.mockRestore();storage.close();}
  });
  it('retains previously imported pro games while resuming a crawl interrupted by the network',async()=>{
    const statHtml=await fixture('gol-stats'),gameHtml=await fixture('gol-game');
    const previous=parseGolGame(gameHtml,champions,'keep');
    const page=vi.fn(async(url:string,body?:URLSearchParams)=>{
      let html=gameHtml;
      if(url.includes('/champion/list/')){
        const $=load(statHtml);if(body){$('select[name="patch"] option').removeAttr('selected');$('select[name="patch"]').append(`<option selected>${body.get('patch')!.replace(/\.$/,'')}</option>`);$('input[name="role"]').attr('value',body.get('role')!);}html=$.html();
      }else if(url.includes('ajax.trlist'))html=JSON.stringify([{trname:'Test League',nbgames:'26'}]);
      else if(url.includes('tournament-matchlist'))html=`<table>${Array.from({length:26},(_,i)=>`<tr><td>16.17</td><td><a href="https://gol.gg/game/stats/${i+1}/page-game/">Game</a></td></tr>`).join('')}</table>`;
      else if(url.includes('/stats/26/'))throw new AccessError('Network interruption');
      return {html,url,cached:true,fetchedAt:new Date().toISOString()};
    });
    const publications: string[][]=[];
    await expect(scrapeGol({page} as unknown as ScrapeHttp,champions,'16.20',Infinity,()=>{},async(id,rows)=>{if(id.includes('games'))publications.push(rows.games.map(g=>g.id));},[previous])).rejects.toThrow(/Network interruption/);
    expect(publications.at(-1)).toHaveLength(26);expect(publications.at(-1)).toContain('gol-keep');expect(publications.at(-1)).toContain('gol-25');
  });
  it('stops all subsequent requests to a host after a CAPTCHA served as HTTP 200',async()=>{
    const dir=await temp(),http=new ScrapeHttp(dir,()=>{},0);
    const fetchMock=vi.fn(async(url:string)=>new Response(url.endsWith('/robots.txt')?'User-agent: *\nAllow: /':'<title>Just a moment</title><form id="challenge-form"></form>'));
    vi.stubGlobal('fetch',fetchMock);
    try{await expect(http.page('https://lolalytics.com/first')).rejects.toThrow(/challenge/);await expect(http.page('https://lolalytics.com/second')).rejects.toThrow(/already stopped/);expect(fetchMock).toHaveBeenCalledTimes(2);}finally{http.close();}
  });
  it('honors robots exclusions, blocks external redirects, reuses raw cache and stops on 429', async () => {
    const dir = await temp(), http = new ScrapeHttp(dir, () => {}, 0);
    const fetchMock = vi.fn(async (url: string) => new Response(url.endsWith('/robots.txt') ? 'User-agent: *\nDisallow: /raw/\n' : '<html>real public page</html>'));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(http.page('https://gol.gg/raw/private')).rejects.toThrow(/robots/);
      await http.page('https://gol.gg/esports/home/'); await http.page('https://gol.gg/esports/home/'); expect(fetchMock).toHaveBeenCalledTimes(2);
      vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 302, headers: { location: 'https://example.org/evil' } })));
      await expect(http.page('https://gol.gg/test/redirect')).rejects.toThrow(/redirect/);
      vi.stubGlobal('fetch', vi.fn(async () => new Response('limited', { status: 429, headers: { 'retry-after': '60' } })));
      await expect(http.page('https://gol.gg/test/rate')).rejects.toThrow(/429/);
    } finally { http.close() }
  });
  it('keeps existing SQLite packs if both live sources fail or change their HTML', async () => {
    const dir = await temp(), storage = new Storage(path.join(dir, 'db.sqlite'));
    try {
      const stats = parseTierlist(await fixture('lol-tierlist'), champions, { patch: '16.20', tier: 'emerald_plus', lane: 'top' });
      const insert = storage.db.prepare('INSERT OR REPLACE INTO champions VALUES (?, ?)'); champions.forEach(c => insert.run(c.id, JSON.stringify(c)));
      const pack = { schemaVersion: 1, id: 'lolalytics-16.20-emerald_plus', createdAt: new Date().toISOString(), provenance: { name: 'Fixture from captured public page', url: 'https://lolalytics.com/', license: 'Local parser test', demo: false }, stats: stats.stats, pairs: [], games: [] };
      storage.importPack(pack);
      storage.set('staticVersion','16.20.1');
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Offline test') }));
      const result = await scrapeSources(storage, dir, () => {}, { patch: '16.20', details: 0, games: 0 });
      expect(result.errors.length).toBeGreaterThanOrEqual(2); expect(storage.packs()[0].stats.length).toBe(pack.stats.length);
      storage.draft.patch = '16.20'; storage.draft.mode = 'solo'; storage.draft.role = 'TOP'; storage.draft.targetRole = 'TOP';
      const analysis = analyze(storage.engineInput()); expect(analysis.picks.every(r => r.winrate === null)).toBe(true);
    } finally { storage.close() }
  });
});
