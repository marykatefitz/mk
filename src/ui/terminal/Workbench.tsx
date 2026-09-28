import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '../../core/audio/sfx';
import { NPCS } from '../../core/characters';
import { CODEX_BY_ID } from '../../core/codex';
import { useProgress, type RewardEvent } from '../../core/progress/store';
import { predictOptions, shuffleOptions, type PredictOption } from '../../departments/sql/predict';
import {
  HINT_COSTS,
  checkAttempt,
  completeChallenge,
  recordAttempt,
  runSql,
} from '../../departments/sql/runtime';
import type { CheckResult } from '../../departments/sql/checker';
import type { Challenge, PredictChallenge, ReadChallenge, WriteChallenge } from '../../departments/sql/types';
import type { QueryResult, SqlEngine } from '../../engines/types';
import { DataGrid } from '../components/DataGrid';
import { Portrait } from '../components/Portrait';
import { SqlEditor, type SqlEditorHandle } from '../components/SqlEditor';
import { SchemaExplorer } from '../overlays/SchemaExplorer';
import { UntangleView } from './UntangleView';
import { XRayView } from './XRayView';
import './terminal.css';

export interface WorkbenchProps {
  engine: SqlEngine;
  challenge: Challenge;
  mode: 'quest' | 'boss';
  /** every graded attempt (boss mode uses this for damage) */
  onAttempt?: (ok: boolean) => void;
  /** called once when solved (quest mode also grants rewards) */
  onSolved?: (reward: RewardEvent | null) => void;
  /** in boss mode hints cost HP instead of coins: return false to refuse */
  onHint?: (tier: number) => boolean;
  onNext?: () => void;
  locked?: boolean;
}

type OutputTab = 'result' | 'xray' | 'untangle' | 'schema';
type MobileTab = 'quest' | 'code' | 'output';

const KEYBAR = ['SELECT', 'FROM', 'WHERE', 'AND', 'GROUP BY', 'ORDER BY', 'COUNT(*)', 'SUM(', 'AS', '*', '(', ')', "'", ',', '=', '<>', 'IS NULL', 'JOIN', 'ON', 'LIMIT', 'DESC', 'units', 'deals', 'leads'];

