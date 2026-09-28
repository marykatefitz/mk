// Compares a player's result set with the reference result and explains the
// difference in helpful, specific terms.

import type { Cell, QueryResult } from '../../engines/types';
import { significant, tokenize } from './parse/tokenize';

export interface CheckOptions {
  /** rows must be in the same order (the challenge asks for ORDER BY) */
  orderMatters?: boolean;
}

export type CheckKind = 'correct' | 'columns' | 'row-count' | 'values' | 'order' | 'error';

export interface CheckResult {
  ok: boolean;
  kind: CheckKind;
  headline: string;
  tips: string[];
  /** index of a representative mismatching row in the player's result (for highlighting) */
  badRow?: number;
}

type Result = Pick<QueryResult, 'columns' | 'rows'>;

// ---------------------------------------------------------------- guard ---

const ALLOWED_START = new Set(['SELECT', 'WITH', 'FROM', 'VALUES', 'DESCRIBE', 'SUMMARIZE', 'SHOW', 'EXPLAIN', 'TABLE']);

/** Only read-only single statements are allowed in the terminal. Returns an error message or null. */
export function guardQuery(sql: string): string | null {
  const toks = significant(tokenize(sql));
  if (!toks.length) return 'Type a query first!';
  const first = toks.find((t) => t.type !== 'open');
  if (!first || !ALLOWED_START.has(first.upper)) {
    return `The terminal is read-only: queries must start with SELECT or WITH (not ${first?.text ?? 'that'}).`;
  }
  const semi = toks.findIndex((t) => t.type === 'semi');
  if (semi !== -1 && semi < toks.length - 1) return 'One query at a time, please: remove the extra statement after the semicolon.';
  for (const t of toks) {
    if (t.type === 'word' && ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'ATTACH', 'COPY', 'INSTALL', 'LOAD', 'PRAGMA', 'EXPORT', 'IMPORT', 'SET', 'DETACH', 'TRUNCATE'].includes(t.upper) && t.depth === 0 && t === toks[0]) {
      return 'The terminal is read-only.';
    }
  }
  return null;
}

// --------------------------------------------------------------- values ---

function decimals(x: number): number {
  if (!Number.isFinite(x) || Number.isInteger(x)) return 0;
  const s = String(x);
  if (s.includes('e')) return 10;
  return s.split('.')[1]?.length ?? 0;
}

export function numbersEqual(a: number, b: number): boolean {
  if (a === b) return true;
  const diff = Math.abs(a - b);
  if (diff <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b))) return true;
  // Allow the player (or the reference) to have rounded: compare at the coarser precision.
  const k = Math.min(decimals(a), decimals(b));
  if (k >= 6) return false;
  return diff <= 0.5 * Math.pow(10, -k) + 1e-9 && diff <= 0.02 * Math.max(Math.abs(a), Math.abs(b));
}

export function cellsEqual(a: Cell, b: Cell): boolean {
  if (a === null || b === null) return a === b;
  if (typeof a === 'number' && typeof b === 'number') return numbersEqual(a, b);
  if (typeof a === 'boolean' || typeof b === 'boolean') return String(a) === String(b);
  if (typeof a === 'number' || typeof b === 'number') {
    const na = Number(a);
    const nb = Number(b);
    return !Number.isNaN(na) && !Number.isNaN(nb) && numbersEqual(na, nb);
  }
  if (a === b) return true;
  // DATE vs TIMESTAMP at midnight
  const strip = (s: string) => s.replace(/ 00:00:00(\.0+)?$/, '');
  return strip(a) === strip(b);
}

const rowsEqual = (a: Cell[], b: Cell[]) => a.length === b.length && a.every((v, i) => cellsEqual(v, b[i]));

function exactKey(row: Cell[]): string {
  return row
    .map((v) => (typeof v === 'number' ? '#' : v === null ? '∅' : typeof v === 'string' ? v.replace(/ 00:00:00(\.0+)?$/, '') : String(v)))
    .join('␟');
}

/** Multiset match with numeric tolerance. Returns indexes of unmatched rows on both sides. */
export function matchRows(expected: Cell[][], actual: Cell[][]): { missing: number[]; extra: number[] } {
  const buckets = new Map<string, number[]>();
  actual.forEach((r, i) => {
    const k = exactKey(r);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(i);
  });
  const used = new Set<number>();
  const missing: number[] = [];
  expected.forEach((r, i) => {
    const bucket = buckets.get(exactKey(r));
    if (!bucket) {
      missing.push(i);
      return;
    }
    const j = bucket.findIndex((ai) => !used.has(ai) && rowsEqual(r, actual[ai]));
    if (j === -1) missing.push(i);
    else {
      used.add(bucket[j]);
      bucket.splice(j, 1);
    }
  });
  const extra = actual.map((_, i) => i).filter((i) => !used.has(i));
  return { missing, extra };
}

// -------------------------------------------------------------- compare ---

