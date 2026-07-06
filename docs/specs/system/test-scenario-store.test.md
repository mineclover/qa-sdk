---
def:
  id: test-scenario-store-test
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  svc: test-scenario-store
  tags: [testing, persistence, validation]
  links:
    - target: test-scenario-store
      type: refines
    - target: test-scenario-store-rule
      type: depends_on
sources:
  - packages/test-scenario-store/src/store.test.ts
---

# test-scenario-store — Validation Mapping

## 목적 ^purpose

`SqliteTestScenarioStore`의 lifecycle 전이, B 좌표 부여, run 기록이 어떤 테스트로 고정되는지 연결한다.

## 검증 매핑 ^defines

| 검증 표면 | 테스트 |
|-----------|--------|
| declared 저장과 중복 upsert skip | `packages/test-scenario-store/src/store.test.ts` |
| assigned 상태와 B 좌표 부여 | `packages/test-scenario-store/src/store.test.ts` |
| run 기록 후 collected 전이 | `packages/test-scenario-store/src/store.test.ts` |
| lifecycle 필터와 전역 `nextSeq()` | `packages/test-scenario-store/src/store.test.ts` |

## 검증 명령

```bash
corepack pnpm --filter test-scenario-store test
```
