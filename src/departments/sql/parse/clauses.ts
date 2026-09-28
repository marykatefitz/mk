// Splits a SQL query into its logical clauses. Deliberately shallow: clause
// *bodies* are kept as source text, and only the structure needed for
// Query X-Ray and Untangle (CTEs, SELECT list, FROM + joins, WHERE, GROUP BY,
// HAVING, QUALIFY, ORDER BY, LIMIT) is extracted.

import { matchParen, significant, tokenize, type Token } from './tokenize';

export interface Cte {
  name: string;
  /** "name (cols) AS (body)" exactly as written */
  fullText: string;
  body: string;
  query: ParsedQuery;
}

export interface Join {
  /** normalized, e.g. "LEFT JOIN", "ANTI JOIN", "CROSS JOIN", "," */
  keyword: string;
  target: string;
  conditionKind: 'ON' | 'USING' | null;
  condition: string | null;
  raw: string;
}

export interface FromClause {
  base: string;
  joins: Join[];
  raw: string;
}

export interface SelectQuery {
  kind: 'select';
  text: string;
  ctes: Cte[];
  recursive: boolean;
  /** "DISTINCT" / "DISTINCT ON (x)" or null */
  distinct: string | null;
  selectList: string;
  selectItems: string[];
  from: FromClause | null;
  where: string | null;
  groupBy: string | null;
  having: string | null;
  window: string | null;
  qualify: string | null;
  orderBy: string | null;
  limit: string | null;
  offset: string | null;
}

export interface CompoundQuery {
  kind: 'compound';
  text: string;
  ctes: Cte[];
  recursive: boolean;
  parts: ParsedQuery[];
  ops: string[];
  orderBy: string | null;
  limit: string | null;
}

export interface OtherQuery {
  kind: 'other';
  text: string;
  ctes: Cte[];
  recursive: boolean;
}

export type ParsedQuery = SelectQuery | CompoundQuery | OtherQuery;

const JOIN_WORDS = new Set(['LEFT', 'RIGHT', 'FULL', 'OUTER', 'INNER', 'CROSS', 'SEMI', 'ANTI', 'ASOF', 'POSITIONAL', 'NATURAL', 'LATERAL']);

type ClauseName = 'SELECT' | 'FROM' | 'WHERE' | 'GROUP BY' | 'HAVING' | 'WINDOW' | 'QUALIFY' | 'ORDER BY' | 'LIMIT' | 'OFFSET';

const slice = (sql: string, toks: Token[], a: number, b: number) =>
  a > b || a >= toks.length ? '' : sql.slice(toks[a].start, toks[Math.min(b, toks.length - 1)].end).trim();

/** Split text on top-level commas. */
export function splitTopLevel(text: string, sep: 'comma' = 'comma'): string[] {
  const toks = significant(tokenize(text));
  const parts: string[] = [];
  let startTok = 0;
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].type === sep && toks[i].depth === 0) {
      parts.push(slice(text, toks, startTok, i - 1));
      startTok = i + 1;
    }
  }
  parts.push(slice(text, toks, startTok, toks.length - 1));
  return parts.filter((p) => p.length);
}

