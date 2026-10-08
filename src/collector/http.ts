import Database from 'better-sqlite3';
import robotsParser from 'robots-parser';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

const AGENT = 'TchimDraft/0.3 (+local desktop draft statistics)';
const ALLOWED = new Set(['gol.gg', 'lolalytics.com', 'a1.lolalytics.com', 'op.gg']);
export class AccessError extends Error {}
export interface Page { html: string; url: string; fetchedAt: string; cached: boolean }
interface CacheRow { hash:string; at:string; etag?:string; modified?:string }
/** Serial public-page access. Never executes remote HTML or bypasses access controls. */
export class ScrapeHttp {
  private db: Database.Database;
  private last = new Map<string, number>();
  private cookies = new Map<string, Map<string, string>>();
  private robots = new Map<string, ReturnType<typeof robotsParser>>();
  private blocked = new Set<string>();
  constructor(private root: string, private log: (message: string) => void = () => {}, private intervalMs = 2500, private force = false) {
    this.db = new Database(path.join(root, 'scrape-cache.sqlite'));
    this.db.pragma('journal_mode = WAL');
    this.db.exec('CREATE TABLE IF NOT EXISTS pages (key TEXT PRIMARY KEY, url TEXT NOT NULL, hash TEXT NOT NULL, at TEXT NOT NULL, etag TEXT, modified TEXT)');
  }
  private validate(url: string): URL {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !ALLOWED.has(u.hostname) || u.port || u.username || u.password) throw new AccessError('Scraper URL outside public source allowlist');
    return u;
  }
  private async request(url: string, body?: URLSearchParams, conditional: Record<string, string> = {}, hops = 0): Promise<Response> {
    const u = this.validate(url);
    if(this.blocked.has(u.hostname))throw new AccessError(`${u.hostname}: collection already stopped after an access refusal`);
    if (this.robots.has(u.hostname) && this.robots.get(u.hostname)!.isAllowed(url, AGENT) === false) throw new AccessError(`robots.txt excludes ${u.pathname}`);
    const delay = Math.max(this.intervalMs, (this.robots.get(u.hostname)?.getCrawlDelay(AGENT) ?? 0) * 1000);
    const wait = delay - (Date.now() - (this.last.get(u.hostname) ?? 0));
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    this.last.set(u.hostname, Date.now());
    const jar = this.cookies.get(u.hostname) ?? new Map<string, string>(); this.cookies.set(u.hostname, jar);
    let response:Response;
    try { response = await fetch(url, { method: body ? 'POST' : 'GET', body, redirect: 'manual', signal: AbortSignal.timeout(25000),
      headers: { 'User-Agent': AGENT, Accept: 'text/html,text/plain;q=0.9', 'Accept-Language': 'en', ...conditional,
        ...(jar.size ? { Cookie: [...jar.values()].join('; ') } : {}) } }); }
    catch(error){this.blocked.add(u.hostname);throw new AccessError(`${u.hostname}: network unavailable; collection stopped (${String(error).slice(0,200)})`);}
    for (const value of response.headers.getSetCookie()) { const cookie = value.split(';')[0]; jar.set(cookie.split('=')[0], cookie) }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const target = new URL(response.headers.get('location') ?? '', url);
      if (target.hostname !== u.hostname || hops >= 3 || !response.headers.get('location')) throw new AccessError('Unexpected source redirect');
      await response.body?.cancel();
      return this.request(target.href, response.status === 307 || response.status === 308 ? body : undefined, {}, hops + 1);
    }
    if ([401, 403, 429].includes(response.status)) {
      this.blocked.add(u.hostname);
      await response.body?.cancel();
      throw new AccessError(`${u.hostname}: HTTP ${response.status}; collection stopped${response.headers.get('retry-after') ? ` (Retry-After ${response.headers.get('retry-after')})` : ''}`);
    }
    return response;
  }
  private async read(response: Response, url:string): Promise<string> {
    if (!response.ok) throw new Error(`Source HTTP ${response.status}`);
    if (Number(response.headers.get('content-length')) > 5_000_000) throw new Error('Source page exceeds 5 MB');
    const chunks: Uint8Array[] = []; let bytes = 0;
    if (!response.body) throw new Error('Empty source page');
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      bytes += chunk.length; if (bytes > 5_000_000) throw new Error('Source page exceeds 5 MB'); chunks.push(chunk);
    }
    const html = Buffer.concat(chunks).toString('utf8');
    if (/<title[^>]*>[^<]*(?:just a moment|access denied|captcha)/i.test(html) || /id=["']challenge-form["']/i.test(html)) {this.blocked.add(new URL(url).hostname);throw new AccessError('Access challenge detected; collection stopped');}
    return html;
  }
  private async readCached(url:string,body?:URLSearchParams):Promise<{key:string;row:CacheRow|undefined;saved:string|undefined}> {
    const key = createHash('sha256').update(`${url}\n${body?.toString() ?? ''}`).digest('hex');
    const row = this.db.prepare('SELECT * FROM pages WHERE key = ?').get(key) as CacheRow | undefined;
    let saved: string | undefined;
    if (row) { try { saved = await readFile(path.join(this.root, 'raw', `${row.hash}.html`), 'utf8'); if (createHash('sha256').update(saved).digest('hex') !== row.hash) saved = undefined } catch { /* Cache file was removed */ } }
    return {key,row,saved};
  }
  /** Local lookup only, including when a page's network cache has expired. */
  async peek(url:string,body?:URLSearchParams):Promise<Page|undefined> {
    this.validate(url);
    const {row,saved}=await this.readCached(url,body);
    return saved&&row?{html:saved,url,fetchedAt:row.at,cached:true}:undefined;
  }
  private async cached(url: string, body: URLSearchParams | undefined, ttlMs: number): Promise<Page> {
    const {key,row,saved}=await this.readCached(url,body);
    if (saved && row && Date.now() - Date.parse(row.at) < ttlMs) return { html: saved, url, fetchedAt: row.at, cached: true };
    const response = await this.request(url, body, saved && !body ? { ...(row?.etag ? { 'If-None-Match': row.etag } : {}), ...(row?.modified ? { 'If-Modified-Since': row.modified } : {}) } : {});
    const at = new Date().toISOString();
    if (response.status === 304 && saved && row) { this.db.prepare('UPDATE pages SET at = ? WHERE key = ?').run(at, key); return { html: saved, url, fetchedAt: at, cached: true } }
    const html = await this.read(response,url), hash = createHash('sha256').update(html).digest('hex');
    const dir = path.join(this.root, 'raw'); await mkdir(dir, { recursive: true });
    const tmp = path.join(dir, `${hash}.tmp`); await writeFile(tmp, html); await rename(tmp, path.join(dir, `${hash}.html`));
    this.db.prepare('INSERT OR REPLACE INTO pages VALUES (?, ?, ?, ?, ?, ?)').run(key, url, hash, at, response.headers.get('etag'), response.headers.get('last-modified'));
    this.log(`${new URL(url).hostname}: collected ${bytesLabel(html.length)} (${body ? 'filtered page' : new URL(url).pathname})`);
    return { html, url, fetchedAt: at, cached: false };
  }
  async page(url: string, body?: URLSearchParams, ttlMs = 6 * 3600000): Promise<Page> {
    const u = this.validate(url);
    if (!this.robots.has(u.hostname)) {
      const file = await this.cached(`${u.origin}/robots.txt`, undefined, 24 * 3600000);
      this.robots.set(u.hostname, robotsParser(`${u.origin}/robots.txt`, file.html));
    }
    if (this.robots.get(u.hostname)!.isAllowed(url, AGENT) === false) throw new AccessError(`robots.txt excludes ${u.pathname}`);
    return this.cached(url, body, this.force && ttlMs === 6 * 3600000 ? 0 : ttlMs);
  }
  close(): void { this.db.close() }
}
function bytesLabel(n: number): string { return `${Math.round(n / 1024)} KiB` }
