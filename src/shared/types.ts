import type { KnowledgeDataset,KnowledgeState,KnowledgeSummary,KnowledgeEvidence,MetaForecast } from './knowledge';
import type {CoachingMeta,CompositionDuty,CoachFeedback,FeedbackRequest,FeedbackState,CoachAdjustment,ProRule,ProView,ProGameContext} from './coaching';
export const ROLES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'] as const;
export type Role = typeof ROLES[number];
export type Side = 'blue' | 'red';
export type Mode = 'solo' | 'pro';
export type Lang = 'fr' | 'en';
export type Theme = 'dark' | 'light';
export type Source = 'solo' | 'pro';
export interface Traits { ad: number; frontline: number; engage: number; peel: number; poke: number; scaling: number; early: number }
export interface Champion { id: string; key: number; name: string; roles: Role[]; traits: Traits; tags: string[]; curated: boolean; icon?: string }
export interface Action { kind: 'pick' | 'ban'; side: Side; label: string; phase: number }
export interface Selection { championId: string | null; role?: Role }
export interface SeriesGame { picks: string[]; history?: Selection[]; winner?: 'ally' | 'enemy'; side?: Side }
export interface FearlessSeries { format: 'single' | 'bo3' | 'bo5'; games: SeriesGame[]; fearless?:boolean }
export interface Draft { teamNames?:{ally:string;enemy:string}; seriesName?:string; mode: Mode; side: Side; role: Role; patch: string; rank: string; league: string; history: Selection[]; targetRole: Role | 'AUTO'; series?: FearlessSeries }
export interface Weights { winrate: number; matchup: number; synergy: number; meta: number; flex: number; order: number; composition: number; mastery: number }
export interface Settings { proView?:ProView;teamStrengthCorrection?:boolean;proRules?:Record<string,ProRule>; strategyDepth?:2|3|4; strategyRisk?:number; theme?: Theme; language: Lang; weights: Weights; banScoutingWeight: number; banImpactWeight?: number; pool: Record<string, number>; poolOnly: boolean; overlayOpacity: number; feedUrl: string; oldPatchDecay: number; scrapingEnabled: boolean; dataSource?: 'shared' | 'scrape' }
export interface Stat { championId: string; role: Role; patch: string; source: Source; rank: string; league: string; side: Side | 'all'; games: number; wins: number; pickRate: number; banRate: number; baseline: number; countMethod?: 'reported' | 'rounded_rate'; reportedWinRate?: number }
export interface PairStat { championId: string; otherId: string; role: Role; otherRole: Role; kind: 'synergy' | 'matchup'; patch: string; source: Source; rank: string; league: string; side: Side | 'all'; games: number; wins: number; baseline: number; countMethod?: 'reported' | 'rounded_rate'; reportedWinRate?: number }
export interface HistoricalGame { id: string; patch: string; league: string; tournament: string; winner: Side; playedAt?:string; teams?:Record<Side,{id:string;name:string}>; durationSeconds?: number; goldDiff15?: number; objectives?: Record<string, number>; history: Selection[]; draftOrderKnown?: boolean; lineups?: Record<Side, { picks: { championId: string; role: Role }[]; bans: (string | null)[] }> }
export interface DataPack { schemaVersion: 1; id: string; createdAt: string; provenance: { name: string; url: string; license: string; demo: boolean }; stats: Stat[]; pairs: PairStat[]; games: HistoricalGame[] }
export interface DataStatus { staticVersion: string; lastRefresh?: string; refreshing: boolean; message: string; packs: { id: string; name: string; demo: boolean; rows: number; createdAt: string }[]; logs: { at: string; level: string; message: string }[]; patches: string[]; ranks: string[]; leagues: string[]; coverage: {source:Source;patches:string[];stats:number;pairs:number;games:number}[] }
export interface PlayerChampion { comfort?:number; championId: string; games: number; wins: number; role?: Role }
export interface ScoutedPlayer { riotId: string; role: Role | 'AUTO'; pool: PlayerChampion[]; status: 'loaded' | 'manual' | 'unavailable'; message: string }
export interface ScoutedTeam { url: string; region: string; players: ScoutedPlayer[]; poolOnly: boolean; fetchedAt?: string; message: string }
export interface Teams { ally: ScoutedTeam; enemy: ScoutedTeam }
export interface MatchSetup { name:string; kind:'scrim'|'official'|'practice'; ally:string; enemy:string; format:'single'|'bo3'|'bo5'; fearless:boolean; side:Side; patch:string; urls:{ally:string;enemy:string} }
export interface MatchDocument { name:string; kind:MatchSetup['kind']; draft:Draft; teams:Teams; archived:boolean; results:{game:number;id:number}[] }
export interface MatchPreparation { id:string; author:string; updatedAt:string; revision:number; document:MatchDocument; pending?:boolean; conflict?:boolean }
export interface MatchLibrary { matches:MatchPreparation[]; activeId:string|null; message:string }
export interface MatchResult { winner:Side; coachRating:number; kills:{blue:number;red:number}; notes:string }
export interface Snapshot { evidenceRevision?:number;match?:{id:string;name:string;kind:MatchSetup['kind'];archived:boolean;results:{game:number;id:number}[];message:string}; knowledge?:KnowledgeSummary; draft: Draft; settings: Settings; teams: Teams; champions: Champion[]; data: DataStatus; sessions: { id: number; name: string; savedAt: string }[]; simulations: {id:number;name:string;savedAt:string}[]; update: string; coachRevision?:number; cloud?:CloudState }
export interface BanScouting { riotId: string; games: number; wins: number; share: number; winrate: number | null; score: number; confidence: number; appliedWeight: number; declared: boolean }
export interface BanImpact { replacement: {championId:string;role:Role}|null; alternatives: number; enemyLoss: number; ownLoss: number; net: number; poolExhausted: boolean }
export interface ContextPart { key: 'lane' | 'opposition' | 'synergy' | 'plan' | 'bot'; label: string; score: number; baseWeight: number; weight: number; coverage: number }
export interface DraftContext { role: Role; score: number; parts: ContextPart[]; partial: boolean }
export interface BlindAssessment { score: number; statisticalScore: number; uncertaintyPenalty: number; developmentPenalty: number; coverage: number; assessed: number; available: number; threats: {championId:string;loss:number;share:number}[] }
export interface PickInteraction {championId:string;role:Role;effect:number;games:number;confidence:number;source:string;present:boolean;inPool:boolean;scope:'lane'|'composition'}
export interface PickInsight {championId:string;role:Role;side:Side;windows:{source:Source;patches:string[]}[];counters:PickInteraction[];favourable:PickInteraction[];synergies:PickInteraction[];strengths:string[];risks:string[];mechanics:{championId:string;direction:'good'|'risk';reason:string;condition:string}[];confidence:number;games:number;warnings:string[]}
export interface PickInsightRequest {championId:string;role:Role;side:Side}
export interface Recommendation { coachAdjustment?:CoachAdjustment; opening?:{games:number;firstShare:number;earlyShare:number;blindShare:number}; meta?:{priority:number;roles:Role[];roleSupport:Partial<Record<Role,number>>;proPresence:number|null;soloPresence:number|null}; alternatives?:{role:Role;score:number;blindScore?:number;after?:number}[]; viableRoles?: Role[]; championId: string; role: Role; score: number; confidence: number; games: number; winrate: number | null; interval: [number, number] | null; factors: Weights; reasons: string[]; summary?: string; responseRisk: number; source: string; banScouting?: BanScouting; banImpact?: BanImpact; lowSample?: boolean; context?: DraftContext; blind?: BlindAssessment; outlook?:StrategyOutlook }
export type PlanKind = 'building' | 'front-to-back' | 'dive' | 'poke' | 'side' | 'mixed';
export interface GamePlan { duties?:CompositionDuty[]; kind: PlanKind; title: string; score: number; partial: boolean; profiled: number; axes: { lanes: number; objectives: number; teamfight: number; sideLane: number; execution: number }; timing: string; conditions: string[]; risks: string[]; needs: string[] }
export interface Composition { count: number; adShare: number; frontline: number; engage: number; peel: number; poke: number; early: number; scaling: number; archetype: string; strengths: string[]; weaknesses: string[]; quality: number }
export interface Prediction { championId: string; role: Role; preference: number; basis?:'pool'|'meta'|'fallback'; quality?:number }
export interface Duo { first: Recommendation; second: Recommendation; score: number; response: Prediction | null }
export interface Scenario { title: string; history: Selection[]; advantage: number; winProbability: number | null; explanation: string }
export interface DraftBalance { value: number; blue: {score:number;count:number}; red: {score:number;count:number}; revealed: number; complete: boolean }
export interface Analysis { coaching?:CoachingMeta; picks: Recommendation[]; bans: Recommendation[]; enemies: Prediction[]; duos: Duo[]; scenarios: Scenario[]; ally: Composition; enemy: Composition; plans: {ally:GamePlan;enemy:GamePlan}; balance: DraftBalance; evaluation?:MatchEvaluation; strategy?:StrategyReport; warnings: string[]; next: Action | null }
export interface EngineInput { proContext?:Record<string,ProGameContext>;feedback?:CoachFeedback[];knowledge?:KnowledgeDataset; teamContext?:Record<Side,string>; teamProfiles?:TeamProfile[]; model?:DraftModel; draft: Draft; settings: Settings; teams?: Teams; champions: Champion[]; stats: Stat[]; pairs: PairStat[]; games?: HistoricalGame[]; demo: boolean }
export interface SimulationPin { index:number; selection:Selection }
export interface SimulationContext { settings:Settings; teams?:Teams }
export type SimulationApproach='balanced'|'engage'|'poke'|'tempo'|'scaling';
export interface SimulationRequest { id:string; draft:Draft; pins:SimulationPin[]; count:number; seed:number; context?:SimulationContext; approach?:SimulationApproach|'varied' }
export interface SimulationStep { index:number; selection:Selection; automatic:boolean; score:number|null; reasons:string[] }
export interface SimulationBranch { history:Selection[]; steps:SimulationStep[]; status:'complete'|'blocked'; blockedAt?:number; warnings:string[]; balance:DraftBalance; plans:Analysis['plans']; approach:SimulationApproach }
export interface SimulationBatch { branches:SimulationBranch[]; requested:number; attempts:number; elapsedMs:number; generatedAt:string; context:SimulationContext; warnings:string[] }
export interface SimulationDocument { name:string; draft:Draft; pins:SimulationPin[]; history:Selection[]; context?:SimulationContext; approach?:SimulationApproach|'varied' }
export interface SimulationProgress { id:string; completed:number; requested:number }
export interface SimulationTurnRequest { draft:Draft; pins:SimulationPin[]; context?:SimulationContext; approach?:SimulationApproach|'varied' }
export interface SimulationTurn { options:Recommendation[]; balance:DraftBalance; plans:Analysis['plans']; warnings:string[] }
export interface ReleaseNoteText { fr:string; en:string }
export interface ReleaseNoteSection { kind:'new'|'improved'|'fixed'; items:ReleaseNoteText[] }
export interface ReleaseNote { version:string; title:ReleaseNoteText; summary:ReleaseNoteText; sections:ReleaseNoteSection[] }
export interface ReleaseNotesStatus { currentVersion:string; lastSeenVersion:string|null; pending:boolean; entries:ReleaseNote[]; history:ReleaseNote[] }
export interface DesktopApi {
  feedback(all?:boolean):Promise<FeedbackState>;
  saveFeedback(request:FeedbackRequest):Promise<FeedbackState>;
  deleteFeedback(id:string):Promise<FeedbackState>;
  pickInsight(request:PickInsightRequest):Promise<PickInsight>;
  matches():Promise<MatchLibrary>;
  createMatch(setup:MatchSetup):Promise<Snapshot>;
  openMatch(id:string):Promise<Snapshot>;
  archiveMatch(id:string,archived:boolean):Promise<MatchLibrary>;
  recordMatchResult(result:MatchResult):Promise<Snapshot>;
  knowledge():Promise<KnowledgeState>;
  knowledgeForecast(patch:string):Promise<MetaForecast[]>;
  knowledgeEvidence(request:{championId:string;role:Role;enemyId:string;enemyRole:Role}):Promise<KnowledgeEvidence>;
  prepareKnowledge():Promise<KnowledgeState>;
  useLocalKnowledge():Promise<KnowledgeState>;
  publishKnowledge():Promise<KnowledgeState>;
  openKnowledgeSource(url:string):Promise<void>;
  snapshot(): Promise<Snapshot>;
  prepareDraftData():Promise<Snapshot>;
  cloudLogin(email:string,password:string):Promise<Snapshot>;
  cloudSignup(email:string,password:string,code:string):Promise<{message:string}>;
  cloudLogout():Promise<Snapshot>;
  cloudWorkspace(userId:string):Promise<Snapshot>;
  cloudInvite(email:string):Promise<{code:string;email:string;expiresAt:string}>;
  copyInvitation(code:string):Promise<void>;
  strategy(request:StrategyRequest):Promise<StrategyReport>;
  coach():Promise<CoachState>;
  saveScrim(document:ScrimDocument):Promise<CoachState>;
  updateScrim(id:number,document:ScrimDocument):Promise<CoachState>;
  deleteScrim(id:number):Promise<CoachState>;
  replayScrim(id:number):Promise<Snapshot>;
  exportScrims():Promise<void>;
  trainModel():Promise<CoachState>;
  activateModel(active:boolean):Promise<CoachState>;
  enrichLocalData():Promise<CoachState>;
  configure(patch: Partial<Omit<Draft, 'history'>>): Promise<Snapshot>;
  select(championId: string | null, role?: Role): Promise<Snapshot>;
  undo(toIndex?: number): Promise<Snapshot>;
  reset(): Promise<Snapshot>;
  series(command: 'next' | 'previous' | 'reset', winner?: Side): Promise<Snapshot>;
  settings(value: Settings): Promise<Snapshot>;
  analyze(): Promise<Analysis>;
  simulate(request:SimulationRequest):Promise<SimulationBatch>;
  simulationOptions(request:{draft:Draft;pins:SimulationPin[];context?:SimulationContext}):Promise<Recommendation[]>;
  simulationTurn(request:SimulationTurnRequest):Promise<SimulationTurn>;
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
  releaseNotes():Promise<ReleaseNotesStatus>;
  acknowledgeReleaseNotes(version:string):Promise<void>;
  onChange(callback: (snapshot: Snapshot) => void): () => void;
}
declare global { interface Window { draftApi: DesktopApi } }

