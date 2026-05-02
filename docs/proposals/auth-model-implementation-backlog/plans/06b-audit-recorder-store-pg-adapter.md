# Plan 06b — audit-recorder-store PG schema + adapter

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `audit-recorder-store`에 `src/pg/` 하위 디렉토리 신규 생성. `pgSchema("audit")`로 PG `audit` schema 안에 `audit_entries` 테이블 정의 + `PgAuditRecorder` 어댑터 구현. RLS는 placeholder만 (정책 미정의 — Phase 3 RLS plan에서 본격). audit 도메인은 write-mostly이므로 PG `audit_app` role은 SELECT/INSERT만 갖는다 — `pg-migration-design.md` §3 grant 모델을 본 schema에 반영.

**Architecture:**
- `src/pg/schema.ts` — `pgSchema("audit").table("audit_entries", {...})` + DDL 상수 (RLS ENABLE + audit_app SELECT/INSERT-only grant 주석)
- `src/pg/adapter.ts` — `PgAuditRecorder implements AuditRecorder`. SqliteAuditRecorder와 동일 비즈니스 로직 — 트리 구축(rootSpanId/depth 계산), parent 조회, kind 분기, JSON 직렬화 모두 동일. dialect 차이는 SQL driver type만.
- `src/pg/adapter.test.ts` — PG-specific 단위 테스트 (qa-sdk-db 컨테이너 의존, env gate `QA_TEST_PG=1`).
- `peerDependencies`에 `postgres` 추가 (optional). 비즈니스 로직(트리 invariant)은 SqliteAuditRecorder와 동일 — 본 plan에서는 양쪽에 동일 코드를 두고, 순수 함수 추출은 06c factory 정착 후 후속 plan에서.

**Tech Stack:** drizzle-orm/postgres-js + postgres ^3.4.0 (peerDep optional). qa-sdk-postgres:5434 (Plan 04a 컨테이너).

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `packages/audit-recorder-store/src/pg/schema.ts` | `audit.audit_entries` Drizzle 정의 + DDL + RLS placeholder + grant 주석 |
| `packages/audit-recorder-store/src/pg/adapter.ts` | `PgAuditRecorder` |
| `packages/audit-recorder-store/src/pg/adapter.test.ts` | PG-specific 테스트 (env gate `QA_TEST_PG=1`) |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `packages/audit-recorder-store/package.json` | `postgres` peerDep optional + dev 추가 |
| `packages/audit-recorder-store/src/index.ts` | PG adapter + schema re-export 추가 |

---

## Task 0: baseline

- [ ] **Step 1: Plan 06a 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && ls packages/audit-recorder-store/src/sqlite/adapter.ts && grep -n "SqliteAuditRecorder" packages/audit-recorder-store/src/index.ts
```

Expected: 둘 다 hit. 미완료 시 본 plan 시작 금지.

- [ ] **Step 2: Plan 04a (qa-sdk-db) 부팅 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && docker compose -f docker-compose.infra.yaml ps qa-sdk-db | grep healthy
```

Expected: healthy. 미부팅 시 `docker compose up -d qa-sdk-db && sleep 10`. PG 단위 테스트(Task 4) 시 필수.

