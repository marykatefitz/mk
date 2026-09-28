// Browser implementation: DuckDB-WASM (EH build) in a Web Worker. Lazy-loaded.
import * as duckdb from '@duckdb/duckdb-wasm';
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import { normalizeCell } from '../normalize';
import type { Cell, SqlEngine } from '../types';

function arrowTypeName(t: { toString(): string; typeId?: number }): string {
  const s = t.toString();
  if (/^Interval/i.test(s)) return 'INTERVAL';
  // castTimestampToDate turns TIMESTAMP into Date64 (ms); real DATEs stay Date32 (days).
  if (/^Date64|^DateMillisecond|Date<MILLISECOND>/i.test(s)) return 'TIMESTAMP';
  if (/^Date/i.test(s)) return 'DATE';
  if (/^Timestamp/i.test(s)) return 'TIMESTAMP';
  if (/^Int|^Uint/i.test(s)) return 'INTEGER';
  if (/^Float/i.test(s)) return 'DOUBLE';
  if (/^Utf8|^LargeUtf8/i.test(s)) return 'VARCHAR';
  if (/^Bool/i.test(s)) return 'BOOLEAN';
  return s.toUpperCase();
}

export async function createWasmEngine(): Promise<SqlEngine> {
  const worker = new Worker(ehWorker);
  const logger = new duckdb.VoidLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(ehWasm);
  await db.open({
    query: { castBigIntToDouble: true, castDecimalToDouble: true, castTimestampToDate: true },
  });
  const conn = await db.connect();
  return {
    kind: 'duckdb-wasm',
    async query(sql) {
      const t0 = performance.now();
      const table = await conn.query(sql);
      const fields = table.schema.fields;
      const types = fields.map((f) => arrowTypeName(f.type));
      const cols = fields.map((_, i) => table.getChildAt(i));
      const rows: Cell[][] = [];
      for (let r = 0; r < table.numRows; r++) {
        rows.push(cols.map((col, i) => normalizeCell(col?.get(r), types[i])));
      }
      return { columns: fields.map((f, i) => ({ name: f.name, type: types[i] })), rows, elapsedMs: performance.now() - t0 };
    },
    async exec(sql) {
      await conn.query(sql);
    },
    async registerFile(name, text) {
      await db.registerFileText(name, text);
      return name;
    },
    async close() {
      await conn.close();
      await db.terminate();
      worker.terminate();
    },
  };
}
