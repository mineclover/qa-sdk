# PG 이행 디자인 — Dual-Target Dialect-Portable 아키텍처

2026-04-22 · Phase 2 brainstorming 결과

qa-sdk를 SQLite-only에서 SQLite + PostgreSQL dual-target으로 전환한다. 단일 코드베이스가 두 dialect를 동시에 지원해 로컬 dev는 zero-setup SQLite, 프로덕션은 PostgreSQL(RLS·동시성·감사)로 분리 운영한다. PG 추가는 Phase 3 RLS enforcement의 전제 조건이며, Phase 4 시뮬 프로젝트의 권한 검증 환경을 제공한다.

---

## 1. 아키텍처 개요

**Dual-target dialect-portable**: 한 store 패키지가 SQLite와 PostgreSQL 양쪽 어댑터를 동시 제공. 비즈니스 로직(순수 state machine, 도메인 규칙)은 dialect-agnostic, schema 정의와 SQL adapter만 dialect별 분리.

**연결 방식 차이**:

- **SQLite**: 파일 경로 기반 (`better-sqlite3`, file path 또는 `:memory:`). 포트 개념 없음
- **PostgreSQL**: TCP 포트 기반 (`postgres` driver, host:port + database name)

**의존 방향**:

```
business logic (pure)
       ↑
  ┌────┴────┐
  │ port    │ ← 인터페이스 계약 (ResourcePolicyRegistry 등)
  └────┬────┘
       │
  ┌────┴────────────────┐
  │ dialect adapters    │
  ├─────────────────────┤
  │ sqlite-adapter.ts   │ → file/:memory:
  │ pg-adapter.ts       │ → TCP host:port
  └─────────────────────┘
```

**런타임 선택**: `QA_DB_DIALECT=sqlite|pg` 환경 변수 + ServiceProfile에서 어댑터 결정. 호출 코드는 인터페이스만 의존.

**PG 인스턴스**:

- **신규 컨테이너** `qa-sdk-db: postgres:16-alpine` (zitadel-db와 독립)
- **호스트 포트 5434** (zitadel-db는 5433 그대로)
- 컨테이너 내부에 `qa_sdk` database 신규 생성
- domain별 schema (`auth`, `audit`, `ingest`, `decision`, `definition`)로 격리

**SERVICE_PORTS 추가** (drift fix 포함):

```ts
{ name: "zitadel-postgres",  defaultPort: 5433, description: "Zitadel 인증 DB (기존 docker-compose, drift fix)" },
{ name: "qa-sdk-postgres",   defaultPort: 5434, description: "qa-sdk 메인 PG 컨테이너" },
```

**lifecycle 격리 효과**:

- zitadel 업그레이드/재기동이 qa-sdk PG에 영향 없음
- qa-sdk PG의 백업/마이그레이션 독립
- PG superuser 권한 레벨 격리

---

## 2. 패키지 구조

`resource-policy-store` 예시 (dual-target 전환 후):

```
packages/resource-policy-store/
├── package.json              # peerDep으로 드라이버 선택
├── tsconfig.json
├── tsup.config.ts
└── src/
    ├── index.ts              # 공개 API
    ├── port.ts               # 인터페이스 계약 (또는 permission-engine re-export)
    ├── factory.ts            # dynamic import 분기
    ├── sqlite/
    │   ├── schema.ts         # sqliteTable + DDL
    │   ├── adapter.ts        # SQLite 전용 SQL (기존 drizzle-registry.ts)
    │   └── adapter.test.ts   # SQLite 어댑터 단위
    ├── pg/
    │   ├── schema.ts         # pgTable + DDL (auth schema)
    │   ├── adapter.ts        # PG 전용 SQL (RLS-aware, schema 한정)
    │   └── adapter.test.ts   # PG 어댑터 단위 (docker compose 의존)
    └── port-contract.test.ts # 양쪽 어댑터 동등성 검증
```

**peerDep 정책** — dialect-only 환경 지원:

```jsonc
"peerDependencies": {
  "better-sqlite3": "catalog:",
  "postgres": "^3.4.0"
},
"peerDependenciesMeta": {
  "better-sqlite3": { "optional": true },
  "postgres":       { "optional": true }
}
```

**factory.ts dynamic import** — 미설치 드라이버 로드 회피:

```ts
export async function createResourcePolicyRegistry(opts: { dialect: "sqlite" | "pg"; db: unknown }) {
  if (opts.dialect === "sqlite") {
    const { SqliteResourcePolicyRegistry } = await import("./sqlite/adapter.js");
    return new SqliteResourcePolicyRegistry(opts.db as BetterSQLite3Database);
  }
  const { PgResourcePolicyRegistry } = await import("./pg/adapter.js");
  return new PgResourcePolicyRegistry(opts.db as PostgresJsDatabase);
}
```

