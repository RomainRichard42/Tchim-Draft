import type { BlindAssessment, Champion } from '../shared/types';
import { clamp } from './math';

export interface BlindReply {
  championId: string; popularity: number; familiarity: number;
  evidence: { delta: number; usable: boolean } | null;
}

/** Bounded qualitative resource cost, not champion-specific blacklist or scraped lane data.
 * A scaling top with little early presence depends more on an unrevealed lane;
 * utility tanks retain much of their function with less economy.
 */
export function blindDevelopment(champion: Champion): number {
  if (!champion.curated) return 0;
  const utility = champion.traits.frontline >= 3 && champion.traits.engage >= 2 ? .15 : 1;
  return clamp((champion.traits.scaling - champion.traits.early) * 6, 0, 12) * utility;
}

/** Baseline-adjusted game outcomes, not measured lane losses or calibrated response probabilities.
 * Availability/pools are filtered by the caller. Missing/small pair samples stay neutral.
 * The worst weighted 20% captures a plausible targeted reply rather than a single outlier.
 */
export function assessBlind(replies: BlindReply[], sensitivity = 1): BlindAssessment {
  const rows = replies.map(reply => {
    const loss = reply.evidence?.usable ? clamp(-reply.evidence.delta, 0, .12) : 0;
    const weight = Math.max(.001, reply.popularity) * Math.exp(Math.min(3, loss * 30)) * (1 + 3 * clamp(reply.familiarity, 0, 1));
    return { ...reply, loss, weight };
  });
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  if (!total) return { score: 50, statisticalScore: 50, uncertaintyPenalty: 0, developmentPenalty: 0, coverage: 0, assessed: 0, available: 0, threats: [] };
  const coverage = rows.reduce((sum, row) => sum + (row.evidence?.usable ? row.weight : 0), 0) / total;
  const mean = rows.reduce((sum, row) => sum + row.loss * row.weight, 0) / total;
  const worst = [...rows].sort((a, b) => b.loss - a.loss || b.weight - a.weight || a.championId.localeCompare(b.championId));
  let remaining = total * .2, tail = 0;
  for (const row of worst) {
    const taken = Math.min(remaining, row.weight); tail += taken * row.loss; remaining -= taken;
    if (remaining <= 0) break;
  }
  const risk = mean * .35 + tail / (total * .2) * .65;
  const statisticalScore = clamp(50 - risk * 450 * sensitivity);
  // A separate, disclosed uncertainty cost prevents missing pairs looking safer
  // than well-covered champions. It is not an invented adverse matchup lift.
  const uncertaintyPenalty = (1 - coverage) * 12 * sensitivity;
  return { score: clamp(statisticalScore - uncertaintyPenalty), statisticalScore, uncertaintyPenalty, developmentPenalty: 0, coverage, available: rows.length,
    assessed: rows.filter(row => row.evidence?.usable).length,
    threats: worst.filter(row => row.loss > .005).sort((a, b) => b.loss * b.weight - a.loss * a.weight)
      .slice(0, 3).map(row => ({ championId: row.championId, loss: row.loss, share: row.weight / total })) };
}
