import { describe, it, expect } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import * as schema from "../../db/schema.js";
import { withQueryTracing } from "@qa-sdk/otel";

/**
 * withQueryTracing + .comment() 통합 검증.
 *
 * drizzle.mock()은 SQL 생성만 가능하고 실행은 불가하므로,
 * .toSQL()로 SQL 출력에 sqlcommenter 주석이 포함되는지,
 * Proxy 체이닝이 깨지지 않는지를 검증한다.
 */
describe("withQueryTracing + .comment() 체이닝 검증", () => {
  const db = drizzle.mock({ schema });
  const instrumentedDb = withQueryTracing(db);

  it("SELECT 체이닝: Proxy → from → where → orderBy → comment → toSQL", () => {
    const query = instrumentedDb
      .select()
      .from(schema.eventRecords)
      .where(eq(schema.eventRecords.traceId, "test-trace"))
      .orderBy(schema.eventRecords.timestamp)
      .comment({ adapter: "RecordStore", method: "findByTraceId" })
      .toSQL();

    expect(query.sql).toContain("event_records");
    expect(query.sql).toContain("trace_id");
    expect(query.sql).toMatch(/\/\*.*adapter='RecordStore'.*method='findByTraceId'.*\*\//);
  });

  it("INSERT 체이닝: Proxy → values → onConflictDoNothing → comment → toSQL", () => {
    const query = instrumentedDb
      .insert(schema.eventRecords)
      .values({
        logId: "l1",
        traceId: "t1",
        spanId: "s1",
        timestamp: new Date(),
        recordKind: "log",
        eventKey: "test",
        eventVersion: "v1",
        payloadFormat: "json",
        payloadEncoding: "utf8",
        payloadMaskingApplied: false,
        payloadMaskedFields: [],
      })
      .onConflictDoNothing({ target: schema.eventRecords.logId })
      .comment({ adapter: "RecordStore", method: "insertBatch" })
      .toSQL();

    expect(query.sql).toContain("insert into");
    expect(query.sql).toMatch(/\/\*.*adapter='RecordStore'.*method='insertBatch'.*\*\//);
  });

  it("UPDATE 체이닝: Proxy → set → where → comment → toSQL", () => {
    const query = instrumentedDb
      .update(schema.traces)
      .set({ reconstructed: true, updatedAt: new Date() })
      .where(eq(schema.traces.traceId, "t1"))
      .comment({ adapter: "TraceStore", method: "markReconstructed" })
      .toSQL();

    expect(query.sql).toContain("update");
    expect(query.sql).toContain("traces");
    expect(query.sql).toMatch(/\/\*.*adapter='TraceStore'.*method='markReconstructed'.*\*\//);
  });

  it("DELETE 체이닝: Proxy → where → returning → comment → toSQL", () => {
    const query = instrumentedDb
      .delete(schema.verdictReports)
      .where(
        and(
          eq(schema.verdictReports.scenarioId, "s1"),
          eq(schema.verdictReports.traceId, "t1"),
        ),
      )
      .returning({ id: schema.verdictReports.id })
      .comment({ adapter: "VerdictStore", method: "removeByScenarioAndTrace" })
      .toSQL();

    expect(query.sql).toContain("delete from");
    expect(query.sql).toContain("verdict_reports");
    expect(query.sql).toMatch(/\/\*.*adapter='VerdictStore'.*method='removeByScenarioAndTrace'.*\*\//);
  });

  it("비-쿼리 프로퍼티는 Proxy가 간섭하지 않는다", () => {
    // schema 접근 등 쿼리가 아닌 프로퍼티는 원본 그대로
    expect(instrumentedDb.$client).toBeDefined();
  });
});
