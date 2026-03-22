import type { SqlDriver } from "index-meta";
import type { SessionStore, SessionUpsert, StoredSession } from "@qa-sdk/core";

export class D1SessionStore implements SessionStore {
  constructor(private readonly driver: SqlDriver) {}

  async upsert(params: SessionUpsert): Promise<void> {
    await this.driver.execute(
      `INSERT INTO qa_sessions (session_id, scenario_id, labels, actor_id, user_id, user_attributes, started_at)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT (session_id) DO NOTHING`,
      [
        params.sessionId, params.scenarioId ?? null,
        params.labels ? JSON.stringify(params.labels) : null,
        params.actorId ?? null, params.userId ?? null,
        params.userAttributes ? JSON.stringify(params.userAttributes) : null,
        new Date().toISOString(),
      ],
    );
  }

  async findById(sessionId: string): Promise<StoredSession | null> {
    const row = await this.driver.queryOne<RawRow>(
      "SELECT * FROM qa_sessions WHERE session_id = ?", [sessionId],
    );
    return row ? toStoredSession(row) : null;
  }

  async findByScenarioId(scenarioId: string, limit?: number): Promise<StoredSession[]> {
    const rows = await this.driver.query<RawRow>(
      `SELECT * FROM qa_sessions WHERE scenario_id = ? ORDER BY started_at DESC LIMIT ${limit ?? 100}`,
      [scenarioId],
    );
    return rows.map(toStoredSession);
  }

  async close(sessionId: string): Promise<void> {
    await this.driver.execute(
      "UPDATE qa_sessions SET closed_at = ? WHERE session_id = ?",
      [new Date().toISOString(), sessionId],
    );
  }
}

interface RawRow extends Record<string, unknown> {
  session_id: string; scenario_id: string | null; labels: string | null;
  actor_id: string | null; user_id: string | null; user_attributes: string | null;
  started_at: string; closed_at: string | null;
}

function toStoredSession(row: RawRow): StoredSession {
  return {
    sessionId: row.session_id,
    scenarioId: row.scenario_id,
    labels: row.labels ? JSON.parse(row.labels) : null,
    actorId: row.actor_id,
    userId: row.user_id,
    userAttributes: row.user_attributes ? JSON.parse(row.user_attributes) : null,
    startedAt: new Date(row.started_at),
    closedAt: row.closed_at ? new Date(row.closed_at) : null,
  };
}
