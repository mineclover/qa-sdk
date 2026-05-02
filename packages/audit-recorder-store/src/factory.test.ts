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
