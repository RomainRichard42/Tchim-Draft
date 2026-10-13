import { dismissReleaseNotes } from './ui-helpers.mjs';
import { _electron as electron, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import { mkdir, cp, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const root = path.resolve(`.test-data/constructivist-${Date.now()}`);
await mkdir(root, { recursive: true }); await mkdir('artifacts', { recursive: true });
const original = new Database('data/local/tchim.sqlite', { readonly: true });
await original.backup(path.join(root, 'tchim.sqlite')); original.close();
await cp('data/local/icons', path.join(root, 'icons'), { recursive: true });
// Prepare the isolated scenario before launch, avoiding twenty intermediate real-data analyses.
const db = new Database(path.join(root, 'tchim.sqlite'));
const get = key => JSON.parse(db.prepare('SELECT value FROM kv WHERE key=?').get(key).value);
const set = (key, value) => db.prepare('INSERT OR REPLACE INTO kv(key,value) VALUES (?,?)').run(key, JSON.stringify(value));
const roster = { blue: [['Ornn','TOP'], ['Vi','JUNGLE'], ['Orianna','MID'], ['Lulu','SUPPORT']], red: [['Renekton','TOP'], ['LeeSin','JUNGLE'], ['Ahri','MID'], ['Varus','ADC']] };
const bans = ['Jax','Maokai','Azir','Rakan','Kalista','Draven','Camille','Sejuani','Syndra','Nautilus'];
const history = ['ban','ban','ban','ban','ban','ban','blue','red','red','blue','blue','red','ban','ban','ban','ban','red','blue'].map(side => {
  if (side === 'ban') return { championId:bans.shift() };
  const [championId, role] = roster[side].shift(); return { championId, role };
});
set('draft', { ...get('draft'), mode:'pro',side:'blue',targetRole:'ADC',league:'all',series:{format:'bo5',games:[]},history });
set('settings', { ...get('settings'), language:'fr' });
const empty = { url:'',region:'euw',poolOnly:false,message:'',players:[] }; set('teams',{ally:empty,enemy:empty});
db.close();
const executablePath = process.env.TCHIM_TEST_EXECUTABLE || (process.argv.includes('--packaged') ? path.resolve(`release/${version}/win-unpacked/Tchim Draft.exe`) : undefined);
const env = { ...process.env, TCHIM_DATA_DIR: root, TCHIM_OFFLINE: '1', TCHIM_DISABLE_APP_UPDATES: '1', TCHIM_TEST_HEADLESS: '' }; delete env.ELECTRON_RUN_AS_NODE;
const desktop = await electron.launch({ args: executablePath ? [] : ['.'], ...(executablePath ? { executablePath } : {}), env, timeout: 30000 });
console.log('DESKTOP_STARTED');
const errors = [], report = { version };
const capture = async name => {
  const png = await desktop.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].capturePage()).toPNG().toString('base64'));
  await writeFile(`artifacts/${name}.png`, Buffer.from(png, 'base64'));
};
try {
  const page = await desktop.firstWindow(); page.on('pageerror', e => errors.push(e.message));
  await desktop.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.webContents.setBackgroundThrottling(false); w.setContentSize(1920, 1080); });
  await expect(page.locator('.constructivist-app')).toBeVisible({ timeout: 30000 }); await dismissReleaseNotes(page);
  console.log('SHELL_READY');
  console.log('FIXTURE_READY');
  const hero = page.getByTestId('draft-hero'), region = page.getByTestId('recommendation-scroll');
  await expect(region).toHaveAttribute('aria-busy', 'false', { timeout: 30000 });
  const analysis = await page.evaluate(() => window.draftApi.analyze());
  console.log('ANALYSIS_READY', analysis.picks.length);
  await expect(hero).toHaveAttribute('data-champion', analysis.picks[0].championId);
  await expect(hero.locator('.hero-score')).toHaveText(analysis.picks[0].score.toFixed(1).replace('.', ','));
  await expect(region.locator('.recommendation')).toHaveCount(analysis.picks.length - 1);
  await expect(page.locator('.balance-caption')).toContainText('8/10');
  await expect(page.locator('main .timeline-track button')).toHaveCount(20);
  await expect(page.locator('main .timeline-track .current')).toHaveText('19');
  await expect(page.locator('main .timeline-row').first().locator('button')).toHaveCount(10);
  for (const side of ['ally', 'enemy']) {
    await expect(page.getByTestId(`focus-team-${side}`).locator('.team-slot')).toHaveCount(5);
    await expect(page.getByTestId(`focus-team-${side}`).locator('.ban-slot')).toHaveCount(5);
  }
  expect(await page.locator('main.draft-page img:visible').count()).toBeGreaterThanOrEqual(18);
  expect(await page.locator('main.draft-page .champion-silhouette').count()).toBe(0);
  const layout = () => page.evaluate(() => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom }; };
    const text = [...document.querySelectorAll('main.draft-page *')].filter(e => [...e.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim()) && e.getBoundingClientRect().height && getComputedStyle(e).display !== 'none');
    return { width:innerWidth,height:innerHeight,pageWidth:document.documentElement.scrollWidth,pageHeight:document.documentElement.scrollHeight,
      hero:rect('[data-testid=draft-hero]'),list:rect('[data-testid=recommendation-scroll]'),ally:rect('[data-testid=focus-team-ally]'),enemy:rect('[data-testid=focus-team-enemy]'),footer:rect('.face-bottom'),
      minFont:Math.min(...text.map(e=>parseFloat(getComputedStyle(e).fontSize))),giant:parseFloat(getComputedStyle(document.querySelector('.hero-score')).fontSize),
      fontLevels:[...new Set(text.map(e=>parseFloat(getComputedStyle(e).fontSize)))].sort((a,b)=>a-b),
      gauges:[...document.querySelectorAll('main .draft-gauge>span')].map(e=>getComputedStyle(e).backgroundColor),
      active:[...document.querySelectorAll('main .timeline-track .current')].map(e=>({bg:getComputedStyle(e).backgroundColor,fg:getComputedStyle(e).color})),
      fills:[...document.querySelectorAll('.team-slot.filled')].map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y})) };
  });
  const check = g => {
    expect(g.pageWidth).toBeLessThanOrEqual(g.width); expect(g.pageHeight).toBeLessThanOrEqual(g.height);
    expect(g.minFont).toBeGreaterThanOrEqual(14); expect(g.giant).toBeGreaterThanOrEqual(60);
    expect(g.fontLevels).toHaveLength(3);
    expect(g.hero.y).toBeGreaterThanOrEqual(g.ally.bottom); expect(g.ally.y).toBe(g.enemy.y);
    expect(g.footer.bottom).toBeLessThanOrEqual(g.height); expect(g.list.height).toBeGreaterThan(60);
    expect(g.hero.bottom).toBeLessThanOrEqual(g.footer.y); expect(g.hero.height).toBeGreaterThan(150);
    expect(g.list.bottom).toBeLessThanOrEqual(g.footer.y);
    expect(g.gauges.every(c=>c==='rgb(238, 228, 208)')).toBe(true);
    expect(g.active).toEqual([{bg:'rgb(238, 228, 208)',fg:'rgb(20, 20, 20)'}]);
  };
  await capture('constructivist-desktop-wide'); report.wide = await layout(); console.log('LAYOUT_WIDE', JSON.stringify(report.wide)); check(report.wide);
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1104, 721));
  await capture('constructivist-desktop-small'); report.small = await layout(); console.log('LAYOUT_SMALL', JSON.stringify(report.small)); check(report.small);
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1920, 1080));
  const before = await page.evaluate(() => window.draftApi.snapshot());
  await region.locator('.face-candidate-preview').first().click();
  await expect(hero).toHaveAttribute('data-champion', analysis.picks[1].championId);
  expect((await page.evaluate(() => window.draftApi.snapshot())).draft.history).toEqual(before.draft.history);
  const close = () => page.getByRole('dialog').getByRole('button', { name:'Close',exact:true }).click();
  await page.getByTestId('face-confirm').click(); await expect(page.getByRole('dialog')).toBeVisible(); await close();
  await page.keyboard.press('Control+2'); await expect(page.getByRole('dialog')).toBeVisible(); await close();
  await page.locator('.hero-details').click(); await expect(page.getByTestId('face-explanation').locator('.face-criterion')).toHaveCount(3); await close();
  const search = page.getByRole('textbox', { name:'Rechercher parmi les picks…',exact:true });
  await search.fill('aucun-champion-test'); await expect(region.locator('.recommendation')).toHaveCount(0);
  await page.getByRole('button', { name:'Effacer la recherche',exact:true }).click();
  expect(await region.evaluate(e=>e.scrollHeight > e.clientHeight)).toBe(true);
  const candidate = analysis.picks[12], name = before.champions.find(c=>c.id===candidate.championId).name;
  await search.fill(name); await expect(region.locator('.rec-position').first()).toHaveText('13');
  await region.locator('.face-candidate-preview').first().click(); await expect(hero).toHaveAttribute('data-champion',candidate.championId);
  await page.getByTestId('face-confirm').click(); await page.getByRole('button',{name:'Valider',exact:true}).click();
  await expect(page.locator('.face-status h2')).toContainText('R5',{timeout:30000});
  expect((await page.evaluate(()=>window.draftApi.snapshot())).draft.history[18]).toEqual({championId:candidate.championId,role:candidate.role});
  await page.getByRole('button',{name:'Annuler la dernière action',exact:true}).click(); await expect(page.locator('main .timeline-track .current')).toHaveText('19',{timeout:30000});
  await page.locator('main .timeline-track button').first().click(); await expect(page.getByRole('dialog')).toBeVisible(); await close();
  await page.locator('.face-series-button').click(); await expect(page.getByTestId('fearless-panel')).toBeVisible(); await close();
  await page.locator('.face-bottom').getByRole('button',{name:'Plans des équipes',exact:true}).click(); await expect(page.getByTestId('game-plan')).toHaveCount(2); await close();
  await page.evaluate(async()=>{const s=await window.draftApi.snapshot();await window.draftApi.settings({...s.settings,language:'en'});await window.draftApi.configure({side:'red'});});
  await expect(page.getByTestId('focus-team-ally')).toHaveClass(/red/);
  await expect(region).toHaveAttribute('aria-busy','false',{timeout:30000});
  const red=await page.evaluate(()=>window.draftApi.analyze());
  await expect(page.getByTestId('draft-balance').getByRole('meter')).toHaveAttribute('aria-valuenow',String(-red.balance.value));
  const windowEvent=desktop.waitForEvent('window'); await page.getByRole('button',{name:'Overlay',exact:true}).click(); const overlay=await windowEvent;
  await expect(overlay.getByTestId('app')).toBeVisible(); await expect(overlay.locator('.recommendation')).toHaveCount(3,{timeout:30000}); await page.evaluate(()=>window.draftApi.overlay());
  expect((await page.evaluate(()=>window.draftApi.snapshot())).data.refreshing).toBe(false); expect(errors).toEqual([]);
  Object.assign(report,{realSuggestions:analysis.picks.length,errors,noCollection:true,previewAndConfirm:true,overlay:true,localized:['fr','en']});
  await writeFile('artifacts/constructivist-ui-report.json',JSON.stringify(report,null,2)); console.log('CONSTRUCTIVIST_UI_OK');
} finally { await desktop.close(); }
