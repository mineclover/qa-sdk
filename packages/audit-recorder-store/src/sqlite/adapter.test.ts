// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";

import { EntryNotFoundError, ParentNotFoundError } from "permission-engine";

import { SqliteAuditRecorder } from "./adapter.js";
import { AUDIT_ENTRIES_DDL } from "./schema.js";

describe("SqliteAuditRecorder — AuditRecorder 인터페이스 충족", () => {
  let db: BetterSQLite3Database;
  let rec: SqliteAuditRecorder;

  beforeEach(() => {
    const raw = new Database(":memory:");
    raw.exec(AUDIT_ENTRIES_DDL);
    db = drizzle({ client: raw });
    rec = new SqliteAuditRecorder(db);
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
