export const ROLES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'] as const;
export type Role = typeof ROLES[number];
export type Side = 'blue' | 'red';
export type Mode = 'solo' | 'pro';
export type Lang = 'fr' | 'en';
export type Source = 'solo' | 'pro';
export interface Traits { ad: number; frontline: number; engage: number; peel: number; poke: number; scaling: number; early: number }
export interface Champion { id: string; key: number; name: string; roles: Role[]; traits: Traits; tags: string[]; curated: boolean; icon?: string }
export interface Action { kind: 'pick' | 'ban'; side: Side; label: string; phase: number }
export interface Selection { championId: string | null; role?: Role }
export interface SeriesGame { picks: string[]; history?: Selection[]; winner?: 'ally' | 'enemy'; side?: Side }
export interface FearlessSeries { format: 'single' | 'bo3' | 'bo5'; games: SeriesGame[] }
export interface Draft { mode: Mode; side: Side; role: Role; patch: string; rank: string; league: string; history: Selection[]; targetRole: Role | 'AUTO'; series?: FearlessSeries }
export interface Weights { winrate: number; matchup: number; synergy: number; meta: number; flex: number; order: number; composition: number; mastery: number }
export interface Settings { language: Lang; weights: Weights; banScoutingWeight: number; banImpactWeight?: number; pool: Record<string, number>; poolOnly: boolean; overlayOpacity: number; feedUrl: string; oldPatchDecay: number; scrapingEnabled: boolean; dataSource?: 'shared' | 'scrape' }
export interface Stat { championId: string; role: Role; patch: string; source: Source; rank: string; league: string; side: Side | 'all'; games: number; wins: number; pickRate: number; banRate: number; baseline: number; countMethod?: 'reported' | 'rounded_rate'; reportedWinRate?: number }
export interface PairStat { championId: string; otherId: string; role: Role; otherRole: Role; kind: 'synergy' | 'matchup'; patch: string; source: Source; rank: string; league: string; side: Side | 'all'; games: number; wins: number; baseline: number; countMethod?: 'reported' | 'rounded_rate'; reportedWinRate?: number }
export interface HistoricalGame { id: string; patch: string; league: string; tournament: string; winner: Side; durationSeconds?: number; goldDiff15?: number; objectives?: Record<string, number>; history: Selection[]; draftOrderKnown?: boolean; lineups?: Record<Side, { picks: { championId: string; role: Role }[]; bans: (string | null)[] }> }
export interface DataPack { schemaVersion: 1; id: string; createdAt: string; provenance: { name: string; url: string; license: string; demo: boolean }; stats: Stat[]; pairs: PairStat[]; games: HistoricalGame[] }
export interface DataStatus { staticVersion: string; lastRefresh?: string; refreshing: boolean; message: string; packs: { id: string; name: string; demo: boolean; rows: number; createdAt: string }[]; logs: { at: string; level: string; message: string }[]; patches: string[]; ranks: string[]; leagues: string[]; coverage: {source:Source;patches:string[];stats:number;pairs:number;games:number}[] }
export interface PlayerChampion { championId: string; games: number; wins: number; role?: Role }
export interface ScoutedPlayer { riotId: string; role: Role | 'AUTO'; pool: PlayerChampion[]; status: 'loaded' | 'manual' | 'unavailable'; message: string }
export interface ScoutedTeam { url: string; region: string; players: ScoutedPlayer[]; poolOnly: boolean; fetchedAt?: string; message: string }
export interface Teams { ally: ScoutedTeam; enemy: ScoutedTeam }
export interface Snapshot { draft: Draft; settings: Settings; teams: Teams; champions: Champion[]; data: DataStatus; sessions: { id: number; name: string; savedAt: string }[]; simulations: {id:number;name:string;savedAt:string}[]; update: string }
export interface BanScouting { riotId: string; games: number; wins: number; share: number; winrate: number | null; score: number; confidence: number; appliedWeight: number; declared: boolean }
export interface BanImpact { replacement: {championId:string;role:Role}|null; alternatives: number; enemyLoss: number; ownLoss: number; net: number; poolExhausted: boolean }
export interface ContextPart { key: 'lane' | 'opposition' | 'synergy' | 'plan' | 'bot'; label: string; score: number; baseWeight: number; weight: number; coverage: number }
export interface DraftContext { role: Role; score: number; parts: ContextPart[]; partial: boolean }
export interface BlindAssessment { score: number; statisticalScore: number; uncertaintyPenalty: number; developmentPenalty: number; coverage: number; assessed: number; available: number; threats: {championId:string;loss:number;share:number}[] }
export interface Recommendation { championId: string; role: Role; score: number; confidence: number; games: number; winrate: number | null; interval: [number, number] | null; factors: Weights; reasons: string[]; summary?: string; responseRisk: number; source: string; banScouting?: BanScouting; banImpact?: BanImpact; lowSample?: boolean; context?: DraftContext; blind?: BlindAssessment }
export type PlanKind = 'building' | 'front-to-back' | 'dive' | 'poke' | 'side' | 'mixed';
export interface GamePlan { kind: PlanKind; title: string; score: number; partial: boolean; profiled: number; axes: { lanes: number; objectives: number; teamfight: number; sideLane: number; execution: number }; timing: string; conditions: string[]; risks: string[]; needs: string[] }
export interface Composition { count: number; adShare: number; frontline: number; engage: number; peel: number; poke: number; early: number; scaling: number; archetype: string; strengths: string[]; weaknesses: string[]; quality: number }
export interface Prediction { championId: string; role: Role; preference: number }
export interface Duo { first: Recommendation; second: Recommendation; score: number; response: Prediction | null }
export interface Scenario { title: string; history: Selection[]; advantage: number; winProbability: number | null; explanation: string }
export interface DraftBalance { value: number; blue: {score:number;count:number}; red: {score:number;count:number}; revealed: number; complete: boolean }
export interface Analysis { picks: Recommendation[]; bans: Recommendation[]; enemies: Prediction[]; duos: Duo[]; scenarios: Scenario[]; ally: Composition; enemy: Composition; plans: {ally:GamePlan;enemy:GamePlan}; balance: DraftBalance; warnings: string[]; next: Action | null }
export interface EngineInput { draft: Draft; settings: Settings; teams?: Teams; champions: Champion[]; stats: Stat[]; pairs: PairStat[]; games?: HistoricalGame[]; demo: boolean }
export interface SimulationPin { index:number; selection:Selection }
export interface SimulationContext { settings:Settings; teams?:Teams }
export type SimulationApproach='balanced'|'engage'|'poke'|'tempo'|'scaling';
export interface SimulationRequest { id:string; draft:Draft; pins:SimulationPin[]; count:number; seed:number; context?:SimulationContext; approach?:SimulationApproach|'varied' }
export interface SimulationStep { index:number; selection:Selection; automatic:boolean; score:number|null; reasons:string[] }
export interface SimulationBranch { history:Selection[]; steps:SimulationStep[]; status:'complete'|'blocked'; blockedAt?:number; warnings:string[]; balance:DraftBalance; plans:Analysis['plans']; approach:SimulationApproach }
export interface SimulationBatch { branches:SimulationBranch[]; requested:number; attempts:number; elapsedMs:number; generatedAt:string; context:SimulationContext; warnings:string[] }
export interface SimulationDocument { name:string; draft:Draft; pins:SimulationPin[]; history:Selection[]; context?:SimulationContext; approach?:SimulationApproach|'varied' }
export interface SimulationProgress { id:string; completed:number; requested:number }
export interface DesktopApi {
  snapshot(): Promise<Snapshot>;
  configure(patch: Partial<Omit<Draft, 'history'>>): Promise<Snapshot>;
  select(championId: string | null, role?: Role): Promise<Snapshot>;
  undo(toIndex?: number): Promise<Snapshot>;
  reset(): Promise<Snapshot>;
  series(command: 'next' | 'previous' | 'reset', winner?: Side): Promise<Snapshot>;
  settings(value: Settings): Promise<Snapshot>;
  analyze(): Promise<Analysis>;
  simulate(request:SimulationRequest):Promise<SimulationBatch>;
  simulationOptions(request:{draft:Draft;pins:SimulationPin[];context?:SimulationContext}):Promise<Recommendation[]>;
  cancelSimulation(id:string):Promise<void>;
  saveSimulation(document:SimulationDocument):Promise<Snapshot>;
  loadSimulation(id:number):Promise<SimulationDocument>;
  deleteSimulation(id:number):Promise<Snapshot>;
  onSimulationProgress(callback:(progress:SimulationProgress)=>void):()=>void;
  scout(team: 'ally' | 'enemy', url: string): Promise<Snapshot>;
  teams(value: Teams): Promise<Snapshot>;
  refresh(): Promise<void>;
  importPack(): Promise<Snapshot>;
  demo(): Promise<Snapshot>;
  removePack(id: string): Promise<Snapshot>;
  saveSession(name: string): Promise<Snapshot>;
  loadSession(id: number): Promise<Snapshot>;
  exportSession(): Promise<void>;
  importSession(): Promise<Snapshot>;
  overlay(): Promise<void>;
  checkUpdate(): Promise<void>;
  installUpdate(): Promise<void>;
  onChange(callback: (snapshot: Snapshot) => void): () => void;
}
declare global { interface Window { draftApi: DesktopApi } }
