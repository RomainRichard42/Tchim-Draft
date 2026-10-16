import { CloudService } from './cloud';
import {FeedbackService} from './feedback';
import {feedbackRequestSchema} from '../shared/coaching';
import { MatchService } from './matches';
import { PickInsightService } from './pick-insights';
import { pickInsightSchema } from '../shared/validation';
import { KnowledgeService } from './knowledge';
import { sourceUrlSchema } from '../shared/knowledge';
import { interaction,evidence } from '../engine/evidence';
import { rankCandidates } from '../engine';
import { appendWithRoleChanges, rewindDraft } from '../shared/placements';
import { patchPrior } from '../engine/patch-prior';
import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, nativeTheme, net, protocol, screen, session, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { z } from 'zod';
import { Storage } from './storage';
import { demoPack, refreshData } from './data';
import { configureSchema, draftSchema, selectionSchema, settingsSchema, teamsSchema, strategyRequestSchema, scrimSchema } from '../shared/validation';
import { ScrapeHttp } from '../collector/http';
import { scoutTeam } from '../collector/opgg';
import { freeRoles, newDraft, order, used } from '../shared/draft';
import type { Analysis, Draft, EngineInput, DraftModel, HistoricalGame, ScrimRecord, TeamProfile } from '../shared/types';
import { changeSeries, validateDraft } from '../shared/series';
import { appUpdates } from './updates';
import { SimulationService } from './simulations';
import { simulationRequestSchema, simulationOptionsSchema, simulationDocumentSchema, simulationTurnSchema } from '../shared/validation';
import { validateSimulation } from '../shared/simulation';
const simulations=new SimulationService();
const pickInsights=new PickInsightService();
let coachWorker:Worker|undefined;
function coachJob<T>(kind:'train'|'enrich',scrims?:ScrimRecord[]):Promise<T>{
 if(coachWorker)throw new Error('Une opération coach est déjà en cours / Coach operation already running');
 const input=storage.engineInput(),revision=storage.dataRevision;
 const job=new Worker(path.join(__dirname,'training-worker.cjs'));coachWorker=job;
 return new Promise<T>((resolve,reject)=>{
  const finish=()=>{clearTimeout(timer);if(coachWorker===job)coachWorker=undefined;void job.terminate();};
  const timer=setTimeout(()=>{finish();reject(new Error('Coach operation timed out'));},120000);
  job.once('message',({result,error})=>{finish();if(error)reject(new Error(error));else if(storage.dataRevision!==revision)reject(new Error('Les données ont changé : relance cette opération / Data changed: run again'));else resolve(result as T);});
  job.once('error',error=>{finish();reject(error);});
  job.postMessage({kind,root:path.join(app.getPath('userData'),'scraping'),champions:input.champions,games:input.demo?[]:input.games??[],scrims:scrims??storage.scrims()});
 });
}

