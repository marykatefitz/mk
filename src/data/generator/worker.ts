// Generates the dataset off the main thread and hands back per-table CSV text.
import { TABLES } from '../schema';
import { toCsv } from '../../engines/duckdb/load';
import { generateDataset } from './index';

self.onmessage = (e: MessageEvent<{ seed?: number }>) => {
  const ds = generateDataset(e.data.seed);
  const tables: Record<string, string> = {};
  for (const def of TABLES) tables[def.name] = toCsv(ds.tables[def.name], def.columns.map((c) => c.name));
  (self as unknown as Worker).postMessage({ tables });
};