- [ ] **Step 3: Plan 06a SQLite 테스트 회귀 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter audit-recorder-store test 2>&1 | tail -3
```

Expected: 13+2 PASS.

---

## Task 1: package.json — postgres peerDep + dev

**Files:**
- Modify: `packages/audit-recorder-store/package.json`

- [ ] **Step 1: peerDependencies + peerDependenciesMeta + devDependencies에 추가**

기존 `dependencies`에서 `better-sqlite3`를 `peerDependencies`로 이동 + `postgres` 신규 추가. `peerDependenciesMeta.optional` 양쪽 모두.

```json
{
  "dependencies": {
    "drizzle-orm": "catalog:",
    "permission-engine": "workspace:*"
  },
  "peerDependencies": {
    "better-sqlite3": "catalog:",
    "postgres": "^3.4.0"
  },
  "peerDependenciesMeta": {
    "better-sqlite3": { "optional": true },
    "postgres": { "optional": true }
  },
  "devDependencies": {
    "@types/better-sqlite3": "catalog:",
    "@types/node": "^22.0.0",
    "better-sqlite3": "catalog:",
    "postgres": "^3.4.0",
    "resource-policy-store": "workspace:*",
    "tsup": "^8.5.1",
    "typescript": "^5.8.2",
    "vitest": "^1.6.1",
    "weighted-index": "workspace:*"
  }
}
```

`resource-policy-store`/`weighted-index` dev dep은 e2e-integration.test.ts에서 계속 사용하므로 유지.

- [ ] **Step 2: pnpm install**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install
```

Expected: lockfile 갱신, postgres 신규 설치, better-sqlite3는 peerDep으로 분류되며 dev로 다시 설치.

- [ ] **Step 3: SQLite 회귀 (peerDep 이동 영향 없음 확인)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter audit-recorder-store test 2>&1 | tail -3
```

Expected: 13+2 PASS. 테스트가 dev dep으로 better-sqlite3 사용 — 동작 동일.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/audit-recorder-store/package.json pnpm-lock.yaml && git commit -m "$(cat <<'EOF'
chore(audit-recorder-store): postgres peerDep optional 추가

dialect-only 환경 지원 — better-sqlite3·postgres 모두 optional peerDep.
dev에는 둘 다 설치 (테스트가 양쪽 검증).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: pg/schema.ts — audit.audit_entries

**Files:**
- Create: `packages/audit-recorder-store/src/pg/schema.ts`

- [ ] **Step 1: 디렉토리 + 파일 생성**

```bash
mkdir -p /Users/junwoobang/workflow/qa-sdk/packages/audit-recorder-store/src/pg
```

`packages/audit-recorder-store/src/pg/schema.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

import { index, integer, jsonb, pgSchema, text, varchar } from "drizzle-orm/pg-core";

/**
 * audit schema 안의 audit_entries 테이블.
 *
 * SQLite 버전(sqlite/schema.ts)과 동일 컬럼·인덱스·invariant. PG-specific 변경:
 *   - kind/outcome/pass는 PG enum 대신 CHECK constraint 유지 (varchar + check)
 *     (SQLite와 동일 패턴. drizzle pg enum은 별도 마이그레이션 라운드 필요해 회피)
 *   - metadata는 jsonb로 저장 (SQLite는 text JSON-string). adapter 토글 분기.
 *   - text 컬럼은 PG에서도 text (둘 다 unbounded)
 *
 * RLS는 본 schema에 ENABLE만, 정책 정의는 Phase 3 RLS plan.
 *
 * audit 도메인 grant 모델 (pg-migration-design.md §3):
 *   - audit_app: SELECT, INSERT만 (write-mostly, UPDATE·DELETE 금지)
 *   - qa_admin:  SELECT만 (cross-domain 분석)
 * UPDATE는 finishExecution에서 사용 — adapter는 별도 superuser/owner role 사용 가정.
 * 본 placeholder 단계에서는 임시 fallback 정책으로 모든 access 허용.
 */
const auditPgSchema = pgSchema("audit");

