---
status: draft
type: plan
owner: auth-model-implementation-backlog
---

# Plan 07b — ingest key_observations PG schema + adapter

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ingest-server에 `src/stores/pg/` 신규 디렉토리. `pgSchema("ingest")`로 PG `ingest` schema 안에 `key_observations` + `key_observation_prefixes` 테이블 정의 + `PgKeyObservationStore` 어댑터 구현. `(prefix_id, version, address)` 복합 PK로 §4 D1 결과를 PG에 동등 적용. PG 적용 후 기존 `packages/store/src/db/schema.ts`의 `coord-storage-exempt` 주석 제거.

**Architecture:**
- 선행 결정 (07a): 옵션 A 채택 가정 (D1+SQLite 통합 + PG 분리). 옵션 변경 시 본 plan File Structure 갱신 필요.
- `src/stores/pg/schema.ts` — `pgSchema("ingest").table("key_observations", {...})` + `key_observation_prefixes` + raw DDL 상수
- `src/stores/pg/key-observation.adapter.ts` — `PgKeyObservationStore implements KeyObservationStore` (`packages/core/src/ports/key-observation-store.port.ts`)
- `src/stores/pg/key-observation.adapter.test.ts` — PG-specific 단위 (env gate `QA_TEST_PG=1`)
- `peerDependencies`에 `postgres` optional 추가
- 비즈니스 로직 (mergePayloadSummary 등)은 D1 어댑터의 순수 함수 재사용 — dialect-agnostic 헬퍼 추출

**Tech Stack:** drizzle-orm/postgres-js + postgres ^3.4.0 (peerDep optional). qa-sdk-postgres:5434 (Plan 04a 컨테이너).

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `packages/ingest-server/src/stores/pg/schema.ts` | `ingest.key_observations` + `ingest.key_observation_prefixes` Drizzle 정의 + DDL |
| `packages/ingest-server/src/stores/pg/key-observation.adapter.ts` | `PgKeyObservationStore` |
| `packages/ingest-server/src/stores/pg/key-observation.adapter.test.ts` | PG-specific 단위 (env gate) |
| `packages/ingest-server/src/stores/shared/payload-summary.ts` | `mergePayloadSummary` dialect-agnostic 헬퍼 (D1과 PG 공유) |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `packages/ingest-server/package.json` | `postgres` peerDep optional + dev 추가 (이미 있으면 skip) |
| `packages/ingest-server/src/stores/d1-key-observation-store.ts` | `mergePayloadSummary` import를 shared로 변경 (중복 제거) |
| `packages/store/src/db/schema.ts` | `keyObservations`/`keyObservationPrefixes`의 `coord-storage-exempt` 주석 제거 + `(prefix_id, version, address)` 컬럼 적용 (또는 deprecation 주석으로 ingest-server pg/schema로 이전 명시) |

---

## Task 0: baseline + 선행 의존 확인

- [ ] **Step 1: Plan 07a 결정 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep -A3 "선택 옵션" docs/proposals/auth-model-implementation-backlog/plans/07a-ingest-d1-compatibility-decision.md | head -8
```

Expected: `선택 옵션 | A` (또는 lead가 채운 값). `(TBD ...)`이면 본 plan 시작 금지 — 07a 먼저 확정.

- [ ] **Step 2: Plan 04a (qa-sdk-db) + 04c (db-bootstrap) 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && docker compose -f packages/infra-engine/docker-compose.infra.yaml ps qa-sdk-db 2>&1 | grep -E "healthy|running" | head -1 && ls packages/db-bootstrap/dist 2>&1 | head -3
```

Expected: qa-sdk-db running + db-bootstrap built. 미부팅 시 `docker compose -f packages/infra-engine/docker-compose.infra.yaml up -d qa-sdk-db && sleep 10`.

