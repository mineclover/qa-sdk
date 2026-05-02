---
status: draft
type: plan
owner: auth-model-implementation-backlog
---

# Plan 07c — ingest event_records PG schema + adapter

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ingest-server의 `src/stores/pg/`에 `event_records` PG 테이블 정의 + `PgRecordStore` 어댑터 구현. D1 어댑터(`d1-record-store.ts`)와 동등 동작 — `RecordStore` 인터페이스(`packages/core/src/ports/record-store.port.ts`) 충족. `address_context` JSON 컬럼은 `AddressContextV1Schema` 검증을 PG에서도 동작 보장.

**Architecture:**
- 선행 결정 (07a): 옵션 A 채택 가정. 옵션 변경 시 본 plan File Structure 갱신.
- 선행 plan (07b): `pg/schema.ts`는 이미 생성 — 본 plan은 같은 파일에 `eventRecords` 테이블 추가 또는 별도 `pg/event-records.schema.ts`로 분리. **결정**: 단일 `pg/schema.ts`에 통합 (ingest schema 전체가 한 파일).
- `src/stores/pg/event-record.adapter.ts` — `PgRecordStore implements RecordStore`
- `src/stores/pg/event-record.adapter.test.ts` — PG-specific (env gate)
- `address_context` 컬럼은 jsonb (PG 네이티브) — D1은 TEXT JSON. 양쪽 모두 `AddressContextV1Schema`로 emit 시점 검증 (§4 P2).

**Tech Stack:** drizzle-orm/postgres-js + postgres ^3.4.0 (07b에서 이미 추가). qa-sdk-postgres:5434.

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `packages/ingest-server/src/stores/pg/event-record.adapter.ts` | `PgRecordStore` |
| `packages/ingest-server/src/stores/pg/event-record.adapter.test.ts` | PG-specific 단위 (env gate) |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `packages/ingest-server/src/stores/pg/schema.ts` | `eventRecords` 테이블 + `EVENT_RECORDS_PG_DDL` 추가 (07b 파일 확장) |

---

## Task 0: baseline + 선행 의존 확인

- [ ] **Step 1: Plan 07a 결정 + 07b 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -A1 "선택 옵션" docs/proposals/auth-model-implementation-backlog/plans/07a-ingest-d1-compatibility-decision.md | head -3 && \
  ls packages/ingest-server/src/stores/pg/key-observation.adapter.ts && \
  grep -q "PgKeyObservationStore" packages/ingest-server/src/stores/pg/key-observation.adapter.ts
```

Expected: 옵션 결정됨 + 07b 파일 존재 + 클래스 정의 hit. 미완료 시 본 plan 시작 금지.

- [ ] **Step 2: qa-sdk-db 부팅**

```bash
cd /Users/junwoobang/workflow/qa-sdk && docker compose -f packages/infra-engine/docker-compose.infra.yaml ps qa-sdk-db 2>&1 | grep -E "healthy|running" | head -1
```

Expected: running. 미부팅 시 `docker compose -f packages/infra-engine/docker-compose.infra.yaml up -d qa-sdk-db && sleep 10`.

- [ ] **Step 3: D1 record-store 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/ingest-server test -- d1-record-store 2>&1 | tail -5
```

Expected: PASS. 본 plan PG 어댑터가 동일 시나리오 충족해야 한다.

