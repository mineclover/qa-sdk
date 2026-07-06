---
def:
  id: db-traffic-control-spec
  type: spec
  tier: system
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: db-traffic-control
  tags: [database, performance, observability]
  links:
    - target: system-support
      type: refines
    - target: drizzle-orm-convention
      type: depends_on
    - target: db-traffic-control-rule
      type: traces_to
sources:
  - packages/db-traffic-control/package.json
  - packages/db-traffic-control/src/index.ts
  - packages/db-traffic-control/src/budget.ts
  - packages/db-traffic-control/src/budget.test.ts
  - packages/db-traffic-control/src/controller.ts
  - packages/db-traffic-control/src/controller.test.ts
  - packages/db-traffic-control/src/drizzle-middleware.ts
  - packages/db-traffic-control/src/event-bridge.ts
  - packages/db-traffic-control/src/event-bridge.test.ts
  - packages/db-traffic-control/src/metrics.ts
  - packages/db-traffic-control/src/metrics.test.ts
---
# db-traffic-control

## 목적 ^purpose

DB 질의를 fingerprint 단위로 식별하고, budget 기반 동시성/QPS 제한과 Drizzle 미들웨어 연결을 제공하는 독립 트래픽 제어 라이브러리.

## 구성 ^overview

- `budget` — 쿼리 예산 정의
- `concurrency-limiter`, `rate-limiter` — 동시성/QPS 제어
- `controller` — 통합 제어기
- `drizzle-middleware` — Drizzle query builder 경로에 budget 제어를 부착
- `event-bridge`, `metrics` — 관측 연동

## 기능 경계 ^constraint

- 이 패키지는 query fingerprint, budget matching, concurrency/QPS limit, query metric event, Drizzle middleware adapter를 소유한다.
- DB connection, env parsing, test fixture, schema/migration lifecycle은 `db-bootstrap`과 각 store package가 소유한다.
- event catalog 자체를 import하지 않는다. `event-bridge`는 collector와 lookup callback을 받는 validation port만 제공한다.
- traffic budget은 caller가 정의한다. 이 패키지는 service-specific SLO나 product policy의 SSOT가 아니다.

## 검증 ^validation

```bash
corepack pnpm --filter db-traffic-control typecheck
corepack pnpm --filter db-traffic-control test
corepack pnpm --filter db-traffic-control build
```
