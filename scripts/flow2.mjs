import { chromium, devices } from '@playwright/test';
const tag = process.argv[2] ?? 'd';
const browser = await chromium.launch();
const ctx = await browser.newContext(tag === 'p' ? { ...devices['iPhone 13'] } : { viewport: { width: 1366, height: 820 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message + ' :: ' + e.stack?.split('\n').slice(0,6).join(' | ')));
const shot = (n) => page.screenshot({ path: `/tmp/claude-0/shots/${tag}-${n}.png` });
await page.goto('http://localhost:5173/');
await page.evaluate(() => localStorage.clear());
await page.goto('http://localhost:5173/?slot=1&name=Mary');
await page.waitForTimeout(3500);
// finish intro dialogue
for (let i = 0; i < 30 && (await page.locator('.dialogue').count()); i++) {
  if (await page.locator('.dialogue-choice').count()) await page.keyboard.press('Enter');
  else await page.keyboard.press('Space');
  await page.waitForTimeout(200);
}
await page.waitForTimeout(400);
await shot('10-afterintro');
const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
await hold('ArrowRight', 3300);
await hold('ArrowDown', 1700);
await hold('ArrowLeft', 900);
await hold('ArrowUp', 120);
await page.waitForTimeout(200);
await shot('11-door');
await page.keyboard.press('e');
await page.waitForTimeout(1500);
await shot('12-inside');
// walk to terminal 1: room 320x240, spawn (160,220), desk1 at (48, 115)
await hold('ArrowUp', 900);
await hold('ArrowLeft', 1350);
await hold('ArrowUp', 250);
await page.waitForTimeout(200);
await shot('13-desk');
await page.keyboard.press('e');
await page.waitForTimeout(6000);
await shot('14-terminal');
console.log(errs.join('\n') || 'no errors');
await browser.close();
