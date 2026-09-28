import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message, e.stack?.split('\n').slice(0,4).join(' | ')));
page.on('console', (m) => m.type() !== 'debug' && console.log(`[${m.type()}]`, m.text().slice(0, 300)));
await page.goto(process.argv[2] ?? 'http://localhost:5173');
await page.waitForTimeout(3000);
await browser.close();
