import type { SqlDriver } from "index-meta";
import type { VerdictStore, VerdictInsert, StoredVerdict } from "@qa-sdk/core";

export class D1VerdictStore implements VerdictStore {
  constructor(private readonly driver: SqlDriver) {}

  async insert(params: VerdictInsert): Promise<void> {
    const now = new Date().toISOString();
    await this.driver.execute(
      `INSERT INTO verdict_reports (id, scenario_id, trace_id, qa_session_id, overall_verdict, report, computed_at)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT (scenario_id, trace_id) DO UPDATE SET
         overall_verdict = excluded.overall_verdict,
         report = excluded.report,
         computed_at = excluded.computed_at`,
      [
        params.id, params.scenarioId, params.traceId,
        params.qaSessionId ?? null, params.overallVerdict,
        JSON.stringify(params.report), now,
      ],
    );
  }

  async removeByScenarioAndTrace(scenarioId: string, traceId: string): Promise<boolean> {
    await this.driver.execute(
      "DELETE FROM verdict_reports WHERE scenario_id = ? AND trace_id = ?",
      [scenarioId, traceId],
    );
    return true;
  }

  async findByScenarioAndTrace(scenarioId: string, traceId: string): Promise<StoredVerdict | null> {
    const row = await this.driver.queryOne<RawRow>(
      "SELECT * FROM verdict_reports WHERE scenario_id = ? AND trace_id = ?",
      [scenarioId, traceId],
    );
    return row ? toStoredVerdict(row) : null;
  }

  async findByTraceId(traceId: string): Promise<StoredVerdict[]> {
    const rows = await this.driver.query<RawRow>(
      "SELECT * FROM verdict_reports WHERE trace_id = ? ORDER BY computed_at DESC",
      [traceId],
    );
    return rows.map(toStoredVerdict);
  }

  async findBySessionId(sessionId: string): Promise<StoredVerdict[]> {
    const rows = await this.driver.query<RawRow>(
      "SELECT * FROM verdict_reports WHERE qa_session_id = ? ORDER BY computed_at DESC",
      [sessionId],
    );
    return rows.map(toStoredVerdict);
  }
}

interface RawRow extends Record<string, unknown> {
  id: string; scenario_id: string; trace_id: string; qa_session_id: string | null;
  overall_verdict: string; report: string; computed_at: string;
}

function toStoredVerdict(row: RawRow): StoredVerdict {
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    traceId: row.trace_id,
    qaSessionId: row.qa_session_id ?? undefined,
    overallVerdict: row.overall_verdict,
    report: JSON.parse(row.report),
    computedAt: new Date(row.computed_at),
  };
}