- [ ] **Step 3: D1 측 versioned 테스트 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/ingest-server test -- d1-key-observation-store.versioned 2>&1 | tail -5
```

Expected: 모두 PASS. 이 baseline이 §4의 P1~P3 결과 — PG 어댑터가 동일 시나리오 충족해야 한다.

---

## Task 1: shared/payload-summary.ts — 헬퍼 추출

**Files:**
- Create: `packages/ingest-server/src/stores/shared/payload-summary.ts`

D1 어댑터의 `mergePayloadSummary`를 shared로 이전 — PG 어댑터가 동일 비즈니스 로직 재사용. dialect-agnostic 순수 함수.

- [ ] **Step 1: 헬퍼 추출**

```bash
mkdir -p /Users/junwoobang/workflow/qa-sdk/packages/ingest-server/src/stores/shared
```

`packages/ingest-server/src/stores/shared/payload-summary.ts`:

```ts
// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * mergePayloadSummary — payload field 빈도 + sample 값 누적 merge.
 *
 * dialect-agnostic 순수 함수. D1/SQLite/PG 어댑터에서 공유.
 * 원본: packages/ingest-server/src/stores/d1-key-observation-store.ts
 */

import type { KeyObservationEntry } from "@qa-sdk/core";
import type { PayloadSummaryJson } from "../../db/json-types.js";

export const EMPTY_PAYLOAD_SUMMARY: PayloadSummaryJson = {
  fieldFrequency: {},
  sampleValues: {},
};

/** 기존 summary에 새 관측 데이터를 누적 merge. 최대 5 sample 필드. */
export function mergePayloadSummary(
  prev: PayloadSummaryJson,
  entry: KeyObservationEntry,
): PayloadSummaryJson {
  const fieldFrequency = { ...prev.fieldFrequency };
  const sampleValues = { ...prev.sampleValues };

  if (entry.payloadFields) {
    for (const field of entry.payloadFields) {
      fieldFrequency[field] = (fieldFrequency[field] ?? 0) + 1;
    }
  }

  if (entry.samplePayload) {
    const keys = Object.keys(entry.samplePayload).slice(0, 5);
    for (const key of keys) {
      sampleValues[key] = entry.samplePayload[key];
    }
  }

  return { fieldFrequency, sampleValues };
}
```

- [ ] **Step 2: D1 어댑터에서 import로 변경**

`packages/ingest-server/src/stores/d1-key-observation-store.ts`:

```ts
// 변경 전: 파일 하단의 mergePayloadSummary 함수 정의
// 변경 후 — 상단 import 추가:
import { mergePayloadSummary, EMPTY_PAYLOAD_SUMMARY } from "./shared/payload-summary.js";
// 파일 하단의 mergePayloadSummary 정의 제거
// 기존 EMPTY_PAYLOAD_SUMMARY import (json-types에서) 제거 — shared로 이전
```

`json-types.ts`의 `EMPTY_PAYLOAD_SUMMARY`가 다른 곳에서도 사용되면 그대로 두고 shared에서 re-export. 본 plan은 shared가 SSOT.

- [ ] **Step 3: typecheck + D1 테스트 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/ingest-server typecheck && pnpm --filter @qa-sdk/ingest-server test -- d1-key-observation-store 2>&1 | tail -5
```

Expected: 에러 없음 + D1 테스트 PASS (Task 0 baseline 동일).

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/ingest-server/src/stores/shared packages/ingest-server/src/stores/d1-key-observation-store.ts && git commit -m "$(cat <<'EOF'
refactor(ingest-server): mergePayloadSummary를 shared/로 추출

dialect-agnostic 순수 함수 — D1/PG 어댑터가 공유.
07b PG 어댑터 도입 전 사전 분리.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: package.json — postgres peerDep + dev

**Files:**
- Modify: `packages/ingest-server/package.json`

ingest-server는 이미 `@qa-sdk/store` dep 통해 postgres를 transitive로 가질 수 있다. 본 plan은 직접 의존을 명시.

- [ ] **Step 1: peerDependencies + peerDependenciesMeta + devDependencies에 추가**

기존 `dependencies`에 `postgres`가 있으면 peerDeps로 이동. 없으면 신규 추가:

```json
{
  "peerDependencies": {
    "postgres": "^3.4.0"
  },
  "peerDependenciesMeta": {
    "postgres": { "optional": true }
  },
  "devDependencies": {
    "postgres": "^3.4.0"
  }
}
```

`drizzle-orm`은 이미 dependency. `better-sqlite3` (또는 `node:sqlite`)은 옵션 A에 따라 sqlite runtime용 유지.

