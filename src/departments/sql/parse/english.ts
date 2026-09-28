// Plain-English captions for SQL clauses. Pattern-based: it explains the
// common shapes well and falls back to quoting the expression.

import { splitAlias, splitTopLevel, type Join } from './clauses';
import { significant, tokenize } from './tokenize';

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Split a boolean expression on top-level AND/OR (keeping BETWEEN…AND intact). */
export function splitConditions(text: string): { op: 'AND' | 'OR' | null; cond: string }[] {
  const toks = significant(tokenize(text));
  const out: { op: 'AND' | 'OR' | null; cond: string }[] = [];
  let start = 0;
  let op: 'AND' | 'OR' | null = null;
  let pendingBetween = 0;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.depth !== 0 || t.type !== 'word') continue;
    if (t.upper === 'BETWEEN') pendingBetween++;
    else if (t.upper === 'AND' && pendingBetween > 0) pendingBetween--;
    else if (t.upper === 'CASE') {
      // skip to matching END at the same depth
      let nest = 1;
      for (i++; i < toks.length && nest > 0; i++) {
        if (toks[i].depth === t.depth && toks[i].upper === 'CASE') nest++;
        if (toks[i].depth === t.depth && toks[i].upper === 'END') nest--;
      }
      i--;
    } else if (t.upper === 'AND' || t.upper === 'OR') {
      out.push({ op, cond: text.slice(toks[start].start, toks[i - 1].end).trim() });
      op = t.upper;
      start = i + 1;
    }
  }
  if (start < toks.length) out.push({ op, cond: text.slice(toks[start].start).trim() });
  return out;
}

function stripParens(s: string): string {
  let t = s.trim();
  while (t.startsWith('(') && t.endsWith(')')) {
    const toks = significant(tokenize(t));
    // only strip if the first paren closes at the very end
    const closeIdx = toks.findIndex((x, i) => i > 0 && x.type === 'close' && x.depth === 0);
    if (closeIdx !== toks.length - 1) break;
    t = t.slice(1, -1).trim();
  }
  return t;
}

function likeText(col: string, pattern: string, neg: boolean, ci: boolean): string {
  const p = pattern.replace(/^'|'$/g, '');
  const not = neg ? 'does not ' : '';
  const verb = (v: string) => (neg ? `${not}${v}` : `${v}s`);
  const caseNote = ci ? ' (ignoring upper/lower case)' : '';
  const core = p.replace(/%/g, '');
  if (/^%[^%_]+%$/.test(p)) return `${col} ${verb('contain')} "${core}"${caseNote}`;
  if (/^[^%_]+%$/.test(p)) return `${col} ${verb('start')} with "${core}"${caseNote}`;
  if (/^%[^%_]+$/.test(p)) return `${col} ${verb('end')} with "${core}"${caseNote}`;
  return `${col} ${neg ? 'does not match' : 'matches'} the pattern '${p}' (% = anything, _ = one character)${caseNote}`;
}

export function explainCondition(text: string): string {
  const c = squash(stripParens(text));
  let m: RegExpMatchArray | null;
  if ((m = c.match(/^NOT EXISTS\s*\((.*)\)$/i))) return `no matching row exists${fromTableOf(m[1])}`;
  if ((m = c.match(/^EXISTS\s*\((.*)\)$/i))) return `a matching row exists${fromTableOf(m[1])}`;
  if ((m = c.match(/^(.+?) IS NOT NULL$/i))) return `${m[1]} is filled in (not NULL)`;
  if ((m = c.match(/^(.+?) IS NULL$/i))) return `${m[1]} is missing (NULL)`;
  if ((m = c.match(/^(.+?) (NOT )?BETWEEN (.+?) AND (.+)$/i))) return `${m[1]} is ${m[2] ? 'NOT ' : ''}between ${m[3]} and ${m[4]} (both ends included)`;
  if ((m = c.match(/^(.+?) (NOT )?IN \((.*)\)$/i))) {
    if (/^\s*(SELECT|WITH)\b/i.test(m[3])) return `${m[1]} ${m[2] ? 'does NOT appear' : 'appears'} in the results of a subquery${fromTableOf(m[3])}`;
    return `${m[1]} is ${m[2] ? 'NOT ' : ''}one of ${squash(m[3])}`;
  }
  if ((m = c.match(/^(.+?) (NOT )?(I?LIKE) ('.*')$/i))) return likeText(m[1], m[4], !!m[2], m[3].toUpperCase() === 'ILIKE');
  if ((m = c.match(/^NOT (.+)$/i))) return `it is NOT true that ${explainCondition(m[1])}`;
  if ((m = c.match(/^(.+?)\s*(<>|!=|>=|<=|=|>|<)\s*(.+)$/))) {
    const words: Record<string, string> = { '=': 'is', '<>': 'is not', '!=': 'is not', '>': 'is greater than', '>=': 'is at least', '<': 'is less than', '<=': 'is at most' };
    if (/\b(date|_date|day)\b/i.test(m[1]) || /DATE '|as_of_date\(\)/i.test(m[3])) {
      const dateWords: Record<string, string> = { '=': 'is', '<>': 'is not', '!=': 'is not', '>': 'is after', '>=': 'is on or after', '<': 'is before', '<=': 'is on or before' };
      return `${m[1]} ${dateWords[m[2]]} ${m[3]}`;
    }
    const literal = /^('.*'|-?[\d.]+|NULL|TRUE|FALSE|DATE '.*'|as_of_date\(\).*)$/i.test(m[3].trim());
    if (!literal && m[2] === '=') return `${m[1]} equals ${m[3]}`;
    return `${m[1]} ${words[m[2]]} ${m[3]}`;
  }
  return `${c} is true`;
}

