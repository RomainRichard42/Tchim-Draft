import {_electron as electron,expect} from '@playwright/test';
import Database from 'better-sqlite3';
import {mkdir,cp,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {dismissReleaseNotes} from './ui-helpers.mjs';
const version=JSON.parse(await readFile('package.json','utf8')).version,root=path.resolve('.test-data/competitive-'+Date.now());
await mkdir(root,{recursive:true});
const original=new Database(`data/local-preview-${version}/tchim.sqlite`,{readonly:true,fileMustExist:true});
try{await original.backup(path.join(root,'tchim.sqlite'));}finally{original.close();}
await cp(`data/local-preview-${version}/icons`,path.join(root,'icons'),{recursive:true});
const env={...process.env,TCHIM_DATA_DIR:root,TCHIM_OFFLINE:'1',TCHIM_PREVIEW:'1',TCHIM_TEST_HEADLESS:'1',TCHIM_DISABLE_APP_UPDATES:'1'};delete env.ELECTRON_RUN_AS_NODE;
const packaged=process.argv.includes('--packaged'),errors=[],report={version,packaged};let desktop,page;
async function capture(name){await desktop.evaluate(async({BrowserWindow})=>{await BrowserWindow.getAllWindows()[0].capturePage(undefined,{stayHidden:true,stayAwake:true});});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const png=await desktop.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));await writeFile('artifacts/'+name+'.png',Buffer.from(png,'base64'));}
const ready=()=>expect(page.getByTestId('decision-desk')).toHaveAttribute('aria-busy','false',{timeout:90000});
try{
 desktop=await electron.launch({...(packaged?{executablePath:path.resolve(`release/${version}-local/win-unpacked/Tchim Draft.exe`),args:[]}:{args:['.']}),env,timeout:60000});page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));
 await desktop.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.setContentSize(1500,960);win.webContents.setBackgroundThrottling(false);});
 await expect(page.getByTestId('app')).toBeVisible({timeout:90000});await dismissReleaseNotes(page);
 const initial=await page.evaluate(()=>window.draftApi.snapshot());expect(initial.preview).toBe(true);expect(initial.cloud.configured).toBe(false);
 await page.getByTestId('new-match').click();await page.getByLabel('Our team',{exact:true}).fill('ATLAS QA');await page.getByLabel('Enemy team',{exact:true}).fill('NOVA QA');await page.getByLabel('Match name',{exact:true}).fill('Test flexs et bans');await page.getByLabel('Match format',{exact:true}).selectOption('bo3');await page.getByRole('button',{name:'Créer et préparer',exact:true}).click();
 await expect(page.locator('.match-preparation')).toBeVisible();
 await page.evaluate(async()=>{
  const roles=['TOP','JUNGLE','MID','ADC','SUPPORT'],blue=[['Gragas','Gwen','Ornn','Jax'],['Gragas','Vi','Sejuani','LeeSin'],['Ahri','Orianna','Syndra'],['Jinx','Varus','Xayah'],['Lulu','Nautilus','Braum']],red=[['Camille','Renekton','Gnar'],['MonkeyKing','Nocturne','Elise'],['Akali','Azir','Viktor'],['Ashe','Ezreal','Lucian'],['Leona','Janna','Thresh']];
  const team=(name,pools)=>({url:'https://op.gg/lol/multisearch/euw?summoners=QA%23EUW',region:'euw',poolOnly:true,message:'',players:roles.map((role,i)=>({riotId:name+i+'#QA',role,status:'manual',message:'',pool:pools[i].map(championId=>({championId,role,games:0,wins:0,comfort:4}))}))});
  const snap=await window.draftApi.snapshot();await window.draftApi.settings({...snap.settings,language:'fr',theme:'dark',strategyDepth:3,proView:'fearless'});await window.draftApi.teams({ally:team('Atlas',blue),enemy:team('Nova',red)});await window.draftApi.configure({patch:'16.20',targetRole:'TOP'});
  for(let i=0;i<6;i++)await window.draftApi.select(null);
  await window.draftApi.select('Gragas','TOP');await window.draftApi.select('Akali','MID');await window.draftApi.select('Ezreal','ADC');await window.draftApi.configure({targetRole:'TOP'});
 });
 await page.getByRole('button',{name:'Ouvrir la draft',exact:true}).click();await ready();await expect(page.getByLabel('Rôle de recommandation',{exact:true})).toHaveValue('TOP');
 report.model=await page.evaluate(async()=>{const a=await window.draftApi.analyze();return {games:a.coaching.games,leagues:a.coaching.leagueCounts,currentGames:a.coaching.currentGames,gwen:a.picks.find(r=>r.championId==='Gwen'),strategy:{horizon:a.strategy.horizon,evaluated:a.strategy.evaluated,elapsedMs:a.strategy.elapsedMs}};});
 expect(report.model.games).toBe(409);expect(report.model.leagues.WORLDS).toBe(8);expect(report.model.leagues.LPL).toBe(61);expect(report.model.gwen.reassignments).toEqual([{championId:'Gragas',role:'JUNGLE'}]);
 await expect(page.getByRole('button',{name:'Préparer Gwen TOP',exact:true})).toBeVisible({timeout:30000});await capture('competitive-015-flex-dark');
 await page.getByRole('button',{name:'Préparer Gwen TOP',exact:true}).click();await expect(page.locator('.flex-change-notice')).toContainText('Gragas → JUNGLE');await page.getByRole('button',{name:'Valider',exact:true}).click();await ready();
 const picked=await page.evaluate(()=>window.draftApi.snapshot());expect(picked.draft.history[6].role).toBe('JUNGLE');expect(picked.draft.history[9]).toMatchObject({championId:'Gwen',role:'TOP'});
 await page.getByRole('button',{name:'Annuler la dernière action',exact:true}).click();await ready();const undone=await page.evaluate(()=>window.draftApi.snapshot());expect(undone.draft.history).toHaveLength(9);expect(undone.draft.history[6].role).toBe('TOP');report.flexUndo=true;
 await page.evaluate(()=>window.draftApi.configure({targetRole:'TOP'}));await ready();
 await page.getByRole('button',{name:'Fixer Gragas TOP',exact:true}).click();await ready();expect((await page.evaluate(()=>window.draftApi.analyze())).picks.map(r=>r.championId)).toEqual([]);
 await page.getByRole('button',{name:'Libérer Gragas TOP',exact:true}).click();await ready();expect((await page.evaluate(()=>window.draftApi.analyze())).picks.some(r=>r.championId==='Gwen')).toBe(true);report.roleLocks=true;
 for(const theme of ['dark','light']){
  await page.evaluate(async theme=>{const s=await window.draftApi.snapshot();await window.draftApi.settings({...s.settings,theme});},theme);await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1120,760));await ready();
  const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));expect(geometry.scroll).toBeLessThanOrEqual(geometry.width);await capture('competitive-015-small-'+theme);
 }
 report.errors=errors;expect(errors).toEqual([]);await writeFile('artifacts/competitive-ui-015-report.json',JSON.stringify(report,null,2));console.log('COMPETITIVE_DESKTOP_OK',JSON.stringify({version,packaged,games:report.model.games,leagues:report.model.leagues,flexUndo:true,roleLocks:true,errors}));
}catch(error){if(desktop)await capture('competitive-015-failure').catch(()=>{});throw error;}finally{await desktop?.close();}
