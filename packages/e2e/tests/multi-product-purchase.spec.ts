// @def.boundary validation-layer-group
// @def.doc validation-layer-group

import { test, expect } from '@playwright/test';

const SHOP_URL = 'http://localhost:5220';
const INGEST_URL = 'http://localhost:3101';

test.describe('다중 상품 구매 시나리오 — 2개 상품 담기 후 결제 완료', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${SHOP_URL}?ingest=${INGEST_URL}`);
    await expect(page.locator('[data-testid="logo"]')).toBeVisible();
  });

  test('로그인 → 상품 2개 담기 → 장바구니 → 결제 → 완료', async ({ page }) => {
    page.on('dialog', (d) => d.accept());

    // 로그인
    await page.locator('[data-testid="login-submit"]').click();
    await expect(page.locator('[data-testid="nav-home"]')).toBeVisible();

    // 상품 목록
    await page.locator('[data-testid="nav-products"]').click();
    await expect(page.locator('[data-testid="product-1"]')).toBeVisible();

    // 상품 1 담기 (무선 이어버드 Pro — ₩89,000)
    await page.locator('[data-testid="product-1"]').click();
    await expect(page.locator('[data-testid="product-detail"]')).toBeVisible();
    await expect(page.locator('#detail-name')).toContainText('무선 이어버드');
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('#cart-count')).toContainText('1');

    // 상품 목록으로 돌아가기
    await page.locator('[data-testid="nav-products"]').click();
    await expect(page.locator('[data-testid="product-list"]')).toBeVisible();

    // 상품 2 담기 (스마트 워치 Ultra — ₩299,000)
    await page.locator('[data-testid="product-2"]').click();
    await expect(page.locator('[data-testid="product-detail"]')).toBeVisible();
    await expect(page.locator('#detail-name')).toContainText('스마트 워치');
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('#cart-count')).toContainText('2');

    // 장바구니
    await page.locator('[data-testid="nav-cart"]').click();
    await expect(page.locator('[data-testid="cart-item-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="cart-item-1"]')).toBeVisible();

    // 결제 진행
    await page.locator('[data-testid="checkout-btn"]').click();
    await expect(page.locator('[data-testid="pay-btn"]')).toBeVisible();

    // 결제 완료
    await page.locator('[data-testid="pay-btn"]').click();
    await expect(page.locator('[data-testid="order-complete"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="order-id"]')).toContainText('ORD-');

    // 장바구니 비워짐
    await expect(page.locator('#cart-count')).toContainText('0');
  });

  test('다중 상품 구매 시 이벤트가 충분히 발생한다', async ({ page }) => {
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

    // 상품 1 담기
    await page.locator('[data-testid="nav-products"]').click();
    await page.locator('[data-testid="product-1"]').click();
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('#cart-count')).toContainText('1');

    // 상품 2 담기
    await page.locator('[data-testid="nav-products"]').click();
    await page.locator('[data-testid="product-2"]').click();
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('#cart-count')).toContainText('2');

    // 장바구니 → 결제 → 완료
    await page.locator('[data-testid="nav-cart"]').click();
    await expect(page.locator('[data-testid="cart-item-0"]')).toBeVisible();
    await page.locator('[data-testid="checkout-btn"]').click();
    await expect(page.locator('[data-testid="pay-btn"]')).toBeVisible();
    await page.locator('[data-testid="pay-btn"]').click();
    await expect(page.locator('[data-testid="order-complete"]')).toBeVisible({ timeout: 5000 });

    // 네트워크 전송 완료 대기
    await page.waitForTimeout(2000);

    // 이벤트 카운트: login + home + products(×2) + detail(×2) + cart.add(×2)
    //   + api calls + cart page + checkout + payment + complete = 최소 10
    const evtText = await page.locator('#qa-events').textContent();
    const evtCount = parseInt(evtText?.replace('events: ', '') || '0');
    expect(evtCount).toBeGreaterThanOrEqual(10);

    // 핵심 이벤트 종류 검증
    const hasCartAdd = capturedEventKeys.filter((k) => k === 'cart.add').length >= 2;
    expect(hasCartAdd).toBe(true);

    const hasCheckout = capturedEventKeys.some((k) => k.startsWith('checkout.'));
    expect(hasCheckout).toBe(true);

    const hasPayment = capturedEventKeys.some((k) => k.startsWith('payment.'));
    expect(hasPayment).toBe(true);
  });

  test('서버에 이벤트 전송이 시도되고 status bar에 반영된다', async ({ page }) => {
    page.on('dialog', (d) => d.accept());

    // 로그인
    await page.locator('[data-testid="login-submit"]').click();
    await expect(page.locator('[data-testid="nav-home"]')).toBeVisible();

    // status bar가 ready 상태를 벗어남 (이벤트 전송 시도)
    await expect(page.locator('#qa-status')).not.toContainText('ready');

    // 상품 2개 담기 → 결제
    await page.locator('[data-testid="nav-products"]').click();
    await expect(page.locator('[data-testid="product-list"]')).toBeVisible();

    await page.locator('[data-testid="product-1"]').click();
    await expect(page.locator('[data-testid="product-detail"]')).toBeVisible();
    await page.locator('[data-testid="add-to-cart-btn"]').click();

    await page.locator('[data-testid="nav-products"]').click();
    await expect(page.locator('[data-testid="product-list"]')).toBeVisible();

    await page.locator('[data-testid="product-2"]').click();
    await expect(page.locator('[data-testid="product-detail"]')).toBeVisible();
    await page.locator('[data-testid="add-to-cart-btn"]').click();

    await page.locator('[data-testid="nav-cart"]').click();
    await expect(page.locator('[data-testid="cart-item-0"]')).toBeVisible();

    await page.locator('[data-testid="checkout-btn"]').click();
    await page.locator('[data-testid="pay-btn"]').click();
    await expect(page.locator('[data-testid="order-complete"]')).toBeVisible({ timeout: 5000 });

    // status bar에 최종 이벤트 전송 상태 반영
    await page.waitForTimeout(2000);
    const statusText = await page.locator('#qa-status').textContent();
    // status bar에 이벤트 키 또는 상태코드가 표시됨
    expect(statusText).toBeTruthy();
    expect(statusText).not.toContain('initializing');
  });
});
