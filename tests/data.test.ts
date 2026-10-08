import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Storage } from '../src/main/storage';
import { demoPack, download, refreshData } from '../src/main/data';
import { SEED_CHAMPIONS } from '../src/shared/champions';
import { collect } from '../src/collector';
const resources: { storage?: Storage; dir: string }[] = [];
async function fixture() {
  const root = path.resolve('.test-data'); await mkdir(root, { recursive: true });
  const dir = await mkdtemp(path.join(root, 'data-')), storage = new Storage(path.join(dir, 'test.sqlite'));
  storage.settings.scrapingEnabled = false;
  resources.push({ storage, dir }); return { storage, dir };
}
afterEach(async () => {
  vi.unstubAllGlobals();
  for (const resource of resources.splice(0)) {
    resource.storage?.close();
    if (!path.resolve(resource.dir).startsWith(path.resolve('.test-data') + path.sep)) throw new Error('Unsafe cleanup target');
    await rm(resource.dir, { recursive: true, force: true });
  }
});
describe('SQLite provenance and raw import consistency', () => {
  it('persists manual settings and sessions across database reopen', async () => {
    const { storage, dir } = await fixture(); storage.draft.side = 'red'; storage.settings.pool.Ahri = 5; storage.persist(); storage.saveSession('Tournament');
    storage.close(); resources[0].storage = new Storage(path.join(dir, 'test.sqlite'));
    expect(resources[0].storage!.draft.side).toBe('red'); expect(resources[0].storage!.settings.pool.Ahri).toBe(5);
    expect(resources[0].storage!.session(1).side).toBe('red');
  });
  it('rejects invalid replacement and overlapping aggregates without destroying the existing pack', async () => {
    const { storage } = await fixture(), pack = demoPack(storage); storage.importPack(pack);
    expect(() => storage.importPack({ ...pack, stats: [pack.stats[0], pack.stats[0]] })).toThrow(/Duplicate/);
    expect(storage.packs()[0].stats.length).toBe(pack.stats.length);
    expect(() => storage.importPack({ ...pack, stats: [{ ...pack.stats[0], championId: 'Nonexistent' }] })).toThrow(/Unknown/);
  });
  it('never mixes synthetic packs into real sources and replaces matching dimensions', async () => {
    const { storage } = await fixture(), demo = demoPack(storage); storage.importPack(demo);
    const real = { ...demo, id: 'real-fixture', provenance: { ...demo.provenance, demo: false }, stats: [demo.stats[0]], pairs: [] };
    storage.importPack(real); expect(storage.engineInput().stats).toHaveLength(1); expect(storage.engineInput().demo).toBe(false);
    storage.importPack({ ...real, id: 'new-fixture', stats: [{ ...real.stats[0], wins: 1 }] }); expect(storage.engineInput().stats[0].wins).toBe(1);
  });
});
describe('Data Dragon contract changes and offline fallback', () => {
  it('accepts historical aliases in versions and refreshes validated catalog/icons', async () => {
    const { storage, dir } = await fixture();
    const catalog = { version: '16.20.1', data: Object.fromEntries(SEED_CHAMPIONS.slice(0, 100).map((c, i) => [c.id, { id: c.id, key: String(i + 1), name: c.name, tags: ['Mage'], image: { full: `${c.id}.png` } }])) };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(url.endsWith('versions.json') ? JSON.stringify(['16.20.1', 'lolpatch_7.20']) : url.endsWith('champion.json') ? JSON.stringify(catalog) : Buffer.from([137,80,78,71,13,10,26,10]))));
    await refreshData(storage, dir, () => {}); expect(storage.snapshot().data.staticVersion).toBe('16.20.1');
    expect(storage.draft.patch).toBe('16.20'); expect(storage.champions().find(c => c.id === 'Ahri')?.icon).toContain('tchim://assets/');
    const last = storage.snapshot().data.lastRefresh;
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline fixture') }));
    await refreshData(storage, dir, () => {});
    expect(storage.snapshot().data.staticVersion).toBe('16.20.1'); expect(storage.snapshot().data.lastRefresh).toBe(last); expect(storage.refreshing).toBe(false);
  });
  it('retains the old catalog on an unexpectedly empty response', async () => {
    const { storage, dir } = await fixture(); storage.set('staticVersion', '16.19.1');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith('versions.json') ? ['16.20.1'] : { version: '16.20.1', data: {} }))));
    await refreshData(storage, dir, () => {}); expect(storage.snapshot().data.staticVersion).toBe('16.19.1'); expect(storage.snapshot().data.logs[0].level).toBe('error');
  });
  it('rejects cleartext URLs and excessive response bytes', async () => {
    await expect(download('http://example.org')).rejects.toThrow(/HTTPS/);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('12345')));
    await expect(download('https://example.org', 4)).rejects.toThrow(/size limit/);
  });
  it('checks a requested patch immediately while reusing its catalog and icons, and fetches a new version only when needed',async()=>{
    const {storage,dir}=await fixture();let version='16.20.1';
    const catalog=()=>({version,data:Object.fromEntries(SEED_CHAMPIONS.slice(0,100).map((c,i)=>[c.id,{id:c.id,key:String(i+1),name:c.name,tags:['Mage'],image:{full:`${c.id}.png`}}]))});
    const fetchMock=vi.fn(async(url:string)=>new Response(url.endsWith('versions.json')?JSON.stringify([version]):url.endsWith('champion.json')?JSON.stringify(catalog()):Buffer.from([137,80,78,71,13,10,26,10])));
    vi.stubGlobal('fetch',fetchMock);
    await refreshData(storage,dir,()=>{});fetchMock.mockClear();
    await refreshData(storage,dir,()=>{});
    expect(fetchMock.mock.calls.map(([url])=>url)).toEqual(['https://ddragon.leagueoflegends.com/api/versions.json']);
    version='16.21.1';fetchMock.mockClear();await refreshData(storage,dir,()=>{});
    expect(storage.snapshot().data.staticVersion).toBe(version);
    expect(fetchMock.mock.calls.filter(([url])=>url.endsWith('champion.json')).map(([url])=>url)).toEqual(['https://ddragon.leagueoflegends.com/cdn/16.21.1/data/fr_FR/champion.json']);
    expect(fetchMock.mock.calls.filter(([url])=>url.includes('/img/champion/'))).toHaveLength(100);
  });
  it('keeps conditional feed caching on a manual refresh without importing an unchanged pack again',async()=>{
    const {storage,dir}=await fixture();storage.settings.feedUrl='https://example.org/stats.json';
    const pack=demoPack(storage),catalog={version:'16.20.1',data:Object.fromEntries(SEED_CHAMPIONS.slice(0,100).map((c,i)=>[c.id,{id:c.id,key:String(i+1),name:c.name,tags:[],image:{full:`${c.id}.png`}}]))};
    const fetchMock=vi.fn(async(url:string,options?:RequestInit)=>{
      if(url===storage.settings.feedUrl){
        if((options?.headers as Record<string,string>)['If-None-Match']==='fixture-v1')return new Response(null,{status:304});
        return new Response(JSON.stringify(pack),{headers:{ETag:'fixture-v1'}});
      }
      return new Response(url.endsWith('versions.json')?'["16.20.1"]':url.endsWith('champion.json')?JSON.stringify(catalog):Buffer.from([137,80,78,71,13,10,26,10]));
    });
    vi.stubGlobal('fetch',fetchMock);await refreshData(storage,dir,()=>{});const revision=storage.dataRevision;
    fetchMock.mockClear();await refreshData(storage,dir,()=>{});
    expect(storage.dataRevision).toBe(revision);expect(storage.packs()).toHaveLength(1);
    expect(fetchMock.mock.calls.map(([url])=>url)).toEqual(['https://ddragon.leagueoflegends.com/api/versions.json',storage.settings.feedUrl]);
    expect((fetchMock.mock.calls[1][1]?.headers as Record<string,string>)['If-None-Match']).toBe('fixture-v1');
  });
});
describe('authorized collector publication', () => {
  it('publishes validated exports and retains the prior publication after invalid input', async () => {
    const { storage, dir } = await fixture(); const pack = demoPack(storage);
    await writeFile(path.join(dir, 'input.json'), JSON.stringify(pack));
    await writeFile(path.join(dir, 'authorization.json'), JSON.stringify({ sourceId: 'fixture', allowCollection: true, allowRedistribution: true, validUntil: '2099-01-01T00:00:00Z', reference: 'SYNTHETIC TEST ONLY' }));
    const config = { publisher: { name: 'Synthetic test collector', url: 'https://example.org', license: 'Synthetic test data only' }, outputDirectory: 'output', minIntervalMs: 1000, allowDemo: true,
      sources: [{ id: 'fixture', file: 'input.json', authorizationFile: 'authorization.json' }] };
    const file = path.join(dir, 'config.json'); await writeFile(file, JSON.stringify(config));
    const collected = await collect(file); expect(collected.provenance.demo).toBe(true);
    const before = await readFile(path.join(dir, 'output/latest.json'), 'utf8');
    await writeFile(path.join(dir, 'input.json'), '{}'); await expect(collect(file)).rejects.toThrow();
    expect(await readFile(path.join(dir, 'output/latest.json'), 'utf8')).toBe(before);
    await writeFile(file, JSON.stringify({ ...config, allowDemo: false })); await writeFile(path.join(dir, 'input.json'), JSON.stringify(pack));
    await expect(collect(file)).rejects.toThrow(/Synthetic/);
  });
});
