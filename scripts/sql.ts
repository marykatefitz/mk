// Usage: npx tsx scripts/sql.ts "select ..." ["select ..."]
import { generateDataset } from '../src/data/generator';
import { createNodeEngine } from '../src/engines/duckdb/node';
import { loadDataset } from '../src/engines/duckdb/load';
const e = await createNodeEngine();
const t0 = performance.now();
await loadDataset(e, generateDataset());
console.error('loaded in', Math.round(performance.now() - t0), 'ms');
for (const q of process.argv.slice(2)) {
  try {
    const r = await e.query(q);
    console.log('\n> ' + q.replace(/\s+/g, ' ').slice(0, 140));
    console.table(r.rows.slice(0, 40).map((row) => Object.fromEntries(row.map((v, i) => [r.columns[i].name, v]))));
    if (r.rows.length > 40) console.log(`… ${r.rows.length} rows`);
  } catch (err) {
    console.log('ERR', (err as Error).message);
  }
}
