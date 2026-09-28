// A small, forgiving SQL tokenizer. It only needs to be good enough to find
// clause boundaries (respecting strings, comments and parentheses) for
// Query X-Ray and Untangle. It never rejects input.

export type TokenType = 'word' | 'string' | 'ident' | 'number' | 'op' | 'open' | 'close' | 'comma' | 'semi' | 'comment' | 'ws';

export interface Token {
  type: TokenType;
  text: string;
  start: number;
  end: number;
  /** parenthesis depth the token sits at (an '(' has the depth outside it) */
  depth: number;
  /** uppercase text for words */
  upper: string;
}

const MULTI_OPS = ['->>', '::', '<=', '>=', '<>', '!=', '||', '->', '=>', '**'];

export function tokenize(sql: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let depth = 0;
  const push = (type: TokenType, start: number, end: number, d = depth) => {
    const text = sql.slice(start, end);
    out.push({ type, text, start, end, depth: d, upper: type === 'word' ? text.toUpperCase() : text });
  };
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < sql.length && /\s/.test(sql[j])) j++;
      push('ws', i, j);
      i = j;
    } else if (ch === '-' && next === '-') {
      let j = i + 2;
      while (j < sql.length && sql[j] !== '\n') j++;
      push('comment', i, j);
      i = j;
    } else if (ch === '/' && next === '*') {
      const close = sql.indexOf('*/', i + 2);
      const j = close === -1 ? sql.length : close + 2;
      push('comment', i, j);
      i = j;
    } else if (ch === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") break;
        else j++;
      }
      push('string', i, Math.min(j + 1, sql.length));
      i = j + 1;
    } else if (ch === '"') {
      let j = i + 1;
      while (j < sql.length && sql[j] !== '"') j++;
      push('ident', i, Math.min(j + 1, sql.length));
      i = j + 1;
    } else if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(next ?? ''))) {
      let j = i + 1;
      while (j < sql.length && /[0-9._eE]/.test(sql[j])) j++;
      push('number', i, j);
      i = j;
    } else if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < sql.length && /[A-Za-z0-9_$]/.test(sql[j])) j++;
      push('word', i, j);
      i = j;
    } else if (ch === '(' || ch === '[') {
      push('open', i, i + 1);
      depth++;
      i++;
    } else if (ch === ')' || ch === ']') {
      depth = Math.max(0, depth - 1);
      push('close', i, i + 1);
      i++;
    } else if (ch === ',') {
      push('comma', i, i + 1);
      i++;
    } else if (ch === ';') {
      push('semi', i, i + 1);
      i++;
    } else {
      const op = MULTI_OPS.find((o) => sql.startsWith(o, i));
      const len = op ? op.length : 1;
      push('op', i, i + len);
      i += len;
    }
  }
  return out;
}

/** Tokens that carry meaning (no whitespace or comments). */
export function significant(tokens: Token[]): Token[] {
  return tokens.filter((t) => t.type !== 'ws' && t.type !== 'comment');
}

/** Index of the matching close paren for the open paren at `idx` (in a significant-token array). */
export function matchParen(tokens: Token[], idx: number): number {
  const d = tokens[idx].depth;
  for (let j = idx + 1; j < tokens.length; j++) {
    if (tokens[j].type === 'close' && tokens[j].depth === d) return j;
  }
  return tokens.length - 1;
}

export const KEYWORDS = new Set(
  (
    'SELECT FROM WHERE GROUP BY HAVING QUALIFY ORDER LIMIT OFFSET WITH RECURSIVE AS ON USING JOIN LEFT RIGHT FULL OUTER INNER CROSS ' +
    'SEMI ANTI ASOF POSITIONAL NATURAL AND OR NOT IN IS NULL LIKE ILIKE BETWEEN CASE WHEN THEN ELSE END DISTINCT ALL UNION INTERSECT ' +
    'EXCEPT ASC DESC NULLS FIRST LAST OVER PARTITION ROWS RANGE PRECEDING FOLLOWING UNBOUNDED CURRENT ROW EXISTS INTERVAL DATE ' +
    'TIMESTAMP CAST TRUE FALSE WINDOW FILTER MATERIALIZED LATERAL VALUES TRY_CAST GROUPS EXCLUDE REPLACE SIMILAR ESCAPE ANY SOME'
  ).split(' '),
);
