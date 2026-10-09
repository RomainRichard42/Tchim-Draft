import { dismissReleaseNotes } from './ui-helpers.mjs';
import { _electron as electron, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import { mkdir, cp, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(`.test-data/face-${Date.now()}`);
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
  await dismissReleaseNotes(page);
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
  const region = page.getByTestId('recommendation-scroll'), explanation = page.getByTestId('face-explanation');
  const start = Date.now(), initial = await page.evaluate(() => window.draftApi.analyze()); report.analysisMs = Date.now() - start;
  await expect(region.locator('.recommendation')).toHaveCount(initial.picks.length, { timeout: 30000 });
  await expect(region).toHaveAttribute('aria-busy', 'false', { timeout: 30000 });
  await expect(explanation).toHaveAttribute('data-champion', initial.picks[0].championId);
  await expect(region.locator('.rec-score strong').first()).toHaveText(initial.picks[0].score.toFixed(1));
  await expect(page.locator('.face-status h2')).toContainText('B3 · À nous de choisir');
  for (const side of ['ally', 'enemy']) {
    await expect(page.getByTestId(`focus-team-${side}`).locator('.team-slot')).toHaveCount(5);
    await expect(page.getByTestId(`focus-team-${side}`).locator('.ban-slot')).toHaveCount(5);
  }
  await expect(page.locator('.face-series-button')).toContainText('BO5 · Manche 2 · 10 indisponibles');
  await expect(explanation.locator('.face-criterion')).toHaveCount(3);
  await expect(page.getByTestId('face-pool')).toContainText('Pool du joueur à renseigner');
  expect(initial.picks.every(p => !prior.includes(p.championId))).toBe(true);
  const geometry = () => page.evaluate(() => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right }; };
    const rows = side => Array.from(document.querySelectorAll(`[data-testid="focus-team-${side}"] .team-slot`)).map(e => { const row = e.getBoundingClientRect(), portrait = e.querySelector('.portrait').getBoundingClientRect(); return { role: e.dataset.faceRole, y: row.y, height: row.height, portraitWithinRow: portrait.y >= row.y && portrait.bottom <= row.bottom }; });
    const importantText = ['.team-header h2', '.slot-name strong', '.slot-role', '.face-candidate-name strong', '.face-candidate .rec-score strong', '.face-criterion h3', '.face-criterion strong', '.face-criterion p', '.face-options-heading select', '.face-status p', '.face-confirm'];
    return { width: innerWidth, height: innerHeight, pageWidth: document.documentElement.scrollWidth, pageHeight: document.documentElement.scrollHeight,
      ally: rect('[data-testid="focus-team-ally"]'), enemy: rect('[data-testid="focus-team-enemy"]'), options: rect('.face-options'), explanation: rect('.face-explanation'), list: rect('[data-testid="recommendation-scroll"]'), footer: rect('.face-bottom'),
      allyRows: rows('ally'), enemyRows: rows('enemy'), bans: rect('[data-testid="focus-team-ally"] .ban-area'), fonts: importantText.map(selector => ({ selector, size: parseFloat(getComputedStyle(document.querySelector(selector)).fontSize) })), colors: ['.face-plan', '.face-matchup', '.face-pool'].map(s => getComputedStyle(document.querySelector(s)).backgroundColor) };
  });
  const checkGeometry = g => {
    expect(g.ally.y).toBe(g.enemy.y); expect(g.ally.height).toBe(g.enemy.height);
    expect(g.options.x).toBeGreaterThan(g.ally.right); expect(g.enemy.x).toBeGreaterThan(g.options.right);
    expect(g.explanation.y).toBeGreaterThanOrEqual(g.ally.bottom);
    expect(g.pageWidth).toBeLessThanOrEqual(g.width); expect(g.pageHeight).toBeLessThanOrEqual(g.height);
    expect(g.footer.bottom).toBeLessThanOrEqual(g.height); expect(g.list.height).toBeGreaterThan(100);
    expect(g.allyRows).toEqual(g.enemyRows); expect(g.allyRows.every(r => r.height >= 34 && r.portraitWithinRow)).toBe(true); expect(g.fonts.every(f => f.size >= 14)).toBe(true);
    expect(g.bans.y).toBeGreaterThanOrEqual(g.allyRows[4].y + g.allyRows[4].height);
    expect(g.bans.bottom).toBeLessThanOrEqual(g.ally.bottom);
    expect(new Set(g.colors).size).toBe(3);
  };
  report.wide = await geometry(); checkGeometry(report.wide);
  await capture('face-desktop-wide'); console.log('FACE wide layout, role alignment, semantic colors and real rankings verified');

  const close = () => page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Ordre de draft', exact: true }).click();
  await expect(page.locator('.timeline-track button')).toHaveCount(20); await expect(page.locator('.timeline-track .current')).toContainText('B3'); await close();
  await page.locator('.face-series-button').click(); await expect(page.getByTestId('fearless-panel')).toContainText('Manche 2/5');
  await page.getByTestId('fearless-panel').locator('.fearless-history > summary').click();
  await expect(page.locator('.fearless-chip')).toHaveCount(10); await close();
  await page.getByRole('button', { name: 'Plans des équipes', exact: true }).click();
  await expect(page.getByTestId('game-plan')).toHaveCount(2); await expect(page.locator('.face-response-list > div')).toHaveCount(initial.enemies.slice(0, 3).length); await close();

  const beforePreview = await page.evaluate(() => window.draftApi.snapshot());
  await region.locator('.face-candidate-preview').nth(1).click();
  expect((await page.evaluate(() => window.draftApi.snapshot())).draft.history).toEqual(beforePreview.draft.history);
  await expect(explanation).toHaveAttribute('data-champion', initial.picks[1].championId);
  await page.getByTestId('face-confirm').click(); await expect(page.getByRole('dialog')).toBeVisible();
  expect((await page.evaluate(() => window.draftApi.snapshot())).draft.history).toHaveLength(10); await close();
  await page.keyboard.press('Control+2'); await expect(page.getByRole('dialog')).toContainText(beforePreview.champions.find(c => c.id === initial.picks[1].championId).name); await close();

  const search = page.getByRole('textbox', { name: 'Rechercher parmi les picks…', exact: true });
  await search.fill('aucun-champion-test'); await expect(region.locator('.recommendation')).toHaveCount(0);
  await page.getByRole('button', { name: 'Effacer la recherche', exact: true }).click();
  expect(await region.evaluate(e => e.scrollHeight > e.clientHeight)).toBe(true);
  await region.locator('.recommendation').nth(12).scrollIntoViewIfNeeded(); expect(await region.evaluate(e => e.scrollTop)).toBeGreaterThan(0);
  const chosen = initial.picks[12], chosenName = beforePreview.champions.find(c => c.id === chosen.championId).name;
  await search.fill(chosenName); await expect(region.locator('.recommendation')).toHaveCount(1);
  await expect(region.locator('.rec-position')).toHaveText('13');
  await region.locator('.face-candidate-preview').click(); await expect(explanation).toHaveAttribute('data-champion', chosen.championId);
  await page.getByRole('button', { name: 'Détails des données', exact: true }).click(); await expect(page.getByTestId('role-context-detail')).toBeVisible(); await close();
  await page.getByTestId('face-confirm').click(); await page.getByRole('button', { name: 'Valider', exact: true }).click();
  await expect(page.locator('.face-status h2')).toContainText('R3');
  expect((await page.evaluate(() => window.draftApi.snapshot())).draft.history[10]).toEqual({ championId: chosen.championId, role: chosen.role });
  await page.getByRole('button', { name: 'Annuler la dernière action', exact: true }).click();
  await expect(page.locator('.face-status h2')).toContainText('B3'); await expect(search).toHaveValue('');
  await expect(region).toHaveAttribute('aria-busy', 'false', { timeout: 30000 });
  report.manualConfirmation = true; report.selectedRank = 13;
  console.log('FACE preview, all picks, manual confirmation, shortcuts, dialogs and undo verified');

  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1120, 760));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  report.small = await geometry(); checkGeometry(report.small);
  await expect(page.getByTestId('face-confirm')).toBeInViewport({ ratio: 1 }); await capture('face-desktop-small');
  console.log('FACE native minimum window layout verified');

  await page.evaluate(async () => { const s = await window.draftApi.snapshot(); await window.draftApi.settings({ ...s.settings, language: 'en' }); await window.draftApi.configure({ side: 'red' }); });
  await expect(page.locator('.face-status h2')).toContainText('Enter the enemy pick', { timeout: 30000 });
  await expect(region).toHaveAttribute('aria-busy', 'false', { timeout: 30000 });
  await expect(page.getByTestId('focus-team-ally')).toHaveClass(/red/);
  await expect(explanation).toContainText('Reliability'); await expect(page.getByTestId('face-plan')).toContainText('Their plan');
  const red = await page.evaluate(() => window.draftApi.analyze());
  await expect(page.getByTestId('draft-balance').getByRole('meter')).toHaveAttribute('aria-valuenow', String(-red.balance.value));
  const nextWindow = desktop.waitForEvent('window'); await page.getByRole('button', { name: 'Overlay', exact: true }).click(); const overlay = await nextWindow;
  await expect(overlay.getByTestId('app')).toBeVisible();
  await expect(overlay.getByTestId('draft-balance').getByRole('meter')).toHaveAttribute('aria-valuenow', String(-red.balance.value), { timeout: 30000 });
  await page.evaluate(() => window.draftApi.overlay());
  console.log('FACE EN, red side and synchronized overlay verified');

  await page.evaluate(async () => {
    await window.draftApi.reset(); await window.draftApi.configure({ side: 'blue', targetRole: 'AUTO' });
    const s = await window.draftApi.snapshot(); await window.draftApi.settings({ ...s.settings, language: 'fr' });
    const roster = { blue: [['Jinx','ADC'], ['Lulu','SUPPORT'], ['Ornn','TOP'], ['Orianna','MID'], ['Sejuani','JUNGLE']], red: [['Vi','JUNGLE'], ['Akali','MID'], ['Ashe','ADC'], ['Nautilus','SUPPORT'], ['Gwen','TOP']] };
    for (const side of ['ban','ban','ban','ban','ban','ban','blue','red','red','blue','blue','red','ban','ban','ban','ban','red','blue','blue','red']) {
      if (side === 'ban') await window.draftApi.select(null); else { const [id, role] = roster[side].shift(); await window.draftApi.select(id, role); }
    }
  });
  await expect(page.locator('.face-status h2')).toHaveText('Draft terminée', { timeout: 30000 });
  await expect(page.getByTestId('face-confirm')).toBeDisabled();
  await expect(page.getByTestId('fearless-panel').getByRole('button', { name: 'Archiver et continuer' })).toBeEnabled({ timeout: 30000 });
  await page.getByTestId('fearless-panel').getByRole('button', { name: 'Archiver et continuer' }).click();
  await expect(page.getByTestId('fearless-panel')).toContainText('Manche 3/5', { timeout: 30000 });
  await expect(page.getByTestId('fearless-panel')).toContainText('20 champions indisponibles');
  const after = await page.evaluate(() => window.draftApi.snapshot()); expect(after.data.refreshing).toBe(false);
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.evaluate(async () => { const s = await window.draftApi.snapshot(); await window.draftApi.configure({ series: { format: 'bo3', games: s.draft.series.games.map(g => ({ ...g, winner: 'ally' })) } }); });
  await expect(page.locator('.face-series-button')).toContainText('BO3 · Série terminée');
  await expect(page.locator('.face-status h2')).toHaveText('Série terminée');
  await expect(page.locator('.face-status p')).toHaveText('2 manches archivées');
  await expect(page.getByTestId('face-confirm')).toBeDisabled();
  report.seriesCompletion = true;
  expect(errors).toEqual([]); Object.assign(report, { version: await desktop.evaluate(({ app }) => app.getVersion()), suggestions: initial.picks.length, errors, noCollection: true, localized: ['fr','en'], overlay: true, fearlessArchive: true });
  await writeFile('artifacts/face-ui-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ version: report.version, suggestions: initial.picks.length, analysisMs: report.analysisMs, wide: report.wide.list.height, small: report.small.list.height, errors }));
} finally { await desktop.close(); }
