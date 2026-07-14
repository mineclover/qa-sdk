---
name: e2e-test
description: "Playwright E2E 테스트 작성/실행/디버깅. 시나리오 문서(^preconditions, ^steps, ^assertions)를 Playwright 테스트로 변환하고, 품질 게이트와 연동한다. 트리거: /e2e-test, 'E2E 테스트 작성', 'e2e 실행', '시나리오 테스트', 'playwright', '브라우저 테스트', '통합 테스트 작성'."
---

# E2E 테스트 스킬

Playwright 기반 E2E 테스트를 시나리오 문서에서 도출하고, 작성/실행/디버깅한다.

## 사용 시점

- 시나리오 스펙 문서(^steps, ^assertions 마커)를 E2E 테스트로 변환할 때
- 새로운 사용자 흐름에 대한 브라우저 테스트를 작성할 때
- 기존 E2E 테스트를 수정하거나 디버깅할 때
- 품질 게이트(GateKind: `e2e-test`)를 통과시켜야 할 때

## 인프라 개요

| 항목 | 값 |
|------|-----|
| 패키지 | `packages/e2e/` (`@qa-sdk/e2e`) |
| 프레임워크 | Playwright (`@playwright/test`) |
| 설정 | `packages/e2e/playwright.config.ts` |
| 테스트 디렉토리 | `packages/e2e/tests/` |
| 헬퍼 | `packages/e2e/tests/helpers.ts` |
| 브라우저 | chromium 단일 |
| 병렬 실행 | `fullyParallel: false` (WebSocket 간섭 방지) |
| 테스트 타임아웃 | 40초 |

### 서버 구성 (자동 기동)

Playwright가 테스트 실행 전에 5개 서버를 자동 기동한다.

| 서버 | URL | 기동 명령 | 타임아웃 |
|------|-----|----------|---------|
| ingest-server (인메모리) | `http://localhost:3101` | `corepack pnpm --filter @qa-sdk/ingest-server exec tsx src/test-server.ts` | 15초 |
| viz-web | `http://localhost:5210` | `corepack pnpm --filter @qa-sdk/viz-web exec vite --port 5210` | 30초 |
| roleplay-web | `http://localhost:5211` | `corepack pnpm --filter @qa-sdk/roleplay-web exec vite --port 5211` | 30초 |
| shop-web | `http://localhost:5220` | `corepack pnpm --filter @qa-sdk/shop-web start` | 15초 |
| registry-ui | `http://localhost:5230` | CLI build + conflicts report + `corepack pnpm --filter @qa-sdk/registry-ui exec vite --port 5230` | 40초 |

- 로컬에서는 `reuseExistingServer: true` (이미 떠 있으면 재사용)
- CI에서는 매번 새로 기동

## 실행 방법

```bash
# 전체 E2E 실행
corepack pnpm --filter @qa-sdk/e2e test:e2e

# UI 모드 (디버깅에 유용)
corepack pnpm --filter @qa-sdk/e2e test:ui

# headed 모드 (브라우저 화면 표시)
corepack pnpm --filter @qa-sdk/e2e test:headed

# 특정 테스트 파일만
corepack pnpm --filter @qa-sdk/e2e test:e2e -- tests/shopping-flow.spec.ts

# 특정 테스트 이름으로 필터
corepack pnpm --filter @qa-sdk/e2e test:e2e -- --grep "로그인"

# 브라우저 설치 (최초 1회)
corepack pnpm --filter @qa-sdk/e2e install:browsers
```

## 시나리오 마커 → E2E 변환 규칙

시나리오 문서의 6개 마커(`definition-catalog/src/taxonomy.ts` SCENARIO_MARKERS)가 테스트 구조로 매핑된다.

| 마커 | 필수 | E2E 매핑 | 설명 |
|------|------|---------|------|
| `^actor` | 아니오 | `test.describe` 컨텍스트 | 행위자 정의 — describe 이름에 반영 |
| `^preconditions` | **예** | `test.beforeEach` / fixture 셋업 | 사전 상태: 인증, 데이터, 서버 설정 |
| `^steps` | **예** | 테스트 본문의 페이지 액션 | `page.goto`, `click`, `fill`, `waitFor` |
| `^assertions` | **예** | `expect()` 단언 | 각 스텝 또는 최종 상태 검증 |
| `^variants` | 아니오 | 추가 `test()` 케이스 | 에러/엣지 케이스 별도 테스트 |
| `^update-trigger` | 아니오 | 주석으로 기록 | 테스트 유지보수 트리거 |

