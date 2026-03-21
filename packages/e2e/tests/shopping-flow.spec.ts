import { test, expect } from "@playwright/test";

const SHOP_URL = "http://localhost:5220";
const INGEST_URL = "http://localhost:3100";

test.describe("쇼핑 전체 흐름 E2E — address_context 검증", () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${SHOP_URL}?ingest=${INGEST_URL}`);
    await expect(page.locator('[data-testid="logo"]')).toBeVisible();
  });

  test("1. 로그인 → 인증 이벤트 발생", async ({ page }) => {
    await page.locator('[data-testid="login-submit"]').click();
    await expect(page.locator('[data-testid="nav-home"]')).toBeVisible();
    // status bar에 이벤트 전송 확인 (sending 또는 status code)
    await expect(page.locator("#qa-status")).not.toContainText("ready");
  });

  test("2. 상품 목록 → API 호출 이벤트", async ({ page }) => {
    await page.locator('[data-testid="login-submit"]').click();
    await page.locator('[data-testid="nav-products"]').click();
    await expect(page.locator('[data-testid="product-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-1"]')).toBeVisible();
  });

  test("3. 상품 상세 → 클릭 이벤트", async ({ page }) => {
    await page.locator('[data-testid="login-submit"]').click();
    await page.locator('[data-testid="nav-products"]').click();
    await page.locator('[data-testid="product-1"]').click();
    await expect(page.locator('[data-testid="product-detail"]')).toBeVisible();
    await expect(page.locator("#detail-name")).toContainText("무선 이어버드");
  });

  test("4. 장바구니 담기 → cart_event 발생", async ({ page }) => {
    page.on("dialog", d => d.accept());
    await page.locator('[data-testid="login-submit"]').click();
    await page.locator('[data-testid="nav-products"]').click();
    await page.locator('[data-testid="product-1"]').click();
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    // cart.add 이벤트 발생 확인
    await expect(page.locator("#qa-status")).not.toContainText("ready");
    await expect(page.locator("#cart-count")).toContainText("1");
  });

  test("5. 전체 흐름 — 로그인 → 결제 → 완료", async ({ page }) => {
    page.on("dialog", d => d.accept());

    // 로그인
    await page.locator('[data-testid="login-submit"]').click();
    await expect(page.locator('[data-testid="nav-home"]')).toBeVisible();

    // 상품 목록
    await page.locator('[data-testid="nav-products"]').click();
    await expect(page.locator('[data-testid="product-1"]')).toBeVisible();

    // 상품 상세
    await page.locator('[data-testid="product-1"]').click();
    await expect(page.locator("#detail-name")).toContainText("무선 이어버드");

    // 장바구니 담기
    await page.locator('[data-testid="add-to-cart-btn"]').click();

    // 장바구니
    await page.locator('[data-testid="nav-cart"]').click();
    await expect(page.locator('[data-testid="cart-item-0"]')).toBeVisible();

    // 결제
    await page.locator('[data-testid="checkout-btn"]').click();
    await expect(page.locator('[data-testid="pay-btn"]')).toBeVisible();

    // 결제 완료
    await page.locator('[data-testid="pay-btn"]').click();
    await expect(page.locator('[data-testid="order-complete"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="order-id"]')).toContainText("ORD-");

    // 마이페이지
    await page.locator('[data-testid="go-mypage-btn"]').click();
    await expect(page.locator('[data-testid="order-history"]')).toBeVisible();

    // 이벤트 카운트 확인 — 최소 8개 이벤트 발생
    const evtText = await page.locator("#qa-events").textContent();
    const evtCount = parseInt(evtText?.replace("events: ", "") || "0");
    expect(evtCount).toBeGreaterThanOrEqual(8);
  });

  test("6. 로그아웃 → auth_event(logout)", async ({ page }) => {
    await page.locator('[data-testid="login-submit"]').click();
    await page.locator('[data-testid="logout-btn"]').click();
    // logout 이벤트 확인
    await expect(page.locator("#qa-status")).not.toContainText("ready");
    await expect(page.locator('[data-testid="login-submit"]')).toBeVisible();
  });
});
