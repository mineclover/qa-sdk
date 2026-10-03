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

  await page.locator('#btn-reset-layout').click();
  await expect(page.locator('#stat-total')).toHaveText('total 0');
  await expect.poll(() => target.getAttribute('style')).toBeNull();
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
