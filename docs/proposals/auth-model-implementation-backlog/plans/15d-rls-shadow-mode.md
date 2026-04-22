# Plan 15d — RLS Shadow Mode (정책 적용 측정 + false positive 분석)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `authorization-ontology-rls-enforcement.spec.md` §방법 **Phase 4 — shadow mode** 를 구현한다. Plan 15b 에서 정의된 RLS 정책이 이미 `ENABLE ROW LEVEL SECURITY` 상태이지만 `FORCE` 가 없어 일반 role 에만 적용되는 단계를 **shadow 검증 기간**으로 활용한다. 본 plan 은 (1) 정책이 각 쿼리에서 allow/deny 했을지 **판정만 수집**해 실제 차단은 하지 않는 감사 테이블 `audit.rls_shadow_decisions` 추가, (2) application-level 에서 이미 allow 된 요청 중 RLS 가 deny 했을 결과를 기록하는 Interceptor hook, (3) 측정 CLI (`qa-sdk shadow report`), (4) false positive 분석 문서 템플릿을 제공한다. 본 단계가 Plan 15e 의 enforce 진입 전제.

**Architecture:**
- **shadow 의 정의 — 본 저장소 맥락**: spec §방법 Phase 4 는 "정책을 FORCE 없이 활성화, RLS 거절 로그만 수집" 이라고 정의. Plan 15b 시점에 정책은 이미 ENABLE 상태지만 `auth_app` 등 일반 role 이 호출하면 실제 차단된다 — 즉 application-level 에서도 실제로 쿼리가 실패할 수 있음. 따라서 본 plan 의 shadow 는 **2 모드 지원**:
  - **mode A (safe shadow)**: application-level 이 이미 허가한 요청에서 "동일 쿼리를 RLS 없이 실행했을 때 반환되는 row 와 RLS 적용 결과의 diff" 를 부가 트랜잭션으로 계산하고 기록. 실제 차단은 application layer 의 deny 를 따름.
  - **mode B (observability-only)**: Plan 15c 의 Interceptor 가 `request.user.rlsEvaluation` 에 판정 결과를 주입 → 감사 로그만. 기본값.
- 본 plan 은 **mode B 우선** + admin/superuser 연결에서 parallel shadow query (mode A) 를 옵션으로 제공.
- **shadow 기록 테이블** (`audit.rls_shadow_decisions`):
  - `id TEXT PK` — UUID
  - `occurred_at TIMESTAMPTZ NOT NULL`
  - `user_id TEXT` (세션의 userId)
  - `tenant_id TEXT`
  - `resource_table TEXT NOT NULL` — 'auth.resource_policies' 등
  - `operation TEXT NOT NULL` — 'select' | 'insert' | 'update' | 'delete'
  - `application_decision TEXT NOT NULL` — 'allow' | 'deny'
  - `rls_would_decision TEXT NOT NULL` — 'allow' | 'deny' | 'unknown'
  - `divergence BOOLEAN GENERATED ALWAYS AS (application_decision <> rls_would_decision) STORED`
  - `deny_reason TEXT` — RLS deny 시 원인 요약 (bitmap bit 미설정 / owner 불일치 / tenant 불일치 / default deny 등)
  - `request_id TEXT` — trace span id (audit.audit_entries.trace_id 와 join 가능)
  - index: `idx_shadow_divergence`, `idx_shadow_time`, `idx_shadow_user`
- **판정 로직**: Plan 15c 의 `RlsContextInterceptor` 는 이미 `RlsSessionContext` 를 알고 있다. shadow evaluator 는 다음 조건으로 RLS would decision 을 **TS-level 으로 예측** (DB 왕복 없이):
  - bitmap_mask null 이거나 필요한 bit 가 unset → `rls_would=deny`, reason `bitmap_bit_missing`
  - userId null → `rls_would=deny`, reason `user_id_missing`
  - tenantId null 인데 대상 테이블이 tenant 경계 (ingest.*) → `rls_would=deny`, reason `tenant_id_missing`
  - role='admin' → `rls_would=allow`, reason `admin_bypass`
  - 그 외: resource_id 가 주어진 경우 state 조회가 필요 → `rls_would=unknown`, reason `needs_db_resolve`
- **shadow CLI** (`qa-sdk shadow report`): `audit.rls_shadow_decisions` 에서 최근 N 시간 divergence 집계 + 테이블·원인별 카운트. false positive 의심 목록 출력.
- **mode A (옵션) parallel shadow**: `qa-sdk shadow sample --table auth.resource_policies --limit 100` — 관리자 세션으로 해당 테이블의 최근 쿼리 샘플을 parallel 실행해 RLS-on vs RLS-off row count diff 측정. 본 plan 에서는 스캐폴딩만 + 별도 smoke.
- **성능 제약**: shadow 기록이 hot path 성능을 훼손하지 않도록 **fire-and-forget INSERT** 사용 (postgres `sql.unsafe(..., [])` 의 non-await 경로) — 에러 삼킴 방지는 logger.error 로.

