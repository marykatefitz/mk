import { useEffect, useMemo, useState } from 'react';
import { sfx } from '../core/audio/sfx';
import { CODEX } from '../core/codex';
import { useProgress } from '../core/progress/store';
import { TABLES } from '../data/schema';
import { CHALLENGES } from '../departments/sql';
import { significant, tokenize } from '../departments/sql/parse/tokenize';
import { buildSteps } from '../departments/sql/xray';
import type { SqlEngine } from '../engines/types';
import type { GameApi } from './Shell';

const shuffle = <T,>(a: T[]): T[] => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};

// ------------------------------------------------------------- Clause Order ---

interface ClauseRound {
  chips: { kind: string; text: string }[];
}

export function clauseRounds(): ClauseRound[] {
  const rounds: ClauseRound[] = [];
  for (const c of CHALLENGES) {
    if (c.type !== 'write' && c.type !== 'fix') continue;
    const steps = buildSteps(c.solution).filter((s) => s.kind !== 'CTE' && s.kind !== 'QUERY');
    if (steps.length < 3 || steps.length > 7) continue;
    // One chip per clause kind (JOINs merged into FROM for readability).
    const chips: { kind: string; text: string }[] = [];
    for (const s of steps) {
      if (s.kind === 'JOIN') continue;
      if (s.kind === 'DISTINCT') continue;
      const text = s.kind === 'FROM' && steps.some((x) => x.kind === 'JOIN') ? `${s.clause} + JOIN…` : s.clause;
      chips.push({ kind: s.kind, text: text.length > 60 ? text.slice(0, 57) + '…' : text });
    }
    if (chips.length >= 3) rounds.push({ chips });
  }
  return shuffle(rounds);
}

