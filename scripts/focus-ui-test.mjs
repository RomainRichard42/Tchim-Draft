import { _electron as electron, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import { mkdir, cp, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(`.test-data/focus-${Date.now()}`);
await mkdir(root, { recursive: true }); await mkdir('artifacts', { recursive: true });
const original = new Database('data/local/tchim.sqlite', { readonly: true });
await original.backup(path.join(root, 'tchim.sqlite')); original.close();
await cp('data/local/icons', path.join(root, 'icons'), { recursive: true });
const env = { ...process.env, TCHIM_DATA_DIR: root, TCHIM_OFFLINE: '1', TCHIM_TEST_HEADLESS: '1' }; delete env.ELECTRON_RUN_AS_NODE;
const executablePath = process.env.TCHIM_TEST_EXECUTABLE;
const desktop = await electron.launch({ args: executablePath ? [] : ['.'], ...(executablePath ? { executablePath } : {}), env, timeout: 30000 });
const errors = [], report = {};
const prior = ['Skarner', 'Corki', 'Zeri', 'Viego', 'Leblanc', 'Bard', 'Azir', 'Aphelios', 'Taliyah', 'Sion'];
const capture = async name => {
  // Prime hidden-window painting, then capture the current rendered frame.
  await desktop.evaluate(async ({ BrowserWindow }) => { await BrowserWindow.getAllWindows()[0].capturePage(undefined, { stayHidden: true, stayAwake: true }); });
  const page = await desktop.firstWindow();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const png = await desktop.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'));
  await writeFile(`artifacts/${name}.png`, Buffer.from(png, 'base64'));
};
try {
  const page = await desktop.firstWindow(); page.on('pageerror', e => errors.push(e.message));
  await desktop.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.webContents.setBackgroundThrottling(false); w.setContentSize(1672, 941); });
  await expect(page.locator('.desktop-app')).toBeVisible({ timeout: 30000 });
  await page.evaluate(async prior => {
    await window.draftApi.reset();
    await window.draftApi.configure({ mode: 'pro', side: 'blue', targetRole: 'TOP', league: 'all', series: { format: 'bo5', games: [{ picks: prior }] } });
    const empty = { url: '', region: 'euw', poolOnly: false, message: '', players: [] };
    await window.draftApi.teams({ ally: empty, enemy: empty });
    const s = await window.draftApi.snapshot();
    await window.draftApi.settings({ ...s.settings, language: 'fr', weights: { winrate: 14, matchup: 18, synergy: 18, meta: 16, flex: 3, order: 8, composition: 18, mastery: 5 } });
    for (let i = 0; i < 6; i++) await window.draftApi.select(null);
    await window.draftApi.select('Sejuani', 'JUNGLE'); await window.draftApi.select('Ashe', 'ADC');
    await window.draftApi.select('Nautilus', 'SUPPORT'); await window.draftApi.select('Ahri', 'MID');
  }, prior);
  const region = page.getByTestId('recommendation-scroll'), feature = page.getByTestId('focus-featured');
  const start = Date.now(), initial = await page.evaluate(() => window.draftApi.analyze()); report.analysisMs = Date.now() - start;
  await expect(region.locator('.recommendation')).toHaveCount(initial.picks.length, { timeout: 30000 });
  await expect(region).toHaveAttribute('aria-busy', 'false', { timeout: 30000 });
  await expect(feature).toHaveAttribute('data-champion', initial.picks[0].championId);
  await expect(feature.locator('.focus-featured-score')).toHaveText(`${initial.picks[0].score.toFixed(1)}/100`);
  await expect(page.locator('.focus-alternative')).toHaveCount(2);
  await expect(page.locator('.timeline-track button')).toHaveCount(20);
  await expect(page.locator('.timeline-track .current')).toContainText('B3');
  for (const side of ['ally', 'enemy']) {
    await expect(page.getByTestId(`focus-team-${side}`).locator('.team-slot')).toHaveCount(5);
    await expect(page.getByTestId(`focus-team-${side}`).locator('.ban-slot')).toHaveCount(5);
  }
  await expect(page.getByTestId('fearless-panel')).toContainText('Manche 2/5');
  await expect(page.locator('.focus-fearless-used > span')).toHaveCount(10);
  expect(initial.picks.every(p => !prior.includes(p.championId))).toBe(true);
  const geometry = () => page.evaluate(() => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right }; };
    return { width: innerWidth, height: innerHeight, pageWidth: document.documentElement.scrollWidth, pageHeight: document.documentElement.scrollHeight,
      ally: rect('[data-testid="focus-team-ally"]'), enemy: rect('[data-testid="focus-team-enemy"]'), options: rect('.focus-options'), context: rect('.focus-context'), list: rect('[data-testid="recommendation-scroll"]'), footer: rect('.focus-bottom') };
  });
  report.wide = await geometry();
  expect(report.wide.ally.x).toBe(report.wide.enemy.x);
  expect(report.wide.enemy.y).toBeGreaterThan(report.wide.ally.y);
  expect(report.wide.options.x).toBeGreaterThan(report.wide.ally.right);
  expect(report.wide.context.x).toBeGreaterThan(report.wide.options.right);
  expect(report.wide.pageWidth).toBeLessThanOrEqual(report.wide.width);
  expect(report.wide.pageHeight).toBeLessThanOrEqual(report.wide.height);
  expect(report.wide.list.height).toBeGreaterThan(110);
  await capture('focus-desktop-wide'); console.log('FOCUS wide layout and real rankings verified');

  const beforePreview = await page.evaluate(() => window.draftApi.snapshot());
  await page.locator('.focus-alternative').first().click();
  expect((await page.evaluate(() => window.draftApi.snapshot())).draft.history).toEqual(beforePreview.draft.history);
  const previewId = await feature.getAttribute('data-champion'); expect(previewId).not.toBe(initial.picks[0].championId);
  await expect(page.locator('.focus-current-choice')).toContainText(beforePreview.champions.find(c => c.id === previewId).name);
  await page.getByTestId('focus-confirm').click(); await expect(page.getByRole('dialog')).toBeVisible();
  expect((await page.evaluate(() => window.draftApi.snapshot())).draft.history).toHaveLength(10);
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.keyboard.press('Control+2'); await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();

  const search = page.getByRole('textbox', { name: 'Rechercher parmi les picks…', exact: true });
  await search.fill('aucun-champion-test'); await expect(region.locator('.recommendation')).toHaveCount(0);
  await page.getByRole('button', { name: 'Effacer la recherche', exact: true }).click();
  expect(await region.evaluate(e => e.scrollHeight > e.clientHeight)).toBe(true);
  await region.locator('.recommendation').nth(12).scrollIntoViewIfNeeded(); expect(await region.evaluate(e => e.scrollTop)).toBeGreaterThan(0);
  const chosen = initial.picks[12], chosenName = beforePreview.champions.find(c => c.id === chosen.championId).name;
  await search.fill(chosenName); await expect(region.locator('.recommendation')).toHaveCount(1);
  await expect(region.locator('.rec-position')).toHaveText('13');
  await region.locator('.focus-row-name').click(); await expect(feature).toHaveAttribute('data-champion', chosen.championId);
  await region.locator('.rec-meta button').click(); await expect(page.getByTestId('role-context-detail')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByTestId('focus-confirm').click(); await page.getByRole('button', { name: 'Valider', exact: true }).click();
  await expect(page.locator('.timeline-track .done')).toHaveCount(11);
  expect((await page.evaluate(() => window.draftApi.snapshot())).draft.history[10]).toEqual({ championId: chosen.championId, role: chosen.role });
  await page.getByRole('button', { name: 'Annuler la dernière action', exact: true }).click();
  await expect(page.locator('.timeline-track .done')).toHaveCount(10); await expect(search).toHaveValue('');
  await expect(region).toHaveAttribute('aria-busy', 'false', { timeout: 30000 });
  report.manualConfirmation = true; report.selectedRank = 13;
  console.log('FOCUS preview, list scroll, manual confirmation and undo verified');

  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1120, 760));
  report.small = await geometry();
  expect(report.small.pageWidth).toBeLessThanOrEqual(report.small.width);
  expect(report.small.pageHeight).toBeLessThanOrEqual(report.small.height);
  expect(report.small.footer.bottom).toBeLessThanOrEqual(report.small.height);
  expect(report.small.list.height).toBeGreaterThan(85);
  await expect(page.getByTestId('focus-confirm')).toBeInViewport({ ratio: 1 }); await capture('focus-desktop-small');
  console.log('FOCUS minimum window layout verified');

  await page.evaluate(async () => { const s = await window.draftApi.snapshot(); await window.draftApi.settings({ ...s.settings, language: 'en' }); await window.draftApi.configure({ side: 'red' }); });
  await expect(page.locator('.recommendation-heading h2')).toContainText('Enter the enemy pick', { timeout: 30000 });
  await expect(region).toHaveAttribute('aria-busy', 'false', { timeout: 30000 });
  await expect(page.getByTestId('focus-team-ally')).toHaveClass(/red/);
  await expect(feature).toContainText('Reliability'); await expect(page.getByTestId('focus-responses')).toContainText('Enemy responses to watch');
  const red = await page.evaluate(() => window.draftApi.analyze());
  await expect(page.getByTestId('draft-balance').getByRole('meter')).toHaveAttribute('aria-valuenow', String(-red.balance.value));
  const nextWindow = desktop.waitForEvent('window'); await page.getByRole('button', { name: 'Overlay', exact: true }).click(); const overlay = await nextWindow;
  await expect(overlay.getByTestId('app')).toBeVisible();
  await expect(overlay.getByTestId('draft-balance').getByRole('meter')).toHaveAttribute('aria-valuenow', String(-red.balance.value), { timeout: 30000 });
  await page.evaluate(() => window.draftApi.overlay());
  console.log('FOCUS EN, red side and synchronized overlay verified');

  await page.evaluate(async () => {
    await window.draftApi.reset(); await window.draftApi.configure({ side: 'blue', targetRole: 'AUTO' });
    const s = await window.draftApi.snapshot(); await window.draftApi.settings({ ...s.settings, language: 'fr' });
    const roster = { blue: [['Jinx','ADC'], ['Lulu','SUPPORT'], ['Ornn','TOP'], ['Orianna','MID'], ['Sejuani','JUNGLE']], red: [['Vi','JUNGLE'], ['Akali','MID'], ['Ashe','ADC'], ['Nautilus','SUPPORT'], ['Gwen','TOP']] };
    for (const side of ['ban','ban','ban','ban','ban','ban','blue','red','red','blue','blue','red','ban','ban','ban','ban','red','blue','blue','red']) {
      if (side === 'ban') await window.draftApi.select(null); else { const [id, role] = roster[side].shift(); await window.draftApi.select(id, role); }
    }
  });
  await expect(page.locator('.recommendation-heading h2')).toHaveText('Draft terminée', { timeout: 30000 });
  await expect(page.getByTestId('focus-confirm')).toBeDisabled();
  await expect(page.getByTestId('fearless-panel').getByRole('button', { name: 'Archiver et continuer' })).toBeEnabled({ timeout: 30000 });
  await page.getByTestId('fearless-panel').getByRole('button', { name: 'Archiver et continuer' }).click();
  await expect(page.getByTestId('fearless-panel')).toContainText('Manche 3/5', { timeout: 30000 });
  await expect(page.getByTestId('fearless-panel')).toContainText('20 champions indisponibles');
  const after = await page.evaluate(() => window.draftApi.snapshot()); expect(after.data.refreshing).toBe(false);
  expect(errors).toEqual([]); Object.assign(report, { version: await desktop.evaluate(({ app }) => app.getVersion()), errors, noCollection: true, localized: ['fr','en'], overlay: true, fearlessArchive: true });
  await writeFile('artifacts/focus-ui-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ version: report.version, suggestions: initial.picks.length, analysisMs: report.analysisMs, wide: report.wide.list.height, small: report.small.list.height, errors }));
} finally { await desktop.close(); }
