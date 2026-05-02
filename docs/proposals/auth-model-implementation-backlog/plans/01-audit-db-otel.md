# §1 Audit DB 어댑터 + OTEL wrapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `InMemoryAuditRecorder`를 SQLite/Drizzle 기반 영속 구현으로 대체하고, OTEL active span에서 trace/parent/root span ID를 자동 추출하는 wrapper를 추가한다.

**Architecture:**
- 새 패키지 `audit-recorder-store` (resource-policy-store와 동일 컨벤션) — Drizzle SQLite 기반 `DrizzleAuditRecorder`. 기존 `AuditRecorder` 인터페이스 그대로 구현해 호출부 변경 없이 swap-in.
- `permission-engine/src/audit/otel-wrapper.ts` — 임의의 `AuditRecorder`를 감싸 `@opentelemetry/api`의 `trace.getActiveSpan()`에서 spanId/traceId/parentSpanId 자동 주입. `@qa-sdk/otel`은 optional peerDep.
- Phase 3(retention 배치/UI)는 본 plan 범위 외 — 시뮬 프로젝트(Phase 4) 데이터 확보 후 별도 plan으로.

**Tech Stack:**
- Drizzle ORM (`drizzle-orm` catalog), better-sqlite3 (`better-sqlite3` catalog)
- vitest, tsup (ESM + CJS), TypeScript ES2023
- `@opentelemetry/api` ^1.9.0 (이미 `@qa-sdk/otel`이 사용 중)
- 신규 의존: 없음 (모든 dep는 catalog 또는 workspace)

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `packages/audit-recorder-store/package.json` | name=audit-recorder-store, ESM+CJS dual, deps: drizzle-orm/better-sqlite3 catalog + permission-engine workspace |
| `packages/audit-recorder-store/tsconfig.json` | resource-policy-store 동일 (ES2023 + Bundler resolution + emitDeclarationOnly) |
| `packages/audit-recorder-store/tsup.config.ts` | resource-policy-store 동일 |
| `packages/audit-recorder-store/vitest.config.ts` | (필요 없음, default vitest 동작) |
| `packages/audit-recorder-store/src/schema.ts` | Drizzle `auditEntries` 테이블 + `AUDIT_ENTRIES_DDL` raw SQL 상수 (스펙 §1) |
| `packages/audit-recorder-store/src/drizzle-recorder.ts` | `DrizzleAuditRecorder implements AuditRecorder` |
| `packages/audit-recorder-store/src/drizzle-recorder.test.ts` | InMemory 테스트 스위트 미러 (`recorder.test.ts` 케이스 그대로) |
| `packages/audit-recorder-store/src/index.ts` | public exports (`DrizzleAuditRecorder`, `auditEntries`, `AUDIT_ENTRIES_DDL`) |
| `packages/permission-engine/src/audit/otel-wrapper.ts` | `OtelAuditRecorder` — active span에서 ID 추출, 내부 recorder에 위임 |
| `packages/permission-engine/src/audit/otel-wrapper.test.ts` | OTEL context 모킹 (NoopTracerProvider + manual span context) |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `packages/permission-engine/package.json` | `peerDependencies`에 `@qa-sdk/otel` (workspace:*) optional 추가 + `peerDependenciesMeta`에 `optional: true` |
| `packages/permission-engine/src/audit/index.ts` | `OtelAuditRecorder` re-export 추가 |

---

## Task 0: 사전 검증 (회귀 테스트 baseline)

**목적**: 변경 전 InMemoryAuditRecorder 테스트가 통과하는지 확인 — Phase 1 완료 후 동일 테스트 케이스가 Drizzle 어댑터에서도 통과해야 한다.

- [ ] **Step 1: 기존 InMemory 테스트 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/permission-engine && pnpm test -- recorder.test.ts
```

Expected: 9 tests passed (트리 구축 4건 + check 1건 + finishExecution 3건 + listByRoot 1건 + firstFailure 2건)

실패하면 main이 깨진 상태이므로 즉시 stop하고 사용자에게 보고.

- [ ] **Step 2: resource-policy-store 회귀 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/resource-policy-store && pnpm test
```

Expected: drizzle-registry 테스트 + e2e-integration 테스트 전부 통과 (E2E의 audit tree 검증이 Phase 2에서도 반복됨).

---

## Task 1: 새 패키지 스캐폴딩 — `audit-recorder-store`

**Files:**
- Create: `packages/audit-recorder-store/package.json`
- Create: `packages/audit-recorder-store/tsconfig.json`
- Create: `packages/audit-recorder-store/tsup.config.ts`

- [ ] **Step 1: package.json 작성**

`packages/audit-recorder-store/package.json`:

```json
{
  "name": "audit-recorder-store",
  "version": "0.1.0",
  "description": "AuditRecorder SQLite 영속 구현 — authorization-ontology-nested-audit-tracing 스펙 Phase 1",
  "license": "MIT",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "better-sqlite3": "catalog:",
    "drizzle-orm": "catalog:",
    "permission-engine": "workspace:*"
  },
  "devDependencies": {
    "@types/better-sqlite3": "catalog:",
    "@types/node": "^22.0.0",
    "tsup": "^8.5.1",
    "typescript": "^5.8.2",
    "vitest": "^1.6.1"
  }
}
```

- [ ] **Step 2: tsconfig.json 작성**

`packages/audit-recorder-store/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "emitDeclarationOnly": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 3: tsup.config.ts 작성**

`packages/audit-recorder-store/tsup.config.ts`:

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
});
```

- [ ] **Step 4: pnpm install로 워크스페이스 인식**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install
```

Expected: "Done in Xs" + audit-recorder-store가 packages 목록에 등장. 새 lockfile 변경.

- [ ] **Step 5: 빈 src/index.ts 생성 (next task에서 채움)**

```bash
mkdir -p /Users/junwoobang/workflow/qa-sdk/packages/audit-recorder-store/src
```

`packages/audit-recorder-store/src/index.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

