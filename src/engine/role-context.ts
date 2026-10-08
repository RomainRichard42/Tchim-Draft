import type { BlindAssessment, Champion, ContextPart, DraftContext, Role, Weights } from '../shared/types';
import { DEFAULT_WEIGHTS } from '../shared/draft';
import { clamp } from './math';
import { teamplay } from './teamplay';

// Coaching priors, not learned coefficients or lane-win probabilities.
export const ROLE_CONTEXT_WEIGHTS = {
  TOP: { lane: 40, opposition: 10, synergy: 15, plan: 35 },
  JUNGLE: { lane: 10, opposition: 20, synergy: 30, plan: 40 },
  MID: { lane: 25, opposition: 15, synergy: 25, plan: 35 },
  ADC: { lane: 10, opposition: 25, synergy: 30, plan: 35 },
  SUPPORT: { bot: 40, opposition: 40, plan: 20 }
} as const;

type Pick = { championId: string | null; role: Role };
type Evidence = { delta: number; usable: boolean } | null;
type PairLookup = (champion: Champion, role: Role, other: Pick, kind: 'matchup' | 'synergy') => Evidence;
interface Input {
  candidate: Champion; role: Role; allies: Pick[]; enemies: Pick[]; champions: Champion[];
  weights: Weights; ownPlan: number; language: string; pair: PairLookup;
  blind?: BlindAssessment;
}
type Criterion = 'matchup' | 'synergy' | 'composition';
const neutral = 50;
const lift = (row: Evidence) => row?.usable ? row.delta : 0;
const isBot = (role: Role) => role === 'ADC' || role === 'SUPPORT';

function average(picks: Pick[], evaluate: (pick: Pick) => number, importance: (role: Role) => number = () => 1): number {
  const total = picks.reduce((sum, p) => sum + importance(p.role), 0);
  return total ? picks.reduce((sum, p) => sum + evaluate(p) * importance(p.role), 0) / total : 0;
}

