import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, BarChart3, Check, ChevronRight, CircleHelp, Database, Download, Eye, GitBranch, Layers3, ListFilter, LoaderCircle, Monitor, Plus, RefreshCw, Save, Search, Settings2, Shield, ShieldBan, Sparkles, Swords, Undo2, Users, X } from 'lucide-react';
import type { Analysis, Champion, Composition, Draft, Duo, Recommendation, Role, Settings, Side, Snapshot, Weights, ReleaseNotesStatus } from '../shared/types';
import { ROLES } from '../shared/types';
import { fearlessUsed, freeRoles, opposite, order, picks, seriesFinished, used } from '../shared/draft';
import { translations, type Labels } from './i18n';
import { TeamsPanel } from './TeamsPanel';
import { DraftBalancePanel } from './DraftBalancePanel';
import { FearlessPanel } from './FearlessPanel';
import { GamePlanPanel } from './GamePlanPanel';
import { DecisionDesk } from './DecisionDesk';
import { UpdateStatus } from './UpdateStatus';
import { RoleContextDetails } from './RoleContextDetails';
import { BlindDetails } from './BlindDetails';
import { Portrait } from './ChampionPortrait';
import { ChampionArtwork } from './ChampionArtwork';
import { PoolPanel } from './PoolPanel';
import { SettingsPanel } from './SettingsPanel';
import { DataPanel } from './DataPanel';
import { DraftComposition, DraftResponses } from './DraftAssessment';
import { FaceExplanation } from './FaceExplanation';
import { SimulationsPanel } from './SimulationsPanel';
import { ReleaseNotesPanel } from './ReleaseNotesPanel';

const api = window.draftApi;
declare const __APP_VERSION__: string;
const isOverlay = new URLSearchParams(location.search).has('overlay');
type Tab = 'draft' | 'simulations' | 'teams' | 'pool' | 'data' | 'settings';
const roleLabel: Record<Role, string> = { TOP: 'TOP', JUNGLE: 'JGL', MID: 'MID', ADC: 'ADC', SUPPORT: 'SUP' };
const legal = 'Tchim Draft is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.';

