import { useEffect, useState } from 'react';
import { useProgress } from '../core/progress/store';
import { WORLDS } from '../departments/sql';
import { LoadingScreen } from './components/LoadingScreen';
import { SchemaExplorer } from './overlays/SchemaExplorer';
import { TerminalOverlay } from './terminal/TerminalOverlay';
import { useDealerDb } from './useDb';

// Temporary dev hub (replaced by the overworld in M3).
export function App() {
  const { engine, stage, error } = useDealerDb();
  const [open, setOpen] = useState<string | null>(null);
  const [schema, setSchema] = useState(false);
  const save = useProgress((s) => s.save);
  useEffect(() => {
    const p = useProgress.getState();
    if (!p.loadSlot(0)) p.newGame(0, 'Dev', { skin: '#e0ac69', hair: '#3b2418', hairStyle: 'short', shirt: '#14b8a6', pants: '#2b1d3a' });
  }, []);
  if (!engine) return <LoadingScreen stage={stage} error={error} />;
  const w = WORLDS[0];
  const idx = open ? w.challenges.indexOf(open) : -1;
  return (
    <div className="col" style={{ padding: 16, gap: 8, height: '100%', overflow: 'auto' }}>
      <div className="row">
        <h1 className="pixel" style={{ fontSize: 16 }}>Dealer Quest (dev hub)</h1>
        <span className="chip">XP {save?.xp}</span>
        <span className="chip">🪙 {save?.coins}</span>
        <button className="btn small" onClick={() => setSchema(true)}>Schema</button>
      </div>
      {w.challenges.map((id) => (
        <button key={id} className="btn ghost" style={{ justifyContent: 'flex-start' }} onClick={() => setOpen(id)}>
          {save?.solved[id] ? '✅' : '⬜'} {id}
        </button>
      ))}
      {open && (
        <TerminalOverlay
          engine={engine}
          challengeId={open}
          onClose={() => setOpen(null)}
          onNext={idx >= 0 && idx < w.challenges.length - 1 ? () => setOpen(w.challenges[idx + 1]) : () => setOpen(null)}
        />
      )}
      {schema && <SchemaExplorer engine={engine} onClose={() => setSchema(false)} />}
    </div>
  );
}