// 본 파일은 Task 4에서 export를 채운다.
export {};
```

- [ ] **Step 6: typecheck 통과 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/audit-recorder-store && pnpm typecheck
```

Expected: 에러 없음 (빈 모듈).

- [ ] **Step 7: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/audit-recorder-store pnpm-lock.yaml && git commit -m "$(cat <<'EOF'
feat(audit-recorder-store): 신규 패키지 스캐폴딩

resource-policy-store와 동일 컨벤션으로 audit-recorder-store 패키지 추가.
authorization-ontology-nested-audit-tracing.spec.md Phase 1 구현 준비.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `auditEntries` Drizzle 스키마 + DDL

**Files:**
- Create: `packages/audit-recorder-store/src/schema.ts`

스펙 §1 audit_entries 테이블 매핑. resource-policy-store/src/schema.ts와 동일 패턴 (Drizzle 정의 + raw DDL 상수 병행 — Drizzle migration이 정착되기 전까지 raw DDL로 in-memory 테스트 셋업).

- [ ] **Step 1: schema.ts 작성**

`packages/audit-recorder-store/src/schema.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * audit_entries — nested audit tracing.
 *
 * 단일 테이블에 execution + check entry를 모두 저장.
 * `kind` 컬럼으로 분기, kind별 nullable 컬럼은 InMemory 구현과 1:1.
 */
export const auditEntries = sqliteTable(
  "audit_entries",
  {
    spanId: text("span_id").primaryKey(),
    traceId: text("trace_id").notNull(),
    parentSpanId: text("parent_span_id"),
    rootSpanId: text("root_span_id").notNull(),
    depth: integer("depth").notNull(),
    kind: text("kind", { enum: ["execution", "check"] }).notNull(),

    // execution kind
    apiId: text("api_id"),
    actorUserId: text("actor_user_id"),
    actorTenantId: text("actor_tenant_id"),
    targetKind: text("target_kind"),
    targetId: text("target_id"),
    outcome: text("outcome", { enum: ["allow", "deny", "error"] }),

    // check kind
    pass: text("pass", { enum: ["bitmap", "lifecycle", "cerbos", "acl"] }),
    address: integer("address"),
    unionKind: text("union_kind"),
    denyReason: text("deny_reason"),

    startedAt: text("started_at").notNull(),
    endedAt: text("ended_at"),
    metadata: text("metadata"), // JSON-serialized
  },
  (t) => [
    index("idx_audit_trace").on(t.traceId),
    index("idx_audit_root").on(t.rootSpanId),
    index("idx_audit_parent").on(t.parentSpanId),
    index("idx_audit_actor").on(t.actorUserId, t.startedAt),
    index("idx_audit_target").on(t.targetKind, t.targetId),
  ],
);

export const AUDIT_ENTRIES_DDL = `
CREATE TABLE IF NOT EXISTS audit_entries (
  span_id           TEXT PRIMARY KEY,
  trace_id          TEXT NOT NULL,
  parent_span_id    TEXT,
  root_span_id      TEXT NOT NULL,
  depth             INTEGER NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('execution','check')),
  api_id            TEXT,
  actor_user_id     TEXT,
  actor_tenant_id   TEXT,
  target_kind       TEXT,
  target_id         TEXT,
  outcome           TEXT CHECK (outcome IN ('allow','deny','error')),
  pass              TEXT CHECK (pass IN ('bitmap','lifecycle','cerbos','acl')),
  address           INTEGER,
  union_kind        TEXT,
  deny_reason       TEXT,
  started_at        TEXT NOT NULL,
  ended_at          TEXT,
  metadata          TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_trace ON audit_entries(trace_id);
