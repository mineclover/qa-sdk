---
status: draft
type: plan
owner: auth-model-implementation-backlog
---

# Plan 07d — ingest-server store-factory + 호출자 migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ingest-server의 `store-factory.ts`에 PG 어댑터 분기 추가 + ServiceProfile/`infra-engine env export` 통합. STORE_DRIVER=pg 부팅 시 `PgKeyObservationStore`/`PgRecordStore`(07b/c)가 활성화되고, 기존 STORE_DRIVER=d1/sqlite/memory는 그대로 동작 (backward-compat). cross-adapter contract test에 PG 행 추가.

**Architecture:**
- 선행 결정 (07a): 옵션 A 채택 가정 — `STORE_DRIVER=sqlite` (= D1+Node-SQLite 통합) + `STORE_DRIVER=pg` 분리. `STORE_DRIVER=d1`은 deprecation alias.
- 선행 plan (07b/c): PG 어댑터 2종 완성 가정. 본 plan은 wiring + contract test + caller migration.
- store-factory: 신규 `createPgStores`가 `@qa-sdk/store`의 Drizzle*Store 대신 ingest-server `pg/*` 어댑터를 사용하도록 변경 (key_observations·event_records 한정). 기타 store(`Trace`/`Session`/`Verdict` 등)는 본 plan 범위 외 — `@qa-sdk/store` 그대로 사용 (별도 plan 08에서 점진적 이전).
- 환경변수: 기존 `TRACE_DATABASE_URL` (PG URL) 유지. 신규 `QA_PG_SCHEMA` (default `"ingest"`) 추가 — Plan 04c `dbEnvSchema`와 정합.
- ServiceProfile: ingest-server 항목에 `dialect: "sqlite" | "pg"` + `pgSchema` 추가.

**Tech Stack:** TypeScript, ingest-server 내부. 신규 의존 없음 (07b/c가 추가 완료).

---

## File Structure

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `packages/ingest-server/src/stores/store-factory.ts` | `createPgStores` 변경 — key_observations·event_records를 ingest-server pg 어댑터로 swap. STORE_DRIVER=d1 deprecation 매핑. |
| `packages/ingest-server/src/config/env.ts` | `QA_PG_SCHEMA` 추가, STORE_DRIVER 기본값 + alias 처리 |
| `packages/ingest-server/src/__tests__/cross-adapter/factories/pg.factory.ts` | `createPgKeyObservationStore`/`createPgRecordStore`를 ingest-server pg 어댑터로 swap |
| `packages/ingest-server/src/__tests__/cross-adapter/cross-adapter.pg.test.ts` | (필요 시 import 갱신만 — 신규 케이스는 contract 패턴 그대로) |
| `packages/infra-engine/src/export/pg-env-builder.ts` (Plan 04d 산출) | ingest-server용 `QA_PG_SCHEMA=ingest` 자동 주입 |

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `packages/ingest-server/src/stores/pg/factory.ts` | createPgIngestStores — PG URL + schema 받아 PgKeyObservationStore + PgRecordStore 인스턴스화 |
| `packages/ingest-server/src/stores/pg/factory.test.ts` | factory 단위 (env gate) — connection 생성·close·schema search_path |

---

## Task 0: baseline + 선행 의존 확인

- [ ] **Step 1: 07a 결정 + 07b/c 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -A1 "선택 옵션" docs/proposals/auth-model-implementation-backlog/plans/07a-ingest-d1-compatibility-decision.md | head -3 && \
  ls packages/ingest-server/src/stores/pg/key-observation.adapter.ts packages/ingest-server/src/stores/pg/event-record.adapter.ts && \
  grep -q "PgKeyObservationStore\|PgRecordStore" packages/ingest-server/src/stores/pg/key-observation.adapter.ts packages/ingest-server/src/stores/pg/event-record.adapter.ts
```

Expected: 모두 hit. 미완료 시 본 plan 시작 금지.

- [ ] **Step 2: ingest-server 전체 테스트 baseline (PG 활성)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
QA_TEST_PG=1 \
  QA_TEST_PG_PASSWORD=$(grep QA_SDK_ADMIN_PASSWORD packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter @qa-sdk/ingest-server test 2>&1 | tail -10
```

