# db-bootstrap

Dialect-portable PG/SQLite connection + test fixture. `pg-migration-design.md` Plan 04c 구현.

## 사용 패턴

### 서비스에서 connection

```ts
import { parseDbEnv, createConnection } from "db-bootstrap";

const env = parseDbEnv(process.env);
const conn = await createConnection(env);
// conn.db = Drizzle DB 인스턴스. dialect-specific 사용은 store factory에 위임.
```

### Store 패키지에서 contract test

```ts
import { createSqliteTestFixture, createPgTestFixture } from "db-bootstrap";

const SAMPLE_DDL = `CREATE TABLE ...`;

describe("Store contract", () => {
  for (const dialect of ["sqlite", "pg"] as const) {
    describe(dialect, () => {
      it("...", async () => {
        const fixture = dialect === "sqlite"
          ? await createSqliteTestFixture(SAMPLE_DDL)
          : await createPgTestFixture(SAMPLE_DDL, { /* PG cfg */ });
        // ... 테스트 본문 ...
        await fixture.cleanup();
      });
    });
  }
});
```

## Dialect-only 환경

`peerDependenciesMeta.optional` 패턴 — better-sqlite3 또는 postgres만 설치하면 됨. 미설치 드라이버는 dynamic import 시점에 fail (factory 분기로 회피).

## 환경 변수

`dbEnvSchema` 참조. `QA_DB_DIALECT=sqlite|pg` + dialect별 추가 변수.
