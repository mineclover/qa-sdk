---
def:
  id: e2e-suite-test
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  svc: e2e
  tags: [testing, browser, validation]
  links:
    - target: e2e-suite-spec
      type: refines
    - target: e2e-suite-rule
      type: depends_on
sources:
  - packages/e2e/tests/event-pipeline.spec.ts
  - packages/e2e/tests/shopping-flow.spec.ts
  - packages/e2e/tests/git-conflicts-map.spec.ts
  - packages/e2e/tests/helpers.ts
---

# E2E Suite — Validation Mapping

## 목적 ^purpose

E2E suite의 대표 browser scenario가 어떤 cross-app behavior를 검증하는지 연결한다.

## 검증 매핑 ^defines

| 검증 표면 | 테스트 |
|-----------|--------|
| ingest API event가 viz-web event log에 나타남 | `packages/e2e/tests/event-pipeline.spec.ts` |
| shop user flow browser path | `packages/e2e/tests/shopping-flow.spec.ts` |
| generated git-conflicts report UI path | `packages/e2e/tests/git-conflicts-map.spec.ts` |
| scenario registration and ingest helpers | `packages/e2e/tests/helpers.ts` |

## 검증 명령

```bash
corepack pnpm --filter @qa-sdk/e2e exec playwright test --list
```
