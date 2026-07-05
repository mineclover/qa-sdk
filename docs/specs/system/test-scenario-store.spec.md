---
def:
  id: test-scenario-store
  type: spec
  tier: component
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: test-scenario-store
  tags: [persistence, testing]
  links:
    - target: persistence-system-root
      type: refs
    - target: test-scenario-store-rule
      type: traces_to
    - target: test-scenario-store-test
      type: traces_to
    - target: drizzle-orm-convention
      type: depends_on
  sources:
    - packages/test-scenario-store/package.json
    - packages/test-scenario-store/src/index.ts
    - packages/test-scenario-store/src/store.ts
    - packages/test-scenario-store/src/store.test.ts
    - packages/test-scenario-store/src/types.ts
    - packages/test-scenario-store/src/db/schema.ts
---

# test-scenario-store — 시나리오 B 좌표 레지스트리

## 목적 ^purpose

테스트 시나리오의 축 좌표(B axis — behavior)를 SQLite 레지스트리로 저장·조회하는 라이브러리. 시나리오 정의가 prefix/axis 좌표를 갖도록 만들어, ingest pipeline이 발생 이벤트의 시나리오 소속을 결정론적으로 판정할 수 있게 한다.

## 구성 ^overview

- `SqliteTestScenarioStore`: declared/assigned/collected lifecycle과 B 좌표 저장을 담당한다.
- `test_scenarios`: scenario identity, A/B coordinate, lifecycle, participant metadata를 저장한다.
- `test_scenario_runs`: scenario run result, commit hash, duration evidence를 저장한다.
- public export는 `packages/test-scenario-store/src/index.ts`가 소유한다.

## 기능 경계 ^constraint

- 이 package는 test scenario registry persistence를 소유한다. test taxonomy vocabulary는 `test-types`가 소유한다.
- scenario execution, Playwright browser orchestration, demo integration test authoring은 `e2e-suite-spec`와 `demo-tests`가 소유한다.
- SQLite schema/migration convention은 `drizzle-orm-convention`을 따른다.

## 검증 ^validation

```bash
corepack pnpm --filter test-scenario-store typecheck
corepack pnpm --filter test-scenario-store test
corepack pnpm --filter test-scenario-store build
qa-sdk docs closure test-scenario-store
```