function fromTableOf(sub: string): string {
  const m = sub.match(/\bFROM\s+([A-Za-z_][\w.]*)/i);
  return m ? ` in ${m[1]}` : '';
}

export function explainBoolean(text: string): string {
  const parts = splitConditions(text);
  return parts.map((p, i) => (i === 0 ? '' : p.op === 'OR' ? ' OR ' : ' AND ') + explainCondition(p.cond)).join('');
}

const AGG: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^COUNT\s*\(\s*\*\s*\)$/i, () => 'number of rows'],
  [/^COUNT\s*\(\s*DISTINCT\s+(.+)\)$/i, (m) => `number of different ${m[1]}`],
  [/^COUNT\s*\((.+)\)$/i, (m) => `number of rows where ${m[1]} is not NULL`],
  [/^COUNT_IF\s*\((.+)\)$/i, (m) => `number of rows where ${m[1]}`],
  [/^SUM\s*\((.+)\)$/i, (m) => `total of ${m[1]}`],
  [/^AVG\s*\((.+)\)$/i, (m) => `average of ${m[1]}`],
  [/^MIN\s*\((.+)\)$/i, (m) => `smallest ${m[1]}`],
  [/^MAX\s*\((.+)\)$/i, (m) => `largest ${m[1]}`],
  [/^ROUND\s*\((.+),\s*(\d+)\)$/i, (m) => `${explainExpr(m[1])}, rounded to ${m[2]} decimals`],
  [/^ROUND\s*\((.+)\)$/i, (m) => `${explainExpr(m[1])}, rounded`],
  [/^COALESCE\s*\((.+),\s*([^,]+)\)$/i, (m) => `${m[1]} (or ${m[2]} when it's NULL)`],
  [/^ROW_NUMBER\s*\(\s*\)\s*OVER\s*\((.*)\)$/i, (m) => `row number ${windowText(m[1])}`],
  [/^RANK\s*\(\s*\)\s*OVER\s*\((.*)\)$/i, (m) => `rank (ties share a rank, then skip) ${windowText(m[1])}`],
  [/^DENSE_RANK\s*\(\s*\)\s*OVER\s*\((.*)\)$/i, (m) => `rank without gaps ${windowText(m[1])}`],
  [/^LAG\s*\((.+?)\)\s*OVER\s*\((.*)\)$/i, (m) => `the previous row's ${m[1]} ${windowText(m[2])}`],
  [/^LEAD\s*\((.+?)\)\s*OVER\s*\((.*)\)$/i, (m) => `the next row's ${m[1]} ${windowText(m[2])}`],
  [/^SUM\s*\((.+?)\)\s*OVER\s*\((.*)\)$/i, (m) => `running/windowed total of ${m[1]} ${windowText(m[2])}`],
  [/^AVG\s*\((.+?)\)\s*OVER\s*\((.*)\)$/i, (m) => `windowed average of ${m[1]} ${windowText(m[2])}`],
  [/^COUNT\s*\((.+?)\)\s*OVER\s*\((.*)\)$/i, (m) => `windowed count ${windowText(m[2])}`],
  [/^DATE_TRUNC\s*\(\s*'(\w+)'\s*,\s*(.+)\)$/i, (m) => `${m[2]} rounded down to the ${m[1]}`],
  [/^DATE_DIFF\s*\(\s*'(\w+)'\s*,\s*(.+?)\s*,\s*(.+)\)$/i, (m) => `${m[1]}s from ${m[2]} to ${m[3]}`],
  [/^DATEDIFF\s*\(\s*'?(\w+)'?\s*,\s*(.+?)\s*,\s*(.+)\)$/i, (m) => `${m[1]}s from ${m[2]} to ${m[3]}`],
  [/^CASE\b/i, () => 'a value picked by CASE rules'],
];