export const auditEntries = auditPgSchema.table(
  "audit_entries",
  {
    spanId: text("span_id").primaryKey(),
    traceId: text("trace_id").notNull(),
    parentSpanId: text("parent_span_id"),
    rootSpanId: text("root_span_id").notNull(),
    depth: integer("depth").notNull(),
    kind: varchar("kind", { length: 16 }).notNull(), // CHECK는 raw DDL에서

    // execution kind
    apiId: text("api_id"),
    actorUserId: text("actor_user_id"),
    actorTenantId: text("actor_tenant_id"),
    targetKind: text("target_kind"),
    targetId: text("target_id"),
    outcome: varchar("outcome", { length: 16 }),

    // check kind
    pass: varchar("pass", { length: 16 }),
    address: integer("address"),
    unionKind: text("union_kind"),
    denyReason: text("deny_reason"),

    startedAt: text("started_at").notNull(),
    endedAt: text("ended_at"),
    metadata: jsonb("metadata"),
  },
  (t) => [
    index("idx_audit_trace_pg").on(t.traceId),
    index("idx_audit_root_pg").on(t.rootSpanId),
    index("idx_audit_parent_pg").on(t.parentSpanId),
    index("idx_audit_actor_pg").on(t.actorUserId, t.startedAt),
    index("idx_audit_target_pg").on(t.targetKind, t.targetId),
  ],
);

/**
 * PG raw DDL — Drizzle Kit 마이그레이션 정착 전까지 fixture/migration용.
 * RLS는 placeholder (`ENABLE`만 + 임시 allow-all 정책 — Phase 3에서 정교화).
 *
 * grant는 fixture 환경에서는 superuser/qa_admin이 모두 수행 가능하므로 주석으로만 명시.
 * 실 운영 환경의 audit_app role grant는 init.sql(Plan 04a)에서 단일 책임으로 부여한다.
 */
