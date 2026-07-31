---
def:
  id: e2e-suite-spec
  type: spec
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  svc: e2e
  tags: [testing, browser, cross-scope]
  links:
    - target: system-support
      type: refines
    - target: ingest-system
      type: depends_on
    - target: browser-system
      type: depends_on
    - target: e2e-suite-rule
      type: traces_to
    - target: e2e-suite-test
      type: traces_to
    - target: testing-patterns
      type: depends_on
sources:
  - packages/e2e/package.json
  - packages/e2e/tsconfig.json
  - packages/e2e/playwright.config.ts
  - packages/e2e/tests/helpers.ts
  - packages/e2e/tests/event-pipeline.spec.ts
  - packages/e2e/tests/shopping-flow.spec.ts
  - packages/e2e/tests/git-conflicts-map.spec.ts
---
# E2E Suite

## 목적 ^purpose

Playwright 기반 cross-app 브라우저 E2E 패키지. ingest, viz, roleplay, shop, registry-ui를 함께 기동해 실제 사용자 시나리오를 검증한다.

## 구성 ^overview

- `playwright.config.ts` — 브라우저/서비스 기동 설정
- `tests/helpers.ts` — 공통 시나리오 helper
- `tests/*.spec.ts` — 쇼핑, ingest pipeline, iframe, verdict, registry-ui 시나리오
- 루트 `test:e2e`와 같은 의미의 패키지 전용 실행 표면

## ingest 증거 수집 ^ingest-evidence

- E2E 전용 ingest 기준 포트는 `3101`이다. 쇼핑 시나리오는 `?ingest=http://localhost:3101`을 사용한다.
- `navigator.sendBeacon` 본문은 Playwright request 캡처에서 안정적으로 읽을 수 없으므로, 이벤트 종류를 네트워크 요청 본문으로 판정하지 않는다.
- 이벤트 전송을 검증하는 쇼핑 시나리오는 `useFetchTransport()`로 테스트 페이지에서만 Beacon을 비활성화하고 SDK의 `fetch(keepalive)` 경로를 사용한다. 운영 브라우저 설정과 Beacon 우선 정책은 변경하지 않는다.
- `flushAndReadSessionEventKeys()`는 브라우저 `qa_monitor` 세션 ID를 읽고, 운영 flush 주기(5초)를 기다린 뒤 `GET /v1/sessions/:sessionId/records`를 조회한다. 따라서 UI 이벤트 발생, 전송, ingest 저장을 분리해 확인한다.
- 이 검증 helper는 pagehide flush를 함께 트리거하므로, 정상 타이머 flush와 페이지 이탈 시 flush 경로를 모두 확인한다.

## 기능 경계 ^constraint

- 이 패키지는 browser-level scenario proof를 소유한다. ingest-server, viz-web, roleplay-web, shop-web, registry-ui의 runtime behavior는 각 package가 소유한다.
- `playwright.config.ts`의 `webServer`는 E2E 실행 orchestration이며, service bootstrap contract나 port registry SSOT가 아니다.
- local smoke에서는 `test` script가 안내만 수행한다. 실제 브라우저 실행은 `test:e2e` 또는 CI workflow가 소유한다.

## 검증 ^validation

```bash
corepack pnpm --filter @qa-sdk/e2e test
corepack pnpm --filter @qa-sdk/e2e typecheck
corepack pnpm --filter @qa-sdk/e2e exec playwright test --list
qa-sdk docs closure e2e-suite-spec
```
