---
def:
  id: e2e-suite-rule
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: e2e
  tags: [testing, browser, contract]
  links:
    - target: e2e-suite-spec
      type: constrains
    - target: testing-patterns
      type: depends_on
sources:
  - packages/e2e/playwright.config.ts
  - packages/e2e/tests/helpers.ts
---

# E2E Suite — Consumption Rule

## 목적 ^purpose

Playwright E2E package를 browser scenario evidence로 사용할 때 service ownership, orchestration, local/CI execution boundary를 구분한다.

## 규칙 ^constraint

- E2E tests는 user-visible cross-app behavior를 검증한다. service internals나 package-local unit contract를 대체하지 않는다.
- `webServer` commands는 test orchestration이다. production deploy command나 canonical service bootstrap으로 승격하지 않는다.
- local quick validation은 `playwright test --list`로 test inventory와 config parsing을 확인할 수 있다.
- test source의 범위 검증은 패키지 전용 `tsconfig.json`과 `pnpm --filter @qa-sdk/e2e typecheck`를 사용한다. 루트 `tsconfig`를 직접 실행해 workspace 전체를 E2E 오류로 해석하지 않는다.
- full browser execution은 `test:e2e` 또는 CI workflow에서 수행한다.

## 검증 ^validation

```bash
corepack pnpm --filter @qa-sdk/e2e test
corepack pnpm --filter @qa-sdk/e2e typecheck
corepack pnpm --filter @qa-sdk/e2e exec playwright test --list
```