function Meter({ value, className = '' }: { value: number; className?: string }) { return <span className={`meter ${className}`}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }}/></span> }
function Modal({ title, close, children, className = '' }: { title: string; close: () => void; children: React.ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('input,button,select')?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const nodes = box.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,textarea,[tabindex="0"]');
        if (!nodes?.length) return; const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    };
    window.addEventListener('keydown', handler); return () => { window.removeEventListener('keydown', handler); previous?.focus() };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close() }}><div className={`modal ${className}`} ref={box} role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={close} aria-label="Close"><X size={19}/></button></div>{children}</div></div>;
}
export function App() {
  const [snap, setSnap] = useState<Snapshot>(), [analysis, setAnalysis] = useState<Analysis>(), [tab, setTab] = useState<Tab>('draft');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [analyzing, setAnalyzing] = useState(false);
  const [picker, setPicker] = useState<{ championId?: string; role?: Role } | null>(null), [inspect, setInspect] = useState<Recommendation | null>(null);
  const [sessionModal, setSessionModal] = useState(false), [sessionName, setSessionName] = useState(''), [rewind, setRewind] = useState<number | null>(null);
  const [query, setQuery] = useState(''), [filterRole, setFilterRole] = useState<Role | 'ALL'>('ALL');
  const [selected, setSelected] = useState<string | null>(null), [pickRole, setPickRole] = useState<Role>('MID');
  const [settingsForm, setSettingsForm] = useState<Settings>();
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [releaseNotes,setReleaseNotes]=useState<ReleaseNotesStatus>(),[showReleaseNotes,setShowReleaseNotes]=useState(false),[notesClosing,setNotesClosing]=useState(false),[notesError,setNotesError]=useState('');
  const [draftInfo, setDraftInfo] = useState<'order' | 'series' | 'plans' | null>(null);
  const previousStep = useRef<number | undefined>(undefined);
  const version = useRef(0);
  const settingsKey = JSON.stringify(snap?.settings);
  const analysisKey = JSON.stringify([snap?.draft, snap?.settings && { ...snap.settings, theme: undefined }, snap?.teams, snap?.data.packs, snap?.data.staticVersion]);
  async function act(task: () => Promise<unknown>) { setBusy(true); setError(''); try { await task() } catch (e) { setError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : String(e)) } finally { setBusy(false) } }
  async function openReleaseNotes() {
    try { const notes=await api.releaseNotes();setReleaseNotes(notes);setNotesError('');setShowReleaseNotes(true); }
    catch(e){setError(String(e));}
  }
  async function closeReleaseNotes() {
    if(!releaseNotes||notesClosing)return;
    setNotesClosing(true);setNotesError('');
    try{await api.acknowledgeReleaseNotes(releaseNotes.currentVersion);setShowReleaseNotes(false);setReleaseNotes({...releaseNotes,pending:false});}
    catch(e){setNotesError(snap?.settings.language==='en'?'Could not save. Please try again.':'Impossible d’enregistrer. Réessaie dans un instant.');}
    finally{setNotesClosing(false);}
  }
  useEffect(()=>{
    if(!api||isOverlay)return;
    let live=true;
    void api.releaseNotes().then(notes=>{if(live){setReleaseNotes(notes);setShowReleaseNotes(notes.pending);}}).catch(e=>{if(live)setError(String(e));});
    return ()=>{live=false;};
  },[]);
  function refresh() { setError(''); void api.refresh().catch(e => setError(e instanceof Error ? e.message : String(e))) }
  useEffect(() => {
    if (!api) { setError('Cette interface nécessite Electron. Lancez npm run dev. / Run inside Electron.'); return }
    void api.snapshot().then(setSnap).catch(e => setError(String(e)));
    return api.onChange(setSnap);
  }, []);
  useEffect(() => {
    if (!snap) return;
    const id = ++version.current; setAnalyzing(true);
    const timer = setTimeout(() => { void api.analyze().then(a => { if (id === version.current) setAnalysis(a) }).catch(e => { if (id === version.current) setError(String(e)) }).finally(() => { if (id === version.current) setAnalyzing(false) }) }, 70);
    return () => clearTimeout(timer);
  }, [analysisKey]);
  useEffect(() => setFocusKey(null), [analysisKey]);
  useEffect(() => {
    if (previousStep.current !== undefined && previousStep.current !== 20 && !isOverlay && snap?.draft.mode === 'pro' && snap.draft.history.length === 20 && ['bo3', 'bo5'].includes(snap.draft.series?.format ?? 'single')) setDraftInfo('series');
    previousStep.current = snap?.draft.history.length;
  }, [snap?.draft.history.length, snap?.draft.series?.format]);
  useEffect(() => { if (snap) setSettingsForm(current => current ? { ...snap.settings, weights: current.weights, banScoutingWeight: current.banScoutingWeight, banImpactWeight: current.banImpactWeight, oldPatchDecay: current.oldPatchDecay, overlayOpacity: current.overlayOpacity } : snap.settings) }, [settingsKey]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      if (showReleaseNotes || tab !== 'draft' || draftInfo || sessionModal || busy || analyzing) return;
      if (e.key.toLowerCase() === 'k' && snap && snap.draft.history.length < order(snap.draft).length) { e.preventDefault(); setPicker({}) }
      if (e.key.toLowerCase() === 'z' && !picker && !inspect && rewind === null) { e.preventDefault(); void act(() => api.undo()) }
    }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [picker, inspect, rewind, draftInfo, sessionModal, busy, analyzing, snap?.draft.history.length, tab, showReleaseNotes]);
  useEffect(() => {
    if (!picker || !snap) return;
    setQuery(''); setFilterRole('ALL'); setSelected(picker.championId ?? null);
    const action = order(snap.draft)[snap.draft.history.length];
    const roles = freeRoles(snap.draft, action?.side ?? snap.draft.side);
    setPickRole(picker.role && roles.includes(picker.role) ? picker.role : roles.includes(snap.draft.role) ? snap.draft.role : roles[0] ?? 'MID');
  }, [picker]);
  if (!snap) return <div className="boot-error"><div className="brand-mark">T<span/></div><h2>Tchim Draft</h2><p>{error || 'Ouverture de votre espace de draft…'}</p></div>;
  const t = translations(snap.settings.language), d = snap.draft, sequence = order(d), next = sequence[d.history.length], champions = new Map(snap.champions.map(c => [c.id, c]));
  const find = (id: string | null | undefined) => id ? champions.get(id) : undefined;
  const change = (value: Partial<Omit<Draft, 'history'>>) => void act(() => api.configure(value));
  const updateSettings = (value: Settings) => void act(() => api.settings(value));
  const choose = (rec: Recommendation) => setPicker({ championId: rec.championId, role: rec.role });
  const list = next?.kind === 'ban' ? analysis?.bans : analysis?.picks;
  const focused = list?.find(r => `${r.championId}:${r.role}` === focusKey) ?? list?.[0];
  const preview = (r: Recommendation) => setFocusKey(`${r.championId}:${r.role}`);
  const fr = snap.settings.language === 'fr';
  const seriesComplete = seriesFinished(d);
  const dataState = snap.data.packs.some(p => !p.demo) ? t.realLabel : snap.data.packs.length ? t.demoLabel : t.heuristic;

  function recommendationCard(r: Recommendation, index: number, compact = false) {
    const c = find(r.championId);
    return <div key={`${r.championId}:${r.role}`} className={`recommendation ${index === 0 ? 'best' : ''} ${compact ? 'compact' : ''}`}>
      <span className="rec-position">{String(index + 1).padStart(2, '0')}</span><Portrait champion={c} size="medium"/>
      <div className="rec-body"><div className="rec-name">{compact ? <strong>{c?.name ?? r.championId}</strong> : <button className="focus-row-name" onClick={() => preview(r)} disabled={analyzing}><strong>{c?.name ?? r.championId}</strong></button>}<span className="role-tag">{roleLabel[r.role]}</span>{index === 0 && <Sparkles size={13}/>}</div>
        {!compact && <p>{r.summary ?? r.reasons[0]}</p>}
        <div className="rec-meta">{r.winrate !== null ? <span><b>{(r.winrate * 100).toFixed(1)}%</b> {t.winrate} · {r.games.toLocaleString()} {t.gamesLabel}</span> : <span>{r.lowSample?`${snap!.settings.language==='fr'?'Échantillon insuffisant':'Insufficient sample'} · ${r.games} ${t.gamesLabel}`:t.qualitative}</span>}{!compact && <button disabled={analyzing} onClick={() => { preview(r); setInspect(r) }}>{t.why} <ChevronRight size={12}/></button>}</div>
        {!compact&&<div className="rec-evidence"><span className={r.confidence<20?'limited':''}>{snap!.settings.language==='fr'?'Fiabilité':'Reliability'} {r.confidence}%</span>{r.blind&&<span className={r.blind.coverage<.5||r.blind.score<47?'limited':''}>{snap!.settings.language==='fr'?(r.blind.coverage<.5?'Blind peu documenté':r.blind.score<47?'Blind exposé':'Blind à vérifier'):(r.blind.coverage<.5?'Limited blind data':r.blind.score<47?'Exposed blind':'Check blind')}</span>}{r.banImpact&&<span>{snap!.settings.language==='fr'?'Remplacement':'Replacement'} : {find(r.banImpact.replacement?.championId)?.name??'—'} · {snap!.settings.language==='fr'?'net':'net'} {r.banImpact.net>0?'+':''}{r.banImpact.net}</span>}</div>}
      </div><div className="rec-score"><strong>{r.score.toFixed(1)}</strong><span>/ 100</span></div>
      <button className={index === 0 ? 'pick-button primary' : 'pick-button'} onClick={() => choose(r)} disabled={busy || !next || analyzing} aria-label={`${t.select} ${c?.name}`}><Plus size={16}/>{!compact && <span>{next?.kind === 'ban' ? t.ban : t.pick}</span>}</button>
    </div>;
  }
  function compositionCard(comp: Composition | undefined, label: string, color: string) {
    if (!comp) return null;
    return <div className={`composition-card ${color}`}><div className="section-label">{label}<span>{comp.count}/5</span></div><h3>{comp.archetype}</h3>
      <div className="damage-label"><span>AD {(comp.adShare * 100).toFixed(0)}%</span><span>AP {((1 - comp.adShare) * 100).toFixed(0)}%</span></div><Meter value={comp.adShare * 100} className="damage-meter"/>
      <div className="comp-numbers"><div><Shield size={14}/><b>{comp.frontline.toFixed(0)}</b><span>{t.frontline}</span></div><div><Swords size={14}/><b>{comp.engage.toFixed(0)}</b><span>{t.engage}</span></div></div>
      <div className="power-row"><span>{t.early}</span><Meter value={comp.early}/><b>{comp.early.toFixed(0)}</b></div><div className="power-row"><span>{t.scaling}</span><Meter value={comp.scaling}/><b>{comp.scaling.toFixed(0)}</b></div>
      <div className="composition-notes">{comp.strengths.map(s => <span key={s}><Check size={12}/>{s}</span>)}{comp.weaknesses.map(s => <span className="weak" key={s}><CircleHelp size={12}/>{s}</span>)}</div>
    </div>;
  }
  function teamPanel(side: Side) {
    const ally = side === d.side, teamPicks = picks(d, side);
    const banSlots = sequence.map((action, index) => ({ ...action, index })).filter(action => action.kind === 'ban' && action.side === side);
    return <aside className={`team-panel face-team ${side}`} data-testid={`focus-team-${ally ? 'ally' : 'enemy'}`}>
      <div className="team-header"><Shield size={20}/><h2>{ally ? t.ally : t.enemy}</h2><span className="team-counter">{teamPicks.length}<small>/5</small></span></div>
      <div className="team-slots">{ROLES.map(role => {
        const p = teamPicks.find(p => p.role === role), c = find(p?.championId), active = next?.kind === 'pick' && next.side === side && !p;
        return <button className={`team-slot ${c ? 'filled' : ''} ${active ? 'eligible' : ''}`} key={role} data-face-role={role} title={c?.name ?? `${roleLabel[role]} · ${t.empty}`} aria-label={`${ally ? t.ally : t.enemy} · ${roleLabel[role]} · ${c?.name ?? t.empty}`} onClick={() => {
          if (p) setRewind(d.history.findIndex(s => s.championId === p.championId));
          else if (active) setPicker({ role });
        }} disabled={busy || analyzing || (!p && !active)}><span className="slot-role">{roleLabel[role]}</span><Portrait champion={c} size="draft"/><span className="slot-name"><strong>{c?.name ?? (fr ? 'À choisir' : 'To pick')}</strong></span></button>;
      })}</div>
      <div className="ban-area"><div className="section-label">{t.bans}<ShieldBan size={13}/></div><div className="ban-row">{banSlots.map(action => <button key={action.index} className={`ban-slot ${action.index === d.history.length ? 'active' : ''}`} title={`${action.label}${d.history[action.index]?.championId ? ` · ${find(d.history[action.index].championId)?.name}` : ''}`} aria-label={`${ally ? t.ally : t.enemy} · ${t.ban} ${action.label}`} onClick={() => {
        if (action.index < d.history.length) setRewind(action.index);
        else if (action.index === d.history.length) setPicker({});
      }} disabled={busy || analyzing || action.index > d.history.length}><Portrait champion={find(d.history[action.index]?.championId)} size="draft-ban" banned/><span className="ban-name">{find(d.history[action.index]?.championId)?.name ?? "—"}</span>{action.index < d.history.length && !d.history[action.index]?.championId && <span className="no-ban">—</span>}</button>)}</div></div>
    </aside>;
  }
  function draftTimeline() {
    return <div className="draft-timeline">{(['ban', 'pick'] as const).map(kind => <div className="timeline-row" key={kind}><span>{kind === 'ban' ? t.bans : 'PICKS'}</span><div className="timeline-track">{sequence.map((action, i) => action.kind === kind && <button key={i} className={`${action.side} ${action.kind} ${i < d.history.length ? 'done' : ''} ${i === d.history.length ? 'current' : ''}`} onClick={() => { setDraftInfo(null); if (i < d.history.length) setRewind(i); else if (i === d.history.length) setPicker({}); }} disabled={busy || analyzing || i > d.history.length} aria-label={`${t.step} ${i + 1} · ${action.label}`} title={`${i + 1} · ${action.label}`}><span>{i + 1}</span></button>)}</div></div>)}</div>;
  }
  if (isOverlay) return <div className="overlay-app constructivist-overlay" data-theme={snap.settings.theme ?? "dark"} data-testid="app"><div className="overlay-top"><div className="brand-mark small">T<span/></div><strong>TCHIM <span>DRAFT</span></strong><button className="icon-button" onClick={() => void api.overlay()} aria-label={t.close}><X size={16}/></button></div><div className="overlay-content"><div className="section-label">{t.overlayTitle}<span className="live-dot"/></div><h2>{next ? `${next.label} · ${next.side === d.side ? t.ally : t.enemy}` : t.complete}</h2><span className="source-badge">{dataState}</span><DraftBalancePanel balance={analysis?.balance} side={d.side} t={t} compact pending={analyzing}/>{error && <p className="error-inline">{error}</p>}{list?.slice(0, 3).map((r, i) => recommendationCard(r, i, true))}<div className="overlay-predictions"><span className="eyebrow">{t.response}</span>{analysis?.enemies.slice(0, 3).map(p => <div key={p.championId}><Portrait champion={find(p.championId)} size="tiny"/><span>{find(p.championId)?.name}</span><b>{(p.preference * 100).toFixed(0)}%</b></div>)}<small>{t.preference}</small></div><p className="muted small-text">{t.noProbability}</p><button className="wide-button" onClick={() => void act(() => api.undo())} disabled={!d.history.length}><Undo2 size={14}/>{t.undo}</button></div>{picker && pickerDialog()}</div>;

  function pickerDialog() {
    const roles = freeRoles(d, next?.side ?? d.side), locked = new Set([...used(d),...fearlessUsed(d)]);
    const currentSideBans = new Set(d.history.flatMap((s, i) => sequence[i].side === next?.side && sequence[i].kind === 'ban' && s.championId ? [s.championId] : []));
    const available = snap!.champions.filter(c => (!locked.has(c.id) || (d.mode === 'solo' && next?.kind === 'ban' && !currentSideBans.has(c.id))) && (!query || c.name.toLowerCase().includes(query.toLowerCase()) || c.id.toLowerCase().includes(query.toLowerCase())) && (filterRole === 'ALL' || c.roles.includes(filterRole)));
    return <Modal title={`${t.choose} · ${next?.label ?? t.complete}`} close={() => setPicker(null)}><div className="picker-search"><Search size={18}/><input autoFocus placeholder={t.search} value={query} onChange={e => setQuery(e.target.value)}/></div><div className="role-filters">{(['ALL', ...ROLES] as const).map(r => <button key={r} className={filterRole === r ? 'active' : ''} onClick={() => setFilterRole(r)}>{r === 'ALL' ? t.all : roleLabel[r]}</button>)}</div>
      <div className="champion-grid">{available.map(c => <button key={c.id} className={`champion-option ${selected === c.id ? 'selected' : ''}`} onClick={() => { setSelected(c.id); const compatible = c.roles.find(r => roles.includes(r)); if (compatible && !c.roles.includes(pickRole)) setPickRole(compatible) }}><Portrait champion={c} size="large"/><strong>{c.name}</strong><small>{c.roles.length ? c.roles.map(r => roleLabel[r]).join(' / ') : '?'}</small></button>)}</div>
      <div className="picker-footer"><div>{selected && <><strong>{find(selected)?.name}</strong>{next?.kind === 'pick' && <label>{t.chooseRole}<select value={pickRole} onChange={e => setPickRole(e.target.value as Role)}>{roles.map(r => <option key={r} value={r}>{r}</option>)}</select></label>}</>}</div><div className="button-row">{next?.kind === 'ban' && <button onClick={() => void act(async () => { await api.select(null); setPicker(null) })} disabled={busy}>{t.skip}</button>}<button className="primary" disabled={!selected || busy || !next} onClick={() => void act(async () => { await api.select(selected, next?.kind === 'pick' ? pickRole : undefined); setPicker(null) })}>{t.confirm}<ArrowRight size={14}/></button></div></div>{error && <p className="error-inline">{error}</p>}</Modal>;
  }
  return <div className={`desktop-app constructivist-app ${tab === 'draft' ? 'is-draft' : tab === 'simulations' ? 'is-simulations' : ''}`} data-theme={snap.settings.theme ?? 'dark'} data-page={tab} data-testid="app"><div className="main-shell">
    <aside className="draft-sidebar"><strong className="sidebar-brand"><span>TD</span>TCHIM<br/>DRAFT</strong><nav className="focus-nav" aria-label={fr ? 'Navigation principale' : 'Main navigation'}>{([
      ['draft', Swords], ['teams', Users], ['simulations', GitBranch], ['pool', Shield], ['data', Database], ['settings', Settings2]
    ] as const).map(([id, Icon]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)} aria-label={t[id]}><Icon size={23}/><span>{t[id]}</span></button>)}</nav><span className="sidebar-version">v{__APP_VERSION__}</span></aside>
    <header className="app-header focus-header"><h1>{tab === 'draft' ? (fr ? 'Draft en direct' : 'Live draft') : t[tab]}</h1><span className="source-badge">{dataState}</span><div className="header-right"><UpdateStatus compact status={snap.update} language={snap.settings.language} onCheck={()=>void act(()=>api.checkUpdate())} onInstall={()=>void act(()=>api.installUpdate())}/><button onClick={() => setTab('teams')} className="focus-opgg"><Users size={18}/>{fr ? 'Importer OP.GG' : 'Import OP.GG'}</button><button onClick={() => void act(() => api.overlay())}><Layers3 size={18}/>{t.overlay}</button></div></header>
    <main className={tab === 'draft' ? 'draft-page' : tab === 'simulations' ? 'simulation-page' : undefined}>{tab !== 'draft' && tab !== 'simulations' && <section className="page-heading"><div><h1>{tab === 'teams' ? t.teams : tab === 'pool' ? t.poolTitle : tab === 'data' ? t.dataTitle : tab === 'settings' ? t.settingsTitle : t.simulationTitle}</h1><p>{tab === 'teams' ? (fr ? 'Deux équipes, dix joueurs. Les pools guident toute la draft compétitive.' : 'Two teams, ten players. Champion pools guide the competitive draft.') : tab === 'pool' ? t.poolBody : tab === 'data' ? t.dataBody : tab === 'settings' ? t.settingsBody : t.simulationBody}</p></div><span className="source-badge">{dataState}</span></section>}
    {error && <div className="error-banner" role="alert"><CircleHelp size={17}/><span>{error}</span><button className="icon-button" onClick={() => setError('')}><X size={15}/></button></div>}
    {tab === 'draft' && <div className="focus-toolbar face-toolbar"><div className="draft-filters"><div className="mode-switch"><button className={d.mode === 'pro' ? 'active' : ''} disabled={!!d.history.length} onClick={() => change({ mode: 'pro' })}><Swords size={14}/>{t.pro}</button><button className={d.mode === 'solo' ? 'active' : ''} disabled={!!d.history.length} onClick={() => change({ mode: 'solo' })}>{t.solo}</button></div><label>{t.patch}<select value={d.patch} onChange={e => change({ patch: e.target.value })}>{snap.data.patches.map(p => <option key={p} value={p}>{p === 'unknown' ? t.unknownPatch : p}</option>)}</select></label><label>{d.mode === 'pro' ? t.league : t.rank}<select value={d.mode === 'pro' ? d.league : d.rank} onChange={e => change(d.mode === 'pro' ? { league: e.target.value } : { rank: e.target.value })}>{(d.mode === 'pro' ? snap.data.leagues : ['MASTER_PLUS']).map(v => <option key={v} value={v}>{v === 'all' ? t.all : v.replace('_PLUS', '+')}</option>)}</select></label><label>{t.side}<select value={d.side} onChange={e => change({ side: e.target.value as Side })}><option value="blue">{t.blue}</option><option value="red">{t.red}</option></select></label>{d.mode==='pro'&&<label>Fearless<select aria-label={snap.settings.language==='fr'?'Format Fearless':'Fearless format'} value={d.series?.format??'single'} disabled={busy||analyzing||!!d.series?.games.length} onChange={e=>change({series:{format:e.target.value as 'single'|'bo3'|'bo5',games:[]}})}><option value="single">{snap.settings.language==='fr'?'Désactivé':'Disabled'}</option><option value="bo3">BO3</option><option value="bo5">BO5</option></select></label>}{d.mode === 'solo' && <label>{t.role}<select value={d.role} onChange={e => change({ role: e.target.value as Role })}>{ROLES.map(r => <option key={r}>{r}</option>)}</select></label>}<button className="icon-button" title={t.reset} aria-label={t.reset} onClick={() => void act(() => api.reset())}><RefreshCw size={16}/></button></div>{tab === 'draft' && d.mode === 'pro' && d.series?.format !== 'single' && <button className="face-series-button" aria-label={fr ? "Historique Fearless" : "Fearless history"} onClick={() => setDraftInfo('series')}><ShieldBan size={16}/><span className="series-full">{d.series?.format.toUpperCase()} · {seriesComplete ? (fr ? 'Série terminée' : 'Series complete') : `${fr ? 'Manche' : 'Game'} ${(d.series?.games.length ?? 0) + 1}`} · {fearlessUsed(d).size} {fr ? 'indisponibles' : 'unavailable'}</span><span className="series-short">{d.series?.format.toUpperCase()}</span></button>}</div>}
    {tab === 'teams' && <TeamsPanel snapshot={snap} onError={setError} onReady={() => setTab("draft")}/>}

    {tab === 'draft' && <>
      <div className="draft-board">{teamPanel(d.side)}<div className="face-status"><div className={`recommendation-heading turn-guide ${next?.side === d.side ? 'our-turn' : 'enemy-turn'}`}><h2>{next && <span>{next.label} · </span>}{!next ? (seriesComplete ? (fr ? 'Série terminée' : 'Series complete') : t.complete) : next.kind === 'ban' ? (next.side === d.side ? t.yourBanTurn : t.enemyBanTurn) : next.side === d.side ? (fr ? 'À nous de choisir' : 'Our next choice') : t.enemyPickTurn}</h2><p>{seriesComplete ? `${d.series?.games.length} ${fr ? 'manches archivées' : 'archived games'}` : `${t.step} ${Math.min(d.history.length + 1, sequence.length)}/${sequence.length} · ${analyzing ? t.waiting : next ? (next.side === d.side ? t.ally : t.enemy) : t.balanceComplete}`}</p></div><DraftBalancePanel balance={analysis?.balance} side={d.side} t={t} pending={analyzing} face/>{draftTimeline()}</div>{teamPanel(opposite(d.side))}</div>
      <div className="draft-workspace face-workspace">
        <DraftComposition analysis={analysis} language={snap.settings.language} details={() => setDraftInfo('plans')}/>
        <section className="recommendation-panel face-options">
          <div className="face-options-heading"><h2>{next?.side !== d.side && next ? (fr ? 'Options adverses' : 'Enemy options') : next?.kind === 'ban' ? (fr ? 'Nos bans' : 'Our bans') : (fr ? 'Nos options' : 'Our options')}</h2>{next?.kind !== 'ban' && next && <select aria-label={t.recommendedRole} value={d.targetRole} disabled={busy || analyzing} onChange={e => change({ targetRole: e.target.value as Role | 'AUTO' })}><option value="AUTO">{t.allFreeRoles}</option>{freeRoles(d, next?.side ?? d.side).map(r => <option key={r}>{r}</option>)}</select>}</div>
          <DecisionDesk side={next?.side ?? d.side} list={next ? list ?? [] : []} focused={focused} champions={champions} language={snap.settings.language} isBan={next?.kind === 'ban'} step={d.history.length} complete={!next} pending={analyzing} disabled={busy || analyzing || !next || !!picker || !!inspect || rewind !== null || sessionModal || !!draftInfo || showReleaseNotes} choose={choose} preview={preview} inspect={setInspect}/>
          {!!analysis?.duos.length && <details className="duo-block focus-duos face-duos"><summary><Layers3 size={17}/>{t.duo} · {analysis.duos.length} {fr ? 'paires' : 'pairs'}</summary><p>{t.duoSub}</p>{analysis.duos.map((duo, i) => <div className="duo-row" key={i}><div className="duo-portraits"><Portrait champion={find(duo.first.championId)}/><Portrait champion={find(duo.second.championId)}/></div><div><strong>{find(duo.first.championId)?.name} + {find(duo.second.championId)?.name}</strong><small>{duo.first.role} / {duo.second.role} · {t.against} : {find(duo.response?.championId)?.name ?? '—'}</small></div><b>{duo.score}</b><button title={t.lockDuo} aria-label={t.lockDuo} disabled={busy || analyzing} onClick={() => void act(async () => { await api.select(duo.first.championId, duo.first.role); await api.select(duo.second.championId, duo.second.role) })}><Plus size={17}/></button></div>)}</details>}
        </section>
        <DraftResponses analysis={analysis} champions={champions} language={snap.settings.language} enemySide={opposite(d.side)} pending={analyzing} details={() => setDraftInfo('plans')}/>
      </div>
      <div className="draft-bottom face-bottom"><div className="button-row"><button disabled={!d.history.length || busy || analyzing} onClick={() => void act(() => api.undo())} aria-label={t.undo}><Undo2 size={18}/>{fr ? 'Annuler' : 'Undo'}</button><button onClick={() => setSessionModal(true)}><Save size={18}/>{t.sessions}</button><button onClick={() => setDraftInfo('order')}><GitBranch size={18}/>{fr ? 'Ordre de draft' : 'Draft order'}</button><button onClick={() => setDraftInfo('plans')}><BarChart3 size={18}/>{fr ? 'Plans des équipes' : 'Team plans'}</button></div>
        <button className="manual-choice" onClick={() => setPicker({})} disabled={!next || busy || analyzing} aria-label={t.choose}><Plus size={19}/>{fr ? 'Choisir manuellement' : 'Choose manually'}</button>
      </div>
    </>}
    <SimulationsPanel snapshot={snap} active={tab === 'simulations'}/>
    {tab === 'pool' && <PoolPanel snapshot={snap} busy={busy} onSettings={updateSettings} onParameters={() => setTab('settings')}/>}
    {tab === 'data' && <DataPanel snapshot={snap} busy={busy} refresh={refresh} onSettings={updateSettings} act={act}/>}
    {tab === 'settings' && settingsForm && <SettingsPanel snapshot={snap} form={settingsForm} onForm={setSettingsForm} busy={busy} onSettings={updateSettings} onReleaseNotes={() => void openReleaseNotes()} act={act}/>}

    </main><footer className="app-footer"><span>{legal}</span><span>DESKTOP · LOCAL · V1</span></footer></div>
    {showReleaseNotes && releaseNotes && <Modal title={fr?'Nouveautés de Tchim Draft':'What is new in Tchim Draft'} className="release-notes-modal" close={()=>void closeReleaseNotes()}><ReleaseNotesPanel status={releaseNotes} language={snap.settings.language} closing={notesClosing} error={notesError} close={()=>void closeReleaseNotes()}/></Modal>}
    {draftInfo && <Modal title={draftInfo === 'order' ? (fr ? 'Ordre de draft' : 'Draft order') : draftInfo === 'series' ? (fr ? 'Historique Fearless' : 'Fearless history') : (fr ? 'Plans des équipes' : 'Team plans')} close={() => setDraftInfo(null)}>
      {draftInfo === 'order' && <div className="face-order-dialog">{draftTimeline()}<ol className="face-order-list">{sequence.map((action, i) => <li key={i} className={action.side}><span>{i + 1} · {action.label}</span><strong>{find(d.history[i]?.championId)?.name ?? (i < d.history.length ? (fr ? 'Ban passé' : 'Skipped ban') : '—')}</strong>{d.history[i]?.role && <span>{roleLabel[d.history[i].role!]}</span>}</li>)}</ol></div>}
      {draftInfo === 'series' && <FearlessPanel snapshot={snap} busy={busy || analyzing} act={act}/>}
      {draftInfo === 'plans' && <div className="face-plans-dialog">{analysis && <><h2 className={d.side}>{t.ally}</h2><GamePlanPanel plan={analysis.plans.ally} language={snap.settings.language}/>{compositionCard(analysis.ally, t.ally, d.side)}<h2 className={opposite(d.side)}>{t.enemy}</h2><GamePlanPanel plan={analysis.plans.enemy} language={snap.settings.language}/>{compositionCard(analysis.enemy, t.enemy, opposite(d.side))}<h2>{t.response}</h2><div className="face-response-list">{analysis.enemies.slice(0, 3).map(p => <div key={`${p.championId}:${p.role}`}><Portrait champion={find(p.championId)} size="medium"/><strong>{find(p.championId)?.name}</strong><span>{roleLabel[p.role]} · {(p.preference * 100).toFixed(0)}% {t.preference}</span></div>)}</div></>}<details className="face-sources"><summary><Database size={17}/>{dataState} · {fr ? 'Sources et limites' : 'Sources and limitations'}</summary><p>Lolalytics Master+ + gol.gg · {snap.data.staticVersion}</p>{snap.data.coverage.map(c => <p key={c.source}>{c.source === 'solo' ? 'Lolalytics' : 'gol.gg'} : {c.patches.join(' / ') || '—'}</p>)}<p>OP.GG : {snap.teams.ally.players.length}/5 {t.ally} · {snap.teams.enemy.players.length}/5 {t.enemy}</p>{analysis?.warnings.map(w => <p key={w}>{w}</p>)}<p>{t.noProbability}</p><p>{legal}</p></details></div>}
    </Modal>}
    {picker && pickerDialog()}
    {inspect && <Modal title={`${find(inspect.championId)?.name} · ${t.why}`} close={() => setInspect(null)}><div className="inspect-header"><Portrait champion={find(inspect.championId)} size="large"/><div><span className="role-tag">{inspect.role}</span><h2>{inspect.score}/100</h2><p>{t.score}</p></div><div className="inspect-confidence"><b>{inspect.confidence}%</b><span>{t.confidence}</span></div></div><ul className="reason-list">{inspect.reasons.map(reason => <li key={reason}><Check size={14}/>{reason}</li>)}</ul>{inspect.banScouting && inspect.banScouting.appliedWeight > 0 && <div className="factor-row" data-testid="ban-scouting-factor"><span>{t.banScoutingFactor}</span><Meter value={inspect.banScouting.score}/><b>{inspect.banScouting.score.toFixed(0)}</b></div>}{inspect.banImpact&&<div className="ban-impact-detail" data-testid="ban-impact-detail"><strong>{snap.settings.language==='fr'?'Conséquences du ban':'Ban consequences'}</strong><p>{snap.settings.language==='fr'?'Alternative adverse':'Enemy alternative'} : {find(inspect.banImpact.replacement?.championId)?.name??'—'} · {inspect.banImpact.alternatives} {snap.settings.language==='fr'?'options':'options'}</p><p>{snap.settings.language==='fr'?'Perte adverse / coût allié / net':'Enemy loss / own cost / net'} : {inspect.banImpact.enemyLoss} / {inspect.banImpact.ownLoss} / {inspect.banImpact.net}</p><small>{snap.settings.language==='fr'?'Estimation heuristique du prochain pick, dans les filtres et pools connus.':'Heuristic next-pick estimate within known filters and pools.'}</small></div>}{inspect.blind&&<BlindDetails blind={inspect.blind} champions={snap.champions} language={snap.settings.language}/>}
<FaceExplanation recommendation={inspect} snapshot={snap} analysis={analysis} champions={champions} pending={analyzing} details={() => {}}/>
{inspect.context&&<RoleContextDetails context={inspect.context} language={snap.settings.language}/>}
{(Object.keys(inspect.factors) as (keyof Weights)[]).filter(key=>!inspect.context||!['matchup','synergy','composition'].includes(key)).map(key => <div className="factor-row" key={key}><span>{key === 'composition' ? t.composition : t[key]}</span><Meter value={inspect.factors[key]}/><b>{inspect.factors[key].toFixed(0)}</b></div>)}{inspect.interval && <p className="muted small-text">Wilson 95% · {(inspect.interval[0] * 100).toFixed(1)}–{(inspect.interval[1] * 100).toFixed(1)}% · {t.source}: {inspect.source}</p>}<p className="muted small-text">{t.noProbability}</p><button className="primary" disabled={!next} onClick={() => { choose(inspect); setInspect(null) }}>{t.select}<Plus size={15}/></button></Modal>}
    {rewind !== null && <Modal title={`${t.step} ${rewind + 1} · ${sequence[rewind]?.label}`} close={() => setRewind(null)}><p>{t.rewind}</p><div className="button-row"><button onClick={() => setRewind(null)}>{t.cancel}</button><button className="primary" onClick={() => void act(async () => { await api.undo(rewind); setRewind(null) })}>{t.back}<Undo2 size={14}/></button></div></Modal>}
    {sessionModal && <Modal title={t.sessions} close={() => setSessionModal(false)}><div className="session-save"><input className="text-input" value={sessionName} placeholder={t.name} onChange={e => setSessionName(e.target.value)}/><button className="primary" disabled={!sessionName.trim() || busy} onClick={() => void act(async () => { await api.saveSession(sessionName); setSessionName('') })}><Save size={14}/>{t.save}</button></div><div className="session-list">{snap.sessions.map(s => <div key={s.id}><div><strong>{s.name}</strong><small>{new Date(s.savedAt).toLocaleString()}</small></div><button onClick={() => void act(async () => { await api.loadSession(s.id); setSessionModal(false) })}>{t.load}<ArrowRight size={13}/></button></div>)}{!snap.sessions.length && <p className="muted">{t.noSessions}</p>}</div><div className="button-row"><button onClick={() => void act(() => api.exportSession())}><ArrowDownToLine size={14}/>{t.export}</button><button onClick={() => void act(() => api.importSession())}><Download size={14}/>{t.import}</button></div>{error && <p className="error-inline">{error}</p>}</Modal>}
  </div>;
}
