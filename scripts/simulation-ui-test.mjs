import { dismissReleaseNotes } from './ui-helpers.mjs';
import { _electron as electron, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import { mkdir, cp, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
const real=process.env.TCHIM_TEST_REAL==='1'||process.argv.includes('--real'),root=path.resolve(`.test-data/simulation-${Date.now()}`);
await mkdir(root,{recursive:true});await mkdir('artifacts',{recursive:true});
if(real){const source=new Database('data/local/tchim.sqlite',{readonly:true});await source.backup(path.join(root,'tchim.sqlite'));source.close();await cp('data/local/icons',path.join(root,'icons'),{recursive:true});}
const env={...process.env,TCHIM_DATA_DIR:root,TCHIM_OFFLINE:'1',TCHIM_TEST_HEADLESS:'',TCHIM_DISABLE_APP_UPDATES:'1'};delete env.ELECTRON_RUN_AS_NODE;
const version=JSON.parse(await readFile('package.json','utf8')).version;
const executablePath=process.env.TCHIM_TEST_EXECUTABLE||(process.argv.includes('--packaged')?path.resolve(`release/${version}/win-unpacked/Tchim Draft.exe`):undefined);
const desktop=await electron.launch({args:executablePath?[]:['.'],...(executablePath?{executablePath}:{}),env,timeout:30000});
const errors=[],report={real};
async function capture(page,name){
  await desktop.evaluate(async({BrowserWindow})=>{await BrowserWindow.getAllWindows()[0].capturePage(undefined,{stayHidden:true,stayAwake:true});});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const png=await desktop.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));
  await writeFile(`artifacts/${name}.png`,Buffer.from(png,'base64'));
}
try{
  const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(message.text().startsWith('BENCHMARK_PROGRESS'))console.log(message.text());});
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
  await expect(page.getByTestId('app')).toBeVisible({timeout:30000});
  await dismissReleaseNotes(page);
  await page.evaluate(async()=>{
    const api=window.draftApi;await api.reset();const snapshot=await api.snapshot();
    await api.settings({...snapshot.settings,language:'fr',poolOnly:false});
    const team={url:'',region:'euw',players:[],poolOnly:false,message:''};await api.teams({ally:team,enemy:team});
    await api.configure({mode:'pro',side:'blue',targetRole:'AUTO',series:{format:'single',games:[]}});
    for(let i=0;i<6;i++)await api.select(null);
  });
  const live=await page.evaluate(()=>window.draftApi.snapshot());
  await page.getByRole('button',{name:'Simulations',exact:true}).click();
  await page.getByTestId('simulation-workshop-mode').click();
  await expect(page.getByTestId('simulation-studio')).toBeVisible();
  await page.getByRole('button',{name:'Chronologie',exact:true}).click();
  // Chromium DataTransfer exercises the actual production drag/drop handlers.
  const data=await page.evaluateHandle(()=>{const data=new DataTransfer();data.setData('application/x-tchim-champion',JSON.stringify({championId:'Ahri',role:'MID'}));return data;});
  await page.getByTestId('sim-step-19').dispatchEvent('dragover',{dataTransfer:data});await page.getByTestId('sim-step-19').dispatchEvent('drop',{dataTransfer:data});
  await expect(page.getByTestId('sim-step-19')).toContainText('Ahri');
  await expect(page.locator('.sim-error')).toHaveCount(0);
  const start=Date.now();await page.getByRole('button',{name:'Explorer les suites',exact:true}).click();
  await expect(page.getByTestId('simulation-branch')).toHaveCount(12,{timeout:180000});
  report.twelveMs=Date.now()-start;
  await expect(page.getByTestId('sim-step-19')).toContainText('Ahri');
  await expect(page.locator('.sim-context')).toContainText('1 verrouillages');
  await page.locator('.sim-compare-check input').nth(0).check();await page.locator('.sim-compare-check input').nth(1).check();
  await page.getByRole('button',{name:'Comparer (2)',exact:true}).click();await expect(page.locator('.sim-comparison>.comparison')).toHaveCount(2);
  await capture(page,'simulations-compare');
  await page.getByRole('button',{name:'Face à face',exact:true}).click();
  await expect(page.locator('.sim-board .sim-slot')).toHaveCount(20);
  await page.getByRole('textbox',{name:'Nom de la simulation',exact:true}).fill('Worlds · Ahri R5');
  await page.locator('.sim-command-bar').getByRole('button',{name:'Sauvegarder',exact:true}).click();
  await expect(page.locator('.sim-saved')).toContainText('Worlds · Ahri R5');
  const saved=await page.evaluate(()=>window.draftApi.snapshot());
  expect(saved.draft).toEqual(live.draft);expect(saved.settings).toEqual(live.settings);expect(saved.teams).toEqual(live.teams);expect(saved.data.packs).toEqual(live.data.packs);
  const id=saved.simulations.find(s=>s.name==='Worlds · Ahri R5').id;
  const stored=await page.evaluate(id=>window.draftApi.loadSimulation(id),id);expect(stored.history).toHaveLength(20);expect(stored.pins[0].selection.championId).toBe('Ahri');
  // Scope Ctrl+Z to the simulation, so it cannot undo the actual draft.
  await page.locator('.sim-canvas').click({position:{x:5,y:5}});await page.keyboard.press('Control+z');
  expect((await page.evaluate(()=>window.draftApi.snapshot())).draft).toEqual(live.draft);
  await page.getByRole('button',{name:'Dupliquer',exact:true}).click();await expect(page.locator('.sim-context')).toContainText('14 verrouillages');
  await page.getByRole('button',{name:'Déverrouiller B1',exact:true}).click();await expect(page.locator('.sim-context')).toContainText('13 verrouillages');
  await page.getByRole('button',{name:'Compléter ma branche',exact:true}).click();await expect(page.getByTestId('simulation-branch')).toHaveCount(1,{timeout:180000});
  await page.getByRole('button',{name:'Draft libre',exact:true}).click();await expect(page.locator('.sim-context')).toContainText('0 étapes de départ');
  await page.locator('.sim-saved>div>button:first-child').filter({hasText:'Worlds · Ahri R5'}).click();await expect(page.getByTestId('simulation-branch')).toHaveCount(1,{timeout:180000});await expect(page.getByTestId('sim-step-19')).toContainText('Ahri');
  await page.getByRole('button',{name:'Explorer les suites',exact:true}).click();await expect(page.getByTestId('simulation-branch')).toHaveCount(12,{timeout:180000});
  await capture(page,'simulations-desktop');
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1104,721));
  await capture(page,'simulations-desktop-small');
  const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,toolbar:document.querySelector('.sim-command-bar').getBoundingClientRect().toJSON(),picker:document.querySelector('.sim-picker').getBoundingClientRect().toJSON()}));
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.width);report.bounds=bounds;
  // 48 branches, real source data, while main IPC remains responsive.
  console.log('SIMULATION_EDITOR_OK: drag/drop, compare, save, fork, reload, isolated live draft');
  const benchmark=await Promise.race([page.evaluate(async()=>{
    const state=await window.draftApi.snapshot(),draft={...state.draft,targetRole:'AUTO'};
    let heartbeats=0;const timer=setInterval(()=>{void window.draftApi.snapshot().then(()=>heartbeats++);},1200);
    const unsubscribe=window.draftApi.onSimulationProgress(p=>{if(p.id==='benchmark-48'&&p.completed%8===0)console.log('BENCHMARK_PROGRESS',p.completed);});
    const start=performance.now();const result=await window.draftApi.simulate({id:'benchmark-48',draft,pins:[{index:19,selection:{championId:'Ahri',role:'MID'}}],count:48,seed:12});clearInterval(timer);unsubscribe();
    return {branches:result.branches.length,complete:result.branches.filter(b=>b.status==='complete').length,elapsedMs:Math.round(performance.now()-start),engineMs:result.elapsedMs,heartbeats,unique:new Set(result.branches.map(b=>JSON.stringify(b.history))).size};
  }),new Promise((_,reject)=>{const timeout=setTimeout(()=>reject(new Error('48-branch benchmark exceeded 60 seconds')),60000);timeout.unref();})]);
  expect(benchmark.branches).toBe(48);expect(benchmark.complete).toBe(48);expect(benchmark.unique).toBe(48);report.benchmark=benchmark;console.log('SIMULATION_BENCHMARK',JSON.stringify(benchmark));
  // Cancellation is explicit, never applies a partial branch to the live draft.
  await page.evaluate(async()=>{
    const s=await window.draftApi.snapshot();const generation=window.draftApi.simulate({id:'cancel-test',draft:{...s.draft,history:[]},pins:[],count:48,seed:99}).catch(e=>String(e));
    await new Promise(r=>setTimeout(r,30));await window.draftApi.cancelSimulation('cancel-test');const result=await generation;if(typeof result!=='string'||!result.includes('cancelled'))throw new Error('Cancellation failed');
  });
  await page.evaluate(async()=>{const s=await window.draftApi.snapshot();await window.draftApi.settings({...s.settings,language:'en'});});
  await expect(page.getByRole('button',{name:'Complete my branch',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Imagine. Lock. Explore.'})).toBeVisible();
  // Saved records survive an independent storage instance; invalid or conflicting locks fail at IPC.
  const reopened=new Database(path.join(root,'tchim.sqlite'),{readonly:true}),persisted=reopened.prepare('SELECT name FROM simulations').all();reopened.close();
  expect(persisted.some(s=>s.name==='Worlds · Ahri R5')).toBe(true);
  const rejected=await page.evaluate(async()=>{try{const s=await window.draftApi.snapshot();await window.draftApi.simulate({id:'invalid',draft:s.draft,pins:[{index:6,selection:{championId:'Ahri',role:'MID'}},{index:9,selection:{championId:'Orianna',role:'MID'}}],count:1,seed:1});return false;}catch{return true;}});expect(rejected).toBe(true);
  await page.getByRole('button',{name:'Delete Worlds · Ahri R5',exact:true}).click();
  expect((await page.evaluate(()=>window.draftApi.snapshot())).simulations.some(s=>s.id===id)).toBe(false);
  expect((await page.evaluate(()=>window.draftApi.snapshot())).draft).toEqual(live.draft);
  expect(errors).toEqual([]);report.errors=errors;
  await writeFile('artifacts/simulation-ui-report.json',JSON.stringify(report,null,2));console.log('SIMULATION_UI_OK',JSON.stringify(report));
}finally{await desktop.close();}