**효과**:

- 프로덕션 PG 컨테이너 → `--omit=optional`로 SQLite 드라이버 생략 가능
- 로컬 dev → `better-sqlite3` 설치, factory가 SQLite 어댑터만 로드
- 타입은 static import (zero runtime cost)

---

## 3. Schema 격리 — `qa_sdk` database 내부

**Database**: `qa_sdk` (단일)

**Schemas**:

| schema | 책임 도메인 | 첫 입주 테이블 |
|---|---|---|
| `auth` | 권한·정책·역할 | `resource_policies`, `roles`, `role_assignments`, `bitmap_versions` |
| `audit` | 감사·관측 | `audit_entries`, `decision_observations` |
| `ingest` | 이벤트 수집 | `event_records`, `key_observations`, `key_observation_prefixes` |
| `decision` | 결정 흐름 | `decision_instances`, `decision_evidence` |
| `definition` | 문서 카탈로그 | `def_docs`, `def_links`, `def_code_refs` |

**PG role 격리**:

```sql
-- 도메인별 application role
CREATE ROLE auth_app  WITH LOGIN PASSWORD '...';
CREATE ROLE audit_app WITH LOGIN PASSWORD '...';

-- schema-level GRANT
GRANT USAGE  ON SCHEMA auth  TO auth_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth  TO auth_app;
GRANT USAGE  ON SCHEMA audit TO audit_app;
GRANT SELECT, INSERT                ON ALL TABLES IN SCHEMA audit TO audit_app;  -- write-only-ish

-- cross-domain 분석 role (admin)
CREATE ROLE qa_admin WITH LOGIN PASSWORD '...';
GRANT USAGE ON SCHEMA auth, audit, ingest, decision, definition TO qa_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA auth, audit, ingest, decision, definition TO qa_admin;
```

**RLS 적용** (§3 RLS plan에서 확장):

- `auth.resource_policies`에 RLS 정책 — `current_setting('auth.user_id')` 기반
- `audit.audit_entries`는 PII risk → admin 외 read 차단

**Drizzle schema에서 schema 지정**:

```ts
import { pgSchema } from "drizzle-orm/pg-core";

const authSchema = pgSchema("auth");

export const resourcePolicies = authSchema.table("resource_policies", {
  resourceId: text("resource_id").primaryKey(),
});
```

**SQLite는 schema 개념 없음** → 모든 테이블 단일 스페이스. 충돌 회피 위해 dialect-portable에서는 PG schema에 해당하는 prefix를 SQLite 테이블명에 자동 매핑하지 않음. SQLite는 단순 평면 구조.

---

## 4. Test 전략 — 3 계층

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1 — port-contract.test.ts                             │
│ 같은 시나리오를 SQLite + PG 양쪽 어댑터에 적용              │
│ → interface 동등성 보장                                     │
├─────────────────────────────────────────────────────────────┤
│ Layer 2a — sqlite/adapter.test.ts                           │
│ SQLite 어댑터 단위 (SQLite-specific edge: WAL mode 등)      │
├─────────────────────────────────────────────────────────────┤
│ Layer 2b — pg/adapter.test.ts                               │
│ PG 어댑터 단위 (PG-specific: RLS, partial index, JSONB)     │
└─────────────────────────────────────────────────────────────┘
```

**port-contract.test.ts 구조**:

```ts
const fixtures: Array<[string, Fixture]> = [
  ["sqlite", createSqliteFixture()],
  ...(process.env.QA_TEST_PG === "1" ? [["pg", createPgFixture()] as const] : []),
];

