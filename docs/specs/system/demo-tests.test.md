---
def:
  id: demo-tests-test
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  svc: demo-tests
  tags: [testing, integration, validation]
  links:
    - target: demo-tests
      type: refines
    - target: demo-tests-rule
      type: depends_on
sources:
  - packages/demo-tests/src/schema-consistency.test.ts
  - packages/demo-tests/src/index-meta/invariants.test.ts
  - packages/demo-tests/src/registry-service-e2e.test.ts
  - packages/demo-tests/src/permission-engine/scenario.test.ts
  - packages/demo-tests/src/merge-contract/error-parity.test.ts
---

# demo-tests — Validation Mapping

## 목적 ^purpose

`demo-tests`가 어떤 cross-package 회귀를 막는지 대표 테스트 파일과 연결한다.

## 검증 매핑 ^defines

| 검증 표면 | 테스트 |
|-----------|--------|
| demo-snapshot service/role/feature consistency | `packages/demo-tests/src/schema-consistency.test.ts` |
| index-meta encode/decode invariant gaps | `packages/demo-tests/src/index-meta/invariants.test.ts` |
| registry service integration path | `packages/demo-tests/src/registry-service-e2e.test.ts` |
| permission scenario compatibility | `packages/demo-tests/src/permission-engine/scenario.test.ts` |
| merge-contract error parity | `packages/demo-tests/src/merge-contract/error-parity.test.ts` |

## 검증 명령

```bash
corepack pnpm --filter @qa-sdk/demo-tests test
```