### 변환 절차

1. 시나리오 문서에서 `^preconditions`, `^steps`, `^assertions` 섹션을 읽는다
2. `^actor`가 있으면 `test.describe` 이름에 행위자를 포함한다
3. `^preconditions`를 `beforeEach`로 변환한다
4. `^steps`의 각 스텝을 Playwright 액션으로 변환한다
5. `^assertions`를 `expect()` 단언으로 변환한다
6. `^variants`가 있으면 별도 `test()` 케이스로 추가한다

### 변환 예시

시나리오 문서:

```markdown
## 행위자 ^actor
로그인된 쇼핑 사용자

## 사전조건 ^preconditions
- shop-web이 기동되어 있다
- ingest-server가 인메모리 모드로 동작한다
- 상품 카탈로그에 5개 이상의 상품이 있다

## 스텝 ^steps
1. 로그인 폼에서 로그인 버튼을 클릭한다
2. 상품 목록 페이지로 이동한다
3. 첫 번째 상품을 클릭하여 상세 페이지로 진입한다
4. "장바구니 담기" 버튼을 클릭한다
5. 장바구니 페이지로 이동한다

## 검증 ^assertions
- 2단계 후: 상품 목록이 표시된다
- 4단계 후: 장바구니 카운트가 1이다
- 5단계 후: 장바구니에 담은 상품이 보인다

## 변형 ^variants
- 이미 장바구니에 같은 상품이 있을 때 중복 담기
- 품절 상품 담기 시도
```

변환 결과:

```typescript
import { test, expect } from "@playwright/test";

const SHOP_URL = "http://localhost:5220";
const INGEST_URL = "http://localhost:3101";

test.describe("로그인된 쇼핑 사용자 — 장바구니 담기", () => {
  // ^preconditions → beforeEach
  test.beforeEach(async ({ page }) => {
    await page.goto(`${SHOP_URL}?ingest=${INGEST_URL}`);
    await expect(page.locator('[data-testid="logo"]')).toBeVisible();
  });

  // ^steps + ^assertions → 메인 테스트
  test("상품 탐색 → 장바구니 담기 흐름", async ({ page }) => {
    page.on("dialog", d => d.accept());

    // 스텝 1: 로그인
    await page.locator('[data-testid="login-submit"]').click();
    await expect(page.locator('[data-testid="nav-home"]')).toBeVisible();

    // 스텝 2: 상품 목록
    await page.locator('[data-testid="nav-products"]').click();
    await expect(page.locator('[data-testid="product-list"]')).toBeVisible();

    // 스텝 3: 상품 상세
    await page.locator('[data-testid="product-1"]').click();
    await expect(page.locator('[data-testid="product-detail"]')).toBeVisible();

    // 스텝 4: 장바구니 담기
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator("#cart-count")).toContainText("1");

    // 스텝 5: 장바구니 확인
    await page.locator('[data-testid="nav-cart"]').click();
    await expect(page.locator('[data-testid="cart-item-0"]')).toBeVisible();
  });

  // ^variants → 추가 테스트
  test("품절 상품 담기 시도", async ({ page }) => {
    // ...
  });
});
```

## 테스트 파일 작성 패턴

### 패턴 1: shop-web 사용자 흐름 (UI 상호작용)

shop-web(`http://localhost:5220`)에서 실제 브라우저 클릭으로 사용자 흐름을 검증한다.

