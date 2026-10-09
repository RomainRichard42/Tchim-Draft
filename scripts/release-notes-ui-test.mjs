import { _electron as electron, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
const version=JSON.parse(await readFile('package.json','utf8')).version;
const root=path.resolve(`.test-data/release-notes-ui-${Date.now()}`);await mkdir(root,{recursive:true});await mkdir('artifacts',{recursive:true});
const executablePath=process.env.TCHIM_TEST_EXECUTABLE||(process.argv.includes('--packaged')?path.resolve(`release/${version}/win-unpacked/Tchim Draft.exe`):undefined);
const env={...process.env,TCHIM_DATA_DIR:root,TCHIM_TEST_HEADLESS:'1',TCHIM_OFFLINE:'1',TCHIM_DISABLE_APP_UPDATES:'1'};delete env.ELECTRON_RUN_AS_NODE;
const errors=[],report={version};let desktop;
const launch=async()=>{desktop=await electron.launch({args:executablePath?[]:['.'],...(executablePath?{executablePath}:{}),env,timeout:30000});const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));await expect(page.getByTestId('app')).toBeVisible();return page;};
const capture=async(name,page)=>{
 await desktop.evaluate(async({BrowserWindow})=>{await BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('overlay=1')).capturePage(undefined,{stayHidden:true,stayAwake:true});});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const png=await desktop.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('overlay=1')).capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));
 await writeFile(`artifacts/${name}.png`,Buffer.from(png,'base64'));
};
try{
 let page=await launch();
 await expect(page.getByRole('dialog',{name:'Nouveautés de Tchim Draft',exact:true})).toBeVisible();
 await expect(page.getByTestId('release-notes')).toContainText('Ta draft prend vie');
 await expect(page.locator('.release-entry')).toHaveCount(1);
 const before=await page.evaluate(()=>window.draftApi.snapshot());
 // Keyboard cannot edit the underlying draft while the introduction is open.
 await page.keyboard.press('Control+z');await page.keyboard.press('Control+1');
 expect((await page.evaluate(()=>window.draftApi.snapshot())).draft).toEqual(before.draft);
 expect((await page.evaluate(()=>window.draftApi.releaseNotes())).pending).toBe(true);
 await capture('release-notes-desktop',page);
 await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1104,721));
 await capture('release-notes-small',page);
 const layout=await page.getByRole('dialog').evaluate(el=>{const bounds=el.getBoundingClientRect();const close=el.querySelector('[data-testid=release-notes-close]').getBoundingClientRect();return {x:bounds.x,y:bounds.y,right:bounds.right,bottom:bounds.bottom,width:innerWidth,height:innerHeight,closeBottom:close.bottom};});
 expect(layout.x).toBeGreaterThanOrEqual(0);expect(layout.y).toBeGreaterThanOrEqual(0);expect(layout.right).toBeLessThanOrEqual(layout.width);expect(layout.bottom).toBeLessThanOrEqual(layout.height);expect(layout.closeBottom).toBeLessThanOrEqual(layout.height);report.minimumLayout=layout;
 // Plain-text history includes the simulation update, without technical changelog jargon.
 await page.getByRole('button',{name:'Voir l’historique',exact:true}).click();await expect(page.locator('.release-entry')).toHaveCount(5);await expect(page.getByTestId('release-notes')).toContainText('48 drafts différentes');
 await page.getByTestId('release-notes-close').click();await expect(page.getByTestId('release-notes')).toHaveCount(0);
 expect((await page.evaluate(()=>window.draftApi.releaseNotes())).pending).toBe(false);
 expect(await page.evaluate(()=>window.draftApi.snapshot())).toEqual(before);
 // Close and reopen: acknowledgement is persistent, not renderer-local state.
 await desktop.close();desktop=undefined;page=await launch();
 expect((await page.evaluate(()=>window.draftApi.releaseNotes())).pending).toBe(false);await expect(page.getByTestId('release-notes')).toHaveCount(0);
 await page.getByRole('button',{name:'Paramètres',exact:true}).click();await page.getByTestId('open-release-notes').click();await expect(page.getByTestId('release-notes')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByTestId('release-notes')).toHaveCount(0);
 await page.getByRole('button',{name:'English',exact:true}).click();await page.getByTestId('open-release-notes').click();
 await expect(page.getByRole('dialog',{name:'What is new in Tchim Draft',exact:true})).toBeVisible();await expect(page.getByTestId('release-notes')).toContainText('Your draft comes to life');
 await page.getByTestId('release-notes-close').click();
 // Overlay never shows the introduction.
 const next=desktop.waitForEvent('window');await page.evaluate(()=>window.draftApi.overlay());const overlay=await next;await expect(overlay.getByTestId('app')).toBeVisible();await expect(overlay.getByTestId('release-notes')).toHaveCount(0);await page.evaluate(()=>window.draftApi.overlay());
 const spoof=await page.evaluate(async()=>{try{await window.draftApi.acknowledgeReleaseNotes('999.0.0');return false;}catch{return true;}});expect(spoof).toBe(true);
 await desktop.close();desktop=undefined;
 // Simulate a real user who last read 0.9.0 and skips directly to the current build.
 const file=path.join(root,'tchim.sqlite'),db=new Database(file);db.prepare('UPDATE kv SET value=? WHERE key=?').run(JSON.stringify('0.9.0'),'releaseNotesSeenVersion');db.close();
 page=await launch();await expect(page.getByTestId('release-notes')).toBeVisible();await expect(page.locator('.release-entry')).toHaveCount(4);await expect(page.getByTestId('release-notes')).toContainText('since version 0.9.0');
 await page.keyboard.press('Escape');await expect(page.getByTestId('release-notes')).toHaveCount(0);
 expect((await page.evaluate(()=>window.draftApi.releaseNotes())).lastSeenVersion).toBe(version);
 expect(errors).toEqual([]);report.errors=errors;report.persistentAcknowledgement=true;report.skippedVersions=true;report.overlaySuppressed=true;
 await writeFile('artifacts/release-notes-ui-report.json',JSON.stringify(report,null,2));console.log('RELEASE_NOTES_UI_OK',JSON.stringify(report));
}finally{if(desktop)await desktop.close();}
