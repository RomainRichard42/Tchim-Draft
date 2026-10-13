import { _electron as electron, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import { mkdir, cp, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { dismissReleaseNotes } from './ui-helpers.mjs';

const version=JSON.parse(await readFile('package.json','utf8')).version;
const root=path.resolve(`.test-data/theme-ui-${Date.now()}`);await mkdir(root,{recursive:true});await mkdir('artifacts',{recursive:true});
const original=new Database('data/local/tchim.sqlite',{readonly:true});await original.backup(path.join(root,'tchim.sqlite'));original.close();
const bundledIcons=process.argv.includes('--no-icon-cache');if(!bundledIcons)await cp('data/local/icons',path.join(root,'icons'),{recursive:true});
const db=new Database(path.join(root,'tchim.sqlite')),get=key=>JSON.parse(db.prepare('SELECT value FROM kv WHERE key=?').get(key).value),set=(key,value)=>db.prepare('INSERT OR REPLACE INTO kv(key,value) VALUES (?,?)').run(key,JSON.stringify(value));
const rolePools={ally:[['TOP','Ornn','Gnar','Renekton'],['JUNGLE','Vi','Sejuani','Viego'],['MID','Orianna','Ahri','Azir'],['ADC','Xayah','Jinx','Ezreal'],['SUPPORT','Lulu','Rakan','Nautilus']],enemy:[['TOP','Renekton','Gwen','Jax'],['JUNGLE','LeeSin','Vi','XinZhao'],['MID','Ahri','Syndra','Orianna'],['ADC','Varus','Aphelios','Ezreal'],['SUPPORT','Leona','Braum','Thresh']]};
set('teams',Object.fromEntries(Object.entries(rolePools).map(([side,rows])=>[side,{url:'https://op.gg/lol/multisearch/euw?summoners='+encodeURIComponent(rows.map(([r])=>`${side}${r}#EUW`).join(',')),region:'euw',poolOnly:true,message:'Pools déclarés pour le test local',players:rows.map(([role,...ids])=>({riotId:`${side}${role}#EUW`,role,status:'manual',message:'Pool déclaré manuellement',pool:ids.map(championId=>({championId,role,games:0,wins:0}))}))}])));
const picks={blue:[['Ornn','TOP'],['Vi','JUNGLE'],['Orianna','MID'],['Lulu','SUPPORT']],red:[['Renekton','TOP'],['LeeSin','JUNGLE'],['Ahri','MID'],['Varus','ADC']]};
const bans=['Jax','Maokai','Azir','Rakan','Kalista','Draven','Camille','Sejuani','Syndra','Nautilus'];
const history=['ban','ban','ban','ban','ban','ban','blue','red','red','blue','blue','red','ban','ban','ban','ban','red','blue'].map(side=>{if(side==='ban')return{championId:bans.shift()};const [championId,role]=picks[side].shift();return{championId,role};});
set('draft',{...get('draft'),mode:'pro',side:'blue',targetRole:'ADC',league:'all',series:{format:'bo3',games:[]},history});
set('settings',{...get('settings'),theme:'dark',language:'fr',poolOnly:false,pool:{Xayah:5,Jinx:4,Ezreal:3,Orianna:4,Lulu:3,Ornn:4,Vi:3}});db.close();
const executablePath=process.env.TCHIM_TEST_EXECUTABLE||(process.argv.includes('--packaged')?path.resolve(`release/${version}/win-unpacked/Tchim Draft.exe`):undefined);
const env={...process.env,TCHIM_DATA_DIR:root,TCHIM_OFFLINE:'1',TCHIM_DISABLE_APP_UPDATES:'1',TCHIM_TEST_HEADLESS:''};delete env.ELECTRON_RUN_AS_NODE;
let desktop;const errors=[],externalImages=[],report={version,packaged:!!executablePath,pages:{}};
const launch=async()=>{desktop=await electron.launch({args:executablePath?[]:['.'],...(executablePath?{executablePath}:{}),env,timeout:30000});const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.resourceType()==='image'&&/^https?:/.test(r.url()))externalImages.push(r.url());});await desktop.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setContentSize(1920,1080);});await expect(page.getByTestId('app')).toBeVisible({timeout:30000});await dismissReleaseNotes(page);return page;};
const capture=async name=>{const main=desktop.windows()[0];await main.mouse.move(1900,65);await expect(main.locator('.focus-nav button.active')).toHaveCSS('background-color','rgb(46, 101, 255)');await desktop.evaluate(async({BrowserWindow})=>{await BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('overlay=1')).capturePage(undefined,{stayHidden:true,stayAwake:true});});await main.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const png=await desktop.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('overlay=1')).capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));await writeFile(`artifacts/${name}.png`,Buffer.from(png,'base64'));};
const geometry=page=>page.evaluate(()=>{const main=document.querySelector('main'),r=main.getBoundingClientRect();const text=[...main.querySelectorAll('*')].filter(e=>[...e.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim())&&e.getBoundingClientRect().height&&getComputedStyle(e).display!=='none');return{width:innerWidth,documentWidth:document.documentElement.scrollWidth,mainWidth:r.width,mainScrollWidth:main.scrollWidth,minFont:Math.min(...text.map(e=>parseFloat(getComputedStyle(e).fontSize))),background:getComputedStyle(main).backgroundColor,broken:[...main.querySelectorAll('img')].filter(e=>e.getBoundingClientRect().height&&e.complete&&!e.naturalWidth).map(e=>e.src)};});
try{
 let page=await launch();await expect(page.getByTestId('decision-desk')).toHaveAttribute('aria-busy','false',{timeout:30000});if(bundledIcons)await expect.poll(()=>page.locator('main img').evaluateAll(imgs=>imgs.filter(i=>i.naturalWidth&&i.src.includes('/icons/')).length)).toBeGreaterThanOrEqual(18);
 const before=await page.evaluate(()=>window.draftApi.snapshot());
 for(const [id,label]of[['draft','Draft'],['teams','Équipes'],['pool','Mon pool'],['data','Données'],['settings','Paramètres'],['simulations','Simulations']]){
  await page.getByRole('navigation').getByRole('button',{name:label,exact:true}).click();await capture(`dark-${id}`);const g=await geometry(page);report.pages[id]=g;console.log('THEME_PAGE',id,JSON.stringify(g));
  expect(g.documentWidth).toBeLessThanOrEqual(g.width);expect(g.mainScrollWidth).toBeLessThanOrEqual(Math.ceil(g.mainWidth));expect(g.minFont).toBeGreaterThanOrEqual(14);expect(g.background).toBe('rgb(20, 20, 20)');expect(g.broken).toEqual([]);
 }
 await page.getByRole('navigation').getByRole('button',{name:'Équipes',exact:true}).click();
 await expect(page.locator('.scouting-player')).toHaveCount(10);await expect(page.locator('.teams-ready .primary')).toHaveCount(1);
 const player=page.getByTestId('scouting-ally').locator('.scouting-player').first();await player.getByRole('button',{name:'Développer',exact:true}).click();
 await player.getByLabel('allyTOP#EUW champion',{exact:true}).fill('Gwen');await player.locator('.manual-pool-entry').getByRole('button',{name:'+',exact:true}).click();
 await expect.poll(async()=> (await page.evaluate(()=>window.draftApi.snapshot())).teams.ally.players[0].pool.some(c=>c.championId==='Gwen')).toBe(true);
 await player.getByRole('button',{name:'Réduire',exact:true}).click();await page.locator('.teams-ready .primary').click();await expect(page.getByTestId('draft-hero')).toBeVisible();
 await page.getByRole('navigation').getByRole('button',{name:'Mon pool',exact:true}).click();const card=page.locator('.pool-card').filter({has:page.getByText('Xayah',{exact:true})});await card.getByRole('button',{name:'Xayah 4/5',exact:true}).click();await expect.poll(async()=>(await page.evaluate(()=>window.draftApi.snapshot())).settings.pool.Xayah).toBe(4);
 await page.getByRole('navigation').getByRole('button',{name:'Paramètres',exact:true}).click();
 const weights=(await page.evaluate(()=>window.draftApi.snapshot())).settings.weights;const slider=page.getByRole('slider',{name:'Matchups',exact:true});await slider.focus();await slider.press('ArrowRight');const edited=Number(await slider.inputValue());
 await page.getByTestId('theme-light').click();await expect(page.getByTestId('app')).toHaveAttribute('data-theme','light');await expect(slider).toHaveValue(String(edited));
 expect((await page.evaluate(()=>window.draftApi.snapshot())).settings.weights).toEqual(weights);
 for(const [id,label]of[['draft','Draft'],['teams','Équipes'],['pool','Mon pool'],['data','Données'],['settings','Paramètres'],['simulations','Simulations']]){await page.getByRole('navigation').getByRole('button',{name:label,exact:true}).click();await capture(`light-${id}`);const g=await geometry(page);expect(g.background).toBe('rgb(239, 228, 205)');expect(g.minFont).toBeGreaterThanOrEqual(14);expect(g.broken).toEqual([]);}
 await page.getByRole('navigation').getByRole('button',{name:'Paramètres',exact:true}).click();await expect(slider).toHaveValue(String(edited));
 await page.getByTestId('open-release-notes').click();await expect(page.getByTestId('release-notes')).toBeVisible();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'English',exact:true}).click();await expect(page.getByTestId('theme-light')).toContainText('Light');await expect(slider).toHaveValue(String(edited));
 await page.getByRole('button',{name:'Français',exact:true}).click();
 const windowEvent=desktop.waitForEvent('window');await page.getByRole('button',{name:'Overlay',exact:true}).click();const overlay=await windowEvent;await expect(overlay.getByTestId('app')).toHaveAttribute('data-theme','light');
 await page.getByTestId('theme-dark').click();await expect(overlay.getByTestId('app')).toHaveAttribute('data-theme','dark');await page.evaluate(()=>window.draftApi.overlay());
 await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1104,721));
 for(const label of ['Équipes','Mon pool','Données','Paramètres','Simulations']){await page.getByRole('navigation').getByRole('button',{name:label,exact:true}).click();const g=await geometry(page);console.log('SMALL_PAGE',label,JSON.stringify(g));expect(g.mainScrollWidth).toBeLessThanOrEqual(Math.ceil(g.mainWidth));expect(g.minFont).toBeGreaterThanOrEqual(14);}
 await page.getByRole('navigation').getByRole('button',{name:'Paramètres',exact:true}).click();await page.getByTestId('theme-light').click();await desktop.close();desktop=undefined;
 page=await launch();await expect(page.getByTestId('app')).toHaveAttribute('data-theme','light');
 const after=await page.evaluate(()=>window.draftApi.snapshot());expect(after.draft).toEqual(before.draft);expect(after.settings.weights).toEqual(weights);expect(after.data.refreshing).toBe(false);expect(externalImages).toEqual([]);expect(errors).toEqual([]);
 Object.assign(report,{persisted:true,overlaySynced:true,weightsPreserved:true,draftPreserved:true,editablePools:true,bundledIcons,noExternalImages:true,errors});await writeFile('artifacts/theme-ui-report.json',JSON.stringify(report,null,2));console.log('THEME_UI_OK');
}finally{if(desktop)await desktop.close();}
