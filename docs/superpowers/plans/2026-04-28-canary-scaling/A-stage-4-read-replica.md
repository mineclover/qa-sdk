## 단계 4: read replica 컨테이너 + db-bootstrap dual connection

**Spec 참조:** `04-scaling-infra.md` §4

본 단계는 (a) qa-sdk-db에 streaming replication 활성화, (b) qa-sdk-db-replica 컨테이너 추가, (c) db-bootstrap에 `createDualConnection` 신설, (d) 시뮬 .env에 SIM_DB_WRITE_URL/SIM_DB_READ_URL 추가.

### Task 4.1: qa-sdk-db에 wal_level=replica + replicator role

**Files:**
- Create: `packages/infra-engine/init/qa-sdk-db-replication.sql`
- Modify: `packages/infra-engine/docker-compose.infra.yaml`

- [ ] **Step 4.1.1: replicator role + slot 생성 SQL**

`packages/infra-engine/init/qa-sdk-db-replication.sql`:

```sql
-- read replica 토폴로지 부트스트랩 — qa-sdk-db (primary) 측
-- Plan A 단계 4 Task 4.1: replicator role + physical replication slot
--
-- 환경 변수 → psql 변수 로드 (psql 14+ \getenv) — qa-sdk-db.sql 컨벤션 동일
\getenv replicator_password QA_SDK_REPLICATOR_PASSWORD

-- replicator role: streaming replication 전용 LOGIN
-- (실제 패스워드는 .env.docker의 QA_SDK_REPLICATOR_PASSWORD 환경에서 inject됨)
--
-- 주의: psql 변수(:'name')는 dollar-quoted block($$...$$) 내부에서 치환되지 않음.
-- /docker-entrypoint-initdb.d/ 는 빈 PGDATA 에서만 1회 실행되므로 IF NOT EXISTS 가드 불필요.
-- qa-sdk-db.sql 의 CREATE ROLE 패턴과 동일하게 평문 statement 로 작성.
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD :'replicator_password';

-- physical replication slot — qa-sdk-db-replica 가 사용
SELECT pg_create_physical_replication_slot('sim_read_replica_slot')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_replication_slots WHERE slot_name = 'sim_read_replica_slot'
);
```

> **Spec fix (Task 4.1 구현 검증으로 확정).** 초안의 `DO $$ ... END $$` 블록 안에서 `:'replicator_password'` psql 변수를 사용하면 dollar-quoted string 내부에서 substitution이 발생하지 않아 fresh volume에서도 syntax error가 발생한다. 본 SQL은 그것을 정정한 형태로, `qa-sdk-db.sql`의 기존 `CREATE ROLE` 컨벤션과 동일하게 `\getenv` + 평문 `CREATE ROLE`로 작성한다. `IF NOT EXISTS` 가드는 `/docker-entrypoint-initdb.d/`가 빈 PGDATA에서만 1회 실행되므로 불필요.

- [ ] **Step 4.1.2: docker-compose.infra.yaml의 qa-sdk-db에 wal_level + 새 init SQL volume 추가**

`packages/infra-engine/docker-compose.infra.yaml` 라인 114-138 영역(qa-sdk-db) 변경:

```yaml
qa-sdk-db:
  image: postgres:16-alpine
  command:
    - postgres
    - -c
    - wal_level=replica
    - -c
    - max_wal_senders=4
    - -c
    - max_replication_slots=4
    - -c
    - hot_standby=on
  env_file: .env.docker
  environment:
    POSTGRES_DB: postgres
    QA_SDK_AUTH_PASSWORD: ${QA_SDK_AUTH_PASSWORD}
    QA_SDK_AUDIT_PASSWORD: ${QA_SDK_AUDIT_PASSWORD}
    QA_SDK_INGEST_PASSWORD: ${QA_SDK_INGEST_PASSWORD}
    QA_SDK_DECISION_PASSWORD: ${QA_SDK_DECISION_PASSWORD}
    QA_SDK_DEFINITION_PASSWORD: ${QA_SDK_DEFINITION_PASSWORD}
    QA_SDK_ADMIN_PASSWORD: ${QA_SDK_ADMIN_PASSWORD}
    QA_SDK_SIM_PASSWORD: ${QA_SDK_SIM_PASSWORD}
    QA_SDK_REPLICATOR_PASSWORD: ${QA_SDK_REPLICATOR_PASSWORD}
  ports:
    - "5434:5432"
  volumes:
    - qa-sdk-db-data:/var/lib/postgresql/data
    - ./init/qa-sdk-db.sql:/docker-entrypoint-initdb.d/00-qa-sdk-db.sql:ro
    - ./init/qa-sdk-db-helpers.sql:/docker-entrypoint-initdb.d/10-qa-sdk-db-helpers.sql:ro
    - ./init/qa-sdk-db-replication.sql:/docker-entrypoint-initdb.d/20-qa-sdk-db-replication.sql:ro
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres -d qa_sdk"]
    interval: 5s
    timeout: 3s
    retries: 15
    start_period: 10s
```

- [ ] **Step 4.1.3: pg_hba.conf 갱신은 별도 (참고)**

PG는 default `pg_hba.conf`로는 replication 연결을 허용하지 않을 수 있다. postgres docker image는 `host all all all md5` 디폴트로 동작하지만, replication은 별도. 이 단계에서는 다음 환경변수로 우회:

```bash
# .env.docker 또는 docker-compose env에 다음 추가 (이미 있으면 skip)
POSTGRES_HOST_AUTH_METHOD=md5
POSTGRES_INITDB_ARGS=--auth-host=md5
```

또는 standby가 부팅 시 `-Fp -X stream` 옵션으로 직접 streaming 모드를 활성화한다 (Task 4.2에서 다룸).

> **사용자 작업 (단계 4 적용 전 prerequisite).**
>
> 1. `.env.docker`에 `QA_SDK_REPLICATOR_PASSWORD=<생성한 비밀번호>` 추가. (sops 사용자) `sops decrypt .env.docker.enc > .env.docker` → 변수 추가 → `sops encrypt .env.docker > .env.docker.enc`.
> 2. 기존 `qa-sdk-db` PG volume(`infra-engine_qa-sdk-db-data`)이 비어 있지 않으면 `/docker-entrypoint-initdb.d/`가 실행되지 않으므로 다음 둘 중 하나 선택:
>     - **(a) destructive)** `docker volume rm infra-engine_qa-sdk-db-data` 후 재부팅. 기존 데이터 소실.
>     - **(b) non-destructive)** 변수 추가 + 부팅 후 `docker exec qa-sdk-db sh -c 'psql -U postgres -d qa_sdk -f /docker-entrypoint-initdb.d/20-qa-sdk-db-replication.sql'` 수동 실행.
>
> 본 task의 코드 변경(SQL/yaml)은 위 prerequisite과 독립적으로 commit한다. 부팅 검증은 prerequisite 충족 후 수동 수행.

- [ ] **Step 4.1.4: 부팅 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine
docker compose -f docker-compose.infra.yaml up -d qa-sdk-db
sleep 10
docker exec qa-sdk-db psql -U postgres -d qa_sdk -c "SHOW wal_level;"
docker exec qa-sdk-db psql -U postgres -d qa_sdk -c "SELECT slot_name FROM pg_replication_slots;"
```

기대: `wal_level = replica`, slot `sim_read_replica_slot` 존재.

- [ ] **Step 4.1.5: Commit**

```bash
git add packages/infra-engine/docker-compose.infra.yaml \
        packages/infra-engine/init/qa-sdk-db-replication.sql
