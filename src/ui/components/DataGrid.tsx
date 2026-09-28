import type { QueryResult } from '../../engines/types';

const fmt = (v: unknown) => {
  if (v === null) return 'NULL';
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return String(v);
    return (Math.round(v * 10000) / 10000).toLocaleString('en-US', { maximumFractionDigits: 4, useGrouping: false });
  }
  return String(v);
};

export function DataGrid({ result, maxRows = 500, highlightRows }: { result: Pick<QueryResult, 'columns' | 'rows'>; maxRows?: number; highlightRows?: Set<number> }) {
  const rows = result.rows.slice(0, maxRows);
  return (
    <div className="grid-wrap">
      <table className="grid">
        <thead>
          <tr>
            <th className="muted">#</th>
            {result.columns.map((c, i) => (
              <th key={i} title={c.type}>
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={highlightRows?.has(i) ? { outline: '2px solid var(--orange)' } : undefined}>
              <td className="muted">{i + 1}</td>
              {r.map((v, j) => (
                <td key={j} className={v === null ? 'null' : typeof v === 'number' ? 'num' : undefined}>
                  {fmt(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {result.rows.length > maxRows && (
        <div className="tiny muted" style={{ padding: 8 }}>
          Showing {maxRows} of {result.rows.length} rows.
        </div>
      )}
    </div>
  );
}