export function roleContext(input: Input): DraftContext {
  const { candidate, role, allies, enemies, weights, pair } = input;
  const fr = input.language === 'fr', tr = (a: string, b: string) => fr ? a : b;
  const champion = (pick: Pick) => input.champions.find(c => c.id === pick.championId);
  const allyTeam = allies.flatMap(p => champion(p) ?? []), enemyTeam = enemies.flatMap(p => champion(p) ?? []);
  const mechanics = teamplay(candidate, role, allyTeam, allies.map(p => p.role), enemyTeam);
  // User sliders adjust the role priors relatively to their defaults. No saved settings migration.
  const ratio = (key: Criterion) => weights[key] / DEFAULT_WEIGHTS[key];
  const parts: ContextPart[] = [];
  const add = (key: ContextPart['key'], label: string, baseWeight: number, coverage: number,
    terms: { score: number; share: number; criterion: Criterion }[]) => {
    const strength = terms.reduce((sum, t) => sum + t.share * ratio(t.criterion), 0);
    const score = strength ? terms.reduce((sum, t) => sum + t.score * t.share * ratio(t.criterion), 0) / strength : neutral;
    parts.push({ key, label, score: clamp(score), baseWeight, coverage: clamp(coverage, 0, 1), weight: baseWeight * coverage * strength });
  };
  const match = (target: Pick) => lift(pair(candidate, role, target, 'matchup')) * 400;
  const synergyImportance = (other: Role) => role === 'JUNGLE' && (other === 'MID' || other === 'SUPPORT') ? 2
    : role === 'MID' && other === 'JUNGLE' ? 2 : role === 'ADC' && other === 'SUPPORT' ? 3 : 1;
  const oppositionImportance = (other: Role) => role === 'ADC' && other === 'SUPPORT' ? 2 : 1;

  if (role === 'SUPPORT') {
    const mate = allies.find(p => p.role === 'ADC'), adc = mate && champion(mate);
    const enemyBot = enemies.filter(p => isBot(p.role));
    const botTeam = enemyBot.flatMap(p => champion(p) ?? []);
    const botMechanics = teamplay(candidate, role, adc ? [adc] : [], adc ? ['ADC'] : [], botTeam);
    // Four cross-team pair effects approximate a 2v2. Unknown edges stay neutral.
    // ADC/support synergy lives exclusively here, never again in the support's plan block.
    const cross = enemyBot.reduce((sum, target) => sum + match(target)
      + (adc ? lift(pair(adc, 'ADC', target, 'matchup')) * 400 : 0), 0) / 4;
    const duoSynergy = mate ? lift(pair(candidate, role, mate, 'synergy')) * 450 : 0;
    add('bot', tr('Notre duo contre leur duo', 'Our duo against their duo'), 40,
      ((mate ? 1 : 0) + enemyBot.length) / 3, [
        { score: neutral + cross, share: .6, criterion: 'matchup' },
        { score: neutral + duoSynergy, share: .3, criterion: 'synergy' },
        { score: botMechanics.score, share: .1, criterion: 'composition' }
      ]);
    const outsideBot = enemies.filter(p => !isBot(p.role));
    add('opposition', tr('Réponse à leur composition', 'Answer to their composition'), 40, enemies.length / 5, [
      { score: neutral + average(outsideBot, match), share: .5, criterion: 'matchup' },
      { score: mechanics.counterScore, share: .5, criterion: 'composition' }
    ]);
    const otherAllies = allies.filter(p => p.role !== 'ADC');
    const own = teamplay(candidate, role, otherAllies.flatMap(p => champion(p) ?? []), otherAllies.map(p => p.role), []);
    const synergy = average(otherAllies, p => lift(pair(candidate, role, p, 'synergy')) * 450,
      other => other === 'JUNGLE' || other === 'MID' ? 2 : 1);
    add('plan', tr('Contribution à notre plan', 'Contribution to our plan'), 20, allies.length / 4, [
      { score: neutral + synergy, share: .3, criterion: 'synergy' },
      { score: own.ownScore * .65 + input.ownPlan * .35, share: .7, criterion: 'composition' }
    ]);
  } else {
    const profile = ROLE_CONTEXT_WEIGHTS[role], lane = enemies.find(p => p.role === role);
    const others = enemies.filter(p => p.role !== role);
    add('lane', input.blind?tr('Blind : réponses encore disponibles', 'Blind: remaining responses'):tr('Matchup contre le vis-à-vis', 'Matchup against the opposing role'), profile.lane, lane||input.blind ? 1 : 0,
      [{ score: lane ? neutral + match(lane) : input.blind?.score??neutral, share: 1, criterion: 'matchup' }]);
    add('opposition', tr('Réponse aux autres ennemis', 'Answer to other enemies'), profile.opposition, others.length / 4, [
      { score: neutral + average(others, match, oppositionImportance), share: .7, criterion: 'matchup' },
      { score: mechanics.counterScore, share: .3, criterion: 'composition' }
    ]);
    add('synergy', tr('Synergies alliées du rôle', 'Role-specific allied synergies'), profile.synergy, allies.length / 4, [
      { score: neutral + average(allies, p => lift(pair(candidate, role, p, 'synergy')) * 450, synergyImportance), share: .8, criterion: 'synergy' },
      { score: mechanics.synergy, share: .2, criterion: 'composition' }
    ]);
    add('plan', tr('Contribution à notre plan', 'Contribution to our plan'), profile.plan, allies.length / 4,
      [{ score: mechanics.ownScore * .65 + input.ownPlan * .35, share: 1, criterion: 'composition' }]);
  }
  const total = parts.reduce((sum, p) => sum + p.weight, 0);
  for (const p of parts) p.weight = total ? p.weight / total * 100 : 0;
  return { role, score: total ? clamp(parts.reduce((sum, p) => sum + p.score * p.weight, 0) / 100) : neutral,
    parts, partial: !!input.blind||parts.some(p => p.coverage < 1) };
}

// Shared by recommendations and the live gauge. Context replaces, rather than adds
// another copy of, the existing matchup + synergy + composition budget.
export function contextualScore(factors: Weights, weights: Weights, context?: DraftContext): number {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (!total) return neutral;
  let sum = Object.entries(weights).reduce((value, [key, w]) => value + factors[key as keyof Weights] * w, 0);
  if (context) {
    const budget = weights.matchup + weights.synergy + weights.composition;
    sum += context.score * budget - factors.matchup * weights.matchup - factors.synergy * weights.synergy - factors.composition * weights.composition;
  }
  return clamp(sum / total);
}

export function contextualRisk(context: DraftContext): number {
  const opposition = context.parts.filter(p => p.key === 'lane' || p.key === 'opposition' || p.key === 'bot');
  const total = opposition.reduce((sum, p) => sum + p.weight, 0);
  return total ? clamp(100 - opposition.reduce((sum, p) => sum + p.score * p.weight, 0) / total) : neutral;
}