git commit -m "feat(infra-engine): qa-sdk-db wal_level=replica + replicator role + slot"
```

### Task 4.2: qa-sdk-db-replica service entry 추가

**Files:**
- Modify: `packages/infra-engine/docker-compose.infra.yaml`

- [ ] **Step 4.2.1: standby service entry**

`docker-compose.infra.yaml`의 services 블록에 다음을 추가:

```yaml
qa-sdk-db-replica:
  image: postgres:16-alpine
  environment:
    PGUSER: replicator
    PGPASSWORD: ${QA_SDK_REPLICATOR_PASSWORD}
  command:
    - bash
    - -c
    - |
      set -e
      if [ ! -s "$$PGDATA/PG_VERSION" ]; then
        until pg_basebackup -h qa-sdk-db -p 5432 -U replicator -D "$$PGDATA" -R -P -X stream -S sim_read_replica_slot; do
          echo "Waiting for primary to be ready for basebackup..."
          sleep 2
        done
        chmod 700 "$$PGDATA"
      fi
      exec docker-entrypoint.sh postgres -c hot_standby=on
  ports:
    - "5435:5432"
  volumes:
    - qa-sdk-db-replica-data:/var/lib/postgresql/data
  depends_on:
    qa-sdk-db:
      condition: service_healthy
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U replicator"]
    interval: 5s
    timeout: 3s
    retries: 15
    start_period: 30s
```

그리고 `volumes:` 블록에 추가:

```yaml
volumes:
  qa-sdk-db-data:
  qa-sdk-db-replica-data:    # NEW
```

- [ ] **Step 4.2.2: 부팅 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine
docker compose -f docker-compose.infra.yaml up -d qa-sdk-db qa-sdk-db-replica
sleep 30
docker exec qa-sdk-db-replica psql -U replicator -d postgres -c "SELECT pg_is_in_recovery();"
docker exec qa-sdk-db psql -U postgres -d qa_sdk -c \
  "SELECT application_name, state, replay_lag FROM pg_stat_replication;"
```

기대: replica의 `pg_is_in_recovery() = t`, primary 측 `pg_stat_replication`에 1 entry 존재.

- [ ] **Step 4.2.3: Commit**

```bash
git add packages/infra-engine/docker-compose.infra.yaml
git commit -m "feat(infra-engine): qa-sdk-db-replica streaming standby"
```

### Task 4.3: db-bootstrap에 createDualConnection 추가

**Files:**
- Modify: `packages/db-bootstrap/src/connection.ts`
- Modify: `packages/db-bootstrap/src/env.ts`
- Modify: `packages/db-bootstrap/src/index.ts`
- Create: `packages/db-bootstrap/src/dual-connection.test.ts`

- [ ] **Step 4.3.1: 실패 테스트 작성**

`packages/db-bootstrap/src/dual-connection.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import {
  createDualConnection,
  type DualConnection,
} from "./connection.js";

describe("createDualConnection (PG)", () => {
  let conn: DualConnection | undefined;

  afterEach(async () => {
    if (conn) await conn.close();
    conn = undefined;
  });

  it("returns separate write and read Connection instances", async () => {
    if (!process.env.QA_PG_HOST) {
      // Skip when PG not available (CI without PG service skips with note).
      console.warn("QA_PG_HOST not set, skipping dual-connection PG test");
      return;
    }
    conn = await createDualConnection({
      dialect: "pg",
      write: {
        pgHost: process.env.QA_PG_HOST!,
        pgPort: Number(process.env.QA_PG_PORT ?? 5434),
        pgDatabase: process.env.QA_PG_DATABASE ?? "qa_sdk",
        pgUser: process.env.QA_PG_USER ?? "postgres",
        pgPassword: process.env.QA_PG_PASSWORD ?? "postgres",
      },
      read: {
        pgHost: process.env.QA_PG_HOST_REPLICA ?? process.env.QA_PG_HOST!,
        pgPort: Number(process.env.QA_PG_PORT_REPLICA ?? 5435),
        pgDatabase: process.env.QA_PG_DATABASE ?? "qa_sdk",
        pgUser: "replicator",
        pgPassword: process.env.QA_PG_REPLICATOR_PASSWORD ?? "replicator",
      },
    });

    expect(conn.write).toBeDefined();
    expect(conn.read).toBeDefined();
    expect(conn.write.dialect).toBe("pg");
    expect(conn.read.dialect).toBe("pg");
    expect(conn.write).not.toBe(conn.read);
  });

  it("createDualConnection in sqlite mode returns same instance for both (read = write alias)", async () => {
    conn = await createDualConnection({
      dialect: "sqlite",
      write: { sqlitePath: ":memory:" },
      read: { sqlitePath: ":memory:" },  // sqlite는 별도 file이거나 동일
    });
    expect(conn.write.dialect).toBe("sqlite");
    expect(conn.read.dialect).toBe("sqlite");
  });
});
```

