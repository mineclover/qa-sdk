---
def:
  id: db-bootstrap-rule
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: db-bootstrap
  tags: [database, testing, runtime]
  links:
    - target: db-bootstrap
      type: constrains
    - target: drizzle-orm-convention
      type: depends_on
sources:
  - packages/db-bootstrap/src/connection.ts
  - packages/db-bootstrap/src/env.ts
  - packages/db-bootstrap/src/test-fixtures.ts
  - packages/db-bootstrap/src/connection.test.ts
  - packages/db-bootstrap/src/test-fixtures.test.ts
---

# db-bootstrap — Consumption Rule

## 목적 ^purpose

`db-bootstrap`을 서비스와 테스트에서 사용할 때 지켜야 하는 connection, fixture, dependency 경계 규칙을 정의한다.

## 규칙 ^constraint

- service runtime은 `parseDbEnv`로 dialect-discriminated config를 만든 뒤 `createConnection`을 호출한다.
- store별 domain schema는 각 store package가 소유한다. `db-bootstrap`은 schema ownership을 갖지 않는다.
- fixture helper는 test 전용이다. production lifecycle이나 migration authority를 대체하지 않는다.
- PostgreSQL driver는 optional peer dependency로 유지한다. SQLite-only 환경에서 package import가 깨지면 안 된다.
- PG fixture는 random schema 격리를 사용하고 cleanup에서 schema drop을 수행해야 한다.
- SQLite fixture는 in-memory DB와 caller-provided DDL로 테스트 격리를 만든다.
- 권한/RLS helper를 사용할 때도 DB connection lifecycle은 이 rule을 따른다. 단, 권한 판정 의미와 RLS policy template은 permission surface 문서가 소유한다.
- query rate limit, concurrency budget, event_key metric 검증은 `db-traffic-control`에서 수행하고 `db-bootstrap`에 섞지 않는다.

## 검증 ^consumes

```bash
corepack pnpm --filter db-bootstrap typecheck
corepack pnpm --filter db-bootstrap test
corepack pnpm --filter db-bootstrap build
qa-sdk docs closure db-bootstrap
```