export function parseQuery(input: string): ParsedQuery {
  const sql = input.trim().replace(/;\s*$/, '');
  const toks = significant(tokenize(sql));
  let i = 0;
  const ctes: Cte[] = [];
  let recursive = false;

  if (toks[0]?.upper === 'WITH') {
    i = 1;
    if (toks[i]?.upper === 'RECURSIVE') {
      recursive = true;
      i++;
    }
    while (i < toks.length) {
      const nameTok = toks[i];
      let j = i + 1;
      if (toks[j]?.type === 'open') j = matchParen(toks, j) + 1; // column list
      if (toks[j]?.upper !== 'AS') break;
      j++;
      if (toks[j]?.upper === 'NOT') j++;
      if (toks[j]?.upper === 'MATERIALIZED') j++;
      if (toks[j]?.type !== 'open') break;
      const close = matchParen(toks, j);
      const body = slice(sql, toks, j + 1, close - 1);
      ctes.push({
        name: nameTok.type === 'ident' ? nameTok.text.slice(1, -1) : nameTok.text,
        fullText: slice(sql, toks, i, close),
        body,
        query: parseQuery(body),
      });
      i = close + 1;
      if (toks[i]?.type === 'comma') {
        i++;
        continue;
      }
      break;
    }
  }

  const bodyStart = i;
  // Set operations at depth 0 → compound query.
  const setOps: number[] = [];
  for (let k = bodyStart; k < toks.length; k++) {
    if (toks[k].depth === 0 && ['UNION', 'INTERSECT', 'EXCEPT'].includes(toks[k].upper)) setOps.push(k);
  }
  if (setOps.length) {
    const parts: ParsedQuery[] = [];
    const ops: string[] = [];
    let s = bodyStart;
    for (const k of setOps) {
      parts.push(parseQuery(slice(sql, toks, s, k - 1)));
      let e = k;
      if (['ALL', 'DISTINCT'].includes(toks[k + 1]?.upper)) e = k + 1;
      if (toks[e + 1]?.upper === 'BY' && toks[e]?.upper === 'NAME') e++;
      ops.push(slice(sql, toks, k, e).toUpperCase());
      s = e + 1;
    }
    parts.push(parseQuery(slice(sql, toks, s, toks.length - 1)));
    return { kind: 'compound', text: sql, ctes, recursive, parts, ops, orderBy: null, limit: null };
  }

  // Locate clause keywords at depth 0.
  const found: { name: ClauseName; at: number; bodyAt: number }[] = [];
  for (let k = bodyStart; k < toks.length; k++) {
    const t = toks[k];
    if (t.depth !== 0 || t.type !== 'word') continue;
    const nx = toks[k + 1]?.upper;
    switch (t.upper) {
      case 'SELECT':
      case 'FROM':
      case 'WHERE':
      case 'HAVING':
      case 'WINDOW':
      case 'QUALIFY':
      case 'LIMIT':
      case 'OFFSET':
        found.push({ name: t.upper as ClauseName, at: k, bodyAt: k + 1 });
        break;
      case 'GROUP':
      case 'ORDER':
        if (nx === 'BY') {
          found.push({ name: `${t.upper} BY` as ClauseName, at: k, bodyAt: k + 2 });
          k++;
        }
        break;
    }
  }
  if (!found.length || found[0].name !== 'SELECT' || found[0].at !== bodyStart) {
    return { kind: 'other', text: sql, ctes, recursive };
  }
  // A FROM inside e.g. EXTRACT(x FROM y) is at depth>0, so this is safe; but
  // `SELECT ... FROM` repeated is invalid anyway: keep the first of each.
  const clause = (name: ClauseName): string | null => {
    const idx = found.findIndex((f) => f.name === name);
    if (idx === -1) return null;
    const endTok = idx + 1 < found.length ? found[idx + 1].at - 1 : toks.length - 1;
    return slice(sql, toks, found[idx].bodyAt, endTok);
  };

  let selectList = clause('SELECT') ?? '';
  let distinct: string | null = null;
  const selToks = significant(tokenize(selectList));
  if (selToks[0]?.upper === 'DISTINCT') {
    let e = 0;
    if (selToks[1]?.upper === 'ON' && selToks[2]?.type === 'open') e = matchParen(selToks, 2);
    distinct = selectList.slice(0, selToks[e].end).trim().toUpperCase().startsWith('DISTINCT ON')
      ? 'DISTINCT ON ' + selectList.slice(selToks[2]?.start ?? 0, selToks[e].end)
      : 'DISTINCT';
    selectList = selectList.slice(selToks[e].end).trim();
  } else if (selToks[0]?.upper === 'ALL') {
    selectList = selectList.slice(selToks[0].end).trim();
  }

  const fromText = clause('FROM');
  return {
    kind: 'select',
    text: sql,
    ctes,
    recursive,
    distinct,
    selectList,
    selectItems: splitTopLevel(selectList),
    from: fromText ? parseFrom(fromText) : null,
    where: clause('WHERE'),
    groupBy: clause('GROUP BY'),
    having: clause('HAVING'),
    window: clause('WINDOW'),
    qualify: clause('QUALIFY'),
    orderBy: clause('ORDER BY'),
    limit: clause('LIMIT'),
    offset: clause('OFFSET'),
  };
}

