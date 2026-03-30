/**
 * D1VerdictStore — VerdictStore의 D1/SQLite drizzle ORM 구현.
 * ON CONFLICT (scenario_id, trace_id) → 기존 verdict 업데이트.
 */
import { and, desc, eq } from "drizzle-orm";
import type { VerdictStore, VerdictInsert, StoredVerdict } from "@qa-sdk/core";
import { verdictReports } from "../db/schema.js";
import { parseJsonColumn, type VerdictReportJson } from "../db/json-types.js";
import type { D1Db } from "./d1-db-type.js";

export class D1VerdictStore implements VerdictStore {
  constructor(private readonly db: D1Db) {}

  async insert(params: VerdictInsert): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .insert(verdictReports)
      .values({
        id: params.id,
        scenarioId: params.scenarioId,
        traceId: params.traceId,
        qaSessionId: params.qaSessionId ?? null,
        overallVerdict: params.overallVerdict,
        report: JSON.stringify(params.report),
        computedAt: now,
      })
      .onConflictDoUpdate({
        target: [verdictReports.scenarioId, verdictReports.traceId],
        set: {
          overallVerdict: params.overallVerdict,
          report: JSON.stringify(params.report),
          computedAt: now,
        },
      });
  }

  async removeByScenarioAndTrace(scenarioId: string, traceId: string): Promise<boolean> {
    await this.db
      .delete(verdictReports)
      .where(and(eq(verdictReports.scenarioId, scenarioId), eq(verdictReports.traceId, traceId)));
    return true;
  }

  async findByScenarioAndTrace(scenarioId: string, traceId: string): Promise<StoredVerdict | null> {
    const [row] = await this.db
      .select()
      .from(verdictReports)
      .where(and(eq(verdictReports.scenarioId, scenarioId), eq(verdictReports.traceId, traceId)));
    return row ? toStoredVerdict(row) : null;
  }

  async findByTraceId(traceId: string): Promise<StoredVerdict[]> {
    const rows = await this.db
      .select()
      .from(verdictReports)
      .where(eq(verdictReports.traceId, traceId))
      .orderBy(desc(verdictReports.computedAt));
    return rows.map(toStoredVerdict);
  }

  async findBySessionId(sessionId: string): Promise<StoredVerdict[]> {
    const rows = await this.db
      .select()
      .from(verdictReports)
      .where(eq(verdictReports.qaSessionId, sessionId))
      .orderBy(desc(verdictReports.computedAt));
    return rows.map(toStoredVerdict);
  }
}

function toStoredVerdict(row: typeof verdictReports.$inferSelect): StoredVerdict {
  return {
    id: row.id,
    scenarioId: row.scenarioId,
    traceId: row.traceId,
    qaSessionId: row.qaSessionId ?? undefined,
    overallVerdict: row.overallVerdict,
    report: parseJsonColumn<VerdictReportJson>(row.report, {
      scenario_id: row.scenarioId,
      trace_id: row.traceId,
      overall_verdict: "unknown",
      step_matches: [],
      missing_steps: [],
      unexpected_nodes: [],
      latency_violations: [],
      ordering_violations: [],
      summary: "",
      computed_at: row.computedAt,
    }),
    computedAt: new Date(row.computedAt),
  };
}