```typescript
import { test, expect } from "@playwright/test";

const SHOP_URL = "http://localhost:5220";
const INGEST_URL = "http://localhost:3101";

test.describe("시나리오명", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${SHOP_URL}?ingest=${INGEST_URL}`);
    await expect(page.locator('[data-testid="logo"]')).toBeVisible();
  });

  test("테스트명", async ({ page }) => {
    page.on("dialog", d => d.accept()); // alert 자동 수락

    // UI 클릭 → 상태 변화 검증
    await page.locator('[data-testid="login-submit"]').click();
    await expect(page.locator('[data-testid="nav-home"]')).toBeVisible();
  });
});
```

핵심 요소:
- `?ingest=` 쿼리 파라미터로 ingest 서버 주소를 주입한다
- `page.on("dialog", d => d.accept())` — shop-web의 alert 팝업을 자동 수락한다
- `data-testid` 셀렉터를 우선 사용한다

### 패턴 2: viz-web 이벤트 파이프라인 (API + WS)

viz-web(`http://localhost:5210`)에서 시나리오 등록 → 이벤트 주입 → 실시간 반영을 검증한다. `helpers.ts`의 유틸을 사용한다.

```typescript
import { test, expect } from "@playwright/test";
import {
  registerScenario,
  ingestEvents,
  selectScenarioAndWaitForWs,
  INGEST_URL,
} from "./helpers.js";

const SCENARIO_ID = "e2e-my-scenario";

test.beforeEach(async ({ request }) => {
  await registerScenario(request, SCENARIO_ID, [
    { id: "s1", kind: "sequence", required: true, event_key: "click" },
    { id: "s2", kind: "sequence", required: true, event_key: "form_submit" },
  ]);
});

test("이벤트 주입 후 viz에 표시", async ({ page, request }) => {
  const sessionId = await selectScenarioAndWaitForWs(page, SCENARIO_ID);
  const traceId = `trc_e2e_${Date.now()}`;

  await ingestEvents(request, {
    sessionId,
    traceId,
    eventKeys: ["click"],
  });

  await expect(page.locator(".event-log-entry")).toHaveCount(1, {
    timeout: 10_000,
  });
});
```

### 패턴 3: 네트워크 이벤트 캡처 (발생/미발생 검증)

`page.on("request")` 리스너로 ingest 서버로 전송되는 이벤트를 가로채서 검증한다.

```typescript
test("특정 이벤트가 발생하지 않는다", async ({ page }) => {
  const capturedEventKeys: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/v1/ingest") && req.method() === "POST") {
      try {
        const body = JSON.parse(req.postData() ?? "{}");
        for (const record of body.records ?? []) {
          if (record.event_key) capturedEventKeys.push(record.event_key);
        }
      } catch { /* ignore */ }
    }
  });

  // ... 사용자 행동 수행 ...

  await page.waitForTimeout(1500); // 전송 완료 대기

  // 긍정: 특정 이벤트가 있어야 함
  const hasCartAdd = capturedEventKeys.some(k => k === "cart.add");
  expect(hasCartAdd).toBe(true);

  // 부정: 특정 이벤트가 없어야 함
  const hasPayment = capturedEventKeys.some(k => k.startsWith("payment."));
  expect(hasPayment).toBe(false);
});
```

### 패턴 4: iframe 통합 (roleplay-web)

viz-web 내부의 roleplay iframe과 상호작용한다.

```typescript
test("iframe 내부 요소 조작", async ({ page }) => {
  await selectScenarioAndWaitForWs(page, SCENARIO_ID);

  // iframe 로케이터
  const iframe = page.frameLocator(".roleplay-iframe");

  // iframe 내부 요소 접근
  await expect(iframe.locator("#toolbar")).toBeVisible({ timeout: 10_000 });

  // iframe 상태 확인
  await expect(iframe.locator("#connection-status")).toHaveClass(
    /status-connected/,
    { timeout: 12_000 },
  );
});
```

## 헬퍼 함수 레퍼런스 (`tests/helpers.ts`)

### `INGEST_URL`
```typescript
export const INGEST_URL = "http://localhost:3101";
```
E2E 전용 ingest 서버 주소. dev 서버(3200)와 포트가 다르다.

### `registerScenario(request, scenarioId, steps)`
시나리오를 ingest 서버에 등록한다. 이미 존재하면(409) 무시한다.

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `request` | `APIRequestContext` | Playwright의 API 컨텍스트 |
| `scenarioId` | `string` | 시나리오 고유 ID |
| `steps` | `StepDef[]` | 스텝 정의 배열 |

`StepDef`:
```typescript
interface StepDef {
  id: string;                              // 스텝 ID
  kind: "sequence" | "branch" | "optional"; // 스텝 유형
  required: boolean;                        // 필수 여부
  event_key: string;                        // 기대 이벤트 키
}
```

