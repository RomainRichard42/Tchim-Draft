import type { Analysis, Champion, Composition, Draft, DraftBalance, Duo, EngineInput, PairStat, Prediction, Recommendation, Role, Scenario, Side, Stat, Weights } from '../shared/types';
import { fearlessUsed, freeRoles, opposite, order, picks, used } from '../shared/draft';
import { clamp, patchDistance, posterior, softmax, wilson } from './math';
import { latestPatches } from '../shared/patches';
import { damageShare, teamplay } from './teamplay';
import { scoutingBan } from './scouting';
import { gamePlan } from './gameplan';
import { banConsequences } from './ban-impact';

function text(input: EngineInput, fr: string, en: string): string { return input.settings.language === 'fr' ? fr : en }
interface Prepared {
  stats: Map<string, Stat[]>; pairs: Map<string, PairStat[]>; roles: Map<string, Set<Role>>;
  aggregates: Map<string, ReturnType<typeof aggregate>>;
  historical: Map<string, { early: number; total: number }>;
  windows: Record<'solo'|'pro',string[]>;
  configuration: string;
}
const preparedCache = new WeakMap<Stat[], Prepared>();
function prepare(input: EngineInput): Prepared {
  const configuration=`${input.draft.league}|${input.settings.oldPatchDecay}`;
  const existing = preparedCache.get(input.stats); if (existing?.configuration===configuration) return existing;
  const patches=(source:'solo'|'pro')=>{const stat=input.stats.filter(s=>s.source===source&&(source==='pro'||s.rank==='MASTER_PLUS'||s.rank==='all'));return latestPatches((stat.length?stat:input.pairs.filter(p=>p.source===source)).map(s=>s.patch));};
  const data: Prepared = { stats: new Map(), pairs: new Map(), roles: new Map(), aggregates: new Map(), historical: new Map(),windows:{solo:patches('solo'),pro:patches('pro')},configuration };
  for (const row of input.stats) {
    const key = `${row.championId}|${row.role}`, values = data.stats.get(key) ?? []; values.push(row); data.stats.set(key, values);
    const roles = data.roles.get(row.championId) ?? new Set<Role>(); roles.add(row.role); data.roles.set(row.championId, roles);
  }
  for (const row of input.pairs) {
    const key = `${row.kind}|${row.championId}|${row.role}|${row.otherId}|${row.otherRole}`, values = data.pairs.get(key) ?? []; values.push(row); data.pairs.set(key, values);
  }
  for (const game of input.games ?? []) {
    if (game.draftOrderKnown === false) continue;
    const age = data.windows.pro.indexOf(game.patch);
    if (age < 0 || (game.league !== input.draft.league && input.draft.league !== 'all')) continue;
    const weight = Math.pow(input.settings.oldPatchDecay, age), seq = order({ ...input.draft, mode: 'pro' });
    game.history.forEach((s, i) => {
      if (!s.championId || seq[i].kind !== 'pick') return;
      const key = `${s.championId}|${s.role}|${seq[i].side}`, current = data.historical.get(key) ?? { early: 0, total: 0 };
      current.total += weight; if (i < 9) current.early += weight; data.historical.set(key, current);
    });
  }
  preparedCache.set(input.stats, data); return data;
}
function eligible<T extends Stat | PairStat>(rows: T[], input: EngineInput, side: Side): { row: T; age: number }[] {
  const selected = rows.filter(r => {
    const window=prepare(input).windows[r.source],age = window.indexOf(r.patch.split('.').slice(0,2).join('.'));
    return age >= 0 && (age === 0 || input.settings.oldPatchDecay > 0) &&
      (r.side === side || r.side === 'all') && (r.source==='pro'||r.rank==='MASTER_PLUS'||r.rank==='all') &&
      (r.league === input.draft.league || r.league === 'all');
  });
  // Prefer the most specific slice, never add a global aggregate to its subset.
  const best = new Map<string, T>();
  const specificity = (r: T) => Number(r.side === side) * 4 + Number(r.rank === 'MASTER_PLUS') * 2 + Number(r.league === input.draft.league && r.league !== 'all');
  for (const row of selected) {
    const key = [row.source, row.patch.split('.').slice(0, 2).join('.'), row.championId, row.role, 'otherId' in row ? `${row.otherId}:${row.otherRole}:${row.kind}` : ''].join('|');
    const current = best.get(key); if (!current || specificity(row) > specificity(current)) best.set(key, row);
  }
  return [...best.values()].map(row => ({ row, age: prepare(input).windows[row.source].indexOf(row.patch.split('.').slice(0,2).join('.')) }));
}
function aggregate(rows: (Stat | PairStat)[], input: EngineInput, side: Side) {
  const filtered = eligible(rows, input, side);
  const groups = (['solo', 'pro'] as const).flatMap(source => {
    const selected = filtered.filter(r => r.row.source === source);
    if (!selected.length) return [];
    let n = 0, wins = 0, baselineTotal = 0, pickRate = 0, banRate = 0, exposure=0;
    for (const { row, age } of selected) {
      const discount = Math.pow(input.settings.oldPatchDecay, age);
      n += row.games * discount; wins += row.wins * discount; baselineTotal += row.baseline * row.games * discount;
      if ('pickRate' in row) { const population=row.pickRate>0?row.games/row.pickRate:row.games;exposure+=population*discount;pickRate += row.pickRate * population * discount; banRate += row.banRate * population * discount }
    }
    const baseline = baselineTotal / n, estimate = posterior(wins, n, baseline, source === 'pro' ? 50 : 200);
    const desired = input.draft.mode === 'pro' ? (source === 'pro' ? .55 : .45) : (source === 'solo' ? .9 : .1);
    const mixture=desired*n/(n+(source==='pro'?80:800));
    const usable=n >= (source==='pro'?10:200), support=usable?n/(n+(source==='pro'?50:200)):0;
    return [{ source, n, wins, baseline, estimate, pickRate: exposure?pickRate / exposure:0, banRate: exposure?banRate / exposure:0, mixture, usable, support }];
  });
  if (!groups.length) return null;
  const totalWeight = groups.reduce((s, g) => s + g.mixture, 0);
  const avg = (fn: (g: typeof groups[number]) => number) => groups.reduce((s, g) => s + fn(g) * g.mixture, 0) / totalWeight;
  // Each source gets a prior of its own. The mixture never lets the larger solo sample swamp pro data.
  const uncertainty = groups.map(g => wilson(g.wins, g.n));
  return { estimate: avg(g => g.estimate), delta: avg(g => (g.estimate - g.baseline)*g.support), n: groups.reduce((s, g) => s + g.n, 0), usable:groups.some(g=>g.usable),
    confidence: avg(g => g.usable?g.n / (g.n + (g.source === 'pro' ? 100 : 1000)):0),
    interval: [avg(g => uncertainty[groups.indexOf(g)][0]), avg(g => uncertainty[groups.indexOf(g)][1])] as [number, number],
    pickRate: avg(g => g.pickRate), banRate: avg(g => g.banRate), groups, sources: groups.map(g => g.source).join(' + '), old: filtered.some(r => r.age > 0), rounded: filtered.some(r => r.row.countMethod === 'rounded_rate') };
}
export function composition(champions: Champion[], language = 'fr',roles:Role[]=[]): Composition {
  const count = champions.length, sum = (key: keyof Champion['traits']) => champions.reduce((s, c) => s + c.traits[key], 0);
  const adShare = damageShare(champions,roles), frontline = sum('frontline'), engage = sum('engage'), peel = sum('peel'), poke = sum('poke');
  const early = count ? sum('early') / count / 3 * 100 : 0, scaling = count ? sum('scaling') / count / 3 * 100 : 0;
  const fr = language === 'fr', strengths: string[] = [], weaknesses: string[] = [];
  if (count) {
    (frontline >= 3 ? strengths : weaknesses).push(fr ? (frontline >= 3 ? 'Frontline disponible' : 'Frontline fragile') : (frontline >= 3 ? 'Frontline available' : 'Fragile frontline'));
    (engage >= 3 ? strengths : weaknesses).push(fr ? (engage >= 3 ? 'Initiation disponible' : 'Peu d’initiation fiable') : (engage >= 3 ? 'Engage available' : 'Limited reliable engage'));
    if (count >= 3 && (adShare > 0.8 || adShare < 0.2)) weaknesses.push(fr ? 'Dégâts trop homogènes' : 'Damage is too one-sided');
    if (scaling >= 70) strengths.push(fr ? 'Bonne montée en puissance' : 'Strong scaling');
    if (peel < 3 && count >= 3) weaknesses.push(fr ? 'Protection des carries limitée' : 'Limited carry protection');
  }
  const archetype = !count ? (fr ? 'À construire' : 'Not built yet') : poke >= count * 1.8 ? 'Poke / siege' : engage >= count * 1.9 ? (fr ? 'Engage / teamfight' : 'Engage / teamfight') : scaling > 72 ? 'Scaling / front-to-back' : (fr ? 'Composition mixte' : 'Mixed composition');
  const quality = count ? clamp(30 + Math.min(frontline, 6) * 3 + Math.min(engage, 6) * 3 + Math.min(peel, 6) * 2 + (1 - Math.abs(adShare - 0.5) * 2) * 18) : 50;
  return { count, adShare, frontline, engage, peel, poke, early, scaling, archetype, strengths, weaknesses, quality };
}
function team(input: EngineInput, side: Side): Champion[] { return picks(input.draft, side).flatMap(p => input.champions.find(c => c.id === p.championId) ?? []) }
function pairRows(input: EngineInput, candidate: Champion, role: Role, target: { championId: string | null; role: Role }, kind: PairStat['kind']): PairStat[] {
  const prepared = prepare(input);
  const direct = prepared.pairs.get(`${kind}|${candidate.id}|${role}|${target.championId}|${target.role}`) ?? [];
  if (direct.length) return direct;
  return (prepared.pairs.get(`${kind}|${target.championId}|${target.role}|${candidate.id}|${role}`) ?? [])
    .map(p => ({ ...p, championId: candidate.id, otherId: target.championId!, role, otherRole: target.role,
      wins: kind === 'matchup' ? p.games - p.wins : p.wins, baseline: kind === 'matchup' ? 1 - p.baseline : p.baseline,
      side: kind === 'matchup' && p.side !== 'all' ? opposite(p.side) : p.side }));
}
function rankCandidates(input: EngineInput, side: Side, restrictRole: Role | 'AUTO' = 'AUTO', usePool = true, useFamiliarity = true, candidateId?:string): Recommendation[] {
  const availableRoles = freeRoles(input.draft, side), locked = new Set([...used(input.draft),...fearlessUsed(input.draft)]), allies = picks(input.draft, side), enemies = picks(input.draft, opposite(side));
  const allyTeam = team(input, side), before = composition(allyTeam,'fr',allies.map(a=>a.role)), enemyTeam = team(input, opposite(side));
  const pickIndex = allies.length, early = pickIndex < 2, last = pickIndex === 4;
  const beforePlan=gamePlan(allyTeam,allies.map(a=>a.role),enemyTeam,enemies.map(e=>e.role),input.settings.language);
  const results: Recommendation[] = [], prepared = prepare(input);
  const scout=input.teams?.[side===input.draft.side?'ally':'enemy'];
  const summary = (key: string, rows: (Stat | PairStat)[]) => {
    const cacheKey = `${side}|${input.draft.mode}|${input.draft.patch}|${input.draft.rank}|${input.draft.league}|${input.settings.oldPatchDecay}|${key}`;
    if (!prepared.aggregates.has(cacheKey)) prepared.aggregates.set(cacheKey, aggregate(rows, input, side));
    return prepared.aggregates.get(cacheKey)!;
  };
  for (const c of input.champions) {
    if (locked.has(c.id)||(candidateId&&c.id!==candidateId)) continue;
    for (const role of availableRoles.filter(r => (restrictRole === 'AUTO' || r === restrictRole) && (candidateId||c.roles.includes(r) || prepared.roles.get(c.id)?.has(r)))) {
      const players=scout?.players.filter(p=>p.role===role||(p.role==='AUTO'&&!scout.players.some(other=>other.role===role)))??[];
      const playerOptions=players.flatMap(p=>p.pool.filter(ch=>ch.championId===c.id&&(!ch.role||ch.role===role)&&(ch.games>=3||(ch.games===0&&p.status==='manual'))).map(ch=>({player:p,games:ch.games})));
      const familiarity=playerOptions.sort((a,b)=>b.games-a.games)[0];
      if(!candidateId&&scout?.poolOnly&&players.length&&players.every(p=>p.pool.length>0)&&!familiarity)continue;
      if (usePool && side === input.draft.side && input.draft.mode==='solo'&&input.settings.poolOnly && role === input.draft.role && !(input.settings.pool[c.id] > 0)) continue;
      const stats = summary(`stat|${c.id}|${role}`, prepared.stats.get(`${c.id}|${role}`) ?? []);
      const pro=stats?.groups.find(g=>g.source==='pro');
      const championPro=[...prepared.roles.get(c.id)??[]].reduce((n,r)=>n+(summary(`stat|${c.id}|${r}`,prepared.stats.get(`${c.id}|${r}`)??[])?.groups.find(g=>g.source==='pro')?.n??0),0);
      const championSolo=[...prepared.roles.get(c.id)??[]].reduce((n,r)=>n+(summary(`stat|${c.id}|${r}`,prepared.stats.get(`${c.id}|${r}`)??[])?.groups.find(g=>g.source==='solo')?.n??0),0);
      const observedRole=(s:typeof stats)=>s?.groups.some(g=>g.usable&&g.pickRate>=.005&&g.n/Math.max(1,g.source==='pro'?championPro:championSolo)>=.1);
      if(input.stats.length&&!candidateId){
        if(!observedRole(stats)&&!(familiarity?.player.pool.some(p=>p.championId===c.id&&p.role===role)))continue;
      }
      const matchups = enemies.flatMap(e => summary(`matchup|${c.id}|${role}|${e.championId}|${e.role}`, pairRows(input, c, role, e, 'matchup')) ?? []);
      const synergies = allies.flatMap(a => summary(`synergy|${c.id}|${role}|${a.championId}|${a.role}`, pairRows(input, c, role, a, 'synergy')) ?? []);
      const matchup = matchups.length ? clamp(50 + matchups.reduce((s, m) => s + m.delta, 0) / enemies.length * 400) : 50;
      const contextual=teamplay(c,role,allyTeam,allies.map(a=>a.role),enemyTeam,input.settings.language);
      const statisticalSynergy = synergies.length ? clamp(50 + synergies.reduce((s, m) => s + m.delta, 0) / allies.length * 450) : 50;
      const afterPlan=gamePlan([...allyTeam,c],[...allies.map(a=>a.role),role],enemyTeam,enemies.map(e=>e.role),input.settings.language);
      const planContribution=allies.length?clamp(50+(afterPlan.score-beforePlan.score)*1.5):50;
      const synergy=clamp(statisticalSynergy+(contextual.synergy-50)*.5),comp=clamp(contextual.score*.65+planContribution*.35);
      // Unseen lanes imply risk: early selections reward role ambiguity and protection.
      const opponentLane = enemies.find(e => e.role === role);
      const viableRoles=[...prepared.roles.get(c.id)??c.roles].filter(r=>input.stats.length?observedRole(summary(`stat|${c.id}|${r}`,prepared.stats.get(`${c.id}|${r}`)??[])):c.roles.includes(r));
      const priority=stats?stats.groups.reduce((sum,g)=>{
        const total=g.source==='pro'?championPro:championSolo;
        const raw=clamp(25+Math.sqrt(g.pickRate)*65+Math.sqrt(g.banRate)*(g.source==='pro'?40:35)*Math.min(1,g.n/Math.max(1,total)*2));
        return sum+(35+(raw-35)*g.support)*g.mixture;
      },0)/stats.groups.reduce((sum,g)=>sum+g.mixture,0):35;
      const blindSafety=clamp(50+(priority-50)*.6+Math.min(2,viableRoles.length-1)*4);
      const historical = prepared.historical.get(`${c.id}|${role}|${side}`);
      const historyPriority = historical && historical.total >= 10 ? posterior(historical.early, historical.total, 0.3, 20) * 100 : null;
      // Evaluate prospective lane counters before an early blind pick, when pair data exists.
      const potential = early && input.pairs.length > 0 && !opponentLane ? input.champions.filter(o => !locked.has(o.id) && o.id !== c.id && o.roles.includes(role))
        .flatMap(o => summary(`matchup|${c.id}|${role}|${o.id}|${role}`, pairRows(input, c, role, { championId: o.id, role }, 'matchup')) ?? []) : [];
      const blindCounterPenalty = potential.length ? Math.max(0, -Math.min(...potential.map(p => p.delta))) * 100 : 0;
      const orderValue = last && opponentLane ? clamp(50 + (matchup - 50) * 1.5) : early ? clamp(blindSafety - blindCounterPenalty + (input.draft.mode === 'pro' && historyPriority !== null ? (historyPriority - 50) * .2 : 0)) : opponentLane ? clamp(50 + (matchup - 50) * 1.2) : blindSafety;
      const mastery = input.draft.mode==='solo'?input.settings.pool[c.id]:undefined;
      const factors: Weights = { winrate: stats ? clamp(50 + stats.delta * 600) : 50, matchup, synergy,
        meta: priority,
        flex: early?clamp(50 + Math.max(0,viableRoles.length - 1) * 10):50, order: orderValue, composition: comp,
        mastery: !useFamiliarity?50:familiarity?(familiarity.games?clamp(40+Math.log2(1+familiarity.games)*9):80):players.some(p=>p.pool.length>0)?25:side === input.draft.side && mastery !== undefined ? mastery * 20 : 50 };
      const weights = { ...input.settings.weights };
      if (input.draft.mode === 'solo') { weights.mastery *= 2; weights.flex *= 0.4; weights.synergy *= 0.7 }
      else { weights.synergy *= allies.length?1.3:.4; weights.flex *= early?1:.2; weights.order *= 1.3;weights.composition*=allies.length||enemies.length?1.4:.3;if(useFamiliarity&&players.some(p=>p.pool.length>0))weights.mastery*=3; }
      const total = Object.values(weights).reduce((a, b) => a + b, 0);
      const score = Object.keys(weights).reduce((s, k) => s + factors[k as keyof Weights] * weights[k as keyof Weights], 0) / total;
      const reasons: string[] = [];
      if (stats) reasons.push(text(input, `${(stats.estimate * 100).toFixed(1)} % lissé · ${Math.round(stats.n).toLocaleString('fr-FR')} parties pondérées${stats.old ? ' · anciens patchs inclus' : ''}`, `${(stats.estimate * 100).toFixed(1)}% smoothed · ${Math.round(stats.n)} weighted games${stats.old ? ' · older patches included' : ''}`));
      else reasons.push(text(input, 'Aucune statistique compatible : priorité qualitative uniquement.', 'No matching statistics: qualitative priority only.'));
      if (stats?.rounded) reasons.push(text(input, 'Lolalytics : victoires reconstituées à partir des taux publiés arrondis ; intervalle approximatif.', 'Lolalytics: wins reconstructed from rounded published rates; approximate interval.'));
      if (viableRoles.length > 1 && early) reasons.push(text(input, `Flex observé ${viableRoles.join(' / ')} : conserve l’ambiguïté du premier tour.`, `${viableRoles.join(' / ')} observed flex: preserves early-round ambiguity.`));
      reasons.push(...contextual.reasons);
      if(allies.length>=2)reasons.push(text(input,`Plan de jeu : ${afterPlan.title}. ${afterPlan.conditions[0]??afterPlan.timing}`,`Game plan: ${afterPlan.title}. ${afterPlan.conditions[0]??afterPlan.timing}`));
      if(stats)for(const g of stats.groups.filter(g=>!g.usable))reasons.push(text(input,`${g.source} : ${Math.round(g.n)} parties pondérées, échantillon insuffisant (minimum ${g.source==='pro'?10:200}). Winrate et priorité méta neutralisés pour cette source.`,`${g.source}: ${Math.round(g.n)} weighted games, insufficient sample (minimum ${g.source==='pro'?10:200}). Win-rate and meta effects neutralized for this source.`));
      const unsupportedPairs=[...matchups,...synergies].filter(m=>!m.usable).length;
      if(unsupportedPairs)reasons.push(text(input,`${unsupportedPairs} matchup(s) ou synergie(s) sans échantillon suffisant : aucun bonus statistique.`,`${unsupportedPairs} matchup or synergy samples below the minimum: no statistical bonus.`));
      if(stats)reasons.push(text(input,`Écart au niveau moyen : ${(stats.delta*100).toFixed(2)} points ; mix ${stats.groups.map(g=>`${g.source} ${Math.round(100*g.mixture/stats.groups.reduce((s,x)=>s+x.mixture,0))}%`).join(' / ')} ajusté à la fiabilité.`,`Baseline-adjusted edge: ${(stats.delta*100).toFixed(2)} points; reliability-weighted source blend.`));
      if(useFamiliarity&&familiarity)reasons.push(familiarity.games?text(input,`${familiarity.player.riotId} : ${familiarity.games} parties sur ce champion.`,`${familiarity.player.riotId}: ${familiarity.games} games on this champion.`):text(input,`${familiarity.player.riotId} : champion déclaré jouable.`,`${familiarity.player.riotId}: declared playable champion.`));
      if (matchups.length) reasons.push(text(input, `Matchups observés : ${matchups.length}/${enemies.length} ennemis · effet ${matchup >= 50 ? 'favorable' : 'défavorable'}.`, `Observed matchups: ${matchups.length}/${enemies.length} enemies · ${matchup >= 50 ? 'favorable' : 'unfavorable'} effect.`));
      if (synergies.length) reasons.push(text(input, `Synergies observées : ${synergies.length}/${allies.length} alliés.`, `Observed synergies: ${synergies.length}/${allies.length} allies.`));
      if (last && opponentLane) reasons.push(text(input, 'Dernier pick : le matchup de lane est déjà révélé.', 'Last pick: the lane matchup is already revealed.'));
      if (blindCounterPenalty > 1) reasons.push(text(input, 'Attention : un counter statistique de lane reste disponible en face.', 'Caution: an observed lane counter is still available to the enemy.'));
      if (early && historyPriority !== null && input.draft.mode === 'pro') reasons.push(text(input, `Priorité de premier tour mesurée sur ${Math.round(historical!.total)} drafts pro pondérées.`, `Early-round priority measured across ${Math.round(historical!.total)} weighted pro drafts.`));
      if (useFamiliarity && mastery !== undefined && side === input.draft.side) reasons.push(text(input, `Maîtrise déclarée : ${mastery}/5.`, `Declared proficiency: ${mastery}/5.`));
      if (!c.curated) reasons.push(text(input, 'Profil de composition générique : à vérifier.', 'Generic composition profile: verify manually.'));
      const coverage = (1 + matchups.reduce((n,m)=>n+m.confidence,0) + synergies.reduce((n,m)=>n+m.confidence,0)) / Math.max(1, 1 + enemies.length + allies.length);
      const brief=contextual.reasons[0]??(useFamiliarity&&familiarity?(familiarity.games?text(input,`${familiarity.player.riotId} joue ce champion (${familiarity.games} parties connues).`,`${familiarity.player.riotId} plays this champion (${familiarity.games} known games).`):text(input,`Déclaré jouable par ${familiarity.player.riotId}.`,`Declared playable by ${familiarity.player.riotId}.`)):viableRoles.length>1&&early?text(input,'Un flex qui garde plusieurs options ouvertes.','A flex pick that keeps several options open.'):opponentLane&&matchup>52?text(input,'Matchup favorable face au rôle adverse déjà révélé.','Favorable matchup against the revealed enemy role.'):priority>55?text(input,'Champion prioritaire dans la méta sur les patchs analysés.','High-priority champion in the analyzed patch meta.'):stats&&stats.delta>0?text(input,'Résultats solides sur les derniers patchs.','Solid results across the latest patches.'):text(input,'À comparer avec les autres options pour votre composition.','Compare with the other options for your composition.'));
      results.push({ championId: c.id, role, score: Math.round(score * 10) / 10, confidence: stats ? Math.round(stats.confidence * coverage * 100) : 0,
        games: stats ? Math.round(stats.n) : 0, winrate: stats?.usable ? stats.estimate : null, interval: stats?.usable ? stats.interval : null, factors, reasons,summary:stats&&!stats.usable?text(input,`Échantillon insuffisant (${Math.round(stats.n)} parties) · choix évalué sur son plan de jeu et le pool.`,`Insufficient sample (${Math.round(stats.n)} games) · evaluated through game plan and pool.`):brief,lowSample:!!stats&&!stats.usable,
        responseRisk: enemyTeam.length ? clamp(50 + (50 - matchup)) : 50, source: stats ? (input.demo ? 'DEMO · ' : '') + stats.sources : 'heuristic' });
    }
  }
  return results.sort((a, b) => b.score - a.score || a.championId.localeCompare(b.championId) || a.role.localeCompare(b.role));
}
function unique(recs: Recommendation[]): Recommendation[] { const seen = new Set<string>(); return recs.filter(r => !seen.has(r.championId) && !!seen.add(r.championId)) }
function predict(input: EngineInput, side: Side): Prediction[] {
  const candidates = unique(rankCandidates(input, side, 'AUTO', false));
  const preference = softmax(candidates.map(r => r.score));
  return candidates.slice(0, 5).map((r, i) => ({ championId: r.championId, role: r.role, preference: preference[i] }));
}
function append(input: EngineInput, rec: Recommendation | Prediction): EngineInput {
  return { ...input, draft: { ...input.draft, targetRole: 'AUTO', history: [...input.draft.history, { championId: rec.championId, role: rec.role }] } };
}
function banCandidates(input: EngineInput, side: Side, restrictRole: Role | 'AUTO' = 'AUTO'): Recommendation[] {
  // Bans target opponent options; the user's playable pool must never restrict them.
  const enemy = opposite(side);
  const scout=input.teams?.[enemy===input.draft.side?'ally':'enemy'];
  const candidates = rankCandidates(input, enemy, restrictRole, false, false);
  const impacts=banConsequences(input,side,candidates,rankCandidates(input,side,'AUTO',false,false));
  return unique(candidates.map(r => {
    const base=r.score*.8+r.factors.meta*.2,banScouting=scoutingBan(scout,r.championId,r.role,input.settings.banScoutingWeight??35);
    const weight=(banScouting?.appliedWeight??0)/100,impact=impacts.get(`${r.championId}:${r.role}`)!;
    const score=clamp(base*(1-weight)+(banScouting?.score??base)*weight+impact.net*2*(input.settings.banImpactWeight??40)/100);
    const reasons=[text(input, 'Retire une option bien adaptée aux rôles adverses encore libres.', 'Removes an option suited to the remaining enemy roles.'), ...r.reasons];
    const replacement=impact.replacement?input.champions.find(c=>c.id===impact.replacement!.championId)?.name??impact.replacement.championId:text(input,'aucune dans les filtres actuels','none in the current filters');
    const consequence=text(input,`Conséquence au prochain pick : alternative ${replacement} (${impact.alternatives} options dans ce rôle). Perte adverse ${impact.enemyLoss.toFixed(1)} ; coût pour notre équipe ${impact.ownLoss.toFixed(1)} ; gain net ${impact.net.toFixed(1)} points heuristiques.`,`Next-pick consequence: replacement ${replacement} (${impact.alternatives} role options). Enemy loss ${impact.enemyLoss.toFixed(1)}; our cost ${impact.ownLoss.toFixed(1)}; net gain ${impact.net.toFixed(1)} heuristic points.`);
    reasons.unshift(consequence);
    if(impact.poolExhausted)reasons.unshift(text(input,'Ce ban épuise le pool déclaré pour ce rôle ; le pool connu peut être incomplet.','This ban exhausts the declared pool for this role; the known pool may be incomplete.'));
    if(banScouting&&weight>0){
      const {riotId,games,share,winrate,declared,appliedWeight}=banScouting;
      const detail=declared?text(input,'champion déclaré jouable, sans parties mesurées','declared playable champion, no measured games'):games?text(input,`${games} parties · ${(share*100).toFixed(1)} % des parties connues · ${(winrate!*100).toFixed(1)} % de victoires sur la saison`,`${games} games · ${(share*100).toFixed(1)}% of known games · ${(winrate!*100).toFixed(1)}% season win rate`):text(input,'champion absent du pool connu ; priorité de ban réduite','champion absent from known pool; ban priority reduced');
      reasons.unshift(text(input,`Ciblage OP.GG : ${riotId} · ${detail}. Poids effectif ${appliedWeight.toFixed(1)} % (maximum ${input.settings.banScoutingWeight??35} %, réduit selon les données).`,`OP.GG target: ${riotId} · ${detail}. Effective weight ${appliedWeight.toFixed(1)}% (maximum ${input.settings.banScoutingWeight??35}%, evidence-adjusted).`));
    }
    const summary=banScouting&&weight>0?(banScouting.declared?text(input,`Ciblage de pool : ${banScouting.riotId} déclare ce champion jouable.`,`Pool target: ${banScouting.riotId} declares this champion playable.`):banScouting.games?text(input,`Ciblage OP.GG : ${banScouting.riotId} · ${banScouting.games} parties · ${(banScouting.share*100).toFixed(1)} % du pool connu.`,`OP.GG target: ${banScouting.riotId} · ${banScouting.games} games · ${(banScouting.share*100).toFixed(1)}% of known pool.`):text(input,'Champion absent du pool adverse connu.','Champion absent from the known enemy pool.')):r.summary;
    return {...r,score:Math.round(score*10)/10,reasons,banScouting,banImpact:impact,summary:impact.net>1?text(input,`Réduit leurs options ${r.role} · remplacement : ${replacement}.`,`Reduces their ${r.role} options · replacement: ${replacement}.`):impact.net< -1?text(input,`Coût pour notre plan : ${impact.ownLoss.toFixed(1)} points · alternative adverse : ${replacement}.`,`Cost to our plan: ${impact.ownLoss.toFixed(1)} points · enemy replacement: ${replacement}.`):summary};
  }).sort((a,b)=>b.score-a.score||a.championId.localeCompare(b.championId)||a.role.localeCompare(b.role)));
}
function duos(input: EngineInput, recs: Recommendation[]): Duo[] {
  const index = input.draft.history.length, sequence = order(input.draft), current = sequence[index], next = sequence[index + 1];
  if (input.draft.mode !== 'pro' || current?.kind !== 'pick' || next?.kind !== 'pick' || current.side !== next.side || current.side !== input.draft.side) return [];
  const combos: Duo[] = [];
  for (const first of recs.slice(0, 10)) {
    const afterFirst = append(input, first);
    for (const second of unique(rankCandidates(afterFirst, current.side)).slice(0, 4)) {
      const afterBoth = append(afterFirst, second), response = predict(afterBoth, opposite(current.side))[0] ?? null;
      const bestReply = unique(rankCandidates(afterBoth, opposite(current.side), 'AUTO', false))[0];
      const score = (first.score + second.score) / 2 - Math.max(0, (bestReply?.score ?? 50) - 50) * 0.15;
      combos.push({ first, second, score: Math.round(score * 10) / 10, response });
    }
  }
  const seen = new Set<string>();
  return combos.sort((a, b) => b.score - a.score).filter(d => { const key = [d.first.championId, d.second.championId].sort().join('|'); if (seen.has(key)) return false; seen.add(key); return true }).slice(0, 3);
}
function simulate(input: EngineInput, current: Recommendation[]): Scenario[] {
  if (input.draft.history.length >= 20) return [];
  return current.slice(0, 3).map((seed, branch) => {
    let state = input;
    const start = order(state.draft)[state.draft.history.length];
    state = start.kind === 'pick' ? append(state, seed) : { ...state, draft: { ...state.draft, history: [...state.draft.history, { championId: seed.championId }] } };
    while (state.draft.history.length < 20) {
      const action = order(state.draft)[state.draft.history.length];
      const ranked = action.kind === 'ban' ? banCandidates(state, action.side) : unique(rankCandidates(state, action.side, 'AUTO', true));
      const choice = ranked[0];
      if (!choice) {
        if (action.kind === 'pick') break; // Incomplete pools cannot be silently advertised as complete branches.
        state = { ...state, draft: { ...state.draft, history: [...state.draft.history, { championId: null }] } }; continue;
      }
      state = action.kind === 'pick' ? append(state, choice) : { ...state, draft: { ...state.draft, history: [...state.draft.history, { championId: choice.championId }] } };
    }
    const allyMembers=picks(state.draft,input.draft.side),enemyMembers=picks(state.draft,opposite(input.draft.side));
    const ally = gamePlan(team(state,input.draft.side),allyMembers.map(p=>p.role),team(state,opposite(input.draft.side)),enemyMembers.map(p=>p.role)), enemy = gamePlan(team(state,opposite(input.draft.side)),enemyMembers.map(p=>p.role),team(state,input.draft.side),allyMembers.map(p=>p.role));
    return { title: `${text(input, 'Scénario', 'Scenario')} ${branch + 1}`, history: state.draft.history, advantage: Math.round(ally.score - enemy.score), winProbability: null,
      explanation: text(input, 'Continuation gloutonne après ce choix. Indice de composition non calibré ; aucune probabilité de victoire validée.', 'Greedy continuation after this choice. Uncalibrated composition index; no validated win probability.') };
  });
}
/** Rates actual revealed picks, normalized per champion. Missing teams start at a neutral 50.
 * Popularity, pick order and personal mastery are not outcome probabilities and are excluded.
 */
