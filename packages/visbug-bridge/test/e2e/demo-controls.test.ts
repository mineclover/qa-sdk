import { test, expect } from '@playwright/test';

test('demo controls remain clickable while VisBug is capturing page clicks', async ({ page }) => {
  await page.goto('/packages/visbug-bridge/demo/edit-log-preview.html');
  await page.waitForFunction(() => Boolean(document.querySelector('vis-bug')));

  const target = page.locator('[data-section="padding"] [data-demo-target]');
  await target.scrollIntoViewIfNeeded();
  await page.keyboard.press('p');
  await target.click();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#stat-total')).not.toHaveText('total 0', { timeout: 5000 });

  const beforeReset = await target.getAttribute('style');
  expect(beforeReset).toContain('padding');
  await page.evaluate(() => {
    const image = document.querySelector<HTMLImageElement>('.demo-img');
    const text = document.querySelector('[data-section="text"] [data-demo-target]');
    const row = document.querySelector('.demo-move-row');
    if (image) image.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E';
    if (text) text.textContent = 'changed by the reset regression';
    if (row) row.append(row.firstElementChild!);
  });

  await page.locator('#btn-reset-layout').click();
  await expect(page.locator('#stat-total')).toHaveText('total 0');
  await expect.poll(() => target.getAttribute('style')).toBeNull();
  await expect(page.locator('[data-section="text"] [data-demo-target]')).toHaveText('시급 ₩100 / 시간');
  await expect(page.locator('.demo-move-row > .n1')).toHaveCount(1);
  await expect(page.locator('.demo-move-row > .n1')).toHaveText('1');
  await expect(page.locator('.demo-img')).toHaveAttribute('src', /7c9cff/);
});

test('clear and merge controls operate on a real edit-log stream', async ({ page }) => {
  await page.goto('/packages/visbug-bridge/demo/edit-log-preview.html');
  await page.waitForFunction(() => Boolean(document.querySelector('vis-bug')));
  const target = page.locator('[data-section="margin"] [data-demo-target]');
  await target.scrollIntoViewIfNeeded();
  await page.keyboard.press('m');
  await target.click();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#stat-total')).not.toHaveText('total 0', { timeout: 5000 });

  await page.locator('#btn-merge').click();
  await expect(page.locator('#stat-total')).not.toHaveText('total 0');
  await page.locator('#btn-clear').click();
  await expect(page.locator('#stat-total')).toHaveText('total 0');
  await expect(page.locator('.demo-log-empty')).toBeVisible();
});
