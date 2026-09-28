// Usage: node scripts/shot.mjs <url> <out.png> [width] [height] [waitSelector] [evalJs]
import { chromium } from '@playwright/test';
const [url, out, w = '1280', h = '800', sel, js] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
const t0 = Date.now();
await page.goto(url);
if (sel) await page.waitForSelector(sel, { timeout: 90000 }).catch((e) => logs.push('WAIT FAIL ' + e.message));
console.log('ready after', Date.now() - t0, 'ms');
if (js) console.log('eval:', JSON.stringify(await page.evaluate(js)));
await page.waitForTimeout(500);
await page.screenshot({ path: out });
console.log(logs.slice(-30).join('\n'));
await browser.close();
