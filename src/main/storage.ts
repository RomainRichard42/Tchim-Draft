import Database from 'better-sqlite3';
import type { Champion, DataPack, DataStatus, Draft, EngineInput, Settings, Snapshot, Teams, SimulationDocument } from '../shared/types';
import { SEED_CHAMPIONS, DEFAULT_SETTINGS } from '../shared/champions';
import { newDraft } from '../shared/draft';
import { draftSchema, settingsSchema, teamsSchema, simulationDocumentSchema } from '../shared/validation';
import { validateSimulation } from '../shared/simulation';
import { validateDraft } from '../shared/series';
import { latestPatches } from '../shared/patches';
import path from 'node:path';
import { validateDataPack } from '../shared/validate-pack';
import { mergeDataPacks } from '../shared/packs';
import type { DatasetManifest } from '../shared/dataset';

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
      PRAGMA user_version = 1;`);
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
  persist(): void { this.db.transaction(() => { this.set('draft', this.draft); this.set('settings', this.settings); this.set('teams',this.teams) })() }
  champions(): Champion[] { return (this.db.prepare('SELECT json FROM champions ORDER BY id').all() as { json: string }[]).map(r => JSON.parse(r.json)) }
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
    this.merged=undefined;this.dataRevision++;
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
    this.packCache=undefined;this.merged=undefined;this.packSignature=this.signature();this.dataRevision++;
  }
  removePack(id: string): void {
    const match=/^lolalytics-(\d+\.\d+)-master_plus$/.exec(id),shared=/^shared-(solo|pro)-(\d+\.\d+)-\d+$/.exec(id),prefix=shared?`shared-${shared[1]}-${shared[2]}-`:match?`lolalytics-${match[1]}-`:undefined;
    if(prefix)this.db.prepare('DELETE FROM packs WHERE id LIKE ?').run(`${prefix}%`);else this.db.prepare('DELETE FROM packs WHERE id = ?').run(id);
    if(this.packCache)this.packCache=this.packCache.filter(p=>prefix?!p.id.startsWith(prefix):p.id!==id);
    this.packSignature=this.signature();this.merged=undefined;this.dataRevision++;
  }
  engineInput(): EngineInput {
    const packs = this.packs();
    const configuration={draft:this.draft,settings:this.settings,teams:this.teams,champions:this.champions()};
    if(this.merged)return {...configuration,...this.merged};
    this.merged=mergeDataPacks(packs);
    return {...configuration,...this.merged};
  }
  snapshot(): Snapshot {
    const packs = this.packs(), input=this.engineInput(), stats=input.stats;
    const external=this.collecting();
    const data: DataStatus = { staticVersion: this.get('staticVersion') ?? 'offline', lastRefresh: this.get('lastRefresh'), refreshing: this.refreshing||external, message: external?(this.get<string>('scrapeProgress')??this.message):this.message,
      packs: packs.map(p => ({ id: p.id, name: p.provenance.name, demo: p.provenance.demo, rows: p.stats.length + p.pairs.length, createdAt: p.createdAt })),
      logs: this.db.prepare('SELECT at, level, message FROM logs ORDER BY id DESC LIMIT 30').all() as DataStatus['logs'],
      patches: [...new Set([this.draft.patch, ...(this.get<string>('staticVersion') ? [this.get<string>('staticVersion')!.split('.').slice(0, 2).join('.')] : []), ...stats.map(s => s.patch.split('.').slice(0, 2).join('.'))])].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })),
      ranks: [...new Set(['all', 'EMERALD_PLUS', 'DIAMOND_PLUS', 'MASTER_PLUS', 'GOLD', ...stats.map(s => s.rank)])],
      leagues: [...new Set(['all', 'LCK', 'LPL', 'LEC', 'LCS', 'WORLDS', ...stats.map(s => s.league),...packs.flatMap(p=>p.games.map(g=>g.league))])],
      coverage: (['solo','pro'] as const).map(source=>{const rows=stats.filter(s=>s.source===source),patches=latestPatches(rows.map(s=>s.patch));return {source,patches,stats:rows.filter(r=>patches.includes(r.patch)).length,pairs:input.pairs.filter(r=>r.source===source&&patches.includes(r.patch)).length,games:source==='pro'?(input.games??[]).filter(g=>patches.includes(g.patch)).length:0};}) };
    return { draft: this.draft, settings: this.settings, teams: this.teams, champions: this.champions(), data,
      sessions: this.db.prepare('SELECT id, name, saved_at AS savedAt FROM sessions ORDER BY id DESC LIMIT 50').all() as Snapshot['sessions'],
      simulations:this.db.prepare('SELECT id,name,saved_at AS savedAt FROM simulations ORDER BY id DESC LIMIT 200').all() as Snapshot['simulations'], update: this.update };
  }
  validateSimulationDocument(raw:unknown):SimulationDocument {
    const document=simulationDocumentSchema.parse(raw),known=new Set(this.champions().map(c=>c.id));
    validateSimulation(document.draft,document.pins,known);
    validateDraft({...document.draft,history:document.history},known);
    if(document.history.length<document.draft.history.length||document.draft.history.some((s,i)=>JSON.stringify(s)!==JSON.stringify(document.history[i])))throw new Error('Simulation prefix mismatch');
    if(document.pins.some(p=>p.index<document.history.length&&(p.selection.championId!==document.history[p.index].championId||p.selection.role!==document.history[p.index].role)))throw new Error('Simulation lock mismatch');
    return document;
  }
  saveSimulation(raw:unknown):void {
    const document=this.validateSimulationDocument(raw);
    if((this.db.prepare('SELECT COUNT(*) AS n FROM simulations').get() as {n:number}).n>=200)throw new Error('200 simulations sauvegardées : supprimez une ancienne branche / Saved simulation limit reached');
    this.db.prepare('INSERT INTO simulations(name,saved_at,json) VALUES(?,?,?)').run(document.name,new Date().toISOString(),JSON.stringify(document));
  }
  simulation(id:number):SimulationDocument {
    const row=this.db.prepare('SELECT json FROM simulations WHERE id=?').get(id) as {json:string}|undefined;
    if(!row)throw new Error('Simulation introuvable / Simulation not found');
    return this.validateSimulationDocument(JSON.parse(row.json));
  }
  deleteSimulation(id:number):void {this.db.prepare('DELETE FROM simulations WHERE id=?').run(id);}
  saveSession(name: string): void { this.db.prepare('INSERT INTO sessions (name,saved_at,json) VALUES (?,?,?)').run(name, new Date().toISOString(), JSON.stringify(this.draft)) }
  session(id: number): Draft { const row = this.db.prepare('SELECT json FROM sessions WHERE id = ?').get(id) as { json: string } | undefined; if (!row) throw new Error('Session not found'); return draftSchema.parse(JSON.parse(row.json)) }
  log(level: string, message: string): void {
    this.db.prepare('INSERT INTO logs (at,level,message) VALUES (?,?,?)').run(new Date().toISOString(), level, message.slice(0, 1000));
    this.db.prepare('DELETE FROM logs WHERE id NOT IN (SELECT id FROM logs ORDER BY id DESC LIMIT 300)').run();
  }
  close(): void { this.db.close() }
}
