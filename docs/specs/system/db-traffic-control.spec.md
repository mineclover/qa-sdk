---
def:
  id: db-traffic-control-spec
  level: leaf
  tier: component
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
---
# db-traffic-control

## 목적 ^purpose

DB 질의를 fingerprint 단위로 식별하고, budget 기반 동시성/QPS 제한과 Drizzle 미들웨어 연결을 제공하는 보조 라이브러리.

## 구성 ^overview

- `budget` — 쿼리 예산 정의
- `concurrency-limiter`, `rate-limiter` — 동시성/QPS 제어
- `controller` — 통합 제어기
- `drizzle-middleware` — Drizzle query builder 경로에 budget 제어를 부착
- `event-bridge`, `metrics` — 관측 연동

## 관련 소스

- `packages/db-traffic-control/src/budget.ts`
- `packages/db-traffic-control/src/controller.ts`
- `packages/db-traffic-control/src/drizzle-middleware.ts`
- `packages/db-traffic-control/src/event-bridge.ts`
