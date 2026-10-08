export function clamp(x: number, min = 0, max = 100): number { return Math.min(max, Math.max(min, x)) }
export function posterior(wins: number, games: number, baseline = 0.5, prior = 100): number { return (wins + baseline * prior) / (games + prior) }
export function wilson(wins: number, games: number): [number, number] {
  if (games <= 0) return [0, 1];
  const z = 1.96, p = wins / games, denom = 1 + z * z / games;
  const center = (p + z * z / (2 * games)) / denom;
  const width = z * Math.sqrt(p * (1 - p) / games + z * z / (4 * games * games)) / denom;
  return [Math.max(0, center - width), Math.min(1, center + width)];
}
export function patchDistance(target: string, source: string): number {
  const [ta, tb] = target.split('.').map(Number), [sa, sb] = source.split('.').map(Number);
  if (![ta, tb, sa, sb].every(Number.isFinite)) return Infinity;
  if (ta !== sa) return Infinity; // Season changes are intentionally never mixed.
  return tb - sb;
}
export function softmax(values: number[], temperature = 9): number[] {
  if (!values.length) return [];
  const max = Math.max(...values), exps = values.map(v => Math.exp((v - max) / temperature));
  const sum = exps.reduce((a, b) => a + b, 0); return exps.map(v => v / sum);
}
