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
---

# db-bootstrap

## 목적 ^purpose

SQLite와 PostgreSQL을 같은 테스트/서비스 부팅 패턴으로 다루기 위한 dialect-portable DB connection 및 fixture helper 패키지다.

## 구성 ^overview

- `createConnection`: `sqlite` 또는 `pg` 설정을 받아 Drizzle DB 인스턴스와 close handle을 만든다.
- `dbEnvSchema` / `parseDbEnv`: 서비스 env에서 DB dialect와 연결 정보를 검증한다.
- `createSqliteTestFixture`: in-memory SQLite fixture를 만든다.
- `createPgTestFixture`: PostgreSQL random schema fixture를 만든다.
- public exports는 `packages/db-bootstrap/src/index.ts`가 소유한다.

## 경계 ^constraint

- 이 패키지는 store별 domain schema를 소유하지 않는다.
- fixture helper는 테스트 전용이며 production store lifecycle을 대체하지 않는다.
- PostgreSQL driver는 optional peer dependency로 유지해 SQLite-only 환경 import를 깨지 않게 한다.
