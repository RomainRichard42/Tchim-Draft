import Database from 'better-sqlite3';
import type { Champion, DataPack, DataStatus, Draft, EngineInput, Settings, Snapshot, Teams, SimulationDocument, CoachState, ScrimDocument, ScrimRecord, DraftModel, HistoricalGame, CloudState, TeamProfile } from '../shared/types';
import { SEED_CHAMPIONS, DEFAULT_SETTINGS } from '../shared/champions';
import { newDraft } from '../shared/draft';
import { draftSchema, settingsSchema, teamsSchema, simulationDocumentSchema, scrimSchema } from '../shared/validation';
import { validateSimulation } from '../shared/simulation';
import { validateDraft } from '../shared/series';
import { latestPatches } from '../shared/patches';
import path from 'node:path';
import { validateDataPack } from '../shared/validate-pack';
import { mergeDataPacks } from '../shared/packs';
import type { DatasetManifest } from '../shared/dataset';
import { compareVersions, releaseNotesStatus } from '../shared/release-notes';
import { knowledgeSummary,type KnowledgeDataset } from '../shared/knowledge';
import type {CoachFeedback} from '../shared/coaching';
import type {ProGameContext} from '../shared/coaching';
import { rewindDraft } from '../shared/placements';

export class Storage {
  private packCache: DataPack[] | undefined;
  private merged: Pick<EngineInput,'stats'|'pairs'|'games'|'demo'>|undefined;
  dataRevision=0;
  private packSignature='';
  private signature():string {return JSON.stringify(this.db.prepare('SELECT COUNT(*) AS count, MAX(imported_at) AS latest FROM packs').get());}
  collecting():boolean {
    const lease=this.get<{pid:number;database:string}>('scrapeLease');if(!lease||lease.database!==path.resolve(this.db.name))return false;
    try{process.kill(lease.pid,0);return true;}catch{return false;}
  }
  readonly db: Database.Database;
  draft: Draft;
  settings: Settings;
  teams: Teams;
  cloud?:CloudState;
  match?:Snapshot['match'];
  knowledge?:KnowledgeDataset;
  knowledgeShared=false;
  knowledgeMessage='';
  cloudData?:DataPack;
  teamProfiles?:TeamProfile[];
  teamContext?:EngineInput['teamContext'];
  cloudCoverage?:DataStatus['coverage'];
  cloudChampions?:Champion[];
  proContext?:Record<string,ProGameContext>;
  refreshing = false;
  message = '';
  update = 'disabled';
  constructor(file: string) {
    this.db = new Database(file);
    this.db.pragma('journal_mode = WAL'); this.db.pragma('foreign_keys = ON');
    this.db.exec(`CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS champions (id TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS packs (id TEXT PRIMARY KEY, raw TEXT NOT NULL, imported_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY, name TEXT NOT NULL, saved_at TEXT NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS simulations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, saved_at TEXT NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, at TEXT NOT NULL, level TEXT NOT NULL, message TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS scrims (id INTEGER PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS coach_feedback (id TEXT PRIMARY KEY,owner TEXT NOT NULL,json TEXT NOT NULL,dirty INTEGER NOT NULL DEFAULT 1);
      CREATE INDEX IF NOT EXISTS coach_feedback_owner ON coach_feedback(owner);
      PRAGMA user_version = 1;`);
    for(const table of ['sessions','simulations','logs'])if(!(this.db.pragma('table_info('+table+')') as {name:string}[]).some(c=>c.name==='owner'))this.db.exec('ALTER TABLE '+table+" ADD COLUMN owner TEXT NOT NULL DEFAULT ''");
    const insert = this.db.prepare('INSERT OR IGNORE INTO champions VALUES (?, ?)');
    this.db.transaction(() => SEED_CHAMPIONS.forEach(c => insert.run(c.id, JSON.stringify(c))))();
    this.draft = draftSchema.parse(this.get('draft') ?? newDraft(this.get('staticVersion') ?? 'unknown'));
    this.settings = settingsSchema.parse(this.get('settings') ?? DEFAULT_SETTINGS);
    this.teams = teamsSchema.parse(this.get('teams') ?? { ally: {url:'',region:'euw',players:[],poolOnly:false,message:''}, enemy: {url:'',region:'euw',players:[],poolOnly:false,message:''} });
    if (!this.get('scoringV3')) {
      const old={winrate:24,matchup:18,synergy:15,meta:12,flex:7,order:9,composition:10,mastery:5};
      if (Object.entries(old).every(([k,v])=>this.settings.weights[k as keyof typeof old]===v)) this.settings.weights={...DEFAULT_SETTINGS.weights};
      this.draft.rank='MASTER_PLUS'; this.draft.targetRole='AUTO'; this.set('scoringV3',true); this.persist();
    }
  }
  get<T = string>(key: string): T | undefined { const r = this.db.prepare('SELECT value FROM kv WHERE key = ?').get(key) as { value: string } | undefined; return r ? JSON.parse(r.value) as T : undefined }
  set(key: string, value: unknown): void { this.db.prepare('INSERT OR REPLACE INTO kv VALUES (?, ?)').run(key, JSON.stringify(value)) }
  releaseNotes(version:string) { return releaseNotesStatus(version,this.get('releaseNotesSeenVersion')); }
  acknowledgeReleaseNotes(currentVersion:string,requestedVersion:string):void {
    if(currentVersion!==requestedVersion)throw new Error('Release version mismatch');
    const seen=this.releaseNotes(currentVersion).lastSeenVersion;
    if(!seen||compareVersions(currentVersion,seen)>0)this.set('releaseNotesSeenVersion',currentVersion);
  }
  persist(): void { this.db.transaction(() => { if(this.cloud?.configured){if(this.cloud.userId)this.set('account:'+this.cloud.userId,{draft:this.draft,settings:this.settings,teams:this.teams,savedAt:new Date().toISOString()});}else{this.set('draft', this.draft); this.set('settings', this.settings); this.set('teams',this.teams);} })() }
  champions(): Champion[] { if(this.cloudChampions)return this.cloudChampions;return (this.db.prepare('SELECT json FROM champions ORDER BY id').all() as { json: string }[]).map(r => JSON.parse(r.json)) }
  packs(): DataPack[] {
    const signature=this.signature();if(this.packSignature&&this.packSignature!==signature){this.packCache=undefined;this.merged=undefined;this.dataRevision++;}this.packSignature=signature;
    return this.packCache??(this.packCache=(this.db.prepare('SELECT raw FROM packs ORDER BY imported_at').all() as { raw: string }[]).map(r => JSON.parse(r.raw)));
  }
  validatePack(raw: unknown, known = new Set(this.champions().map(c => c.id))): DataPack { return validateDataPack(raw,known); }
  importPack(raw: unknown): void {
    const pack = this.validatePack(raw);
    // Keep raw, validated source payload and metadata together. Atomic replacement.
    this.db.transaction(() => {
      this.db.prepare('INSERT OR REPLACE INTO packs VALUES (?, ?, ?)').run(pack.id, JSON.stringify(pack), new Date().toISOString());
      this.log('info', `Imported ${pack.id}: ${pack.stats.length} stats, ${pack.pairs.length} pairs, ${pack.games.length} games${pack.provenance.demo ? ' (SYNTHETIC)' : ''}`);
    })();
    if(this.packCache)this.packCache=[...this.packCache.filter(p=>p.id!==pack.id),pack];
    this.packSignature=this.signature();
    this.merged=undefined;this.dataRevision++;this.invalidateModel();
  }
  installSharedDataset(manifest: DatasetManifest, prepared: {id:string;raw:string}[], url: string, etag?: string): void {
    // Every downloaded part is validated before this transaction. Local user tables are untouched.
    const old = this.get<string[]>('sharedPackIds') ?? [], keep = new Set(manifest.parts.map(p=>p.id));
    const current = new Map(this.champions().map(c=>[c.id,c]));
    const version=this.get<string>('staticVersion'),useCatalog=!version||version.localeCompare(manifest.staticVersion,undefined,{numeric:true})<=0;
    this.db.transaction(()=>{
      for(const c of manifest.champions) if(useCatalog||!current.has(c.id)) {
        this.db.prepare('INSERT OR REPLACE INTO champions VALUES (?, ?)').run(c.id,JSON.stringify({...c,icon:`tchim://assets/icons/${manifest.staticVersion}/${c.id}.png`}));
      }
      const insert=this.db.prepare('INSERT OR REPLACE INTO packs VALUES (?, ?, ?)'), now=new Date().toISOString();
      for(const p of prepared) insert.run(p.id,p.raw,now);
      for(const id of old) if(!keep.has(id)) this.db.prepare('DELETE FROM packs WHERE id = ?').run(id);
      if(!this.get('staticVersion')) {
        this.set('staticVersion',manifest.staticVersion);
        if(!this.draft.history.length&&this.draft.patch==='unknown') {this.draft.patch=manifest.staticVersion.split('.').slice(0,2).join('.');this.set('draft',this.draft);}
      }
      this.set('sharedPackIds',[...keep]);
      this.set('sharedParts',Object.fromEntries(manifest.parts.map(p=>[p.id,p.sha256])));
      this.set('sharedDataset',{url,etag,manifest});
      this.log('info',`Shared dataset ${manifest.revision.slice(0,12)}: ${prepared.length} changed parts installed`);
    })();
    this.packCache=undefined;this.merged=undefined;this.packSignature=this.signature();this.dataRevision++;this.invalidateModel();
  }
  removePack(id: string): void {
    const match=/^lolalytics-(\d+\.\d+)-master_plus$/.exec(id),shared=/^shared-(solo|pro)-(\d+\.\d+)-\d+$/.exec(id),prefix=shared?`shared-${shared[1]}-${shared[2]}-`:match?`lolalytics-${match[1]}-`:undefined;
    if(prefix)this.db.prepare('DELETE FROM packs WHERE id LIKE ?').run(`${prefix}%`);else this.db.prepare('DELETE FROM packs WHERE id = ?').run(id);
    if(this.packCache)this.packCache=this.packCache.filter(p=>prefix?!p.id.startsWith(prefix):p.id!==id);
    this.packSignature=this.signature();this.merged=undefined;this.dataRevision++;
  }
  engineInput(): EngineInput {
    const packs = this.packs();
    const configuration={proContext:this.proContext,feedback:this.feedbackRecords(),draft:this.draft,settings:this.settings,teams:this.teams,champions:this.champions(),model:this.get<DraftModel>('draftModel'),teamProfiles:this.teamProfiles,teamContext:this.teamContext,knowledge:this.knowledge};
    if(this.cloudData)return {...configuration,stats:this.cloudData.stats,pairs:this.cloudData.pairs,games:this.cloudData.games,demo:false};
    if(this.merged)return {...configuration,...this.merged};
    this.merged=mergeDataPacks(packs);
    return {...configuration,...this.merged};
  }
  snapshot(): Snapshot {
    const packs = this.packs(), input=this.engineInput(), stats=input.stats;
    const external=this.collecting();
    const data: DataStatus = { staticVersion: this.get('staticVersion') ?? 'offline', lastRefresh: this.get('lastRefresh'), refreshing: this.refreshing||external, message: this.cloud?.configured?this.cloud.message:external?(this.get<string>('scrapeProgress')??this.message):this.message,
      packs: (this.cloudData?[this.cloudData]:packs).map(p => ({ id: p.id, name: p.provenance.name, demo: p.provenance.demo, rows: p.stats.length + p.pairs.length, createdAt: p.createdAt })),
      logs: this.cloud?.configured&&!this.cloud.authorized?[]:this.db.prepare('SELECT at, level, message FROM logs WHERE owner=? ORDER BY id DESC LIMIT 30').all(this.owner()) as DataStatus['logs'],
      patches: [...new Set([this.draft.patch, ...(this.get<string>('staticVersion') ? [this.get<string>('staticVersion')!.split('.').slice(0, 2).join('.')] : []), ...stats.map(s => s.patch.split('.').slice(0, 2).join('.'))])].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })),
      ranks: [...new Set(['all', 'EMERALD_PLUS', 'DIAMOND_PLUS', 'MASTER_PLUS', 'GOLD', ...stats.map(s => s.rank)])],
      leagues: [...new Set(['all', 'LCK', 'LPL', 'LEC', 'LCS', 'WORLDS', ...stats.map(s => s.league),...packs.flatMap(p=>p.games.map(g=>g.league))])],
      coverage: this.cloudCoverage??(['solo','pro'] as const).map(source=>{const rows=stats.filter(s=>s.source===source),patches=latestPatches(rows.map(s=>s.patch));return {source,patches,stats:rows.filter(r=>patches.includes(r.patch)).length,pairs:input.pairs.filter(r=>r.source===source&&patches.includes(r.patch)).length,games:source==='pro'?(input.games??[]).filter(g=>patches.includes(g.patch)).length:0};}) };
    const privateAccess=!this.cloud?.configured||this.cloud.authorized;
    return { preview:process.env.TCHIM_PREVIEW==='1', draft: privateAccess?this.draft:newDraft(), settings: privateAccess?this.settings:{...DEFAULT_SETTINGS,language:this.settings.language,theme:this.settings.theme,pool:{}}, teams: privateAccess?this.teams:{ally:{url:'',region:'euw',players:[],poolOnly:false,message:''},enemy:{url:'',region:'euw',players:[],poolOnly:false,message:''}}, champions: this.champions(), data,
      match:privateAccess?this.match:undefined,
      sessions: !privateAccess?[]:this.db.prepare('SELECT id, name, saved_at AS savedAt FROM sessions WHERE owner=? ORDER BY id DESC LIMIT 50').all(this.owner()) as Snapshot['sessions'],
      simulations:!privateAccess?[]:this.db.prepare('SELECT id,name,saved_at AS savedAt FROM simulations WHERE owner=? ORDER BY id DESC LIMIT 200').all(this.owner()) as Snapshot['simulations'], update: this.update,evidenceRevision:this.dataRevision,cloud:this.cloud,coachRevision:this.get<number>('coachRevision')??0,knowledge:knowledgeSummary(this.knowledge,!!this.db.prepare('SELECT 1 FROM kv WHERE key=?').get('knowledgeStaged'),this.knowledgeMessage) };
  }
  validateSimulationDocument(raw:unknown):SimulationDocument {
    const document=simulationDocumentSchema.parse(raw),known=new Set(this.champions().map(c=>c.id));
    validateSimulation(document.draft,document.pins,known);
    validateDraft({...document.draft,history:document.history},known);
    const original=rewindDraft({...document.draft,history:document.history},document.draft.history.length);
    if(document.history.length<document.draft.history.length||JSON.stringify(document.draft.history)!==JSON.stringify(original.history))throw new Error('Simulation prefix mismatch');
    if(document.pins.some(p=>p.index<document.history.length&&(p.selection.championId!==document.history[p.index].championId||p.selection.role!==document.history[p.index].role)))throw new Error('Simulation lock mismatch');
    return document;
  }
  saveSimulation(raw:unknown):void {
    const document=this.validateSimulationDocument(raw);
    if((this.db.prepare('SELECT COUNT(*) AS n FROM simulations WHERE owner=?').get(this.owner()) as {n:number}).n>=200)throw new Error('200 simulations sauvegardées : supprimez une ancienne branche / Saved simulation limit reached');
    this.db.prepare('INSERT INTO simulations(name,saved_at,json,owner) VALUES(?,?,?,?)').run(document.name,new Date().toISOString(),JSON.stringify(document),this.owner());
  }
  simulation(id:number):SimulationDocument {
    const row=this.db.prepare('SELECT json FROM simulations WHERE id=? AND owner=?').get(id,this.owner()) as {json:string}|undefined;
    if(!row)throw new Error('Simulation introuvable / Simulation not found');
    return this.validateSimulationDocument(JSON.parse(row.json));
  }
  deleteSimulation(id:number):void {this.db.prepare('DELETE FROM simulations WHERE id=? AND owner=?').run(id,this.owner());}
  saveSession(name: string): void { this.db.prepare('INSERT INTO sessions (name,saved_at,json,owner) VALUES (?,?,?,?)').run(name, new Date().toISOString(), JSON.stringify({draft:this.draft,teams:this.teams}),this.owner()) }
  sessionContext(id:number):{draft:Draft;teams?:Teams}{const row=this.db.prepare('SELECT json FROM sessions WHERE id=? AND owner=?').get(id,this.owner()) as {json:string}|undefined;if(!row)throw new Error('Session not found');const raw=JSON.parse(row.json);return raw.draft?{draft:draftSchema.parse(raw.draft),teams:teamsSchema.parse(raw.teams)}:{draft:draftSchema.parse(raw)};}
  session(id: number): Draft {return this.sessionContext(id).draft;}
  log(level: string, message: string): void {
    this.db.prepare('INSERT INTO logs (at,level,message,owner) VALUES (?,?,?,?)').run(new Date().toISOString(), level, message.slice(0, 1000),this.owner());
    this.db.prepare('DELETE FROM logs WHERE id NOT IN (SELECT id FROM logs ORDER BY id DESC LIMIT 300)').run();
  }
  coachChanged():void {this.set('coachRevision',(this.get<number>('coachRevision')??0)+1);this.dataRevision++;}
  private invalidateModel():void {const model=this.get<DraftModel>('draftModel');if(model){this.set('draftModel',{...model,active:false,eligible:false,reasons:[...new Set([...model.reasons,'stale'])]});this.coachChanged();}}
  scrims():ScrimRecord[] {return (this.db.prepare('SELECT id,json FROM scrims ORDER BY id DESC LIMIT 2000').all() as {id:number;json:string}[]).map(r=>({...scrimSchema.parse(JSON.parse(r.json)),id:r.id}));}
  coach():CoachState {const games=this.engineInput().games??[],patches=latestPatches(games.map(g=>g.patch)),selected=games.filter(g=>patches.includes(g.patch));return {scrims:this.scrims(),model:this.get<DraftModel>('draftModel')??null,revision:this.get<number>('coachRevision')??0,coverage:{games:selected.length,ordered:selected.filter(g=>g.draftOrderKnown!==false&&g.history.length===20).length,dated:selected.filter(g=>!!g.playedAt).length,teams:selected.filter(g=>!!g.teams).length,patches}};}
  saveScrim(raw:ScrimDocument):void {const document=scrimSchema.parse(raw);validateDraft(document.draft,new Set(this.champions().map(c=>c.id)));if(this.scrims().length>=2000)throw new Error('Scrim limit reached');this.db.prepare('INSERT INTO scrims(json) VALUES(?)').run(JSON.stringify(document));this.invalidateModel();this.coachChanged();}
  updateScrim(id:number,raw:ScrimDocument):void{const document=scrimSchema.parse(raw);validateDraft(document.draft,new Set(this.champions().map(c=>c.id)));if(!this.db.prepare('UPDATE scrims SET json=? WHERE id=?').run(JSON.stringify(document),id).changes)throw new Error('Scrim not found');this.invalidateModel();this.coachChanged();}
  deleteScrim(id:number):void {this.db.prepare('DELETE FROM scrims WHERE id=?').run(id);this.invalidateModel();this.coachChanged();}
  replayScrim(id:number):void {const record=this.scrims().find(s=>s.id===id);if(!record)throw new Error('Scrim not found');if(this.draft.history.length)this.saveSession('Before scrim replay');this.draft=record.draft;this.teams=record.teams;this.persist();}
  storeModel(model:DraftModel):void {this.set('draftModel',model);this.coachChanged();}
  activateModel(active:boolean):void {const model=this.get<DraftModel>('draftModel');if(!model||(active&&!model.eligible))throw new Error('Model has not passed independent validation');this.storeModel({...model,active});}
  enrichGames(games:HistoricalGame[]):void {const lookup=new Map(games.map(g=>[g.id,g]));for(const pack of [...this.packs()])if(pack.games.length&&!pack.provenance.demo){const updated={...pack,games:pack.games.map(g=>lookup.get(g.id)??g)};if(JSON.stringify(updated.games)!==JSON.stringify(pack.games))this.importPack(updated);}this.coachChanged();}
  feedbackRecords(includeDeleted=false):CoachFeedback[]{if(this.cloud?.configured&&!this.cloud.authorized)return [];return (this.db.prepare('SELECT json,dirty FROM coach_feedback WHERE owner=? ORDER BY rowid DESC LIMIT 2000').all(this.owner()) as {json:string;dirty:number}[]).map(row=>({...JSON.parse(row.json),pending:!!row.dirty})).filter(row=>includeDeleted||!row.deleted);}
  private owner():string{return this.cloud?.configured?this.cloud.userId:'';}
  account(userId:string,admin:boolean):void {
    this.match=undefined;
    const saved=this.get<{draft:Draft;settings:Settings;teams:Teams}>('account:'+userId);
    if(saved){this.draft=draftSchema.parse(saved.draft);this.settings=settingsSchema.parse(saved.settings);this.teams=teamsSchema.parse(saved.teams);return;}
    if(admin&&!this.get('legacyAccountOwner')){this.db.transaction(()=>{for(const table of ['sessions','simulations','logs'])this.db.prepare("UPDATE "+table+" SET owner=? WHERE owner='' ").run(userId);this.set('legacyAccountOwner',userId);})();}
    else{this.draft=newDraft(this.get<string>('staticVersion')?.split('.').slice(0,2).join('.')??'unknown');this.settings=settingsSchema.parse({...DEFAULT_SETTINGS,language:this.settings.language,theme:this.settings.theme});this.teams=teamsSchema.parse({ally:{url:'',region:'euw',players:[],poolOnly:false,message:''},enemy:{url:'',region:'euw',players:[],poolOnly:false,message:''}});}
    this.persist();
  }
  close(): void { this.db.close() }
}
