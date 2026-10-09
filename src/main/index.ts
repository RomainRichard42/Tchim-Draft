import { app, BrowserWindow, dialog, globalShortcut, ipcMain, nativeTheme, net, protocol, screen, session } from 'electron';
import { autoUpdater } from 'electron-updater';
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { z } from 'zod';
import { Storage } from './storage';
import { demoPack, refreshData } from './data';
import { configureSchema, draftSchema, selectionSchema, settingsSchema, teamsSchema } from '../shared/validation';
import { ScrapeHttp } from '../collector/http';
import { scoutTeam } from '../collector/opgg';
import { freeRoles, newDraft, order, used } from '../shared/draft';
import type { Analysis, Draft, EngineInput } from '../shared/types';
import { changeSeries, validateDraft } from '../shared/series';
import { appUpdates } from './updates';
import { SimulationService } from './simulations';
import { simulationRequestSchema, simulationOptionsSchema, simulationDocumentSchema } from '../shared/validation';
import { validateSimulation } from '../shared/simulation';
const simulations=new SimulationService();

protocol.registerSchemesAsPrivileged([{ scheme: 'tchim', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
app.setName('Tchim Draft');
nativeTheme.themeSource = 'dark';
if (process.env.TCHIM_DATA_DIR) app.setPath('userData', path.resolve(process.env.TCHIM_DATA_DIR));
let storage: Storage, mainWindow: BrowserWindow | null = null, overlayWindow: BrowserWindow | null = null, worker: Worker;
let analysisCache: { key: string; result: Promise<Analysis> } | null = null;
let requestId = 0;
let workerRevision='';
const pending = new Map<number, { resolve: (value: Analysis) => void; reject: (error: Error) => void }>();
const isSmoke = process.argv.includes('--smoke-test');
const developmentUrl = !app.isPackaged && process.env.TCHIM_DEV_URL === 'http://127.0.0.1:5173' ? process.env.TCHIM_DEV_URL : undefined;
function notify(): void { const snap = storage.snapshot(); for (const w of [mainWindow, overlayWindow]) if (w && !w.isDestroyed()) w.webContents.send('draft:changed', snap) }
function changed() { analysisCache = null; storage.persist(); notify(); return storage.snapshot() }
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
function runAnalysis(): Promise<Analysis> {
  storage.packs(); // Observe atomic imports made by an external local collector.
  const revision=`${storage.dataRevision}|${storage.get('staticVersion')}`, key=JSON.stringify([revision,storage.draft,storage.settings,storage.teams]);
  if (analysisCache?.key === key) return analysisCache.result;
  const input: EngineInput = storage.engineInput();
  const id = ++requestId;
  const result = new Promise<Analysis>((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error('Analysis timed out')); analysisCache = null }, 30000);
    pending.set(id, { resolve: value => { clearTimeout(timeout); resolve(value) }, reject: error => { clearTimeout(timeout); reject(error) } });
    worker.postMessage({ id, input:workerRevision===revision?{draft:input.draft,settings:input.settings,teams:input.teams}:input });
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
    return handler(value);
  });
}
async function readJson(file: string, maxBytes=30*1024*1024): Promise<unknown> { if ((await stat(file)).size > maxBytes) throw new Error(`File exceeds ${maxBytes/1024/1024} MB`); return JSON.parse(await readFile(file, 'utf8')) }
function handlers() {
  const scouting=new Set<string>();
  bind('draft:snapshot', () => storage.snapshot());
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
    if (action.kind === 'pick' && (!selected.championId || !selected.role || !freeRoles(storage.draft, action.side).includes(selected.role))) throw new Error('Choose a free role');
    storage.draft = validateHistory({ ...storage.draft, history: [...storage.draft.history, action.kind === 'ban' ? { championId: selected.championId } : selected] }); return changed();
  });
  bind('draft:undo', value => { const index = value === undefined ? Math.max(0, storage.draft.history.length - 1) : z.number().int().min(0).max(storage.draft.history.length).parse(value); storage.draft.history = storage.draft.history.slice(0, index); return changed() });
  bind('draft:reset', () => { storage.draft = { ...storage.draft, history: [], targetRole: 'AUTO' }; return changed() });
  bind('draft:series', value => {
    const request=z.object({command:z.enum(['next','previous','reset']),winner:z.enum(['blue','red']).optional()}).strict().parse(value);
    const draft=validateHistory(changeSeries(storage.draft,request.command,request.winner));
    if(storage.draft.history.length||storage.draft.series?.games.length)storage.saveSession(`Fearless · manche ${(storage.draft.series?.games.length??0)+1} · ${new Date().toLocaleString('fr-FR')}`);
    storage.draft=draft;return changed();
  });
  bind('draft:settings', value => { storage.settings = settingsSchema.parse(value); if (overlayWindow) overlayWindow.setOpacity(storage.settings.overlayOpacity); return changed() });
  bind('draft:analyze', () => runAnalysis());
  const simulationInput=()=>{const input=storage.engineInput();return {input,revision:`${storage.dataRevision}|${storage.get('staticVersion')}`};};
  bind('simulation:generate',value=>{
    const request=simulationRequestSchema.parse(value);
    validateSimulation(request.draft,request.pins,new Set(storage.champions().map(c=>c.id)));
    const {input,revision}=simulationInput();
    return simulations.generate(input,revision,request,completed=>{
      for(const window of [mainWindow,overlayWindow])if(window&&!window.isDestroyed())window.webContents.send('simulation:progress',{id:request.id,completed,requested:request.count});
    });
  });
  bind('simulation:options',value=>{
    const request=simulationOptionsSchema.parse(value);
    validateSimulation(request.draft,request.pins,new Set(storage.champions().map(c=>c.id)));
    const {input,revision}=simulationInput();
    return simulations.options({...input,...request.context,draft:request.draft},revision,request.pins);
  });
  bind('simulation:cancel',value=>simulations.cancel(z.string().max(80).parse(value)));
  bind('simulation:save',value=>{storage.saveSimulation(simulationDocumentSchema.parse(value));notify();return storage.snapshot();});
  bind('simulation:load',value=>storage.simulation(z.number().int().positive().parse(value)));
  bind('simulation:delete',value=>{storage.deleteSimulation(z.number().int().positive().parse(value));notify();return storage.snapshot();});
  bind('draft:teams', value => {const teams=teamsSchema.parse(value),known=new Set(storage.champions().map(c=>c.id));if(Object.values(teams).some(t=>t.players.some(p=>p.pool.some(c=>!known.has(c.championId)))))throw new Error('Unknown champion in player pool');storage.teams=teams;return changed()});
  bind('draft:scout', async value => {
    const {team,url}=z.object({team:z.enum(['ally','enemy']),url:z.string().max(2000)}).strict().parse(value);
    if(scouting.size)throw new Error('Un import OP.GG est déjà en cours.');scouting.add(team);
    const root=path.join(app.getPath('userData'),'scouting');await mkdir(root,{recursive:true});
    const http=new ScrapeHttp(root,m=>storage.log('info',m));
    try{await scoutTeam(http,storage.champions(),url,storage.teams[team],current=>{storage.teams[team]=current;changed()});return storage.snapshot();}
    finally{http.close();scouting.delete(team);}
  });
  bind('draft:refresh', async () => { await refreshData(storage, app.getPath('userData'), () => { analysisCache = null; notify() }) });
  bind('draft:import-pack', async () => { const result = await dialog.showOpenDialog(mainWindow!, { filters: [{ name: 'Data pack JSON', extensions: ['json'] }], properties: ['openFile'] }); if (!result.canceled) storage.importPack(await readJson(result.filePaths[0],64*1024*1024)); return changed() });
  bind('draft:demo', () => { const pack = demoPack(storage); storage.importPack(pack); if (storage.draft.patch === 'unknown') storage.draft.patch = pack.stats[0].patch; return changed() });
  bind('draft:remove-pack', value => { storage.removePack(z.string().max(100).parse(value)); return changed() });
  bind('draft:save-session', value => { storage.saveSession(z.string().trim().min(1).max(100).parse(value)); return changed() });
  bind('draft:load-session', value => { storage.draft = validateHistory(storage.session(z.number().int().positive().parse(value))); return changed() });
  bind('draft:export-session', async () => { const result = await dialog.showSaveDialog(mainWindow!, { defaultPath: 'tchim-draft.json', filters: [{ name: 'Draft JSON', extensions: ['json'] }] }); if (!result.canceled && result.filePath) await writeFile(result.filePath, JSON.stringify({ schemaVersion: 1, draft: storage.draft }, null, 2)) });
  bind('draft:import-session', async () => { const result = await dialog.showOpenDialog(mainWindow!, { filters: [{ name: 'Draft JSON', extensions: ['json'] }], properties: ['openFile'] }); if (!result.canceled) { const payload = z.object({ schemaVersion: z.literal(1), draft: draftSchema }).strict().parse(await readJson(result.filePaths[0])); storage.draft = validateHistory(payload.draft) } return changed() });
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
    mainWindow = createWindow(); mainWindow.on('closed', () => { mainWindow = null; overlayWindow?.close() });
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
app.on('will-quit', () => { globalShortcut.unregisterAll(); if (worker) void worker.terminate(); simulations.stop(); storage?.close() });
