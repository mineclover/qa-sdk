import { desc, eq } from "drizzle-orm";
import type { SessionStore, SessionUpsert, StoredSession } from "@qa-sdk/core";
import type { DbExecutor } from "../../db/client.js";
import { qaSessions } from "../../db/schema.js";

/** SessionStore의 Drizzle/PostgreSQL 구현 */
export class DrizzleSessionStore implements SessionStore {
  constructor(private readonly db: DbExecutor) {}

  async upsert(params: SessionUpsert): Promise<void> {
    const existing = await this.findById(params.sessionId);
    if (existing) return;

    await this.db
      .insert(qaSessions)
      .values({
        sessionId: params.sessionId,
        scenarioId: params.scenarioId,
        labels: params.labels,
        actorId: params.actorId,
        userId: params.userId,
        userAttributes: params.userAttributes,
      });
  }

  async findById(sessionId: string): Promise<StoredSession | null> {
    const [row] = await this.db
      .select()
      .from(qaSessions)
      .where(eq(qaSessions.sessionId, sessionId));
    return row ? toStoredSession(row) : null;
  }

  async findByScenarioId(scenarioId: string, limit = 100): Promise<StoredSession[]> {
    const rows = await this.db
      .select()
      .from(qaSessions)
      .where(eq(qaSessions.scenarioId, scenarioId))
      .orderBy(desc(qaSessions.startedAt))
      .limit(limit);
    return rows.map(toStoredSession);
  }

  async close(sessionId: string): Promise<void> {
    await this.db
      .update(qaSessions)
      .set({ closedAt: new Date() })
      .where(eq(qaSessions.sessionId, sessionId));
  }
}

function toStoredSession(row: typeof qaSessions.$inferSelect): StoredSession {
  return {
    sessionId: row.sessionId,
    scenarioId: row.scenarioId,
    labels: row.labels ?? null,
    actorId: row.actorId ?? null,
    userId: row.userId ?? null,
    userAttributes: row.userAttributes ?? null,
    startedAt: row.startedAt,
    closedAt: row.closedAt ?? null,
  };
}
