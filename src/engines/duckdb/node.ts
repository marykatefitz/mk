// Node implementation (used by unit tests and scripts, never bundled for the browser).
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDBInstance } from '@duckdb/node-api';
import { normalizeCell } from '../normalize';
import type { SqlEngine } from '../types';

export async function createNodeEngine(): Promise<SqlEngine> {
  const instance = await DuckDBInstance.create(':memory:');
  const conn = await instance.connect();
  const dir = mkdtempSync(join(tmpdir(), 'dealer-quest-'));
  return {
    kind: 'duckdb-node',
    async query(sql) {
      const t0 = performance.now();
      const reader = await conn.runAndReadAll(sql);
      const names = reader.columnNames();
      const types = reader.columnTypes().map((t) => t.toString());
      const rows = reader.getRowsJS().map((r) => r.map((v, i) => normalizeCell(v, types[i])));
      return { columns: names.map((name, i) => ({ name, type: types[i] })), rows, elapsedMs: performance.now() - t0 };
    },
    async exec(sql) {
      await conn.run(sql);
    },
    async registerFile(name, text) {
      const path = join(dir, name);
      writeFileSync(path, text);
      return path;
    },
    async close() {
      conn.closeSync();
      instance.closeSync();
    },
  };
}
