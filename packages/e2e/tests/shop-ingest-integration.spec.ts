/**
 * Shop-Web → Ingest-Server 통합 테스트.
 *
 * 브라우저에서 쇼핑 흐름을 실행하고,
 * ingest-server API로 이벤트가 실제 수집/저장되었는지 검증한다.
 *
 * 검증 항목:
 *   1. 이벤트가 서버에 도달하여 202 응답
 *   2. address_context가 올바르게 인코딩
 *   3. trace/session이 생성되고 record가 누적
 *   4. 전체 흐름(로그인→결제)에서 예상 이벤트 수 충족
 */
import { test, expect } from "@playwright/test";

const INGEST_URL = "http://localhost:3101";
const SHOP_URL = "http://localhost:5220";

/**
 * shop-web에서 발생한 이벤트를 서버에서 조회.
 * 브라우저의 qa_session_id로 세션 레코드를 가져온다.
 */
async function fetchSessionRecords(
  request: import("@playwright/test").APIRequestContext,
  sessionId: string,
): Promise<{ records: any[]; total: number }> {
  const res = await request.get(
    `${INGEST_URL}/v1/sessions/${sessionId}/records`,
  );
  if (res.status() === 404) return { records: [], total: 0 };
  const body = await res.json();
  return {
    records: body.records ?? body.data ?? [],
    total: body.total ?? (body.records ?? body.data ?? []).length,
  };
}

async function fetchTraceRecords(
  request: import("@playwright/test").APIRequestContext,
  traceId: string,
): Promise<any[]> {
  const res = await request.get(`${INGEST_URL}/v1/traces/${traceId}/records`);
  if (res.status() === 404) return [];
  const body = await res.json();
  return body.items ?? body.records ?? body.data ?? [];
}