CREATE INDEX IF NOT EXISTS idx_audit_root ON audit_entries(root_span_id);
CREATE INDEX IF NOT EXISTS idx_audit_parent ON audit_entries(parent_span_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_entries(actor_user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_entries(target_kind, target_id);
`;
```

**주의**: 스펙은 `actor_user_id NOT NULL`이지만 check entry에는 actor가 없다 → check entry 행을 위해 nullable 처리. 이 결정은 InMemory `CheckEntry` 타입에 actor가 없는 것과 일관 (스펙 §1 SQL이 다소 모순됨; check kind는 execution의 자식이라 actor는 join으로 얻을 수 있음).

- [ ] **Step 2: typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/audit-recorder-store && pnpm typecheck
```

Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/audit-recorder-store/src/schema.ts && git commit -m "$(cat <<'EOF'
feat(audit-recorder-store): auditEntries Drizzle 스키마 + DDL

스펙 §1을 sqliteTable + raw DDL 상수로 매핑. kind별 nullable 컬럼.
check entry는 actor 없으므로 actor_user_id nullable로 조정.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `DrizzleAuditRecorder` — 실패 테스트 먼저

**Files:**
- Create: `packages/audit-recorder-store/src/drizzle-recorder.test.ts`
- Create: `packages/audit-recorder-store/src/drizzle-recorder.ts` (Step 5에서 최소 구현)

InMemory 테스트 스위트와 동일한 시나리오를 Drizzle backend에서 검증. 동일 인터페이스 → 동일 계약.

- [ ] **Step 1: drizzle-recorder.test.ts 작성 (InMemory 테스트 미러)**

`packages/audit-recorder-store/src/drizzle-recorder.test.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";

import { EntryNotFoundError, ParentNotFoundError } from "permission-engine";

import { DrizzleAuditRecorder } from "./drizzle-recorder.js";
import { AUDIT_ENTRIES_DDL } from "./schema.js";

describe("DrizzleAuditRecorder — AuditRecorder 인터페이스 충족", () => {
  let db: BetterSQLite3Database;
  let rec: DrizzleAuditRecorder;

  beforeEach(() => {
    const raw = new Database(":memory:");
    raw.exec(AUDIT_ENTRIES_DDL);
    db = drizzle({ client: raw });
    rec = new DrizzleAuditRecorder(db);
  });

  describe("트리 구축", () => {
    it("root execution: parent=null → rootSpanId=self, depth=0", async () => {
      const e = await rec.startExecution({
        spanId: "root", traceId: "t1", parentSpanId: null,
        apiId: "A", actorUserId: "u", targetKind: "transaction", targetId: "tx-A",
      });
      expect(e.rootSpanId).toBe("root");
      expect(e.depth).toBe(0);
    });

    it("child execution: rootSpanId/depth는 parent에서 상속", async () => {
      await rec.startExecution({
        spanId: "root", traceId: "t1", parentSpanId: null,
        apiId: "A", actorUserId: "u", targetKind: "transaction", targetId: "tx-A",
      });
      const c = await rec.startExecution({
        spanId: "child", traceId: "t1", parentSpanId: "root",
        apiId: "B", actorUserId: "u", targetKind: "resource", targetId: "doc",
      });
      expect(c.rootSpanId).toBe("root");
      expect(c.depth).toBe(1);
    });

    it("3 depth 중첩도 root 공유", async () => {
      await rec.startExecution({ spanId: "L0", traceId: "t", parentSpanId: null, apiId: "A", actorUserId: "u", targetKind: "transaction", targetId: "A" });
      await rec.startExecution({ spanId: "L1", traceId: "t", parentSpanId: "L0", apiId: "B", actorUserId: "u", targetKind: "transaction", targetId: "B" });
      const l2 = await rec.startExecution({ spanId: "L2", traceId: "t", parentSpanId: "L1", apiId: "C", actorUserId: "u", targetKind: "resource", targetId: "r" });
      expect(l2.rootSpanId).toBe("L0");
      expect(l2.depth).toBe(2);
    });

    it("없는 parent 참조 → ParentNotFoundError", async () => {
      await expect(rec.startExecution({
        spanId: "c", traceId: "t", parentSpanId: "missing",
        apiId: "A", actorUserId: "u", targetKind: "resource", targetId: "r",
      })).rejects.toThrow(ParentNotFoundError);
    });
  });

  describe("check entry", () => {
    it("execution의 child로 check entry 기록", async () => {
      await rec.startExecution({ spanId: "e", traceId: "t", parentSpanId: null, apiId: "A", actorUserId: "u", targetKind: "resource", targetId: "r" });
      const c = await rec.recordCheck({
        spanId: "c1", traceId: "t", parentSpanId: "e",
        pass: "bitmap", outcome: "allow", address: 42, unionKind: "resource",
      });
      expect(c.rootSpanId).toBe("e");
      expect(c.depth).toBe(1);
      expect(c.pass).toBe("bitmap");
      expect(c.address).toBe(42);
    });
  });

  describe("finishExecution", () => {
    it("outcome 기록 + endedAt 채움", async () => {
      await rec.startExecution({ spanId: "e", traceId: "t", parentSpanId: null, apiId: "A", actorUserId: "u", targetKind: "resource", targetId: "r" });
      const done = await rec.finishExecution("e", "allow", "2026-04-22T10:05:00Z");
      expect(done.outcome).toBe("allow");
      expect(done.endedAt).toBe("2026-04-22T10:05:00Z");
    });

    it("없는 spanId는 EntryNotFoundError", async () => {
      await expect(rec.finishExecution("missing", "allow"))
        .rejects.toThrow(EntryNotFoundError);
    });

    it("check entry에 finishExecution 호출하면 예외", async () => {
      await rec.startExecution({ spanId: "e", traceId: "t", parentSpanId: null, apiId: "A", actorUserId: "u", targetKind: "resource", targetId: "r" });
      await rec.recordCheck({ spanId: "c", traceId: "t", parentSpanId: "e", pass: "bitmap", outcome: "allow" });
      await expect(rec.finishExecution("c", "allow")).rejects.toThrow();
    });
  });

  describe("listByRoot", () => {
    it("동일 root의 모든 entry를 depth asc, startedAt asc로 정렬", async () => {
      const t0 = "2026-04-22T10:00:00.000Z";
      const t1 = "2026-04-22T10:00:01.000Z";
      const t2 = "2026-04-22T10:00:02.000Z";
      const t3 = "2026-04-22T10:00:03.000Z";
      await rec.startExecution({ spanId: "r", traceId: "t", parentSpanId: null, apiId: "A", actorUserId: "u", targetKind: "transaction", targetId: "A", now: t0 });
      await rec.startExecution({ spanId: "c1", traceId: "t", parentSpanId: "r", apiId: "B", actorUserId: "u", targetKind: "resource", targetId: "r1", now: t1 });
      await rec.startExecution({ spanId: "c2", traceId: "t", parentSpanId: "r", apiId: "C", actorUserId: "u", targetKind: "resource", targetId: "r2", now: t2 });
      await rec.recordCheck({ spanId: "chk", traceId: "t", parentSpanId: "c1", pass: "bitmap", outcome: "allow", now: t3 });
      const list = await rec.listByRoot("r");
      expect(list.map((e) => e.spanId)).toEqual(["r", "c1", "c2", "chk"]);
      expect(list.map((e) => e.depth)).toEqual([0, 1, 1, 2]);
    });
  });

  describe("firstFailure", () => {
    it("deny entry를 트리에서 찾는다", async () => {
      const t0 = "2026-04-22T10:00:00.000Z";
      const t1 = "2026-04-22T10:00:01.000Z";
      const t2 = "2026-04-22T10:00:02.000Z";
      await rec.startExecution({ spanId: "r", traceId: "t", parentSpanId: null, apiId: "A", actorUserId: "u", targetKind: "transaction", targetId: "A", now: t0 });
      await rec.recordCheck({ spanId: "c1", traceId: "t", parentSpanId: "r", pass: "bitmap", outcome: "allow", address: 0, now: t1 });
      await rec.recordCheck({ spanId: "c2", traceId: "t", parentSpanId: "r", pass: "lifecycle", outcome: "deny", denyReason: "not_owner", now: t2 });
      const fail = await rec.firstFailure("r");
      expect(fail?.spanId).toBe("c2");
      if (fail?.kind === "check") {
        expect(fail.denyReason).toBe("not_owner");
      }
    });

    it("모두 성공이면 null", async () => {
      await rec.startExecution({ spanId: "r", traceId: "t", parentSpanId: null, apiId: "A", actorUserId: "u", targetKind: "transaction", targetId: "A" });
      await rec.recordCheck({ spanId: "c1", traceId: "t", parentSpanId: "r", pass: "bitmap", outcome: "allow" });
      await rec.finishExecution("r", "allow");
      expect(await rec.firstFailure("r")).toBeNull();
    });
  });

  describe("metadata 저장", () => {
    it("metadata가 JSON 직렬화·역직렬화 됨", async () => {
      await rec.startExecution({
        spanId: "e", traceId: "t", parentSpanId: null,
        apiId: "A", actorUserId: "u", targetKind: "resource", targetId: "r",
        metadata: { source: "http", reqId: "abc-123" },
      });
      const got = await rec.get("e");
      expect(got?.metadata).toEqual({ source: "http", reqId: "abc-123" });
    });

    it("metadata 없는 entry는 metadata=undefined로 복원", async () => {
      await rec.startExecution({
        spanId: "e", traceId: "t", parentSpanId: null,
        apiId: "A", actorUserId: "u", targetKind: "resource", targetId: "r",
      });
      const got = await rec.get("e");
      expect(got?.metadata).toBeUndefined();
    });
  });
});
```

**테스트 추가 항목 (InMemory에 없는 것)**: `metadata` JSON 직렬화 round-trip. SQLite 저장 시 string으로 인코딩되므로 명시적 검증 필요.

- [ ] **Step 2: 테스트 실행으로 실패 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/audit-recorder-store && pnpm test
```

Expected: FAIL — `Cannot find module './drizzle-recorder.js'` 또는 `DrizzleAuditRecorder is not a constructor`. 모든 테스트 실패.

---

## Task 4: `DrizzleAuditRecorder` 최소 구현

**Files:**
- Create: `packages/audit-recorder-store/src/drizzle-recorder.ts`
- Modify: `packages/audit-recorder-store/src/index.ts`

InMemory 구현(`recorder.ts`)을 참고해 동일 동작을 SQL로 구현. row→entry 변환에서 nullable/undefined 매핑 주의.

- [ ] **Step 1: drizzle-recorder.ts 작성**

`packages/audit-recorder-store/src/drizzle-recorder.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * DrizzleAuditRecorder — AuditRecorder 인터페이스의 SQLite 영속 구현.
 *
 * InMemory 구현과 동일 계약(트리 구축 규약, kind 구분, 정렬).
 * I/O만 담당하며 트리 invariant는 호출 시 parent 조회 후 검증한다.
 */

import { and, asc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

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
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
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
      outcome: row.outcome,
    };
  }

  return {
    ...base,
    kind: "check",
    pass: row.pass!,
    outcome: (row.outcome ?? "allow") as AuditOutcome,
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
    metadata: e.metadata ? JSON.stringify(e.metadata) : null,
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
    metadata: c.metadata ? JSON.stringify(c.metadata) : null,
  };
}

export class DrizzleAuditRecorder implements AuditRecorder {
  constructor(private readonly db: BetterSQLite3Database) {}

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

    this.db.insert(auditEntries).values(executionToRow(entry)).run();
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
    this.db
      .update(auditEntries)
      .set({ outcome, endedAt })
      .where(eq(auditEntries.spanId, spanId))
      .run();
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
    this.db.insert(auditEntries).values(checkToRow(entry)).run();
    return entry;
  }

  async get(spanId: string): Promise<AuditEntry | null> {
    const rows = this.db
      .select()
      .from(auditEntries)
      .where(eq(auditEntries.spanId, spanId))
      .limit(1)
      .all();
    return rows.length === 0 ? null : toEntry(rows[0]);
  }

  async listByRoot(rootSpanId: string): Promise<AuditEntry[]> {
    return this.db
      .select()
      .from(auditEntries)
      .where(eq(auditEntries.rootSpanId, rootSpanId))
      .orderBy(asc(auditEntries.depth), asc(auditEntries.startedAt))
      .all()
      .map(toEntry);
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

- [ ] **Step 2: index.ts public exports 채움**

`packages/audit-recorder-store/src/index.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

export { DrizzleAuditRecorder } from "./drizzle-recorder.js";
export { auditEntries, AUDIT_ENTRIES_DDL } from "./schema.js";
```

- [ ] **Step 3: 테스트 실행 → 통과 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/audit-recorder-store && pnpm test
```

Expected: 11 tests passed (트리 4 + check 1 + finish 3 + listByRoot 1 + firstFailure 2 + metadata 2 = wait, recompute: 트리 4 + check 1 + finish 3 + listByRoot 1 + firstFailure 2 + metadata 2 = 13 tests).

실패 시 가장 흔한 원인:
- `import` 경로의 `.js` 확장자 누락 (ESM 규칙)
- nullable 컬럼 매핑 누락
- `outcome`이 InMemory에서는 union이지만 DB에서는 string — type narrow 누락

- [ ] **Step 4: typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/audit-recorder-store && pnpm typecheck
```

Expected: 에러 없음.

- [ ] **Step 5: build (dist 생성)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/audit-recorder-store && pnpm build
```

Expected: `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` 생성.

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/audit-recorder-store/src && git commit -m "$(cat <<'EOF'
feat(audit-recorder-store): DrizzleAuditRecorder 구현 + 13 테스트 통과

InMemoryAuditRecorder와 동일 계약. SQLite 영속.
metadata JSON 직렬화 round-trip 추가 검증.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: E2E 통합 테스트 — Drizzle audit + resource-policy 결합

**Files:**
- Create: `packages/audit-recorder-store/src/e2e-integration.test.ts`

resource-policy-store의 e2e와 유사한 컨텍스트로, 단 audit를 InMemory가 아닌 DrizzleAuditRecorder로 교체한 시나리오. **두 스토어를 동일 SQLite 인스턴스에 공존시켜 cross-table invariant 검증.**

- [ ] **Step 1: package.json에 dev 의존 추가**

`packages/audit-recorder-store/package.json`의 devDependencies에 추가:

```json
"resource-policy-store": "workspace:*",
"weighted-index": "workspace:*"
```

- [ ] **Step 2: pnpm install**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install
```

- [ ] **Step 3: e2e 테스트 작성**

`packages/audit-recorder-store/src/e2e-integration.test.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * DrizzleAuditRecorder + DrizzleResourcePolicyRegistry — 동일 SQLite 인스턴스 공존 검증.
 *
 * AccessChecker가 두 store를 동시에 쓰는 시나리오에서 트리/lifecycle invariant가 유지되는지.
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DisjointUnionIndex, buildMask } from "weighted-index";

import {
  AccessChecker,
  issueBitmap,
  type InstancePolicyEvaluator,
} from "permission-engine";

import {
  DrizzleResourcePolicyRegistry,
  RESOURCE_POLICIES_DDL,
} from "resource-policy-store";

import { DrizzleAuditRecorder } from "./drizzle-recorder.js";
import { AUDIT_ENTRIES_DDL } from "./schema.js";

describe("E2E — Drizzle audit + Drizzle resource-policy 공존", () => {
  const ACTIONS = { read: 1, write: 2 } as const;
  const TYPES = { document: 1 } as const;
  const TXNS = { publish: 1 } as const;

  const union = new DisjointUnionIndex([
    { kind: "resource", shape: [2, 1] },
    { kind: "transaction", shape: [1] },
  ]);

  function setup() {
    const raw = new Database(":memory:");
    raw.exec(RESOURCE_POLICIES_DDL);
    raw.exec(AUDIT_ENTRIES_DDL);
    const db = drizzle({ client: raw });
    const registry = new DrizzleResourcePolicyRegistry(db);
    const audit = new DrizzleAuditRecorder(db);
    const secret = randomBytes(32);
    let n = 0;
    const newSpanId = () => `span-${++n}`;
    return { db, registry, audit, secret, newSpanId };
  }

  function bitmap(secret: Uint8Array, bits: number[]) {
    const mask = buildMask(union.totalSize, bits);
    return issueBitmap({
      prefix: "perm", v: "uv1", mask,
      issuer: "auth", ttlMs: 60_000, secret,
    });
  }

  it("read 성공 → audit tree에 execution + bitmap check 기록", async () => {
    const { registry, audit, secret, newSpanId } = setup();

    const evaluator: InstancePolicyEvaluator = {
      async evaluateRegistered() { return true; },
      async evaluateDelegated() { return false; },
    };
    const checker = new AccessChecker({ union, policyRegistry: registry, evaluator, audit });

    await registry.create({ resourceId: "doc", resourceType: "document", ownerId: "u1" });

    const userBits = bitmap(secret, [union.encode("resource", [ACTIONS.read, TYPES.document])]);

    const result = await checker.check(
      { userId: "u1", bitmap: userBits, parentSpanId: null, traceId: "t1", newSpanId },
      {
        kind: "resource", apiId: "readDocument",
        coords: [ACTIONS.read, TYPES.document], targetId: "document",
        resource: { id: "doc", ownerId: "u1" },
      },
    );
    expect(result.allowed).toBe(true);

    const tree = await audit.listByRoot(result.executionSpanId);
    expect(tree.length).toBeGreaterThanOrEqual(2);
    expect(tree[0].kind).toBe("execution");
    expect(tree.some((e) => e.kind === "check" && e.pass === "bitmap")).toBe(true);
  });

  it("nested transaction → 한 root 아래 모든 entry depth>=0 일관", async () => {
    const { registry, audit, secret, newSpanId } = setup();

    const evaluator: InstancePolicyEvaluator = {
      async evaluateRegistered() { return true; },
      async evaluateDelegated() { return false; },
    };
    const checker = new AccessChecker({ union, policyRegistry: registry, evaluator, audit });

    await registry.create({ resourceId: "doc", resourceType: "document", ownerId: "u1" });

    const userBits = bitmap(secret, [
      union.encode("resource", [ACTIONS.read, TYPES.document]),
      union.encode("transaction", [TXNS.publish]),
    ]);

    const txn = await checker.check(
      { userId: "u1", bitmap: userBits, parentSpanId: null, traceId: "tx", newSpanId },
      { kind: "transaction", apiId: "publish", coords: [TXNS.publish], targetId: "publish" },
    );
    expect(txn.allowed).toBe(true);

    const nested = await checker.check(
      { userId: "u1", bitmap: userBits, parentSpanId: txn.executionSpanId, traceId: "tx", newSpanId },
      {
        kind: "resource", apiId: "readDocument",
        coords: [ACTIONS.read, TYPES.document], targetId: "document",
        resource: { id: "doc", ownerId: "u1" },
      },
    );
    expect(nested.allowed).toBe(true);

    const tree = await audit.listByRoot(txn.executionSpanId);
    // root depth=0, 모든 child depth>=1
    expect(tree[0].depth).toBe(0);
    for (const entry of tree.slice(1)) {
      expect(entry.depth).toBeGreaterThanOrEqual(1);
      expect(entry.rootSpanId).toBe(txn.executionSpanId);
    }
  });
});
```

- [ ] **Step 4: 테스트 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/audit-recorder-store && pnpm test
```

Expected: 13 unit tests + 2 e2e tests = 15 통과.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/audit-recorder-store && git commit -m "$(cat <<'EOF'
test(audit-recorder-store): E2E — audit + resource-policy SQLite 공존

동일 :memory: DB에 두 store가 공존해도 트리 invariant·lifecycle 정합성 유지.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `OtelAuditRecorder` wrapper — 실패 테스트 먼저

**Files:**
- Create: `packages/permission-engine/src/audit/otel-wrapper.test.ts`
- Create: `packages/permission-engine/src/audit/otel-wrapper.ts` (Step 4에서)

OTEL `trace.getActiveSpan()`에서 `spanContext()` 추출. 호출자가 `spanId/traceId/parentSpanId`를 직접 넘기지 않아도 active span에서 자동 채움.

설계 원칙:
- 호출자가 명시적으로 ID를 넘기면 그 값 우선
- 안 넘기면 `trace.getActiveSpan()` 사용
- active span이 없으면 random span ID 발급 + warn (스펙 §주의사항: cron job 등은 명시 root 시작 권장)
- `@opentelemetry/api`는 dynamic import — `@qa-sdk/otel`이 없는 환경에서도 permission-engine 자체는 동작

- [ ] **Step 1: 테스트 작성**

`packages/permission-engine/src/audit/otel-wrapper.test.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

import { context, trace } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryAuditRecorder } from "./recorder.js";
import { OtelAuditRecorder } from "./otel-wrapper.js";

describe("OtelAuditRecorder", () => {
  let provider: BasicTracerProvider;
  let inner: InMemoryAuditRecorder;
  let rec: OtelAuditRecorder;

  beforeEach(() => {
    provider = new BasicTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(new InMemorySpanExporter()));
    trace.setGlobalTracerProvider(provider);
    inner = new InMemoryAuditRecorder();
    rec = new OtelAuditRecorder(inner);
  });

  it("active span 없을 때: 호출자 인자에 의존하되 random spanId 발급", async () => {
    const e = await rec.startExecution({
      // spanId/traceId/parentSpanId를 OTEL에서 채울 수 있어야 하지만,
      // active span 없음 → fallback으로 random ID 생성
      apiId: "A", actorUserId: "u", targetKind: "r", targetId: "x",
    });
    expect(e.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(e.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(e.parentSpanId).toBeNull();
    expect(e.depth).toBe(0);
  });

  it("active span 있을 때: spanId/traceId/parentSpanId 자동 추출", async () => {
    const tracer = trace.getTracer("test");
    const root = tracer.startSpan("root");

    await context.with(trace.setSpan(context.active(), root), async () => {
      // OtelAuditRecorder는 active span의 spanContext()에서 ID를 읽어
      // 새 entry를 active span의 span_id 자체로 등록 (1:1 매핑 스펙 준수)
      const e = await rec.startExecution({
        apiId: "A", actorUserId: "u", targetKind: "r", targetId: "x",
      });
      const ctx = root.spanContext();
      expect(e.spanId).toBe(ctx.spanId);
      expect(e.traceId).toBe(ctx.traceId);
      expect(e.parentSpanId).toBeNull(); // root span (parentSpanId 없음)
    });

    root.end();
  });

  it("nested span: parent에 root span ID가 들어감", async () => {
    const tracer = trace.getTracer("test");
    const root = tracer.startSpan("root");

    await context.with(trace.setSpan(context.active(), root), async () => {
      // root의 audit entry 등록
      await rec.startExecution({
        apiId: "root-api", actorUserId: "u", targetKind: "tx", targetId: "T",
      });

      const child = tracer.startSpan("child");
      await context.with(trace.setSpan(context.active(), child), async () => {
        const e = await rec.startExecution({
          apiId: "child-api", actorUserId: "u", targetKind: "r", targetId: "x",
        });
        expect(e.spanId).toBe(child.spanContext().spanId);
        expect(e.parentSpanId).toBe(root.spanContext().spanId);
        expect(e.depth).toBe(1);
        expect(e.rootSpanId).toBe(root.spanContext().spanId);
      });
      child.end();
    });

    root.end();
  });

  it("recordCheck도 active span 활용", async () => {
    const tracer = trace.getTracer("test");
    const root = tracer.startSpan("root");

    await context.with(trace.setSpan(context.active(), root), async () => {
      await rec.startExecution({
        apiId: "A", actorUserId: "u", targetKind: "r", targetId: "x",
      });

      const checkSpan = tracer.startSpan("bitmap-check");
      await context.with(trace.setSpan(context.active(), checkSpan), async () => {
        const c = await rec.recordCheck({
          pass: "bitmap", outcome: "allow", address: 5,
        });
        expect(c.spanId).toBe(checkSpan.spanContext().spanId);
        expect(c.parentSpanId).toBe(root.spanContext().spanId);
      });
      checkSpan.end();
    });
    root.end();
  });

  it("명시적 인자가 active span을 override", async () => {
    const tracer = trace.getTracer("test");
    const root = tracer.startSpan("root");

    await context.with(trace.setSpan(context.active(), root), async () => {
      const e = await rec.startExecution({
        spanId: "manual-span",
        traceId: "manual-trace",
        parentSpanId: null,
        apiId: "A", actorUserId: "u", targetKind: "r", targetId: "x",
      });
      expect(e.spanId).toBe("manual-span");
      expect(e.traceId).toBe("manual-trace");
    });
    root.end();
  });

  it("listByRoot/firstFailure는 inner에 그대로 위임", async () => {
    await rec.startExecution({
      spanId: "r", traceId: "t", parentSpanId: null,
      apiId: "A", actorUserId: "u", targetKind: "tx", targetId: "T",
    });
    expect(await rec.listByRoot("r")).toHaveLength(1);
    expect(await rec.firstFailure("r")).toBeNull();
  });
});
```

**중요**: 이 테스트는 `RecordExecutionArgs`/`RecordCheckArgs`에서 `spanId/traceId/parentSpanId`를 optional로 만들어야 한다. 그러므로 Task 7에서 이 타입을 분리한 wrapper용 타입(예: `OtelRecordExecutionArgs`)을 정의한다.

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/permission-engine && pnpm test -- otel-wrapper
```

Expected: FAIL — 모듈 없음 / 타입 불일치.

---

## Task 7: `OtelAuditRecorder` 구현

**Files:**
- Create: `packages/permission-engine/src/audit/otel-wrapper.ts`
- Modify: `packages/permission-engine/package.json` (peerDep)
- Modify: `packages/permission-engine/src/audit/index.ts` (export)

- [ ] **Step 1: package.json — `@opentelemetry/api`를 dependency, sdk-trace-base는 devDep로**

`packages/permission-engine/package.json` 변경: `dependencies`에 추가:

```json
"@opentelemetry/api": "^1.9.0"
```

`devDependencies`에 추가 (테스트용):

```json
"@opentelemetry/sdk-trace-base": "^1.30.0"
```

(`@qa-sdk/otel`을 peerDep로 두는 대신 OTEL API를 직접 import — `@opentelemetry/api`는 이미 SDK 부재시 noop이므로 안전.)

- [ ] **Step 2: pnpm install**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install
```

- [ ] **Step 3: otel-wrapper.ts 작성**

`packages/permission-engine/src/audit/otel-wrapper.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * OtelAuditRecorder — 임의의 AuditRecorder를 감싸 OTEL active span에서
 * spanId/traceId/parentSpanId를 자동으로 채워 위임한다.
 *
 * - 명시적 인자가 있으면 그 값 우선 (테스트·cron job용)
 * - active span이 있으면 spanContext()에서 추출
 * - 없으면 W3C-style random ID 생성 (16바이트 trace, 8바이트 span)
 *
 * 본 wrapper는 OTEL API에만 의존하며, 실제 SDK가 부재해도 동작한다
 * (`@opentelemetry/api`의 default tracer는 noop).
 */

import { trace, type Span } from "@opentelemetry/api";
import { randomBytes } from "node:crypto";

import type {
  AuditEntry,
  AuditOutcome,
  CheckEntry,
  ExecutionEntry,
  RecordCheckArgs,
  RecordExecutionArgs,
} from "./types.js";
import type { AuditRecorder } from "./recorder.js";

/**
 * Wrapper에 넘기는 인자 — 모든 ID 필드가 optional.
 */
export interface OtelRecordExecutionArgs
  extends Omit<RecordExecutionArgs, "spanId" | "traceId" | "parentSpanId"> {
  spanId?: string;
  traceId?: string;
  parentSpanId?: string | null;
}

export interface OtelRecordCheckArgs
  extends Omit<RecordCheckArgs, "spanId" | "traceId" | "parentSpanId"> {
  spanId?: string;
  traceId?: string;
  parentSpanId?: string;
}

function randomSpanId(): string {
  return randomBytes(8).toString("hex");
}

function randomTraceId(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Active span의 context에서 ID를 추출. 없으면 random.
 *
 * 반환:
 *   - spanId: 새 entry의 식별자 (active span의 spanId 또는 random)
 *   - traceId: trace 식별자 (active span의 traceId 또는 random)
 *   - parentSpanId: active span의 parent (없으면 null)
 */
function resolveIds(): { spanId: string; traceId: string; parentSpanId: string | null } {
  const active = trace.getActiveSpan();
  if (!active) {
    return { spanId: randomSpanId(), traceId: randomTraceId(), parentSpanId: null };
  }
  const ctx = active.spanContext();
  // parent span ID는 OTEL API에 직접 노출 안 됨 — Span 객체의 parentSpanId 프로퍼티로 접근.
  // (BasicTracerProvider가 만든 Span은 parentSpanId 필드를 노출. SDK 종류마다 다를 수 있어 best-effort.)
  const parentSpanId = (active as Span & { parentSpanId?: string }).parentSpanId ?? null;
  return { spanId: ctx.spanId, traceId: ctx.traceId, parentSpanId };
}

export class OtelAuditRecorder implements AuditRecorder {
  constructor(private readonly inner: AuditRecorder) {}

  async startExecution(args: OtelRecordExecutionArgs): Promise<ExecutionEntry> {
    const auto = resolveIds();
    return this.inner.startExecution({
      ...args,
      spanId: args.spanId ?? auto.spanId,
      traceId: args.traceId ?? auto.traceId,
      parentSpanId: args.parentSpanId !== undefined ? args.parentSpanId : auto.parentSpanId,
    });
  }

  async finishExecution(spanId: string, outcome: AuditOutcome, now?: string) {
    return this.inner.finishExecution(spanId, outcome, now);
  }

  async recordCheck(args: OtelRecordCheckArgs): Promise<CheckEntry> {
    const auto = resolveIds();
    // recordCheck의 parent는 active span 자체 (check는 execution의 자식)
    // 명시 안 하면 active span을 parent로 본다.
    const parentSpanId = args.parentSpanId ?? auto.spanId;
    return this.inner.recordCheck({
      ...args,
      spanId: args.spanId ?? randomSpanId(),
      traceId: args.traceId ?? auto.traceId,
      parentSpanId,
    });
  }

  async get(spanId: string): Promise<AuditEntry | null> {
    return this.inner.get(spanId);
  }

  async listByRoot(rootSpanId: string): Promise<AuditEntry[]> {
    return this.inner.listByRoot(rootSpanId);
  }

  async firstFailure(rootSpanId: string): Promise<AuditEntry | null> {
    return this.inner.firstFailure(rootSpanId);
  }
}
```

- [ ] **Step 4: index.ts에 export 추가**

`packages/permission-engine/src/audit/index.ts` 수정:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

export {
  EntryNotFoundError,
  InMemoryAuditRecorder,
  ParentNotFoundError,
  type AuditRecorder,
} from "./recorder.js";

export {
  OtelAuditRecorder,
  type OtelRecordCheckArgs,
  type OtelRecordExecutionArgs,
} from "./otel-wrapper.js";

export {
  type AuditEntry,
  type AuditKind,
  type AuditOutcome,
  type CheckEntry,
  type CheckPass,
  type ExecutionEntry,
  type RecordCheckArgs,
  type RecordExecutionArgs,
} from "./types.js";
```

- [ ] **Step 5: 테스트 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/permission-engine && pnpm test
```

Expected: 기존 InMemory 테스트 9 + otel-wrapper 6 + 기타 모두 통과.

흔한 실패:
- `BasicTracerProvider`가 이전 글로벌 provider를 덮어쓰지 못 함 → 다른 테스트의 OTEL state 누수. `trace.disable()` afterEach 필요할 수 있음.
- `parentSpanId` 추출이 SDK 종류마다 다름 → BasicTracerProvider 한정 동작 OK.

- [ ] **Step 6: 전체 typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/permission-engine && pnpm typecheck
```

Expected: 에러 없음.

- [ ] **Step 7: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/permission-engine && git commit -m "$(cat <<'EOF'
feat(permission-engine): OtelAuditRecorder wrapper — active span에서 ID 자동 추출

@opentelemetry/api 의존 추가 (SDK 부재 시 noop). 명시 인자 우선, fallback random.
스펙 §3 (OTEL span_id 재사용) 준수.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 회귀·gate 검증

**Files:** (변경 없음, 검증만)

- [ ] **Step 1: 영향받는 패키지 빌드**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter audit-recorder-store --filter permission-engine --filter resource-policy-store build
```

Expected: 3 패키지 build 성공.

- [ ] **Step 2: 영향받는 패키지 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter audit-recorder-store --filter permission-engine --filter resource-policy-store test
```

Expected: 모든 테스트 통과.

- [ ] **Step 3: definition-catalog gate (skill / spec touch 없으므로 우회 가능. 그래도 검증)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/cli def sync && pnpm --filter @qa-sdk/cli def validate
```

Expected: errors=0. 새 패키지가 spec 문서를 새로 만들지 않으므로 영향 없음.

만약 warning 등장하면 무시 가능 (orphan 등). errors=0이 게이트 통과 조건.

- [ ] **Step 4: workflow-smoke (CLI 회귀)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/cli test:workflow-smoke 2>&1 | tail -20
```

Expected: 12/12 smoke 테스트 통과 (스킬·CLI 변경 없으므로 영향 없음).

스크립트 이름이 다르면 `package.json` 확인 후 실제 명령으로 변경.

---

## Task 9: 스펙 lifecycle 갱신

**Files:**
- Modify: `docs/specs/authorization-ontology/authorization-ontology-nested-audit-tracing.spec.md` (frontmatter `lifecycle`)

`lifecycle: draft` → `lifecycle: implemented` (Phase 1+2 완료에 한해; Phase 3 retention/UI는 별도 plan).

- [ ] **Step 1: frontmatter 수정**

`docs/specs/authorization-ontology/authorization-ontology-nested-audit-tracing.spec.md` line 9:

```yaml
  lifecycle: implemented  # was: draft
```

본문 §방법 §구현 순서 끝에 한 줄 추가:

```markdown
> **구현 상태**: Phase 1 (DrizzleAuditRecorder, audit-recorder-store)·Phase 2 (OtelAuditRecorder wrapper) 완료. Phase 3 (retention 배치, monitor-web trace explorer) 및 Phase 4 (보관 정책) 미구현 — 시뮬 프로젝트 Phase 4 데이터 확보 후 별도 plan으로 추진.
```

- [ ] **Step 2: def sync로 DB 반영**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/cli def sync
```

Expected: 1 doc updated (lifecycle 변경).

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add docs/specs/authorization-ontology/authorization-ontology-nested-audit-tracing.spec.md && git commit -m "$(cat <<'EOF'
docs(authorization): nested-audit-tracing — lifecycle implemented (Phase 1+2)

DrizzleAuditRecorder + OtelAuditRecorder 구현 완료. Phase 3/4는 별도 plan.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review 체크리스트 (실행자가 plan 종료 직후 확인)

- [ ] `audit-recorder-store` 패키지가 `pnpm -r build`에서 인식되는가
- [ ] `DrizzleAuditRecorder` 13 unit + 2 e2e 테스트 모두 통과
- [ ] `OtelAuditRecorder` 6 테스트 모두 통과
- [ ] `permission-engine` 기존 테스트 회귀 없음 (`recorder.test.ts` 9건 그대로 통과)
- [ ] `resource-policy-store` e2e 회귀 없음
- [ ] 스펙 lifecycle = `implemented`
- [ ] CI gate 영향 없음 (def validate errors=0, workflow-smoke 12/12)

## Phase 3/4 — 본 plan 범위 외 (defer 사유 명시)

| 작업 | 보류 사유 | 재개 트리거 |
|---|---|---|
| Retention 배치 (hot/warm/cold) | 실 데이터 없으면 retention 정책 검증 불가. SQLite는 단일 파일이라 archive 의미 약함. PG 이행(Phase 2 backlog) 후 재검토. | PG 이행 완료 + 90일 이상 운영 데이터 |
| `authorization-monitor-web` trace explorer | UI는 시뮬 트래픽이 있어야 의미. `authorization-monitor-web` 패키지 자체가 미존재. 시뮬 프로젝트(Phase 4 backlog) 결합 후 진행. | 시뮬 프로젝트 spec 완성 |
| OTEL exporter 통합 (Jaeger/Tempo) | `@qa-sdk/otel`의 `initTelemetry`로 충분. 별도 작업 불필요. | — |
| Privacy scrubbing 훅 | metadata에 PII 들어가는 실제 호출 지점이 생기면 그때. 현재 모든 호출자가 통제됨. | 외부 SDK가 metadata 채우는 시점 |

---

## 의존·후속 plan

이 plan 완료 시 release 가능한 가치:
- 권한 판정 트리를 SQLite에 영속 저장 → 별도 프로세스에서 감사 가능
- OTEL 미들웨어와 자연스럽게 통합 — 호출자가 ID 관리 안 해도 됨

후속 plan과의 관계:
- **02 Ingest audit P1~P3**: 독립. 동일 SQLite 사용 가능 (또는 별도 DB)
- **03 coordinate-storage 자동화**: 본 plan의 `audit_entries`는 좌표 저장 패턴 아님 (address 컬럼은 단일 prefix 기준이고, version은 entry 자체에 없음). 향후 cross-version audit 필요 시 별도 검토.
- **Phase 2 PG 이행**: `audit_entries` 테이블이 PG 이행 대상에 포함됨 (지금은 SQLite-only).
- **Phase 4 시뮬 프로젝트**: 시뮬 트래픽으로 본 store 검증 → trace explorer UI 가치 발생.
