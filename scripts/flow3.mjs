import { chromium, devices } from '@playwright/test';
const tag = process.argv[2] ?? 'd';
const browser = await chromium.launch();
const ctx = await browser.newContext(tag === 'p' ? { ...devices['iPhone 13'] } : { viewport: { width: 1366, height: 820 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message + ' :: ' + e.stack?.split('\n').slice(0, 6).join(' | ')));
const shot = (n) => page.screenshot({ path: `/tmp/claude-0/shots/${tag}-${n}.png` });
const tp = (x, y, f = 'up') => page.evaluate(([x, y, f]) => window.__dq.teleport(x, y, f), [x, y, f]);
const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(150); };
await page.goto('http://localhost:5173/');
await page.evaluate(() => localStorage.clear());
await page.goto('http://localhost:5173/?slot=1&name=Mary');
await page.waitForFunction(() => window.__dq?.player(), null, { timeout: 60000 });
await page.waitForTimeout(1500);
for (let i = 0; i < 30 && (await page.locator('.dialogue').count()); i++) {
  if (await page.locator('.dialogue-choice').count()) await press('Enter');
  else await press('Space');
}
await tp(49.5 * 16, 24 * 16 + 14);
await page.waitForTimeout(300);
await shot('11-door');
if (tag === 'p') { await page.locator('.touch-btn.a').dispatchEvent('pointerdown'); await page.waitForTimeout(100); await page.locator('.touch-btn.a').dispatchEvent('pointerup'); }
else await press('e');
await page.waitForFunction(() => window.__dq.scene() === 'interior', null, { timeout: 10000 });
await page.waitForTimeout(700);
await shot('12-inside');
await tp(48, 7.2 * 16 + 14);
await page.waitForTimeout(300);
await shot('13-desk');
if (tag === 'p') { await page.locator('.touch-btn.a').dispatchEvent('pointerdown'); await page.waitForTimeout(100); await page.locator('.touch-btn.a').dispatchEvent('pointerup'); }
else await press('e');
await page.waitForSelector('.cm-content >> visible=true', { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(800);
await shot('14-terminal');
console.log(errs.join('\n') || 'no errors');
await browser.close();