**Tech Stack:**
- `db-bootstrap` (Plan 15c) — interceptor 확장
- `@qa-sdk/logger` — shadow 기록 실패 로깅
- `@qa-sdk/cli` — `shadow report` 서브커맨드
- 신규 schema: `audit` 안 테이블 1개 (기존 `audit_entries` 와 독립)

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `packages/audit-recorder-store/src/pg/shadow-schema.ts` | `audit.rls_shadow_decisions` Drizzle + DDL |
| `packages/audit-recorder-store/src/pg/shadow-schema.test.ts` | DDL 적용 + 기본 INSERT/SELECT (env gate) |
| `packages/audit-recorder-store/src/pg/shadow-recorder.ts` | `PgRlsShadowRecorder` — fire-and-forget INSERT |
| `packages/audit-recorder-store/src/pg/shadow-recorder.test.ts` | 기록 실패 시 logger 경로 + 비동기 성공 |
| `packages/db-bootstrap/src/rls-shadow-evaluator.ts` | TS-level RLS 판정 예측 (`predictRlsDecision`) |
| `packages/db-bootstrap/src/rls-shadow-evaluator.test.ts` | 6 시나리오 (bitmap/user/tenant/admin/resource-unknown) |
| `packages/db-bootstrap/src/rls-shadow-interceptor.ts` | `RlsShadowInterceptor` — 기존 `RlsContextInterceptor` extends |
| `packages/db-bootstrap/src/rls-shadow-interceptor.test.ts` | mock recorder 가 application decision 관찰 |
| `packages/cli/src/commands/shadow/report.ts` | `qa-sdk shadow report` 서브커맨드 |
| `packages/cli/src/commands/shadow/report.test.ts` | 집계 SQL + 출력 포맷 |
| `docs/proposals/auth-model-implementation-backlog/shadow-analysis-template.md` | false positive 분석 리포트 템플릿 (draft) |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `packages/audit-recorder-store/src/index.ts` | shadow schema / recorder re-export |
| `packages/db-bootstrap/src/index.ts` | evaluator / shadow interceptor re-export |
| `packages/cli/src/index.ts` | `shadow` 명령 등록 |

---

## Task 0: baseline

- [ ] **Step 1: 15a/15b/15c 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls packages/infra-engine/init/qa-sdk-db-helpers.sql && \
  grep -n "RP_READ_BIT" packages/resource-policy-store/src/pg/rls-bits.ts && \
  ls packages/db-bootstrap/src/rls-session.ts && \
  ls packages/db-bootstrap/src/rls-nest-interceptor.ts
```

Expected: 4 hit. 미완료 시 선행 plan 먼저 종료.

- [ ] **Step 2: 현재 audit-recorder-store 테스트 baseline**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter audit-recorder-store test 2>&1 | tail -5
```

Expected: 기존 전부 PASS.

---

## Task 1: shadow-schema.ts — audit.rls_shadow_decisions

**Files:**
- Create: `packages/audit-recorder-store/src/pg/shadow-schema.ts`
- Create: `packages/audit-recorder-store/src/pg/shadow-schema.test.ts`
- Modify: `packages/audit-recorder-store/src/index.ts`

- [ ] **Step 1: schema 작성**

`packages/audit-recorder-store/src/pg/shadow-schema.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import { boolean, index, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

const auditSchema = pgSchema("audit");

/**
 * RLS shadow-mode 기록 테이블 (Plan 15d).
 * application-layer 판정 과 TS-level RLS 예측 판정을 쌍으로 기록해 divergence 를 분석.
 */
export const rlsShadowDecisions = auditSchema.table(
  "rls_shadow_decisions",
  {
    id: text("id").primaryKey(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    userId: text("user_id"),
    tenantId: text("tenant_id"),
    resourceTable: text("resource_table").notNull(),
    operation: text("operation").notNull(),              // 'select' | 'insert' | 'update' | 'delete'
    applicationDecision: text("application_decision").notNull(),
    rlsWouldDecision: text("rls_would_decision").notNull(),
    divergence: boolean("divergence").notNull(),          // GENERATED column 대신 app 에서 기록
    denyReason: text("deny_reason"),
    requestId: text("request_id"),
  },
  (t) => [
    index("idx_shadow_divergence").on(t.divergence, t.occurredAt),
    index("idx_shadow_time").on(t.occurredAt),
    index("idx_shadow_user").on(t.userId, t.occurredAt),
    index("idx_shadow_table_op").on(t.resourceTable, t.operation),
  ],
);

export const RLS_SHADOW_DECISIONS_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS audit.rls_shadow_decisions (
  id                   TEXT PRIMARY KEY,
  occurred_at          TIMESTAMPTZ NOT NULL,
  user_id              TEXT,
  tenant_id            TEXT,
  resource_table       TEXT NOT NULL,
  operation            TEXT NOT NULL CHECK (operation IN ('select','insert','update','delete')),
  application_decision TEXT NOT NULL CHECK (application_decision IN ('allow','deny')),
  rls_would_decision   TEXT NOT NULL CHECK (rls_would_decision IN ('allow','deny','unknown')),
  divergence           BOOLEAN NOT NULL,
  deny_reason          TEXT,
  request_id           TEXT
);
CREATE INDEX IF NOT EXISTS idx_shadow_divergence ON audit.rls_shadow_decisions(divergence, occurred_at);
CREATE INDEX IF NOT EXISTS idx_shadow_time      ON audit.rls_shadow_decisions(occurred_at);
CREATE INDEX IF NOT EXISTS idx_shadow_user      ON audit.rls_shadow_decisions(user_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_shadow_table_op  ON audit.rls_shadow_decisions(resource_table, operation);

-- shadow 테이블은 admin 만 read — RLS 정책.
ALTER TABLE audit.rls_shadow_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY shadow_admin_bypass ON audit.rls_shadow_decisions
  FOR ALL
  USING (auth.current_role_tag() = 'admin')
  WITH CHECK (auth.current_role_tag() = 'admin');

CREATE POLICY shadow_insert_self ON audit.rls_shadow_decisions
  FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.current_user_id());
`;
```

- [ ] **Step 2: 기본 테스트**

`packages/audit-recorder-store/src/pg/shadow-schema.test.ts`:

```ts
import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { RLS_SHADOW_DECISIONS_PG_DDL } from "./shadow-schema.js";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

