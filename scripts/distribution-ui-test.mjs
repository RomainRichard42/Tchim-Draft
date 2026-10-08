import { _electron as electron, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(`.test-data/distribution-ui-${Date.now()}`);await mkdir(root,{recursive:true});await mkdir('artifacts',{recursive:true});
const env={...process.env,TCHIM_DATA_DIR:root,TCHIM_TEST_HEADLESS:'1',TCHIM_DISABLE_APP_UPDATES:'1'};delete env.ELECTRON_RUN_AS_NODE;delete env.TCHIM_OFFLINE;
const executablePath=process.env.TCHIM_TEST_EXECUTABLE,launch=()=>electron.launch({args:executablePath?[]:['.'],...(executablePath?{executablePath}:{}),env,timeout:30000});
const manifest=JSON.parse(await readFile('data/shared/manifest.json','utf8')),errors=[];let desktop=await launch();
try {
  let page=await desktop.firstWindow();page.on('pageerror',error=>errors.push(error.message));await expect(page.getByTestId('app')).toBeVisible();
  await desktop.evaluate(()=>{globalThis.__distributionRequests=[];const original=globalThis.fetch;globalThis.fetch=async(...args)=>{globalThis.__distributionRequests.push(String(args[0]));return original(...args);};});
  await page.waitForTimeout(1500);let state=await page.evaluate(()=>window.draftApi.snapshot());
  expect(state.settings.dataSource).toBe('shared');expect(state.data.packs).toHaveLength(0);expect(state.data.lastRefresh).toBeUndefined();
  expect(await desktop.evaluate(()=>globalThis.__distributionRequests)).toEqual([]);
  await page.getByRole('button',{name:'Données',exact:true}).click();await expect(page.getByLabel('Source des statistiques')).toHaveValue('shared');
  const refresh=page.getByRole('button',{name:'Actualiser',exact:true}).first(),start=performance.now();await refresh.click();
  await expect.poll(async()=>{const s=await page.evaluate(()=>window.draftApi.snapshot());return !s.data.refreshing&&!!s.data.lastRefresh;},{timeout:240000,intervals:[1000,2000]}).toBe(true);
  const elapsedMs=Math.round(performance.now()-start);state=await page.evaluate(()=>window.draftApi.snapshot());
  expect(state.data.coverage).toEqual(manifest.coverage);expect(state.data.packs).toHaveLength(manifest.parts.length);expect(state.teams.ally.players).toEqual([]);expect(state.teams.enemy.players).toEqual([]);expect(state.sessions).toEqual([]);
  const requests=await desktop.evaluate(()=>globalThis.__distributionRequests),sites=requests.map(u=>new URL(u).hostname);
  expect(sites.some(h=>h==='gol.gg'||h.includes('lolalytics'))).toBe(false);
  const fileRequests=requests.filter(u=>new URL(u).hostname==='github.com'&&new URL(u).pathname.endsWith('.json.gz'));
  expect(fileRequests).toHaveLength(manifest.parts.length);
  await desktop.evaluate(()=>{globalThis.__distributionRequests=[]});await refresh.click();
  await expect.poll(async()=>(await page.evaluate(()=>window.draftApi.snapshot())).data.refreshing,{timeout:60000}).toBe(false);
  const repeat=await desktop.evaluate(()=>globalThis.__distributionRequests);expect(repeat.filter(u=>u.includes('.json.gz'))).toEqual([]);expect(repeat.filter(u=>u.includes('/img/champion/'))).toEqual([]);expect(repeat.filter(u=>u.includes('/data/fr_FR/'))).toEqual([]);
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].showInactive());await page.screenshot({path:'artifacts/distribution-data.png',fullPage:true});
  await page.getByRole('button',{name:'Draft',exact:true}).click();const analysis=await page.evaluate(()=>window.draftApi.analyze());expect(analysis.bans.length).toBeGreaterThan(0);
  const saved=await page.evaluate(()=>window.draftApi.snapshot());await desktop.close();desktop=await launch();page=await desktop.firstWindow();page.on('pageerror',error=>errors.push(error.message));await expect(page.getByTestId('app')).toBeVisible();
  await page.waitForTimeout(1500);const reopened=await page.evaluate(()=>window.draftApi.snapshot());expect(reopened.data.lastRefresh).toBe(saved.data.lastRefresh);expect(reopened.data.coverage).toEqual(saved.data.coverage);expect(reopened.data.packs).toEqual(saved.data.packs);expect(reopened.data.refreshing).toBe(false);expect(errors).toEqual([]);
  await writeFile('artifacts/distribution-report.json',JSON.stringify({executablePath,elapsedMs,source:'GitHub Releases without authentication',revision:manifest.revision,compressedBytes:manifest.parts.reduce((s,p)=>s+p.bytes,0),downloadedParts:fileRequests.length,coverage:state.data.coverage,initialStartupIdle:true,repeatDownloadsNoParts:true,repeatDownloadsNoCatalogOrIcons:true,relaunchIdle:true,privateUserDataAbsent:true,rendererErrors:errors},null,2));
  console.log(`DISTRIBUTION_OK fresh database, ${fileRequests.length} shared parts in ${elapsedMs} ms, no scraping, second refresh reuses data/catalog/icons, relaunch stays idle`);
} finally {await desktop.close();}
