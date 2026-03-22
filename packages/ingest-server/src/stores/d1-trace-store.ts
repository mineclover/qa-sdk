import type { SqlDriver } from "index-meta";
import type { TraceStore, TraceUpsert, StoredTrace } from "@qa-sdk/core";

export class D1TraceStore implements TraceStore {
  constructor(private readonly driver: SqlDriver) {}

  async upsert(params: TraceUpsert): Promise<void> {
    const now = new Date().toISOString();
    await this.driver.execute(
      `INSERT INTO traces (trace_id, session_id, service_name, actor_id, user_id, user_attributes,
        record_count, first_timestamp, last_timestamp, reconstructed, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,0,?,?)
       ON CONFLICT (trace_id) DO UPDATE SET
         record_count = traces.record_count + excluded.record_count,
         first_timestamp = MIN(traces.first_timestamp, excluded.first_timestamp),
         last_timestamp = MAX(traces.last_timestamp, excluded.last_timestamp),
         updated_at = excluded.updated_at`,
      [
        params.traceId, params.sessionId ?? null, params.serviceName ?? null,
        params.actorId ?? null, params.userId ?? null,
        params.userAttributes ? JSON.stringify(params.userAttributes) : null,
        params.recordCount,
        params.firstTimestamp.toISOString(), params.lastTimestamp.toISOString(),
        now, now,
      ],
    );
  }

  async findById(traceId: string): Promise<StoredTrace | null> {
    const row = await this.driver.queryOne<RawRow>(
      "SELECT * FROM traces WHERE trace_id = ?", [traceId],
    );
    return row ? toStoredTrace(row) : null;
  }

  async findUnreconstructed(limit?: number): Promise<StoredTrace[]> {
    const rows = await this.driver.query<RawRow>(
      `SELECT * FROM traces WHERE reconstructed = 0 ORDER BY created_at DESC LIMIT ${limit ?? 100}`,
    );
    return rows.map(toStoredTrace);
  }

  async markReconstructed(traceId: string): Promise<void> {
    await this.driver.execute(
      "UPDATE traces SET reconstructed = 1, updated_at = ? WHERE trace_id = ?",
      [new Date().toISOString(), traceId],
    );
  }
}

interface RawRow extends Record<string, unknown> {
  trace_id: string; session_id: string | null; service_name: string | null;
  actor_id: string | null; user_id: string | null; user_attributes: string | null;
  record_count: number; first_timestamp: string | null; last_timestamp: string | null;
  reconstructed: number; created_at: string; updated_at: string;
}

function toStoredTrace(row: RawRow): StoredTrace {
  return {
    traceId: row.trace_id,
    sessionId: row.session_id,
    serviceName: row.service_name,
    actorId: row.actor_id,
    userId: row.user_id,
    userAttributes: row.user_attributes ? JSON.parse(row.user_attributes) : null,
    recordCount: row.record_count,
    firstTimestamp: row.first_timestamp ? new Date(row.first_timestamp) : null,
    lastTimestamp: row.last_timestamp ? new Date(row.last_timestamp) : null,
    reconstructed: !!row.reconstructed,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