export function ClauseOrder({ api }: { api: GameApi }) {
  const rounds = useMemo(clauseRounds, []);
  const [ri, setRi] = useState(0);
  const [picked, setPicked] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const round = rounds[ri % rounds.length];
  const display = useMemo(() => shuffle(round.chips.map((c, i) => ({ ...c, order: i }))), [round]);
  const tap = (order: number, idx: number) => {
    if (order < picked) return;
    if (order === picked) {
      sfx('blip', 1 + picked * 0.1);
      const next = picked + 1;
      if (next === round.chips.length) {
        sfx('correct');
        api.addScore(10 + round.chips.length * 5);
        setRi((r) => r + 1);
        setPicked(0);
      } else setPicked(next);
    } else {
      sfx('wrong');
      setWrong(idx);
      api.penalty(3);
      setTimeout(() => setWrong(null), 400);
    }
  };
  return (
    <div className="col" style={{ gap: 10, padding: 12 }}>
      <div className="tiny muted">Tap the clauses in the order SQL actually RUNS them (FROM first!). Wrong taps cost 3 seconds.</div>
      <div className="col" style={{ gap: 8 }}>
        {display.map((c, i) => (
          <button key={`${ri}-${i}`} className={`mg-chip ${c.order < picked ? 'done' : ''} ${wrong === i ? 'shake bad' : ''}`} onClick={() => tap(c.order, i)} disabled={c.order < picked}>
            {c.order < picked && <span className="chip green tiny">{c.order + 1}</span>}
            <code>{c.text}</code>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Join Jam ---

interface JoinLevel {
  left: string;
  right: string;
  pairs: [string, string][];
}

function joinLevels(): JoinLevel[] {
  const levels: JoinLevel[] = [];
  for (const t of TABLES) {
    for (const c of t.columns) {
      if (!c.fk || c.fk.table === t.name) continue;
      if (t.name === 'wo_jobs' && c.fk.table === 'work_orders') continue;
      levels.push({ left: t.name, right: c.fk.table, pairs: [[c.name, c.fk.column]] });
    }
  }
  const out = shuffle(levels).slice(0, 8);
  // composite-key boss level every few rounds
  out.splice(2, 0, { left: 'wo_jobs', right: 'work_orders', pairs: [['wo_number', 'wo_number'], ['location_id', 'location_id']] });
  out.splice(7, 0, { left: 'wo_jobs', right: 'work_orders', pairs: [['wo_number', 'wo_number'], ['location_id', 'location_id']] });
  return out;
}

export function JoinJam({ api }: { api: GameApi }) {
  const levels = useMemo(joinLevels, []);
  const [li, setLi] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [made, setMade] = useState<[string, string][]>([]);
  const [bad, setBad] = useState<string | null>(null);
  const lv = levels[li % levels.length];
  const lt = TABLES.find((t) => t.name === lv.left)!;
  const rt = TABLES.find((t) => t.name === lv.right)!;
  const leftCols = useMemo(() => shuffle(lt.columns.map((c) => c.name)).slice(0, 6).concat(lv.pairs.map((p) => p[0])).filter((v, i, a) => a.indexOf(v) === i), [lt, lv]);
  const rightCols = useMemo(() => shuffle(rt.columns.map((c) => c.name)).slice(0, 5).concat(lv.pairs.map((p) => p[1])).filter((v, i, a) => a.indexOf(v) === i), [rt, lv]);

  const pickRight = (col: string) => {
    if (!sel) return;
    const ok = lv.pairs.some(([a, b]) => a === sel && b === col) && !made.some(([a]) => a === sel);
    if (ok) {
      sfx('select');
      const next = [...made, [sel, col] as [string, string]];
      setMade(next);
      setSel(null);
      if (next.length === lv.pairs.length) {
        sfx('correct');
        api.addScore(lv.pairs.length > 1 ? 40 : 15);
        setTimeout(() => {
          setLi((i) => i + 1);
          setMade([]);
        }, 350);
      }
    } else {
      sfx('wrong');
      setBad(col);
      api.penalty(3);
      setTimeout(() => setBad(null), 400);
    }
  };

  return (
    <div className="col" style={{ gap: 10, padding: 12 }}>
      <div className="tiny muted">
        Tap a column on the left, then the column it joins to on the right.{' '}
        {lv.pairs.length > 1 && <strong>⚠️ Composite key! You need {lv.pairs.length} pairs.</strong>}
      </div>
      <div className="jam">
        <div className="card col" style={{ gap: 6 }}>
          <strong className="mono">{lv.left}</strong>
          {leftCols.map((c) => {
            const done = made.some(([a]) => a === c);
            return (
              <button key={c} className={`mg-chip ${sel === c ? 'sel' : ''} ${done ? 'done' : ''}`} onClick={() => !done && setSel(c)}>
                <code>{c}</code>
              </button>
            );
          })}
        </div>
        <div className="jam-mid">{made.map(([a, b]) => <div key={a} className="chip green tiny">{a} = {b}</div>)}</div>
        <div className="card col" style={{ gap: 6 }}>
          <strong className="mono">{lv.right}</strong>
          {rightCols.map((c) => (
            <button key={c} className={`mg-chip ${bad === c ? 'shake bad' : ''} ${made.some(([, b]) => b === c) ? 'done' : ''}`} onClick={() => pickRight(c)} disabled={!sel}>
              <code>{c}</code>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Bug Hunt ---

export const BUGS: { sql: string; bug: string; why: string }[] = [
  { sql: 'SELECT stock_no FROM units WHERE received_date = NULL', bug: '=', why: '= NULL is never true; use IS NULL.' },
  { sql: 'SELECT location_id, COUNT(*) FROM deals WHERE COUNT(*) > 100 GROUP BY location_id', bug: 'WHERE', why: 'Aggregates must be filtered in HAVING.' },
  { sql: 'SELECT location_id, finance_type, COUNT(*) FROM deals GROUP BY location_id', bug: 'finance_type', why: 'finance_type is not grouped or aggregated.' },
  { sql: "SELECT * FROM units WHERE rv_class = 'Class A' OR rv_class = 'Class C' AND status = 'In Stock'", bug: 'OR', why: 'AND binds tighter than OR; add parentheses around the ORs.' },
  { sql: 'SELECT w.bill_type, COUNT(*) FROM work_orders w JOIN wo_jobs j ON j.wo_number = w.wo_number GROUP BY 1', bug: 'ON', why: 'Missing location_id: composite key fan-out.' },
  { sql: "SELECT u.stock_no FROM units u LEFT JOIN work_orders w ON w.stock_no = u.stock_no WHERE w.bill_type = 'Warranty'", bug: 'WHERE', why: 'WHERE on the right table turns the LEFT JOIN into an inner join.' },
  { sql: 'SELECT deal_id, trade_allowance + trade_acv AS over_allowance FROM deals', bug: '+', why: 'Over-allowance is allowance − ACV, not their sum.' },
  { sql: "SELECT source, 100 * COUNT_IF(status = 'Sold') / COUNT(*) FROM leads GROUP BY source ORDER BY 2 ASC", bug: 'ASC', why: "The best close rate first needs DESC." },
  { sql: 'SELECT COUNT(salesperson_id) FROM deals WHERE salesperson_id IS NULL', bug: 'IS', why: 'Unknown salespeople are -1 (a sentinel), not NULL.' },
  { sql: 'SELECT lead_number FROM leads QUALIFY ROW_NUMBER() OVER (PARTITION BY lead_number ORDER BY updated_at DESC) = 1', bug: 'updated_at', why: 'The migration copies have the newest updated_at; keep the lowest lead_id.' },
  { sql: 'SELECT SUM(d.front_gross) FROM deals d JOIN fi_products p ON p.deal_id = d.deal_id', bug: 'JOIN', why: 'Joining products fans out deals and double-counts front gross.' },
  { sql: 'SELECT COUNT(*) FROM employees WHERE termination_date > as_of_date()', bug: '>', why: 'Current employees have NULL termination dates, so add IS NULL OR.' },
  { sql: 'SELECT stock_no, as_of_date() - funded_date AS days FROM units', bug: 'funded_date', why: 'funded_date lives on floorplan_loans, not units.' },
  { sql: "SELECT DATEADD(day, 90, due_date) FROM curtailments", bug: 'DATEADD', why: 'DuckDB has no DATEADD; use due_date + INTERVAL 90 DAY.' },
];

export function BugHunt({ api }: { api: GameApi }) {
  const pool = useMemo(() => shuffle(BUGS), []);
  const [i, setI] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [bad, setBad] = useState<number | null>(null);
  const b = pool[i % pool.length];
  const toks = useMemo(() => significant(tokenize(b.sql)), [b]);
  const bugIdx = toks.findIndex((t) => t.text === b.bug || t.upper === b.bug.toUpperCase());
  const tap = (k: number) => {
    if (msg) return;
    if (k === bugIdx) {
      sfx('correct');
      api.addScore(20);
      setMsg(`🐞 Squashed! ${b.why}`);
      setTimeout(() => {
        setMsg(null);
        setI((x) => x + 1);
      }, 1500);
    } else {
      sfx('wrong');
      api.penalty(4);
      setBad(k);
      setTimeout(() => setBad(null), 400);
    }
  };
  return (
    <div className="col" style={{ gap: 12, padding: 12 }}>
      <div className="tiny muted">Tap the token that causes the bug. Wrong taps cost 4 seconds.</div>
      <div className="bug-query">
        {toks.map((t, k) => (
          <button key={k} className={`bug-tok ${bad === k ? 'shake bad' : ''} ${msg && k === bugIdx ? 'hit' : ''}`} onClick={() => tap(k)}>
            {t.text}
          </button>
        ))}
      </div>
      {msg && <div className="feedback good">{msg}</div>}
    </div>
  );
}

// ------------------------------------------------------ Row Count Roulette ---

export const ROULETTE: string[] = [
  "SELECT * FROM units WHERE status = 'In Stock'",
  'SELECT * FROM locations',
  "SELECT * FROM deals WHERE deal_status = 'Unwound'",
  'SELECT DISTINCT rv_class FROM units',
  "SELECT * FROM leads WHERE source = 'Referral'",
  'SELECT * FROM work_orders',
  "SELECT * FROM curtailments WHERE paid_date IS NULL AND due_date <= as_of_date()",
  'SELECT * FROM employees WHERE termination_date IS NULL',
  'SELECT location_id, COUNT(*) FROM deals GROUP BY location_id',
  "SELECT * FROM units WHERE rv_class = 'Class A' AND condition = 'New'",
  'SELECT * FROM wo_jobs',
  "SELECT * FROM fi_products WHERE product = 'GAP'",
  "SELECT DISTINCT manufacturer FROM units",
  'SELECT lead_number FROM leads GROUP BY lead_number HAVING COUNT(*) > 1',
  "SELECT * FROM deals WHERE salesperson_id = -1",
  'SELECT * FROM customers',
];
const BRACKETS: [number, number, string][] = [
  [0, 10, '0–10'],
  [11, 100, '11–100'],
  [101, 1000, '101–1,000'],
  [1001, Infinity, '1,000+'],
];

export function RowRoulette({ api, engine }: { api: GameApi; engine: SqlEngine }) {
  const pool = useMemo(() => shuffle(ROULETTE), []);
  const [i, setI] = useState(0);
  const [count, setCount] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const sql = pool[i % pool.length];
  useEffect(() => {
    setCount(null);
    setPicked(null);
    engine.query(`SELECT COUNT(*) FROM (${sql}) q`).then((r) => setCount(Number(r.rows[0][0])));
  }, [sql, engine]);
  const pick = (b: number) => {
    if (picked !== null || count === null) return;
    setPicked(b);
    const [lo, hi] = BRACKETS[b];
    if (count >= lo && count <= hi) {
      sfx('coin');
      api.addScore(10 + streak * 5);
      setStreak((s) => s + 1);
    } else {
      sfx('wrong');
      setStreak(0);
      api.penalty(3);
    }
    setTimeout(() => setI((x) => x + 1), 1300);
  };
  return (
    <div className="col" style={{ gap: 12, padding: 12 }}>
      <div className="tiny muted">How many rows will it return? Streaks score more! {streak > 1 && <strong>🔥 {streak} streak</strong>}</div>
      <pre className="untangle" style={{ padding: 12, whiteSpace: 'pre-wrap' }}>
        {sql}
      </pre>
      <div className="roulette">
        {BRACKETS.map(([lo, hi, label], b) => {
          const right = count !== null && count >= lo && count <= hi;
          return (
            <button key={label} className={`choice ${picked !== null ? (right ? 'right' : picked === b ? 'wrong' : '') : ''}`} onClick={() => pick(b)} disabled={count === null}>
              <span className="pixel-alt" style={{ fontSize: 18 }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
      {picked !== null && count !== null && <div className="center pixel-alt">Actual: {count.toLocaleString()} rows</div>}
    </div>
  );
}

// -------------------------------------------------------------- Lingo Match ---

export function LingoMatch({ api }: { api: GameApi }) {
  const save = useProgress((s) => s.save);
  const deck = useMemo(() => {
    const unlocked = CODEX.filter((t) => save?.codex.includes(t.id));
    const pool = unlocked.length >= 6 ? unlocked : [...unlocked, ...CODEX.filter((t) => !unlocked.includes(t))];
    const six = shuffle(pool).slice(0, 6);
    return shuffle(
      six.flatMap((t) => [
        { key: `${t.id}-t`, pair: t.id, text: t.term, kind: 'term' as const },
        { key: `${t.id}-d`, pair: t.id, text: t.definition.split(/[.:]/)[0].slice(0, 90), kind: 'def' as const },
      ]),
    );
  }, [save?.codex]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [round, setRound] = useState(0);
  const flip = (i: number) => {
    if (flipped.length === 2 || flipped.includes(i) || matched.includes(deck[i].pair)) return;
    sfx('blip');
    const f = [...flipped, i];
    setFlipped(f);
    if (f.length === 2) {
      const [a, b] = f;
      if (deck[a].pair === deck[b].pair && a !== b) {
        sfx('correct');
        api.addScore(15);
        const m = [...matched, deck[a].pair];
        setMatched(m);
        setFlipped([]);
        if (m.length === 6) {
          api.addScore(20);
          setTimeout(() => {
            setMatched([]);
            setRound((r) => r + 1);
          }, 600);
        }
      } else {
        setTimeout(() => setFlipped([]), 800);
      }
    }
  };
  return (
    <div className="col" style={{ gap: 10, padding: 12 }} key={round}>
      <div className="tiny muted">Match each dealer term with its meaning. Clear the board for a bonus!</div>
      <div className="memory">
        {deck.map((c, i) => {
          const up = flipped.includes(i) || matched.includes(c.pair);
          return (
            <button key={c.key} className={`card-flip ${up ? 'up' : ''} ${matched.includes(c.pair) ? 'matched' : ''} ${c.kind}`} onClick={() => flip(i)}>
              {up ? c.text : '?'}
            </button>
          );
        })}
      </div>
    </div>
  );
}