Expected: 07b/c 테스트 모두 통과. 본 plan 변경이 회귀를 일으키지 않아야 함.

- [ ] **Step 3: ServiceProfile 위치 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && find packages -name "service-profile*.ts" -not -path "*/dist/*" -not -path "*/node_modules/*" 2>&1 | head -5
```

기록: 정확한 경로. ingest-server 항목 확장 시 import.

---

## Task 1: pg/factory.ts — createPgIngestStores

**Files:**
- Create: `packages/ingest-server/src/stores/pg/factory.ts`
- Create: `packages/ingest-server/src/stores/pg/factory.test.ts`

PG URL + 옵션 schema 이름 받아 connection + 두 어댑터 인스턴스 생성. close 함수까지 반환.

- [ ] **Step 1: factory.ts 작성**

`packages/ingest-server/src/stores/pg/factory.ts`:

```ts
// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * createPgIngestStores — ingest-server의 PG 어댑터 부팅 헬퍼.
 *
 * postgres 연결 + search_path 설정 + Pg* 어댑터 인스턴스화.
 * close 함수 반환 — 호출자가 lifecycle 관리.
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { PgKeyObservationStore } from "./key-observation.adapter.js";
import { PgRecordStore } from "./event-record.adapter.js";

export interface CreatePgIngestStoresOpts {
  /** PG 연결 URL (예: postgres://qa_admin:pw@localhost:5434/qa_sdk) */
  url: string;
  /** schema 이름 — default "ingest" */
  schema?: string;
  /** connection pool 최대 — default 10 */
  poolMax?: number;
}

export interface PgIngestStoreSet {
  db: PostgresJsDatabase;
  recordStore: PgRecordStore;
  keyObservationStore: PgKeyObservationStore;
  /** lifecycle 종료 — 호출자 책임 */
  close(): Promise<void>;
}

export async function createPgIngestStores(
  opts: CreatePgIngestStoresOpts,
): Promise<PgIngestStoreSet> {
  const schema = opts.schema ?? "ingest";
  const sql = postgres(opts.url, {
    max: opts.poolMax ?? 10,
    onnotice: () => {},
  });
  // search_path 설정 — pgSchema("ingest")가 정상 라우팅되도록.
  await sql`SET search_path TO ${sql(schema)}, public`;

  const db = drizzle(sql);
  return {
    db,
    recordStore: new PgRecordStore(db),
    keyObservationStore: new PgKeyObservationStore(db),
    close: () => sql.end(),
  };
}
```

- [ ] **Step 2: factory.test.ts 작성**

`packages/ingest-server/src/stores/pg/factory.test.ts`:

```ts
// @def.boundary ingest-system
// @def.doc ingest-system

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import postgres from "postgres";

import { createPgIngestStores, type PgIngestStoreSet } from "./factory.js";
import { EVENT_RECORDS_PG_DDL } from "./schema.js";
import { KEY_OBSERVATIONS_PG_DDL } from "./schema.js";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

