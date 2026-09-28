import { useEffect, useMemo, useState } from 'react';
import { TABLES, TABLE_BY_NAME, type TableDef } from '../../data/schema';
import type { QueryResult, SqlEngine } from '../../engines/types';
import { DataGrid } from '../components/DataGrid';
import {
  CARD_W,
  ERD_POS,
  ERD_SIZE,
  HEAD_H,
  ROW_H,
  SYSTEM_COLOR,
  cardHeight,
  columnAnchor,
  edges,
  keyColumns,
} from '../components/erd';

interface Props {
  engine: SqlEngine | null;
  onClose?: () => void;
  /** embedded (inside the terminal) vs full overlay */
  embedded?: boolean;
  onInsert?: (text: string) => void;
}

export function SchemaExplorer({ engine, onClose, embedded, onInsert }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'erd' | 'list'>(() => (window.innerWidth < 760 ? 'list' : 'erd'));
  const [zoom, setZoom] = useState(() => Math.min(1, Math.max(0.5, (window.innerWidth - 40) / ERD_SIZE.w)));

  const body = (
    <div className="col" style={{ flex: 1, minHeight: 0, gap: 0 }}>
      <div className="row wrap" style={{ padding: '8px 10px', gap: 6, borderBottom: '2px solid var(--line)' }}>
        <button className={`btn small ${view === 'erd' ? 'yellow' : 'ghost'}`} onClick={() => setView('erd')}>
          Diagram
        </button>
        <button className={`btn small ${view === 'list' ? 'yellow' : 'ghost'}`} onClick={() => setView('list')}>
          List
        </button>
        {view === 'erd' && (
          <>
            <button className="btn small ghost icon" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.35, z - 0.15))}>
              −
            </button>
            <button className="btn small ghost icon" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))}>
              +
            </button>
          </>
        )}
        <div className="row wrap tiny" style={{ gap: 6, marginLeft: 'auto' }}>
          {Object.entries(SYSTEM_COLOR).map(([k, c]) => (
            <span key={k} className="chip" style={{ borderColor: c }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: c }} /> {k}
            </span>
          ))}
        </div>
      </div>
      <div className="row" style={{ flex: 1, minHeight: 0, alignItems: 'stretch', gap: 0 }}>
        <div className="scroll" style={{ flex: 1, minWidth: 0, background: 'var(--bg-2)' }}>
          {view === 'erd' ? <Erd zoom={zoom} selected={selected} onSelect={setSelected} /> : <TableList selected={selected} onSelect={setSelected} />}
        </div>
        {selected && (
          <TableDetail
            key={selected}
            table={TABLE_BY_NAME[selected]}
            engine={engine}
            onClose={() => setSelected(null)}
            onInsert={onInsert}
          />
        )}
      </div>
    </div>
  );

  if (embedded) return body;
  return (
    <div className="overlay" role="dialog" aria-label="Schema explorer">
      <div className="panel">
        <div className="overlay-header">
          <h2>🗂️ Schema Explorer</h2>
          <button className="btn small red" onClick={onClose}>
            Close
          </button>
        </div>
        {body}
      </div>
    </div>
  );
}

