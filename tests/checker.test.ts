import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cellsEqual, compareResults, guardQuery, numbersEqual } from '../src/departments/sql/checker';
import type { Cell, SqlEngine } from '../src/engines/types';
import { loadedEngine } from './helpers';

const res = (names: string[], rows: Cell[][]) => ({ columns: names.map((name) => ({ name, type: 'X' })), rows });

describe('answer checker: values', () => {
  it('tolerates rounding but not real differences', () => {
    expect(numbersEqual(1234.5678, 1234.57)).toBe(true);
    expect(numbersEqual(0.07123, 0.07)).toBe(true);
    expect(numbersEqual(12.35, 12)).toBe(false);
    expect(numbersEqual(100, 101)).toBe(false);
    expect(numbersEqual(0.1 + 0.2, 0.3)).toBe(true);
  });
  it('treats DATE and midnight TIMESTAMP as equal, NULL only equals NULL', () => {
    expect(cellsEqual('2025-01-01', '2025-01-01 00:00:00')).toBe(true);
    expect(cellsEqual(null, null)).toBe(true);
    expect(cellsEqual(null, 0)).toBe(false);
    expect(cellsEqual('5', 5)).toBe(true);
  });
});

describe('answer checker: comparisons', () => {
  const expected = res(['store', 'units'], [
    ['Denver', 10],
    ['Boise', 7],
    ['Tucson', 3],
  ]);

  it('accepts different aliases and row order when order does not matter', () => {
    const actual = res(['location_name', 'n'], [
      ['Tucson', 3],
      ['Denver', 10],
      ['Boise', 7],
    ]);
    expect(compareResults(expected, actual, 'select ...').ok).toBe(true);
  });

  it('flags wrong order when order matters', () => {
    const actual = res(['s', 'n'], [
      ['Tucson', 3],
      ['Denver', 10],
      ['Boise', 7],
    ]);
    const r = compareResults(expected, actual, 'select s, n from t order by n', { orderMatters: true });
    expect(r.ok).toBe(false);
    expect(r.kind).toBe('order');
  });

  it('accepts the right columns in a different order when names match', () => {
    const actual = res(['units', 'store'], [
      [10, 'Denver'],
      [7, 'Boise'],
      [3, 'Tucson'],
    ]);
    expect(compareResults(expected, actual, 'select units, store from t').ok).toBe(true);
  });

  it('explains a column-count mismatch', () => {
    const r = compareResults(expected, res(['store'], [['Denver'], ['Boise'], ['Tucson']]), 'select store from t');
    expect(r.kind).toBe('columns');
    expect(r.headline).toContain('expected 2');
  });

  it('suspects a fan-out when a join returns a whole multiple of the rows', () => {
    const actual = res(['s', 'n'], [...expected.rows, ...expected.rows]);
    const r = compareResults(expected, actual, 'select s, n from a join b on a.x = b.x');
    expect(r.kind).toBe('row-count');
    expect(r.headline).toBe('You have 6 rows, expected 3.');
    expect(r.tips.join(' ')).toMatch(/fan out/i);
  });

  it('spots doubled totals from a fan-out', () => {
    const actual = res(['s', 'n'], [
      ['Denver', 20],
      ['Boise', 14],
      ['Tucson', 6],
    ]);
    const r = compareResults(expected, actual, 'select s, sum(n) from a join b on a.id = b.id group by s');
    expect(r.kind).toBe('values');
    expect(r.tips[0]).toMatch(/fan-out/);
  });

  it('spots percent vs fraction', () => {
    const e = res(['s', 'pct'], [['A', 0.25], ['B', 0.5]]);
    const a = res(['s', 'pct'], [['A', 25], ['B', 50]]);
    expect(compareResults(e, a, 'select').tips[0]).toMatch(/100× too big/);
  });

  it('warns about = NULL when rows are missing', () => {
    const r = compareResults(expected, res(['s', 'n'], []), "select s, n from t where x = NULL");
    expect(r.tips.join(' ')).toMatch(/IS NULL/);
  });
});

describe('query guard', () => {
  it('allows reads, blocks writes and multiple statements', () => {
    expect(guardQuery('select 1')).toBeNull();
    expect(guardQuery('  WITH a AS (select 1) select * from a;')).toBeNull();
    expect(guardQuery('drop table units')).toMatch(/read-only/);
    expect(guardQuery('select 1; delete from units')).toMatch(/One query/);
    expect(guardQuery('')).toMatch(/Type/);
  });
});

describe('answer checker against the real database', () => {
  let e: SqlEngine;
  beforeAll(async () => {
    e = await loadedEngine();
  });
  afterAll(() => e.close());

  it('catches the single-key work-order join', async () => {
    const good = await e.query(`select w.location_id, count(*) from work_orders w join wo_jobs j
      on j.wo_number = w.wo_number and j.location_id = w.location_id group by 1`);
    const badSql = `select w.location_id, count(*) from work_orders w join wo_jobs j on j.wo_number = w.wo_number group by 1`;
    const bad = await e.query(badSql);
    const r = compareResults(good, bad, badSql);
    expect(r.ok).toBe(false);
    expect(r.tips.join(' ')).toMatch(/fan-out|join/i);
  });

  it('accepts an equivalent query written differently', async () => {
    const a = await e.query(`select rv_class, count(*) as n from units where status = 'In Stock' group by rv_class`);
    const b = await e.query(`select rv_class, count_if(status = 'In Stock') from units group by all having count_if(status = 'In Stock') > 0`);
    expect(compareResults(a, b, 'select').ok).toBe(true);
  });
});
