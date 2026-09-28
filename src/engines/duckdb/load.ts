import { AS_OF_DATE, TABLES, ddlFor } from '../../data/schema';
import type { Dataset, Row } from '../../data/generator/types';
import type { SqlEngine } from '../types';

const NULL = '\\N';

function csvCell(v: Row[string]): string {
  if (v === null) return NULL;
  if (typeof v === 'number') return String(v);
  return `"${v.replace(/"/g, '""')}"`;
}

/** Serialize a table to CSV (core DuckDB reader: no extensions needed, so it works offline). */
export function toCsv(rows: Row[], columns: string[]): string {
  const out = [columns.join(',')];
  for (const r of rows) out.push(columns.map((c) => csvCell(r[c])).join(','));
  return out.join('\n');
}

/** Create every table and fill it from the generated dataset. Works on any SqlEngine. */
export async function loadDataset(engine: SqlEngine, ds: Dataset | { tables: Record<string, string> }): Promise<void> {
  for (const def of TABLES) {
    await engine.exec(ddlFor(def));
    const data = ds.tables[def.name];
    const csv = typeof data === 'string' ? data : toCsv(data, def.columns.map((c) => c.name));
    const path = await engine.registerFile(`${def.name}.csv`, csv);
    const cols = def.columns.map((c) => `'${c.name}': '${c.type}'`).join(', ');
    await engine.exec(
      `INSERT INTO ${def.name} SELECT * FROM read_csv('${path}', header = true, nullstr = '${NULL}', quote = '"', escape = '"', columns = {${cols}})`,
    );
  }
  // The game's "today". Lessons explain that at work you'd write CURRENT_DATE.
  await engine.exec(`CREATE OR REPLACE MACRO as_of_date() AS DATE '${AS_OF_DATE}'`);
}