### `ingestEvents(request, opts)`
이벤트 레코드를 ingest API에 POST한다.

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `opts.sessionId` | `string` | 세션 ID |
| `opts.traceId` | `string` | 트레이스 ID |
| `opts.eventKeys` | `string[]` | 주입할 이벤트 키 목록 |

### `selectScenarioAndWaitForWs(page, scenarioId)`
viz-web에서 시나리오를 선택하고 WebSocket 연결까지 대기한다. 세션 ID를 반환한다.

순서: 페이지 로드 → 드롭다운에서 시나리오 선택 → WS `connected` 상태 대기 → 세션 ID 추출

## 품질 게이트 연동

### GateKind: `e2e-test`

- **scope**: `system` (시스템 레벨 검증)
- **도구**: Playwright
- **실행**: `corepack pnpm --filter @qa-sdk/e2e test:e2e`
- **상태 흐름**: `not_started` → `testing` → `test_passed` → `complete`

work-domain 레지스트리에서 프론트엔드 작업 도메인의 품질 게이트로 등록되어 있다:
```typescript
{ id: "e2e", kind: "e2e-test", command: "corepack pnpm --filter <pkg> test:e2e", description: "E2E 테스트" }
```

### 게이트 통과 기준

1. 모든 테스트가 pass (CI에서는 retry 2회)
2. 시나리오 문서의 `^assertions` 항목이 모두 `expect()`로 커버됨
3. 네거티브 케이스(^variants의 에러 시나리오)도 테스트에 포함

## shop-web 셀렉터 참조

현재 shop-web에서 사용 가능한 주요 `data-testid` 셀렉터:

| 셀렉터 | 위치 |
|--------|------|
| `[data-testid="logo"]` | 전체 — 로고 |
| `[data-testid="login-submit"]` | 로그인 — 제출 버튼 |
| `[data-testid="logout-btn"]` | 네비게이션 — 로그아웃 |
| `[data-testid="nav-home"]` | 네비게이션 — 홈 |
| `[data-testid="nav-products"]` | 네비게이션 — 상품 목록 |
| `[data-testid="nav-cart"]` | 네비게이션 — 장바구니 |
| `[data-testid="product-list"]` | 상품 목록 — 컨테이너 |
| `[data-testid="product-{N}"]` | 상품 목록 — N번째 상품 |
| `[data-testid="product-detail"]` | 상품 상세 — 컨테이너 |
| `[data-testid="add-to-cart-btn"]` | 상품 상세 — 장바구니 담기 |
| `[data-testid="cart-item-{N}"]` | 장바구니 — N번째 아이템 |
| `[data-testid="checkout-btn"]` | 장바구니 — 결제 진행 |
| `[data-testid="pay-btn"]` | 결제 — 결제 버튼 |
| `[data-testid="order-complete"]` | 주문 완료 — 컨테이너 |
| `[data-testid="order-id"]` | 주문 완료 — 주문 번호 |
| `[data-testid="go-mypage-btn"]` | 주문 완료 — 마이페이지 이동 |
| `[data-testid="order-history"]` | 마이페이지 — 주문 내역 |
| `#qa-status` | 상태바 — QA SDK 상태 |
| `#qa-events` | 상태바 — 이벤트 카운트 |
| `#cart-count` | 네비게이션 — 장바구니 수량 |
| `#detail-name` | 상품 상세 — 상품명 |

## viz-web 셀렉터 참조

| 셀렉터 | 위치 |
|--------|------|
| `.scenario-select` | 시나리오 드롭다운 |
| `#ws-status` | WebSocket 연결 상태 |
| `#session-info` | 세션 정보 패널 |
| `#session-id-value` | 세션 ID 텍스트 |
| `.session-list-items` | 세션 목록 |
| `.session-item.selected .session-item-count` | 선택된 세션의 레코드 수 |
| `.spec-graph` | 스펙 그래프 컨테이너 |
| `.graph-node` | 그래프 노드 |
| `.event-log-entry` | 이벤트 로그 항목 |
| `.event-key` | 이벤트 로그의 이벤트 키 |
| `#recompute-btn` | verdict 재계산 버튼 |
| `.verdict-badge-large` | verdict 결과 배지 |
| `.roleplay-iframe` | roleplay iframe |
| `.roleplay-iframe-container` | roleplay iframe 컨테이너 |
| `.roleplay-header .btn-toggle` | roleplay 접기/펼치기 |

