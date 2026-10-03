import { test, expect } from '@playwright/test';

test('mountVisBug attaches <vis-bug> and exposes controller', async ({ page }) => {
  await page.goto('/packages/visbug-bridge/test/e2e/fixtures/index.html');
  // wait for module to execute
  await page.waitForFunction(() => Boolean((window as any).__ctrl), null, { timeout: 10000 });

  const has = await page.evaluate(() => Boolean(document.querySelector('vis-bug')));
  expect(has).toBe(true);

  const ctrlOk = await page.evaluate(
    () => typeof (window as any).__ctrl?.getHistory === 'function',
  );
  expect(ctrlOk).toBe(true);
});

test('http-server + bridge-loader loaded without page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/packages/visbug-bridge/test/e2e/fixtures/index.html');
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});

test('mount forwards bufferSize to the live VisBug edit-log ring buffer', async ({ page }) => {
  await page.goto('/packages/visbug-bridge/test/e2e/fixtures/buffer.html');
  await page.waitForFunction(() => Boolean((window as any).__ctrl));
  const target = page.locator('[data-test="target"]');

  await page.keyboard.press('p');
  await target.click();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(100);

  const historyLength = await page.evaluate(() => (window as any).__ctrl.getHistory().length);
  expect(historyLength).toBe(2);
});