describe.skipIf(!PG_AVAILABLE)("audit.rls_shadow_decisions schema", () => {
  const adminCfg = {
    host: process.env.QA_TEST_PG_HOST ?? "localhost",
    port: Number(process.env.QA_TEST_PG_PORT ?? "5434"),
    database: process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test",
    user: "qa_admin", password: process.env.QA_TEST_PG_PASSWORD ?? "",
  };
  let sql: ReturnType<typeof postgres>;
  let schema: string;

  beforeEach(async () => {
    schema = `shadow_${randomBytes(4).toString("hex")}`;
    sql = postgres({ ...adminCfg, max: 2, onnotice: () => {} });
    const ddl = RLS_SHADOW_DECISIONS_PG_DDL
      .replaceAll("audit.rls_shadow_decisions", `${schema}.rls_shadow_decisions`)
      .replace("CREATE SCHEMA IF NOT EXISTS audit", `CREATE SCHEMA IF NOT EXISTS ${schema}`)
      .replaceAll("ON audit.rls_shadow_decisions", `ON ${schema}.rls_shadow_decisions`);
    await sql.unsafe(ddl);
  });
  afterEach(async () => {
    try { await sql.unsafe(`DROP SCHEMA ${schema} CASCADE`); } finally { await sql.end(); }
  });

  it("INSERT + SELECT — admin bypass 로 통과", async () => {
    await sql.begin(async (tx) => {
      await tx`SELECT set_config('app.role', 'admin', true)`;
      await tx`INSERT INTO ${tx(schema)}.rls_shadow_decisions
        (id, occurred_at, user_id, resource_table, operation, application_decision, rls_would_decision, divergence, deny_reason)
        VALUES ('s1', now(), 'alice', 'auth.resource_policies', 'select', 'allow', 'deny', true, 'bitmap_bit_missing')`;
      const rows = await tx`SELECT id FROM ${tx(schema)}.rls_shadow_decisions`;
      expect(rows.length).toBe(1);
    });
  });

  it("CHECK constraint — invalid operation 차단", async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx`SELECT set_config('app.role', 'admin', true)`;
        await tx`INSERT INTO ${tx(schema)}.rls_shadow_decisions (id, occurred_at, resource_table, operation, application_decision, rls_would_decision, divergence) VALUES ('x', now(), 't', 'truncate', 'allow', 'allow', false)`;
      }),
    ).rejects.toThrow(/check constraint/i);
  });
});
```

- [ ] **Step 3: index.ts re-export**

```ts
export { rlsShadowDecisions, RLS_SHADOW_DECISIONS_PG_DDL } from "./pg/shadow-schema.js";
```

- [ ] **Step 4: typecheck + test**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter audit-recorder-store typecheck && \
  QA_TEST_PG=1 \
  QA_TEST_PG_PASSWORD=$(grep '^QA_SDK_ADMIN_PASSWORD=' packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter audit-recorder-store test -- shadow-schema
```

Expected: 2 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/audit-recorder-store/src/pg/shadow-schema.ts \
          packages/audit-recorder-store/src/pg/shadow-schema.test.ts \
          packages/audit-recorder-store/src/index.ts && \
  git commit -m "$(cat <<'EOF'
feat(audit-recorder-store): audit.rls_shadow_decisions 테이블 + DDL

shadow-mode 기록 스키마 — application 판정 vs RLS 예측 판정 쌍.
admin bypass + insert_self 정책 2종.
4 인덱스 (divergence/time/user/table_op) — shadow report 조회 최적화.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: rls-shadow-evaluator.ts — TS-level RLS 예측

**Files:**
- Create: `packages/db-bootstrap/src/rls-shadow-evaluator.ts`
- Create: `packages/db-bootstrap/src/rls-shadow-evaluator.test.ts`

- [ ] **Step 1: evaluator 작성**

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import type { RlsSessionContext } from "./rls-session.js";

/** shadow 기록의 인자. */
export interface RlsShadowQuery {
  resourceTable: string;          // 'auth.resource_policies' 등
  operation: "select" | "insert" | "update" | "delete";
  requiredBit?: number;           // 해당 op 에 필요한 bitmap bit. undefined 면 bit 검사 skip
  tenantScoped?: boolean;         // ingest.* 처럼 tenant 경계가 필수인 테이블
  ownerField?: "user_id_match" | "actor_match" | "none";
}

export type RlsWouldDecision = "allow" | "deny" | "unknown";

export interface RlsShadowPrediction {
  decision: RlsWouldDecision;
  denyReason: string | null;
}

/**
 * TS-level 예측 — DB 왕복 없이 context 만으로 allow/deny/unknown 결정.
 * state 기반 조건(UNREGISTERED/REGISTERED)은 resource_id 조회가 필요하므로 'unknown'.
 */