## 디버깅

### trace 파일 확인

Playwright는 첫 번째 retry에서 trace를 저장한다 (`trace: "on-first-retry"`).

```bash
# trace viewer 실행
corepack pnpm exec playwright show-trace packages/e2e/test-results/<테스트명>/trace.zip
```

### 스크린샷 확인

실패 시 자동 캡처 (`screenshot: "only-on-failure"`).
`packages/e2e/test-results/` 디렉토리에서 PNG 파일 확인.

### UI 모드로 디버깅

```bash
corepack pnpm --filter @qa-sdk/e2e test:ui
```
Playwright Inspector가 열리고 스텝별 실행, 셀렉터 탐색, 네트워크 감시가 가능하다.

### 서버가 안 뜰 때

```bash
# 서버 개별 확인
curl http://localhost:3101/health   # ingest
curl http://localhost:5210          # viz-web
curl http://localhost:5211          # roleplay-web
curl http://localhost:5220          # shop-web

# 서버를 수동으로 띄우고 테스트 실행 (reuseExistingServer)
corepack pnpm --filter @qa-sdk/ingest-server exec tsx src/test-server.ts &
corepack pnpm --filter @qa-sdk/shop-web start &
corepack pnpm --filter @qa-sdk/e2e test:e2e
```

### waitForTimeout 사용 주의

- `page.waitForTimeout()`은 고정 대기라서 불안정하다
- 가능하면 `expect(...).toBeVisible({ timeout })`, `waitFor({ state })` 사용
- sendBeacon/네트워크 전송 완료 확인이 필요한 경우에만 `waitForTimeout(1500~2000)` 허용

### WebSocket 연결 실패

viz-web과 ingest-server 간 WS 연결이 안 되면:
- ingest-server가 `PORT=3101`로 기동됐는지 확인
- `VITE_INGEST_SERVER_URL`이 `http://localhost:3101`인지 확인
- `selectScenarioAndWaitForWs`의 12초 타임아웃 내에 연결되는지 확인

## 기존 테스트 파일 목록

| 파일 | 대상 서버 | 검증 내용 |
|------|----------|----------|
| `shopping-flow.spec.ts` | shop-web | 전체 쇼핑 흐름 (로그인~결제~마이페이지) |
| `anonymous-browse.spec.ts` | shop-web | 로그인 후 상품만 탐색, cart/checkout 이벤트 미발생 |
| `cart-abandon.spec.ts` | shop-web | 장바구니 담기 후 결제 없이 이탈, 상태 유지 |
| `multi-product-purchase.spec.ts` | shop-web | 상품 2개 담기 → 결제, 이벤트 수/종류 검증 |
| `shop-ingest-integration.spec.ts` | shop-web + ingest | 브라우저 이벤트가 서버에 수집되는지 통합 검증 |
| `event-pipeline.spec.ts` | viz-web + ingest | API 이벤트 주입 → WS → UI 실시간 반영 |
| `scenario-selector.spec.ts` | viz-web + ingest | 시나리오 등록/선택, 세션 생성, WS 연결 |
| `iframe-integration.spec.ts` | viz-web + roleplay | iframe 로드, postMessage 통신, 이벤트 전달 |

## 주의사항

- `fullyParallel: false` — 테스트 간 WebSocket 간섭을 방지한다. 변경하지 않는다
- E2E 전용 ingest 포트는 `3101`이다. 개발 서버(3200)와 충돌하지 않는다
- shop-web의 `INGEST_URL` 기본값과 E2E 서버 포트가 다를 수 있다. 쿼리 파라미터 `?ingest=`로 주입한다
- `test-results/` 디렉토리의 파일은 git에 커밋하지 않는다
- CI에서는 `retries: 2`로 flaky 테스트를 재시도한다
- 이벤트 카운트 검증 시 정확한 숫자 대신 `toBeGreaterThanOrEqual`을 사용한다 (SSOT 파생 원칙)