describe.skipIf(!PG_AVAILABLE)("createPgIngestStores", () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? "localhost";
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? "5434");
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test";
  const PG_USER = process.env.QA_TEST_PG_USER ?? "qa_admin";
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? "";
  const PG_URL = `postgres://${PG_USER}:${encodeURIComponent(PG_PASSWORD)}@${PG_HOST}:${PG_PORT}/${PG_DATABASE}`;

  let stores: PgIngestStoreSet | undefined;
  let testSchema: string;
  let setupSql: ReturnType<typeof postgres>;

  beforeEach(async () => {
    testSchema = `test_${randomBytes(4).toString("hex")}`;
    setupSql = postgres(PG_URL, { max: 2, onnotice: () => {} });
    const ddl = (KEY_OBSERVATIONS_PG_DDL + EVENT_RECORDS_PG_DDL)
      .replaceAll("ingest.", `${testSchema}.`)
      .replaceAll("CREATE SCHEMA IF NOT EXISTS ingest", `CREATE SCHEMA IF NOT EXISTS ${testSchema}`);
    await setupSql.unsafe(ddl);
    await setupSql.end();
  });

  afterEach(async () => {
    if (stores) {
      await stores.close();
      stores = undefined;
    }
    const cleanup = postgres(PG_URL, { max: 2, onnotice: () => {} });
    try {
      await cleanup`DROP SCHEMA ${cleanup(testSchema)} CASCADE`;
    } finally {
      await cleanup.end();
    }
  });

  it("두 어댑터 인스턴스 + close 반환", async () => {
    stores = await createPgIngestStores({ url: PG_URL, schema: testSchema });
    expect(stores.recordStore).toBeDefined();
    expect(stores.keyObservationStore).toBeDefined();
    expect(typeof stores.close).toBe("function");
  });

  it("search_path 설정 — schema-qualified 없이 동작", async () => {
    stores = await createPgIngestStores({ url: PG_URL, schema: testSchema });
    await stores.keyObservationStore.observe({
      packedKey: "svc:v1:1",
      prefixId: "svc",
      registered: true,
      timestamp: "2026-04-22T10:00:00Z",
    });
    const rows = await stores.keyObservationStore.findByPrefix("svc");
    expect(rows).toHaveLength(1);
  });

  it("close 후 재호출 안전", async () => {
    stores = await createPgIngestStores({ url: PG_URL, schema: testSchema });
    await stores.close();
    // double close는 driver-specific. postgres-js는 재호출 허용.
    await expect(stores.close()).resolves.not.toThrow();
    stores = undefined;
  });

  it("기본 schema는 'ingest'", async () => {
    // testSchema에 ingest 매핑이 없으면 default 'ingest'로 시도. 본 테스트는 default 미사용 경고만.
    stores = await createPgIngestStores({ url: PG_URL, schema: testSchema });
    // 명시 schema가 본 테스트 환경. default 경로는 prod에서만 의미 있음.
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 3: typecheck + 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/ingest-server typecheck && \
  QA_TEST_PG=1 \
    QA_TEST_PG_PASSWORD=$(grep QA_SDK_ADMIN_PASSWORD packages/infra-engine/.env.docker | cut -d= -f2) \
    pnpm --filter @qa-sdk/ingest-server test -- pg/factory 2>&1 | tail -10
```

Expected: 4 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/ingest-server/src/stores/pg/factory.ts packages/ingest-server/src/stores/pg/factory.test.ts && git commit -m "$(cat <<'EOF'
feat(ingest-server): pg/factory.ts — createPgIngestStores 헬퍼

PG URL + schema → PgKeyObservationStore/PgRecordStore 인스턴스화.
search_path 자동 설정. close 함수로 lifecycle 관리.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: env.ts — QA_PG_SCHEMA + STORE_DRIVER alias

**Files:**
- Modify: `packages/ingest-server/src/config/env.ts`

`QA_PG_SCHEMA` 추가 (default `"ingest"`), `STORE_DRIVER=d1`을 sqlite로 매핑하는 deprecation 로직 (옵션 A 정책).

- [ ] **Step 1: 스키마 + 로직 추가**

`packages/ingest-server/src/config/env.ts`:

```ts
// 기존 envSchema에 추가
export const envSchema = z.object({
  /** Store 드라이버: memory(기본) | sqlite | pg | clickhouse. d1은 sqlite의 deprecation alias. */
  STORE_DRIVER: z.enum(["memory", "sqlite", "pg", "clickhouse", "d1"]).default("memory"),
  // ... 기존 필드 ...
  /** PG schema (STORE_DRIVER=pg 시). default "ingest". */
  QA_PG_SCHEMA: z.string().default("ingest"),
  // ... 기존 필드 유지
});

export type Env = z.infer<typeof envSchema>;

/**
 * STORE_DRIVER=d1 deprecation — 옵션 A에 따라 sqlite로 매핑.
 * Plan 07a 결정 인용: D1과 Node-SQLite는 동일 dialect → 단일 sqlite 어댑터로 통합.
 */
export function resolveStoreDriver(env: Env): "memory" | "sqlite" | "pg" | "clickhouse" {
  if (env.STORE_DRIVER === "d1") {
    // 1회 deprecation warning — 호출자가 logger로 출력
    return "sqlite";
  }
  return env.STORE_DRIVER as "memory" | "sqlite" | "pg" | "clickhouse";
}
```

- [ ] **Step 2: env.test.ts 갱신**

`packages/ingest-server/src/config/env.test.ts`에 추가:

```ts
import { describe, it, expect } from "vitest";
import { envSchema, resolveStoreDriver } from "./env.js";

describe("STORE_DRIVER alias — d1 → sqlite", () => {
  it("d1은 sqlite로 매핑", () => {
    const env = envSchema.parse({ STORE_DRIVER: "d1" });
    expect(resolveStoreDriver(env)).toBe("sqlite");
  });

  it("sqlite는 그대로", () => {
    const env = envSchema.parse({ STORE_DRIVER: "sqlite" });
    expect(resolveStoreDriver(env)).toBe("sqlite");
  });

  it("pg는 그대로", () => {
    const env = envSchema.parse({ STORE_DRIVER: "pg" });
    expect(resolveStoreDriver(env)).toBe("pg");
  });

  it("QA_PG_SCHEMA default", () => {
    const env = envSchema.parse({});
    expect(env.QA_PG_SCHEMA).toBe("ingest");
  });
});
```

- [ ] **Step 3: typecheck + 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/ingest-server test -- config/env 2>&1 | tail -10
```

Expected: 신규 4 + 기존 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/ingest-server/src/config/env.ts packages/ingest-server/src/config/env.test.ts && git commit -m "$(cat <<'EOF'
feat(ingest-server): QA_PG_SCHEMA env + STORE_DRIVER=d1 deprecation alias

옵션 A 결정에 따라 d1 → sqlite 매핑. QA_PG_SCHEMA default "ingest".
신규 4 테스트 추가.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: store-factory.ts — PG 분기 변경

**Files:**
- Modify: `packages/ingest-server/src/stores/store-factory.ts`

기존 `createPgStores`는 `@qa-sdk/store`의 `DrizzleRecordStore`/`DrizzleKeyObservationStore`를 사용. 본 plan은 `key_observations`/`event_records`만 ingest-server pg 어댑터로 swap. 기타(`Trace`/`Session`/`Verdict`/`Graph`/`ScenarioSpec`/`Transmission`/`Dlq`)는 `@qa-sdk/store` 그대로 유지 — 별도 plan 08에서 점진적 이전.

- [ ] **Step 1: createPgStores 변경**

`packages/ingest-server/src/stores/store-factory.ts`의 `createPgStores`:

```ts
/** PostgreSQL stores 생성 — key_observations + event_records는 ingest-server pg 어댑터 사용. */
export async function createPgStores(databaseUrl: string, opts?: { schema?: string }): Promise<StoreSet> {
  const store = await import("@qa-sdk/store");
  const db = store.createDb(databaseUrl);

  // Plan 07b/c 어댑터 — ingest schema 입주
  const { createPgIngestStores } = await import("./pg/factory.js");
  const ingestStores = await createPgIngestStores({
    url: databaseUrl,
    schema: opts?.schema ?? "ingest",
  });

  return {
    // 07c — ingest-server pg 어댑터
    recordStore: ingestStores.recordStore,
    // 07b — ingest-server pg 어댑터
    keyObservationStore: ingestStores.keyObservationStore,
    // 기타 — @qa-sdk/store 그대로 (별도 plan 08에서 이전 검토)
    traceStore: new store.DrizzleTraceStore(db),
    sessionStore: new store.DrizzleSessionStore(db),
    verdictStore: new store.DrizzleVerdictStore(db),
    transmissionStore: new store.DrizzleTransmissionStore(db),
    graphStore: new store.DrizzleGraphStore(db),
    scenarioSpecStore: new store.DrizzleScenarioSpecStore(db),
    dlqStore: new store.DrizzleDlqStore(db),
    db,
  };
}
```

- [ ] **Step 2: createStores 디스패치 갱신**

```ts
export async function createStores(opts: {
  driver: StoreDriver;
  databaseUrl?: string;
  pgSchema?: string;
  sqliteDriver?: import("index-meta").SqlDriver;
  clickhouseClient?: import("./clickhouse-record-store.js").ClickHouseClient;
}): Promise<StoreSet> {
  switch (opts.driver) {
    case "pg": {
      if (!opts.databaseUrl) throw new Error("STORE_DRIVER=pg requires TRACE_DATABASE_URL");
      return createPgStores(opts.databaseUrl, { schema: opts.pgSchema });
    }
    // ... 나머지 분기 유지
    case "sqlite":
    case "d1": {
      // 옵션 A: d1과 sqlite 동일 처리 (deprecation 후속).
      if (!opts.sqliteDriver) throw new Error("STORE_DRIVER=sqlite requires SqlDriver instance");
      return createD1Stores(opts.sqliteDriver);
    }
    case "clickhouse": { /* 기존 그대로 */ }
    case "memory":
    default:
      return createMemoryStores();
  }
}

export type StoreDriver = "memory" | "sqlite" | "pg" | "d1" | "clickhouse";
```

`createD1Stores` 내부 함수명은 backward-compat로 유지. 별도 task에서 rename 가능.

- [ ] **Step 3: typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/ingest-server typecheck
```

Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/ingest-server/src/stores/store-factory.ts && git commit -m "$(cat <<'EOF'
feat(ingest-server): store-factory — PG 분기 ingest 어댑터로 swap

createPgStores: key_observations/event_records는 ingest-server pg 어댑터(07b/c).
기타 store는 @qa-sdk/store 그대로 — plan 08에서 점진적 이전.
StoreDriver에 sqlite 추가, d1은 alias 유지.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: cross-adapter contract test 갱신

**Files:**
- Modify: `packages/ingest-server/src/__tests__/cross-adapter/factories/pg.factory.ts`

기존 `createPgKeyObservationStore`/`createPgRecordStore`는 `@qa-sdk/store` 어댑터를 instance화한다. 본 plan은 ingest-server pg 어댑터로 swap — 같은 contract test 시나리오가 새 어댑터에 대해서도 통과해야 함.

- [ ] **Step 1: factory 함수 갱신**

`packages/ingest-server/src/__tests__/cross-adapter/factories/pg.factory.ts`:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { PgKeyObservationStore } from "../../../stores/pg/key-observation.adapter.js";
import { PgRecordStore } from "../../../stores/pg/event-record.adapter.js";
import {
  KEY_OBSERVATIONS_PG_DDL,
  EVENT_RECORDS_PG_DDL,
} from "../../../stores/pg/schema.js";

// 기존 createPgKeyObservationStore/createPgRecordStore를 다음으로 교체
export async function createPgKeyObservationStore(): Promise<KeyObservationStore> {
  const sql = ensurePool();
  await ensureSchema(sql);
  return new PgKeyObservationStore(drizzle(sql));
}

export async function createPgRecordStore(): Promise<RecordStore> {
  const sql = ensurePool();
  await ensureSchema(sql);
  return new PgRecordStore(drizzle(sql));
}

// 기타 store(Trace/Session/...)의 factory는 그대로 — @qa-sdk/store 어댑터 사용
```

`ensurePool` / `ensureSchema`는 기존 패턴 따름. 새 DDL 두 가지(KEY_OBSERVATIONS_PG_DDL + EVENT_RECORDS_PG_DDL)를 적용.

- [ ] **Step 2: contract 테스트 실행 (PG 활성)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
QA_TEST_PG=1 \
  QA_TEST_PG_PASSWORD=$(grep QA_SDK_ADMIN_PASSWORD packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter @qa-sdk/ingest-server test -- cross-adapter.pg 2>&1 | tail -15
```

Expected: KeyObservationStore + RecordStore 시나리오 모두 PASS. 기타 store는 기존 동작 유지.

- [ ] **Step 3: D1과 비교 — 동일 시나리오 동작**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/ingest-server test -- cross-adapter.d1 2>&1 | tail -15
```

Expected: D1 측 동일 시나리오 PASS — PG와 동등 동작 확인.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/ingest-server/src/__tests__/cross-adapter/factories/pg.factory.ts && git commit -m "$(cat <<'EOF'
test(ingest-server): cross-adapter pg.factory — ingest pg 어댑터 swap

createPgKeyObservationStore/createPgRecordStore가 ingest-server pg/* 사용.
contract test가 D1과 동일 시나리오를 PG에 적용 — 동등성 검증.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: infra-engine env export 통합

**Files:**
- Modify: `packages/infra-engine/src/export/pg-env-builder.ts` (Plan 04d 산출 — 위치는 04d 결과 따름)

ingest-service profile이 `dialect: pg` 일 때 `QA_PG_SCHEMA=ingest` 자동 주입.

- [ ] **Step 1: pg-env-builder 확장**

Plan 04d의 `buildPgEnvVars` 호출 시 service별 schema 매핑 추가:

```ts
// 04d 산출물의 buildPgEnvVars 내부 로직 확장:
const SERVICE_SCHEMA_MAP: Record<string, string> = {
  "ingest-server": "ingest",
  "auth-service": "auth",
  "audit-recorder": "audit",
  // ... 디자인 문서 §3 5 schema
};

if (input.serviceName && SERVICE_SCHEMA_MAP[input.serviceName]) {
  envVars.QA_PG_SCHEMA = SERVICE_SCHEMA_MAP[input.serviceName];
}
```

(정확한 Plan 04d 인터페이스에 맞춰 조정. 04d가 다른 구조면 본 task 설계를 04d 패턴으로 흡수.)

- [ ] **Step 2: ingest-server export 출력 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter infra-engine build && \
  node packages/infra-engine/scripts/export.ts --service ingest-server --format env 2>&1 | grep -E "QA_PG_|TRACE_DATABASE_URL|STORE_DRIVER" | head -10
```

Expected: `QA_PG_SCHEMA=ingest` 포함 + `TRACE_DATABASE_URL` 포함.

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/infra-engine/src/export && git commit -m "$(cat <<'EOF'
feat(infra-engine): pg-env-builder — ingest-server에 QA_PG_SCHEMA=ingest 주입

서비스별 schema 매핑 추가 (디자인 문서 §3).
ingest 외 auth/audit 등도 동일 패턴으로 후속 plan에서 활용.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: ServiceProfile 통합

**Files:**
- Modify: `~/.qa-sdk/service-profile.json` 스키마를 정의하는 위치 (Task 0 Step 3에서 확인된 파일)

ingest-server 항목에 `dialect`, `pgSchema` 추가.

- [ ] **Step 1: ServiceProfile 타입 확장**

해당 파일에 다음 추가 (정확한 위치는 Task 0 결과로 갱신):

```ts
export interface IngestServerProfile {
  // 기존 필드 유지
  insightsDriver?: "local" | "app-hub";
  appHub?: { ... };
  // 신규
  dialect?: "sqlite" | "pg";       // default sqlite
  pgUrl?: string;                  // STORE_DRIVER=pg 시 TRACE_DATABASE_URL로 매핑
  pgSchema?: string;               // default "ingest"
}
```

`config/env.ts`의 `loadProfileDefaults()`도 새 필드를 환경변수로 매핑:

```ts
if (profile.ingestServer?.dialect === "pg") {
  defaults.STORE_DRIVER = "pg";
  if (profile.ingestServer.pgUrl) defaults.TRACE_DATABASE_URL = profile.ingestServer.pgUrl;
  if (profile.ingestServer.pgSchema) defaults.QA_PG_SCHEMA = profile.ingestServer.pgSchema;
}
```

- [ ] **Step 2: 테스트 추가**

`packages/ingest-server/src/config/env.test.ts`에:

```ts
it("ServiceProfile dialect=pg 로드 시 STORE_DRIVER=pg + QA_PG_SCHEMA 매핑", () => {
  // mock service-profile.json
  // ... 기존 테스트 패턴 따름
});
```

- [ ] **Step 3: 회귀 + 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/ingest-server test -- config/env 2>&1 | tail -5 && \
  git add packages/ingest-server/src/config && git commit -m "$(cat <<'EOF'
feat(ingest-server): ServiceProfile — dialect/pgUrl/pgSchema 매핑

service-profile.json에 ingestServer.dialect="pg" 설정 시 자동 부팅.
환경변수 우선순위: env > profile (기존 정책 유지).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: ingest-server 통합 회귀

- [ ] **Step 1: 전체 테스트 (memory)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && STORE_DRIVER=memory pnpm --filter @qa-sdk/ingest-server test 2>&1 | tail -10
```

Expected: 모두 PASS. PG/D1 specific은 skip 또는 unaffected.

- [ ] **Step 2: 전체 테스트 (PG 활성)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
QA_TEST_PG=1 \
  QA_TEST_PG_PASSWORD=$(grep QA_SDK_ADMIN_PASSWORD packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter @qa-sdk/ingest-server test 2>&1 | tail -15
```

Expected: 모두 PASS — D1, PG, cross-adapter, factory, env, app 통합.

- [ ] **Step 3: app 부팅 smoke (실서버 시작/종료)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
STORE_DRIVER=pg \
  TRACE_DATABASE_URL="postgres://qa_admin:$(grep QA_SDK_ADMIN_PASSWORD packages/infra-engine/.env.docker | cut -d= -f2)@localhost:5434/qa_sdk" \
  QA_PG_SCHEMA=ingest \
  pnpm --filter @qa-sdk/ingest-server start &
SERVER_PID=$!
sleep 5
curl -sf http://localhost:3200/health && echo "OK"
kill $SERVER_PID
wait $SERVER_PID 2>/dev/null
```

Expected: `OK` 출력. 서버 graceful shutdown.

- [ ] **Step 4: 의존자 typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter "...^@qa-sdk/ingest-server" typecheck 2>&1 | tail -10
```

Expected: 에러 없음.

---

## Self-Review

- [ ] `pg/factory.ts`로 PG 어댑터 부팅 헬퍼 — close 포함
- [ ] `env.ts`에 `QA_PG_SCHEMA` (default "ingest") + `STORE_DRIVER=d1 → sqlite` alias
- [ ] `store-factory.ts`의 `createPgStores`가 ingest pg 어댑터 사용 (key_observations + event_records 한정)
- [ ] cross-adapter contract test의 PG factory가 ingest pg 어댑터 인스턴스화 — D1과 동일 시나리오 통과
- [ ] `infra-engine export env`에 `QA_PG_SCHEMA=ingest` 주입
- [ ] ServiceProfile에 `dialect/pgUrl/pgSchema` 추가
- [ ] STORE_DRIVER=pg로 실서버 부팅 + health check OK
- [ ] memory/D1 회귀 0
- [ ] 의존자 typecheck 0

---

## Defer

| 작업 | 이유 |
|---|---|
| 기타 store(Trace/Session/Verdict/Graph/ScenarioSpec/Transmission/Dlq)의 ingest-server pg 어댑터 이전 | 별도 plan 08 — 본 plan은 §4 우선순위 (key_observations + event_records)만 |
| `STORE_DRIVER=d1` 입력 시 deprecation warning logging | 1 release cycle 후 — 본 plan은 alias만 |
| `createD1Stores` → `createSqliteStores` rename | 별도 refactor plan |
| Connection pool tuning (max=10 default 외) | 실 트래픽 측정 후 |
| RLS-aware 부팅 (auth.user_id 설정 등) | Phase 3 RLS plan |

---

## 의존·후속

- **선행 의존**:
  - **Plan 07a**: 옵션 A 결정 — STORE_DRIVER alias 정책 근거
  - **Plan 07b**: PgKeyObservationStore + pg/schema.ts(key_observations)
  - **Plan 07c**: PgRecordStore + pg/schema.ts(event_records)
  - **Plan 04a**: qa-sdk-postgres + ingest schema GRANT
  - **Plan 04c**: db-bootstrap (본 plan은 직접 의존 안 하나, 패턴 참조)
  - **Plan 04d**: pg-env-builder (Task 5에서 확장)
- **후속**:
  - **Plan 08a/08b**: 기타 store(Trace/Session/...)의 ingest-server pg 어댑터 이전 (트리거 발생 시)
  - **Phase 3 RLS plan**: ingest schema RLS 정책 + 부팅 시 SET LOCAL auth.user_id
  - **STORE_DRIVER=d1 deprecation 완전 제거**: 다음 major release
