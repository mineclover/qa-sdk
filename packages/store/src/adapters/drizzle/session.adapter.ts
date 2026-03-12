import { eq } from "drizzle-orm";
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
      });
  }

  async findById(sessionId: string): Promise<StoredSession | null> {
    const [row] = await this.db
      .select()
      .from(qaSessions)
      .where(eq(qaSessions.sessionId, sessionId));
    return row ? toStoredSession(row) : null;
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
    labels: row.labels,
    startedAt: row.startedAt,
    closedAt: row.closedAt,
  };
}
