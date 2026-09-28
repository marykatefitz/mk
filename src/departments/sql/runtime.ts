import type { QueryResult, SqlEngine } from '../../engines/types';
import { useProgress } from '../../core/progress/store';
import { compareResults, guardQuery, type CheckResult } from './checker';
import { XP_BY_TYPE, type Challenge, type WriteChallenge } from './types';

const expectedCache = new Map<string, Promise<QueryResult>>();

export function expectedResult(engine: SqlEngine, c: WriteChallenge): Promise<QueryResult> {
  let p = expectedCache.get(c.id);
  if (!p) {
    p = engine.query(c.solution);
    expectedCache.set(c.id, p);
    p.catch(() => expectedCache.delete(c.id));
  }
  return p;
}

export interface RunOutcome {
  result: QueryResult | null;
  error: string | null;
}

export async function runSql(engine: SqlEngine, sql: string): Promise<RunOutcome> {
  const guard = guardQuery(sql);
  if (guard) return { result: null, error: guard };
  try {
    const result = await engine.query(sql.trim().replace(/;\s*$/, ''));
    return { result, error: null };
  } catch (e) {
    return { result: null, error: friendlyError((e as Error).message) };
  }
}

/** Keep DuckDB's message but add a plain-English nudge for the common ones. */
export function friendlyError(msg: string): string {
  const m = msg.replace(/^Error:\s*/, '');
  const tips: [RegExp, string][] = [
    [/must appear in the GROUP BY clause|must be part of an aggregate/i, 'Every SELECT column must be either in GROUP BY or inside an aggregate like SUM/COUNT.'],
    [/Referenced column "?(\w+)"? not found/i, 'Check the column name spelling, and which table it belongs to (Schema tab).'],
    [/Table with name (\w+) does not exist/i, 'Check the table name. The Schema tab lists all 14 tables.'],
    [/Ambiguous reference to column name "?(\w+)"?/i, 'Two joined tables both have that column. Prefix it with the table alias, e.g. u.location_id.'],
    [/syntax error at or near/i, 'Syntax error: look just before the highlighted word for a missing comma, quote or parenthesis.'],
    [/WHERE clause cannot contain aggregates|aggregate function calls cannot be nested|Aggregates cannot be present in a WHERE/i, 'Aggregates (SUM, COUNT…) can\'t go in WHERE. Filter groups with HAVING instead.'],
    [/Conversion Error/i, 'A value could not be converted: check that you compare numbers to numbers and dates to dates.'],
    [/QUALIFY clause.*window function/i, 'QUALIFY needs a window function (like ROW_NUMBER() OVER (...)).'],
  ];
  const tip = tips.find(([re]) => re.test(m));
  return tip ? `${m}\n\n💡 ${tip[1]}` : m;
}

export interface CheckOutcome extends RunOutcome {
  check: CheckResult;
}

export async function checkAttempt(engine: SqlEngine, c: WriteChallenge, sql: string): Promise<CheckOutcome> {
  const run = await runSql(engine, sql);
  if (!run.result) {
    return { ...run, check: { ok: false, kind: 'error', headline: 'The query did not run.', tips: [run.error ?? 'Unknown error'] } };
  }
  const expected = await expectedResult(engine, c);
  if (c.check === 'shape') {
    const ok = run.result.columns.length === expected.columns.length && run.result.rows.length === expected.rows.length;
    const check: CheckResult = ok
      ? { ok: true, kind: 'correct', headline: 'Correct!', tips: [] }
      : {
          ok: false,
          kind: run.result.columns.length !== expected.columns.length ? 'columns' : 'row-count',
          headline:
            run.result.columns.length !== expected.columns.length
              ? `Expected ${expected.columns.length} columns, you have ${run.result.columns.length}.`
              : `Expected ${expected.rows.length} rows, you have ${run.result.rows.length}.`,
          tips: ['Re-read the question: how many rows and which columns?'],
        };
    return { ...run, check };
  }
  return { ...run, check: compareResults(expected, run.result, sql, { orderMatters: c.orderMatters }) };
}

// ------------------------------------------------------------- rewards ---

export const HINT_COSTS = [10, 25, 50];

export function rewardFor(c: Challenge, attempts: number, hints: number) {
  const base = c.xp ?? XP_BY_TYPE[c.type];
  const firstTry = attempts <= 1;
  const xp = Math.round(base * (firstTry ? 1.5 : 1) * Math.max(0.4, 1 - 0.2 * hints));
  const coins = 10 + (firstTry ? 10 : 0) + (hints === 0 ? 5 : 0);
  return { xp, coins, firstTry, golden: firstTry && hints === 0 };
}

/** Record a solve in the active save and hand out rewards (only the first time). */
export function completeChallenge(c: Challenge, sql?: string) {
  const store = useProgress.getState();
  const save = store.save;
  if (!save) return null;
  const attempts = Math.max(1, save.attempts[c.id] ?? 1);
  const hints = save.hints[c.id] ?? 0;
  if (save.solved[c.id]) {
    store.update((s) => {
      if (sql) s.solved[c.id].sql = sql;
    });
    return null;
  }
  const r = rewardFor(c, attempts, hints);
  store.update((s) => {
    s.solved[c.id] = { at: Date.now(), attempts, hints, firstTry: r.firstTry, golden: r.golden, sql };
  });
  return store.grant(c.title, r.xp, r.coins, { golden: r.golden, codex: c.codex });
}

export function recordAttempt(c: Challenge) {
  useProgress.getState().update((s) => {
    s.attempts[c.id] = (s.attempts[c.id] ?? 0) + 1;
  });
}