- [ ] **Step 2: pnpm install**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/ingest-server/package.json pnpm-lock.yaml && git commit -m "$(cat <<'EOF'
chore(ingest-server): postgres peerDep optional 추가

Plan 07b PG 어댑터 도입 전 의존 정합 — dialect-only 환경 지원.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: pg/schema.ts — ingest.key_observations + key_observation_prefixes

**Files:**
- Create: `packages/ingest-server/src/stores/pg/schema.ts`

§4 결과를 PG로 1:1 이식. `(prefix_id, version, address)` 복합 PK + version별 prefix 집계.

- [ ] **Step 1: 디렉토리 + 파일 생성**

```bash
mkdir -p /Users/junwoobang/workflow/qa-sdk/packages/ingest-server/src/stores/pg
```

`packages/ingest-server/src/stores/pg/schema.ts`:

```ts
// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * ingest schema 안의 key_observations + key_observation_prefixes.
 *
 * §4 (coord-storage-audit) P1·P3 결과를 PG로 이식:
 *   - PK = (prefix_id, version, address)
 *   - packed_key는 secondary index (역호환·이력 추적)
 *   - prefix 집계도 (prefix_id, version) 복합 PK
 *
 * SQLite 버전(`packages/ingest-server/src/db/schema.ts` keyObservations)과 동일 구조,
 * dialect 차이만:
 *   - integer → integer (그대로)
 *   - text → text (그대로)
 *   - boolean SQLite는 INTEGER(0/1), PG는 native boolean
 *   - JSON payload_summary는 PG에서 jsonb (성능)
 *   - timestamp 필드는 ISO-8601 text 유지 (ingest 핫패스 호환성)
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";

const ingestSchema = pgSchema("ingest");

export const keyObservations = ingestSchema.table(
  "key_observations",
  {
    prefixId: text("prefix_id").notNull(),
    version: text("version").notNull(),
    address: integer("address").notNull(),
    packedKey: text("packed_key").notNull(),
    registered: boolean("registered").notNull().default(false),
    count: integer("count").notNull().default(1),
    firstSeen: text("first_seen").notNull(),
    lastSeen: text("last_seen").notNull(),
    payloadSummary: jsonb("payload_summary").notNull().default({}),
  },
  (t) => [
    primaryKey({ columns: [t.prefixId, t.version, t.address] }),
    index("idx_key_obs_packed_pg").on(t.packedKey),
    index("idx_key_obs_prefix_version_pg").on(t.prefixId, t.version),
    index("idx_key_obs_last_seen_pg").on(t.lastSeen),
    index("idx_key_obs_count_pg").on(t.count),
    index("idx_key_obs_registered_pg").on(t.registered),
  ],
);

export const keyObservationPrefixes = ingestSchema.table(
  "key_observation_prefixes",
  {
    prefixId: text("prefix_id").notNull(),
    version: text("version").notNull(),
    distinctKeys: integer("distinct_keys").notNull().default(1),
    totalCount: integer("total_count").notNull().default(0),
    firstSeen: text("first_seen").notNull(),
    lastSeen: text("last_seen").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.prefixId, t.version] }),
  ],
);

export type KeyObservationPgRow = typeof keyObservations.$inferSelect;
export type KeyObservationPrefixPgRow = typeof keyObservationPrefixes.$inferSelect;

/**
 * raw DDL — Drizzle Kit 마이그레이션 정착 전까지 fixture/migration용.
 * §4 P1~P3 패턴 PG 이식.
 */
export const KEY_OBSERVATIONS_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS ingest;

CREATE TABLE IF NOT EXISTS ingest.key_observations (
  prefix_id        TEXT NOT NULL,
  version          TEXT NOT NULL,
  address          INTEGER NOT NULL,
  packed_key       TEXT NOT NULL,
  registered       BOOLEAN NOT NULL DEFAULT FALSE,
  count            INTEGER NOT NULL DEFAULT 1,
  first_seen       TEXT NOT NULL,
  last_seen        TEXT NOT NULL,
  payload_summary  JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (prefix_id, version, address)
);
CREATE INDEX IF NOT EXISTS idx_key_obs_packed_pg          ON ingest.key_observations(packed_key);
CREATE INDEX IF NOT EXISTS idx_key_obs_prefix_version_pg  ON ingest.key_observations(prefix_id, version);
CREATE INDEX IF NOT EXISTS idx_key_obs_last_seen_pg       ON ingest.key_observations(last_seen);
CREATE INDEX IF NOT EXISTS idx_key_obs_count_pg           ON ingest.key_observations(count);
CREATE INDEX IF NOT EXISTS idx_key_obs_registered_pg      ON ingest.key_observations(registered);

CREATE TABLE IF NOT EXISTS ingest.key_observation_prefixes (
  prefix_id      TEXT NOT NULL,
  version        TEXT NOT NULL,
  distinct_keys  INTEGER NOT NULL DEFAULT 1,
  total_count    INTEGER NOT NULL DEFAULT 0,
  first_seen     TEXT NOT NULL,
  last_seen      TEXT NOT NULL,
  PRIMARY KEY (prefix_id, version)
);
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
feat(ingest-server): pg/schema.ts — ingest.key_observations + prefixes

§4 P1·P3 패턴 PG 이식 — (prefix_id, version, address) 복합 PK.
pgSchema("ingest") 격리 + jsonb payload_summary.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: pg/key-observation.adapter.ts — PgKeyObservationStore

**Files:**
- Create: `packages/ingest-server/src/stores/pg/key-observation.adapter.ts`

D1 어댑터와 동일 비즈니스 로직 — `parsePackedAddress` + `mergePayloadSummary` 재사용. SQL dialect 차이는 `onConflictDoUpdate` target 작성과 boolean 비교 (SQLite `= 1` vs PG `= TRUE`)뿐.

- [ ] **Step 1: adapter.ts 작성**

`packages/ingest-server/src/stores/pg/key-observation.adapter.ts`:

```ts
// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * PgKeyObservationStore — KeyObservationStore의 PostgreSQL 영속 구현.
 *
 * D1 어댑터(`d1-key-observation-store.ts`)와 동일 비즈니스 로직.
 * dialect 차이:
 *   - boolean: PG native (D1은 INTEGER 0/1)
 *   - jsonb payload_summary (D1은 TEXT JSON)
 *   - registered SQL 비교: PG `= TRUE` (D1 `= 1`)
 */

