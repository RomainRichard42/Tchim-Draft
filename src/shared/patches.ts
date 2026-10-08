/** Numeric patch ordering, including season boundaries. Each source owns its available window. */
export function latestPatches(values: string[], count = 3): string[] {
  return [...new Set(values.map(p => p.split('.').slice(0, 2).join('.')).filter(p => /^\d+\.\d+$/.test(p)))].sort((a,b) => {
    const x=a.split('.').map(Number), y=b.split('.').map(Number); return y[0]-x[0] || y[1]-x[1];
  }).slice(0, count);
}