export function draftBalance(input:EngineInput):DraftBalance {
  const criteria=['winrate','matchup','synergy','composition'] as const;
  const configured=criteria.reduce((sum,key)=>sum+input.settings.weights[key],0);
  const sequence=order(input.draft);
  const evaluate=(side:Side)=>{
    const ratings=input.draft.history.flatMap((selection,index)=>{
      if(sequence[index].kind!=='pick'||sequence[index].side!==side||!selection.championId||!selection.role)return [];
      const history=input.draft.history.map((s,i)=>i===index?{championId:null}:s);
      const recommendation=rankCandidates({...input,draft:{...input.draft,history}},side,selection.role,false,false,selection.championId)[0];
      if(!recommendation)return [50];
      return [criteria.reduce((sum,key)=>sum+recommendation.factors[key]*(configured?input.settings.weights[key]:1),0)/(configured||criteria.length)];
    });
    return {score:ratings.length?Math.round(ratings.reduce((sum,r)=>sum+r,0)/ratings.length*10)/10:50,count:ratings.length};
  };
  const blue=evaluate('blue'),red=evaluate('red'),revealed=blue.count+red.count;
  return {value:Math.round((blue.score-red.score)*10)/10,blue,red,revealed,complete:revealed===10};
}
export function analyze(input: EngineInput): Analysis {
  const { draft } = input, next = order(draft)[draft.history.length] ?? null;
  const role = draft.targetRole !== 'AUTO' ? draft.targetRole : draft.mode === 'solo' && next?.side === draft.side && freeRoles(draft, draft.side).includes(draft.role) ? draft.role : 'AUTO';
  const side = next?.side ?? draft.side;
  const all = next?rankCandidates(input, side, role, next.side === draft.side):[];
  const recommendations = unique(all), bans = next?banCandidates(input, side, next.kind === 'ban' ? draft.targetRole : 'AUTO'):[];
  const warnings: string[] = [];
  if (!input.stats.length) warnings.push(text(input, 'Mode heuristique : importez un pack autorisé pour utiliser les winrates, counters et synergies statistiques.', 'Heuristic mode: import an authorized pack to use statistical win rates, counters and synergies.'));
  else if (next && !recommendations.some(r => r.games)) warnings.push(text(input, 'Aucune donnée compatible avec ces filtres et rôles. Les scores restent qualitatifs.', 'No data matches these filters and roles. Scores remain qualitative.'));
  if (input.demo) warnings.push(text(input, 'DONNÉES FICTIVES : démonstration uniquement, aucune valeur prédictive.', 'SYNTHETIC DATA: demonstration only, no predictive validity.'));
  const windows=prepare(input).windows;
  if(draft.league!=='all'&&!input.stats.some(s=>s.source==='pro'&&s.league===draft.league))warnings.push(text(input,'Winrates et priorité pro : agrégats toutes ligues. Le filtre de ligue concerne les paires et drafts disponibles.','Pro win rates and priority use all-league aggregates. The league filter applies to available pairs and drafts.'));
  if(windows.solo.length&&windows.pro.length&&windows.solo[0]!==windows.pro[0])warnings.push(text(input,`Fenêtres distinctes : Master+ ${windows.solo.join(' / ')} ; pro ${windows.pro.join(' / ')}. Le patch pro est décalé, les recommandations peuvent subir les changements de méta.`,`Different source windows: Master+ ${windows.solo.join(' / ')}; pro ${windows.pro.join(' / ')}. Pro data lags and can be affected by meta changes.`));
  if (draft.mode === 'solo') warnings.push(text(input, 'Les 10 bans sont saisis par équipe ; en ranked ils sont simultanés et les doublons adverses sont autorisés.', 'Enter the 10 bans by team; ranked bans are simultaneous and opposing duplicates are allowed.'));
  const scenarios = simulate(input, next?.kind === 'ban' ? bans : recommendations);
  if (scenarios.some(s => s.history.length < 20)) warnings.push(text(input, 'Le pool restreint ne permet pas de terminer certaines simulations : élargissez les rôles couverts.', 'The restricted pool cannot complete some simulations: broaden its role coverage.'));
  return { picks: recommendations, bans: bans.slice(0, 5), enemies: next?predict(input, opposite(draft.side)):[],
    duos: duos(input, all), scenarios,
    ally: composition(team(input, draft.side), input.settings.language,picks(draft,draft.side).map(p=>p.role)), enemy: composition(team(input, opposite(draft.side)), input.settings.language,picks(draft,opposite(draft.side)).map(p=>p.role)),
    plans:{ally:gamePlan(team(input,draft.side),picks(draft,draft.side).map(p=>p.role),team(input,opposite(draft.side)),picks(draft,opposite(draft.side)).map(p=>p.role),input.settings.language),
      enemy:gamePlan(team(input,opposite(draft.side)),picks(draft,opposite(draft.side)).map(p=>p.role),team(input,draft.side),picks(draft,draft.side).map(p=>p.role),input.settings.language)},balance:draftBalance(input), warnings, next };
}
