import { _electron as electron,expect } from '@playwright/test';
import Database from 'better-sqlite3';
import { mkdir,cp,writeFile,stat } from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(`.test-data/manual-refresh-${Date.now()}`);await mkdir(root,{recursive:true});
const original=new Database('data/local/tchim.sqlite',{readonly:true});await original.backup(path.join(root,'tchim.sqlite'));original.close();
await cp('data/local/icons',path.join(root,'icons'),{recursive:true});await mkdir(path.join(root,'raw'),{recursive:true});
const db=new Database(path.join(root,'tchim.sqlite'));
const get=key=>JSON.parse(db.prepare('SELECT value FROM kv WHERE key = ?').get(key).value);
const put=(key,value)=>db.prepare('INSERT OR REPLACE INTO kv VALUES (?, ?)').run(key,JSON.stringify(value));
const version=get('staticVersion'),legacy={...get('settings'),scrapingEnabled:true,feedUrl:'https://example.invalid/draft.json',language:'fr'};
put('settings',legacy);put('lastRefresh','2000-01-01T00:00:00Z');
const sourceSignature=db.prepare('SELECT id, imported_at, length(raw) AS bytes FROM packs ORDER BY id').all();db.close();
const catalogFile=path.join(root,'raw',`ddragon-${version}.json`);await cp(`data/local/raw/ddragon-${version}.json`,catalogFile);
const catalogTimestamp=(await stat(catalogFile)).mtimeMs;
const env={...process.env,TCHIM_DATA_DIR:root,TCHIM_TEST_HEADLESS:'1',TCHIM_DISABLE_APP_UPDATES:'1'};delete env.ELECTRON_RUN_AS_NODE;delete env.TCHIM_OFFLINE;
const executablePath=process.env.TCHIM_TEST_EXECUTABLE;
const launch=()=>electron.launch({args:executablePath?[]:['.'],...(executablePath?{executablePath}:{}),env,timeout:30000});
const errors=[];let desktop=await launch();
try{
 let page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));await expect(page.getByTestId('app')).toBeVisible();
 const before=await page.evaluate(()=>window.draftApi.snapshot());expect(before.settings.scrapingEnabled).toBe(true);
 // No offline override: stale data and legacy enabled collection must stay idle.
 for(let i=0;i<5;i++){
  const s=await page.evaluate(()=>window.draftApi.snapshot());expect(s.data.refreshing).toBe(false);expect(s.data.lastRefresh).toBe('2000-01-01T00:00:00Z');expect(s.data.logs).toEqual(before.data.logs);
  await page.waitForTimeout(1000);
 }
 expect((await stat(catalogFile)).mtimeMs).toBe(catalogTimestamp);
 await page.getByRole('button',{name:'Données',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Actualisation manuelle',exact:true})).toBeVisible();
 await expect(page.getByText('Aucune collecte au lancement ni après une mise à jour de l’app.',{exact:false})).toBeVisible();
 // Test the real button and Data Dragon path with a deterministic main-process response.
 await desktop.evaluate((_electron,{version})=>{
  globalThis.__refreshRequests=[];
  globalThis.fetch=async url=>{
   const address=String(url);globalThis.__refreshRequests.push(address);
   if(address==='https://ddragon.leagueoflegends.com/api/versions.json')return new Response(JSON.stringify([version,'16.19.1','16.18.1']));
   throw new Error(`Unexpected download: ${address}`);
  };
 },{version});
 await page.evaluate(async()=>{const s=await window.draftApi.snapshot();await window.draftApi.settings({...s.settings,scrapingEnabled:false,feedUrl:''});});
 const refresh=page.locator('.app-header').getByRole('button',{name:'Actualiser',exact:true});
 await refresh.click();
 await expect.poll(async()=>{const s=await page.evaluate(()=>window.draftApi.snapshot());return !s.data.refreshing&&s.data.lastRefresh!=='2000-01-01T00:00:00Z';},{timeout:30000}).toBe(true);
 await refresh.click();
 await expect.poll(async()=>desktop.evaluate(()=>globalThis.__refreshRequests.length),{timeout:10000}).toBe(2);
 await expect.poll(async()=>(await page.evaluate(()=>window.draftApi.snapshot())).data.refreshing,{timeout:30000}).toBe(false);
 const requests=await desktop.evaluate(()=>globalThis.__refreshRequests);
 expect(requests).toEqual(Array(2).fill('https://ddragon.leagueoflegends.com/api/versions.json'));
 expect((await stat(catalogFile)).mtimeMs).toBe(catalogTimestamp);
 const manual=await page.evaluate(()=>window.draftApi.snapshot());expect(manual.data.logs.filter(l=>l.level==='error')).toEqual(before.data.logs.filter(l=>l.level==='error'));
 expect(manual.draft).toEqual(before.draft);expect(manual.teams).toEqual(before.teams);expect(manual.sessions).toEqual(before.sessions);
 await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].showInactive());await page.screenshot({path:'artifacts/manual-refresh-data.png',fullPage:true});
 await page.evaluate(async({legacy})=>{const s=await window.draftApi.snapshot();await window.draftApi.settings({...s.settings,scrapingEnabled:true,feedUrl:legacy.feedUrl});},{legacy});
 const preserved=await page.evaluate(()=>window.draftApi.snapshot());
 await desktop.close();desktop=await launch();page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));await expect(page.getByTestId('app')).toBeVisible();
 await page.waitForTimeout(3000);
 const reopened=await page.evaluate(()=>window.draftApi.snapshot());
 expect(reopened.data.refreshing).toBe(false);expect(reopened.data.lastRefresh).toBe(preserved.data.lastRefresh);expect(reopened.data.logs).toEqual(preserved.data.logs);
 expect(reopened.draft).toEqual(preserved.draft);expect(reopened.settings).toEqual(preserved.settings);expect(reopened.teams).toEqual(preserved.teams);expect(reopened.sessions).toEqual(preserved.sessions);
 const verify=new Database(path.join(root,'tchim.sqlite'),{readonly:true});expect(verify.prepare('SELECT id, imported_at, length(raw) AS bytes FROM packs ORDER BY id').all()).toEqual(sourceSignature);verify.close();
 expect(errors).toEqual([]);
 await writeFile('artifacts/manual-refresh-report.json',JSON.stringify({executablePath,offlineOverride:false,startupIdle:true,legacyScrapingEnabled:before.settings.scrapingEnabled,packsPreserved:sourceSignature.length,manualRequests:requests,catalogReused:true,iconsReused:true,draftPreserved:true,teamsPreserved:true,sessionsPreserved:true,relaunchIdle:true,rendererErrors:errors},null,2));
 console.log('MANUAL_REFRESH_OK idle online startup with stale data, explicit button, no redundant catalog/icons, stored packs/settings/draft/teams/sessions preserved on relaunch');
}finally{await desktop.close();}