- [ ] **Step 4.3.2: 테스트 실패 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk
pnpm --filter db-bootstrap test dual-connection
```

기대: FAIL (export 미정의).

- [ ] **Step 4.3.3: connection.ts에 createDualConnection 추가**

`packages/db-bootstrap/src/connection.ts` 끝에 다음 추가 (기존 `createConnection`은 그대로 유지):

```typescript
// ============================================================
// Dual connection (write + read replica)
// ============================================================

export interface DualConnection {
  dialect: DialectKind;
  write: Connection;
  read: Connection;
  close(): Promise<void>;
}

export type DualConnectionConfig =
  | {
      dialect: "pg";
      write: Omit<PgConfig, "dialect">;
      read: Omit<PgConfig, "dialect">;
    }
  | {
      dialect: "sqlite";
      write: Omit<SqliteConfig, "dialect">;
      read: Omit<SqliteConfig, "dialect">;
    };

export async function createDualConnection(
  cfg: DualConnectionConfig,
): Promise<DualConnection> {
  if (cfg.dialect === "pg") {
    const write = await createConnection({ dialect: "pg", ...cfg.write });
    const read = await createConnection({ dialect: "pg", ...cfg.read });
    return {
      dialect: "pg",
      write,
      read,
      close: async () => {
        await Promise.all([write.close(), read.close()]);
      },
    };
  }
  const write = await createConnection({ dialect: "sqlite", ...cfg.write });
  const read = await createConnection({ dialect: "sqlite", ...cfg.read });
  return {
    dialect: "sqlite",
    write,
    read,
    close: async () => {
      await Promise.all([write.close(), read.close()]);
    },
  };
}
```

- [ ] **Step 4.3.4: 테스트 통과 확인**

```bash
pnpm --filter db-bootstrap build && pnpm --filter db-bootstrap test dual-connection
```

기대: PG 테스트는 PG 서비스 활성 시 PASS, sqlite 테스트는 항상 PASS.

- [ ] **Step 4.3.5: index.ts re-export**

`packages/db-bootstrap/src/index.ts`의 `connection.js` export 블록에 `createDualConnection`, `DualConnection`, `DualConnectionConfig`를 추가.

- [ ] **Step 4.3.6: Commit**

```bash
git add packages/db-bootstrap/src/connection.ts \
        packages/db-bootstrap/src/dual-connection.test.ts \
        packages/db-bootstrap/src/index.ts