export function predictRlsDecision(
  ctx: RlsSessionContext,
  query: RlsShadowQuery,
): RlsShadowPrediction {
  if (ctx.role === "admin") {
    return { decision: "allow", denyReason: null };
  }
  if (!ctx.userId) {
    return { decision: "deny", denyReason: "user_id_missing" };
  }
  if (query.tenantScoped && !ctx.tenantId) {
    return { decision: "deny", denyReason: "tenant_id_missing" };
  }
  if (typeof query.requiredBit === "number") {
    if (!ctx.bitmapMask) {
      return { decision: "deny", denyReason: "bitmap_mask_missing" };
    }
    const byteIdx = Math.floor(query.requiredBit / 8);
    const bitIdx = query.requiredBit % 8;
    if (byteIdx >= ctx.bitmapMask.byteLength) {
      return { decision: "deny", denyReason: "bitmap_bit_missing" };
    }
    if ((ctx.bitmapMask[byteIdx] & (1 << bitIdx)) === 0) {
      return { decision: "deny", denyReason: "bitmap_bit_missing" };
    }
  }
  // owner 일치 여부는 resource_id 없이 결정 불가 → unknown
  if (query.ownerField && query.ownerField !== "none") {
    return { decision: "unknown", denyReason: "needs_db_resolve" };
  }
  return { decision: "allow", denyReason: null };
}
```

- [ ] **Step 2: 테스트**

```ts
import { describe, expect, it } from "vitest";
import { predictRlsDecision } from "./rls-shadow-evaluator.js";

describe("predictRlsDecision", () => {
  const baseCtx = { userId: "alice", tenantId: "acme", bitmapMask: new Uint8Array([0x04]), role: null };

  it("admin → allow", () => {
    expect(predictRlsDecision({ ...baseCtx, role: "admin" }, { resourceTable: "x", operation: "select" }).decision).toBe("allow");
  });

  it("userId 없음 → deny user_id_missing", () => {
    const p = predictRlsDecision({ ...baseCtx, userId: null }, { resourceTable: "x", operation: "select" });
    expect(p.decision).toBe("deny");
    expect(p.denyReason).toBe("user_id_missing");
  });

  it("tenantScoped & tenantId 없음 → deny", () => {
    const p = predictRlsDecision({ ...baseCtx, tenantId: null }, { resourceTable: "ingest.x", operation: "select", tenantScoped: true });
    expect(p.denyReason).toBe("tenant_id_missing");
  });

  it("bitmap 필요한데 mask null → deny bitmap_mask_missing", () => {
    const p = predictRlsDecision({ ...baseCtx, bitmapMask: null }, { resourceTable: "auth.rp", operation: "select", requiredBit: 10 });
    expect(p.denyReason).toBe("bitmap_mask_missing");
  });

  it("bitmap 있지만 bit unset → deny bitmap_bit_missing", () => {
    const p = predictRlsDecision(baseCtx, { resourceTable: "auth.rp", operation: "select", requiredBit: 0 });
    // 0x04 에서 bit 0 은 unset
    expect(p.decision).toBe("deny");
    expect(p.denyReason).toBe("bitmap_bit_missing");
  });

  it("bitmap bit set + owner 경계 → unknown", () => {
    const p = predictRlsDecision(baseCtx, { resourceTable: "auth.rp", operation: "select", requiredBit: 2, ownerField: "user_id_match" });
    expect(p.decision).toBe("unknown");
    expect(p.denyReason).toBe("needs_db_resolve");
  });

  it("모든 조건 충족 — owner 경계 없음 → allow", () => {
    const p = predictRlsDecision(baseCtx, { resourceTable: "t", operation: "select", requiredBit: 2, ownerField: "none" });
    expect(p.decision).toBe("allow");
  });
});
```

- [ ] **Step 3: index.ts re-export**

```ts
export {
  predictRlsDecision,
  type RlsShadowQuery,
  type RlsWouldDecision,
  type RlsShadowPrediction,
} from "./rls-shadow-evaluator.js";
```

- [ ] **Step 4: 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter db-bootstrap test -- rls-shadow-evaluator
```

Expected: 7 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/db-bootstrap/src/rls-shadow-evaluator.ts \
          packages/db-bootstrap/src/rls-shadow-evaluator.test.ts \
          packages/db-bootstrap/src/index.ts && \
  git commit -m "$(cat <<'EOF'
feat(db-bootstrap): predictRlsDecision — TS-level RLS 예측

admin bypass / user_id_missing / tenant_id_missing / bitmap_* / needs_db_resolve 판정.
DB 왕복 없이 context 만으로 allow/deny/unknown 결정 → shadow 기록 훼손 없이 hot path 성능.
7 단위 테스트.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: shadow-recorder.ts — fire-and-forget INSERT

**Files:**
- Create: `packages/audit-recorder-store/src/pg/shadow-recorder.ts`
- Create: `packages/audit-recorder-store/src/pg/shadow-recorder.test.ts`

- [ ] **Step 1: recorder 작성**

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import type { Sql } from "postgres";
import type { RlsShadowPrediction } from "db-bootstrap";
import { randomUUID } from "node:crypto";

export interface ShadowRecordInput {
  userId: string | null;
  tenantId: string | null;
  resourceTable: string;
  operation: "select" | "insert" | "update" | "delete";
  applicationDecision: "allow" | "deny";
  rlsPrediction: RlsShadowPrediction;
  requestId?: string | null;
}

export interface Logger {
  error(payload: object, msg: string): void;
}

/**
 * 쓰기 전용 shadow recorder.
 * Hot path 영향 최소화를 위해 fire-and-forget 반환 — caller 는 await 하지 않는다.
 * INSERT 실패는 logger 로만 기록 (spec §에러 처리 convention).
 */
export class PgRlsShadowRecorder {
  constructor(
    private readonly sql: Sql,
    private readonly logger: Logger,
    private readonly tableRef: string = "audit.rls_shadow_decisions",
  ) {}

