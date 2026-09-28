import type { Cell } from './types';

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function isoTimestamp(d: Date): string {
  return `${isoDate(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** Turn whatever an engine hands back into a plain, comparable cell. */
export function normalizeCell(v: unknown, type: string): Cell {
  if (v === null || v === undefined) return null;
  const t = type.toUpperCase();
  if (typeof v === 'bigint') return Number(v);
  if (v instanceof Date) return t.startsWith('TIMESTAMP') ? isoTimestamp(v) : isoDate(v);
  if (typeof v === 'number') {
    if (t === 'DATE') return isoDate(new Date(v));
    if (t.startsWith('TIMESTAMP')) return isoTimestamp(new Date(v));
    return v;
  }
  if (typeof v === 'string' || typeof v === 'boolean') return v;
  if (t === 'INTERVAL' && ArrayBuffer.isView(v)) {
    // Arrow MonthDayNano interval: Int32Array [months, days, nanos(lo), nanos(hi)]
    const a = Array.from(v as Int32Array);
    return normalizeCell({ months: a[0], days: a[1], micros: ((a[3] ?? 0) * 2 ** 32 + ((a[2] ?? 0) >>> 0)) / 1000 }, t);
  }
  if (t === 'INTERVAL' && typeof v === 'object') {
    const iv = v as { months?: number | bigint; days?: number | bigint; micros?: number | bigint };
    const parts: string[] = [];
    const months = Number(iv.months ?? 0);
    const days = Number(iv.days ?? 0);
    const micros = Number(iv.micros ?? 0);
    if (months) parts.push(`${months} month${months === 1 ? '' : 's'}`);
    if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
    if (micros || !parts.length) parts.push(`${micros / 1e6} seconds`);
    return parts.join(' ');
  }
  try {
    return JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? Number(x) : x));
  } catch {
    return String(v);
  }
}
