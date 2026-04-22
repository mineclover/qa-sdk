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
 *
 * PG fixture 전략 (05 시리즈 학습):
 *   - drizzle pgSchema("audit")가 schema 이름을 하드코딩하므로 random schema 격리 불가.
 *   - 매 테스트마다 audit.audit_entries를 DROP/CREATE + fileParallelism:false.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  EntryNotFoundError,
  ParentNotFoundError,
  type AuditRecorder,
} from "permission-engine";

import { createSqliteTestFixture } from "db-bootstrap";

import { createAuditRecorder } from "./factory.js";
import { AUDIT_ENTRIES_DDL } from "./sqlite/schema.js";

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

/**
 * PG fixture — pgSchema("audit")가 하드코딩이므로 매번 DROP/CREATE로 초기화.
 * 05 시리즈의 resource-policy-store pg 테스트와 동일 패턴.
 */
const PG_RESET_DDL = `
DROP TABLE IF EXISTS audit.audit_entries CASCADE;

CREATE TABLE audit.audit_entries (
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
CREATE INDEX idx_audit_trace_pg  ON audit.audit_entries(trace_id);
CREATE INDEX idx_audit_root_pg   ON audit.audit_entries(root_span_id);
CREATE INDEX idx_audit_parent_pg ON audit.audit_entries(parent_span_id);
CREATE INDEX idx_audit_actor_pg  ON audit.audit_entries(actor_user_id, started_at);
CREATE INDEX idx_audit_target_pg ON audit.audit_entries(target_kind, target_id);

ALTER TABLE audit.audit_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY ae_temp_allow_all ON audit.audit_entries
  USING (true)
  WITH CHECK (true);
`;

function makePgFixture(): ContractFixture {
  return {
    async setup() {
      const postgres = (await import("postgres")).default;
      const { drizzle } = await import("drizzle-orm/postgres-js");
      const sql = postgres({
        host: process.env.QA_TEST_PG_HOST ?? "localhost",
        port: Number(process.env.QA_TEST_PG_PORT ?? "5434"),
        database: process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test",
        user: process.env.QA_TEST_PG_USER ?? "qa_admin",
        password: process.env.QA_TEST_PG_PASSWORD ?? "",
        max: 5,
        onnotice: () => {},
      });
      await sql.unsafe(PG_RESET_DDL);
      const recorder = await createAuditRecorder({
        dialect: "pg",
        db: drizzle({ client: sql }),
      });
      return {
        recorder,
        async cleanup() {
          try {
            await sql.unsafe(`DROP TABLE IF EXISTS audit.audit_entries CASCADE`);
          } finally {
            await sql.end();
          }
        },
      };
    },
  };
}

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

const fixtures: Array<readonly [string, ContractFixture]> = [
  ["sqlite", sqliteFixture],
  ...(PG_AVAILABLE ? ([["pg", makePgFixture()]] as const) : []),
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