- [ ] **Step 4: AddressContextV1Schema 위치 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep -rn "AddressContextV1Schema" packages/core/src/coordinates/ 2>&1 | head -5
```

Expected: `address-context-schema.ts`에 존재. 본 plan 어댑터에서 재사용.

---

## Task 1: pg/schema.ts — eventRecords 추가

**Files:**
- Modify: `packages/ingest-server/src/stores/pg/schema.ts`

기존 `key_observations` 정의 아래에 `eventRecords` 추가. 같은 `ingestSchema`(`pgSchema("ingest")`) 사용.

- [ ] **Step 1: schema.ts 확장**

`packages/ingest-server/src/stores/pg/schema.ts`에 추가:

```ts
import {
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";

// (기존 ingestSchema, keyObservations, keyObservationPrefixes 정의 유지)

/**
 * ingest.event_records — RecordStore의 PG 구현 대상.
 *
 * D1 schema(`packages/ingest-server/src/db/schema.ts` eventRecords)와 동일 컬럼.
 * dialect 차이:
 *   - boolean payload_masking_applied: PG native (D1은 INTEGER 0/1)
 *   - jsonb 컬럼: payload, address_context, user_attributes, payload_masked_fields
 *     (D1은 모두 TEXT JSON)
 *   - timestamp 필드는 ISO-8601 text 유지 — ingest 핫패스 호환성
 */
export const eventRecords = ingestSchema.table(
  "event_records",
  {
    logId: text("log_id").primaryKey(),
    traceId: text("trace_id").notNull(),
    spanId: text("span_id").notNull(),
    parentSpanId: text("parent_span_id"),
    timestamp: text("timestamp").notNull(),
    recordKind: text("record_kind").notNull(),
    eventKey: text("event_key").notNull(),
    eventVersion: text("event_version").notNull(),
    spanName: text("span_name"),
    startTime: text("start_time"),
    endTime: text("end_time"),
    statusCode: text("status_code"),
    payloadFormat: text("payload_format").notNull(),
    payloadEncoding: text("payload_encoding").notNull(),
    payloadMaskingApplied: boolean("payload_masking_applied").notNull().default(false),
    payloadMaskedFields: jsonb("payload_masked_fields").notNull().default([]),
    payload: jsonb("payload"),
    registryWarning: text("registry_warning"),
    addressContext: jsonb("address_context"),
    qaSessionId: text("qa_session_id"),
    actorId: text("actor_id"),
    userId: text("user_id"),
    userAttributes: jsonb("user_attributes"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("idx_event_records_trace_id_pg").on(t.traceId),
    index("idx_event_records_trace_timestamp_pg").on(t.traceId, t.timestamp),
    index("idx_event_records_event_key_pg").on(t.eventKey),
    index("idx_event_records_session_id_pg").on(t.qaSessionId),
  ],
);

export type EventRecordPgRow = typeof eventRecords.$inferSelect;

/**
 * raw DDL — ingest.event_records.
 * KEY_OBSERVATIONS_PG_DDL과 별도 — schema CREATE는 idempotent.
 */
export const EVENT_RECORDS_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS ingest;

CREATE TABLE IF NOT EXISTS ingest.event_records (
  log_id                   TEXT PRIMARY KEY,
  trace_id                 TEXT NOT NULL,
  span_id                  TEXT NOT NULL,
  parent_span_id           TEXT,
  timestamp                TEXT NOT NULL,
  record_kind              TEXT NOT NULL,
  event_key                TEXT NOT NULL,
  event_version            TEXT NOT NULL,
  span_name                TEXT,
  start_time               TEXT,
  end_time                 TEXT,
  status_code              TEXT,
  payload_format           TEXT NOT NULL,
  payload_encoding         TEXT NOT NULL,
  payload_masking_applied  BOOLEAN NOT NULL DEFAULT FALSE,
  payload_masked_fields    JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload                  JSONB,
  registry_warning         TEXT,
  address_context          JSONB,
  qa_session_id            TEXT,
  actor_id                 TEXT,
  user_id                  TEXT,
  user_attributes          JSONB,
  created_at               TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_event_records_trace_id_pg         ON ingest.event_records(trace_id);
CREATE INDEX IF NOT EXISTS idx_event_records_trace_timestamp_pg  ON ingest.event_records(trace_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_event_records_event_key_pg        ON ingest.event_records(event_key);
CREATE INDEX IF NOT EXISTS idx_event_records_session_id_pg       ON ingest.event_records(qa_session_id);
`;
```

- [ ] **Step 2: typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/ingest-server typecheck
```

Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/ingest-server/src/stores/pg/schema.ts && git commit -m "$(cat <<'EOF'
feat(ingest-server): pg/schema.ts — ingest.event_records 추가

D1 schema와 1:1 매핑. jsonb로 payload/address_context/user_attributes/payload_masked_fields.
4개 인덱스 (trace_id, trace_timestamp, event_key, session_id).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: pg/event-record.adapter.ts — PgRecordStore

**Files:**
- Create: `packages/ingest-server/src/stores/pg/event-record.adapter.ts`

D1 어댑터의 모든 메서드(`insertBatch`, `findByTraceId`, `findByTraceIdPaginated`, `findBySessionId`, `findBySessionIdPaginated`, `findByTraceAndEventKey`, `findByTimeRange`)를 PG로 이식.

차이:
- jsonb 컬럼은 native object 대입 (JSON.stringify 불필요)
- timestamp text는 동일 (`r.timestamp.toISOString()`)
- `onConflictDoNothing` target은 동일 (`logId` PK)

- [ ] **Step 1: adapter.ts 작성**

`packages/ingest-server/src/stores/pg/event-record.adapter.ts`:

```ts
// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * PgRecordStore — RecordStore의 PostgreSQL 영속 구현.
 *
 * D1 어댑터(`d1-record-store.ts`)와 동일 비즈니스 로직.
 * dialect 차이:
 *   - jsonb 컬럼: payload/address_context/user_attributes/payload_masked_fields는
 *     native 객체 대입 (D1은 JSON.stringify 필요).
 *   - boolean payload_masking_applied: PG native (D1은 INTEGER).
 *
 * address_context는 emit 시점 (sdk auto-track)에서 AddressContextV1Schema로 검증되므로
 * 본 어댑터는 추가 validation 안 함 — §4 P2 정책 준수.
 */

import { and, asc, desc, eq, gt, gte, lte, or, type SQL } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type {
  RecordStore,
  RecordInsert,
  RecordPaginationCursor,
  RecordPaginationParams,
  StoredRecord,
  StoredRecordPage,
  TimeRangeParams,
} from "@qa-sdk/core";

import { eventRecords, type EventRecordPgRow } from "./schema.js";

const DEFAULT_PAGE_LIMIT = 100;

export class PgRecordStore implements RecordStore {
  constructor(private readonly db: PostgresJsDatabase) {}

  async insertBatch(records: RecordInsert[]): Promise<void> {
    if (records.length === 0) return;
    for (const r of records) {
      await this.db
        .insert(eventRecords)
        .values({
          logId: r.logId,
          traceId: r.traceId,
          spanId: r.spanId,
          parentSpanId: r.parentSpanId ?? null,
          timestamp: r.timestamp.toISOString(),
          recordKind: r.recordKind,
          eventKey: r.eventKey,
          eventVersion: r.eventVersion,
          spanName: r.spanName ?? null,
          startTime: r.startTime?.toISOString() ?? null,
          endTime: r.endTime?.toISOString() ?? null,
          statusCode: r.statusCode ?? null,
          payloadFormat: r.payloadFormat,
          payloadEncoding: r.payloadEncoding,
          payloadMaskingApplied: r.payloadMaskingApplied,
          payloadMaskedFields: r.payloadMaskedFields,
          payload: r.payload ?? null,
          registryWarning: r.registryWarning ?? null,
          addressContext: r.addressContext ?? null,
          qaSessionId: r.qaSessionId ?? null,
          actorId: r.actorId ?? null,
          userId: r.userId ?? null,
          userAttributes: r.userAttributes ?? null,
          createdAt: new Date().toISOString(),
        })
        .onConflictDoNothing({ target: eventRecords.logId });
    }
  }

  async findByTraceId(traceId: string): Promise<StoredRecord[]> {
    const rows = await this.db
      .select()
      .from(eventRecords)
      .where(eq(eventRecords.traceId, traceId))
      .orderBy(asc(eventRecords.timestamp));
    return rows.map(toStoredRecord);
  }

  async findByTraceIdPaginated(
    traceId: string,
    params?: RecordPaginationParams,
  ): Promise<StoredRecordPage> {
    return this.paginate(eq(eventRecords.traceId, traceId), params);
  }

  async findBySessionId(sessionId: string): Promise<StoredRecord[]> {
    const rows = await this.db
      .select()
      .from(eventRecords)
      .where(eq(eventRecords.qaSessionId, sessionId))
      .orderBy(asc(eventRecords.timestamp));
    return rows.map(toStoredRecord);
  }

  async findBySessionIdPaginated(
    sessionId: string,
    params?: RecordPaginationParams,
  ): Promise<StoredRecordPage> {
    return this.paginate(eq(eventRecords.qaSessionId, sessionId), params);
  }

  async findByTraceAndEventKey(traceId: string, eventKey: string): Promise<StoredRecord[]> {
    const rows = await this.db
      .select()
      .from(eventRecords)
      .where(and(eq(eventRecords.traceId, traceId), eq(eventRecords.eventKey, eventKey)))
      .orderBy(asc(eventRecords.timestamp));
    return rows.map(toStoredRecord);
  }

  async findByTimeRange(params: TimeRangeParams): Promise<StoredRecord[]> {
    const conditions: SQL<unknown>[] = [];
    if (params.from) conditions.push(gte(eventRecords.timestamp, params.from.toISOString()));
    if (params.to) conditions.push(lte(eventRecords.timestamp, params.to.toISOString()));
    if (params.eventKey) conditions.push(eq(eventRecords.eventKey, params.eventKey));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const query = this.db.select().from(eventRecords).orderBy(asc(eventRecords.timestamp));
    const rows = where
      ? await query.where(where).limit(params.limit ?? DEFAULT_PAGE_LIMIT)
      : await query.limit(params.limit ?? DEFAULT_PAGE_LIMIT);
    return rows.map(toStoredRecord);
  }

  /** 공통 paginate — cursor (timestamp, logId) 기반 */
  private async paginate(
    base: SQL<unknown>,
    params?: RecordPaginationParams,
  ): Promise<StoredRecordPage> {
    const limit = params?.limit ?? DEFAULT_PAGE_LIMIT;
    const cursor = params?.cursor;

    let where: SQL<unknown> = base;
    if (cursor) {
      const cond = or(
        gt(eventRecords.timestamp, cursor.timestamp.toISOString()),
        and(
          eq(eventRecords.timestamp, cursor.timestamp.toISOString()),
          gt(eventRecords.logId, cursor.logId),
        ),
      );
      if (cond) where = and(base, cond) as SQL<unknown>;
    }

    const rows = await this.db
      .select()
      .from(eventRecords)
      .where(where)
      .orderBy(asc(eventRecords.timestamp), asc(eventRecords.logId))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = page.map(toStoredRecord);
    const nextCursor: RecordPaginationCursor | null = hasMore
      ? { timestamp: new Date(page[page.length - 1].timestamp), logId: page[page.length - 1].logId }
      : null;

    return { items, nextCursor, hasMore };
  }
}

function toStoredRecord(row: EventRecordPgRow): StoredRecord {
  return {
    logId: row.logId,
    traceId: row.traceId,
    spanId: row.spanId,
    parentSpanId: row.parentSpanId ?? undefined,
    timestamp: new Date(row.timestamp),
    recordKind: row.recordKind,
    eventKey: row.eventKey,
    eventVersion: row.eventVersion,
    spanName: row.spanName ?? undefined,
    startTime: row.startTime ? new Date(row.startTime) : undefined,
    endTime: row.endTime ? new Date(row.endTime) : undefined,
    statusCode: row.statusCode ?? undefined,
    payloadFormat: row.payloadFormat,
    payloadEncoding: row.payloadEncoding,
    payloadMaskingApplied: row.payloadMaskingApplied,
    payloadMaskedFields: (row.payloadMaskedFields as string[]) ?? [],
    payload: row.payload,
    registryWarning: row.registryWarning ?? undefined,
    addressContext: (row.addressContext as Record<string, string> | null) ?? undefined,
    qaSessionId: row.qaSessionId ?? undefined,
    actorId: row.actorId ?? undefined,
    userId: row.userId ?? undefined,
    userAttributes: (row.userAttributes as Record<string, string> | null) ?? undefined,
    createdAt: new Date(row.createdAt),
  };
}
```

- [ ] **Step 2: typecheck + build**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/ingest-server typecheck && pnpm --filter @qa-sdk/ingest-server build 2>&1 | tail -10
```

Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/ingest-server/src/stores/pg/event-record.adapter.ts && git commit -m "$(cat <<'EOF'
feat(ingest-server): pg/event-record.adapter.ts — PgRecordStore

RecordStore 인터페이스 PG 구현 — D1 어댑터와 동등 동작.
jsonb native 대입 + ISO-8601 timestamp text + cursor pagination.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: pg/event-record.adapter.test.ts — PG-specific 단위 (env gate)

**Files:**
- Create: `packages/ingest-server/src/stores/pg/event-record.adapter.test.ts`

PG-specific edge:
- jsonb 컬럼 round-trip (payload, address_context, user_attributes)
- AddressContextV1 검증된 데이터의 PG 저장·조회 동등성
- cursor pagination tie-breaker (logId 정렬)
- onConflictDoNothing — duplicate logId

- [ ] **Step 1: 테스트 작성**

`packages/ingest-server/src/stores/pg/event-record.adapter.test.ts`:

```ts
// @def.boundary ingest-system
// @def.doc ingest-system

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

import { PgRecordStore } from "./event-record.adapter.js";
import { EVENT_RECORDS_PG_DDL } from "./schema.js";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

describe.skipIf(!PG_AVAILABLE)("PgRecordStore — PG-specific", () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? "localhost";
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? "5434");
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test";
  const PG_USER = process.env.QA_TEST_PG_USER ?? "qa_admin";
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? "";

  let sql: ReturnType<typeof postgres>;
  let store: PgRecordStore;
  let testSchema: string;

  beforeEach(async () => {
    testSchema = `test_${randomBytes(4).toString("hex")}`;
    sql = postgres({
      host: PG_HOST,
      port: PG_PORT,
      database: PG_DATABASE,
      user: PG_USER,
      password: PG_PASSWORD,
      max: 5,
      onnotice: () => {},
    });
    const ddl = EVENT_RECORDS_PG_DDL
      .replaceAll("ingest.", `${testSchema}.`)
      .replace("CREATE SCHEMA IF NOT EXISTS ingest", `CREATE SCHEMA IF NOT EXISTS ${testSchema}`);
    await sql.unsafe(ddl);
    await sql`SET search_path TO ${sql(testSchema)}, public`;
    store = new PgRecordStore(drizzle(sql));
  });

  afterEach(async () => {
    try {
      await sql`DROP SCHEMA ${sql(testSchema)} CASCADE`;
    } finally {
      await sql.end();
    }
  });

  function makeRecord(overrides: Partial<Parameters<PgRecordStore["insertBatch"]>[0][number]> = {}) {
    return {
      logId: `r-${randomBytes(4).toString("hex")}`,
      traceId: "t1",
      spanId: "s1",
      timestamp: new Date("2026-04-22T10:00:00Z"),
      recordKind: "log",
      eventKey: "page.view",
      eventVersion: "001",
      payloadFormat: "json",
      payloadEncoding: "raw",
      payloadMaskingApplied: false,
      payloadMaskedFields: [],
      payload: { page: "home" },
      ...overrides,
    };
  }

  it("insertBatch + findByTraceId — 기본 동작", async () => {
    await store.insertBatch([
      makeRecord({ logId: "r1", eventKey: "page.view" }),
      makeRecord({
        logId: "r2",
        eventKey: "cart.add",
        timestamp: new Date("2026-04-22T10:00:01Z"),
      }),
    ]);
    const rows = await store.findByTraceId("t1");
    expect(rows).toHaveLength(2);
    expect(rows[0].eventKey).toBe("page.view");
    expect(rows[0].payload).toEqual({ page: "home" });
    expect(rows[1].eventKey).toBe("cart.add");
  });

  it("address_context jsonb round-trip", async () => {
    await store.insertBatch([
      makeRecord({
        logId: "r1",
        addressContext: { version: "v1", prefix: "svc", address: "42" },
      }),
    ]);
    const rows = await store.findByTraceId("t1");
    expect(rows[0].addressContext).toEqual({
      version: "v1",
      prefix: "svc",
      address: "42",
    });
  });

  it("payload_masked_fields jsonb round-trip", async () => {
    await store.insertBatch([
      makeRecord({
        logId: "r1",
        payloadMaskingApplied: true,
        payloadMaskedFields: ["email", "phone"],
      }),
    ]);
    const rows = await store.findByTraceId("t1");
    expect(rows[0].payloadMaskingApplied).toBe(true);
    expect(rows[0].payloadMaskedFields).toEqual(["email", "phone"]);
  });

  it("onConflictDoNothing — duplicate logId 무시", async () => {
    await store.insertBatch([makeRecord({ logId: "r1", payload: { v: 1 } })]);
    await store.insertBatch([makeRecord({ logId: "r1", payload: { v: 2 } })]);
    const rows = await store.findByTraceId("t1");
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toEqual({ v: 1 }); // 첫 insert 보존
  });

  it("findByTraceIdPaginated — cursor tie-breaker (logId)", async () => {
    const sameTs = new Date("2026-04-22T10:00:00Z");
    await store.insertBatch([
      makeRecord({ logId: "a", timestamp: sameTs }),
      makeRecord({ logId: "b", timestamp: sameTs }),
      makeRecord({ logId: "c", timestamp: sameTs }),
    ]);
    const page1 = await store.findByTraceIdPaginated("t1", { limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.items.map((r) => r.logId)).toEqual(["a", "b"]);

    const page2 = await store.findByTraceIdPaginated("t1", {
      limit: 2,
      cursor: page1.nextCursor!,
    });
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0].logId).toBe("c");
    expect(page2.hasMore).toBe(false);
  });

  it("findByTimeRange — eventKey + 시간 필터", async () => {
    await store.insertBatch([
      makeRecord({ logId: "r1", eventKey: "page.view", timestamp: new Date("2026-04-22T09:00:00Z") }),
      makeRecord({ logId: "r2", eventKey: "page.view", timestamp: new Date("2026-04-22T10:00:00Z") }),
      makeRecord({ logId: "r3", eventKey: "cart.add", timestamp: new Date("2026-04-22T10:00:00Z") }),
    ]);
    const rows = await store.findByTimeRange({
      from: new Date("2026-04-22T09:30:00Z"),
      eventKey: "page.view",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].logId).toBe("r2");
  });

  it("user_attributes jsonb round-trip", async () => {
    await store.insertBatch([
      makeRecord({
        logId: "r1",
        userId: "u1",
        userAttributes: { tier: "premium", region: "kr" },
      }),
    ]);
    const rows = await store.findByTraceId("t1");
    expect(rows[0].userId).toBe("u1");
    expect(rows[0].userAttributes).toEqual({ tier: "premium", region: "kr" });
  });
});
```

- [ ] **Step 2: PG 환경에서 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
QA_TEST_PG=1 \
  QA_TEST_PG_PASSWORD=$(grep QA_SDK_ADMIN_PASSWORD packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter @qa-sdk/ingest-server test -- pg/event-record 2>&1 | tail -10
```

Expected: 7 PASS.

- [ ] **Step 3: env 없을 때 skip 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/ingest-server test -- pg/event-record 2>&1 | tail -5
```

Expected: PG suite skip.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/ingest-server/src/stores/pg/event-record.adapter.test.ts && git commit -m "$(cat <<'EOF'
test(ingest-server): pg/event-record.adapter PG-specific 단위

env gate (QA_TEST_PG=1). jsonb round-trip + cursor pagination + onConflictDoNothing.
address_context는 §4 P2 검증된 형태로 PG 저장.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 회귀

- [ ] **Step 1: ingest-server 전체 테스트 (PG 없이)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/ingest-server test 2>&1 | tail -10
```

Expected: D1 테스트 통과. PG suite skip.

- [ ] **Step 2: ingest-server 전체 테스트 (PG 활성)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
QA_TEST_PG=1 \
  QA_TEST_PG_PASSWORD=$(grep QA_SDK_ADMIN_PASSWORD packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter @qa-sdk/ingest-server test 2>&1 | tail -10
```

Expected: 모두 PASS (07b key-observation + 07c event-record).

- [ ] **Step 3: 의존자 typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter "...^@qa-sdk/ingest-server" typecheck 2>&1 | tail -5
```

Expected: 에러 없음.

---

## Self-Review

- [ ] `pg/schema.ts`에 `eventRecords` 추가 + `EVENT_RECORDS_PG_DDL` 정의
- [ ] `PgRecordStore`가 RecordStore 인터페이스(`packages/core/src/ports/record-store.port.ts`) 7 메서드 모두 구현
- [ ] jsonb 컬럼 4개 (payload, address_context, payload_masked_fields, user_attributes) 정상 round-trip
- [ ] cursor pagination tie-breaker (timestamp + logId) 동작
- [ ] PG-specific 테스트 7건 (env gate)
- [ ] D1 회귀 0
- [ ] 의존자 typecheck 0

---

## Defer

| 작업 | 이유 |
|---|---|
| `event_records` partition (시간 기반) | 실 트래픽 측정 후 — 별도 plan |
| jsonb GIN index (payload 검색) | 실 사용 패턴 정착 후 |
| RLS 정책 | Phase 3 RLS plan |
| Drizzle Kit 마이그레이션 (raw DDL 대신) | 패턴 안정 후 |
| `clickhouse-record-store.ts`와의 비교 정리 | ClickHouse 운영 도입 시점 |

---

## 의존·후속

- **선행 의존**:
  - **Plan 07a**: 옵션 결정 — 본 plan은 옵션 A 가정. 다른 옵션 시 File Structure 갱신.
  - **Plan 07b**: `pg/schema.ts`의 `pgSchema("ingest")` import + `package.json`의 postgres peerDep
  - **Plan 04a**: qa-sdk-postgres:5434 + ingest schema GRANT
  - **§4 P2** (`02-ingest-audit-versioning.md`): AddressContextV1Schema — 본 plan은 schema 변경 없이 emit 시점 검증을 신뢰
- **후속**:
  - **Plan 07d**: factory + STORE_DRIVER=pg 분기 + ingest-server 호출자 migration
  - **Phase 3 RLS plan**: ingest schema RLS 정책 적용