interface SqlShape {
  joins: number;
  innerJoins: number;
  leftJoins: number;
  hasWhere: boolean;
  hasGroup: boolean;
  hasHaving: boolean;
  hasDistinct: boolean;
  hasOrder: boolean;
  hasLimit: boolean;
  eqNull: boolean;
  countStar: boolean;
}

function shapeOf(sql: string): SqlShape {
  const toks = significant(tokenize(sql));
  const up = toks.map((t) => t.upper);
  const count = (w: string) => up.filter((x) => x === w).length;
  let innerJoins = 0;
  let leftJoins = 0;
  toks.forEach((t, i) => {
    if (t.upper !== 'JOIN') return;
    const prev = up[i - 1];
    const prev2 = up[i - 2];
    if (prev === 'LEFT' || prev2 === 'LEFT') leftJoins++;
    else if (!['ANTI', 'SEMI', 'CROSS', 'RIGHT', 'FULL', 'OUTER'].includes(prev ?? '')) innerJoins++;
  });
  const eqNull = toks.some((t, i) => (t.text === '=' || t.text === '<>' || t.text === '!=') && (up[i + 1] === 'NULL' || up[i - 1] === 'NULL'));
  return {
    joins: count('JOIN'),
    innerJoins,
    leftJoins,
    hasWhere: up.includes('WHERE'),
    hasGroup: up.includes('GROUP'),
    hasHaving: up.includes('HAVING'),
    hasDistinct: up.includes('DISTINCT'),
    hasOrder: toks.some((t, i) => t.upper === 'ORDER' && up[i + 1] === 'BY' && t.depth === 0),
    hasLimit: up.includes('LIMIT'),
    eqNull,
    countStar: /count\s*\(\s*\*\s*\)/i.test(sql),
  };
}

const fmtRow = (r: Cell[]) => '(' + r.map((v) => (v === null ? 'NULL' : typeof v === 'number' ? String(Math.round(v * 100) / 100) : `'${v}'`)).join(', ') + ')';

function reorderColumns(expected: Result, actual: Result): Result | null {
  const en = expected.columns.map((c) => c.name.toLowerCase());
  const an = actual.columns.map((c) => c.name.toLowerCase());
  if (new Set(en).size !== en.length || en.some((n) => !an.includes(n))) return null;
  const idx = en.map((n) => an.indexOf(n));
  if (idx.every((v, i) => v === i)) return null;
  return { columns: idx.map((i) => actual.columns[i]), rows: actual.rows.map((r) => idx.map((i) => r[i])) };
}

