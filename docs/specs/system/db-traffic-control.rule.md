---
def:
  id: db-traffic-control-rule
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: db-traffic-control
  tags: [database, performance, observability, contract]
  links:
    - target: db-traffic-control-spec
      type: constrains
    - target: drizzle-orm-convention
      type: depends_on
  sources:
    - packages/db-traffic-control/src/budget.ts
    - packages/db-traffic-control/src/controller.ts
    - packages/db-traffic-control/src/drizzle-middleware.ts
    - packages/db-traffic-control/src/event-bridge.ts
    - packages/db-traffic-control/src/metrics.ts
    - packages/db-traffic-control/src/event-bridge.test.ts
---

# db-traffic-control — Consumption Rule

## 목적 ^purpose

`db-traffic-control`을 서비스 query path에 붙일 때 traffic budget, DB lifecycle, event validation 책임이 섞이지 않도록 consumption rule을 정의한다.

## 규칙 ^constraint

- service가 budget 정의를 소유한다. 이 패키지는 budget matching과 enforcement engine만 제공한다.
- `TrafficController.beforeQuery()`를 직접 호출하면 반환된 `release()`를 `finally`에서 호출한다. Drizzle path는 `withTrafficControl()`이 이 순서를 자동화한다.
- `warn` mode는 metric evidence 수집용이고 `enforce` mode는 rejection/throttling을 실제 적용한다. mode 전환은 service 운영 정책에서 결정한다.
- DB connection, env parsing, schema/migration, test fixture는 `db-bootstrap` 또는 각 store package에서 처리한다.
- `event-bridge`는 event catalog를 import하지 않는다. collector와 callback으로 event_key/transition 일치 여부만 검증한다.

## 검증 ^validation

```bash
corepack pnpm --filter db-traffic-control typecheck
corepack pnpm --filter db-traffic-control test
corepack pnpm --filter db-traffic-control build
qa-sdk docs closure db-traffic-control-spec
```
