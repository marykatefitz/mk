import { chromium } from '@playwright/test';
const W = +(process.argv[2] ?? 1366), H = +(process.argv[3] ?? 820), tag = process.argv[4] ?? 'd';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
const shot = (n) => page.screenshot({ path: `/tmp/claude-0/shots/${tag}-${n}.png` });
await page.goto('http://localhost:5173');
await page.waitForTimeout(800);
await shot('01-title');
await page.mouse.click(W / 2, H / 2);
await page.waitForTimeout(400);
await page.click('text=New game >> nth=0');
await page.fill('input[placeholder="e.g. Mary"]', 'Mary');
await page.click('text=curly');
await shot('02-create');
await page.click('text=Clock in');
await page.waitForTimeout(2500);
await shot('03-intro');
for (let i = 0; i < 4; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(250); await page.keyboard.press('Space'); await page.waitForTimeout(300); }
await shot('04-choice');
await page.keyboard.press('Enter'); await page.waitForTimeout(300);
for (let i = 0; i < 6; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(250); }
await page.waitForTimeout(500);
await shot('05-world');
// walk to the lot office door: player at (36*16+8, 16*16+8); door at (49.5*16, 24*16+4)
const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
await hold('ArrowRight', 1650);
await hold('ArrowDown', 900);
await shot('06-door');
await page.keyboard.press('e');
await page.waitForTimeout(1200);
await shot('07-inside');
console.log(errs.join('\n'));
await browser.close();
