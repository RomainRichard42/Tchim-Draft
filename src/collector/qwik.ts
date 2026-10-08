import { load } from 'cheerio';

/** Decode data-only Qwik references; deliberately do not evaluate scripts or QRL functions. */
export function qwikData(html: string): Record<string, unknown>[] {
  const $ = load(html), text = $('script[type="qwik/json"]').first().text();
  if (!text) throw new Error('Lolalytics HTML changed: missing Qwik data');
  const input: unknown = JSON.parse(text);
  if (!input || typeof input !== 'object' || !('objs' in input) || !Array.isArray(input.objs)) throw new Error('Invalid Qwik object graph');
  const objects: unknown[] = input.objs;
  if (objects.length > 100000) throw new Error('Qwik object graph too large');
  const memo = new Map<number, unknown>();
  function decode(ref: unknown, depth: number): unknown {
    if (typeof ref !== 'string' || !/^[0-9a-z]+!?$/.test(ref) || depth > 25) throw new Error('Unsupported Qwik data reference');
    const index = parseInt(ref.replace(/!$/, ''), 36);
    if (index >= objects.length) throw new Error('Qwik reference outside graph');
    if (memo.has(index)) return memo.get(index);
    const obj = objects[index];
    if (Array.isArray(obj)) { const result: unknown[] = []; memo.set(index, result); for (const r of obj) result.push(decode(r, depth + 1)); return result }
    if (obj && typeof obj === 'object') {
      const result: Record<string, unknown> = Object.create(null); memo.set(index, result);
      for (const [k, r] of Object.entries(obj)) { if (['__proto__', 'constructor', 'prototype'].includes(k)) throw new Error('Unsafe Qwik key'); result[k] = decode(r, depth + 1) }
      return result;
    }
    if (typeof obj === 'string' && obj.startsWith('\u0001')) return undefined;
    return obj;
  }
  // Only consumer-selected records are decoded: QRL closures contain unsupported references.
  return objects.map((obj, i) => ({ raw: obj, get value() { return decode(i.toString(36), 0) } })) as unknown as Record<string, unknown>[];
}