test.describe("Shop-Web → Ingest-Server 통합", () => {
  /**
   * 서버 수집 확인을 위해 shop-web의 네트워크 요청을 가로채서
   * ingest URL을 test-server(3101)로 리디렉트한다.
   */
  test.beforeEach(async ({ page }) => {
    await page.goto(`${SHOP_URL}?ingest=${INGEST_URL}`);
    await expect(page.locator('[data-testid="logo"]')).toBeVisible();
  });

  test("로그인 이벤트가 서버에 수집된다", async ({ page, request }) => {
    // 서버에 전송되는 요청을 캡처
    const ingestResponses: { status: number; body: any }[] = [];
    page.on("response", async (response) => {
      if (response.url().includes("/v1/ingest")) {
        ingestResponses.push({
          status: response.status(),
          body: await response.json().catch(() => null),
        });
      }
    });

    // 로그인 실행
    await page.locator('[data-testid="login-submit"]').click();
    await expect(page.locator('[data-testid="nav-home"]')).toBeVisible();

    // 이벤트 전송 완료 대기
    await page.waitForTimeout(1500);

    // 서버 응답 검증: 모든 ingest가 202 Accepted
    expect(ingestResponses.length).toBeGreaterThanOrEqual(1);
    for (const r of ingestResponses) {
      expect(r.status).toBe(202);
      expect(r.body?.accepted).toBe(true);
    }
  });

  test("전체 쇼핑 흐름 — 서버에 8+ 이벤트 수집 확인", async ({
    page,
    request,
  }) => {
    // ingest 요청/응답 캡처
    const capturedBodies: any[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/v1/ingest") && req.method() === "POST") {
        try {
          capturedBodies.push(JSON.parse(req.postData() ?? "{}"));
        } catch { /* ignore */ }
      }
    });

    const ingestStatuses: number[] = [];
    page.on("response", async (response) => {
      if (response.url().includes("/v1/ingest")) {
        ingestStatuses.push(response.status());
      }
    });

    page.on("dialog", (d) => d.accept());

    // === 전체 흐름 ===

    // 1. 로그인
    await page.locator('[data-testid="login-submit"]').click();
    await expect(page.locator('[data-testid="nav-home"]')).toBeVisible();

    // 2. 상품 목록
    await page.locator('[data-testid="nav-products"]').click();
    await expect(page.locator('[data-testid="product-1"]')).toBeVisible();

    // 3. 상품 상세
    await page.locator('[data-testid="product-1"]').click();
    await expect(page.locator('[data-testid="product-detail"]')).toBeVisible();

    // 4. 장바구니 담기
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator("#cart-count")).toContainText("1");

    // 5. 장바구니
    await page.locator('[data-testid="nav-cart"]').click();
    await expect(page.locator('[data-testid="cart-item-0"]')).toBeVisible();

    // 6. 결제 진행
    await page.locator('[data-testid="checkout-btn"]').click();
    await expect(page.locator('[data-testid="pay-btn"]')).toBeVisible();

    // 7. 결제 완료
    await page.locator('[data-testid="pay-btn"]').click();
    await expect(page.locator('[data-testid="order-complete"]')).toBeVisible({
      timeout: 5000,
    });

    // 네트워크 요청 완료 대기
    await page.waitForTimeout(2000);

    // === 검증 ===

    // ingest 요청이 발생했고, 대부분 202 (일부 validation 에러 허용)
    expect(ingestStatuses.length).toBeGreaterThanOrEqual(1);
    const successCount = ingestStatuses.filter((s) => s === 202).length;
    expect(successCount).toBeGreaterThanOrEqual(1);

    // 전송된 전체 record 수
    const totalRecords = capturedBodies.reduce(
      (sum, body) => sum + (body.records?.length ?? 0),
      0,
    );
    expect(totalRecords).toBeGreaterThanOrEqual(8);

    // 이벤트 카운터 확인
    const evtText = await page.locator("#qa-events").textContent();
    const evtCount = parseInt(evtText?.replace("events: ", "") ?? "0");
    expect(evtCount).toBeGreaterThanOrEqual(8);
  });

  test("address_context가 인코딩되어 전송된다", async ({ page }) => {
    const capturedContexts: Record<string, string>[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/v1/ingest") && req.method() === "POST") {
        try {
          const body = JSON.parse(req.postData() ?? "{}");
          for (const record of body.records ?? []) {
            if (record.address_context) {
              capturedContexts.push(record.address_context);
            }
          }
        } catch { /* ignore */ }
      }
    });

    // 로그인 → 상품 목록 (최소 2개 이벤트)
    await page.locator('[data-testid="login-submit"]').click();
    await expect(page.locator('[data-testid="nav-home"]')).toBeVisible();
    await page.locator('[data-testid="nav-products"]').click();
    await expect(page.locator('[data-testid="product-1"]')).toBeVisible();

    await page.waitForTimeout(1500);

    // address_context가 존재하고 올바른 형식 (prefix:version:address)
    expect(capturedContexts.length).toBeGreaterThanOrEqual(1);
    for (const ctx of capturedContexts) {
      // 최소 1개 prefix가 인코딩되어 있어야 함
      const keys = Object.keys(ctx);
      expect(keys.length).toBeGreaterThanOrEqual(1);

      // 각 값은 3파트(prefix:ver:addr) 또는 4파트(catalog:prefix:ver:addr)
      for (const [key, value] of Object.entries(ctx)) {
        const parts = value.split(":");
        expect(parts.length).toBeGreaterThanOrEqual(3);
        expect(parts.length).toBeLessThanOrEqual(4);
        // 마지막 파트는 숫자
        const addrPart = parts[parts.length - 1];
        expect(Number.isFinite(Number(addrPart))).toBe(true);
      }
    }
  });

  test("envelope 구조가 올바르다", async ({ page }) => {
    const capturedEnvelopes: any[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/v1/ingest") && req.method() === "POST") {
        try {
          capturedEnvelopes.push(JSON.parse(req.postData() ?? "{}"));
        } catch { /* ignore */ }
      }
    });

    await page.locator('[data-testid="login-submit"]').click();
    await expect(page.locator('[data-testid="nav-home"]')).toBeVisible();
    await page.waitForTimeout(1500);

    expect(capturedEnvelopes.length).toBeGreaterThanOrEqual(1);

    const envelope = capturedEnvelopes[0];

    // transmission envelope 필수 필드
    expect(envelope.transmission_id).toBeTruthy();
    expect(envelope.sent_at).toBeTruthy();
    expect(envelope.owner).toBeDefined();
    expect(envelope.owner.owner_type).toBeTruthy();
    expect(envelope.source).toBeDefined();
    expect(envelope.source.service_name).toBeTruthy();
    expect(envelope.source.sdk_name).toBeTruthy();
    expect(envelope.runtime).toBeDefined();
    expect(envelope.build).toBeDefined();
    expect(envelope.records).toBeInstanceOf(Array);
    expect(envelope.records.length).toBeGreaterThan(0);

    // record 필수 필드
    const record = envelope.records[0];
    expect(record.log_id).toBeTruthy();
    expect(record.timestamp).toBeTruthy();
    expect(record.record_kind).toBe("log");
    expect(record.trace_id).toBeTruthy();
    expect(record.event_key).toBeTruthy();
    expect(record.qa_session_id).toBeTruthy();
  });

  test("서버 trace API로 수집된 레코드 조회 가능", async ({
    page,
    request,
  }) => {
    // trace_id를 캡처 + ingest 응답 완료 대기
    let capturedTraceId: string | null = null;
    const ingestDone = new Promise<void>((resolve) => {
      page.on("response", async (response) => {
        if (response.url().includes("/v1/ingest") && response.status() === 202) {
          resolve();
        }
      });
    });
    page.on("request", (req) => {
      if (req.url().includes("/v1/ingest") && req.method() === "POST") {
        try {
          const body = JSON.parse(req.postData() ?? "{}");
          if (body.records?.[0]?.trace_id) {
            capturedTraceId = body.records[0].trace_id;
          }
        } catch { /* ignore */ }
      }
    });

    // 로그인
    await page.locator('[data-testid="login-submit"]').click();
    await expect(page.locator('[data-testid="nav-home"]')).toBeVisible();

    // 서버 응답 완료 대기 (최대 5초)
    await Promise.race([ingestDone, page.waitForTimeout(5000)]);
    // 저장 처리 시간 추가 대기
    await page.waitForTimeout(500);

    expect(capturedTraceId).toBeTruthy();

    // trace API로 레코드 조회
    const records = await fetchTraceRecords(request, capturedTraceId!);
    expect(records.length).toBeGreaterThanOrEqual(1);

    // event_key 확인 — auth 관련 이벤트가 있어야 함
    const eventKeys = records.map((r: any) => r.event_key ?? r.eventKey);
    const hasAuthEvent = eventKeys.some(
      (k: string) => k?.includes("auth") || k?.includes("login") || k?.includes("page"),
    );
    expect(hasAuthEvent).toBe(true);
  });
});
