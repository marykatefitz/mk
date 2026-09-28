import { AS_OF_DATE, TABLES, ddlFor } from '../../data/schema';
import type { Dataset } from '../../data/generator/types';
import type { SqlEngine } from '../types';

/** Create every table and fill it from the generated dataset. Works on any SqlEngine. */
export async function loadDataset(engine: SqlEngine, ds: Dataset): Promise<void> {
  for (const def of TABLES) {
    await engine.exec(ddlFor(def));
    const rows = ds.tables[def.name];
    if (!rows.length) continue;
    const path = await engine.registerFile(`${def.name}.json`, JSON.stringify(rows));
    const cols = def.columns.map((c) => `${c.name}: '${c.type}'`).join(', ');
    await engine.exec(
      `INSERT INTO ${def.name} SELECT * FROM read_json('${path}', format = 'array', columns = {${cols}})`,
    );
  }
  // The game's "today". Lessons explain that at work you'd write CURRENT_DATE.
  await engine.exec(`CREATE OR REPLACE MACRO as_of_date() AS DATE '${AS_OF_DATE}'`);
}
