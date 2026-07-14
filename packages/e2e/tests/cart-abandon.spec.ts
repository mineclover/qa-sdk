// @def.boundary validation-layer-group
// @def.doc validation-layer-group

import { test, expect } from '@playwright/test';

const SHOP_URL = 'http://localhost:5220';
const INGEST_URL = 'http://localhost:3101';

test.describe('장바구니 이탈 시나리오 — 담기 후 결제하지 않음', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${SHOP_URL}?ingest=${INGEST_URL}`);
    await expect(page.locator('[data-testid="logo"]')).toBeVisible();
  });

  test('로그인 → 상품 담기 → 상품 목록으로 이탈 → 결제 없음', async ({ page }) => {
    page.on('dialog', (d) => d.accept());

    const capturedEventKeys: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/v1/ingest') && req.method() === 'POST') {
        try {
          const body = JSON.parse(req.postData() ?? '{}');
          for (const record of body.records ?? []) {
            if (record.event_key) capturedEventKeys.push(record.event_key);
          }
        } catch {
          /* ignore */
        }
      }
    });

    // 로그인
    await page.locator('[data-testid="login-submit"]').click();
    await expect(page.locator('[data-testid="nav-home"]')).toBeVisible();

    // 상품 목록
    await page.locator('[data-testid="nav-products"]').click();
    await expect(page.locator('[data-testid="product-1"]')).toBeVisible();

    // 상품 상세
    await page.locator('[data-testid="product-1"]').click();
    await expect(page.locator('[data-testid="product-detail"]')).toBeVisible();

    // 장바구니에 담기
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('#cart-count')).toContainText('1');

    // 상품 목록으로 이탈 (결제하지 않음)
    await page.locator('[data-testid="nav-products"]').click();
    await expect(page.locator('[data-testid="product-list"]')).toBeVisible();

    // 추가 탐색
    await page.locator('[data-testid="product-4"]').click();
    await expect(page.locator('[data-testid="product-detail"]')).toBeVisible();
    await expect(page.locator('#detail-name')).toContainText('기계식 키보드');

    await page.waitForTimeout(1500);

    // 장바구니에 상품이 남아있음
    await expect(page.locator('#cart-count')).toContainText('1');

    // cart.add 이벤트는 발생했어야 함
    const hasCartAdd = capturedEventKeys.some((k) => k === 'cart.add');
    expect(hasCartAdd).toBe(true);

    // checkout/payment 이벤트는 없어야 함
    const hasCheckoutEvent = capturedEventKeys.some((k) => k.startsWith('checkout.'));
    const hasPaymentEvent = capturedEventKeys.some((k) => k.startsWith('payment.'));
    expect(hasCheckoutEvent).toBe(false);
    expect(hasPaymentEvent).toBe(false);
  });

  test('장바구니 이탈 후에도 장바구니 상태가 유지된다', async ({ page }) => {
    page.on('dialog', (d) => d.accept());

    // 로그인
    await page.locator('[data-testid="login-submit"]').click();
    await expect(page.locator('[data-testid="nav-home"]')).toBeVisible();

    // 상품 목록 → 상세 → 담기
    await page.locator('[data-testid="nav-products"]').click();
    await page.locator('[data-testid="product-2"]').click();
    await expect(page.locator('[data-testid="product-detail"]')).toBeVisible();
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('#cart-count')).toContainText('1');

    // 홈으로 이탈
    await page.locator('[data-testid="nav-home"]').click();

    // 다시 상품 목록
    await page.locator('[data-testid="nav-products"]').click();

    // 장바구니 카운트 유지 확인
    await expect(page.locator('#cart-count')).toContainText('1');

    // 장바구니 페이지에서 아이템 확인
    await page.locator('[data-testid="nav-cart"]').click();
    await expect(page.locator('[data-testid="cart-item-0"]')).toBeVisible();
  });
});