describe.each(fixtures)("ResourcePolicyRegistry contract — %s", (_, fixture) => {
  // 모든 비즈니스 시나리오
});
```

**환경 변수 게이트**:

- `QA_TEST_PG=1` 있을 때만 PG fixture 활성화
- 로컬 dev에서 docker 없이도 SQLite 테스트는 통과
- CI는 docker compose up → `QA_TEST_PG=1 pnpm -r test`

**PG fixture 격리** (병렬 vitest 대응):

```ts
function createPgFixture(): Fixture {
  return {
    async setup() {
      const schemaName = `test_${randomBytes(4).toString("hex")}`;
      const sql = postgres(`postgres://qa_admin:...@localhost:5434/qa_sdk_test`);
      await sql`CREATE SCHEMA ${sql(schemaName)}`;
      const db = drizzle(sql, { schema: makeSchemaWithPrefix(schemaName) });
      const registry = new PgResourcePolicyRegistry(db);
      return {
        registry,
        async cleanup() {
          await sql`DROP SCHEMA ${sql(schemaName)} CASCADE`;
          await sql.end();
        },
      };
    },
  };
}
```

- 별도 `qa_sdk_test` DB 사용 (프로덕션 데이터 분리)
- 테스트별 random schema — 병렬 vitest 실행 격리

**Layer 2b PG-specific 테스트 예시**: RLS 정책 동작, partial index 쿼리 plan, JSONB GIN index

**Layer 2a SQLite-specific 예시**: `:memory:` round-trip, WAL mode, 단일 파일 file-based

---

## 5. Rollout — 15-plan 분해

**Plan 04 — 인프라 부트스트랩 (4 sub-plan)**:

| Plan | 책임 | 의존 |
|---|---|---|
| 04a | `docker-compose.infra.yaml`에 `qa-sdk-db` 컨테이너 + `init.sql` (qa_sdk DB + 5 schema + role 생성) | — |
| 04b | `SERVICE_PORTS`에 `zitadel-postgres:5433`, `qa-sdk-postgres:5434` 추가 (drift fix) | — |
| 04c | `packages/db-bootstrap/` 신규 패키지 (connection factory + pool + Drizzle Kit migration runner) | 04a + 04b |
| 04d | `infra-engine export env`에 PG env vars | 04b |

**Plan 05 — resource-policy-store dual-target (4 sub-plan)**:

| Plan | 책임 | 의존 |
|---|---|---|
| 05a | 디렉토리 재구성: `src/sqlite/` 이동 + 클래스 rename | — |
| 05b | `src/pg/schema.ts` + `src/pg/adapter.ts` (RLS 미적용 baseline) | 04c, 05a |
| 05c | `src/factory.ts` dynamic import + `src/port-contract.test.ts` | 05a, 05b |
| 05d | permission-engine e2e-integration.test.ts 회귀 + 호출자 migration | 05c |

**Plan 06 — audit-recorder-store dual-target (3 sub-plan)**:

| Plan | 책임 |
|---|---|
| 06a | 디렉토리 재구성 + sqlite rename |
| 06b | pg/schema + pg/adapter |
| 06c | factory + port-contract.test |

**Plan 07 — ingest-server stores dual-target (D1 포함)**:

| Plan | 책임 |
|---|---|
| 07a | D1 호환성 결정 — sqlite 어댑터 재사용 vs D1 전용 어댑터 분리 |
| 07b | `key_observations` PG 어댑터 (`ingest` schema) — §6 agent가 Plan 07b로 지정한 backlog 대상 |
| 07c | `event_records` PG 어댑터 |
| 07d | factory + contract test + ingest-server 호출자 migration |

**Plan 08 — 나머지 서비스 (선택적)**:

| Plan | 책임 |
|---|---|
| 08a | `definition-service` PG 어댑터 (필요 시) |
| 08b | `decision-service` PG 어댑터 (필요 시) |

**병렬 가능성**:

- 04a ⊥ 04b (병렬)
- 05x 시리즈와 06x 시리즈 동시 진행 가능 (서로 독립)
- 07x는 04 완료 후 시작
- 08x는 트리거 발생 시만

**dual-write 기간**:

- 권한 도메인(resource-policy, audit-recorder)은 dual-write 안 함 — 기존 SQLite 데이터가 운영 데이터 아니라 cutover 단순
- ingest(D1)는 별도 dual-write 전략 Plan 07a에서 결정

---

## 6. Tooling — Drizzle Kit, connection, env

**Drizzle Kit 마이그레이션** (dialect별 독립 시퀀스):

```
packages/resource-policy-store/
├── drizzle.sqlite.config.ts    # out: ./drizzle/sqlite
├── drizzle.pg.config.ts        # out: ./drizzle/pg
└── drizzle/
    ├── sqlite/0001_init.sql
    └── pg/0001_init.sql        # auth.resource_policies + RLS placeholder
```

각 dialect 독립 시퀀스. 두 시퀀스 sync는 schema 정의 레벨에서 책임 (`sqlite/schema.ts`, `pg/schema.ts`). per-package scripts: `pnpm db:gen:sqlite`, `pnpm db:gen:pg`.

**Connection 관리** (Plan 04c `db-bootstrap`):

```ts
export interface ConnectionConfig {
  dialect: "sqlite" | "pg";
  sqlitePath?: string;
  pgHost?: string; pgPort?: number;
  pgDatabase?: string; pgUser?: string; pgPassword?: string;
  pgSchema?: string;        // search_path 설정
  pgPoolMax?: number;       // 기본 10
}

