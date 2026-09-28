import { useMemo, useState } from 'react';
import { untangle, type LineKind } from '../../departments/sql/untangle';

export const LINE_COLOR: Record<LineKind, string> = {
  comment: 'transparent',
  with: 'var(--green)',
  select: 'var(--orange)',
  from: 'var(--teal)',
  join: 'var(--teal)',
  where: 'var(--purple)',
  group: 'var(--blue)',
  having: 'var(--blue)',
  qualify: '#ec4899',
  order: 'var(--yellow-d)',
  limit: 'var(--yellow-d)',
  setop: 'var(--red)',
  plain: 'var(--ink-3)',
};

export function UntangleView({ sql, onApply }: { sql: string; onApply?: (text: string) => void }) {
  const [comments, setComments] = useState(true);
  const lines = useMemo(() => {
    try {
      return untangle(sql, comments);
    } catch {
      return null;
    }
  }, [sql, comments]);
  if (!lines) return <div className="card">Couldn't untangle this one. Is it a complete query?</div>;
  const text = lines.map((l) => '  '.repeat(l.indent) + l.text).join('\n');
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row wrap">
        <label className="row tiny" style={{ gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={comments} onChange={(e) => setComments(e.target.checked)} /> Plain-English comments
        </label>
        <div className="grow" />
        {onApply && (
          <button className="btn small teal" onClick={() => onApply(text)}>
            Put this in the editor
          </button>
        )}
      </div>
      <pre className="untangle" aria-label="Untangled query">
        {lines.map((l, i) => (
          <div key={i} className={`ul ul-${l.kind}`} style={{ borderLeftColor: LINE_COLOR[l.kind], paddingLeft: 10 + l.indent * 16 }}>
            {l.text}
          </div>
        ))}
      </pre>
      <div className="row wrap tiny" style={{ gap: 6 }}>
        {(['with', 'select', 'from', 'where', 'group', 'qualify', 'order'] as LineKind[]).map((k) => (
          <span key={k} className="chip" style={{ borderColor: LINE_COLOR[k] }}>
            <span style={{ width: 10, height: 10, background: LINE_COLOR[k], borderRadius: 2 }} />
            {k === 'with' ? 'CTE' : k === 'group' ? 'GROUP/HAVING' : k === 'from' ? 'FROM/JOIN' : k === 'order' ? 'ORDER/LIMIT' : k.toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}