export function parseFrom(text: string): FromClause {
  const toks = significant(tokenize(text));
  // Find join starts at depth 0: a run of join words ending in JOIN, or a comma.
  const starts: { at: number; kwEnd: number }[] = [];
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.depth !== 0) continue;
    if (t.type === 'comma') {
      starts.push({ at: k, kwEnd: k });
      continue;
    }
    if (t.upper === 'JOIN') {
      let s = k;
      while (s - 1 >= 0 && toks[s - 1].depth === 0 && JOIN_WORDS.has(toks[s - 1].upper) && toks[s - 1].type === 'word') s--;
      starts.push({ at: s, kwEnd: k });
    }
  }
  const baseEnd = starts.length ? starts[0].at - 1 : toks.length - 1;
  const joins: Join[] = starts.map((st, n) => {
    const end = n + 1 < starts.length ? starts[n + 1].at - 1 : toks.length - 1;
    const keyword =
      toks[st.at].type === 'comma'
        ? ','
        : toks
            .slice(st.at, st.kwEnd + 1)
            .map((t) => t.upper)
            .filter((w) => w !== 'OUTER')
            .join(' ');
    // Split target / condition at depth-0 ON or USING.
    let condAt = -1;
    for (let k = st.kwEnd + 1; k <= end; k++) {
      if (toks[k].depth === 0 && (toks[k].upper === 'ON' || toks[k].upper === 'USING')) {
        condAt = k;
        break;
      }
    }
    const target = slice(text, toks, st.kwEnd + 1, condAt === -1 ? end : condAt - 1);
    return {
      keyword: keyword === 'JOIN' ? 'INNER JOIN' : keyword === 'INNER JOIN' ? 'INNER JOIN' : keyword,
      target,
      conditionKind: condAt === -1 ? null : (toks[condAt].upper as 'ON' | 'USING'),
      condition: condAt === -1 ? null : slice(text, toks, condAt + 1, end),
      raw: slice(text, toks, st.at, end),
    };
  });
  return { base: slice(text, toks, 0, baseEnd), joins, raw: text };
}

/** "WITH [RECURSIVE] a AS (...), b AS (...)" prefix to reuse CTEs in stage queries. */
export function withPrefix(q: { ctes: Cte[]; recursive: boolean }): string {
  if (!q.ctes.length) return '';
  return `WITH ${q.recursive ? 'RECURSIVE ' : ''}${q.ctes.map((c) => c.fullText).join(',\n')}\n`;
}

/** Split a select item into expression and alias (if any). */
export function splitAlias(item: string): { expr: string; alias: string | null } {
  const toks = significant(tokenize(item));
  if (toks.length < 2) return { expr: item.trim(), alias: null };
  const last = toks[toks.length - 1];
  const prev = toks[toks.length - 2];
  if (last.depth !== 0) return { expr: item.trim(), alias: null };
  if (prev.upper === 'AS' && prev.depth === 0) {
    return { expr: item.slice(0, prev.start).trim(), alias: last.type === 'ident' ? last.text.slice(1, -1) : last.text };
  }
  // implicit alias: `expr alias` where alias is a plain word and prev isn't an operator/keyword-ish
  const operatorish = prev.type === 'op' || prev.type === 'comma' || prev.type === 'open';
  const kw = ['END', 'NULL', 'TRUE', 'FALSE', 'ASC', 'DESC', 'DISTINCT', 'DATE', 'TIMESTAMP', 'INTERVAL'];
  if ((last.type === 'word' || last.type === 'ident') && !operatorish && !kw.includes(last.upper) && !(prev.type === 'word' && ['CASE', 'WHEN', 'THEN', 'ELSE', 'AND', 'OR', 'NOT', 'IS', 'IN', 'LIKE', 'ILIKE', 'BETWEEN'].includes(prev.upper))) {
    // `u.stock_no` tokenizes as word op word; the op '.' makes it operatorish → no alias. Good.
    return { expr: item.slice(0, last.start).trim(), alias: last.type === 'ident' ? last.text.slice(1, -1) : last.text };
  }
  return { expr: item.trim(), alias: null };
}
