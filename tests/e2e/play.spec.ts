import { expect, test, type Page } from '@playwright/test';

// Full playthrough of the first building: intro, walk in, solve a terminal, beat the mini-boss.
// Runs on the 'phone' and 'desktop' projects from playwright.config.ts.

const tp = (page: Page, x: number, y: number) => page.evaluate(([x, y]) => (window as any).__dq.teleport(x, y, 'up'), [x, y]);

async function pressA(page: Page, isPhone: boolean) {
  if (isPhone) {
    const a = page.locator('.touch-btn.a');
    if (!(await a.count())) return; // an overlay is opening and the touch controls are hidden
    await a.dispatchEvent('pointerdown');
    await page.waitForTimeout(80);
    if (await a.count()) await a.dispatchEvent('pointerup');
  } else await page.keyboard.press('e');
}

/** Wait for the interact prompt, then press A/E until `done` holds (input is ignored during scene fades). */
async function interact(page: Page, isPhone: boolean, done: () => Promise<boolean>) {
  await page.waitForSelector('.hud-prompt', { timeout: 15_000 });
  for (let i = 0; i < 20 && !(await done()); i++) {
    await pressA(page, isPhone);
    await page.waitForTimeout(500);
  }
}
const inScene = (page: Page, key: string) => () => page.evaluate((k) => (window as any).__dq.scene() === k, key);

async function answer(page: Page, sql: string, isPhone: boolean) {
  if (isPhone) await page.locator('.wb-mobile-tabs .tab', { hasText: 'Query' }).last().click();
  const ed = page.locator('.cm-content:visible').last();
  await ed.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(sql);
  await page.getByRole('button', { name: '✓ Check answer' }).last().click();
}

test('first building end to end', async ({ page }, info) => {
  test.setTimeout(240_000);
  const isPhone = info.project.name === 'phone';
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());

  // Title → new game → character creator
  await page.goto('/');
  await page.locator('.press-start').click();
  await page.getByText('New game').first().click();
  await page.getByPlaceholder('e.g. Mary').fill('Mary');
  await page.getByText('Clock in').click();

  // Rhonda's intro dialogue
  await page.waitForSelector('.dialogue', { timeout: 60_000 });
  for (let i = 0; i < 30 && (await page.locator('.dialogue').count()); i++) {
    if (await page.locator('.dialogue-choice').count()) await page.locator('.dialogue-choice').first().click();
    else await page.locator('.dialogue-body').click();
    await page.waitForTimeout(150);
  }
  await expect(page.locator('.hud-objective')).toContainText('First Walk of the Lot');

  // Walk to the Lot Office door and go in
  await tp(page, 49.5 * 16, 24 * 16 + 14);
  await interact(page, isPhone, inScene(page, 'interior'));
  await page.waitForFunction(() => (window as any).__dq.scene() === 'interior', null, { timeout: 15_000 });

  // Terminal 1
  await tp(page, 48, 7.2 * 16 + 14);
  await interact(page, isPhone, async () => (await page.locator('.wb').count()) > 0);
  await page.waitForSelector('.wb', { state: 'attached', timeout: 90_000 });
  await answer(page, 'SELECT * FROM units LIMIT 10', isPhone);
  await expect(page.getByText('SOLVED!').first()).toBeVisible({ timeout: 20_000 });
  await page.getByText('✕ Exit').click();

  // Mini-boss (unlock the rest of the terminals via the dev flag to keep the test short)
  await page.evaluate(() => {
    const k = 'dq.slot.0';
    const s = JSON.parse(localStorage.getItem(k)!);
    s.flags.unlockAll = true;
    localStorage.setItem(k, JSON.stringify(s));
  });
  await page.goto('/?slot=0');
  await page.waitForFunction(() => (window as any).__dq?.player(), null, { timeout: 60_000 });
  await tp(page, 49.5 * 16, 24 * 16 + 14);
  await interact(page, isPhone, inScene(page, 'interior'));
  await page.waitForFunction(() => (window as any).__dq.scene() === 'interior', null, { timeout: 15_000 });
  await tp(page, 64, 3 * 16 + 16);
  await interact(page, isPhone, async () => (await page.locator('.boss-root').count()) > 0);
  await page.waitForSelector('.boss-root', { timeout: 90_000 });
  await page.getByText('⚔️ Fight!').click({ timeout: 15_000 });
  for (const sql of [
    "SELECT stock_no FROM units WHERE vin LIKE '%139065'",
    "SELECT stock_no, status FROM units WHERE rv_class = 'Class B' AND location_id = 1",
    'SELECT DISTINCT status FROM units',
  ]) {
    await answer(page, sql, isPhone);
    await page.waitForTimeout(1600);
  }
  await expect(page.getByText('VICTORY!')).toBeVisible({ timeout: 20_000 });
});