export async function createConnection(cfg: ConnectionConfig) {
  if (cfg.dialect === "sqlite") {
    const raw = new Database(cfg.sqlitePath ?? ":memory:");
    return { dialect: "sqlite", db: drizzleSqlite({ client: raw }), close: () => raw.close() };
  }
  const sql = postgres({
    host: cfg.pgHost!, port: cfg.pgPort!, database: cfg.pgDatabase!,
    user: cfg.pgUser!, password: cfg.pgPassword!,
    max: cfg.pgPoolMax ?? 10,
    onnotice: () => {},
  });
  if (cfg.pgSchema) await sql`SET search_path TO ${sql(cfg.pgSchema)}, public`;
  return { dialect: "pg", db: drizzlePg(sql), close: () => sql.end() };
}
```

**Env 변수 스키마** (CLAUDE.md `config/env.ts` zod 패턴 준수):

```ts
export const dbEnvSchema = z.object({
  QA_DB_DIALECT: z.enum(["sqlite", "pg"]).default("sqlite"),
  QA_SQLITE_PATH: z.string().optional(),
  QA_PG_HOST: z.string().optional(),
  QA_PG_PORT: z.coerce.number().int().positive().optional(),
  QA_PG_DATABASE: z.string().optional(),
  QA_PG_USER: z.string().optional(),
  QA_PG_PASSWORD: z.string().optional(),
  QA_PG_SCHEMA: z.string().optional(),
});
```

**`infra-engine export env` 자동 주입 vars** (Plan 04d):

```bash
QA_PG_HOST=localhost
QA_PG_PORT=5434
QA_PG_DATABASE=qa_sdk
QA_PG_USER=qa_admin
QA_PG_PASSWORD=<from sops>
```

서비스별 `QA_DB_DIALECT` + `QA_PG_SCHEMA`는 service-profile.json에서 결정 (예: `auth-service`는 `pg + auth schema`).

**테스트 fixture 헬퍼** (db-bootstrap 포함):

```ts
export async function createSqliteTestFixture(ddl: string) { /* :memory: + DDL */ }
export async function createPgTestFixture(ddl: string) {
  const schemaName = `test_${randomBytes(4).toString("hex")}`;
  // qa_sdk_test DB에 격리 schema 생성
}
```

각 store 패키지의 `port-contract.test.ts`가 위 헬퍼 사용.

**RLS 활성화 시점**:

- Plan 06 시점에 PG schema에 RLS placeholder만 (정책 미정의, RLS disabled)
- Phase 3 RLS plan에서 actual policies + helper functions + `FORCE ROW LEVEL SECURITY`

---

## 7. 후속 plan 작성 순서

본 디자인 확정 후 `writing-plans` skill로 plan 파일 작성. 우선 순위:

1. **Plan 04** (인프라 부트스트랩) — 다음 5개 plan의 전제. 4 sub-plan 순차/병렬 작성
2. **Plan 05** (resource-policy-store) — 권한 도메인 첫 입주, 패턴 확립
3. **Plan 06** (audit-recorder-store) — Plan 05 패턴 복제
4. **Plan 07** (ingest-server) — D1 호환성 별도 결정 필요, Plan 07a에서 다룸
5. **Plan 08** (나머지) — 트리거 발생 시만

각 plan은 `docs/proposals/auth-model-implementation-backlog/plans/` 경로에 번호 접두 파일명으로 저장 (예: `04a-pg-container-bootstrap.md`).

---

## 8. 용어·결정 요약

| 용어 | 의미 |
|---|---|
| **Dual-target** | 한 store가 SQLite + PG 양쪽 어댑터 제공, factory가 runtime 분기 |
| **Dialect-portable** | 비즈니스 로직은 dialect 무관, schema/adapter만 분리 |
| **Port** | 인터페이스 계약 (`ResourcePolicyRegistry` 같은 TS interface) |
| **Adapter** | dialect별 port 구현 (`SqliteResourcePolicyRegistry`, `PgResourcePolicyRegistry`) |
| **Factory** | dialect+연결 받아 adapter 인스턴스화하는 함수 |
| **port-contract.test** | 양쪽 adapter에 동일 시나리오 적용해 동등성 검증 |

**핵심 결정 (재협상 없이 따를 것)**:

- 단일 PG 컨테이너 `qa-sdk-db` (zitadel과 독립, 포트 5434)
- 단일 `qa_sdk` database + 5개 domain schema
- peerDep optional 드라이버 (dialect-only 환경 지원)
- `QA_DB_DIALECT` 환경 변수 기반 runtime 분기
- Plan 04 인프라 먼저, 권한 도메인(05/06) → ingest(07) → 나머지(08)
- RLS는 Plan 06 시점 placeholder, Phase 3에서 본격 활성화