export interface Mechanics { range:number; control:number; waveclear:number; access:number; disengage:number; sustained:number; mobility:number; demand:number; provenance:'curated'|'generic' }
export type MatchAxis='lanes'|'bot'|'objectives'|'fight'|'access'|'side'|'execution';
export interface MatchEvaluation { value:number; axes:{key:MatchAxis;blue:number;red:number;value:number}[]; windows:{early:number;mid:number;late:number}; evidence:number; partial:boolean; reasons:string[]; features:Record<string,number>; modelUsed:boolean }
export interface StrategyNode { index:number; selection:Selection; side:Side; kind:'pick'|'ban'; preference:number|null; value:number; children:StrategyNode[]; blocked?:boolean }
export interface StrategyOutlook { immediate:number; expected:number; worst:number; after:number; futureCost:number; searched:boolean; nodes:StrategyNode[] }
export interface StrategyReport { horizon:number; roots:number; evaluated:number; limited:boolean; elapsedMs:number; perspective:Side; options:Recommendation[]; warning:string }
export interface StrategyRequest { draft:Draft; pins:SimulationPin[]; depth:2|3|4; risk:number; roots:Selection[] }
export interface ScrimDocument { blueTeam?:string;redTeam?:string;seriesName?:string;kills?:{blue:number;red:number}; name:string; playedAt:string; draft:Draft; teams:Teams; winner:Side|null; coachRating:number; notes:string; rival:string }
export interface ScrimRecord extends ScrimDocument { id:number; author?:string }
export interface ModelMetrics { games:number; logLoss:number; brier:number; accuracy:number }
export interface DraftModel { baselineName?:string; datasetRevision?:string; schema:1; id:string; trainedAt:string; features:Record<string,number>; train:ModelMetrics; test:ModelMetrics; baseline:ModelMetrics; patches:string[]; teamsCoverage:number; datesCoverage:number; eligible:boolean; reasons:string[]; fingerprint:string; active:boolean }
export interface CoachState { workspaces?:CloudWorkspace[]; activeModel?:DraftModel; scrims:ScrimRecord[]; model:DraftModel|null; coverage:{games:number;ordered:number;dated:number;teams:number;patches:string[]}; revision:number }

export interface CloudState {configured:boolean;authorized:boolean;email:string;userId:string;role:'owner'|'coach'|null;organizationId:string;message:string;syncing:boolean;revision?:string}

export interface TeamProfile {key:string;games:number;features:Record<string,number>}

export interface CloudWorkspace {user_id:string;label:string;draft:Draft;teams:Teams;updated_at:string}
