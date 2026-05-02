# Plan 06c — audit-recorder-store factory + port-contract.test

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `audit-recorder-store`에 dialect 분기 factory(`createAuditRecorder`) + 양쪽 어댑터 동등성 contract test 추가. 호출자는 인터페이스(`AuditRecorder`)만 의존하고, dialect 결정은 factory에 위임. SqliteAuditRecorder와 PgAuditRecorder가 동일 시나리오에 대해 동일 결과를 반환함을 시나리오 기반으로 검증한다.

**Architecture:**
- `src/factory.ts` — `createAuditRecorder({ dialect, db })` dynamic import 분기 (Plan 05b/06b의 `pg-migration-design.md` §2 패턴 준용)
- `src/port-contract.test.ts` — `describe.each(fixtures)` 패턴으로 SQLite + (env gate) PG 양쪽에 동일 시나리오 적용. AuditRecorder 인터페이스의 6개 메서드 (startExecution / finishExecution / recordCheck / get / listByRoot / firstFailure) 전체 동등성.
- `db-bootstrap`의 `createSqliteTestFixture` / `createPgTestFixture` 사용 (Plan 04c 산출물).
- e2e-integration.test.ts는 SqliteAuditRecorder 직접 사용 그대로 유지 (회귀 안전망 차원, 본 plan 범위 밖).

**Tech Stack:** TypeScript 변경 없음. 기존 02 plan의 db-bootstrap fixture 헬퍼 사용.

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `packages/audit-recorder-store/src/factory.ts` | `createAuditRecorder` dialect 분기 factory |
| `packages/audit-recorder-store/src/factory.test.ts` | factory 단위 (dialect=sqlite 통과, dialect=pg env gate) |
| `packages/audit-recorder-store/src/port-contract.test.ts` | 양쪽 어댑터 동등성 시나리오 (describe.each) |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `packages/audit-recorder-store/package.json` | `db-bootstrap` dev dep 추가 |
| `packages/audit-recorder-store/src/index.ts` | `createAuditRecorder` re-export 추가 |

---

## Task 0: baseline

- [ ] **Step 1: Plan 06a + 06b 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls packages/audit-recorder-store/src/sqlite/adapter.ts packages/audit-recorder-store/src/pg/adapter.ts && \
  grep -n "SqliteAuditRecorder\|PgAuditRecorder" packages/audit-recorder-store/src/index.ts
```

Expected: 두 adapter 파일 + index.ts에서 둘 다 export. 미완료 시 본 plan 시작 금지.

- [ ] **Step 2: Plan 04c (db-bootstrap) 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls packages/db-bootstrap/dist/index.js && \
  grep -n "createSqliteTestFixture\|createPgTestFixture" packages/db-bootstrap/src/index.ts
```

Expected: dist 존재 + fixture 헬퍼 export. 미완료 시 db-bootstrap build 선행:

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter db-bootstrap build
```

- [ ] **Step 3: 현재 회귀 baseline**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter audit-recorder-store test 2>&1 | tail -10
```

Expected: 13+2 SQLite + 7 PG (env 있을 때) PASS.

---

## Task 1: package.json — db-bootstrap dev dep

**Files:**
- Modify: `packages/audit-recorder-store/package.json`

- [ ] **Step 1: devDependencies에 db-bootstrap 추가**

```json
{
  "devDependencies": {
    "@types/better-sqlite3": "catalog:",
    "@types/node": "^22.0.0",
    "better-sqlite3": "catalog:",
    "db-bootstrap": "workspace:*",
    "postgres": "^3.4.0",
    "resource-policy-store": "workspace:*",
    "tsup": "^8.5.1",
    "typescript": "^5.8.2",
    "vitest": "^1.6.1",
    "weighted-index": "workspace:*"
  }
}
```

