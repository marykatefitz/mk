// node scripts/eval.mjs "<sql>" ... runs SQL in the browser (WASM) engine
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5173');
for (const sql of process.argv.slice(2)) {
  const r = await page.evaluate(async (sql) => {
    const { getDealerDb } = await import('/src/engines/duckdb/index.ts');
    const e = await getDealerDb();
    try { const r = await e.query(sql); return { cols: r.columns, rows: r.rows.slice(0, 5) }; } catch (err) { return { error: String(err) }; }
  }, sql);
  console.log(sql.slice(0, 80), '=>', JSON.stringify(r).slice(0, 700));
}
await browser.close();
