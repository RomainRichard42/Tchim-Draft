import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Storage } from '../main/storage';
import { refreshData } from '../main/data';
import { scrapeSources } from './scrape';

async function main() {
  const flags = Object.fromEntries(process.argv.slice(2).map(arg => { const [key, ...value] = arg.replace(/^--/, '').split('='); return [key, value.join('=')] }));
  const root = path.resolve(flags.directory || 'data/local'); await mkdir(root, { recursive: true });
  const storage = new Storage(path.join(root, 'tchim.sqlite'));
  try {
    // Download the real Riot numeric champion IDs first; seed IDs are deliberately placeholders.
    const enabled = 'enable-scraping' in flags || 'enable-auto' in flags ? true : storage.settings.scrapingEnabled; storage.settings.scrapingEnabled = false;
    try { await refreshData(storage, root, () => {}) }
    finally { storage.settings.scrapingEnabled = enabled; storage.persist() }
    const result = await scrapeSources(storage, root, message => console.log(message), {
      ...(flags.source==='pro'||flags.source==='solo'?{source:flags.source}:{}),
      ...(flags.patch ? { patch: flags.patch } : {}), ...(flags.rank ? { tier: flags.rank } : {}),
      ...(flags.details ? { details: Number(flags.details) } : {}), ...(flags.games ? { games: Number(flags.games) } : {}), revalidate:true,force: 'force' in flags });
    console.log(JSON.stringify({ directory: root, ...result, packs: storage.snapshot().data.packs }, null, 2));
    if (!result.errors.length) storage.set('lastRefresh', new Date().toISOString());
    if (result.errors.length) process.exitCode = 1;
  } finally { storage.close() }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 });
