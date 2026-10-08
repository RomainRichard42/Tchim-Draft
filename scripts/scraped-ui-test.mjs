import { _electron as electron, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import { mkdir, cp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import pkg from '../package.json' with {type:'json'};

const root = path.resolve(`.test-data/scraped-ui-${Date.now()}`); await mkdir(root, { recursive: true });
const original = new Database('data/local/tchim.sqlite', { readonly: true });
await original.backup(path.join(root, 'tchim.sqlite')); original.close();
await cp('data/local/icons', path.join(root, 'icons'), { recursive: true });
const env = { ...process.env, TCHIM_DATA_DIR: root, TCHIM_OFFLINE: '1', TCHIM_TEST_HEADLESS: '1' }; delete env.ELECTRON_RUN_AS_NODE;
if (process.env.TCHIM_TEST_SOURCE_REFRESH) {
  await cp('data/local/scraping', path.join(root, 'scraping'), { recursive: true });
  const db = new Database(path.join(root, 'tchim.sqlite'));
  db.prepare('UPDATE kv SET value = ? WHERE key = ?').run(JSON.stringify('2000-01-01T00:00:00Z'), 'lastRefresh'); db.close();
  const cache = new Database(path.join(root, 'scraping/scrape-cache.sqlite'));
  cache.prepare('DELETE FROM pages WHERE url = ?').run('https://lolalytics.com/lol/tierlist/?patch=16.20&tier=master_plus&lane=top');
  const url = 'https://gol.gg/champion/list/season-S16/split-ALL/tournament-ALL/';
  const body = new URLSearchParams({ patch: '16.18.', role: 'TOP', side: 'ALL', draft: 'ALL', cbtournament: 'ALL', leaguePost: 'true' });
  cache.prepare('DELETE FROM pages WHERE key = ?').run(createHash('sha256').update(`${url}\n${body}`).digest('hex')); cache.close();
  delete env.TCHIM_OFFLINE;
}
const executablePath = process.env.TCHIM_TEST_EXECUTABLE;
const desktop = await electron.launch({ args: executablePath ? [] : ['.'], ...(executablePath ? { executablePath } : {}), env, timeout: 30000 });
const errors = [];
try {
  const page = await desktop.firstWindow(); page.on('pageerror', e => errors.push(e.message));
  await expect(page.getByTestId('app')).toBeVisible();
  await expect(page.getByText(`v${pkg.version}`, { exact: true })).toBeVisible();
  await page.evaluate(async()=>{await window.draftApi.reset();await window.draftApi.configure({mode:'pro',side:'blue',targetRole:'AUTO',league:'all',series:{format:'single',games:[]}});});
  if (process.env.TCHIM_TEST_SOURCE_REFRESH) {
    await page.locator('.app-header').getByRole('button', { name: 'Actualiser', exact: true }).click();
    await expect.poll(async () => {
      const s = await page.evaluate(() => window.draftApi.snapshot());
      return !s.data.refreshing && s.data.lastRefresh !== '2000-01-01T00:00:00Z';
    }, { timeout: 3600000, intervals: [1000, 2000] }).toBe(true);
    console.log('ELECTRON_LIVE_SCRAPERS_OK manual refresh fetched public pages from both sources');
  }
  const snapshot = await page.evaluate(() => window.draftApi.snapshot());
  expect(snapshot.data.packs.filter(p => !p.demo).length).toBeGreaterThanOrEqual(5);
  expect(snapshot.data.coverage.every(c => c.patches.length === 3)).toBe(true);
  expect(snapshot.data.packs.reduce((n, p) => n + p.rows, 0)).toBeGreaterThan(9000);
  expect(snapshot.settings.scrapingEnabled).toBe(true);
  const start = Date.now();
  const analysis = await page.evaluate(() => window.draftApi.analyze());
  expect(analysis.bans.some(r => r.winrate !== null && r.games > 100)).toBe(true);
  expect(analysis.scenarios.every(s => s.history.length === 20)).toBe(true);
  console.log('REAL_DATA_ANALYSIS_MS', Date.now() - start);
  await page.evaluate(async () => { await window.draftApi.reset(); await window.draftApi.configure({ mode: 'solo', role: 'MID', targetRole: 'MID' }); for (let i = 0; i < 10; i++) await window.draftApi.select(null) });
  const picks = await page.evaluate(() => window.draftApi.analyze());
  expect(picks.picks.length).toBeGreaterThan(5);
  await expect(page.locator('.recommendation')).toHaveCount(picks.picks.length, { timeout: 30000 });
  expect(picks.picks.every(r => r.winrate !== null && r.games > 0 && r.source.includes('solo'))).toBe(true);
  expect(picks.picks.some(r => r.reasons.some(reason => reason.includes('arrondis')))).toBe(true);
  expect(await page.evaluate(() => typeof window.require)).toBe('undefined');
  await desktop.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].showInactive() }); await page.waitForTimeout(300);
  await page.screenshot({ path: 'artifacts/scraped-draft.png', fullPage: true });
  await page.getByRole('button', { name: 'Données', exact: true }).click();
  expect(await page.locator('.pack-row').count()).toBeGreaterThanOrEqual(5);
  await expect(page.locator('.pack-row').getByText('Lolalytics · MASTER_PLUS · 16.20-master_plus', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Collecter gol.gg et Lolalytics' })).toBeChecked();
  await page.screenshot({ path: 'artifacts/scraped-data.png', fullPage: false });
  expect(errors).toEqual([]);
  const report = { executablePath: executablePath ?? 'development Electron', packs: snapshot.data.packs, picks: picks.picks.map(p => ({ championId: p.championId, winrate: p.winrate, games: p.games, source: p.source })), rendererErrors: errors };
  await writeFile('artifacts/scraped-desktop-report.json', JSON.stringify(report, null, 2));
  console.log('SCRAPED_DESKTOP_OK real SQLite packs + worker recommendations + data UI + sandbox');
} finally { await desktop.close() }