import { and, asc, count as countFn, desc, eq, lt, sql, sum } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type {
  KeyObservation,
  KeyObservationEntry,
  KeyObservationStore,
  KeyObservationSummary,
  PayloadSummary,
  PrefixObservationSummary,
} from "@qa-sdk/core";
import { parsePackedAddress } from "@qa-sdk/core/coordinates/address-context-schema";

import {
  EMPTY_PAYLOAD_SUMMARY,
  mergePayloadSummary,
} from "../shared/payload-summary.js";
import {
  keyObservationPrefixes,
  keyObservations,
  type KeyObservationPgRow,
} from "./schema.js";

export class PgKeyObservationStore implements KeyObservationStore {
  constructor(private readonly db: PostgresJsDatabase) {}

  async observe(entry: KeyObservationEntry): Promise<void> {
    await this.observeBatch([entry]);
  }

  async observeBatch(entries: readonly KeyObservationEntry[]): Promise<void> {
    for (const entry of entries) {
      const resolved =
        entry.version !== undefined && entry.address !== undefined
          ? { version: entry.version, address: entry.address }
          : (() => {
              const p = parsePackedAddress(entry.packedKey);
              return p ? { version: p.version, address: p.address } : null;
            })();

      if (!resolved) continue;
      const { version, address } = resolved;

      const [existing] = await this.db
        .select({ payloadSummary: keyObservations.payloadSummary })
        .from(keyObservations)
        .where(
          and(
            eq(keyObservations.prefixId, entry.prefixId),
            eq(keyObservations.version, version),
            eq(keyObservations.address, address),
          ),
        );

      const prevSummary = (existing?.payloadSummary as PayloadSummary | undefined) ??
        EMPTY_PAYLOAD_SUMMARY;
      const merged = mergePayloadSummary(prevSummary, entry);

      await this.db
        .insert(keyObservations)
        .values({
          prefixId: entry.prefixId,
          version,
          address,
          packedKey: entry.packedKey,
          registered: entry.registered,
          count: 1,
          firstSeen: entry.timestamp,
          lastSeen: entry.timestamp,
          payloadSummary: merged,
        })
        .onConflictDoUpdate({
          target: [
            keyObservations.prefixId,
            keyObservations.version,
            keyObservations.address,
          ],
          set: {
            count: sql`${keyObservations.count} + 1`,
            lastSeen: entry.timestamp,
            registered: entry.registered,
            payloadSummary: merged,
          },
        });

      await this.db
        .insert(keyObservationPrefixes)
        .values({
          prefixId: entry.prefixId,
          version,
          distinctKeys: 1,
          totalCount: 1,
          firstSeen: entry.timestamp,
          lastSeen: entry.timestamp,
        })
        .onConflictDoUpdate({
          target: [keyObservationPrefixes.prefixId, keyObservationPrefixes.version],
          set: {
            distinctKeys: sql`CASE
              WHEN NOT EXISTS (
                SELECT 1 FROM ${keyObservations}
                WHERE ${keyObservations.prefixId} = ${entry.prefixId}
                  AND ${keyObservations.version} = ${version}
                  AND ${keyObservations.address} = ${address}
                  AND ${keyObservations.count} > 1
              )
              THEN ${keyObservationPrefixes.distinctKeys} + 1
              ELSE ${keyObservationPrefixes.distinctKeys}
            END`,
            totalCount: sql`${keyObservationPrefixes.totalCount} + 1`,
            lastSeen: entry.timestamp,
          },
        });
    }
  }

