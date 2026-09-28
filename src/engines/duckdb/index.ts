import type { SqlEngine } from '../types';
import { loadDataset } from './load';

let enginePromise: Promise<SqlEngine> | null = null;

export type LoadStage = 'engine' | 'data' | 'tables' | 'ready';

/** Lazy singleton: boots DuckDB-WASM and loads the Summit Trail RV database once. */
export function getDealerDb(onStage?: (s: LoadStage) => void): Promise<SqlEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      onStage?.('engine');
      const genWorker = new Worker(new URL('../../data/generator/worker.ts', import.meta.url), { type: 'module' });
      const dataPromise = new Promise<{ tables: Record<string, string> }>((resolve, reject) => {
        genWorker.onmessage = (e) => resolve(e.data);
        genWorker.onerror = (e) => reject(e);
      });
      genWorker.postMessage({});
      const { createWasmEngine } = await import('./wasm');
      const engine = await createWasmEngine();
      onStage?.('data');
      const data = await dataPromise;
      genWorker.terminate();
      onStage?.('tables');
      await loadDataset(engine, data);
      onStage?.('ready');
      return engine;
    })();
    enginePromise.catch(() => (enginePromise = null));
  }
  return enginePromise;
}
