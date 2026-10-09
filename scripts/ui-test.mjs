import { _electron as electron, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
await mkdir('artifacts', { recursive: true });
const env = { ...process.env, TCHIM_DATA_DIR: path.resolve(`.test-data/ui-${Date.now()}`), TCHIM_OFFLINE: '1', TCHIM_TEST_HEADLESS: '1' };
delete env.ELECTRON_RUN_AS_NODE;
const executablePath = process.env.TCHIM_TEST_EXECUTABLE;
const desktop = await electron.launch({ args: executablePath ? [] : ['.'], ...(executablePath ? { executablePath } : {}), env, timeout: 30000 });
const errors = [];
async function capture(page, name, overlay=false) {
  await desktop.evaluate(async ({ BrowserWindow }, overlay) => { await BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('overlay=1') === overlay).capturePage(undefined, { stayHidden: true, stayAwake: true }); }, overlay);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const png = await desktop.evaluate(async ({ BrowserWindow }, overlay) => (await BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('overlay=1') === overlay).capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'), overlay);
  await writeFile(`artifacts/${name}.png`, Buffer.from(png, 'base64'));
}
try {
  const page = await desktop.firstWindow();
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
  page.on('pageerror', e => errors.push(e.message));
  await expect(page.getByTestId('app')).toBeVisible();
  await expect(page.getByRole('heading', { name: /À nous de bannir/ })).toBeVisible();
  await expect(page.locator('.recommendation')).toHaveCount(5, { timeout: 30000 });
  await expect(page.getByTestId('face-pool')).toContainText('Non renseigné');
  expect(await page.evaluate(() => typeof window.require)).toBe('undefined');
  expect(await page.evaluate(() => typeof window.process)).toBe('undefined');
  await page.getByRole('button', { name: 'Importer OP.GG', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /multi OP.GG/ })).toHaveCount(2);
  await page.getByRole('button', { name: 'Draft', exact: true }).click();
  await page.getByRole('button', { name: 'Ban', exact: true }).click();
  await page.getByRole('dialog').getByPlaceholder('Rechercher un champion…').fill('Ahri');
  await page.locator('.champion-option', { hasText: 'Ahri' }).click();
  await page.getByRole('button', { name: 'Valider', exact: true }).click();
  await expect.poll(async () => (await page.evaluate(() => window.draftApi.snapshot())).draft.history.length).toBe(1);
  expect((await page.evaluate(() => window.draftApi.snapshot())).draft.history[0].championId).toBe('Ahri');
  await page.getByRole('button', { name: 'Annuler la dernière action', exact: true }).click();
  await expect.poll(async () => (await page.evaluate(() => window.draftApi.snapshot())).draft.history.length).toBe(0);
  // Real manual tournament transition, then joint recommendations.
  await page.evaluate(async () => { for (let i = 0; i < 6; i++) await window.draftApi.select(null); await window.draftApi.select('Orianna', 'MID'); await window.draftApi.configure({ side: 'red' }) });
  await expect(page.locator('.duo-row')).toHaveCount(3, { timeout: 30000 });
  await page.locator('.focus-duos > summary').click();
  await page.locator('.duo-row button').first().click();
  await expect.poll(async () => (await page.evaluate(() => window.draftApi.snapshot())).draft.history.length).toBe(9);
  const state = await page.evaluate(() => window.draftApi.snapshot());
  expect(state.draft.history.slice(7, 9).map(s => s.role)[0]).not.toBe(state.draft.history.slice(7, 9).map(s => s.role)[1]);
  await page.evaluate(() => window.draftApi.saveSession('UI test tournament'));
  const saved = await page.evaluate(() => window.draftApi.snapshot());
  await page.evaluate(() => window.draftApi.reset());
  await page.evaluate(id => window.draftApi.loadSession(id), saved.sessions[0].id);
  expect((await page.evaluate(() => window.draftApi.snapshot())).draft.history.length).toBe(9);
  await page.getByRole('button', { name: 'Simulations', exact: true }).click();
  await page.getByRole('button',{name:'Explorer les suites',exact:true}).click();
  await expect(page.getByTestId('simulation-branch')).toHaveCount(12, { timeout: 30000 });
  const a = await page.evaluate(() => window.draftApi.analyze());
  expect(a.scenarios.every(s => s.history.length === 20 && s.winProbability === null)).toBe(true);
  await page.getByRole('button', { name: 'Mon pool', exact: true }).click();
  await page.getByRole('button', { name: 'Ahri 5/5', exact: true }).click();
  expect((await page.evaluate(() => window.draftApi.snapshot())).settings.pool.Ahri).toBe(5);
  await page.getByRole('button', { name: 'Données', exact: true }).click();
  await page.getByRole('button', { name: 'Charger une démo fictive', exact: true }).click();
  await expect(page.locator('.pack-row')).toHaveCount(1);
  expect((await page.evaluate(() => window.draftApi.snapshot())).data.packs[0].demo).toBe(true);
  await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your take on the draft.' })).toBeVisible();
  await page.getByRole('button', { name: 'Français', exact: true }).click();
  await page.evaluate(async () => { await window.draftApi.reset(); const s = await window.draftApi.snapshot(); await window.draftApi.settings({ ...s.settings, poolOnly: false }); await window.draftApi.configure({ side: 'blue' }) });
  if (process.env.TCHIM_TEST_REFRESH) {
    await page.evaluate(() => window.draftApi.refresh());
    const refreshed = await page.evaluate(() => window.draftApi.snapshot());
    console.log('REFRESH_STATUS', refreshed.data.message);
    expect(refreshed.data.staticVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(refreshed.champions.length).toBeGreaterThan(160);
    console.log(`LIVE_DATA_OK ${refreshed.data.staticVersion} · ${refreshed.champions.length} champions`);
  }
  await page.evaluate(() => window.draftApi.removePack('synthetic-demo'));
  await page.getByRole('button', { name: 'Draft', exact: true }).click();
  await expect(page.locator('.recommendation')).toHaveCount(5, { timeout: 30000 });
  await capture(page, 'desktop-draft');
  // Native z-order needs a shown owner window on Windows; do not take focus.
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => !w.webContents.getURL().includes('overlay=1')).showInactive());
  const newWindow = desktop.waitForEvent('window');
  await page.getByRole('button', { name: 'Overlay', exact: true }).click();
  const overlay = await newWindow;
  await expect(overlay.locator('.overlay-app')).toBeVisible();
  await expect(overlay.locator('.recommendation')).toHaveCount(3, { timeout: 30000 });
  // Windows reports native z-order only after a window is shown. Show the
  // interactive overlay for the native check and screenshot, then close it.
  const properties = await desktop.evaluate(async ({ BrowserWindow }) => {
    const windows = BrowserWindow.getAllWindows(), overlay = windows.find(w => w.webContents.getURL().includes('overlay=1'));
    overlay.showInactive();
    await new Promise(resolve => setTimeout(resolve, 300));
    const result = windows.map(w => ({ top: w.isAlwaysOnTop(), visible: w.isVisible(), url: w.webContents.getURL(), isolated: w.webContents.getLastWebPreferences().contextIsolation, sandbox: w.webContents.getLastWebPreferences().sandbox }));
    return result;
  });
  console.log('WINDOW_SECURITY', JSON.stringify(properties));
  expect(properties.some(w => w.top)).toBe(true); expect(properties.every(w => w.isolated && w.sandbox)).toBe(true);
  await page.evaluate(() => window.draftApi.select('Ahri'));
  await expect(overlay.getByRole('heading', { name: /R ban 1/ })).toBeVisible();
  await capture(overlay, 'desktop-overlay', true);
  expect(errors).toEqual([]);
  console.log('DESKTOP_UI_OK manual draft, undo, duo, scenarios, SQLite sessions, pool, demo, FR/EN, overlay sync, isolation, screenshots');
} finally { await desktop.close() }
