---
def:
  id: test-scenario-store-rule
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: test-scenario-store
  tags: [persistence, testing, contract]
  links:
    - target: test-scenario-store
      type: constrains
    - target: drizzle-orm-convention
      type: depends_on
sources:
  - packages/test-scenario-store/src/store.ts
  - packages/test-scenario-store/src/types.ts
  - packages/test-scenario-store/src/db/schema.ts
---

# test-scenario-store — Consumption Rule

## 목적 ^purpose

`test-scenario-store`를 테스트 좌표 레지스트리로 사용할 때 B 좌표, lifecycle, persistence boundary가 섞이지 않도록 규칙을 고정한다.

## 규칙 ^constraint

- `upsertDeclared()`는 A 좌표와 scenario metadata를 declared 상태로 저장한다.
- `assign()`은 B 좌표 `test_scenario:v1:N`과 test file path를 부여하고 lifecycle을 assigned로 전환한다.
- `recordRun()`은 execution result를 append하고 assigned scenario를 collected로 전환한다.
- `nextSeq()`는 kind/scope별 sequence가 아니라 전역 B 좌표 sequence를 반환한다.
- scenario kind/scope/lifecycle vocabulary는 `test-types`에서 가져오며 store가 새 vocabulary를 정의하지 않는다.

## 검증 ^validation

```bash
corepack pnpm --filter test-scenario-store test
```
