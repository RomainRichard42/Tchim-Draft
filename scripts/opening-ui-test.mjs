import {_electron as electron,expect} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createTestUsers,cleanupTestUsers} from './cloud-integration-test.mjs';
import {dismissReleaseNotes} from './ui-helpers.mjs';
const root=path.resolve('.test-data/opening-ui-'+Date.now());await mkdir(root,{recursive:true});
const version=JSON.parse(await readFile('package.json','utf8')).version,manifest=JSON.parse(await readFile('data/shared/manifest.json','utf8'));
const env={...process.env,TCHIM_DATA_DIR:root,TCHIM_TEST_HEADLESS:'1',TCHIM_DISABLE_APP_UPDATES:'1',TCHIM_OFFLINE:'0'};delete env.ELECTRON_RUN_AS_NODE;
const executablePath=process.argv.includes('--packaged')?path.resolve('release/'+version+'/win-unpacked/Tchim Draft.exe'):undefined;
let desktop;const errors=[],report={version};
async function capture(name){await desktop.evaluate(async({BrowserWindow})=>{await BrowserWindow.getAllWindows()[0].capturePage(undefined,{stayHidden:true,stayAwake:true});});const page=await desktop.firstWindow();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const base64=await desktop.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));await writeFile('artifacts/'+name+'.png',Buffer.from(base64,'base64'));}
try{
 const [user]=await createTestUsers();desktop=await electron.launch({args:executablePath?[]:['.'],...(executablePath?{executablePath}:{}),env,timeout:30000});const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));
 await desktop.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1560,1000);w.webContents.setBackgroundThrottling(false);});
 await expect(page.getByTestId('cloud-login')).toBeVisible();await page.getByLabel('Account email').fill(user.email);await page.getByLabel('Account password').fill(user.password);await page.getByRole('button',{name:'Me connecter',exact:true}).click();await expect(page.getByTestId('app')).toBeVisible({timeout:90000});await dismissReleaseNotes(page);
 await page.getByTestId('new-match').click();await page.getByLabel('Our team',{exact:true}).fill('Opening test');await page.getByLabel('Enemy team',{exact:true}).fill('Counter test');await page.getByLabel('Match format',{exact:true}).selectOption('single');await page.getByRole('button',{name:'Créer et préparer',exact:true}).click();await expect(page.locator('.match-preparation')).toBeVisible();
 const preparationStart=Date.now();await page.getByTestId('prepare-draft-data').click();await expect(page.getByTestId('prepare-draft-data')).toBeEnabled({timeout:120000});report.preparationMs=Date.now()-preparationStart;await page.getByRole('button',{name:'Ouvrir la draft',exact:true}).click();
 const readyStart=Date.now();await page.evaluate(async()=>{await window.draftApi.reset();await window.draftApi.configure({mode:'pro',side:'blue',targetRole:'AUTO',series:{format:'single',games:[]},teamNames:{ally:'Opening test',enemy:'Counter test'}});for(let i=0;i<6;i++)await window.draftApi.select(null);});
 await expect(page.getByTestId('decision-desk')).toHaveAttribute('aria-busy','false',{timeout:120000});
 report.firstContextMs=Date.now()-readyStart;
 const start=Date.now(),analysis=await page.evaluate(()=>window.draftApi.analyze()),snapshot=await page.evaluate(()=>window.draftApi.snapshot());
 expect(snapshot.cloud.revision).toBe(manifest.revision);expect(snapshot.data.coverage).toEqual(manifest.coverage);expect(analysis.picks.length).toBeGreaterThan(30);expect(analysis.picks.some(r=>r.opening?.games>=10)).toBe(true);
 report.revision=snapshot.cloud.revision;report.coverage=snapshot.data.coverage;report.analysisMs=Date.now()-start;report.top=analysis.picks.slice(0,15).map(r=>({championId:r.championId,role:r.role,score:r.score,meta:r.factors.meta,opening:r.opening,blind:r.blind?.score,roles:r.viableRoles,placements:r.alternatives}));
 await page.getByRole('button',{name:'Carte détaillée',exact:true}).click();
 const flex=analysis.picks.find(r=>r.viableRoles?.length>1&&r.alternatives?.length>1);expect(flex).toBeTruthy();
 if(analysis.picks[0].championId!==flex.championId){const row=page.locator('.face-candidate[data-champion="'+flex.championId+'"]');await row.scrollIntoViewIfNeeded();await row.locator('.face-candidate-preview').click();}
 await expect(page.getByTestId('draft-hero')).toHaveAttribute('data-champion',flex.championId);await expect(page.getByTestId('flex-placements')).toBeVisible();await expect(page.getByTestId('opening-evidence')).toContainText('FLEX');
 const alternative=flex.alternatives.find(a=>a.role!==flex.role);await page.getByTestId('flex-placements').getByRole('button',{name:new RegExp(alternative.role+'$')}).click();
 const modal=page.getByRole('dialog');await expect(modal).toBeVisible();expect(await modal.locator('.picker-footer select').inputValue()).toBe(alternative.role);await modal.locator('.picker-footer button.primary').click();
 await expect(modal).toHaveCount(0,{timeout:30000});const chosen=await page.evaluate(()=>window.draftApi.snapshot());expect(chosen.draft.history[6]).toEqual({championId:flex.championId,role:alternative.role});report.nativeFlexChoice={championId:flex.championId,role:alternative.role};
 await expect(page.getByTestId('decision-desk')).toHaveAttribute('aria-busy','false',{timeout:120000});
 const response=await page.evaluate(()=>window.draftApi.analyze());expect(response.picks.some(r=>r.championId===flex.championId)).toBe(false);expect(response.strategy.evaluated).toBeGreaterThan(0);report.respondsAfterChoice=true;
 await page.evaluate(async()=>{await window.draftApi.undo(6);});await expect(page.getByTestId('decision-desk')).toHaveAttribute('aria-busy','false',{timeout:120000});
 await capture('opening-flex-dark');
 for(const [language,theme] of [['fr','dark'],['en','light']]){
  await page.evaluate(async([language,theme])=>{const s=await window.draftApi.snapshot();await window.draftApi.settings({...s.settings,language,theme});},[language,theme]);
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1104,721));await expect(page.getByTestId('decision-desk')).toHaveAttribute('aria-busy','false',{timeout:120000});
  const geometry=await page.evaluate(()=>{const main=document.querySelector('main');const nodes=[...main.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().height&&[...e.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim()));return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,mainWidth:main.clientWidth,mainScrollWidth:main.scrollWidth,minFont:Math.min(...nodes.map(e=>parseFloat(getComputedStyle(e).fontSize)))};});
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.width);expect(geometry.mainScrollWidth).toBeLessThanOrEqual(geometry.mainWidth);expect(geometry.minFont).toBeGreaterThanOrEqual(14);report[language+'Geometry']=geometry;await capture('opening-small-'+theme);
 }
 expect(errors).toEqual([]);report.errors=errors;await writeFile('artifacts/opening-ui-report.json',JSON.stringify(report,null,2));console.log('OPENING_NATIVE_OK',JSON.stringify({...report,top:report.top.slice(0,3)}));
}catch(error){await capture('opening-failure').catch(()=>{});throw new Error(error.message.split('Call log:')[0]);}finally{if(desktop)await desktop.close();await cleanupTestUsers();}
