import { useEffect, useState } from 'react';
import type { SqlEngine } from '../engines/types';
import type { LoadStage } from '../engines/duckdb';

export function useDealerDb() {
  const [engine, setEngine] = useState<SqlEngine | null>(null);
  const [stage, setStage] = useState<LoadStage>('engine');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    import('../engines/duckdb')
      .then(({ getDealerDb }) => getDealerDb((s) => alive && setStage(s)))
      .then((e) => alive && (setEngine(e), setStage('ready')))
      .catch((e) => alive && setError(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, []);
  return { engine, stage, error };
}
