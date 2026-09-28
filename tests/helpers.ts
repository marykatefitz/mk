import { generateDataset } from '../src/data/generator';
import type { Dataset } from '../src/data/generator/types';
import { loadDataset } from '../src/engines/duckdb/load';
import { createNodeEngine } from '../src/engines/duckdb/node';
import type { SqlEngine } from '../src/engines/types';

let cached: Dataset | null = null;
export function dataset(): Dataset {
  return (cached ??= generateDataset());
}

export async function loadedEngine(): Promise<SqlEngine> {
  const e = await createNodeEngine();
  await loadDataset(e, dataset());
  return e;
}

export async function scalar(e: SqlEngine, sql: string): Promise<number> {
  const r = await e.query(sql);
  return Number(r.rows[0][0]);
}