export function Workbench({ engine, challenge: c, mode, onAttempt, onSolved, onHint, onNext, locked }: WorkbenchProps) {
  const save = useProgress((s) => s.save);
  const alreadySolved = mode === 'quest' && !!save?.solved[c.id];
  const initialSql = (c.type === 'write' || c.type === 'fix' ? (alreadySolved ? save?.solved[c.id]?.sql : undefined) ?? c.starter ?? '' : '') as string;

  const [sql, setSql] = useState(initialSql);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<OutputTab>('result');
  const [mtab, setMtab] = useState<MobileTab>('quest');
  const [xraySql, setXraySql] = useState<string | null>(null);
  const [solved, setSolved] = useState(alreadySolved);
  const [reward, setReward] = useState<RewardEvent | null>(null);
  const [shake, setShake] = useState(false);
  const [bossHints, setBossHints] = useState(0);
  const [fails, setFails] = useState(0);
  const [stuckOpen, setStuckOpen] = useState(false);
  const stuckShown = useRef(false);
  const started = useRef(Date.now());
  const editor = useRef<SqlEditorHandle>(null);

  const hintsRevealed = mode === 'boss' ? bossHints : (save?.hints[c.id] ?? 0);
  const readonlyQuery = c.type === 'read' || c.type === 'predict' ? c.query : null;

  // Reset when the challenge changes (boss phases reuse the component).
  useEffect(() => {
    setSql(initialSql);
    setResult(null);
    setError(null);
    setCheck(null);
    setTab('result');
    setXraySql(null);
    setSolved(alreadySolved);
    setReward(null);
    setBossHints(0);
    setFails(0);
    stuckShown.current = false;
    started.current = Date.now();
    setMtab(window.innerWidth < 860 ? 'quest' : 'code');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id]);

  // "Stuck?" nudge after 4 minutes (quest mode only).
  useEffect(() => {
    if (mode !== 'quest' || solved) return;
    const t = setInterval(() => {
      if (!stuckShown.current && Date.now() - started.current > 4 * 60_000) {
        stuckShown.current = true;
        setStuckOpen(true);
      }
    }, 10_000);
    return () => clearInterval(t);
  }, [mode, solved, c.id]);

  const flash = () => {
    setShake(true);
    setTimeout(() => setShake(false), 450);
  };

  const markSolved = useCallback(
    (finalSql?: string) => {
      setSolved(true);
      sfx('correct');
      if (mode === 'quest') {
        const r = completeChallenge(c, finalSql);
        setReward(r);
        onSolved?.(r);
      } else onSolved?.(null);
    },
    [c, mode, onSolved],
  );

  const graded = (ok: boolean) => {
    if (mode === 'quest') recordAttempt(c);
    onAttempt?.(ok);
    if (!ok) {
      sfx('wrong');
      flash();
      setFails((f) => {
        const n = f + 1;
        if (mode === 'quest' && n >= 3 && !stuckShown.current) {
          stuckShown.current = true;
          setStuckOpen(true);
        }
        return n;
      });
    }
  };

  const run = async (text = sql) => {
    setBusy(true);
    sfx('run');
    const r = await runSql(engine, text);
    setBusy(false);
    setResult(r.result);
    setError(r.error);
    setCheck(null);
    setTab('result');
    setMtab('output');
    useProgress.getState().update((s) => {
      s.stats.queriesRun++;
    });
  };

  const submit = async () => {
    if (c.type !== 'write' && c.type !== 'fix') return;
    if (locked || solved) return;
    setBusy(true);
    sfx('run');
    const out = await checkAttempt(engine, c as WriteChallenge, sql);
    setBusy(false);
    setResult(out.result);
    setError(out.error);
    setCheck(out.check);
    setTab('result');
    setMtab('output');
    graded(out.check.ok);
    if (out.check.ok) markSolved(sql);
  };

  const openXray = (text: string) => {
    setXraySql(text);
    setTab('xray');
    setMtab('output');
    useProgress.getState().update((s) => {
      s.stats.xrays++;
    });
  };

  const revealHint = () => {
    const tier = hintsRevealed;
    if (tier >= 3) return;
    if (mode === 'boss') {
      if (onHint && !onHint(tier)) return;
      setBossHints(tier + 1);
      sfx('blip');
      return;
    }
    const cost = HINT_COSTS[tier];
    if (!useProgress.getState().spend(cost)) {
      sfx('wrong');
      return;
    }
    sfx('coin');
    useProgress.getState().update((s) => {
      s.hints[c.id] = tier + 1;
    });
  };

  const giver = NPCS[c.giver];
  const isWrite = c.type === 'write' || c.type === 'fix';

  return (
    <div className="wb" data-tab={mtab}>
      <div className="tabs wb-mobile-tabs" role="tablist">
        {(['quest', 'code', 'output'] as MobileTab[]).map((t) => (
          <button key={t} className="tab" role="tab" aria-selected={mtab === t} onClick={() => setMtab(t)}>
            {t === 'quest' ? '📜 Quest' : t === 'code' ? '⌨️ Query' : '📊 Output'}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------ quest pane */}
      <section className="wb-quest" aria-label="Quest">
        <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
          <Portrait npc={c.giver} size={mode === 'boss' ? 48 : 64} expression={solved ? 'happy' : fails >= 2 ? 'stressed' : 'neutral'} />
          <div className="speech grow">
            <div className="label-pixel">{giver.name.toUpperCase()}</div>
            <div>{c.story}</div>
          </div>
        </div>
        <div className="question">
          <div className="row wrap" style={{ gap: 6, marginBottom: 4 }}>
            <span className="chip purple">{typeLabel(c)}</span>
            {c.concepts.map((k) => (
              <span key={k} className="chip tiny">
                {k}
              </span>
            ))}
          </div>
          {c.question}
          {isWrite && (c as WriteChallenge).expectedColumns && (
            <div className="tiny" style={{ marginTop: 6 }}>
              Columns: {(c as WriteChallenge).expectedColumns!.map((x) => <code key={x} style={{ marginRight: 6 }}>{x}</code>)}
            </div>
          )}
          {isWrite && (c as WriteChallenge).orderMatters && <div className="tiny" style={{ marginTop: 4 }}>↕️ Order matters for this one.</div>}
        </div>

        {c.snowflake?.map((n) => (
          <details key={n.title} className="card">
            <summary className="pixel-alt" style={{ cursor: 'pointer' }}>
              ❄️ Snowflake ↔ DuckDB: {n.title}
            </summary>
            <div className="sf-grid" style={{ marginTop: 8 }}>
              <div>
                <div className="tiny muted">Snowflake</div>
                <pre>{n.snowflake}</pre>
              </div>
              <div>
                <div className="tiny muted">DuckDB (this game)</div>
                <pre>{n.duckdb}</pre>
              </div>
            </div>
            {n.note && <div className="tiny muted" style={{ marginTop: 6 }}>{n.note}</div>}
          </details>
        ))}

        <div className="col" style={{ gap: 6 }}>
          <div className="label-pixel">HINTS</div>
          {c.hints.map((h, i) => (
            <div key={i} className={`hint-card ${i < hintsRevealed ? 'revealed' : ''}`}>
              {i < hintsRevealed ? (
                <>
                  <div className="tiny muted">{['Nudge', 'Approach', 'Near-solution'][i]}</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{h}</div>
                </>
              ) : i === hintsRevealed && !solved ? (
                <button className="btn small yellow" onClick={revealHint} disabled={locked}>
                  💡 {['Nudge', 'Approach', 'Near-solution'][i]} ({mode === 'boss' ? `−${[5, 10, 15][i]} HP` : `${HINT_COSTS[i]} coins`})
                </button>
              ) : (
                <span className="tiny muted">🔒 {['Nudge', 'Approach', 'Near-solution'][i]}</span>
              )}
            </div>
          ))}
        </div>

        {solved && mode === 'quest' && (
          <SolvedPanel challenge={c} reward={reward} onNext={onNext} />
        )}
      </section>

      {/* ------------------------------------------------ code pane */}
      <section className={`wb-code ${readonlyQuery ? 'readonly' : ''}`} aria-label="Query">
        <div className="wb-editor" style={{ minHeight: 0 }}>
          {readonlyQuery ? (
            <SqlEditor key={c.id} value={readonlyQuery} readOnly />
          ) : (
            <SqlEditor ref={editor} key={c.id} value={sql} onChange={setSql} onRun={() => void run()} />
          )}
        </div>
        <div className="col" style={{ gap: 6 }}>
          {isWrite && (
            <div className="keybar" aria-label="SQL keys">
              {KEYBAR.map((k) => (
                <button key={k} onClick={() => editor.current?.insert(k === '(' || k === ')' || k === "'" || k === ',' ? k : `${k} `)}>
                  {k}
                </button>
              ))}
            </div>
          )}
          <div className="wb-toolbar">
            {isWrite ? (
              <>
                <button className="btn teal" onClick={() => void run()} disabled={busy || locked} title="Ctrl/⌘ + Enter">
                  ▶ Run
                </button>
                <button className="btn green" onClick={() => void submit()} disabled={busy || locked || solved}>
                  ✓ Check answer
                </button>
                <button className="btn small purple" onClick={() => openXray(sql)} disabled={!sql.trim() || locked}>
                  🩻 X-Ray
                </button>
                <button
                  className="btn small blue"
                  onClick={() => {
                    setTab('untangle');
                    setMtab('output');
                    useProgress.getState().update((s) => {
                      s.stats.untangles++;
                    });
                  }}
                  disabled={!sql.trim()}
                >
                  🧶 Untangle
                </button>
                {c.starter !== undefined && (
                  <button className="btn small ghost" onClick={() => setSql(c.starter ?? '')} disabled={locked}>
                    ↺ Reset
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  className="btn small blue"
                  onClick={() => {
                    setTab('untangle');
                    setMtab('output');
                  }}
                >
                  🧶 Untangle
                </button>
                <button className="btn small purple" onClick={() => openXray(readonlyQuery!)} disabled={!solved && (mode === 'boss' || c.type === 'predict')} title="Available after you answer">
                  🩻 X-Ray
                </button>
                {solved && (
                  <button className="btn small teal" onClick={() => void run(readonlyQuery!)}>
                    ▶ Run it
                  </button>
                )}
              </>
            )}
            <div className="grow" />
            <button className={`btn small ${tab === 'schema' ? 'yellow' : 'ghost'}`} onClick={() => { setTab('schema'); setMtab('output'); }}>
              🗂️ Schema
            </button>
          </div>
        </div>

        <div className={`wb-output ${shake ? 'shake' : ''}`}>
          <div className="tabs" role="tablist" style={{ borderBottom: '2px solid var(--line)', paddingBottom: 0 }}>
            {(['result', 'xray', 'untangle', 'schema'] as OutputTab[]).map((t) => (
              <button key={t} className="tab" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                {t === 'result' ? (readonlyQuery ? 'Answer' : 'Result') : t === 'xray' ? 'X-Ray' : t === 'untangle' ? 'Untangle' : 'Schema'}
              </button>
            ))}
          </div>
          <div className="wb-output-body">
            {tab === 'result' &&
              (c.type === 'read' ? (
                <ReadPanel c={c} solved={solved} locked={locked} onAnswer={(ok) => { graded(ok); if (ok) markSolved(); }} result={result} />
              ) : c.type === 'predict' ? (
                <PredictPanel c={c} engine={engine} solved={solved} locked={locked} onAnswer={(ok) => { graded(ok); if (ok) markSolved(); }} result={result} />
              ) : (
                <ResultPanel result={result} error={error} check={check} busy={busy} />
              ))}
            {tab === 'xray' && (xraySql ? <XRayView engine={engine} sql={xraySql} /> : <div className="muted">Press 🩻 X-Ray to see how SQL runs your query step by step.</div>)}
            {tab === 'untangle' && (
              <UntangleView
                sql={readonlyQuery ?? sql}
                onApply={
                  readonlyQuery
                    ? undefined
                    : (text) => {
                        setSql(text);
                        setMtab('code');
                      }
                }
              />
            )}
            {tab === 'schema' && (
              <div style={{ height: '100%', minHeight: 360, display: 'flex' }}>
                <SchemaExplorer engine={engine} embedded onInsert={isWrite ? (t) => { editor.current?.insert(t); } : undefined} />
              </div>
            )}
          </div>
        </div>
      </section>

      {stuckOpen && <StuckModal challenge={c} onClose={() => setStuckOpen(false)} />}
    </div>
  );
}

function typeLabel(c: Challenge) {
  return { write: '✍️ Write it', fix: '🔧 Fix it', read: '👓 Read it', predict: '🔮 Predict it' }[c.type];
}

function ResultPanel({ result, error, check, busy }: { result: QueryResult | null; error: string | null; check: CheckResult | null; busy: boolean }) {
  if (busy) return <div className="muted">Running…</div>;
  return (
    <div className="col" style={{ gap: 10 }}>
      {check && (
        <div className={`feedback ${check.ok ? 'good' : check.kind === 'order' ? 'warn' : 'bad'}`} role="status">
          <strong>{check.ok ? '✅ ' : '❌ '}{check.headline}</strong>
          {check.tips.length > 0 && (
            <ul>
              {check.tips.map((t, i) => (
                <li key={i} className={check.kind === 'error' ? 'error-text' : undefined}>
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && !check && (
        <div className="feedback bad">
          <strong>⚠️ Query error</strong>
          <div className="error-text">{error}</div>
        </div>
      )}
      {result && (
        <>
          <div className="tiny muted">
            {result.rows.length.toLocaleString()} row{result.rows.length === 1 ? '' : 's'} · {Math.round(result.elapsedMs)} ms
          </div>
          <DataGrid result={result} />
        </>
      )}
      {!result && !error && !check && <div className="muted">Press ▶ Run (or Ctrl/⌘+Enter) to see results. ✓ Check answer grades it.</div>}
    </div>
  );
}

function ReadPanel({ c, solved, locked, onAnswer, result }: { c: ReadChallenge; solved: boolean; locked?: boolean; onAnswer: (ok: boolean) => void; result: QueryResult | null }) {
  const [picked, setPicked] = useState<number[]>([]);
  useEffect(() => setPicked([]), [c.id]);
  const done = solved || picked.includes(c.answer);
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="tiny muted">Read the query (try 🧶 Untangle), then pick an answer.</div>
      {c.choices.map((ch, i) => {
        const state = picked.includes(i) || (solved && i === c.answer) ? (i === c.answer ? 'right' : 'wrong') : '';
        return (
          <div key={i} className="col" style={{ gap: 4 }}>
            <button
              className={`choice ${state}`}
              disabled={done || picked.includes(i) || locked}
              onClick={() => {
                setPicked((p) => [...p, i]);
                onAnswer(i === c.answer);
              }}
            >
              <strong>{String.fromCharCode(65 + i)}.</strong> {ch}
            </button>
            {(picked.includes(i) || (done && i === c.answer)) && <div className="tiny" style={{ paddingLeft: 8 }}>{c.explanations[i]}</div>}
          </div>
        );
      })}
      {result && <DataGrid result={result} />}
    </div>
  );
}

function PredictPanel({ c, engine, solved, locked, onAnswer, result }: { c: PredictChallenge; engine: SqlEngine; solved: boolean; locked?: boolean; onAnswer: (ok: boolean) => void; result: QueryResult | null }) {
  const [opts, setOpts] = useState<PredictOption[] | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  useEffect(() => {
    setPicked([]);
    predictOptions(engine, c).then((o) => setOpts(shuffleOptions(o, c.id)));
  }, [engine, c]);
  const done = solved || (opts && picked.some((i) => opts[i].correct));
  if (!opts) return <div className="muted">Shuffling the cards…</div>;
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="tiny muted">{c.measure === 'rows' ? 'How many rows will this query return?' : 'What value will this query return?'} Pick before you peek!</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
        {opts.map((o, i) => {
          const state = picked.includes(i) || (solved && o.correct) ? (o.correct ? 'right' : 'wrong') : '';
          return (
            <button
              key={i}
              className={`choice ${state}`}
              style={{ textAlign: 'center', fontFamily: 'var(--font-pixel-alt)', fontSize: 22 }}
              disabled={!!done || picked.includes(i) || locked}
              onClick={() => {
                setPicked((p) => [...p, i]);
                onAnswer(o.correct);
              }}
            >
              {o.value.toLocaleString()}
            </button>
          );
        })}
      </div>
      {opts.map((o, i) =>
        picked.includes(i) || (done && o.correct) ? (
          <div key={i} className={`feedback ${o.correct ? 'good' : 'bad'} tiny`}>
            <strong>{o.value.toLocaleString()}:</strong> {o.why}
          </div>
        ) : null,
      )}
      {result && <DataGrid result={result} />}
    </div>
  );
}

function SolvedPanel({ challenge: c, reward, onNext }: { challenge: Challenge; reward: RewardEvent | null; onNext?: () => void }) {
  const codex = useMemo(() => (c.codex ?? []).map((id) => CODEX_BY_ID[id]).filter(Boolean), [c.codex]);
  return (
    <div className="col bounce-in" style={{ gap: 10 }}>
      <div className="solved-banner">
        <div className="big">SOLVED!</div>
        {reward && (
          <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 6 }}>
            <span className="chip purple">+{reward.xp} XP</span>
            <span className="chip yellow">+{reward.coins} 🪙</span>
            {reward.golden && <span className="chip orange">✨ Golden query card!</span>}
          </div>
        )}
      </div>
      <div className="card">
        <div className="label-pixel">WHY THIS MATTERS AT A DEALERSHIP</div>
        <div>{c.why}</div>
      </div>
      {codex.length > 0 && (
        <div className="card">
          <div className="label-pixel">📖 CODEX {reward?.codex.length ? 'UNLOCKED' : ''}</div>
          {codex.map((t) => (
            <div key={t.id} style={{ marginTop: 6 }}>
              <strong>{t.term}:</strong> <span className="tiny">{t.definition}</span>
            </div>
          ))}
        </div>
      )}
      {onNext && (
        <button className="btn green" onClick={onNext}>
          Next ▶
        </button>
      )}
    </div>
  );
}

function StuckModal({ challenge: c, onClose }: { challenge: Challenge; onClose: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const dataIssue = c.concepts.some((k) => /NULL|sentinel|duplicate|orphan|-1|data quality/i.test(k)) || c.giver === 'devin';
  const choices = [
    { id: 'giver', label: `Ask ${NPCS[c.giver].name.split(' ')[0]} what they need exactly`, good: !dataIssue, reply: 'Great call. Five minutes of clarifying beats an hour of guessing. Here is a free hint.' },
    { id: 'devin', label: 'Ask Devin (Data Engineer) if the data is weird', good: dataIssue, reply: 'Devin: "Oh yeah, that table has quirks. Thanks for asking early!" Here is a free hint.' },
    { id: 'alone', label: 'Keep grinding alone and say nothing', good: false, reply: 'Grinding silently feels productive, but asking early is a real skill. Next time, raise your hand sooner!' },
  ];
  const choose = (ch: (typeof choices)[number]) => {
    setPicked(ch.id);
    if (ch.id === 'alone') {
      sfx('back');
      return;
    }
    sfx('select');
    useProgress.getState().update((s) => {
      if (ch.good) s.stats.askedEarly++;
      s.hints[c.id] = Math.min(3, (s.hints[c.id] ?? 0) + 1);
    });
  };
  const chosen = choices.find((x) => x.id === picked);
  return (
    <div className="overlay" style={{ alignItems: 'center', zIndex: 80 }} role="dialog" aria-label="Stuck?">
      <div className="panel col" style={{ maxWidth: 480, padding: 16, gap: 10 }}>
        <div className="row" style={{ gap: 12 }}>
          <Portrait npc="scout" size={56} expression="surprised" />
          <div>
            <div className="label-pixel">SCOUT</div>
            <div>You've been stuck on this a while. Who do you ask?</div>
          </div>
        </div>
        {!chosen &&
          choices.map((ch) => (
            <button key={ch.id} className="choice" onClick={() => choose(ch)}>
              {ch.label}
            </button>
          ))}
        {chosen && (
          <div className={`feedback ${chosen.id === 'alone' ? 'warn' : 'good'}`}>
            {chosen.id !== 'alone' && !chosen.good ? 'Asking is always better than grinding, even if someone else would have known more. ' : ''}
            {chosen.reply}
          </div>
        )}
        {chosen && (
          <button className="btn" onClick={onClose}>
            Back to it
          </button>
        )}
      </div>
    </div>
  );
}