  async findByPrefix(
    prefixId: string,
    opts?: { limit?: number; orderBy?: "count" | "last_seen" },
  ): Promise<KeyObservation[]> {
    const orderCol = opts?.orderBy === "last_seen"
      ? desc(keyObservations.lastSeen)
      : desc(keyObservations.count);

    const rows = await this.db
      .select()
      .from(keyObservations)
      .where(eq(keyObservations.prefixId, prefixId))
      .orderBy(orderCol)
      .limit(opts?.limit ?? 100);

    return rows.map(toKeyObservation);
  }

  async summary(): Promise<KeyObservationSummary> {
    const [agg] = await this.db
      .select({
        totalKeys: countFn(),
        totalCount: sum(keyObservations.count),
        registeredKeys: sql<number>`SUM(CASE WHEN ${keyObservations.registered} = TRUE THEN 1 ELSE 0 END)`,
        unregisteredKeys: sql<number>`SUM(CASE WHEN ${keyObservations.registered} = FALSE THEN 1 ELSE 0 END)`,
      })
      .from(keyObservations);

    const breakdownRows = await this.db
      .select({
        prefixId: keyObservations.prefixId,
        total: sum(keyObservations.count),
      })
      .from(keyObservations)
      .groupBy(keyObservations.prefixId);

    const prefixBreakdown: Record<string, number> = {};
    for (const row of breakdownRows) {
      prefixBreakdown[row.prefixId] = Number(row.total ?? 0);
    }

    return {
      totalKeys: Number(agg?.totalKeys ?? 0),
      totalCount: Number(agg?.totalCount ?? 0),
      registeredKeys: Number(agg?.registeredKeys ?? 0),
      unregisteredKeys: Number(agg?.unregisteredKeys ?? 0),
      prefixBreakdown,
    };
  }

  async findStale(before: string, limit = 500): Promise<KeyObservation[]> {
    const rows = await this.db
      .select()
      .from(keyObservations)
      .where(lt(keyObservations.lastSeen, before))
      .orderBy(asc(keyObservations.lastSeen))
      .limit(limit);

    return rows.map(toKeyObservation);
  }

  async findUnregistered(opts?: { limit?: number }): Promise<KeyObservation[]> {
    const rows = await this.db
      .select()
      .from(keyObservations)
      .where(eq(keyObservations.registered, false))
      .orderBy(desc(keyObservations.count))
      .limit(opts?.limit ?? 100);

    return rows.map(toKeyObservation);
  }

