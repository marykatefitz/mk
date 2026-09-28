import { useEffect, useState } from 'react';
import type { LoadStage } from '../../engines/duckdb';
import { DEALER_TIPS } from '../../core/tips';

const STAGE_TEXT: Record<LoadStage, string> = {
  engine: 'Starting the DMS…',
  data: 'Printing two years of paperwork…',
  tables: 'Filing it into 14 tables…',
  ready: 'Ready!',
};

export function LoadingScreen({ stage, error }: { stage: LoadStage; error?: string | null }) {
  const [tip, setTip] = useState(() => Math.floor(Math.random() * DEALER_TIPS.length));
  useEffect(() => {
    const t = setInterval(() => setTip((i) => (i + 1) % DEALER_TIPS.length), 4500);
    return () => clearInterval(t);
  }, []);
  const pct = { engine: 20, data: 55, tables: 85, ready: 100 }[stage];
  return (
    <div className="center" style={{ height: '100%', padding: 24 }}>
      <div className="panel col" style={{ maxWidth: 460, width: '100%', padding: 20, gap: 14 }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="loading-rv" aria-hidden>
            🚐
          </div>
          <div className="pixel" style={{ fontSize: 12 }}>
            {error ? 'Uh oh…' : STAGE_TEXT[stage]}
          </div>
        </div>
        <div style={{ height: 18, border: '3px solid var(--line)', borderRadius: 10, overflow: 'hidden', background: 'var(--panel-2)' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--teal)', transition: 'width .4s' }} />
        </div>
        {error ? (
          <div className="card" style={{ background: 'var(--bad-bg)' }}>{error}</div>
        ) : (
          <div className="card">
            <div className="pixel-alt tiny muted">DEALER TIP</div>
            <div>{DEALER_TIPS[tip]}</div>
          </div>
        )}
      </div>
    </div>
  );
}
