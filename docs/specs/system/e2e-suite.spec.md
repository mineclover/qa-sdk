---
def:
  id: e2e-suite-spec
  level: leaf
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
---
# E2E Suite

## 목적 ^purpose

Playwright 기반 cross-app 브라우저 E2E 패키지. ingest, viz, roleplay, shop, registry-ui를 함께 기동해 실제 사용자 시나리오를 검증한다.

## 구성 ^overview

- `playwright.config.ts` — 브라우저/서비스 기동 설정
- `tests/helpers.ts` — 공통 시나리오 helper
- `tests/*.spec.ts` — 쇼핑, ingest pipeline, iframe, verdict, registry-ui 시나리오
- 루트 `test:e2e`와 같은 의미의 패키지 전용 실행 표면

## 관련 소스

- `packages/e2e/playwright.config.ts`
- `packages/e2e/tests/helpers.ts`
- `packages/e2e/tests/`