  record(input: ShadowRecordInput): void {
    const id = randomUUID();
    const divergence = input.applicationDecision !== input.rlsPrediction.decision;
    // postgres driver 의 tagged template 은 identifier 파라미터화에 sql.unsafe 필요
    const promise = this.sql.unsafe(
      `INSERT INTO ${this.tableRef}
        (id, occurred_at, user_id, tenant_id, resource_table, operation,
         application_decision, rls_would_decision, divergence, deny_reason, request_id)
       VALUES ($1, now(), $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        input.userId,
        input.tenantId,
        input.resourceTable,
        input.operation,
        input.applicationDecision,
        input.rlsPrediction.decision,
        divergence,
        input.rlsPrediction.denyReason,
        input.requestId ?? null,
      ],
    );
    // fire-and-forget — 실패만 로깅
    Promise.resolve(promise).catch((err: unknown) => {
      this.logger.error({ err, shadowId: id }, "rls-shadow 기록 실패");
    });
  }
}
```

- [ ] **Step 2: 테스트 — in-memory fake Sql + logger spy**

```ts
import { describe, expect, it, vi } from "vitest";
import { PgRlsShadowRecorder } from "./shadow-recorder.js";

function fakeSql(successful = true) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const fn = vi.fn(async (sqlStr: string, params: unknown[]) => {
    calls.push({ sql: sqlStr, params });
    if (!successful) throw new Error("simulated PG error");
    return [];
  });
  return Object.assign(fn, { unsafe: fn, calls });
}

describe("PgRlsShadowRecorder", () => {
  it("fire-and-forget INSERT — record 호출은 sync 리턴", async () => {
    const sql = fakeSql(true);
    const logger = { error: vi.fn() };
    const recorder = new PgRlsShadowRecorder(sql as never, logger, "t.shadow");
    recorder.record({
      userId: "alice", tenantId: null,
      resourceTable: "auth.resource_policies",
      operation: "select",
      applicationDecision: "allow",
      rlsPrediction: { decision: "deny", denyReason: "bitmap_bit_missing" },
    });
    // allow microtask drain
    await new Promise((r) => setImmediate(r));
    expect(sql.calls.length).toBe(1);
    expect(sql.calls[0].params).toContain("alice");
    expect(sql.calls[0].params).toContain(true); // divergence
  });

  it("INSERT 실패 → logger.error 호출", async () => {
    const sql = fakeSql(false);
    const logger = { error: vi.fn() };
    const recorder = new PgRlsShadowRecorder(sql as never, logger, "t.shadow");
    recorder.record({
      userId: null, tenantId: null,
      resourceTable: "x", operation: "select",
      applicationDecision: "allow",
      rlsPrediction: { decision: "deny", denyReason: "user_id_missing" },
    });
    await new Promise((r) => setImmediate(r));
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), "rls-shadow 기록 실패");
  });

  it("divergence=false 는 application==prediction 일 때", async () => {
    const sql = fakeSql(true);
    const logger = { error: vi.fn() };
    const recorder = new PgRlsShadowRecorder(sql as never, logger, "t.shadow");
    recorder.record({
      userId: "alice", tenantId: null,
      resourceTable: "x", operation: "select",
      applicationDecision: "allow",
      rlsPrediction: { decision: "allow", denyReason: null },
    });
    await new Promise((r) => setImmediate(r));
    expect(sql.calls[0].params).toContain(false);
  });
});
```

- [ ] **Step 3: index.ts re-export + 커밋**

```ts
export { PgRlsShadowRecorder, type ShadowRecordInput, type Logger as RlsShadowLogger } from "./pg/shadow-recorder.js";
```

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter audit-recorder-store test -- shadow-recorder && \
  git add packages/audit-recorder-store/src/pg/shadow-recorder.ts \
          packages/audit-recorder-store/src/pg/shadow-recorder.test.ts \
          packages/audit-recorder-store/src/index.ts && \
  git commit -m "$(cat <<'EOF'
feat(audit-recorder-store): PgRlsShadowRecorder — fire-and-forget 기록

INSERT 실패는 logger.error({ err }) 로만 — hot path 영향 최소화.
divergence 계산은 TS 에서 수행 (application != prediction).
3 단위 테스트 (fake Sql + logger spy).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: rls-shadow-interceptor.ts — 기존 interceptor 확장

**Files:**
- Create: `packages/db-bootstrap/src/rls-shadow-interceptor.ts`
- Create: `packages/db-bootstrap/src/rls-shadow-interceptor.test.ts`

기존 `RlsContextInterceptor` 는 context bind 만. 본 interceptor 는 response 종료 시점에 shadow record 하나를 남긴다 — request 가 어떤 테이블·op 에 영향을 주었는지는 controller 메타데이터(Reflect) 또는 request.rlsShadow hint 로 결정.

- [ ] **Step 1: interceptor 작성**

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { Injectable, SetMetadata } from "@nestjs/common";
import { Observable, catchError, tap, throwError } from "rxjs";

import { predictRlsDecision, type RlsShadowQuery } from "./rls-shadow-evaluator.js";
import { getCurrentRlsContext } from "./rls-context-storage.js";

/**
 * Controller 메서드에 @RlsShadow({ resourceTable, operation, requiredBit, ... }) 부착.
 */
export const RLS_SHADOW_META = "qa:rls-shadow";
export const RlsShadow = (query: RlsShadowQuery) => SetMetadata(RLS_SHADOW_META, query);

export interface RlsShadowRecorder {
  record(input: {
    userId: string | null;
    tenantId: string | null;
    resourceTable: string;
    operation: "select" | "insert" | "update" | "delete";
    applicationDecision: "allow" | "deny";
    rlsPrediction: ReturnType<typeof predictRlsDecision>;
    requestId?: string | null;
  }): void;
}

@Injectable()
export class RlsShadowInterceptor implements NestInterceptor {
  constructor(
    private readonly recorder: RlsShadowRecorder,
    private readonly options: { enabled?: boolean } = { enabled: true },
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.options.enabled) return next.handle();
    const handler = ctx.getHandler();
    const meta = Reflect.getMetadata(RLS_SHADOW_META, handler) as RlsShadowQuery | undefined;
    if (!meta) return next.handle();

    const req = ctx.switchToHttp().getRequest<{ requestId?: string; id?: string }>();
    const requestId = req.requestId ?? req.id ?? null;
    const rlsCtx = getCurrentRlsContext();
    const prediction = predictRlsDecision(rlsCtx, meta);

    return next.handle().pipe(
      tap(() => {
        this.recorder.record({
          userId: rlsCtx.userId,
          tenantId: rlsCtx.tenantId,
          resourceTable: meta.resourceTable,
          operation: meta.operation,
          applicationDecision: "allow",
          rlsPrediction: prediction,
          requestId,
        });
      }),
      catchError((err) => {
        this.recorder.record({
          userId: rlsCtx.userId,
          tenantId: rlsCtx.tenantId,
          resourceTable: meta.resourceTable,
          operation: meta.operation,
          applicationDecision: "deny",
          rlsPrediction: prediction,
          requestId,
        });
        return throwError(() => err);
      }),
    );
  }
}
```

- [ ] **Step 2: 테스트**

```ts
import { describe, expect, it, vi } from "vitest";
import { of, lastValueFrom, throwError as rxThrow } from "rxjs";
import { RlsShadowInterceptor, RLS_SHADOW_META } from "./rls-shadow-interceptor.js";
import { withRlsContext } from "./rls-context-storage.js";

function mockCtx(metaValue: unknown) {
  const handler = () => {};
  Reflect.defineMetadata(RLS_SHADOW_META, metaValue, handler);
  return {
    switchToHttp: () => ({ getRequest: () => ({ requestId: "r-1" }) }),
    getHandler: () => handler,
  } as never;
}

describe("RlsShadowInterceptor", () => {
  it("meta 없으면 패스스루 — recorder 미호출", async () => {
    const rec = { record: vi.fn() };
    const ic = new RlsShadowInterceptor(rec);
    const execCtx = { switchToHttp: () => ({ getRequest: () => ({}) }), getHandler: () => () => {} } as never;
    const result = await lastValueFrom(ic.intercept(execCtx, { handle: () => of("OK") } as never));
    expect(result).toBe("OK");
    expect(rec.record).not.toHaveBeenCalled();
  });

  it("meta 있고 응답 성공 → applicationDecision=allow 기록", async () => {
    const rec = { record: vi.fn() };
    const ic = new RlsShadowInterceptor(rec);
    const ctxMeta = mockCtx({ resourceTable: "auth.resource_policies", operation: "select", requiredBit: 10, ownerField: "user_id_match" });
    await withRlsContext(
      { userId: "alice", tenantId: null, bitmapMask: new Uint8Array([0x00]), role: null },
      () => lastValueFrom(ic.intercept(ctxMeta, { handle: () => of("OK") } as never)),
    );
    expect(rec.record).toHaveBeenCalledTimes(1);
    const call = rec.record.mock.calls[0][0];
    expect(call.applicationDecision).toBe("allow");
    expect(call.rlsPrediction.denyReason).toBe("bitmap_bit_missing");
    expect(call.requestId).toBe("r-1");
  });

  it("응답 에러 → applicationDecision=deny 기록 + 에러 rethrow", async () => {
    const rec = { record: vi.fn() };
    const ic = new RlsShadowInterceptor(rec);
    const ctxMeta = mockCtx({ resourceTable: "t", operation: "select" });
    await expect(
      withRlsContext(
        { userId: "bob", tenantId: null, bitmapMask: null, role: null },
        () => lastValueFrom(ic.intercept(ctxMeta, { handle: () => rxThrow(() => new Error("boom")) } as never)),
      ),
    ).rejects.toThrow("boom");
    expect(rec.record).toHaveBeenCalledTimes(1);
    expect(rec.record.mock.calls[0][0].applicationDecision).toBe("deny");
  });

  it("enabled=false → 패스스루", async () => {
    const rec = { record: vi.fn() };
    const ic = new RlsShadowInterceptor(rec, { enabled: false });
    const ctxMeta = mockCtx({ resourceTable: "t", operation: "select" });
    await lastValueFrom(ic.intercept(ctxMeta, { handle: () => of("OK") } as never));
    expect(rec.record).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: index.ts + 테스트 + 커밋**

```ts
export {
  RlsShadowInterceptor,
  RlsShadow,
  RLS_SHADOW_META,
  type RlsShadowRecorder,
} from "./rls-shadow-interceptor.js";
```

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter db-bootstrap test -- rls-shadow-interceptor && \
  git add packages/db-bootstrap/src/rls-shadow-interceptor.ts \
          packages/db-bootstrap/src/rls-shadow-interceptor.test.ts \
          packages/db-bootstrap/src/index.ts && \
  git commit -m "$(cat <<'EOF'
feat(db-bootstrap): RlsShadowInterceptor + @RlsShadow 데코레이터

controller 메서드에 @RlsShadow({ resourceTable, operation, requiredBit, ownerField })
부착 → response 시점에 predictRlsDecision 기반 기록.
enabled=false toggle — 운영 환경별 on/off.
4 단위 테스트 (meta 없음 / 성공 / 에러 / disabled).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: qa-sdk shadow report — 집계 CLI

**Files:**
- Create: `packages/cli/src/commands/shadow/report.ts`
- Create: `packages/cli/src/commands/shadow/report.test.ts`
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: command 작성**

```ts
// @def.boundary cli-command
// @def.doc authorization-ontology-rls-enforcement

import type { Sql } from "postgres";

export interface ShadowReportOptions {
  hours: number;     // default 24
  limit: number;     // default 20 (top divergences)
}

export interface ShadowReportRow {
  resourceTable: string;
  operation: string;
  denyReason: string | null;
  divergenceCount: number;
  totalCount: number;
}

export async function runShadowReport(
  sql: Sql,
  options: ShadowReportOptions,
): Promise<ShadowReportRow[]> {
  const rows = await sql<ShadowReportRow[]>`
    SELECT resource_table   AS "resourceTable",
           operation,
           deny_reason      AS "denyReason",
           SUM(CASE WHEN divergence THEN 1 ELSE 0 END)::int AS "divergenceCount",
           COUNT(*)::int                                     AS "totalCount"
      FROM audit.rls_shadow_decisions
     WHERE occurred_at > now() - make_interval(hours => ${options.hours})
     GROUP BY resource_table, operation, deny_reason
     ORDER BY "divergenceCount" DESC
     LIMIT ${options.limit}
  `;
  return rows;
}

export function formatShadowReport(rows: ShadowReportRow[]): string {
  if (rows.length === 0) return "(no shadow activity)";
  const header = "table                          | op     | deny_reason              | diverge / total";
  const sep    = "-".repeat(header.length);
  const lines = rows.map((r) =>
    `${r.resourceTable.padEnd(30)} | ${r.operation.padEnd(6)} | ${(r.denyReason ?? "-").padEnd(24)} | ${String(r.divergenceCount).padStart(8)} / ${String(r.totalCount).padStart(5)}`,
  );
  return [header, sep, ...lines].join("\n");
}
```

- [ ] **Step 2: 테스트 (fake sql 로 집계만)**

```ts
import { describe, expect, it } from "vitest";
import { formatShadowReport } from "./report.js";

describe("formatShadowReport", () => {
  it("빈 배열 → placeholder", () => {
    expect(formatShadowReport([])).toBe("(no shadow activity)");
  });
  it("정상 렌더링 — header + rows", () => {
    const text = formatShadowReport([
      { resourceTable: "auth.resource_policies", operation: "select", denyReason: "bitmap_bit_missing", divergenceCount: 5, totalCount: 12 },
      { resourceTable: "ingest.event_records",    operation: "insert", denyReason: null,                  divergenceCount: 0, totalCount: 8 },
    ]);
    expect(text).toContain("auth.resource_policies");
    expect(text).toContain("bitmap_bit_missing");
    expect(text).toContain("ingest.event_records");
    expect(text.split("\n").length).toBeGreaterThan(2);
  });
});
```

- [ ] **Step 3: cli index 에 등록 (skeleton)**

`packages/cli/src/index.ts` 에 commander/yargs 등록부가 있다면 `shadow report` 서브커맨드 추가. 본 plan 은 명령 등록 스켈레톤만 — argv parsing / PG 연결은 기존 CLI 컨벤션 (db-bootstrap `createConnection`) 따라 호출 코드 추가.

예 (commander 가정):

```ts
import { Command } from "commander";
import { runShadowReport, formatShadowReport } from "./commands/shadow/report.js";
import { createConnection } from "db-bootstrap";
import { loadDbEnv } from "db-bootstrap";

export function registerShadowCommands(program: Command) {
  program
    .command("shadow")
    .command("report")
    .description("RLS shadow-mode divergence 집계")
    .option("--hours <n>", "조회 시간 범위", "24")
    .option("--limit <n>", "top 행 수", "20")
    .action(async (opts: { hours: string; limit: string }) => {
      const env = loadDbEnv(process.env);
      if (env.QA_DB_DIALECT !== "pg") {
        console.error("shadow report 는 PG dialect 에서만 동작 (QA_DB_DIALECT=pg 필요)");
        process.exit(1);
      }
      const conn = await createConnection({
        dialect: "pg",
        pgHost: env.QA_PG_HOST, pgPort: env.QA_PG_PORT,
        pgDatabase: env.QA_PG_DATABASE, pgUser: env.QA_PG_USER,
        pgPassword: env.QA_PG_PASSWORD,
      });
      try {
        const rows = await runShadowReport((conn.db as never as { $client?: Sql }).$client ?? (conn as never), {
          hours: Number(opts.hours), limit: Number(opts.limit),
        });
        console.log(formatShadowReport(rows));
      } finally {
        await conn.close();
      }
    });
}
```

**주의**: CLI 의 실제 program 인스턴스 등록 경로는 기존 `packages/cli/src/index.ts` 구조에 맞게 `registerShadowCommands(program)` 호출 추가.

- [ ] **Step 4: 테스트 + 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/cli test -- shadow && \
  pnpm --filter @qa-sdk/cli typecheck && \
  git add packages/cli/src/commands/shadow/report.ts \
          packages/cli/src/commands/shadow/report.test.ts \
          packages/cli/src/index.ts && \
  git commit -m "$(cat <<'EOF'
feat(@qa-sdk/cli): shadow report — RLS divergence 집계 명령

audit.rls_shadow_decisions 를 hour/limit 으로 집계, table/op/deny_reason GROUP.
formatShadowReport 는 text-table 포맷.
false positive 분석 진입점.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: shadow-analysis-template.md — false positive 분석 리포트 템플릿

**Files:**
- Create: `docs/proposals/auth-model-implementation-backlog/shadow-analysis-template.md`

Phase 5 enforce 진입 전에 운영자가 채워야 할 체크리스트. 본 plan 은 **템플릿 문서 1건** 만 생성 — 실제 분석은 운영 기간 중 기록.

- [ ] **Step 1: 파일 작성**

`docs/proposals/auth-model-implementation-backlog/shadow-analysis-template.md`:

```markdown
# RLS Shadow 분석 리포트 — <기간>

> Plan 15d → Plan 15e 진입 전제. 본 템플릿을 복사해 `shadow-analysis-<yyyy-mm-dd>.md` 로 제출.

## 1. 기간 + 환경
- 기간: <YYYY-MM-DD ~ YYYY-MM-DD>
- 환경: production / staging
- qa-sdk-db 버전 + helper 함수 해시 (select md5(prosrc) from pg_proc ...)

## 2. 트래픽 규모
- `shadow report --hours <N>` 출력
- 총 record 수 / divergence 수 / divergence 비율 (%)

## 3. 도메인별 divergence
- `auth.resource_policies` — divergence X 건, 주 deny_reason Y
- `audit.audit_entries`   — ...
- `ingest.key_observations` — ...
- `ingest.event_records`   — ...

## 4. 주요 false positive (application allow vs RLS would deny)
| id | resource_table | operation | deny_reason | 사용자 action | 분석 |
|----|----|----|----|----|----|
| ... | ... | ... | ... | ... | bitmap 발급 누락 / policy 범위 오류 / context 주입 누락 등 |

## 5. 조치 항목 (enforce 전 해결 필요)
- [ ] bitmap 발급 로직 X 수정 (permission-engine)
- [ ] JWT claim 에 tenantId 항시 포함 (auth-api)
- [ ] admin 경로 role='admin' 주입 (CLI)
- [ ] ...

## 6. enforce 진입 Go/NoGo
- Go 조건: divergence 비율 < 0.1% + 모든 조치 완료 + admin bypass 경로 감사 확인
- 현재 상태: <Go | NoGo | Hold — 이유>

## 7. 참조
- spec: docs/specs/authorization-ontology/authorization-ontology-rls-enforcement.spec.md
- plan: Plan 15d, Plan 15e
- shadow schema: audit.rls_shadow_decisions
```

- [ ] **Step 2: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add docs/proposals/auth-model-implementation-backlog/shadow-analysis-template.md && \
  git commit -m "$(cat <<'EOF'
docs(auth-backlog): RLS shadow 분석 리포트 템플릿

Plan 15d → Plan 15e 진입 전제 체크리스트.
divergence 집계 / 도메인별 / false positive 분석 / Go-NoGo.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 회귀 + def gate

- [ ] **Step 1: 전체 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter db-bootstrap --filter audit-recorder-store --filter @qa-sdk/cli test 2>&1 | tail -15
```

Expected: 순수 26 + PG 통합 별도 env gate 실행 시 PASS.

- [ ] **Step 2: PG 통합 전체**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  QA_TEST_PG=1 \
  QA_TEST_PG_PASSWORD=$(grep '^QA_SDK_ADMIN_PASSWORD=' packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter db-bootstrap --filter audit-recorder-store test 2>&1 | tail -15
```

Expected: Plan 15b/15c/15d 추가 PG 테스트 모두 PASS.

- [ ] **Step 3: def gate**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/cli def validate 2>&1 | tail -5
```

Expected: errors 0.

---

## Self-Review

- [ ] `audit.rls_shadow_decisions` 테이블 + 4 인덱스 + admin bypass / insert_self 정책
- [ ] `predictRlsDecision(ctx, query)` — DB 왕복 없이 allow/deny/unknown + denyReason
- [ ] `PgRlsShadowRecorder` — fire-and-forget, 실패 logger.error({ err })
- [ ] `RlsShadowInterceptor` + `@RlsShadow({ resourceTable, operation, requiredBit, ownerField })` 데코레이터
- [ ] `qa-sdk shadow report --hours --limit` 집계 + text-table 포맷
- [ ] `shadow-analysis-template.md` — enforce 진입 Go/NoGo 체크리스트
- [ ] application-level 동작 변경 없음 — shadow 기록만 추가 (mode B observability)
- [ ] divergence 계산은 app 에서 수행 (application_decision != rls_would_decision)

---

## Defer

| 작업 | 이유 | 후속 plan |
|---|---|---|
| mode A parallel shadow query (admin 세션 샘플링) | observability 로 충분, parallel 비용 | Plan 15e 이후 운영 필요 시 |
| shadow 기록을 OtelAuditRecorder 로 fan-out | 통합 observability | Plan 12c 후속 |
| real-time divergence 알림 (PagerDuty 등) | 운영 도입 시 | 후속 proposal |
| `@RlsShadow` 데코레이터를 각 서비스 controller 에 부착 | 서비스별 migration 작업 | Plan 15e 과 동시 |
| application-level AccessChecker 판정 결과(detailed deny reason) 와 join | permission-engine 확장 필요 | Plan 12c + 15e |

---

## 의존·후속

- **Plan 15a (helper functions)**: `auth.current_role_tag()` 사용 (shadow 테이블 admin bypass 정책).
- **Plan 15b (policy templates)**: 본 plan 이 예측하는 RLS 규칙의 SSOT. rls-bits.ts 도 동일.
- **Plan 15c (session context middleware)**: `RlsSessionContext` + `getCurrentRlsContext` 를 shadow evaluator 가 소비. `RlsShadowInterceptor` 는 Plan 15c 의 `RlsContextInterceptor` 뒤에 체인 (order: context → shadow).
- **Plan 15e (enforce mode)**: 본 plan 의 shadow 분석 결과를 바탕으로 go/nogo 결정. shadow 기록은 enforce 이후에도 유지 (divergence=0 expected).
