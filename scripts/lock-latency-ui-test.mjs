import {_electron as electron,expect} from '@playwright/test';
import Database from 'better-sqlite3';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
import {dismissReleaseNotes} from './ui-helpers.mjs';
const root=path.resolve('.test-data/lock-latency-'+Date.now());await mkdir(root,{recursive:true});
const directory='data/shared-20261025',manifest=JSON.parse(await readFile(directory+'/manifest.json','utf8'));
const db=new Database(path.join(root,'tchim.sqlite'));
db.exec('CREATE TABLE kv(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE champions(id TEXT PRIMARY KEY,json TEXT NOT NULL); CREATE TABLE packs(id TEXT PRIMARY KEY,raw TEXT NOT NULL,imported_at TEXT NOT NULL);');
db.prepare('INSERT INTO kv VALUES (?,?)').run('staticVersion',JSON.stringify(manifest.staticVersion));
db.transaction(()=>{const insert=db.prepare('INSERT INTO champions VALUES (?,?)');for(const c of manifest.champions)insert.run(c.id,JSON.stringify(c));})();
for(const part of manifest.parts){const raw=gunzipSync(await readFile(directory+'/'+part.sha256+'.json.gz')).toString(),pack=JSON.parse(raw);db.prepare('INSERT INTO packs VALUES (?,?,?)').run(pack.id,raw,pack.createdAt);}db.close();
const env={...process.env,TCHIM_DATA_DIR:root,TCHIM_OFFLINE:'1',TCHIM_TEST_HEADLESS:'1',TCHIM_DISABLE_APP_UPDATES:'1'};delete env.ELECTRON_RUN_AS_NODE;
const executablePath=process.env.TCHIM_TEST_EXECUTABLE;
const desktop=await electron.launch({args:executablePath?[]:['.'],...(executablePath?{executablePath:path.resolve(executablePath)}:{}),env,timeout:60000}),errors=[];let page;
try{
 page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));await expect(page.getByTestId('app')).toBeVisible({timeout:60000});await dismissReleaseNotes(page);
 await page.getByTestId('new-match').click();await page.getByLabel('Our team',{exact:true}).fill('Latency blue');await page.getByLabel('Enemy team',{exact:true}).fill('Latency red');await page.getByRole('button',{name:'Créer et préparer',exact:true}).click();await expect(page.locator('.match-preparation')).toBeVisible();
 await page.evaluate(async()=>{await window.draftApi.configure({patch:'16.21',series:{format:'single',games:[]}});for(let i=0;i<6;i++)await window.draftApi.select(null);});
 await page.getByRole('button',{name:'Ouvrir la draft',exact:true}).click();
 await expect(page.getByTestId('decision-desk')).toHaveAttribute('aria-busy','true');
 // Manual decisions remain available during a genuine full-dataset worker calculation.
 await expect(page.locator('.manual-choice')).toBeEnabled();await page.locator('.manual-choice').click();await page.locator('.champion-option').filter({has:page.getByText('Gragas',{exact:true})}).click();await page.locator('.picker-footer select').selectOption('TOP');
 await page.evaluate(()=>window.draftApi.configure({targetRole:'MID'}));await expect(page.getByTestId('decision-desk')).toHaveAttribute('aria-busy','true');
 const confirmingWhileAnalyzing=await page.getByTestId('decision-desk').getAttribute('aria-busy')==='true';
 // Measure from the delivered click, not Playwright's visibility/stability polling.
 await page.evaluate(()=>{window.__lockTiming={};document.addEventListener('click',event=>{if(!event.target.closest('.picker-footer button.primary'))return;window.__lockTiming.start=performance.now();const observer=new MutationObserver(()=>{if(!document.querySelector('.champion-grid')){window.__lockTiming.elapsed=performance.now()-window.__lockTiming.start;observer.disconnect();}});observer.observe(document.body,{childList:true,subtree:true});},{capture:true,once:true});});
 const start=Date.now();await page.getByRole('button',{name:'Valider',exact:true}).click();await expect(page.locator('.champion-grid')).toHaveCount(0);const automationWaitMs=Date.now()-start,visibleCommitMs=await page.evaluate(()=>window.__lockTiming.elapsed);
 expect((await page.evaluate(()=>window.draftApi.snapshot())).draft.history[6]).toMatchObject({championId:'Gragas',role:'TOP'});expect(confirmingWhileAnalyzing).toBe(true);expect(visibleCommitMs).toBeLessThan(2000);
 const ipc=await page.evaluate(async()=>{const readings=[];for(const [id,role] of [['Ahri','MID'],['Jinx','ADC'],['Vi','JUNGLE']]){const start=performance.now();await window.draftApi.select(id,role);readings.push(performance.now()-start);}return readings;});
 const history=(await page.evaluate(()=>window.draftApi.snapshot())).draft.history;expect(history).toHaveLength(10);expect(history.at(-1)).toMatchObject({championId:'Vi',role:'JUNGLE'});
 const undoStart=Date.now();await page.getByRole('button',{name:'Annuler la dernière action',exact:true}).click();expect((await page.evaluate(()=>window.draftApi.snapshot())).draft.history).toHaveLength(9);const undoMs=Date.now()-undoStart;
 expect(Math.max(...ipc)).toBeLessThan(5000);expect(errors).toEqual([]);
 await desktop.evaluate(async({BrowserWindow})=>{await BrowserWindow.getAllWindows()[0].capturePage(undefined,{stayHidden:true,stayAwake:true});});
 const png=await desktop.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));await writeFile('artifacts/lock-latency-ui.png',Buffer.from(png,'base64'));
 const version=await desktop.evaluate(({app})=>app.getVersion());
 const report={version,packaged:!!executablePath,dataset:manifest.revision,confirmingWhileAnalyzing,visibleCommitMs,automationWaitMs,ipcCommitMs:ipc,undoMs,errors};await writeFile('artifacts/lock-latency-ui.json',JSON.stringify(report,null,2));console.log('LOCK_LATENCY_UI_OK',JSON.stringify(report));
}catch(error){if(page)console.log('LOCK_TEST_DIAGNOSTIC',JSON.stringify({alerts:await page.locator('.error-inline').allTextContents()}));throw error;}finally{await desktop.close();}