  async prefixSummary(prefixId?: string): Promise<PrefixObservationSummary[]> {
    const query = this.db.select().from(keyObservationPrefixes);
    const rows = prefixId
      ? await query.where(eq(keyObservationPrefixes.prefixId, prefixId))
      : await query;

    return rows.map((r) => ({
      prefixId: r.prefixId,
      version: r.version,
      distinctKeys: r.distinctKeys,
      totalCount: r.totalCount,
      firstSeen: r.firstSeen,
      lastSeen: r.lastSeen,
    }));
  }
}

function toKeyObservation(row: KeyObservationPgRow): KeyObservation {
  return {
    packedKey: row.packedKey,
    prefixId: row.prefixId,
    version: row.version,
    address: row.address,
    registered: row.registered,
    count: row.count,
    firstSeen: row.firstSeen,
    lastSeen: row.lastSeen,
    payloadSummary: (row.payloadSummary as PayloadSummary) ?? EMPTY_PAYLOAD_SUMMARY,
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
cd /Users/junwoobang/workflow/qa-sdk && git add packages/ingest-server/src/stores/pg/key-observation.adapter.ts && git commit -m "$(cat <<'EOF'
feat(ingest-server): pg/key-observation.adapter.ts — PgKeyObservationStore

D1 어댑터와 동일 비즈니스 로직 — parsePackedAddress + mergePayloadSummary 재사용.
PK = (prefix_id, version, address) 복합 — §4 P1·P3 PG 이식.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: pg/key-observation.adapter.test.ts — PG-specific 단위 (env gate)

**Files:**
- Create: `packages/ingest-server/src/stores/pg/key-observation.adapter.test.ts`

contract test (07d cross-adapter)와 별도. 본 파일은 PG-specific edge:
- jsonb payload_summary round-trip
- §4 versioned 시나리오 (`svc:v1:5` vs `svc:v2:5` 분리 row)
- ingest schema search_path 동작

- [ ] **Step 1: 테스트 작성**

`packages/ingest-server/src/stores/pg/key-observation.adapter.test.ts`:

```ts
// @def.boundary ingest-system
// @def.doc ingest-system

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

import { PgKeyObservationStore } from "./key-observation.adapter.js";
import { KEY_OBSERVATIONS_PG_DDL } from "./schema.js";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

describe.skipIf(!PG_AVAILABLE)("PgKeyObservationStore — PG-specific", () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? "localhost";
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? "5434");
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test";
  const PG_USER = process.env.QA_TEST_PG_USER ?? "qa_admin";
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? "";

  let sql: ReturnType<typeof postgres>;
  let store: PgKeyObservationStore;
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
    const ddl = KEY_OBSERVATIONS_PG_DDL
      .replaceAll("ingest.", `${testSchema}.`)
      .replace("CREATE SCHEMA IF NOT EXISTS ingest", `CREATE SCHEMA IF NOT EXISTS ${testSchema}`);
    await sql.unsafe(ddl);
    await sql`SET search_path TO ${sql(testSchema)}, public`;
    store = new PgKeyObservationStore(drizzle(sql));
  });

  afterEach(async () => {
    try {
      await sql`DROP SCHEMA ${sql(testSchema)} CASCADE`;
    } finally {
      await sql.end();
    }
  });

  it("observe → packed_key parse → version/address 분리 저장", async () => {
    await store.observe({
      packedKey: "svc:v1:42",
      prefixId: "svc",
      registered: true,
      timestamp: "2026-04-22T10:00:00Z",
    });
    const rows = await store.findByPrefix("svc");
    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBe("v1");
    expect(rows[0].address).toBe(42);
  });

  it("같은 prefix·다른 version은 별도 row (PG composite PK)", async () => {
    await store.observe({
      packedKey: "svc:v1:5",
      prefixId: "svc",
      registered: true,
      timestamp: "2026-04-22T10:00:00Z",
    });
    await store.observe({
      packedKey: "svc:v2:5",
      prefixId: "svc",
      registered: true,
      timestamp: "2026-04-22T10:00:01Z",
    });
    const rows = await store.findByPrefix("svc");
    expect(rows).toHaveLength(2);
    const versions = new Set(rows.map((r) => r.version));
    expect(versions).toEqual(new Set(["v1", "v2"]));
  });

  it("payload_summary jsonb round-trip", async () => {
    await store.observe({
      packedKey: "svc:v1:1",
      prefixId: "svc",
      registered: true,
      timestamp: "2026-04-22T10:00:00Z",
      payloadFields: ["page", "userId"],
      samplePayload: { page: "home", userId: "u1" },
    });
    const rows = await store.findByPrefix("svc");
    expect(rows[0].payloadSummary.fieldFrequency.page).toBe(1);
    expect(rows[0].payloadSummary.sampleValues.userId).toBe("u1");
  });

  it("prefixSummary는 (prefix_id, version)별 분리", async () => {
    await store.observe({
      packedKey: "svc:v1:1",
      prefixId: "svc",
      registered: true,
      timestamp: "2026-04-22T10:00:00Z",
    });
    await store.observe({
      packedKey: "svc:v2:1",
      prefixId: "svc",
      registered: true,
      timestamp: "2026-04-22T10:00:01Z",
    });
    const summaries = await store.prefixSummary("svc");
    expect(summaries).toHaveLength(2);
    const versions = new Set(summaries.map((s) => s.version));
    expect(versions).toEqual(new Set(["v1", "v2"]));
  });

  it("findUnregistered — registered=FALSE 비교 (PG boolean)", async () => {
    await store.observe({
      packedKey: "svc:v1:1",
      prefixId: "svc",
      registered: false,
      timestamp: "2026-04-22T10:00:00Z",
    });
    await store.observe({
      packedKey: "svc:v1:2",
      prefixId: "svc",
      registered: true,
      timestamp: "2026-04-22T10:00:00Z",
    });
    const unreg = await store.findUnregistered();
    expect(unreg).toHaveLength(1);
    expect(unreg[0].address).toBe(1);
  });
});
```

- [ ] **Step 2: PG 환경에서 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
QA_TEST_PG=1 \
  QA_TEST_PG_PASSWORD=$(grep QA_SDK_ADMIN_PASSWORD packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter @qa-sdk/ingest-server test -- pg/key-observation 2>&1 | tail -10
```

Expected: 5 PASS (qa-sdk-db 부팅 가정).

- [ ] **Step 3: env 없을 때 skip 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/ingest-server test -- pg/key-observation 2>&1 | tail -5
```

Expected: PG suite skip — 다른 테스트 정상.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/ingest-server/src/stores/pg/key-observation.adapter.test.ts && git commit -m "$(cat <<'EOF'
test(ingest-server): pg/key-observation.adapter PG-specific 단위

env gate (QA_TEST_PG=1). §4 versioned 시나리오 + jsonb round-trip + boolean 비교.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: coord-storage-exempt 주석 정리

§4·§6 결과: PG 어댑터 미이행 시점에 `packages/store/src/db/schema.ts`의 `keyObservations`/`keyObservationPrefixes`에 `@def.coord-storage-exempt` 주석을 붙여 def validate를 통과시켰다. 본 plan으로 PG 어댑터가 정상 적용 → 주석 제거.

단, `@qa-sdk/store` 패키지의 `keyObservations`(legacy 단일 PK `packed_key`)는 ingest-server pg/schema.ts와 별도 entity. 두 가지 경로:

1. **이전 (권장)**: `@qa-sdk/store`의 `keyObservations`/`keyObservationPrefixes`를 ingest-server pg/schema.ts에서 import (역방향 의존 발생) — **금지** (의존 방향 위반).
2. **deprecation**: `@qa-sdk/store`의 두 테이블 정의를 deprecation 주석으로 마킹하고, ingest-server 측 pg/schema가 SSOT임을 명시. 마이그레이션 도구는 ingest-server에서 export.

본 plan은 옵션 2 채택.

- [ ] **Step 1: @qa-sdk/store schema 정리**

`packages/store/src/db/schema.ts`의 `keyObservations` 위 주석:

```ts
// 변경 전:
// @def.coord-storage-exempt: PG 스키마 미이행 — auth-model-implementation-backlog Plan 07b ...
export const keyObservations = pgTable("key_observations", { ... });

// 변경 후:
/**
 * @deprecated 2026-04-XX (Plan 07b 완료) — ingest-server의 pg/schema.ts가 SSOT.
 * 본 정의는 history 보존용이며 신규 코드 import 금지.
 * 다음 packages/store major release에서 제거 예정.
 */
export const keyObservations = pgTable("key_observations", { ... });
```

`keyObservationPrefixes`도 동일.

- [ ] **Step 2: def validate 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter qa-sdk-cli def validate 2>&1 | tail -10
```

Expected: errors=0, coord-storage 위반 0 (ingest-server pg/schema가 §1.1 충족).

- [ ] **Step 3: @qa-sdk/store 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/store typecheck && pnpm --filter @qa-sdk/store test 2>&1 | tail -5
```

Expected: 통과 (deprecation 주석은 typecheck 영향 없음).

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/store/src/db/schema.ts && git commit -m "$(cat <<'EOF'
chore(store): keyObservations coord-storage-exempt → deprecated

ingest-server의 pg/schema.ts (Plan 07b)가 SSOT.
@qa-sdk/store legacy 정의는 history 보존용 deprecated.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 회귀

- [ ] **Step 1: ingest-server 전체 테스트 (PG 없이)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/ingest-server test 2>&1 | tail -10
```

Expected: 모든 D1/SQLite 테스트 통과. PG suite는 skip.

- [ ] **Step 2: ingest-server 전체 테스트 (PG 활성)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
QA_TEST_PG=1 \
  QA_TEST_PG_PASSWORD=$(grep QA_SDK_ADMIN_PASSWORD packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter @qa-sdk/ingest-server test 2>&1 | tail -10
```

Expected: 모두 통과 + PG suite도 PASS.

- [ ] **Step 3: 의존자 typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter "...^@qa-sdk/ingest-server" typecheck 2>&1 | tail -10
```

Expected: 에러 없음.

---

## Self-Review

- [ ] `pg/schema.ts`가 `pgSchema("ingest")` 사용 + (prefix_id, version, address) 복합 PK
- [ ] `PgKeyObservationStore`가 KeyObservationStore 인터페이스(`packages/core/src/ports/key-observation-store.port.ts`) 구현
- [ ] `mergePayloadSummary` shared 추출 — D1·PG 모두 같은 함수 사용
- [ ] PG-specific 테스트 5건 (env gate)
- [ ] `coord-storage-exempt` 주석 → deprecated로 전이 + def validate 위반 0
- [ ] postgres peerDep optional + dev 추가
- [ ] D1 회귀 0
- [ ] 의존자 typecheck 0

---

## Defer

| 작업 | 이유 |
|---|---|
| `@qa-sdk/store`의 deprecated keyObservations 실제 제거 | 다음 major release — 본 plan 범위 외 |
| RLS 정책 (`auth.user_id` 기반) | Phase 3 RLS plan |
| Drizzle Kit 마이그레이션 (raw DDL 대신) | 패턴 안정 후 — 별도 plan |
| jsonb GIN index (payload_summary 검색) | 실 트래픽 측정 후 |
| ClickHouse key_observations 동기 | §6 트리거(ClickHouse 운영 도입) 발생 시 |

---

## 의존·후속

- **선행 의존**:
  - **Plan 07a**: 옵션 결정 — 본 plan은 옵션 A 가정으로 작성. 다른 옵션 시 File Structure 갱신 필요.
  - **Plan 04a**: qa-sdk-postgres:5434 컨테이너 + ingest schema GRANT
  - **Plan 04c**: db-bootstrap (테스트 fixture 헬퍼는 본 plan에서 직접 사용하지 않으나 패턴 참조)
  - **§4** (`02-ingest-audit-versioning.md`): D1 P1·P3 결과 — PG가 동일 시나리오 충족해야 함
  - **§6** (`03-coordinate-storage-validation.md`): coord-storage-exempt 주석 시스템
- **후속**:
  - **Plan 07c**: event_records PG 어댑터 — 본 plan과 동일 패턴
  - **Plan 07d**: factory + 호출자 migration
  - **Phase 3 RLS plan**: ingest schema에 RLS 정책 적용
