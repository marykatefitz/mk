import { useState } from 'react';
import { LoadingScreen } from './components/LoadingScreen';
import { SchemaExplorer } from './overlays/SchemaExplorer';
import { useDealerDb } from './useDb';

export function App() {
  const { engine, stage, error } = useDealerDb();
  const [open, setOpen] = useState(true);
  if (!engine) return <LoadingScreen stage={stage} error={error} />;
  return open ? <SchemaExplorer engine={engine} onClose={() => setOpen(false)} /> : <button className="btn" onClick={() => setOpen(true)}>Schema</button>;
}
