import { dismissReleaseNotes } from './ui-helpers.mjs';
import { _electron as electron, expect } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';

const executablePath=process.env.TCHIM_TEST_EXECUTABLE;if(!executablePath)throw Error('Set TCHIM_TEST_EXECUTABLE to the packaged app');
const root=path.resolve(`.test-data/github-updates-${Date.now()}`);await mkdir(root,{recursive:true});await mkdir('artifacts',{recursive:true});
const env={...process.env,TCHIM_DATA_DIR:root,TCHIM_TEST_HEADLESS:'1'};delete env.ELECTRON_RUN_AS_NODE;delete env.TCHIM_OFFLINE;delete env.TCHIM_DISABLE_APP_UPDATES;
const desktop=await electron.launch({args:[],executablePath,env,timeout:30000}),errors=[];
try {
  const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));await expect(page.getByTestId('app')).toBeVisible();
  await dismissReleaseNotes(page);
  await expect.poll(async()=>(await page.evaluate(()=>window.draftApi.snapshot())).update,{timeout:60000,intervals:[500,1000,2000]}).toBe('current');
  const state=await page.evaluate(()=>window.draftApi.snapshot());expect(state.data.packs).toEqual([]);expect(state.data.lastRefresh).toBeUndefined();expect(state.data.refreshing).toBe(false);
  await page.getByRole('button',{name:'Paramètres',exact:true}).click();await expect(page.getByText('Application à jour',{exact:true})).toBeVisible();await expect(page.getByText('Vérification au lancement et toutes les 4 h, téléchargement automatique. Les statistiques restent actualisées sur clic.')).toBeVisible();
  await page.getByRole('button',{name:'Vérifier',exact:true}).click();await expect.poll(async()=>(await page.evaluate(()=>window.draftApi.snapshot())).update,{timeout:60000}).toBe('current');
  expect(errors).toEqual([]);
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].showInactive());await page.screenshot({path:'artifacts/github-updates.png',fullPage:true});
  await writeFile('artifacts/github-updates-report.json',JSON.stringify({executablePath,automaticStartupCheck:'current',manualCheck:'current',stableReleaseExcludesDataset:true,statisticsStartupIdle:true,rendererErrors:errors},null,2));
  console.log('GITHUB_UPDATES_OK automatic startup and manual check find the stable app release; dataset prerelease excluded; statistics stay idle');
} finally {await desktop.close();}