export function compareResults(expected: Result, actual: Result, sql: string, opts: CheckOptions = {}): CheckResult {
  const shape = shapeOf(sql);
  const nE = expected.rows.length;
  const nA = actual.rows.length;
  const ec = expected.columns.length;
  const ac = actual.columns.length;

  // ---- columns
  if (ac !== ec) {
    const names = expected.columns.map((c) => c.name).join(', ');
    const tips = [`The answer has ${ec} column${ec === 1 ? '' : 's'}: ${names}. (Your names can differ; the count and order matter.)`];
    if (ac === 1 && actual.columns[0].name === '*') tips.push('Replace SELECT * with just the columns the question asks for.');
    if (ac > ec) tips.push('Drop the extra columns: only return what the question asks for.');
    else tips.push('You are missing a column. Re-read the question for everything it asks to see.');
    return { ok: false, kind: 'columns', headline: `You returned ${ac} column${ac === 1 ? '' : 's'}; expected ${ec}.`, tips };
  }

  let act = actual;
  const tryMatch = (a: Result) => matchRows(expected.rows, a.rows);
  let m = tryMatch(act);
  if (m.missing.length || m.extra.length) {
    const reordered = reorderColumns(expected, actual);
    if (reordered) {
      const m2 = tryMatch(reordered);
      if (m2.missing.length + m2.extra.length < m.missing.length + m.extra.length) {
        act = reordered;
        m = m2;
      }
    }
  }

  // ---- row count
  if (nA !== nE) {
    const tips: string[] = [];
    if (nA > nE) {
      if (shape.joins > 0 && ratioIsWhole(nA, nE)) tips.push(`Exactly ${Math.round(nA / nE)}× the expected rows. Did your join fan out (one row matching several)? Check every key in the ON clause.`);
      else if (shape.joins > 0) tips.push('Did your join fan out? If one row can match several rows on the other side, rows multiply. Check the join keys (composite keys need every part).');
      if (!shape.hasWhere) tips.push('No WHERE clause: is there a filter in the question you have not applied yet?');
      else tips.push('Maybe a filter is too loose: double-check each WHERE condition (and AND vs OR).');
      if (shape.hasGroup) tips.push('Grouping too finely? Every column in GROUP BY creates more groups.');
      if (!shape.hasDistinct && nE < nA) tips.push('If the question asks for unique values, DISTINCT (or GROUP BY) removes duplicates.');
    } else {
      if (shape.eqNull) tips.push('`= NULL` is never true in SQL. Use IS NULL / IS NOT NULL.');
      if (shape.innerJoins > 0) tips.push('An INNER JOIN drops rows that have no match. Do you need a LEFT JOIN to keep them?');
      if (shape.hasLimit) tips.push('Check your LIMIT: is it cutting off rows the question wants?');
      if (shape.hasWhere) tips.push('A filter may be too strict: check each WHERE condition (and remember NULLs fail every comparison).');
      if (shape.hasHaving) tips.push('HAVING filters groups. Is the threshold right, and should it be a WHERE instead?');
    }
    return {
      ok: false,
      kind: 'row-count',
      headline: `You have ${nA.toLocaleString()} row${nA === 1 ? '' : 's'}, expected ${nE.toLocaleString()}.`,
      tips: tips.slice(0, 3),
      badRow: m.extra[0],
    };
  }

  // ---- same count, compare contents
  if (m.missing.length === 0 && m.extra.length === 0) {
    if (opts.orderMatters) {
      const firstBad = expected.rows.findIndex((r, i) => !rowsEqual(r, act.rows[i]));
      if (firstBad !== -1) {
        return {
          ok: false,
          kind: 'order',
          headline: 'Right rows, wrong order!',
          tips: [
            shape.hasOrder ? 'Check the ORDER BY: the right column(s)? ASC vs DESC? A tie-breaker?' : 'This question cares about order: add an ORDER BY.',
            `First out-of-place row is #${firstBad + 1}: expected ${fmtRow(expected.rows[firstBad])}.`,
          ],
          badRow: firstBad,
        };
      }
    }
    return { ok: true, kind: 'correct', headline: 'Correct!', tips: [] };
  }

  const tips: string[] = [];
  // Which columns disagree? Compare column multisets.
  const badCols: number[] = [];
  for (let c = 0; c < ec; c++) {
    const ev = expected.rows.map((r) => [r[c]]);
    const av = act.rows.map((r) => [r[c]]);
    const mm = matchRows(ev, av);
    if (mm.missing.length) badCols.push(c);
  }
  for (const c of badCols.slice(0, 2)) {
    const name = expected.columns[c].name;
    const ratio = columnRatio(expected, act, c);
    if (ratio && Math.abs(ratio - 100) < 0.5) tips.push(`Column ${c + 1} (${name}) looks 100× too big: fraction vs percent?`);
    else if (ratio && Math.abs(ratio - 0.01) < 0.0005) tips.push(`Column ${c + 1} (${name}) looks 100× too small: multiply by 100 for a percent?`);
    else if (ratio && ratio > 1.2 && shape.joins > 0) tips.push(`Column ${c + 1} (${name}) is too big (about ${ratio.toFixed(1)}×). A join may be duplicating rows before you SUM/COUNT (fan-out).`);
    else if (ratio && ratio > 1.001) tips.push(`Column ${c + 1} (${name}) is consistently too big (about ${ratio.toFixed(2)}×). Is a filter missing inside the calculation?`);
    else if (ratio && ratio < 0.999) tips.push(`Column ${c + 1} (${name}) is consistently too small (about ${ratio.toFixed(2)}×). Are NULLs or some rows being left out?`);
    else if (caseOnly(expected, act, c)) tips.push(`Column ${c + 1} (${name}) differs only in upper/lower case. Text comparisons are case-sensitive.`);
    else tips.push(`Column ${c + 1} (${name}) has different values than expected.`);
  }
  if (!badCols.length) tips.push('Each column has the right values, but they are paired up differently across rows. Check your GROUP BY / join keys.');
  const bad = m.extra[0];
  if (bad !== undefined && m.missing[0] !== undefined) {
    tips.push(`For example you have ${fmtRow(act.rows[bad])}, but expected a row like ${fmtRow(expected.rows[m.missing[0]])}.`);
  }
  return { ok: false, kind: 'values', headline: `Right number of rows, but ${m.missing.length} of them don't match.`, tips: tips.slice(0, 3), badRow: bad };
}

function ratioIsWhole(a: number, b: number) {
  if (b === 0) return false;
  const r = a / b;
  return r >= 2 && Math.abs(r - Math.round(r)) < 0.001;
}

function columnRatio(expected: Result, actual: Result, c: number): number | null {
  const e = expected.rows.map((r) => r[c]);
  const a = actual.rows.map((r) => r[c]);
  if (!e.every((v) => typeof v === 'number') || !a.every((v) => typeof v === 'number')) return null;
  const se = (e as number[]).reduce((s, v) => s + v, 0);
  const sa = (a as number[]).reduce((s, v) => s + v, 0);
  if (!se) return null;
  return sa / se;
}

function caseOnly(expected: Result, actual: Result, c: number): boolean {
  const e = expected.rows.map((r) => String(r[c]).toLowerCase()).sort();
  const a = actual.rows.map((r) => String(r[c]).toLowerCase()).sort();
  return e.every((v, i) => v === a[i]);
}