export const AUDIT_ENTRIES_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS audit.audit_entries (
  span_id           TEXT PRIMARY KEY,
  trace_id          TEXT NOT NULL,
  parent_span_id    TEXT,
  root_span_id      TEXT NOT NULL,
  depth             INTEGER NOT NULL,
  kind              VARCHAR(16) NOT NULL CHECK (kind IN ('execution','check')),
  api_id            TEXT,
  actor_user_id     TEXT,
  actor_tenant_id   TEXT,
  target_kind       TEXT,
  target_id         TEXT,
  outcome           VARCHAR(16) CHECK (outcome IS NULL OR outcome IN ('allow','deny','error')),
  pass              VARCHAR(16) CHECK (pass IS NULL OR pass IN ('bitmap','lifecycle','cerbos','acl')),
  address           INTEGER,
  union_kind        TEXT,
  deny_reason       TEXT,
  started_at        TEXT NOT NULL,
  ended_at          TEXT,
  metadata          JSONB
);
CREATE INDEX IF NOT EXISTS idx_audit_trace_pg  ON audit.audit_entries(trace_id);
CREATE INDEX IF NOT EXISTS idx_audit_root_pg   ON audit.audit_entries(root_span_id);
CREATE INDEX IF NOT EXISTS idx_audit_parent_pg ON audit.audit_entries(parent_span_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor_pg  ON audit.audit_entries(actor_user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_audit_target_pg ON audit.audit_entries(target_kind, target_id);

-- RLS placeholder — Phase 3 RLS plan에서 정책 추가
ALTER TABLE audit.audit_entries ENABLE ROW LEVEL SECURITY;
-- 임시 fallback 정책 (Phase 3에서 더 정교한 정책으로 교체):
CREATE POLICY ae_temp_allow_all ON audit.audit_entries
  USING (true)
  WITH CHECK (true);

-- grant 모델 (init.sql에서 부여, 본 DDL은 도메인 의도 기록용 주석):
--   GRANT USAGE          ON SCHEMA audit                      TO audit_app;
--   GRANT SELECT, INSERT ON audit.audit_entries               TO audit_app;
--   GRANT USAGE          ON SCHEMA audit                      TO qa_admin;
--   GRANT SELECT         ON audit.audit_entries               TO qa_admin;
-- UPDATE(finishExecution)은 별도 audit_writer role에서 수행 — Phase 3에서 분리.
`;
```

- [ ] **Step 2: typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter audit-recorder-store typecheck
```

Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/audit-recorder-store/src/pg/schema.ts && git commit -m "$(cat <<'EOF'
feat(audit-recorder-store): pg/schema.ts — audit.audit_entries + DDL

pgSchema("audit") + raw DDL 병행 (Drizzle Kit 정착 전까지).
metadata는 jsonb (PG 네이티브). RLS placeholder + audit_app SELECT/INSERT-only grant 주석.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: pg/adapter.ts — PgAuditRecorder

**Files:**
- Create: `packages/audit-recorder-store/src/pg/adapter.ts`

`SqliteAuditRecorder`와 동일 비즈니스 로직 — 트리 구축(parent 조회로 rootSpanId/depth 계산), kind 분기, parent 누락 시 `ParentNotFoundError`, finishExecution 시 kind 검사, listByRoot 정렬 invariant. 차이는 driver type + metadata jsonb 직접 저장(SQLite는 text JSON-string)뿐.

- [ ] **Step 1: adapter.ts 작성**

`packages/audit-recorder-store/src/pg/adapter.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * PgAuditRecorder — AuditRecorder의 PostgreSQL 영속 구현.
 *
 * SqliteAuditRecorder와 동일 비즈니스 invariant:
 *   - parent=null → rootSpanId=self, depth=0
 *   - parent 있으면 rootSpanId/depth는 parent에서 상속
 *   - parent 없으면 ParentNotFoundError
 *   - finishExecution은 execution kind에만 — 그 외는 throw
 *   - listByRoot는 (depth asc, startedAt asc) 정렬
 *
 * dialect 차이:
 *   - driver type (PostgresJsDatabase)
 *   - metadata는 jsonb 직접 저장 (SQLite는 text JSON-string)
 *
 * 트리 구축 로직은 SqliteAuditRecorder와 동일 코드 — 순수 함수 추출은
 * Plan 06c factory 정착 후 별도 후속 plan에서 (현재는 양쪽 maintain 비용 < 추출 비용 판단).
 */

import { asc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import {
  EntryNotFoundError,
  ParentNotFoundError,
  type AuditEntry,
  type AuditOutcome,
  type AuditRecorder,
  type CheckEntry,
  type ExecutionEntry,
  type RecordCheckArgs,
  type RecordExecutionArgs,
} from "permission-engine";

import { auditEntries } from "./schema.js";

type Row = typeof auditEntries.$inferSelect;
type Insert = typeof auditEntries.$inferInsert;

function toEntry(row: Row): AuditEntry {
  const base = {
    spanId: row.spanId,
    traceId: row.traceId,
    parentSpanId: row.parentSpanId,
    rootSpanId: row.rootSpanId,
    depth: row.depth,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    // PG jsonb는 driver가 이미 객체로 반환 — 추가 parse 불필요
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
  };

  if (row.kind === "execution") {
    return {
      ...base,
      kind: "execution",
      apiId: row.apiId ?? "",
      actorUserId: row.actorUserId ?? "",
      actorTenantId: row.actorTenantId ?? undefined,
      targetKind: row.targetKind ?? "",
      targetId: row.targetId ?? "",
      outcome: row.outcome as ExecutionEntry["outcome"],
    };
  }

  return {
    ...base,
    kind: "check",
    pass: row.pass as CheckEntry["pass"],
    outcome: ((row.outcome ?? "allow") as AuditOutcome),
    address: row.address ?? undefined,
    unionKind: row.unionKind ?? undefined,
    denyReason: row.denyReason ?? undefined,
  };
}

function executionToRow(e: ExecutionEntry): Insert {
  return {
    spanId: e.spanId,
    traceId: e.traceId,
    parentSpanId: e.parentSpanId,
    rootSpanId: e.rootSpanId,
    depth: e.depth,
    kind: "execution",
    apiId: e.apiId,
    actorUserId: e.actorUserId,
    actorTenantId: e.actorTenantId ?? null,
    targetKind: e.targetKind,
    targetId: e.targetId,
    outcome: e.outcome,
    pass: null,
    address: null,
    unionKind: null,
    denyReason: null,
    startedAt: e.startedAt,
    endedAt: e.endedAt,
    metadata: e.metadata ?? null, // jsonb — 객체 직접 저장
  };
}

function checkToRow(c: CheckEntry): Insert {
  return {
    spanId: c.spanId,
    traceId: c.traceId,
    parentSpanId: c.parentSpanId,
    rootSpanId: c.rootSpanId,
    depth: c.depth,
    kind: "check",
    apiId: null,
    actorUserId: null,
    actorTenantId: null,
    targetKind: null,
    targetId: null,
    outcome: c.outcome,
    pass: c.pass,
    address: c.address ?? null,
    unionKind: c.unionKind ?? null,
    denyReason: c.denyReason ?? null,
    startedAt: c.startedAt,
    endedAt: c.endedAt,
    metadata: c.metadata ?? null,
  };
}

export class PgAuditRecorder implements AuditRecorder {
  constructor(private readonly db: PostgresJsDatabase) {}

  async startExecution(args: RecordExecutionArgs): Promise<ExecutionEntry> {
    let rootSpanId: string;
    let depth: number;

    if (args.parentSpanId === null) {
      rootSpanId = args.spanId;
      depth = 0;
    } else {
      const parent = await this.get(args.parentSpanId);
      if (!parent) throw new ParentNotFoundError(args.parentSpanId);
      rootSpanId = parent.rootSpanId;
      depth = parent.depth + 1;
    }

    const now = args.now ?? new Date().toISOString();
    const entry: ExecutionEntry = {
      kind: "execution",
      spanId: args.spanId,
      traceId: args.traceId,
      parentSpanId: args.parentSpanId,
      rootSpanId,
      depth,
      apiId: args.apiId,
      actorUserId: args.actorUserId,
      actorTenantId: args.actorTenantId,
      targetKind: args.targetKind,
      targetId: args.targetId,
      outcome: null,
      startedAt: now,
      endedAt: null,
      metadata: args.metadata,
    };

    await this.db.insert(auditEntries).values(executionToRow(entry));
    return entry;
  }

  async finishExecution(
    spanId: string,
    outcome: AuditOutcome,
    now?: string,
  ): Promise<ExecutionEntry> {
    const cur = await this.get(spanId);
    if (!cur) throw new EntryNotFoundError(spanId);
    if (cur.kind !== "execution") {
      throw new Error(`finishExecution called on non-execution entry: ${spanId}`);
    }
    const endedAt = now ?? new Date().toISOString();
    await this.db
      .update(auditEntries)
      .set({ outcome, endedAt })
      .where(eq(auditEntries.spanId, spanId));
    return { ...cur, outcome, endedAt };
  }

  async recordCheck(args: RecordCheckArgs): Promise<CheckEntry> {
    const parent = await this.get(args.parentSpanId);
    if (!parent) throw new ParentNotFoundError(args.parentSpanId);

    const now = args.now ?? new Date().toISOString();
    const entry: CheckEntry = {
      kind: "check",
      spanId: args.spanId,
      traceId: args.traceId,
      parentSpanId: args.parentSpanId,
      rootSpanId: parent.rootSpanId,
      depth: parent.depth + 1,
      pass: args.pass,
      outcome: args.outcome,
      address: args.address,
      unionKind: args.unionKind,
      denyReason: args.denyReason,
      startedAt: now,
      endedAt: now,
      metadata: args.metadata,
    };
    await this.db.insert(auditEntries).values(checkToRow(entry));
    return entry;
  }

  async get(spanId: string): Promise<AuditEntry | null> {
    const rows = await this.db
      .select()
      .from(auditEntries)
      .where(eq(auditEntries.spanId, spanId))
      .limit(1);
    return rows.length === 0 ? null : toEntry(rows[0]);
  }

  async listByRoot(rootSpanId: string): Promise<AuditEntry[]> {
    const rows = await this.db
      .select()
      .from(auditEntries)
      .where(eq(auditEntries.rootSpanId, rootSpanId))
      .orderBy(asc(auditEntries.depth), asc(auditEntries.startedAt));
    return rows.map(toEntry);
  }

  async firstFailure(rootSpanId: string): Promise<AuditEntry | null> {
    const all = await this.listByRoot(rootSpanId);
    for (const e of all) {
      if (e.outcome === "deny" || e.outcome === "error") return e;
    }
    return null;
  }
}
```

- [ ] **Step 2: index.ts re-export 추가**

`packages/audit-recorder-store/src/index.ts` 끝에:

```ts
// PG 어댑터 (Plan 06b)
export { PgAuditRecorder } from "./pg/adapter.js";
export { auditEntries as auditEntriesPg, AUDIT_ENTRIES_PG_DDL } from "./pg/schema.js";
```

`auditEntriesPg` alias 사용 — SQLite 버전과 이름 충돌 회피 (Plan 05b 패턴 준용).

- [ ] **Step 3: typecheck + build**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter audit-recorder-store typecheck && pnpm --filter audit-recorder-store build
```

Expected: 에러 없음. dist에 두 어댑터 모두 노출:

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep "PgAuditRecorder\|SqliteAuditRecorder\|DrizzleAuditRecorder" packages/audit-recorder-store/dist/index.d.ts
```

Expected: 셋 모두 export.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/audit-recorder-store/src && git commit -m "$(cat <<'EOF'
feat(audit-recorder-store): pg/adapter.ts — PgAuditRecorder

SqliteAuditRecorder와 동일 트리 invariant — driver type + metadata jsonb만 다름.
public exports에 PG schema alias 추가 (auditEntriesPg).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: pg/adapter.test.ts — PG-specific 검증 (env gate)

**Files:**
- Create: `packages/audit-recorder-store/src/pg/adapter.test.ts`

contract test (Plan 06c)와 별도. 본 파일은 PG-specific edge:
- random schema fixture round-trip
- jsonb metadata 직접 저장·조회 (string parse 없음)
- CHECK constraint (kind/outcome/pass invalid → throw)
- RLS placeholder 임시 정책 통과
- audit 도메인 write-mostly 모델 — INSERT 후 SELECT 동작

- [ ] **Step 1: 테스트 작성**

`packages/audit-recorder-store/src/pg/adapter.test.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

import { PgAuditRecorder } from "./adapter.js";
import { AUDIT_ENTRIES_PG_DDL } from "./schema.js";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

describe.skipIf(!PG_AVAILABLE)("PgAuditRecorder — PG-specific", () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? "localhost";
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? "5434");
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test";
  const PG_USER = process.env.QA_TEST_PG_USER ?? "qa_admin";
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? "";

  let sql: ReturnType<typeof postgres>;
  let recorder: PgAuditRecorder;
  let testSchema: string;

  beforeEach(async () => {
    testSchema = `test_${randomBytes(4).toString("hex")}`;
    sql = postgres({
      host: PG_HOST, port: PG_PORT, database: PG_DATABASE,
      user: PG_USER, password: PG_PASSWORD, max: 5, onnotice: () => {},
    });
    // 테스트 schema 생성 + DDL의 'audit.' qualified prefix를 testSchema로 치환
    const ddl = AUDIT_ENTRIES_PG_DDL
      .replaceAll("audit.audit_entries", `${testSchema}.audit_entries`)
      .replace("CREATE SCHEMA IF NOT EXISTS audit", `CREATE SCHEMA IF NOT EXISTS ${testSchema}`);
    await sql.unsafe(ddl);
    await sql`SET search_path TO ${sql(testSchema)}, public`;
    recorder = new PgAuditRecorder(drizzle(sql));
  });

  afterEach(async () => {
    try { await sql`DROP SCHEMA ${sql(testSchema)} CASCADE`; } finally { await sql.end(); }
  });

  it("startExecution + get — root execution 트리 invariant 유지", async () => {
    const e = await recorder.startExecution({
      spanId: "root", traceId: "t1", parentSpanId: null,
      apiId: "A", actorUserId: "u", targetKind: "transaction", targetId: "tx-A",
    });
    expect(e.rootSpanId).toBe("root");
    expect(e.depth).toBe(0);
    const got = await recorder.get("root");
    expect(got?.kind).toBe("execution");
  });

  it("metadata는 jsonb로 저장·복원 (string parse 없음)", async () => {
    await recorder.startExecution({
      spanId: "e", traceId: "t", parentSpanId: null,
      apiId: "A", actorUserId: "u", targetKind: "resource", targetId: "r",
      metadata: { source: "http", reqId: "abc-123", nested: { count: 7 } },
    });
    const got = await recorder.get("e");
    expect(got?.metadata).toEqual({ source: "http", reqId: "abc-123", nested: { count: 7 } });

    // raw 컬럼이 jsonb인지 확인 — text가 아닌 object 비교가 가능
    const raw = await sql<{ metadata: unknown }[]>`
      SELECT metadata FROM ${sql(testSchema)}.audit_entries WHERE span_id = 'e'
    `;
    expect(typeof raw[0].metadata).toBe("object");
  });

  it("CHECK constraint — invalid kind 거절", async () => {
    await expect(
      sql`INSERT INTO ${sql(testSchema)}.audit_entries
          (span_id, trace_id, root_span_id, depth, kind, started_at)
          VALUES ('bad', 't', 'bad', 0, 'INVALID_KIND', '2026-04-22')`,
    ).rejects.toThrow();
  });

  it("CHECK constraint — invalid outcome 거절", async () => {
    await expect(
      sql`INSERT INTO ${sql(testSchema)}.audit_entries
          (span_id, trace_id, root_span_id, depth, kind, outcome, started_at)
          VALUES ('bad', 't', 'bad', 0, 'execution', 'INVALID_OUTCOME', '2026-04-22')`,
    ).rejects.toThrow();
  });

  it("RLS placeholder 정책이 임시 통과 (ae_temp_allow_all) — INSERT/SELECT 양쪽", async () => {
    // RLS는 enabled이지만 임시 정책으로 모두 통과해야 함
    await recorder.startExecution({
      spanId: "rls-test", traceId: "t", parentSpanId: null,
      apiId: "A", actorUserId: "u", targetKind: "resource", targetId: "r",
    });
    const got = await recorder.get("rls-test");
    expect(got).not.toBeNull();
  });

  it("listByRoot — depth asc, startedAt asc 정렬 (PG 인덱스 사용)", async () => {
    const t0 = "2026-04-22T10:00:00.000Z";
    const t1 = "2026-04-22T10:00:01.000Z";
    const t2 = "2026-04-22T10:00:02.000Z";
    await recorder.startExecution({
      spanId: "r", traceId: "t", parentSpanId: null,
      apiId: "A", actorUserId: "u", targetKind: "transaction", targetId: "A", now: t0,
    });
    await recorder.startExecution({
      spanId: "c1", traceId: "t", parentSpanId: "r",
      apiId: "B", actorUserId: "u", targetKind: "resource", targetId: "r1", now: t1,
    });
    await recorder.recordCheck({
      spanId: "chk", traceId: "t", parentSpanId: "c1",
      pass: "bitmap", outcome: "allow", now: t2,
    });
    const list = await recorder.listByRoot("r");
    expect(list.map((e) => e.spanId)).toEqual(["r", "c1", "chk"]);
    expect(list.map((e) => e.depth)).toEqual([0, 1, 2]);
  });

  it("write-mostly 모델 — finishExecution UPDATE 동작 (audit_writer role 가정)", async () => {
    // 본 테스트는 qa_admin으로 실행되므로 UPDATE 통과 — 실 운영에서는 audit_writer role 필요
    await recorder.startExecution({
      spanId: "e", traceId: "t", parentSpanId: null,
      apiId: "A", actorUserId: "u", targetKind: "resource", targetId: "r",
    });
    const done = await recorder.finishExecution("e", "allow", "2026-04-22T10:05:00Z");
    expect(done.outcome).toBe("allow");
    expect(done.endedAt).toBe("2026-04-22T10:05:00Z");
  });
});
```

- [ ] **Step 2: PG 환경 변수로 실행**

```bash
QA_TEST_PG=1 \
  QA_TEST_PG_PASSWORD=$(grep QA_SDK_ADMIN_PASSWORD /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter audit-recorder-store test -- pg/adapter
```

Expected: 7 PASS (qa-sdk-db 부팅 가정).

- [ ] **Step 3: 환경 변수 없을 때 skip 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter audit-recorder-store test -- pg/adapter
```

Expected: PG suite 자체 skip (`describe.skipIf`로). 다른 SQLite 테스트는 정상.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/audit-recorder-store/src && git commit -m "$(cat <<'EOF'
test(audit-recorder-store): pg/adapter PG-specific 단위

env gate (QA_TEST_PG=1) — qa-sdk-db 컨테이너 의존.
jsonb metadata + CHECK constraint + RLS placeholder + 트리 정렬 검증.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 회귀

- [ ] **Step 1: SQLite 어댑터 회귀 (Plan 06a 결과 영향 없음)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter audit-recorder-store test 2>&1 | tail -10
```

Expected: SQLite + e2e 모두 통과. PG는 env 없으면 skip.

- [ ] **Step 2: permission-engine 회귀 (인터페이스 호환성)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter permission-engine test 2>&1 | tail -5
```

Expected: 통과. AuditRecorder 인터페이스 변경 없음 안전망.

- [ ] **Step 3: resource-policy-store 회귀 (sibling 안전망)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter resource-policy-store test 2>&1 | tail -5
```

Expected: 통과.

- [ ] **Step 4: 의존자 typecheck (있으면)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter "...^audit-recorder-store" typecheck 2>&1 | tail -5
```

Expected: 에러 없음.

---

## Self-Review

- [ ] `pg/schema.ts`가 `pgSchema("audit")` 사용 + RLS ENABLE + audit_app grant 모델 주석 명시
- [ ] `PgAuditRecorder`가 SqliteAuditRecorder와 동일 트리 invariant (parent=null root, parent 없으면 ParentNotFoundError, finishExecution kind 검사)
- [ ] metadata는 PG에서 jsonb 직접 저장·복원 (string parse 없음)
- [ ] PG-specific 테스트 7건 (env gate)
- [ ] postgres peerDep optional (dialect-only 환경 지원)
- [ ] SQLite 회귀 0
- [ ] permission-engine·resource-policy-store 회귀 0

---

## Defer

| 작업 | 이유 |
|---|---|
| RLS 본격 정책 (`current_setting('audit.actor_id')` 기반 등) | Phase 3 RLS plan |
| audit_writer role 분리 (UPDATE 권한 격리) | Phase 3 — 현재는 admin role로 통합 운영 |
| Drizzle Kit 마이그레이션 (raw DDL 대신) | 패턴 안정 후 — 별도 후속 plan |
| 트리 구축 로직 순수 함수 추출 (Sqlite/Pg 공유) | 06c factory 정착 후 — 양쪽 코드 drift 발견 시 우선 추출 |
| jsonb GIN index (metadata 검색) | 실 트래픽 metadata 검색 패턴 측정 후 |
| audit 시계열 partition (대량 데이터 대응) | Phase 4 운영 부하 측정 후 |

---

## 의존·후속

- **Plan 06a**: 본 plan의 직접 의존 (sqlite/ 평행 구조).
- **Plan 04a/04c**: PG 컨테이너 + db-bootstrap fixture는 본 plan 테스트에서 사용. 04a init.sql에 `audit_app` role grant 정의 필수.
- **Plan 06c** (factory + contract test): 본 plan 완료 후. 양쪽 어댑터를 hooking.
- **Phase 3 RLS plan**: 본 plan의 placeholder 정책 + grant 모델을 본격 정책으로 교체.
