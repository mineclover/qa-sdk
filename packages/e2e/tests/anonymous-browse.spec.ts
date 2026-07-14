// @def.boundary validation-layer-group
// @def.doc validation-layer-group

import { test, expect } from '@playwright/test';

const SHOP_URL = 'http://localhost:5220';
const INGEST_URL = 'http://localhost:3101';

test.describe('익명 브라우징 시나리오 — 로그인 후 상품만 탐색', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${SHOP_URL}?ingest=${INGEST_URL}`);
    await expect(page.locator('[data-testid="logo"]')).toBeVisible();
  });

  test('게스트 로그인 → 상품 3개 탐색 → 장바구니/결제 없음', async ({ page }) => {
    page.on('dialog', (d) => d.accept());

    // 로그인
    await page.locator('[data-testid="login-submit"]').click();
    await expect(page.locator('[data-testid="nav-home"]')).toBeVisible();

    // 상품 목록 이동
    await page.locator('[data-testid="nav-products"]').click();
    await expect(page.locator('[data-testid="product-list"]')).toBeVisible();

    // 상품 1 상세 보기
    await page.locator('[data-testid="product-1"]').click();
    await expect(page.locator('[data-testid="product-detail"]')).toBeVisible();
    await expect(page.locator('#detail-name')).toContainText('무선 이어버드');

    // 상품 목록으로 돌아가기
    await page.locator('[data-testid="nav-products"]').click();
    await expect(page.locator('[data-testid="product-list"]')).toBeVisible();

    // 상품 3 상세 보기
    await page.locator('[data-testid="product-3"]').click();
    await expect(page.locator('[data-testid="product-detail"]')).toBeVisible();
    await expect(page.locator('#detail-name')).toContainText('알루미늄 노트북 스탠드');

    // 상품 목록으로 돌아가기
    await page.locator('[data-testid="nav-products"]').click();
    await expect(page.locator('[data-testid="product-list"]')).toBeVisible();

    // 상품 5 상세 보기
    await page.locator('[data-testid="product-5"]').click();
    await expect(page.locator('[data-testid="product-detail"]')).toBeVisible();
    await expect(page.locator('#detail-name')).toContainText('USB-C 7-in-1 허브');

    // 장바구니는 비어 있어야 함
    await expect(page.locator('#cart-count')).toContainText('0');

    // 이벤트 카운트 확인 — 로그인 + home + products(×3회) + detail(×3회) + api 호출들
    // 최소 4개 이벤트 (login, home, product_list, product_detail)
    await page.waitForTimeout(1000);
    const evtText = await page.locator('#qa-events').textContent();
    const evtCount = parseInt(evtText?.replace('events: ', '') || '0');
    expect(evtCount).toBeGreaterThanOrEqual(4);
  });

  test('탐색만 하면 cart/checkout 이벤트가 발생하지 않는다', async ({ page }) => {
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

    // 로그인 → 상품 탐색
    await page.locator('[data-testid="login-submit"]').click();
    await expect(page.locator('[data-testid="nav-home"]')).toBeVisible();
    await page.locator('[data-testid="nav-products"]').click();
    await expect(page.locator('[data-testid="product-1"]')).toBeVisible();
    await page.locator('[data-testid="product-2"]').click();
    await expect(page.locator('[data-testid="product-detail"]')).toBeVisible();

    await page.waitForTimeout(1500);

    // 이벤트가 서버에 전송됨
    expect(capturedEventKeys.length).toBeGreaterThanOrEqual(1);

    // cart/checkout/payment 이벤트는 없어야 함
    const hasCartEvent = capturedEventKeys.some((k) => k.startsWith('cart.'));
    const hasCheckoutEvent = capturedEventKeys.some((k) => k.startsWith('checkout.'));
    const hasPaymentEvent = capturedEventKeys.some((k) => k.startsWith('payment.'));
    expect(hasCartEvent).toBe(false);
    expect(hasCheckoutEvent).toBe(false);
    expect(hasPaymentEvent).toBe(false);
  });
});
