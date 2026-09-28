// Query X-Ray: re-runs a query one logical step at a time
// (FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → QUALIFY → DISTINCT → ORDER BY → LIMIT)
// and captions each step in plain English.

import type { QueryResult, SqlEngine } from '../../engines/types';
import { parseQuery, splitAlias, splitTopLevel, withPrefix, type ParsedQuery, type SelectQuery } from './parse/clauses';
import {
  explainBoolean,
  explainFrom,
  explainGroupBy,
  explainJoin,
  explainLimit,
  explainOrderBy,
  explainSelect,
} from './parse/english';

export type StepKind = 'CTE' | 'FROM' | 'JOIN' | 'WHERE' | 'GROUP BY' | 'HAVING' | 'SELECT' | 'QUALIFY' | 'DISTINCT' | 'ORDER BY' | 'LIMIT' | 'QUERY';

export interface XrayStep {
  kind: StepKind;
  /** the clause text as written */
  clause: string;
  /** what the step does */
  explain: string;
  sql: string;
}

export interface XrayStepResult extends XrayStep {
  rowCount: number | null;
  preview: QueryResult | null;
  error: string | null;
  /** caption that includes the row-count story */
  caption: string;
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

export function buildSteps(sql: string): XrayStep[] {
  const q = parseQuery(sql);
  const steps: XrayStep[] = [];
  q.ctes.forEach((c, i) => {
    steps.push({
      kind: 'CTE',
      clause: `${c.name} AS (…)`,
      explain: `Step ${i + 1}: build a temporary result called ${c.name}`,
      sql: `${withPrefix(q)}SELECT * FROM ${c.name}`,
    });
  });
  if (q.kind !== 'select') {
    steps.push({
      kind: 'QUERY',
      clause: q.kind === 'compound' ? q.ops.join(' / ') : 'query',
      explain: q.kind === 'compound' ? `Stack the results of ${q.parts.length} queries with ${q.ops.join(', ')}` : 'Run the query',
      sql: q.text,
    });
    return steps;
  }
  return steps.concat(selectSteps(q));
}

function selectSteps(q: SelectQuery): XrayStep[] {
  const pre = withPrefix(q);
  const steps: XrayStep[] = [];
  if (!q.from) {
    steps.push({ kind: 'SELECT', clause: q.selectList, explain: explainSelect(q.selectItems, q.distinct), sql: q.text });
    return steps;
  }
  let fromSql = `FROM ${q.from.base}`;
  steps.push({ kind: 'FROM', clause: `FROM ${squash(q.from.base)}`, explain: explainFrom(q.from.base), sql: `${pre}SELECT * ${fromSql}` });
  for (const j of q.from.joins) {
    fromSql += `\n${j.raw}`;
    steps.push({ kind: 'JOIN', clause: squash(j.raw), explain: explainJoin(j), sql: `${pre}SELECT * ${fromSql}` });
  }
  let body = fromSql;
  if (q.where) {
    body += `\nWHERE ${q.where}`;
    steps.push({ kind: 'WHERE', clause: `WHERE ${squash(q.where)}`, explain: `Keep only rows where ${explainBoolean(q.where)}`, sql: `${pre}SELECT * ${body}` });
  }
  const hasAgg = q.groupBy !== null;
  if (q.groupBy) {
    const groupExprs = resolveGroupExprs(q);
    const groupSel = groupExprs ? `${groupExprs.join(', ')}, COUNT(*) AS rows_in_group` : null;
    body += `\nGROUP BY ${q.groupBy}`;
    if (groupSel) {
      steps.push({
        kind: 'GROUP BY',
        clause: `GROUP BY ${squash(q.groupBy)}`,
        explain: explainGroupBy(q.groupBy, q.selectItems),
        sql: `${pre}SELECT ${groupSel} ${fromSql}${q.where ? `\nWHERE ${q.where}` : ''}\nGROUP BY ${groupExprs!.join(', ')}`,
      });
    }
    if (q.having) {
      body += `\nHAVING ${q.having}`;
      steps.push({
        kind: 'HAVING',
        clause: `HAVING ${squash(q.having)}`,
        explain: `Keep only groups where ${explainBoolean(q.having)}`,
        sql: `${pre}SELECT ${q.selectList} ${body}`,
      });
    }
  }
  if (q.window) body += `\nWINDOW ${q.window}`;
  steps.push({
    kind: 'SELECT',
    clause: `SELECT ${squash(q.selectList).slice(0, 120)}`,
    explain: explainSelect(q.selectItems, null) + (hasAgg ? ' (one row per group)' : ''),
    sql: `${pre}SELECT ${q.selectList} ${body}`,
  });
  if (q.qualify) {
    body += `\nQUALIFY ${q.qualify}`;
    steps.push({
      kind: 'QUALIFY',
      clause: `QUALIFY ${squash(q.qualify)}`,
      explain: `After window functions are computed, keep only rows where ${explainBoolean(q.qualify)}`,
      sql: `${pre}SELECT ${q.selectList} ${body}`,
    });
  }
  const selectPart = q.distinct ? `${q.distinct} ${q.selectList}` : q.selectList;
  if (q.distinct) {
    steps.push({ kind: 'DISTINCT', clause: q.distinct, explain: 'Remove duplicate rows', sql: `${pre}SELECT ${selectPart} ${body}` });
  }
  if (q.orderBy) {
    body += `\nORDER BY ${q.orderBy}`;
    steps.push({ kind: 'ORDER BY', clause: `ORDER BY ${squash(q.orderBy)}`, explain: explainOrderBy(q.orderBy), sql: `${pre}SELECT ${selectPart} ${body}` });
  }
  if (q.limit || q.offset) {
    if (q.limit) body += `\nLIMIT ${q.limit}`;
    if (q.offset) body += `\nOFFSET ${q.offset}`;
    steps.push({
      kind: 'LIMIT',
      clause: `LIMIT ${squash(q.limit ?? 'ALL')}${q.offset ? ` OFFSET ${squash(q.offset)}` : ''}`,
      explain: explainLimit(q.limit ?? 'all', q.offset),
      sql: `${pre}SELECT ${selectPart} ${body}`,
    });
  }
  return steps;
}

/** GROUP BY expressions with ordinals (GROUP BY 1, 2) resolved; null for GROUP BY ALL. */
function resolveGroupExprs(q: SelectQuery): string[] | null {
  if (/^\s*ALL\s*$/i.test(q.groupBy!)) return null;
  return splitTopLevel(q.groupBy!).map((g) => {
    const n = Number(g.trim());
    if (Number.isInteger(n) && n >= 1 && n <= q.selectItems.length) return splitAlias(q.selectItems[n - 1]).expr;
    return g.trim();
  });
}

const fmtN = (n: number) => n.toLocaleString('en-US');

function caption(step: XrayStep, prev: number | null, n: number | null, first: number | null): string {
  if (n === null) return `${step.explain}.`;
  const rows = `${fmtN(n)} row${n === 1 ? '' : 's'}`;
  switch (step.kind) {
    case 'CTE':
      return `${step.explain}: ${rows}.`;
    case 'FROM':
      return `${step.explain}: ${rows}.`;
    case 'JOIN': {
      if (prev === null) return `${step.explain} → ${rows}.`;
      const diff = n - prev;
      if (diff > 0) return `${step.explain} → ${rows} (was ${fmtN(prev)}). ⚠️ More rows than before: some rows matched more than once (fan-out). Totals computed after this will double-count unless you meant it.`;
      if (diff < 0) return `${step.explain} → ${rows} (was ${fmtN(prev)}). ${fmtN(-diff)} rows had no match and were dropped.`;
      return `${step.explain} → still ${rows}. Every row matched exactly once.`;
    }
    case 'WHERE':
      return `${step.explain} → keeps ${rows}${prev !== null ? ` of ${fmtN(prev)}` : ''}.`;
    case 'GROUP BY':
      return `${step.explain} → ${prev !== null ? `${fmtN(prev)} rows squash into ` : ''}${fmtN(n)} group${n === 1 ? '' : 's'}. (rows_in_group shows how many rows landed in each.)`;
    case 'HAVING':
      return `${step.explain} → ${fmtN(n)} group${n === 1 ? '' : 's'} survive${prev !== null ? ` of ${fmtN(prev)}` : ''}.`;
    case 'SELECT':
      return `${step.explain} → ${rows}.`;
    case 'QUALIFY':
      return `${step.explain} → keeps ${rows}${prev !== null ? ` of ${fmtN(prev)}` : ''}.`;
    case 'DISTINCT':
      return `${step.explain} → ${rows}${prev !== null && prev !== n ? ` (${fmtN(prev - n)} duplicates removed)` : ''}.`;
    case 'ORDER BY':
      return `${step.explain}. Same ${rows}, new order.`;
    case 'LIMIT':
      return `${step.explain} → ${rows}${first !== null ? '' : ''}.`;
    default:
      return `${step.explain} → ${rows}.`;
  }
}

export async function runXray(engine: SqlEngine, sql: string, previewRows = 5): Promise<XrayStepResult[]> {
  const steps = buildSteps(sql);
  const out: XrayStepResult[] = [];
  let prev: number | null = null;
  let first: number | null = null;
  for (const step of steps) {
    try {
      const countRes = await engine.query(`SELECT COUNT(*) AS n FROM (\n${step.sql}\n) AS xray_step`);
      const n = Number(countRes.rows[0][0]);
      const preview = await engine.query(`SELECT * FROM (\n${step.sql}\n) AS xray_step LIMIT ${previewRows}`);
      out.push({ ...step, rowCount: n, preview, error: null, caption: caption(step, step.kind === 'CTE' ? null : prev, n, first) });
      if (step.kind !== 'CTE') {
        prev = n;
        first ??= n;
      }
    } catch (e) {
      out.push({
        ...step,
        rowCount: null,
        preview: null,
        error: (e as Error).message,
        caption: `${step.explain}. (This step can't be shown on its own: it probably uses a name defined in SELECT.)`,
      });
    }
  }
  return out;
}

export type { ParsedQuery };