- [ ] **Step 2: pnpm install**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install
```

Expected: workspace 링크. db-bootstrap 인식.

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/audit-recorder-store/package.json pnpm-lock.yaml && git commit -m "$(cat <<'EOF'
chore(audit-recorder-store): db-bootstrap dev dep 추가

contract test가 createSqliteTestFixture / createPgTestFixture 사용.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: factory.ts — createAuditRecorder

**Files:**
- Create: `packages/audit-recorder-store/src/factory.ts`
- Create: `packages/audit-recorder-store/src/factory.test.ts`

- [ ] **Step 1: 테스트 먼저**

`packages/audit-recorder-store/src/factory.test.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { createAuditRecorder } from "./factory.js";
import { AUDIT_ENTRIES_DDL } from "./sqlite/schema.js";

describe("createAuditRecorder — dialect 분기", () => {
  it("dialect=sqlite → SqliteAuditRecorder 인스턴스", async () => {
    const raw = new Database(":memory:");
    raw.exec(AUDIT_ENTRIES_DDL);
    const db = drizzleSqlite({ client: raw });

    const recorder = await createAuditRecorder({ dialect: "sqlite", db });
    // duck-typing — 인터페이스 충족하면 OK (클래스명 직접 의존 회피)
    expect(typeof recorder.startExecution).toBe("function");
    expect(typeof recorder.finishExecution).toBe("function");
    expect(typeof recorder.recordCheck).toBe("function");
    expect(typeof recorder.get).toBe("function");
    expect(typeof recorder.listByRoot).toBe("function");
    expect(typeof recorder.firstFailure).toBe("function");

    // 동작 smoke
    const e = await recorder.startExecution({
      spanId: "s", traceId: "t", parentSpanId: null,
      apiId: "A", actorUserId: "u", targetKind: "resource", targetId: "r",
    });
    expect(e.depth).toBe(0);

    raw.close();
  });

  it("dialect 미지원 값 → throw", async () => {
    await expect(
      // @ts-expect-error — 의도적 invalid dialect
      createAuditRecorder({ dialect: "mongo", db: {} }),
    ).rejects.toThrow(/dialect/i);
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter audit-recorder-store test -- factory
```

Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`packages/audit-recorder-store/src/factory.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * createAuditRecorder — dialect 분기 factory.
 *
 * 호출자는 dialect + 이미 부팅된 Drizzle DB만 전달하고, 결과로 AuditRecorder를 받는다.
 * 드라이버는 dynamic import — 미설치 환경에서도 본 모듈 import는 실패하지 않음.
 *
 * pg-migration-design.md §2 factory 패턴 준용.
 */

import type { AuditRecorder } from "permission-engine";

export type AuditRecorderDialect = "sqlite" | "pg";

export interface CreateAuditRecorderArgs {
  dialect: AuditRecorderDialect;
  /** Drizzle DB 인스턴스. dialect와 일치해야 한다. */
  db: unknown;
}

export async function createAuditRecorder(
  args: CreateAuditRecorderArgs,
): Promise<AuditRecorder> {
  if (args.dialect === "sqlite") {
    const { SqliteAuditRecorder } = await import("./sqlite/adapter.js");
    // BetterSQLite3Database 타입은 caller 책임 — factory는 unknown으로 받고 어댑터에 위임
    return new SqliteAuditRecorder(args.db as never);
  }
  if (args.dialect === "pg") {
    const { PgAuditRecorder } = await import("./pg/adapter.js");
    return new PgAuditRecorder(args.db as never);
  }
  throw new Error(`Unsupported dialect: ${(args as { dialect: string }).dialect}`);
}
```

- [ ] **Step 4: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter audit-recorder-store test -- factory
```

Expected: 2 PASS.

- [ ] **Step 5: index.ts re-export**

`packages/audit-recorder-store/src/index.ts`에 추가:

```ts
// Factory (Plan 06c)
export {
  createAuditRecorder,
  type AuditRecorderDialect,
  type CreateAuditRecorderArgs,
} from "./factory.js";
```

- [ ] **Step 6: typecheck + build**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter audit-recorder-store typecheck && pnpm --filter audit-recorder-store build
```

Expected: 에러 없음. d.ts에 createAuditRecorder 노출:

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep "createAuditRecorder\|AuditRecorderDialect" packages/audit-recorder-store/dist/index.d.ts
```

Expected: 둘 다 export.

- [ ] **Step 7: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/audit-recorder-store/src && git commit -m "$(cat <<'EOF'
feat(audit-recorder-store): createAuditRecorder factory — dialect 분기

dynamic import로 SQLite/PG 어댑터 분기.
public exports에 factory + 타입 추가.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: port-contract.test.ts — 양쪽 어댑터 동등성

**Files:**
- Create: `packages/audit-recorder-store/src/port-contract.test.ts`

`describe.each(fixtures)` 패턴 — 동일 시나리오를 SQLite + (env gate) PG 양쪽에 적용. AuditRecorder 인터페이스의 6개 메서드 전체 동등성 검증.

- [ ] **Step 1: 테스트 작성**

`packages/audit-recorder-store/src/port-contract.test.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * AuditRecorder 인터페이스의 양쪽 어댑터 동등성 contract.
 *
 * 모든 시나리오는 dialect-agnostic — 같은 입력 → 같은 출력.
 * SQLite는 항상 실행, PG는 QA_TEST_PG=1 + qa-sdk-db 컨테이너 부팅 시에만.
 *
 * 검증 메서드 (AuditRecorder 인터페이스 6개 전체):
 *   - startExecution (root + child + parent 누락 에러)
 *   - finishExecution (정상 + 미존재 에러 + check kind 에러)
 *   - recordCheck    (parent 정상 + 누락 에러)
 *   - get            (존재 + 미존재)
 *   - listByRoot     (정렬 invariant)
 *   - firstFailure   (deny 발견 + 모두 성공 시 null)
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

import {
  EntryNotFoundError,
  ParentNotFoundError,
  type AuditRecorder,
} from "permission-engine";

import {
  createSqliteTestFixture,
  createPgTestFixture,
  type PgFixtureConfig,
} from "db-bootstrap";

import { createAuditRecorder } from "./factory.js";
import { AUDIT_ENTRIES_DDL } from "./sqlite/schema.js";
import { AUDIT_ENTRIES_PG_DDL } from "./pg/schema.js";

// ── Fixture 정의 ───────────────────────────────────────────────────────────────

interface ContractFixture {
  setup(): Promise<{
    recorder: AuditRecorder;
    cleanup(): Promise<void>;
  }>;
}

const sqliteFixture: ContractFixture = {
  async setup() {
    const f = await createSqliteTestFixture(AUDIT_ENTRIES_DDL);
    const recorder = await createAuditRecorder({ dialect: "sqlite", db: f.db });
    return { recorder, cleanup: f.cleanup };
  },
};

function makePgFixture(): ContractFixture {
  const cfg: PgFixtureConfig = {
    pgHost: process.env.QA_TEST_PG_HOST ?? "localhost",
    pgPort: Number(process.env.QA_TEST_PG_PORT ?? "5434"),
    pgDatabase: process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test",
    pgUser: process.env.QA_TEST_PG_USER ?? "qa_admin",
    pgPassword: process.env.QA_TEST_PG_PASSWORD ?? "",
  };
  return {
    async setup() {
      // PG fixture는 random schema 생성 + DDL을 search_path 안에서 실행 → schema-less DDL 필요
      const schemaName = `test_${randomBytes(4).toString("hex")}`;
      const ddl = AUDIT_ENTRIES_PG_DDL
        .replaceAll("audit.audit_entries", `${schemaName}.audit_entries`)
        .replace("CREATE SCHEMA IF NOT EXISTS audit", `CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
      // db-bootstrap의 createPgTestFixture는 자체 schema 관리 — 본 contract는 직접 schema 제어로 RLS DDL 포함
      const f = await createPgTestFixture(`SELECT 1;`, cfg); // 빈 fixture 부팅 후 DDL 직접 적용
      // f.db는 drizzle 인스턴스 — raw sql 접근 위해 별도 connection 필요
      // 단순화: db-bootstrap의 fixture를 그대로 활용하되 DDL을 schema로 적용
      // → 본 contract test는 별도 연결로 DDL 적용
      throw new Error("PG fixture는 db-bootstrap createPgTestFixture(ddl, cfg)로 직접 호출하도록 변경 필요");
    },
  };
}

// 위 makePgFixture는 schema-less DDL 형태로 단순화 — 아래 simplePgFixture 사용
function simplePgFixture(): ContractFixture {
  const cfg: PgFixtureConfig = {
    pgHost: process.env.QA_TEST_PG_HOST ?? "localhost",
    pgPort: Number(process.env.QA_TEST_PG_PORT ?? "5434"),
    pgDatabase: process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test",
    pgUser: process.env.QA_TEST_PG_USER ?? "qa_admin",
    pgPassword: process.env.QA_TEST_PG_PASSWORD ?? "",
  };
  // schema-less DDL — db-bootstrap의 createPgTestFixture가 random schema 생성 후 search_path 안에서 실행
  const SCHEMALESS_DDL = `
    CREATE TABLE audit_entries (
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
    CREATE INDEX idx_audit_root_pg ON audit_entries(root_span_id);
  `;
  return {
    async setup() {
      const f = await createPgTestFixture(SCHEMALESS_DDL, cfg);
      const recorder = await createAuditRecorder({ dialect: "pg", db: f.db });
      return { recorder, cleanup: f.cleanup };
    },
  };
}

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

const fixtures: Array<readonly [string, ContractFixture]> = [
  ["sqlite", sqliteFixture],
  ...(PG_AVAILABLE ? [["pg", simplePgFixture()] as const] : []),
];

// ── Contract 시나리오 ──────────────────────────────────────────────────────────

describe.each(fixtures)("AuditRecorder contract — %s", (_dialect, fixture) => {
  let recorder: AuditRecorder;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const ctx = await fixture.setup();
    recorder = ctx.recorder;
    cleanup = ctx.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("startExecution — 트리 구축", () => {
    it("root execution: parent=null → rootSpanId=self, depth=0", async () => {
      const e = await recorder.startExecution({
        spanId: "root", traceId: "t1", parentSpanId: null,
        apiId: "A", actorUserId: "u", targetKind: "transaction", targetId: "tx-A",
      });
      expect(e.rootSpanId).toBe("root");
      expect(e.depth).toBe(0);
      expect(e.kind).toBe("execution");
    });

    it("child execution: rootSpanId/depth는 parent에서 상속", async () => {
      await recorder.startExecution({
        spanId: "root", traceId: "t1", parentSpanId: null,
        apiId: "A", actorUserId: "u", targetKind: "transaction", targetId: "tx-A",
      });
      const c = await recorder.startExecution({
        spanId: "child", traceId: "t1", parentSpanId: "root",
        apiId: "B", actorUserId: "u", targetKind: "resource", targetId: "doc",
      });
      expect(c.rootSpanId).toBe("root");
      expect(c.depth).toBe(1);
    });

    it("parent 누락 → ParentNotFoundError", async () => {
      await expect(
        recorder.startExecution({
          spanId: "c", traceId: "t", parentSpanId: "missing",
          apiId: "A", actorUserId: "u", targetKind: "resource", targetId: "r",
        }),
      ).rejects.toThrow(ParentNotFoundError);
    });
  });

  describe("recordCheck", () => {
    it("execution의 child로 check entry 기록", async () => {
      await recorder.startExecution({
        spanId: "e", traceId: "t", parentSpanId: null,
        apiId: "A", actorUserId: "u", targetKind: "resource", targetId: "r",
      });
      const c = await recorder.recordCheck({
        spanId: "c1", traceId: "t", parentSpanId: "e",
        pass: "bitmap", outcome: "allow", address: 42, unionKind: "resource",
      });
      expect(c.kind).toBe("check");
      expect(c.rootSpanId).toBe("e");
      expect(c.depth).toBe(1);
      expect(c.pass).toBe("bitmap");
      expect(c.address).toBe(42);
    });

    it("parent 누락 → ParentNotFoundError", async () => {
      await expect(
        recorder.recordCheck({
          spanId: "c", traceId: "t", parentSpanId: "missing",
          pass: "bitmap", outcome: "allow",
        }),
      ).rejects.toThrow(ParentNotFoundError);
    });
  });

  describe("finishExecution", () => {
    it("outcome 기록 + endedAt 채움", async () => {
      await recorder.startExecution({
        spanId: "e", traceId: "t", parentSpanId: null,
        apiId: "A", actorUserId: "u", targetKind: "resource", targetId: "r",
      });
      const done = await recorder.finishExecution("e", "allow", "2026-04-22T10:05:00Z");
      expect(done.outcome).toBe("allow");
      expect(done.endedAt).toBe("2026-04-22T10:05:00Z");
    });

    it("미존재 spanId → EntryNotFoundError", async () => {
      await expect(recorder.finishExecution("missing", "allow"))
        .rejects.toThrow(EntryNotFoundError);
    });

    it("check entry에 finishExecution → throw", async () => {
      await recorder.startExecution({
        spanId: "e", traceId: "t", parentSpanId: null,
        apiId: "A", actorUserId: "u", targetKind: "resource", targetId: "r",
      });
      await recorder.recordCheck({
        spanId: "c", traceId: "t", parentSpanId: "e",
        pass: "bitmap", outcome: "allow",
      });
      await expect(recorder.finishExecution("c", "allow")).rejects.toThrow();
    });
  });

  describe("get", () => {
    it("존재하는 spanId → entry 반환", async () => {
      await recorder.startExecution({
        spanId: "e", traceId: "t", parentSpanId: null,
        apiId: "A", actorUserId: "u", targetKind: "resource", targetId: "r",
      });
      const got = await recorder.get("e");
      expect(got?.spanId).toBe("e");
      expect(got?.kind).toBe("execution");
    });

    it("미존재 → null", async () => {
      const got = await recorder.get("nonexistent");
      expect(got).toBeNull();
    });
  });

  describe("listByRoot — depth asc, startedAt asc", () => {
    it("동일 root의 모든 entry를 정렬해 반환", async () => {
      const t0 = "2026-04-22T10:00:00.000Z";
      const t1 = "2026-04-22T10:00:01.000Z";
      const t2 = "2026-04-22T10:00:02.000Z";
      const t3 = "2026-04-22T10:00:03.000Z";
      await recorder.startExecution({
        spanId: "r", traceId: "t", parentSpanId: null,
        apiId: "A", actorUserId: "u", targetKind: "transaction", targetId: "A", now: t0,
      });
      await recorder.startExecution({
        spanId: "c1", traceId: "t", parentSpanId: "r",
        apiId: "B", actorUserId: "u", targetKind: "resource", targetId: "r1", now: t1,
      });
      await recorder.startExecution({
        spanId: "c2", traceId: "t", parentSpanId: "r",
        apiId: "C", actorUserId: "u", targetKind: "resource", targetId: "r2", now: t2,
      });
      await recorder.recordCheck({
        spanId: "chk", traceId: "t", parentSpanId: "c1",
        pass: "bitmap", outcome: "allow", now: t3,
      });
      const list = await recorder.listByRoot("r");
      expect(list.map((e) => e.spanId)).toEqual(["r", "c1", "c2", "chk"]);
      expect(list.map((e) => e.depth)).toEqual([0, 1, 1, 2]);
    });

    it("미존재 root → 빈 배열", async () => {
      const list = await recorder.listByRoot("missing");
      expect(list).toEqual([]);
    });
  });

  describe("firstFailure", () => {
    it("deny entry를 트리에서 찾는다", async () => {
      const t0 = "2026-04-22T10:00:00.000Z";
      const t1 = "2026-04-22T10:00:01.000Z";
      const t2 = "2026-04-22T10:00:02.000Z";
      await recorder.startExecution({
        spanId: "r", traceId: "t", parentSpanId: null,
        apiId: "A", actorUserId: "u", targetKind: "transaction", targetId: "A", now: t0,
      });
      await recorder.recordCheck({
        spanId: "c1", traceId: "t", parentSpanId: "r",
        pass: "bitmap", outcome: "allow", address: 0, now: t1,
      });
      await recorder.recordCheck({
        spanId: "c2", traceId: "t", parentSpanId: "r",
        pass: "lifecycle", outcome: "deny", denyReason: "not_owner", now: t2,
      });
      const fail = await recorder.firstFailure("r");
      expect(fail?.spanId).toBe("c2");
      if (fail?.kind === "check") {
        expect(fail.denyReason).toBe("not_owner");
      }
    });

    it("모두 성공 → null", async () => {
      await recorder.startExecution({
        spanId: "r", traceId: "t", parentSpanId: null,
        apiId: "A", actorUserId: "u", targetKind: "transaction", targetId: "A",
      });
      await recorder.recordCheck({
        spanId: "c1", traceId: "t", parentSpanId: "r",
        pass: "bitmap", outcome: "allow",
      });
      await recorder.finishExecution("r", "allow");
      expect(await recorder.firstFailure("r")).toBeNull();
    });
  });

  describe("metadata 라운드트립", () => {
    it("객체 metadata 저장·복원", async () => {
      await recorder.startExecution({
        spanId: "e", traceId: "t", parentSpanId: null,
        apiId: "A", actorUserId: "u", targetKind: "resource", targetId: "r",
        metadata: { source: "http", reqId: "abc-123" },
      });
      const got = await recorder.get("e");
      expect(got?.metadata).toEqual({ source: "http", reqId: "abc-123" });
    });

    it("metadata 없는 entry → metadata=undefined로 복원", async () => {
      await recorder.startExecution({
        spanId: "e", traceId: "t", parentSpanId: null,
        apiId: "A", actorUserId: "u", targetKind: "resource", targetId: "r",
      });
      const got = await recorder.get("e");
      expect(got?.metadata).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: SQLite contract 통과 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter audit-recorder-store test -- port-contract
```

Expected: SQLite suite 모든 시나리오 PASS (PG는 env 없으면 skip).

- [ ] **Step 3: PG contract 통과 확인 (env gate)**

```bash
QA_TEST_PG=1 \
  QA_TEST_PG_PASSWORD=$(grep QA_SDK_ADMIN_PASSWORD /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter audit-recorder-store test -- port-contract
```

Expected: SQLite + PG 모두 동일 시나리오 통과. 두 dialect 동등성 확정.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/audit-recorder-store/src/port-contract.test.ts && git commit -m "$(cat <<'EOF'
test(audit-recorder-store): port-contract — 양쪽 어댑터 동등성

describe.each(fixtures)로 SQLite + (env gate) PG 동일 시나리오 검증.
AuditRecorder 6개 메서드 (startExecution/finishExecution/recordCheck/get/listByRoot/firstFailure) 전체 동등성.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: e2e-integration.test.ts 회귀

본 plan은 e2e-integration.test.ts를 수정하지 않는다 (회귀 안전망 차원). 단 SqliteAuditRecorder/DrizzleResourcePolicyRegistry alias가 그대로 동작하는지 확인.

- [ ] **Step 1: 전체 테스트 실행 (SQLite)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter audit-recorder-store test 2>&1 | tail -15
```

Expected:
- 13 sqlite/adapter.test.ts PASS
- 2 e2e-integration.test.ts PASS
- 2 factory.test.ts PASS
- N port-contract.test.ts PASS (SQLite suite)
- 7 pg/adapter.test.ts SKIP (env gate)
- N port-contract.test.ts SKIP (PG suite, env gate)

- [ ] **Step 2: 전체 테스트 실행 (PG 포함)**

```bash
QA_TEST_PG=1 \
  QA_TEST_PG_PASSWORD=$(grep QA_SDK_ADMIN_PASSWORD /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter audit-recorder-store test 2>&1 | tail -15
```

Expected: 위 모든 카운트 + PG 시나리오까지 PASS.

- [ ] **Step 3: 외부 호출자 회귀 (있으면)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter "...^audit-recorder-store" test 2>&1 | tail -10
```

Expected: 통과. permission-engine·resource-policy-store 회귀 안전망.

---

## Task 5: README/index 문서 갱신 (선택)

본 plan은 코드 변경에 집중. CLAUDE.md/README 갱신은 06 시리즈 전체 종료 후 일괄 수행 (별도 후속).

- [ ] **Step 1: 본 task는 task-list 동기화 차원에서만 명시 — 실제 작업 없음.**

다음 후속 plan에서:
- `packages/audit-recorder-store/README.md` 생성 (사용 패턴 + dialect-only 환경 예시)
- `DrizzleAuditRecorder` deprecation 주석 (06 시리즈 stable 후)

---

## Self-Review

- [ ] `createAuditRecorder` factory가 dynamic import로 dialect 분기
- [ ] SQLite contract 시나리오 모두 PASS (인터페이스 6개 메서드 전체)
- [ ] PG contract 시나리오 모두 PASS (env gate, qa-sdk-db 부팅 가정)
- [ ] 양쪽 어댑터 동등성 — 같은 입력 → 같은 출력 보장
- [ ] e2e-integration.test.ts 무수정 회귀 통과 (backward-compat alias 동작)
- [ ] db-bootstrap fixture 헬퍼 사용 — store 패키지 자체 fixture 코드 중복 제거
- [ ] Plan 06 시리즈 (06a→06b→06c) 완결 — Plan 05와 동일 패턴 복제 성공

---

## Defer

| 작업 | 이유 |
|---|---|
| `DrizzleAuditRecorder` deprecation 마킹 | 외부 호출자(있으면) factory migration 후 별도 plan |
| 트리 구축 로직 순수 함수 추출 (Sqlite/Pg 공유) | contract test로 동등성 보장됨 — drift 발견 시 우선 추출 |
| permission-engine·소비 서비스 호출자 factory migration | 본 시리즈 외 후속 plan (Plan 05d 패턴) |
| README + 사용 패턴 문서화 | 06 시리즈 stable 확인 후 |
| AccessChecker가 audit injector 패턴으로 factory 사용 | 후속 plan에서 — 현재 e2e가 직접 인스턴스 사용 OK |

---

## 의존·후속

- **Plan 06a** (sqlite/ 재구성): 본 plan의 직접 의존 — SqliteAuditRecorder symbol 사용.
- **Plan 06b** (pg/ 어댑터): 본 plan의 직접 의존 — PgAuditRecorder symbol + AUDIT_ENTRIES_PG_DDL 사용.
- **Plan 04c** (db-bootstrap): contract test가 createSqliteTestFixture·createPgTestFixture 사용. 미완 시 본 plan Task 0에서 build 선행.
- **Plan 04a** (qa-sdk-db 컨테이너): PG suite 환경 게이트.
- **후속 (06 시리즈 외)**: 호출자 migration · DrizzleAuditRecorder deprecation · README · 순수 함수 추출.
