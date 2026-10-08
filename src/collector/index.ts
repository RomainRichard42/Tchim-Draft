import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { download } from '../main/data';
import { packSchema } from '../shared/validation';
import type { DataPack } from '../shared/types';

// Companion CLI for a private cron. Inputs are authorized normalized JSON exports,
// never undocumented provider APIs, paywall bypasses or unverified HTML selectors.
const configSchema = z.object({ publisher: z.object({ name: z.string().min(1), url: z.string().url(), license: z.string().min(1) }),
  outputDirectory: z.string().min(1), minIntervalMs: z.number().int().min(1000).default(2000),
  allowDemo: z.boolean().default(false), sources: z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
    file: z.string().optional(), url: z.string().url().optional(), authorizationFile: z.string() })
    .refine(s => Boolean(s.file) !== Boolean(s.url), 'Exactly one file or HTTPS URL per source')).min(1) }).strict();
const authorizationSchema = z.object({ sourceId: z.string(), allowCollection: z.literal(true), allowRedistribution: z.literal(true),
  validUntil: z.string().datetime(), reference: z.string().min(1) }).strict();
export async function collect(configPath: string): Promise<DataPack> {
  const base = path.dirname(path.resolve(configPath));
  const config = configSchema.parse(JSON.parse(await readFile(configPath, 'utf8')));
  const output = path.resolve(base, config.outputDirectory); await mkdir(path.join(output, 'raw'), { recursive: true });
  const db = new Database(path.join(output, 'collector.sqlite'));
  db.exec(`CREATE TABLE IF NOT EXISTS cache (id TEXT PRIMARY KEY, url TEXT, etag TEXT, raw TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS logs (at TEXT NOT NULL, source TEXT NOT NULL, status TEXT NOT NULL, message TEXT NOT NULL)`);
  const timestamp = new Date().toISOString(), parts: DataPack[] = [];
  try {
    let lastRequest = 0;
    for (const source of config.sources) {
      const authorization = authorizationSchema.parse(JSON.parse(await readFile(path.resolve(base, source.authorizationFile), 'utf8')));
      if (authorization.sourceId !== source.id || Date.parse(authorization.validUntil) <= Date.now()) throw new Error(`Missing, mismatched or expired authorization: ${source.id}`);
      let body: Buffer, etag: string | undefined;
      if (source.file) {
        const file = path.resolve(base, source.file); if ((await stat(file)).size > 64 * 1024 * 1024) throw new Error('Input exceeds 64 MB'); body = await readFile(file);
      } else {
        const wait = Math.max(0, config.minIntervalMs - (Date.now() - lastRequest)); if (wait) await new Promise(r => setTimeout(r, wait));
        const cache = db.prepare('SELECT url,etag,raw FROM cache WHERE id=?').get(source.id) as { url: string; etag: string; raw: string } | undefined;
        const response = await download(source.url!, 64 * 1024 * 1024, cache && cache.url === source.url ? cache.etag : undefined); lastRequest = Date.now();
        if (!response && !cache) throw new Error('304 with no cache');
        body = response?.body ?? Buffer.from(cache!.raw); etag = response?.etag ?? cache?.etag;
      }
      const pack = packSchema.parse(JSON.parse(body.toString()));
      if (pack.provenance.demo && !config.allowDemo) throw new Error(`Synthetic input rejected: ${source.id}`);
      if (!pack.stats.length && !pack.games.length) throw new Error(`Unexpected empty source: ${source.id}; previous publication retained`);
      const hash = createHash('sha256').update(body).digest('hex');
      await writeFile(path.join(output, 'raw', `${source.id}-${hash}.json`), body);
      db.prepare('INSERT OR REPLACE INTO cache VALUES (?,?,?,?)').run(source.id, source.url ?? null, etag ?? null, body.toString());
      db.prepare('INSERT INTO logs VALUES (?,?,?,?)').run(timestamp, source.id, 'ok', `${pack.stats.length} stats, ${pack.pairs.length} pairs, ${hash}`);
      parts.push(pack);
    }
    const pack: DataPack = { schemaVersion: 1, id: `tchim-${timestamp.replace(/[^0-9]/g, '')}`, createdAt: timestamp,
      provenance: { ...config.publisher, demo: parts.some(p => p.provenance.demo) }, stats: parts.flatMap(p => p.stats), pairs: parts.flatMap(p => p.pairs), games: parts.flatMap(p => p.games) };
    const keys = new Set<string>();
    for (const r of [...pack.stats, ...pack.pairs]) {
      const key = [r.championId, r.role, r.patch, r.source, r.rank, r.league, r.side, 'kind' in r ? `${r.kind}|${r.otherId}|${r.otherRole}` : 'stat'].join('|');
      if (keys.has(key)) throw new Error(`Overlapping aggregates rejected: ${key}`); keys.add(key);
    }
    packSchema.parse(pack);
    const json = JSON.stringify(pack), checksum = createHash('sha256').update(json).digest('hex');
    await writeFile(path.join(output, `${pack.id}.json`), json);
    await writeFile(path.join(output, `${pack.id}.sha256`), `${checksum}  ${pack.id}.json\n`);
    await writeFile(path.join(output, 'latest.json.tmp'), json); await rename(path.join(output, 'latest.json.tmp'), path.join(output, 'latest.json'));
    console.log(`Published locally: ${path.join(output, 'latest.json')} · ${pack.stats.length} stats · ${checksum}`);
    return pack;
  } catch (error) {
    db.prepare('INSERT INTO logs VALUES (?,?,?,?)').run(timestamp, 'pipeline', 'error', error instanceof Error ? error.message : String(error)); throw error;
  } finally { db.close() }
}
if (require.main === module) {
  if (!process.argv[2]) { console.error('Usage: npm run collect -- tools/collector.config.json'); process.exitCode = 1 }
  else void collect(process.argv[2]).catch(error => { console.error(error); process.exitCode = 1 });
}
