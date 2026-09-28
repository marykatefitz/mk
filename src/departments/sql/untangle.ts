// Untangle: pretty-prints a query one clause per block, color-tags each
// block, and writes a plain-English comment above each part.

import { parseQuery, splitAlias, splitTopLevel, type ParsedQuery } from './parse/clauses';
import {
  explainBoolean,
  explainFrom,
  explainGroupBy,
  explainJoin,
  explainLimit,
  explainOrderBy,
  explainSelect,
} from './parse/english';
import { KEYWORDS, tokenize } from './parse/tokenize';
import { splitConditions } from './parse/english';

export type LineKind = 'comment' | 'with' | 'select' | 'from' | 'join' | 'where' | 'group' | 'having' | 'qualify' | 'order' | 'limit' | 'setop' | 'plain';

export interface UntangledLine {
  text: string;
  indent: number;
  kind: LineKind;
}

/** Uppercase keywords and collapse whitespace outside of strings. */
export function tidy(sql: string): string {
  return tokenize(sql)
    .filter((t) => t.type !== 'comment')
    .map((t) => (t.type === 'ws' ? ' ' : t.type === 'word' && KEYWORDS.has(t.upper) ? t.upper : t.text))
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+,/g, ',')
    .trim();
}

export function untangle(sql: string, withComments = true): UntangledLine[] {
  const lines: UntangledLine[] = [];
  emitQuery(parseQuery(sql), 0, lines, withComments);
  return lines;
}

export function untangleText(sql: string, withComments = true): string {
  return untangle(sql, withComments)
    .map((l) => '  '.repeat(l.indent) + l.text)
    .join('\n');
}

function emitQuery(q: ParsedQuery, ind: number, out: UntangledLine[], comments: boolean) {
  const note = (text: string, i = ind) => comments && out.push({ text: `-- ${text}`, indent: i, kind: 'comment' });
  if (q.ctes.length) {
    out.push({ text: `WITH${q.recursive ? ' RECURSIVE' : ''}`, indent: ind, kind: 'with' });
    q.ctes.forEach((c, i) => {
      note(`Step ${i + 1}: build a temporary result called "${c.name}"`, ind + 1);
      const header = tidy(c.fullText.slice(0, c.fullText.length - c.body.length - 2).replace(/\(\s*$/, ''));
      out.push({ text: `${header.replace(/\s*\($/, '')} (`, indent: ind + 1, kind: 'with' });
      emitQuery(c.query, ind + 2, out, comments);
      out.push({ text: i < q.ctes.length - 1 ? '),' : ')', indent: ind + 1, kind: 'with' });
    });
    if (comments) note(`Final step: the main query`);
  }
  if (q.kind === 'compound') {
    q.parts.forEach((p, i) => {
      emitQuery({ ...p, ctes: [] } as ParsedQuery, ind, out, comments);
      if (i < q.ops.length) {
        note(q.ops[i].includes('ALL') ? 'Stack the next result underneath (keeping duplicates)' : `${q.ops[i]}: combine with the next result`);
        out.push({ text: q.ops[i], indent: ind, kind: 'setop' });
      }
    });
    return;
  }
  if (q.kind === 'other') {
    out.push({ text: tidy(q.text), indent: ind, kind: 'plain' });
    return;
  }

  note(explainSelect(q.selectItems, q.distinct));
  out.push({ text: q.distinct ? `SELECT ${tidy(q.distinct)}` : 'SELECT', indent: ind, kind: 'select' });
  q.selectItems.forEach((it, i) => {
    const { expr, alias } = splitAlias(it);
    const text = alias && !/\bAS\s+\S+$/i.test(it.trim()) ? `${tidy(expr)} AS ${alias}` : tidy(it);
    out.push({ text: text + (i < q.selectItems.length - 1 ? ',' : ''), indent: ind + 1, kind: 'select' });
  });
  if (q.from) {
    note(explainFrom(q.from.base));
    emitSourceLine('FROM', q.from.base, ind, out, comments, 'from');
    for (const j of q.from.joins) {
      note(explainJoin(j), ind + 1);
      const kw = j.keyword === ',' ? ',' : j.keyword;
      emitSourceLine(kw, j.target, ind + 1, out, comments, 'join');
      if (j.condition) {
        const parts = j.conditionKind === 'ON' ? splitConditions(j.condition) : [{ op: null, cond: j.condition }];
        parts.forEach((p, i) =>
          out.push({ text: `${i === 0 ? j.conditionKind : p.op} ${tidy(p.cond)}`, indent: ind + 2, kind: 'join' }),
        );
      }
    }
  }
  if (q.where) {
    note(`Keep only rows where ${explainBoolean(q.where)}`);
    emitConditions('WHERE', q.where, ind, out, 'where');
  }
  if (q.groupBy) {
    note(explainGroupBy(q.groupBy, q.selectItems));
    out.push({ text: `GROUP BY ${splitTopLevel(q.groupBy).map(tidy).join(', ')}`, indent: ind, kind: 'group' });
  }
  if (q.having) {
    note(`Keep only groups where ${explainBoolean(q.having)}`);
    emitConditions('HAVING', q.having, ind, out, 'having');
  }
  if (q.window) out.push({ text: `WINDOW ${tidy(q.window)}`, indent: ind, kind: 'select' });
  if (q.qualify) {
    note(`After window functions, keep only rows where ${explainBoolean(q.qualify)}`);
    emitConditions('QUALIFY', q.qualify, ind, out, 'qualify');
  }
  if (q.orderBy) {
    note(explainOrderBy(q.orderBy));
    out.push({ text: `ORDER BY ${splitTopLevel(q.orderBy).map(tidy).join(', ')}`, indent: ind, kind: 'order' });
  }
  if (q.limit || q.offset) {
    note(explainLimit(q.limit ?? 'all', q.offset));
    if (q.limit) out.push({ text: `LIMIT ${tidy(q.limit)}`, indent: ind, kind: 'limit' });
    if (q.offset) out.push({ text: `OFFSET ${tidy(q.offset)}`, indent: ind, kind: 'limit' });
  }
}

function emitSourceLine(kw: string, source: string, ind: number, out: UntangledLine[], comments: boolean, kind: LineKind) {
  const s = source.trim();
  // Derived table: (SELECT ...) alias → print the subquery indented.
  if (s.startsWith('(')) {
    const toks = tokenize(s);
    const close = toks.find((t) => t.type === 'close' && t.depth === 0);
    const inner = close ? s.slice(1, close.start) : '';
    if (/^\s*(SELECT|WITH)\b/i.test(inner)) {
      out.push({ text: `${kw} (`, indent: ind, kind });
      emitQuery(parseQuery(inner), ind + 1, out, comments);
      out.push({ text: `)${close ? tidy(s.slice(close.end)) ? ' ' + tidy(s.slice(close.end)) : '' : ''}`, indent: ind, kind });
      return;
    }
  }
  out.push({ text: `${kw} ${tidy(s)}`, indent: ind, kind });
}

function emitConditions(kw: string, text: string, ind: number, out: UntangledLine[], kind: LineKind) {
  const parts = splitConditions(text);
  parts.forEach((p, i) => out.push({ text: `${i === 0 ? kw : '  ' + p.op} ${tidy(p.cond)}`, indent: ind, kind }));
}
