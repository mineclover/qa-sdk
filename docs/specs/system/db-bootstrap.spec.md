---
def:
  id: db-bootstrap
  type: spec
  tier: system
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: db-bootstrap
  tags: [database, testing, runtime, structural]
  links:
    - target: shared-utility-group
      type: refines
    - target: drizzle-orm-convention
      type: depends_on
    - target: db-bootstrap-rule
      type: traces_to
  sources:
    - packages/db-bootstrap/package.json
    - packages/db-bootstrap/src/index.ts
    - packages/db-bootstrap/src/connection.ts
    - packages/db-bootstrap/src/connection.test.ts
    - packages/db-bootstrap/src/env.ts
    - packages/db-bootstrap/src/env.test.ts
    - packages/db-bootstrap/src/test-fixtures.ts
    - packages/db-bootstrap/src/test-fixtures.test.ts
---

# db-bootstrap

## 목적 ^purpose

SQLite와 PostgreSQL을 같은 테스트/서비스 부팅 패턴으로 다루기 위한 dialect-portable DB connection 및 fixture helper 패키지다.

## 구성 ^overview

- `createConnection`: `sqlite` 또는 `pg` 설정을 받아 Drizzle DB 인스턴스와 close handle을 만든다.
- `createDualConnection`: write/read replica connection을 같은 dialect 안에서 분리해 만든다.
- `dbEnvSchema` / `parseDbEnv`: 서비스 env에서 DB dialect와 연결 정보를 검증한다.
- `createSqliteTestFixture`: in-memory SQLite fixture를 만든다.
- `createPgTestFixture`: PostgreSQL random schema fixture를 만든다.
- public exports는 `packages/db-bootstrap/src/index.ts`가 소유한다.

## 기능 경계 ^constraint

- 이 패키지는 store별 domain schema를 소유하지 않는다.
- fixture helper는 테스트 전용이며 production store lifecycle을 대체하지 않는다.
- PostgreSQL driver는 optional peer dependency로 유지해 SQLite-only 환경 import를 깨지 않게 한다.
- RLS session/interceptor/admin-bypass helper는 같은 package에서 export되지만, source ownership은 `permission-engine-spec`과 `authorization-ontology-rls-enforcement`에 연결된다. `db-bootstrap`은 connection/env/fixture boundary만 소유한다.
- `db-traffic-control`의 query budget, throttling, metrics, event bridge는 이 패키지 책임이 아니다.

## 검증 ^validation

```bash
corepack pnpm --filter db-bootstrap typecheck
corepack pnpm --filter db-bootstrap test
corepack pnpm --filter db-bootstrap build
```
