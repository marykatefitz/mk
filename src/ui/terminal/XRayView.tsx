import { useEffect, useState } from 'react';
import { runXray, type StepKind, type XrayStepResult } from '../../departments/sql/xray';
import type { SqlEngine } from '../../engines/types';
import { prefersReducedMotion } from '../../core/settings';
import { DataGrid } from '../components/DataGrid';
import { sfx } from '../../core/audio/sfx';

export const STEP_COLOR: Record<StepKind, string> = {
  CTE: 'var(--green)',
  FROM: 'var(--teal)',
  JOIN: 'var(--teal)',
  WHERE: 'var(--purple)',
  'GROUP BY': 'var(--blue)',
  HAVING: 'var(--blue)',
  SELECT: 'var(--orange)',
  QUALIFY: '#ec4899',
  DISTINCT: 'var(--orange)',
  'ORDER BY': 'var(--yellow-d)',
  LIMIT: 'var(--yellow-d)',
  QUERY: 'var(--ink-3)',
};

const ORDER_NOTE = 'SQL is written SELECT-first, but it RUNS in this order:';

export function XRayView({ engine, sql }: { engine: SqlEngine; sql: string }) {
  const [steps, setSteps] = useState<XrayStepResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setSteps(null);
    setError(null);
    setShown(0);
    runXray(engine, sql)
      .then((s) => {
        if (!alive) return;
        setSteps(s);
        setOpen(s.length - 1);
        if (prefersReducedMotion()) setShown(s.length);
      })
      .catch((e) => alive && setError(String(e.message ?? e)));
    return () => {
      alive = false;
    };
  }, [engine, sql]);

  useEffect(() => {
    if (!steps || shown >= steps.length) return;
    const t = setTimeout(() => {
      setShown((n) => n + 1);
      sfx('blip', 1 + shown * 0.08);
    }, 380);
    return () => clearTimeout(t);
  }, [steps, shown]);

  if (error) return <div className="card" style={{ background: 'var(--bad-bg)' }}>{error}</div>;
  if (!steps) return <div className="muted" style={{ padding: 12 }}>X-raying your query…</div>;

  const main = steps.filter((s) => s.kind !== 'CTE');
  return (
    <div className="col xray" style={{ gap: 8 }}>
      <div className="tiny muted">
        {ORDER_NOTE}{' '}
        <strong>
          {main.map((s) => s.kind).filter((k, i, a) => a.indexOf(k) === i).join(' → ')}
        </strong>
      </div>
      {steps.slice(0, shown).map((s, i) => (
        <div key={i} className="xray-step bounce-in" style={{ borderLeftColor: STEP_COLOR[s.kind] }}>
          <button className="xray-head" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
            <span className="chip" style={{ background: STEP_COLOR[s.kind], color: '#fff', borderColor: 'var(--line)' }}>
              {i + 1}. {s.kind}
            </span>
            <code className="xray-clause">{s.clause}</code>
            <span className="xray-count">{s.rowCount === null ? '—' : `${s.rowCount.toLocaleString()} rows`}</span>
          </button>
          <div className="xray-caption">{s.caption}</div>
          {open === i && s.preview && (
            <div style={{ marginTop: 6 }}>
              <DataGrid result={s.preview} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