function windowText(spec: string): string {
  const s = squash(spec);
  const part = s.match(/PARTITION BY (.+?)(?= ORDER BY|$)/i);
  const order = s.match(/ORDER BY (.+?)(?= ROWS| RANGE|$)/i);
  const frame = s.match(/(ROWS|RANGE) BETWEEN (.+)$/i);
  const bits: string[] = [];
  if (part) bits.push(`within each ${part[1]}`);
  if (order) bits.push(`ordered by ${order[1]}`);
  if (frame) bits.push(`over ${frame[2].toLowerCase()}`);
  return bits.length ? `(${bits.join(', ')})` : '(over all rows)';
}

export function explainExpr(expr: string): string {
  const e = squash(expr);
  for (const [re, f] of AGG) {
    const m = e.match(re);
    if (m) return f(m);
  }
  return e;
}

export function explainSelect(items: string[], distinct: string | null): string {
  if (items.length === 1 && items[0].trim() === '*') return `Show every column${distinct ? ', removing duplicate rows' : ''}`;
  const parts = items.map((it) => {
    const { expr, alias } = splitAlias(it);
    const e = squash(expr);
    if (/^[\w.]+$/.test(e) || e.endsWith('*')) return alias ? `${e} (as ${alias})` : e;
    const ex = explainExpr(e);
    return alias ? `${alias} = ${ex}` : ex;
  });
  const lead = distinct ? 'Show unique combinations of' : 'Show';
  return `${lead}: ${parts.join('; ')}`;
}

export function explainFrom(base: string): string {
  const b = squash(base);
  if (b.startsWith('(')) return 'Start from the result of a subquery';
  const m = b.match(/^([\w."]+)(?:\s+(?:AS\s+)?(\w+))?/i);
  if (!m) return `Start from ${b}`;
  return `Start with every row of ${m[1]}${m[2] ? ` (nicknamed ${m[2]})` : ''}`;
}

export function explainJoin(j: Join): string {
  const target = squash(j.target);
  const name = target.startsWith('(') ? 'a subquery' : target;
  const cond = j.condition ? (j.conditionKind === 'USING' ? `matching on ${squash(j.condition).replace(/^\(|\)$/g, '')}` : `where ${explainBoolean(j.condition)}`) : '';
  switch (j.keyword) {
    case 'INNER JOIN':
      return `Attach rows from ${name} ${cond}. Rows with no match are dropped`;
    case 'LEFT JOIN':
      return `Attach rows from ${name} ${cond}. Keep every left-side row, even with no match (then its columns are NULL)`;
    case 'RIGHT JOIN':
      return `Attach ${name} ${cond}, keeping every ${name} row even without a match`;
    case 'FULL JOIN':
      return `Combine with ${name} ${cond}, keeping unmatched rows from both sides`;
    case 'CROSS JOIN':
    case ',':
      return `Pair every row with every row of ${name}`;
    case 'ANTI JOIN':
      return `Keep only rows that have NO match in ${name} ${cond}`;
    case 'SEMI JOIN':
      return `Keep only rows that have a match in ${name} ${cond} (without adding its columns)`;
    default:
      return `${j.keyword} ${name} ${cond}`;
  }
}

export function explainGroupBy(g: string, selectItems: string[] = []): string {
  const s = squash(g);
  if (/^ALL$/i.test(s)) return 'Make one group per combination of all the non-aggregated columns in SELECT';
  const parts = splitTopLevel(s).map((p) => {
    const n = Number(p);
    if (Number.isInteger(n) && n >= 1 && n <= selectItems.length) {
      const { expr, alias } = splitAlias(selectItems[n - 1]);
      return `${alias ?? squash(expr)} (column ${n} of SELECT)`;
    }
    return p;
  });
  return `Make one group per distinct ${parts.length > 1 ? 'combination of ' : 'value of '}${parts.join(', ')}`;
}

export function explainOrderBy(o: string): string {
  return (
    'Sort by ' +
    splitTopLevel(o)
      .map((p) => {
        const s = squash(p);
        const desc = /\bDESC\b/i.test(s);
        const col = s.replace(/\s+(ASC|DESC)\b.*$/i, '');
        return `${col}${desc ? ' (biggest/latest first)' : ' (smallest/earliest first)'}`;
      })
      .join(', then ')
  );
}

export function explainLimit(l: string, offset?: string | null): string {
  return `Return only the first ${squash(l)} rows${offset ? ` after skipping ${squash(offset)}` : ''}`;
}