function Erd({ zoom, selected, onSelect }: { zoom: number; selected: string | null; onSelect: (t: string) => void }) {
  const lines = useMemo(() => edges(), []);
  const related = useMemo(() => {
    if (!selected) return new Set<string>();
    const s = new Set<string>([selected]);
    for (const e of lines) {
      if (e.from.table === selected) s.add(e.to.table);
      if (e.to.table === selected) s.add(e.from.table);
    }
    return s;
  }, [selected, lines]);

  return (
    <svg
      width={ERD_SIZE.w * zoom}
      height={ERD_SIZE.h * zoom}
      viewBox={`0 0 ${ERD_SIZE.w} ${ERD_SIZE.h}`}
      style={{ display: 'block', margin: 8 }}
      role="img"
      aria-label="Entity relationship diagram"
    >
      {lines.map((e, i) => {
        const self = e.from.table === e.to.table;
        const fromPos = ERD_POS[e.from.table];
        const toPos = ERD_POS[e.to.table];
        const active = selected && (e.from.table === selected || e.to.table === selected);
        let d: string;
        if (self) {
          const a = columnAnchor(e.from.table, e.from.column, 'right');
          const b = columnAnchor(e.to.table, e.to.column, 'right');
          d = `M ${a.x} ${a.y} C ${a.x + 40} ${a.y}, ${b.x + 40} ${b.y}, ${b.x} ${b.y}`;
        } else {
          const leftToRight = fromPos.x <= toPos.x;
          const a = columnAnchor(e.from.table, e.from.column, leftToRight ? 'right' : 'left');
          const b = columnAnchor(e.to.table, e.to.column, leftToRight ? 'left' : 'right');
          if (fromPos.x === toPos.x) {
            const a2 = columnAnchor(e.from.table, e.from.column, 'left');
            const b2 = columnAnchor(e.to.table, e.to.column, 'left');
            d = `M ${a2.x} ${a2.y} C ${a2.x - 36} ${a2.y}, ${b2.x - 36} ${b2.y}, ${b2.x} ${b2.y}`;
          } else {
            const mx = (a.x + b.x) / 2;
            d = `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
          }
        }
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={active ? 'var(--orange)' : 'var(--ink-3)'}
            strokeWidth={active ? 3 : 1.5}
            strokeDasharray={e.from.column.endsWith('location_id') && e.from.table === 'wo_jobs' ? '5 3' : undefined}
            opacity={selected && !active ? 0.25 : 0.9}
          />
        );
      })}
      {TABLES.map((t) => {
        const p = ERD_POS[t.name];
        const h = cardHeight(t);
        const dim = selected && !related.has(t.name);
        return (
          <g
            key={t.name}
            transform={`translate(${p.x} ${p.y})`}
            onClick={() => onSelect(t.name)}
            style={{ cursor: 'pointer' }}
            opacity={dim ? 0.4 : 1}
            role="button"
            tabIndex={0}
            aria-label={`Table ${t.name}`}
            onKeyDown={(ev) => ev.key === 'Enter' && onSelect(t.name)}
          >
            <rect x={0} y={4} width={CARD_W} height={h} rx={10} fill="var(--line)" />
            <rect
              x={0}
              y={0}
              width={CARD_W}
              height={h}
              rx={10}
              fill="var(--panel)"
              stroke={selected === t.name ? 'var(--orange)' : 'var(--line)'}
              strokeWidth={selected === t.name ? 4 : 2.5}
            />
            <path d={`M 0 10 a 10 10 0 0 1 10 -10 h ${CARD_W - 20} a 10 10 0 0 1 10 10 v ${HEAD_H - 10} h ${-CARD_W} z`} fill={SYSTEM_COLOR[t.system]} />
            <text x={10} y={20} fill="#fff" style={{ font: '700 13px var(--font-code)' }}>
              {t.name}
            </text>
            {keyColumns(t).map((c, i) => (
              <text key={c.name} x={10} y={HEAD_H + ROW_H * i + 14} fill="var(--ink)" style={{ font: '12px var(--font-code)' }}>
                {c.pk ? '🔑 ' : '↗ '}
                {c.name}
              </text>
            ))}
            <text x={10} y={h - 8} fill="var(--ink-3)" style={{ font: '11px var(--font-ui)' }}>
              + {t.columns.length - keyColumns(t).length} more columns
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function TableList({ selected, onSelect }: { selected: string | null; onSelect: (t: string) => void }) {
  return (
    <div className="col" style={{ padding: 10 }}>
      {TABLES.map((t) => (
        <button
          key={t.name}
          className="card"
          onClick={() => onSelect(t.name)}
          style={{ textAlign: 'left', cursor: 'pointer', borderColor: selected === t.name ? 'var(--orange)' : undefined, borderLeft: `8px solid ${SYSTEM_COLOR[t.system]}` }}
        >
          <div className="row">
            <strong className="mono grow">{t.name}</strong>
            <span className="chip tiny">{t.system}</span>
          </div>
          <div className="tiny muted">{t.description}</div>
        </button>
      ))}
    </div>
  );
}

function TableDetail({
  table,
  engine,
  onClose,
  onInsert,
}: {
  table: TableDef;
  engine: SqlEngine | null;
  onClose: () => void;
  onInsert?: (text: string) => void;
}) {
  const [preview, setPreview] = useState<QueryResult | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [tab, setTab] = useState<'columns' | 'rows'>('columns');
  useEffect(() => {
    if (!engine) return;
    let alive = true;
    engine.query(`SELECT * FROM ${table.name} LIMIT 10`).then((r) => alive && setPreview(r));
    engine.query(`SELECT COUNT(*) FROM ${table.name}`).then((r) => alive && setCount(Number(r.rows[0][0])));
    return () => {
      alive = false;
    };
  }, [engine, table.name]);

  return (
    <aside
      className="col"
      style={{
        width: 'min(460px, 100%)',
        borderLeft: '3px solid var(--line)',
        background: 'var(--panel)',
        minHeight: 0,
        position: window.innerWidth < 760 ? 'absolute' : 'relative',
        inset: window.innerWidth < 760 ? '0' : undefined,
        zIndex: 5,
        gap: 0,
      }}
    >
      <div className="row" style={{ padding: 10, borderBottom: '2px solid var(--line)', background: SYSTEM_COLOR[table.system], color: '#fff' }}>
        <strong className="mono grow" style={{ fontSize: 16 }}>
          {table.name}
        </strong>
        {count !== null && <span className="chip">{count.toLocaleString()} rows</span>}
        <button className="btn small ghost" onClick={onClose} aria-label="Close table details">
          ✕
        </button>
      </div>
      <div style={{ padding: '8px 12px' }} className="tiny">
        <span className="chip" style={{ marginRight: 6 }}>
          {table.system}
        </span>
        {table.description}
      </div>
      <div className="tabs" role="tablist">
        <button className="tab" role="tab" aria-selected={tab === 'columns'} onClick={() => setTab('columns')}>
          Columns
        </button>
        <button className="tab" role="tab" aria-selected={tab === 'rows'} onClick={() => setTab('rows')}>
          Preview 10 rows
        </button>
      </div>
      <div className="scroll" style={{ flex: 1, minHeight: 0, borderTop: '2px solid var(--line)', padding: 10 }}>
        {tab === 'columns' ? (
          <div className="col" style={{ gap: 6 }}>
            {table.columns.map((c) => (
              <div key={c.name} className="card" style={{ padding: '6px 10px' }}>
                <div className="row wrap" style={{ gap: 6 }}>
                  <button
                    className="mono"
                    style={{ fontWeight: 700, background: 'none', border: 0, padding: 0, cursor: onInsert ? 'pointer' : 'default', textDecoration: onInsert ? 'underline dotted' : undefined }}
                    onClick={() => onInsert?.(c.name)}
                    title={onInsert ? 'Insert into editor' : undefined}
                  >
                    {c.name}
                  </button>
                  <span className="chip tiny mono">{c.type}</span>
                  {c.pk && <span className="chip yellow tiny">PK</span>}
                  {c.fk && (
                    <span className="chip teal tiny">
                      → {c.fk.table}.{c.fk.column}
                    </span>
                  )}
                  {c.nullable && <span className="chip tiny">nullable</span>}
                </div>
                <div className="tiny muted" style={{ marginTop: 2 }}>
                  {c.description}
                </div>
              </div>
            ))}
          </div>
        ) : preview ? (
          <DataGrid result={preview} />
        ) : (
          <div className="muted">Loading…</div>
        )}
      </div>
      {onInsert && (
        <div style={{ padding: 10, borderTop: '2px solid var(--line)' }}>
          <button className="btn small teal" onClick={() => onInsert(table.name)}>
            Insert “{table.name}”
          </button>
        </div>
      )}
    </aside>
  );
}

