import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { Champion, DataPack } from '../shared/types';
import { SEED_CHAMPIONS } from '../shared/champions';
import type { Storage } from './storage';
import { scrapeSources } from '../collector/scrape';
import { latestPatches } from '../shared/patches';
import { SHARED_DATA_URL } from '../shared/distribution';
import { refreshSharedDataset } from './shared-data';

export async function download(url: string, maxBytes = 30 * 1024 * 1024, etag?: string): Promise<{ body: Buffer; etag?: string } | null> {
  const parsed = new URL(url);
  let target=parsed, response:Response;
  const signal=AbortSignal.timeout(120000);
  for(let hop=0;;hop++) {
    if(target.protocol!=='https:'||target.username||target.password)throw new Error('Only HTTPS downloads are allowed');
    response=await fetch(target.href,{headers:{'User-Agent':'TchimDraft/0.6 (+desktop data download)',Accept:'application/json,image/png,application/gzip',...(etag&&target.origin===parsed.origin?{'If-None-Match':etag}:{})},signal,redirect:'manual'});
    if(![301,302,303,307,308].includes(response.status))break;
    const location=response.headers.get('location');await response.body?.cancel();
    if(!location||hop>=4)throw new Error('Invalid download redirect');
    const next=new URL(location,target);
    if(next.origin!==parsed.origin&&!(parsed.hostname==='github.com'&&['release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(next.hostname)))throw new Error('Untrusted download redirect');
    target=next;
  }
  if (response.status === 304) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${parsed.hostname}`);
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Download is too large');
  const chunks: Uint8Array[] = []; let bytes = 0;
  if (!response.body) throw new Error('Empty download');
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    bytes += chunk.length; if (bytes > maxBytes) { throw new Error('Download exceeds size limit') } chunks.push(chunk);
  }
  return { body: Buffer.concat(chunks), etag: response.headers.get('etag') ?? undefined };
}
const dragonSchema = z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/), data: z.record(z.object({ id: z.string().regex(/^[A-Za-z0-9_]+$/), key: z.string().regex(/^\d+$/), name: z.string().max(100), tags: z.array(z.string()), image: z.object({ full: z.string().regex(/^[A-Za-z0-9_]+\.png$/) }) })) });
// Only the refresh button and an explicit CLI invocation call this function.
export async function refreshData(storage: Storage, userData: string, notify: () => void): Promise<void> {
  if (storage.refreshing) return;
  storage.refreshing = true; storage.message = 'Data Dragon…'; notify();
  let allSucceeded = true;
  try {
    const versions = await download('https://ddragon.leagueoflegends.com/api/versions.json', 100000);
    const available = z.array(z.string()).min(1).parse(JSON.parse(versions!.body.toString()));
    const latest = available.find(v => /^\d{1,2}\.\d{1,2}\.\d{1,3}$/.test(v));
    if (!latest) throw new Error('No compatible Data Dragon version');
    const rawDir = path.join(userData, 'raw'); await mkdir(rawDir, { recursive: true });
    const catalogFile = path.join(rawDir, `ddragon-${latest}.json`);
    let dragon:z.infer<typeof dragonSchema>;
    try { dragon = dragonSchema.parse(JSON.parse(await readFile(catalogFile, 'utf8'))); if(dragon.version!==latest||Object.keys(dragon.data).length<100)throw new Error('Invalid cached catalog'); }
    catch {
      const catalog = await download(`https://ddragon.leagueoflegends.com/cdn/${latest}/data/fr_FR/champion.json`, 2000000);
      dragon = dragonSchema.parse(JSON.parse(catalog!.body.toString()));
      if(dragon.version!==latest||Object.keys(dragon.data).length<100)throw new Error('Unexpected Data Dragon structure; keeping previous catalog');
      await writeFile(catalogFile, catalog!.body);
    }
    if (dragon.version !== latest || Object.keys(dragon.data).length < 100) throw new Error('Unexpected Data Dragon structure; keeping previous catalog');
    const iconDir = path.join(userData, 'icons', latest); await mkdir(iconDir, { recursive: true });
    const current = new Map(storage.champions().map(c => [c.id, c])), curated = new Map(SEED_CHAMPIONS.map(c => [c.id, c]));
    const champs: Champion[] = Object.values(dragon.data).map(d => {
      const profile = curated.get(d.id) ?? current.get(d.id);
      return { id: d.id, key: Number(d.key), name: d.name, tags: d.tags, roles: profile?.roles ?? [], curated: profile?.curated ?? false,
        traits: profile?.traits ?? { ad: d.tags.includes('Mage') ? 0 : 0.75, frontline: d.tags.includes('Tank') ? 2 : 0, engage: 1, peel: 1, poke: 1, scaling: 1.5, early: 1.5 },
        icon: `tchim://assets/icons/${latest}/${d.id}.png` };
    });
    let cursor = 0, errors = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (cursor < champs.length) {
        const c = champs[cursor++], file = path.join(iconDir, `${c.id}.png`);
        try { await access(file); continue } catch { /* Cache miss */ }
        try {
          const img = await download(`https://ddragon.leagueoflegends.com/cdn/${latest}/img/champion/${c.id}.png`, 300000);
          if (!img || !img.body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Invalid PNG');
          await writeFile(file, img.body);
        } catch { errors++ }
      }
    }));
    const insert = storage.db.prepare('INSERT OR REPLACE INTO champions VALUES (?, ?)');
    const previousVersion = storage.get<string>('staticVersion');
    storage.db.transaction(() => {
      champs.forEach(c => insert.run(c.id, JSON.stringify(c)));
      storage.set('staticVersion', latest);
      storage.set('staticPatches',latestPatches(available.filter(p=>/^\d{1,2}\.\d{1,2}\.\d{1,3}$/.test(p))));
      if (!storage.draft.history.length && (storage.draft.patch === 'unknown' || storage.draft.patch === previousVersion?.split('.').slice(0, 2).join('.'))) {
        storage.draft.patch = latest.split('.').slice(0, 2).join('.'); storage.persist();
      }
    })();
    storage.log('info', `Data Dragon ${latest}: ${champs.length} champions, ${errors} missing icons`);
    storage.message = `Data Dragon ${latest} · ${champs.length} champions${errors ? ` · ${errors} icons unavailable` : ''}`;
  } catch (error) { allSucceeded = false; storage.message = `Offline · ${error instanceof Error ? error.message : String(error)}`; storage.log('error', storage.message) }
  const shared = storage.settings.dataSource === 'shared' && storage.settings.scrapingEnabled && !storage.settings.feedUrl;
  if(shared) {
    try {
      const count=await refreshSharedDataset(storage,userData,SHARED_DATA_URL,download,message=>{storage.message=message;notify()});
      storage.message=`GitHub · ${count} fichiers actualisés · données disponibles hors ligne`;
    } catch(error) {allSucceeded=false;storage.log('error',`Shared statistics: ${error instanceof Error?error.message:String(error)}`);storage.message+=' · téléchargement GitHub échoué, données locales conservées';}
  }
  if (storage.settings.feedUrl) {
    try {
      const url = storage.settings.feedUrl, cache = storage.get<{ url: string; etag?: string }>('feedCache');
      const pack = await download(url, 64 * 1024 * 1024, cache?.url === url ? cache.etag : undefined);
      if (pack) { storage.importPack(JSON.parse(pack.body.toString())); storage.set('feedCache', { url, etag: pack.etag }); storage.message += ' · stats refreshed' }
    } catch (error) { allSucceeded = false; storage.log('error', `Statistics refresh failed: ${error instanceof Error ? error.message : String(error)}`); storage.message += ' · statistics refresh failed' }
  }
  if (storage.settings.scrapingEnabled && storage.settings.dataSource !== 'shared') {
    const prior = storage.message;
    try {
      const collected = await scrapeSources(storage, userData, message => { storage.message = message; notify() }, { revalidate:true });
      allSucceeded = allSucceeded && !collected.errors.length&&!collected.busy;
      storage.message = `${prior} · ${collected.imported.length} packs refreshed${collected.errors.length ? ` · ${collected.errors.join(' · ')}` : ''}`;
    } catch (error) { allSucceeded = false; storage.log('error', `Scraping: ${String(error)}`); storage.message = `${prior} · ${String(error)}` }
  }
  if (allSucceeded) storage.set('lastRefresh', new Date().toISOString());
  storage.refreshing = false; notify();
}
export function demoPack(storage: Storage): DataPack {
  const patch = storage.draft.patch === 'unknown' ? '16.20' : storage.draft.patch;
  // Fixed, explicitly synthetic data exercises the UI; NEVER presented as current stats.
  const champions = SEED_CHAMPIONS;
  const stats: DataPack['stats'] = champions.flatMap((c, i) => c.roles.flatMap(role => (['solo', 'pro'] as const).map(source => {
    const games = source === 'pro' ? 40 + i % 100 : 2500 + i * 137;
    const rate = 0.47 + (i % 9) * 0.008;
    return { championId: c.id, role, patch, source, rank: 'all', league: 'all', side: 'all' as const, games, wins: Math.round(games * rate), pickRate: 0.02 + i % 8 * 0.01, banRate: i % 6 * 0.02, baseline: 0.5 };
  })));
  const pairs: DataPack['pairs'] = [
    { championId: 'Lucian', role: 'ADC', otherId: 'Nami', otherRole: 'SUPPORT', kind: 'synergy', wins: 570, games: 1000 },
    { championId: 'Xayah', role: 'ADC', otherId: 'Rakan', otherRole: 'SUPPORT', kind: 'synergy', wins: 560, games: 1000 },
    { championId: 'Orianna', role: 'MID', otherId: 'JarvanIV', otherRole: 'JUNGLE', kind: 'synergy', wins: 555, games: 1000 },
    { championId: 'Malphite', role: 'TOP', otherId: 'Jayce', otherRole: 'TOP', kind: 'matchup', wins: 540, games: 1000 }
  ].map(p => ({ ...p, role: p.role as DataPack['pairs'][number]['role'], otherRole: p.otherRole as DataPack['pairs'][number]['role'], kind: p.kind as 'synergy' | 'matchup', patch, source: 'solo', rank: 'all', league: 'all', side: 'all', baseline: 0.5 }));
  return { schemaVersion: 1, id: 'synthetic-demo', createdAt: new Date().toISOString(), provenance: { name: 'Démonstration fictive / Synthetic demo', url: 'https://example.org/synthetic-only', license: 'Generated fictitious data. No real source. Not for competitive recommendations.', demo: true }, stats, pairs, games: [] };
}
