import { eq, and } from "drizzle-orm";
import type { VerdictStore, VerdictInsert, StoredVerdict } from "@qa-sdk/core";
import type { VerdictReport } from "@qa-sdk/core";
import type { Db } from "../../db/client.js";
import { verdictReports } from "../../db/schema.js";

/** VerdictStore의 Drizzle/PostgreSQL 구현 */
export class DrizzleVerdictStore implements VerdictStore {
  constructor(private readonly db: Db) {}

  async insert(params: VerdictInsert): Promise<void> {
    await this.db.insert(verdictReports).values({
      id: params.id,
      scenarioId: params.scenarioId,
      traceId: params.traceId,
      qaSessionId: params.qaSessionId,
      overallVerdict: params.overallVerdict,
      report: params.report,
    });
  }

  async findByScenarioAndTrace(
    scenarioId: string,
    traceId: string,
  ): Promise<StoredVerdict | null> {
    const [row] = await this.db
      .select()
      .from(verdictReports)
      .where(
        and(
          eq(verdictReports.scenarioId, scenarioId),
          eq(verdictReports.traceId, traceId),
        ),
      );
    return row ? toStoredVerdict(row) : null;
  }

  async findBySessionId(sessionId: string): Promise<StoredVerdict[]> {
    const rows = await this.db
      .select()
      .from(verdictReports)
      .where(eq(verdictReports.qaSessionId, sessionId));
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
    report: row.report as VerdictReport,
    computedAt: row.computedAt,
  };
}
