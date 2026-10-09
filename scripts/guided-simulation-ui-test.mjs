import { _electron as electron, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dismissReleaseNotes } from './ui-helpers.mjs';
const real=process.argv.includes('--real'),version=JSON.parse(await readFile('package.json','utf8')).version;
const root=path.resolve('.test-data/guided-ui-'+Date.now());await mkdir(root,{recursive:true});await mkdir('artifacts',{recursive:true});
if(real){const source=new Database('data/local/tchim.sqlite',{readonly:true});await source.backup(path.join(root,'tchim.sqlite'));source.close();await cp('data/local/icons',path.join(root,'icons'),{recursive:true});}
const executablePath=process.argv.includes('--packaged')?path.resolve('release/'+version+'/win-unpacked/Tchim Draft.exe'):undefined;
const env={...process.env,TCHIM_DATA_DIR:root,TCHIM_OFFLINE:'1',TCHIM_DISABLE_APP_UPDATES:'1',TCHIM_TEST_HEADLESS:''};delete env.ELECTRON_RUN_AS_NODE;
const desktop=await electron.launch({args:executablePath?[]:['.'],...(executablePath?{executablePath}:{}),env,timeout:30000});
const errors=[],report={version,real,packaged:!!executablePath};
async function capture(page,name){
  await desktop.evaluate(async({BrowserWindow})=>{await BrowserWindow.getAllWindows()[0].capturePage(undefined,{stayHidden:true,stayAwake:true});});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const png=await desktop.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));
  await writeFile('artifacts/'+name+'.png',Buffer.from(png,'base64'));
}
try{
  const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));
  const externalImages=[];page.on('request',r=>{if(r.resourceType()==='image'&&/^https?:/.test(r.url()))externalImages.push(r.url());});
  await page.evaluate(()=>{window.__championFlights=0;new MutationObserver(changes=>{for(const change of changes)for(const node of change.addedNodes)if(node instanceof Element&&node.matches('[data-testid="champion-flight"]'))window.__championFlights++;}).observe(document.body,{childList:true});});
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
  await expect(page.getByTestId('app')).toBeVisible();await dismissReleaseNotes(page);
  await page.evaluate(async()=>{
    const s=await window.draftApi.snapshot(),team={url:'',region:'euw',players:[],message:'',poolOnly:false};
    await window.draftApi.teams({ally:team,enemy:team});await window.draftApi.reset();
    await window.draftApi.settings({...s.settings,language:'fr',poolOnly:false});
    await window.draftApi.configure({mode:'pro',side:'blue',series:{format:'single',games:[]}});
    for(let i=0;i<6;i++)await window.draftApi.select(null);
  });
  await page.getByRole('button',{name:'Simulations',exact:true}).click();await expect(page.getByTestId('guided-setup')).toBeVisible();
  await expect(page.getByTestId('guided-start')).toBeDisabled();
  await expect(page.getByRole('textbox',{name:/multi OP.GG/})).toHaveCount(2);
  await expect(page.getByRole('button',{name:'Importer les deux équipes',exact:true})).toBeDisabled();
  // Ten explicit fictional player pools are injected through production validation/storage.
  // This test does not claim a fresh OP.GG network scrape.
  await page.evaluate(async()=>{
    const s=await window.draftApi.snapshot(),roles=['TOP','JUNGLE','MID','ADC','SUPPORT'];
    const team=(key)=>({url:'https://op.gg/lol/multisearch/euw?summoners='+encodeURIComponent(roles.map((_,i)=>key+i+'#EUW').join(',')),region:'euw',poolOnly:false,message:'TEST : pools fictifs',players:roles.map((role,i)=>({riotId:key+i+'#EUW',role,status:'manual',message:'TEST',pool:s.champions.filter(c=>c.roles.includes(role)&&!['Ahri','Azir'].includes(c.id)).map(c=>({championId:c.id,role,games:60,wins:30}))}))});
    await window.draftApi.teams({ally:team('Coach'),enemy:team('Rival')});
  });
  if(!real){
    await page.evaluate(()=>window.draftApi.demo());
    const s=await page.evaluate(()=>window.draftApi.snapshot()),now=new Date().toISOString();
    const fixture={schemaVersion:1,id:'guided-ui-counters',createdAt:now,provenance:{name:'TEST : counters fictifs contrôlés',url:'https://example.org/test-only',license:'Synthetic test fixture only',demo:true},stats:[],games:[],pairs:['Ahri','Azir'].flatMap((otherId,i)=>['Akali','Orianna'].map((championId,j)=>({championId,otherId,role:'MID',otherRole:'MID',kind:'matchup',patch:s.draft.patch,source:'pro',rank:'all',league:'all',side:'all',games:5000,wins:i===j?3500:1500,baseline:.5})))};
    const db=new Database(path.join(root,'tchim.sqlite'));db.prepare('INSERT INTO packs(id,raw,imported_at) VALUES(?,?,?)').run(fixture.id,JSON.stringify(fixture),now);db.close();
  }
  const live=await page.evaluate(()=>window.draftApi.snapshot());
  await expect(page.getByTestId('guided-start')).toBeEnabled();await capture(page,'guided-setup');
  await page.getByTestId('guided-start').click();await expect(page.getByTestId('guided-simulation')).toBeVisible();
  await expect(page.getByTestId('guided-turn-banner')).toContainText('1/20');
  await expect(page.getByTestId('guided-ally')).toContainText('Coach2#EUW');
  await expect(page.getByTestId('guided-enemy')).toContainText('Rival2#EUW');
  await expect(page.getByTestId('guided-proposal').first()).toBeEnabled({timeout:60000});
  await expect.poll(()=>page.getByTestId('guided-spotlight-art').locator('img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  report.bundledIllustration=true;
  const first=await page.getByTestId('guided-proposal').first().getAttribute('data-champion');
  await page.getByTestId('guided-proposal').first().click();await page.getByTestId('guided-confirm').click();
  await expect(page.getByTestId('guided-turn-banner')).toContainText('Réponse adverse');
  await expect(page.getByTestId('guided-step-2')).toHaveClass(/current/,{timeout:60000});
  expect(await page.locator('.guided-step-rail button.done').count()).toBe(2);
  report.visibleEnemyResponse=true;report.firstBan=first;
  console.log('GUIDED_VISIBLE_RESPONSE_OK');
  await page.getByLabel('Adversaire automatique',{exact:true}).uncheck();
  for(let i=2;i<6;i++){await expect(page.getByTestId('guided-step-'+i)).toHaveClass(/current/);await page.getByRole('button',{name:'Passer ce ban',exact:true}).click();}
  await expect(page.getByTestId('guided-step-6')).toHaveClass(/current/);
  // Both native drag handlers: real preview creation, role highlighting and cleanup.
  await page.locator('.guided-catalogue>summary').click();
  await page.getByLabel('Rôle du choix manuel guidé',{exact:true}).selectOption('MID');
  const data=await page.evaluateHandle(()=>new DataTransfer());
  await page.getByTestId('guided-champion-Ahri').dispatchEvent('dragstart',{dataTransfer:data});
  await expect(page.getByTestId('champion-drag-preview')).toContainText('Ahri');await expect(page.getByTestId('guided-simulation')).toHaveClass(/is-dragging/);
  await page.getByTestId('guided-slot-blue-MID').dispatchEvent('dragover',{dataTransfer:data});await expect(page.getByTestId('guided-slot-blue-MID')).toHaveClass(/drop-active/);
  await page.getByTestId('guided-slot-blue-MID').dispatchEvent('drop',{dataTransfer:data});await expect(page.getByTestId('champion-drag-preview')).toHaveCount(0);
  await expect(page.getByTestId('guided-simulation')).not.toHaveClass(/is-dragging/);report.nativeDragPreview=true;
  await expect(page.getByTestId('guided-slot-blue-MID')).toContainText('Ahri');await expect(page.locator('.guided-last-choice')).toContainText('Hors du pool connu');
  await expect(page.getByTestId('guided-proposal').first()).toBeEnabled({timeout:60000});
  const before=await page.getByTestId('guided-proposal').evaluateAll(rows=>rows.map(r=>({champion:r.dataset.champion,role:r.dataset.role,score:r.querySelector('[data-score]').dataset.score})));
  await expect(page.getByTestId('guided-simulation').getByTestId('draft-balance')).toContainText('1/10');
  const stable=await page.evaluate(()=>window.draftApi.snapshot());expect(stable.draft).toEqual(live.draft);expect(stable.teams).toEqual(live.teams);expect(stable.settings).toEqual(live.settings);
  // Rewind removes the previous choice and every reply, then scoring uses the replacement.
  await page.getByTestId('guided-step-6').click();await expect(page.getByTestId('guided-slot-blue-MID')).not.toContainText('Ahri');
  await page.locator('.guided-catalogue>summary').click();
  await page.getByLabel('Rôle du choix manuel guidé',{exact:true}).selectOption('MID');
  await page.getByTestId('guided-champion-Azir').click();await expect(page.locator('.guided-confirm')).toContainText('Hors du pool connu');
  await page.getByTestId('guided-confirm').click();
  await expect(page.getByTestId('guided-proposal').first()).toBeEnabled({timeout:60000});
  const after=await page.getByTestId('guided-proposal').evaluateAll(rows=>rows.map(r=>({champion:r.dataset.champion,role:r.dataset.role,score:r.querySelector('[data-score]').dataset.score})));
  expect(after).not.toEqual(before);report.changedResponses=true;console.log('GUIDED_RECALCULATION_OK');
  await expect(page.getByTestId('guided-score-change').first()).toBeVisible();report.scoreChanges=true;
  expect(await page.evaluate(()=>window.__championFlights)).toBeGreaterThanOrEqual(3);report.championFlights=await page.evaluate(()=>window.__championFlights);
  await page.locator('.guided-plans>summary').click();await expect(page.locator('.guided-plans .game-plan')).toHaveCount(2);await capture(page,'guided-game-plans');await page.locator('.guided-plans>summary').click();
  await capture(page,'guided-desktop');
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1104,721));await capture(page,'guided-desktop-small');
  const layout=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,decisions:document.querySelector('.guided-decisions').getBoundingClientRect().toJSON(),bottom:document.querySelector('.guided-bottom').getBoundingClientRect().toJSON()}));
  expect(layout.scroll).toBeLessThanOrEqual(layout.width);expect(layout.decisions.right).toBeLessThanOrEqual(layout.width);expect(layout.bottom.bottom).toBeLessThanOrEqual(layout.height);report.layout=layout;
  const scene=await page.evaluate(()=>({hero:document.querySelector('.draft-spotlight').getBoundingClientRect().toJSON(),slots:[...document.querySelectorAll('.guided-player')].map(el=>({rect:el.getBoundingClientRect().toJSON(),parent:el.closest('.guided-team-slots').getBoundingClientRect().toJSON()})),bans:[...document.querySelectorAll('.guided-team-bans')].map(el=>el.getBoundingClientRect().toJSON())}));
  expect(scene.hero.bottom).toBeLessThanOrEqual(layout.bottom.top);for(const slot of scene.slots){expect(slot.rect.top).toBeGreaterThanOrEqual(slot.parent.top-1);expect(slot.rect.bottom).toBeLessThanOrEqual(slot.parent.bottom+1);}for(const ban of scene.bans)expect(ban.bottom).toBeLessThanOrEqual(layout.bottom.top);report.fullSceneVisible=true;
  await page.getByLabel('Nom de la draft guidée',{exact:true}).fill('Scrim interactive');await page.getByTestId('guided-simulation').getByRole('button',{name:'Sauvegarder',exact:true}).click();
  const saved=await page.evaluate(()=>window.draftApi.snapshot()),id=saved.simulations.find(s=>s.name==='Scrim interactive').id,document=await page.evaluate(id=>window.draftApi.loadSimulation(id),id);
  expect(document.history).toHaveLength(7);expect(document.history[6]).toEqual({championId:'Azir',role:'MID'});expect(document.context.teams.enemy.poolOnly).toBe(true);report.persistence=true;
  await page.getByRole('button',{name:'Dérouler la suite',exact:true}).click();
  await expect(page.locator('.guided-step-rail button.done')).toHaveCount(8,{timeout:60000});
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  const pausedCount=await page.locator('.guided-step-rail button.done').count();await page.waitForTimeout(1500);expect(await page.locator('.guided-step-rail button.done').count()).toBe(pausedCount);report.pauseWorks=true;
  // Resuming saved partial work restores the two frozen rosters and does not mutate live draft.
  await page.getByRole('button',{name:'Équipes / nouvelle draft',exact:true}).click();
  await page.getByLabel('Reprendre une simulation',{exact:true}).selectOption(String(id));await expect(page.getByTestId('guided-slot-blue-MID')).toContainText('Azir');
  const completionStart=Date.now();await page.getByRole('button',{name:'Dérouler la suite',exact:true}).click();
  await expect(page.locator('.guided-step-rail button.done')).toHaveCount(20,{timeout:180000});
  await expect(page.getByTestId('guided-turn-banner')).toContainText('Draft terminée');
  await expect(page.getByTestId('guided-slot-blue-MID')).toContainText('Azir');report.completedMs=Date.now()-completionStart;
  const filled=await page.locator('.guided-player.filled').count();expect(filled).toBe(10);report.completePicks=filled;
  // Motion preferences can change while the application is running.
  await page.emulateMedia({reducedMotion:'reduce'});await page.getByTestId('guided-step-19').click();
  await expect(page.getByTestId('guided-proposal').first()).toBeEnabled({timeout:60000});
  const flightCount=await page.evaluate(()=>window.__championFlights);
  await page.getByTestId('guided-proposal').first().click();await page.getByTestId('guided-confirm').click();await expect(page.locator('.guided-step-rail button.done')).toHaveCount(20);
  expect(await page.evaluate(()=>window.__championFlights)).toBe(flightCount);report.reducedMotion=true;
  console.log('GUIDED_COMPLETE_OK',report.completedMs);
  await page.getByRole('button',{name:'Paramètres',exact:true}).click();await page.getByRole('button',{name:'English',exact:true}).click();
  await page.getByRole('button',{name:'Simulations',exact:true}).click();await expect(page.getByRole('heading',{name:'Both game plans are set.',exact:true})).toBeVisible();
  const invalid=await page.evaluate(async()=>{const s=await window.draftApi.snapshot();try{await window.draftApi.simulationTurn({draft:s.draft,pins:[],context:{settings:s.settings,teams:{...s.teams,enemy:{...s.teams.enemy,players:[]}}}});return false;}catch{return true;}});expect(invalid).toBe(true);
  expect((await page.evaluate(()=>window.draftApi.snapshot())).draft).toEqual(live.draft);
  expect(errors).toEqual([]);expect(externalImages).toEqual([]);report.errors=errors;report.noExternalImages=true;
  await writeFile('artifacts/guided-ui-report.json',JSON.stringify(report,null,2));console.log('GUIDED_SIMULATION_UI_OK',JSON.stringify(report));
}finally{await desktop.close();}
