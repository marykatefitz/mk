import { generateDataset } from '../src/data/generator';
import { createNodeEngine } from '../src/engines/duckdb/node';
import { loadDataset } from '../src/engines/duckdb/load';
import { runXray } from '../src/departments/sql/xray';
import { untangleText } from '../src/departments/sql/untangle';
const e = await createNodeEngine();
await loadDataset(e, generateDataset());
for (const q of process.argv.slice(2)) {
  console.log(untangleText(q));
  for (const s of await runXray(e, q)) console.log(`[${s.kind}] ${s.caption}${s.error ? ' ERR ' + s.error.slice(0, 100) : ''}`);
  console.log('----');
}