protocol.registerSchemesAsPrivileged([{ scheme: 'tchim', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
app.setName('Tchim Draft');
nativeTheme.themeSource = 'dark';
if (process.env.TCHIM_DATA_DIR) app.setPath('userData', path.resolve(process.env.TCHIM_DATA_DIR));
let cloud:CloudService;
let matches:MatchService;
let knowledge:KnowledgeService;
let feedback:FeedbackService;
let storage: Storage, mainWindow: BrowserWindow | null = null, overlayWindow: BrowserWindow | null = null, worker: Worker;
let analysisCache: { key: string; result: Promise<Analysis> } | null = null;
let requestId = 0;
let workerRevision='';
const pending = new Map<number, { resolve: (value: Analysis) => void; reject: (error: Error) => void }>();
const isSmoke = process.argv.includes('--smoke-test');
const developmentUrl = !app.isPackaged && process.env.TCHIM_DEV_URL === 'http://127.0.0.1:5173' ? process.env.TCHIM_DEV_URL : undefined;
function notify(): void { const snap = storage.snapshot(); for (const w of [mainWindow, overlayWindow]) if (w && !w.isDestroyed()) w.webContents.send('draft:changed', snap) }
function changed() { analysisCache = null; storage.persist(); matches?.capture(); cloud?.scheduleWorkspace(); notify(); return storage.snapshot() }
function createWorker() {
  workerRevision='';
  worker = new Worker(path.join(__dirname, 'worker.cjs'));
  worker.on('message', ({ id, result, error }: { id: number; result: Analysis; error?: string }) => {
    const promise = pending.get(id); if (!promise) return; pending.delete(id);
    if (error) promise.reject(new Error(error)); else promise.resolve(result);
  });
  worker.on('error', error => { pending.forEach(p => p.reject(error)); pending.clear(); analysisCache = null; storage.log('error', `Worker: ${error.message}`) });
  worker.on('exit', code => { if (code) { pending.forEach(p => p.reject(new Error('Analysis worker stopped'))); pending.clear(); analysisCache = null } });
}
async function runAnalysis(): Promise<Analysis> {
  if(cloud?.state.configured)await cloud.sync();
  storage.packs(); // Observe atomic imports made by an external local collector.
  const revision=`${storage.dataRevision}|${storage.get('staticVersion')}`, key=JSON.stringify([revision,storage.draft,storage.settings,storage.teams]);
  if (analysisCache?.key === key) return analysisCache.result;
  const input: EngineInput = storage.engineInput();
  const id = ++requestId;
  const result = new Promise<Analysis>((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error('Analysis timed out')); analysisCache = null }, 30000);
    pending.set(id, { resolve: value => { clearTimeout(timeout); resolve(value) }, reject: error => { clearTimeout(timeout); reject(error) } });
    worker.postMessage({ id, input:workerRevision===revision?{draft:input.draft,settings:input.settings,teams:input.teams,model:input.model,teamContext:input.teamContext,teamProfiles:input.teamProfiles}:input });
    workerRevision=revision;
  });
  analysisCache = { key, result }; return result;
}
function createWindow(overlay = false): BrowserWindow {
  const saved = storage.get<{ x: number; y: number; width: number; height: number }>(overlay ? 'overlayBounds' : 'windowBounds');
  const bounds = saved && screen.getAllDisplays().some(d => saved.x + 100 > d.workArea.x && saved.x < d.workArea.x + d.workArea.width && saved.y + 60 > d.workArea.y && saved.y < d.workArea.y + d.workArea.height) ? saved : undefined;
  const win = new BrowserWindow({ width: overlay ? 390 : 1480, height: overlay ? 630 : 940, minWidth: overlay ? 320 : 1120, minHeight: overlay ? 400 : 760,
    ...bounds, show: !isSmoke && !process.env.TCHIM_TEST_HEADLESS, title: 'Tchim Draft', icon: path.join(app.getAppPath(), 'resources/icon.png'),
    frame: !overlay, transparent: overlay, backgroundColor: overlay ? '#00000000' : '#101219', autoHideMenuBar: true, alwaysOnTop: overlay,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
  if (overlay) { win.setAlwaysOnTop(true, 'floating'); win.setOpacity(storage.settings.overlayOpacity) }
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  win.on('close', () => storage.set(overlay ? 'overlayBounds' : 'windowBounds', win.getBounds()));
  void win.loadURL(developmentUrl ? `${developmentUrl}/${overlay ? '?overlay=1' : ''}` : `tchim://app/index.html${overlay ? '?overlay=1' : ''}`);
  return win;
}
function toggleOverlay(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) { overlayWindow.close(); overlayWindow = null; return }
  overlayWindow = createWindow(true); overlayWindow.on('closed', () => { overlayWindow = null });
}
function validateHistory(draft: Draft): Draft {
  return validateDraft(draft,new Set(storage.champions().map(c=>c.id)));
}
function bind(channel: string, handler: (value?: unknown) => unknown) {
  ipcMain.handle(channel, (event, value) => {
    const win = BrowserWindow.fromWebContents(event.sender), url = event.senderFrame?.url;
    const parsed = url ? new URL(url) : null;
    if (!win || ![mainWindow, overlayWindow].includes(win) || event.senderFrame !== event.sender.mainFrame || !parsed ||
      !((parsed.protocol === 'tchim:' && parsed.hostname === 'app') || (developmentUrl && parsed.origin === developmentUrl))) throw new Error('Unauthorized IPC sender');
    if(!channel.startsWith('cloud:')&&!['draft:snapshot','app:release-notes','app:acknowledge-release-notes'].includes(channel))cloud?.requireAccess();
    if(storage?.match?.archived&&['draft:configure','draft:select','draft:lock-role','draft:undo','draft:reset','draft:series','draft:scout','draft:teams'].includes(channel))throw new Error('Ce match est archivé. Restaure-le depuis Matchs / Restore this archived match from Matches');
    const actor=cloud?.state.userId;const result=handler(value);
    if(result&&typeof (result as Promise<unknown>).then==='function'&&!channel.startsWith('cloud:'))return (result as Promise<unknown>).then(value=>{if(cloud?.state.configured&&actor!==cloud.state.userId)throw new Error('Account changed');return value;});
    return result;
  });
}
async function readJson(file: string, maxBytes=30*1024*1024): Promise<unknown> { if ((await stat(file)).size > maxBytes) throw new Error(`File exceeds ${maxBytes/1024/1024} MB`); return JSON.parse(await readFile(file, 'utf8')) }
function handlers() {
  const knowledgeAdmin=()=>{if(cloud.state.configured&&cloud.state.role!=='owner')throw new Error('Administrator only');};
  bind('knowledge:state',()=>knowledge.state());
  bind('knowledge:forecast',value=>{const patch=z.string().regex(/^\d{1,2}\.\d{1,2}$/).parse(value),current=knowledge.state(),input={...storage.engineInput(),knowledge:current.staged??current.dataset??undefined,draft:{...storage.draft,patch}};const changes=input.knowledge?.patches.find(p=>p.patch===patch)?.changes??[];return [...new Set(changes.flatMap(c=>c.championId?[c.championId]:[]))].flatMap(id=>{const champ=input.champions.find(c=>c.id===id);return (champ?.roles??[]).map(role=>{const prior=patchPrior(input,id,role),stats=evidence(input,id,role,input.draft.side);return {championId:id,role,adjustment:prior.value,games:stats?.n??0,confidence:stats?.confidence??0,ambiguous:changes.some(c=>c.championId===id&&(c.direction==='mixed'||c.direction==='unknown'))};});}).sort((a,b)=>Math.abs(b.adjustment)-Math.abs(a.adjustment)).slice(0,20);});
  bind('knowledge:evidence',async value=>{const req=z.object({championId:z.string().regex(/^[A-Za-z0-9]+$/),role:z.enum(['TOP','JUNGLE','MID','ADC','SUPPORT']),enemyId:z.string().regex(/^[A-Za-z0-9]+$/),enemyRole:z.enum(['TOP','JUNGLE','MID','ADC','SUPPORT'])}).strict().parse(value);if(cloud.state.configured)await cloud.sync(storage.draft,[{championId:req.championId,role:req.role},{championId:req.enemyId,role:req.enemyRole}]);const input=storage.engineInput(),match=interaction(input,req.championId,req.role,req.enemyId,req.enemyRole,input.draft.side,'matchup');return {kind:'matchup',groups:match?.groups.map(g=>({source:g.source,games:g.n,winrate:g.estimate,baseline:g.baseline,supported:g.usable}))??[],confidence:match?.confidence??0,interval:match?.interval??null,patches:[...new Set(input.pairs.filter(p=>p.kind==='matchup'&&(p.championId===req.championId&&p.otherId===req.enemyId||p.championId===req.enemyId&&p.otherId===req.championId)).map(p=>p.patch))]};});
  bind('knowledge:prepare',()=>{knowledgeAdmin();return knowledge.prepare(path.join(app.getPath('userData'),'knowledge-cache'));});
  bind('knowledge:local',()=>{knowledgeAdmin();return knowledge.useLocal();});
  bind('knowledge:publish',async()=>{knowledgeAdmin();if(!cloud.state.configured)throw new Error('Connecte-toi pour partager / Sign in to share');await cloud.publishKnowledge();return knowledge.state();});
  bind('knowledge:source',value=>shell.openExternal(sourceUrlSchema.parse(value)));
  const scouting=new Set<string>();
  const credentials=z.object({email:z.string().email().max(254),password:z.string().min(8).max(72)}).strict();
  bind('cloud:login',async value=>{const {email,password}=credentials.parse(value);await matches.flush().catch(()=>{});await cloud.login(email,password);await feedback.sync();await matches.list();analysisCache=null;return storage.snapshot();});
  bind('cloud:signup',value=>{const {email,password,code}=credentials.extend({code:z.string().trim().regex(/^TD-[a-f0-9]{32}$/i)}).parse(value);return cloud.signup(email,password,code);});
  bind('cloud:logout',async()=>{simulations.stop();await matches.flush().catch(()=>{});matches.stop();storage.match=undefined;await cloud.logout();analysisCache=null;return storage.snapshot();});
  bind('cloud:workspace',async value=>{const id=z.string().uuid().parse(value);const rows=await cloud.workspaces() as import('../shared/types').CloudWorkspace[];const workspace=rows.find(w=>w.user_id===id);if(!workspace)throw new Error('Workspace not found');matches.capture();await matches.flush().catch(()=>{});matches.detach();if(storage.draft.history.length)storage.saveSession('Before workspace review');storage.draft=validateHistory(workspace.draft);storage.teams=teamsSchema.parse(workspace.teams);return changed();});
  bind('cloud:invite',value=>cloud.invite(z.string().email().max(254).parse(value)));
  bind('cloud:copy-invitation',async value=>{cloud.requireAccess();if(cloud.state.role!=='owner')throw new Error('Administrator only');await clipboard.writeText(z.string().regex(/^TD-[a-f0-9]{32}$/).parse(value));});
  bind('feedback:list',value=>feedback.list(z.boolean().default(false).parse(value)));
  bind('feedback:save',value=>feedback.save(feedbackRequestSchema.parse(value)));
  bind('feedback:delete',value=>feedback.remove(z.string().uuid().parse(value)));
  bind('draft:snapshot', () => storage.snapshot());
  bind('match:list',async()=>{const library=await matches.list();notify();return library;});
  bind('match:create',async value=>{simulations.stop();await matches.create(value);return changed();});
  bind('match:open',async value=>{simulations.stop();await matches.open(z.string().uuid().parse(value));return changed();});
  bind('match:archive',async value=>{const {id,archived}=z.object({id:z.string().uuid(),archived:z.boolean()}).strict().parse(value);const library=await matches.archive(id,archived);notify();return library;});
  bind('match:result',async value=>{await matches.result(value);storage.coachChanged();return changed();});
  bind('app:release-notes',()=>storage.releaseNotes(app.getVersion()));
  bind('app:acknowledge-release-notes',value=>storage.acknowledgeReleaseNotes(app.getVersion(),z.string().regex(/^\d+\.\d+\.\d+$/).max(40).parse(value)));
  bind('draft:configure', value => {
    const config = configureSchema.parse(value);
    if (config.mode && config.mode !== storage.draft.mode && storage.draft.history.length) throw new Error('Start a new draft before changing mode');
    const draft=validateHistory({ ...storage.draft, ...config,...(config.mode==='solo'?{series:{format:'single' as const,games:[]}}:{}) });
    if(config.mode==='solo'&&storage.draft.series?.games.length)storage.saveSession('Fearless · avant passage Solo');
    storage.draft = draft; return changed();
  });
  bind('draft:select', value => {
    const selected = selectionSchema.parse(value), action = order(storage.draft)[storage.draft.history.length];
    if (!action) throw new Error('Draft is complete');
    if (action.kind === 'pick' && (!selected.championId || !selected.role)) throw new Error('Choose a role');
    const rec=action.kind==='pick'?rankCandidates(storage.engineInput(),action.side,selected.role!,false,true,selected.championId!)[0]:undefined;
    if(action.kind==='pick'&&!rec)throw Error('Ce rôle ne peut pas être libéré avec les flexs et pools connus / No feasible flex assignment for this role');
    storage.draft = validateHistory(appendWithRoleChanges(storage.draft,action.kind==='ban'?{championId:selected.championId}:{championId:selected.championId,role:selected.role,...(selected.roleLocked?{roleLocked:true}:{})},rec?.reassignments)); return changed();
  });
  bind('draft:lock-role',value=>{const {index,locked}=z.object({index:z.number().int().min(0).max(19),locked:z.boolean()}).strict().parse(value);const selection=storage.draft.history[index];if(!selection?.championId||order(storage.draft)[index]?.kind!=='pick')throw Error('Pick required');storage.draft={...storage.draft,history:storage.draft.history.map((p,i)=>i===index?{...p,roleLocked:locked}:p)};return changed();});
  bind('draft:undo', value => { const index = value === undefined ? Math.max(0, storage.draft.history.length - 1) : z.number().int().min(0).max(storage.draft.history.length).parse(value); storage.draft = validateHistory(rewindDraft(storage.draft,index)); return changed() });
  bind('draft:reset', () => { storage.draft = { ...storage.draft, history: [], targetRole: 'AUTO' }; return changed() });
  bind('draft:series', async value => {
    const request=z.object({command:z.enum(['next','previous','reset']),winner:z.enum(['blue','red']).optional()}).strict().parse(value);
    if(request.command==='reset'&&storage.match?.results.length)throw new Error('Crée un nouveau match pour un nouveau BO / Create a new match for a new series');
    const winner=request.command==='next'&&storage.match?(await matches.completedWinner()):request.winner;
    const draft=validateHistory(changeSeries(storage.draft,request.command,winner));
    if(storage.draft.history.length||storage.draft.series?.games.length)storage.saveSession(`Fearless · manche ${(storage.draft.series?.games.length??0)+1} · ${new Date().toLocaleString('fr-FR')}`);
    storage.draft=draft;return changed();
  });
  bind('draft:settings', value => { storage.settings = settingsSchema.parse(value); if (overlayWindow) overlayWindow.setOpacity(storage.settings.overlayOpacity); return changed() });
  bind('coach:state',()=>cloud.state.configured?cloud.coach():storage.coach());
  bind('coach:strategy',async value=>{const request=strategyRequestSchema.parse(value);validateSimulation(request.draft,request.pins,new Set(storage.champions().map(c=>c.id)));if(cloud.state.configured)await cloud.sync(request.draft,[...request.roots,...request.pins.map(p=>p.selection)]);const input=storage.engineInput();return simulations.strategy(input,`${storage.dataRevision}|${storage.get('staticVersion')}`,request);});
  bind('coach:save-scrim',async value=>{const doc=scrimSchema.parse(value);validateHistory(doc.draft);if(cloud.state.configured){await cloud.save(doc);return cloud.coach();}storage.saveScrim(doc);changed();return storage.coach();});
  bind('coach:update-scrim',async value=>{const req=z.object({id:z.number().int().positive(),document:scrimSchema}).strict().parse(value);validateHistory(req.document.draft);if(cloud.state.configured){await cloud.update(req.id,req.document);return cloud.coach();}storage.updateScrim(req.id,req.document);changed();return storage.coach();});
  bind('coach:delete-scrim',async value=>{const id=z.number().int().positive().parse(value);if(cloud.state.configured){await cloud.remove(id);return cloud.coach();}storage.deleteScrim(id);changed();return storage.coach();});
  bind('coach:replay-scrim',async value=>{const id=z.number().int().positive().parse(value);if(cloud.state.configured){const game=(await cloud.records()).find(s=>s.id===id);if(!game)throw new Error('Draft not found');matches.capture();await matches.flush().catch(()=>{});matches.detach();storage.draft=validateHistory(game.draft);storage.teams=game.teams;}else{matches.capture();matches.detach();storage.replayScrim(id);};return changed();});
  bind('coach:activate',async value=>{const active=z.boolean().parse(value);if(cloud.state.configured){await cloud.activate(active);changed();return cloud.coach();}storage.activateModel(active);changed();return storage.coach();});
  bind('coach:train',async()=>{if(cloud.state.configured&&cloud.state.role!=='owner')throw new Error('Administrator only');if(cloud.state.configured){await cloud.sync();await cloud.loadGames();}const records=cloud.state.configured?await cloud.records():storage.scrims();const result=await coachJob<{model:DraftModel;profiles:{userId:string;profile:TeamProfile}[]}>('train',records);if(cloud.state.configured){await cloud.storeCandidate(result.model,result.profiles);changed();return cloud.coach();}storage.storeModel(result.model);changed();return storage.coach();});
  bind('coach:enrich',async()=>{const result=await coachJob<{games:HistoricalGame[];updated:number;failed:number}>('enrich');storage.enrichGames(result.games);storage.log('info',`Offline metadata: ${result.updated} updated, ${result.failed} unreadable cached games`);changed();return storage.coach();});
  bind('coach:export',async()=>{const result=await dialog.showSaveDialog(mainWindow!,{defaultPath:'tchim-scrims.json',filters:[{name:'Journal JSON',extensions:['json']}]});if(!result.canceled&&result.filePath)await writeFile(result.filePath,JSON.stringify({schema:1,scrims:cloud.state.configured?await cloud.records():storage.scrims()},null,2));});
  bind('draft:analyze', () => runAnalysis());
  bind('draft:pick-insight',async value=>{
    const request=pickInsightSchema.parse(value),input=storage.engineInput(),actor=cloud.state.userId,draftKey=JSON.stringify([storage.draft,storage.settings,storage.teams]);
    if(!input.champions.some(champ=>champ.id===request.championId))throw new Error('Pick unavailable');
    const current=()=>actor===cloud.state.userId&&draftKey===JSON.stringify([storage.draft,storage.settings,storage.teams])&&(!cloud.state.configured||cloud.state.authorized);
    const revision=`${actor}|${storage.dataRevision}|${storage.knowledge?.revision??''}`;
    return pickInsights.inspect(input,revision,request,()=>cloud.state.configured?cloud.pickPairs(request.championId):Promise.resolve(input.pairs.filter(pair=>pair.championId===request.championId||pair.otherId===request.championId)),current);
  });
  const simulationInput=()=>{const input=storage.engineInput();return {input,revision:`${storage.dataRevision}|${storage.get('staticVersion')}`};};
  bind('simulation:generate',async value=>{
    const request=simulationRequestSchema.parse(value);
    validateSimulation(request.draft,request.pins,new Set(storage.champions().map(c=>c.id)));
    if(cloud.state.configured)await cloud.sync(request.draft,request.pins.map(p=>p.selection),request.context?.teams??storage.teams);
    const {input,revision}=simulationInput();
    return simulations.generate(input,revision,request,completed=>{
      for(const window of [mainWindow,overlayWindow])if(window&&!window.isDestroyed())window.webContents.send('simulation:progress',{id:request.id,completed,requested:request.count});
    });
  });
  bind('simulation:options',async value=>{
    const request=simulationOptionsSchema.parse(value);
    validateSimulation(request.draft,request.pins,new Set(storage.champions().map(c=>c.id)));
    if(cloud.state.configured)await cloud.sync(request.draft,request.pins.map(p=>p.selection),request.context?.teams??storage.teams);
    const {input,revision}=simulationInput();
    return simulations.options({...input,...request.context,draft:request.draft},revision,request.pins);
  });
  bind('simulation:cancel',value=>simulations.cancel(z.string().max(80).parse(value)));
  bind('simulation:turn',async value=>{
    const request=simulationTurnSchema.parse(value);
    validateSimulation(request.draft,request.pins,new Set(storage.champions().map(c=>c.id)));
    if(cloud.state.configured)await cloud.sync(request.draft,request.pins.map(p=>p.selection),request.context?.teams??storage.teams);
    const {input,revision}=simulationInput();
    return simulations.turn(input,revision,request);
  });
  bind('simulation:save',value=>{storage.saveSimulation(simulationDocumentSchema.parse(value));notify();return storage.snapshot();});
  bind('simulation:load',value=>storage.simulation(z.number().int().positive().parse(value)));
  bind('simulation:delete',value=>{storage.deleteSimulation(z.number().int().positive().parse(value));notify();return storage.snapshot();});
  bind('draft:teams', value => {const teams=teamsSchema.parse(value),known=new Set(storage.champions().map(c=>c.id));if(Object.values(teams).some(t=>t.players.some(p=>p.pool.some(c=>!known.has(c.championId)))))throw new Error('Unknown champion in player pool');storage.teams=teams;return changed()});
  bind('draft:scout', async value => {
    const {team,url}=z.object({team:z.enum(['ally','enemy']),url:z.string().max(2000)}).strict().parse(value);
    if(scouting.size)throw new Error('Un import OP.GG est déjà en cours.');scouting.add(team);
    const actor=cloud.state.userId,matchId=storage.match?.id;
    const root=path.join(app.getPath('userData'),'scouting');await mkdir(root,{recursive:true});
    const http=new ScrapeHttp(root,m=>storage.log('info',m));
    try{await scoutTeam(http,storage.champions(),url,storage.teams[team],current=>{if(actor!==cloud.state.userId||matchId!==storage.match?.id)throw new Error('Le match a changé : relance l’import / Match changed: import again');storage.teams[team]=current;changed()});return storage.snapshot();}
    finally{http.close();scouting.delete(team);}
  });
  bind('draft:refresh', async () => { if(cloud.state.configured){await cloud.refreshStatistics();return;} await refreshData(storage, app.getPath('userData'), () => { analysisCache = null; notify() }) });
  bind('draft:prepare-data',async()=>{cloud.requireAccess();if(cloud.state.configured)await cloud.prepareDraft();return changed();});
  bind('draft:import-pack', async () => { const result = await dialog.showOpenDialog(mainWindow!, { filters: [{ name: 'Data pack JSON', extensions: ['json'] }], properties: ['openFile'] }); if (!result.canceled) storage.importPack(await readJson(result.filePaths[0],64*1024*1024)); return changed() });
  bind('draft:demo', () => { const pack = demoPack(storage); storage.importPack(pack); if (storage.draft.patch === 'unknown') storage.draft.patch = pack.stats[0].patch; return changed() });
  bind('draft:remove-pack', value => { storage.removePack(z.string().max(100).parse(value)); return changed() });
  bind('draft:save-session', value => { storage.saveSession(z.string().trim().min(1).max(100).parse(value)); return changed() });
  bind('draft:load-session', async value => { const context=storage.sessionContext(z.number().int().positive().parse(value));const draft=validateHistory(context.draft);matches.capture();await matches.flush().catch(()=>{});matches.detach();storage.draft=draft;if(context.teams)storage.teams=context.teams;return changed(); });
  bind('draft:export-session', async () => { const result = await dialog.showSaveDialog(mainWindow!, { defaultPath: 'tchim-draft.json', filters: [{ name: 'Draft JSON', extensions: ['json'] }] }); if (!result.canceled && result.filePath) await writeFile(result.filePath, JSON.stringify({ schemaVersion: 1, draft: storage.draft }, null, 2)) });
  bind('draft:import-session', async () => { const result = await dialog.showOpenDialog(mainWindow!, { filters: [{ name: 'Draft JSON', extensions: ['json'] }], properties: ['openFile'] }); if (!result.canceled) { const payload = z.object({ schemaVersion: z.literal(1), draft: draftSchema }).strict().parse(await readJson(result.filePaths[0])); const draft=validateHistory(payload.draft);matches.capture();await matches.flush().catch(()=>{});matches.detach();storage.draft=draft; } return changed() });
  bind('draft:overlay', () => toggleOverlay());
  bind('draft:check-update', () => checkUpdates());
  bind('draft:install-update', () => { if (storage.update !== 'downloaded') throw new Error('No update ready'); autoUpdater.quitAndInstall() });
}
let updates:ReturnType<typeof appUpdates>;
async function checkUpdates() {await updates.check()}
async function accessUpdateConfig() { const configFile = path.join(process.resourcesPath, 'app-update.yml'); await stat(configFile) }
function initUpdater() {
  updates=appUpdates(autoUpdater,{packaged:app.isPackaged,disabled:isSmoke||process.env.TCHIM_DISABLE_APP_UPDATES==='1'||process.env.TCHIM_OFFLINE==='1',hasConfig:accessUpdateConfig,
    status:value=>{storage.update=value;notify()},log:message=>storage.log('error',`App update: ${message}`)});
  void updates.start();
  const timer=setInterval(()=>void checkUpdates(),4*60*60*1000);timer.unref();
}
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on('second-instance', () => { mainWindow?.show(); mainWindow?.focus() });
  app.whenReady().then(async () => {
    mkdirSync(app.getPath('userData'), { recursive: true });
    storage = new Storage(path.join(app.getPath('userData'), 'tchim.sqlite'));
    cloud=new CloudService(storage,notify);
    matches=new MatchService(storage,cloud,notify);
    knowledge=new KnowledgeService(storage,notify);
    feedback=new FeedbackService(storage,cloud,notify);
    protocol.handle('tchim', async request => {
      const url = new URL(request.url), decoded = decodeURIComponent(url.pathname);
      const root = url.hostname === 'app' ? path.join(app.getAppPath(), 'dist/renderer') : url.hostname === 'assets' ? app.getPath('userData') : null;
      if (!root || (url.hostname === 'assets' && !/^\/icons\/\d+\.\d+\.\d+\/[A-Za-z0-9_]+\.png$/.test(decoded))) return new Response('', { status: 403 });
      const file = path.resolve(root, `.${decoded}`);
      if (!file.startsWith(`${path.resolve(root)}${path.sep}`)) return new Response('', { status: 403 });
      try { return await net.fetch(pathToFileURL(file).toString()) } catch { return new Response('', { status: 404 }) }
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    createWorker(); handlers(); initUpdater();
    mainWindow = createWindow(); void cloud.initialize().then(()=>{if(!cloud.state.configured||cloud.state.authorized)return matches.list().then(()=>feedback.sync()).then(()=>notify());}); mainWindow.on('closed', () => { mainWindow = null; overlayWindow?.close() });
    if (!isSmoke) {
      let wasCollecting=false;
      const externalProgress=setInterval(()=>{const active=storage.collecting();if(active||wasCollecting){analysisCache=null;notify();}wasCollecting=active;},3000);externalProgress.unref();
      globalShortcut.register('CommandOrControl+Shift+D', toggleOverlay);
    }
    if (isSmoke) {
      try {
        const loaded = new Promise<boolean>(resolve => mainWindow!.webContents.once('did-finish-load', () => setTimeout(() => { void mainWindow!.webContents.executeJavaScript('Boolean(window.draftApi && document.querySelector("[data-testid=app]"))').then(resolve) }, 1500)));
        const analysis = await runAnalysis();
        if (!analysis.picks.length || analysis.scenarios.some(s => s.history.length !== 20)) throw new Error('Incomplete analysis');
        const rendered = await loaded;
        if (!rendered) throw new Error('Renderer/preload failed');
        console.log('DESKTOP_SMOKE_OK SQLite + worker + secure preload + React renderer'); app.quit();
      } catch (error) { console.error(error); app.exit(1) }
    }
  }).catch(error => { console.error(error); dialog.showErrorBox('Tchim Draft', String(error)); app.exit(1) });
}
app.on('window-all-closed', () => app.quit());
let flushingQuit=false,quitFlushed=false;
app.on('before-quit',event=>{
  if(isSmoke||quitFlushed||!storage)return;event.preventDefault();if(flushingQuit)return;flushingQuit=true;
  // Every choice is already stored in SQLite. Give cloud writes a short grace period at close.
  void Promise.race([Promise.allSettled([matches.flush(),cloud.flushWorkspace()]),new Promise(resolve=>setTimeout(resolve,2000))]).finally(()=>{quitFlushed=true;app.quit();});
});
app.on('will-quit', () => { globalShortcut.unregisterAll(); if (worker) void worker.terminate(); simulations.stop(); pickInsights.stop(); matches?.stop(); knowledge?.stop(); void coachWorker?.terminate(); storage?.close() });
