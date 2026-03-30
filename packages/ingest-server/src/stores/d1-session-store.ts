/**
 * D1SessionStore — SessionStore의 D1/SQLite drizzle ORM 구현.
 * ON CONFLICT (session_id) DO NOTHING — 이미 존재하면 무시.
 */
import { desc, eq } from "drizzle-orm";
import type { SessionStore, SessionUpsert, StoredSession } from "@qa-sdk/core";
import { qaSessions } from "../db/schema.js";
import { parseJsonColumn, type SessionLabelsJson, type UserAttributesJson } from "../db/json-types.js";
import type { D1Db } from "./d1-db-type.js";

export class D1SessionStore implements SessionStore {
  constructor(private readonly db: D1Db) {}

  async upsert(params: SessionUpsert): Promise<void> {
    await this.db
      .insert(qaSessions)
      .values({
        sessionId: params.sessionId,
        scenarioId: params.scenarioId ?? null,
        labels: params.labels ? JSON.stringify(params.labels) : null,
        actorId: params.actorId ?? null,
        userId: params.userId ?? null,
        userAttributes: params.userAttributes ? JSON.stringify(params.userAttributes) : null,
        startedAt: new Date().toISOString(),
      })
      .onConflictDoNothing({ target: qaSessions.sessionId });
  }

  async findById(sessionId: string): Promise<StoredSession | null> {
    const [row] = await this.db
      .select()
      .from(qaSessions)
      .where(eq(qaSessions.sessionId, sessionId));
    return row ? toStoredSession(row) : null;
  }

  async findByScenarioId(scenarioId: string, limit?: number): Promise<StoredSession[]> {
    const rows = await this.db
      .select()
      .from(qaSessions)
      .where(eq(qaSessions.scenarioId, scenarioId))
      .orderBy(desc(qaSessions.startedAt))
      .limit(limit ?? 100);
    return rows.map(toStoredSession);
  }

  async close(sessionId: string): Promise<void> {
    await this.db
      .update(qaSessions)
      .set({ closedAt: new Date().toISOString() })
      .where(eq(qaSessions.sessionId, sessionId));
  }
}

function toStoredSession(row: typeof qaSessions.$inferSelect): StoredSession {
  return {
    sessionId: row.sessionId,
    scenarioId: row.scenarioId,
    labels: parseJsonColumn<SessionLabelsJson | null>(row.labels, null),
    actorId: row.actorId,
    userId: row.userId,
    userAttributes: parseJsonColumn<UserAttributesJson | null>(row.userAttributes, null),
    startedAt: new Date(row.startedAt),
    closedAt: row.closedAt ? new Date(row.closedAt) : null,
  };
}