git commit -m "feat(db-bootstrap): createDualConnection (write + read replica)"
```

### Task 4.4: env schema에 SIM_DB_WRITE_URL / SIM_DB_READ_URL 추가

**Files:**
- Modify: `packages/db-bootstrap/src/env.ts`

- [ ] **Step 4.4.1: dbEnvSchema 확장**

`packages/db-bootstrap/src/env.ts`의 `dbEnvSchema` 객체에 다음 키 추가:

```typescript
SIM_DB_WRITE_URL: z.string().url().optional(),
SIM_DB_READ_URL:  z.string().url().optional(),
```

별도 helper 함수 추가 (URL → PgConfig 분해):

```typescript
export function parsePgUrl(url: string): Omit<PgConfig, "dialect"> {
  const u = new URL(url);
  return {
    pgHost: u.hostname,
    pgPort: Number(u.port || 5432),
    pgDatabase: u.pathname.slice(1),
    pgUser: decodeURIComponent(u.username),
    pgPassword: decodeURIComponent(u.password),
  };
}
```

타입 import: 파일 상단에 `import type { PgConfig } from "./connection.js";` 추가.

- [ ] **Step 4.4.2: 단위 테스트 추가 (parsePgUrl)**

`packages/db-bootstrap/src/env.test.ts`에 다음 테스트 추가 (파일이 없으면 신규 생성):

```typescript
import { describe, it, expect } from "vitest";
import { parsePgUrl } from "./env.js";

describe("parsePgUrl", () => {
  it("parses postgres://user:pw@host:5432/db", () => {
    expect(parsePgUrl("postgres://app:secret@localhost:5432/qa_sdk")).toEqual({
      pgHost: "localhost",
      pgPort: 5432,
      pgDatabase: "qa_sdk",
      pgUser: "app",
      pgPassword: "secret",
    });
  });

  it("defaults port to 5432 when missing", () => {
    expect(parsePgUrl("postgres://app:secret@localhost/qa_sdk").pgPort).toBe(5432);
  });
});
```

- [ ] **Step 4.4.3: 빌드 + 테스트**

```bash
pnpm --filter db-bootstrap build && pnpm --filter db-bootstrap test
```

기대: 모든 테스트 PASS.

- [ ] **Step 4.4.4: Commit**

```bash
git add packages/db-bootstrap/src/env.ts \
        packages/db-bootstrap/src/env.test.ts
git commit -m "feat(db-bootstrap): SIM_DB_*_URL env + parsePgUrl helper"
```

### Task 4.5: 시뮬 .env.sim.example에 write/read URL 추가

**Files:**
- Modify: `simulations/enterprise-pm/.env.sim.example`

- [ ] **Step 4.5.1: 환경 변수 추가**

기존 DB 블록 뒤에 다음 추가:

```
# Read replica routing (Plan A 단계 4)
SIM_DB_WRITE_URL=postgres://sim_app:__from_sops__@qa-sdk-db:5432/qa_sdk
SIM_DB_READ_URL=postgres://replicator:__from_sops__@qa-sdk-db-replica:5432/qa_sdk
```

이 시점에는 사용하는 서비스가 아직 없으므로 (단계 8에서 BFF/reporting이 read DataSource로 전환), .env에만 미리 추가해 둔다. 미사용 변수는 zod schema에서 optional이라 부팅 영향 없음.

- [ ] **Step 4.5.2: Commit**

```bash
git add simulations/enterprise-pm/.env.sim.example
git commit -m "chore(sim): add SIM_DB_WRITE_URL / SIM_DB_READ_URL placeholders"
```

### Task 4.6: 단계 4 통합 검증

- [ ] **Step 4.6.1: replication 동작 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine
docker compose -f docker-compose.infra.yaml up -d qa-sdk-db qa-sdk-db-replica
sleep 30

# primary에 테스트 INSERT
docker exec qa-sdk-db psql -U postgres -d qa_sdk -c \
  "CREATE TABLE IF NOT EXISTS replication_smoke (id int); INSERT INTO replication_smoke VALUES (1);"

sleep 2

# replica에서 SELECT
docker exec qa-sdk-db-replica psql -U replicator -d qa_sdk -c \
  "SELECT * FROM replication_smoke;"
```

기대: replica에서 (1) 행이 보임. lag은 1초 미만.

- [ ] **Step 4.6.2: cleanup**

```bash
docker exec qa-sdk-db psql -U postgres -d qa_sdk -c "DROP TABLE IF EXISTS replication_smoke;"
```
