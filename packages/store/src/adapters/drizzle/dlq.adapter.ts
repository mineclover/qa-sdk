// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { asc, eq, isNull, sql } from "drizzle-orm";
import type { DlqInsert, DlqPhase, DlqStore, StoredDlqItem } from "@qa-sdk/core";
import type { DbExecutor } from "../../db/client.js";
import { deadLetterQueue } from "../../db/schema.js";

/** DlqStore의 Drizzle/PostgreSQL 구현 */
export class DrizzleDlqStore implements DlqStore {
  constructor(private readonly db: DbExecutor) {}

  async insert(params: DlqInsert): Promise<void> {
    await this.db.insert(deadLetterQueue).values({
      id: params.id,
      traceId: params.traceId,
      phase: params.phase,
      errorMessage: params.errorMessage,
    }).comment({ adapter: "DlqStore", method: "insert" });
  }

  async findPending(limit = 100): Promise<StoredDlqItem[]> {
    const rows = await this.db
      .select()
      .from(deadLetterQueue)
      .where(isNull(deadLetterQueue.resolvedAt))
      .orderBy(asc(deadLetterQueue.createdAt))
      .limit(limit)
      .comment({ adapter: "DlqStore", method: "findPending" });

    return rows.map(toStoredDlqItem);
  }

  async markAttempted(id: string): Promise<void> {
    await this.db
      .update(deadLetterQueue)
      .set({
        attemptCount: sql`${deadLetterQueue.attemptCount} + 1`,
        lastAttemptedAt: new Date(),
      })
      .where(eq(deadLetterQueue.id, id))
      .comment({ adapter: "DlqStore", method: "markAttempted" });
  }

  async markResolved(id: string): Promise<void> {
    await this.db
      .update(deadLetterQueue)
      .set({ resolvedAt: new Date() })
      .where(eq(deadLetterQueue.id, id))
      .comment({ adapter: "DlqStore", method: "markResolved" });
  }
}

function toStoredDlqItem(
  row: typeof deadLetterQueue.$inferSelect,
): StoredDlqItem {
  return {
    id: row.id,
    traceId: row.traceId,
    phase: row.phase as DlqPhase,
    errorMessage: row.errorMessage,
    attemptCount: row.attemptCount,
    lastAttemptedAt: row.lastAttemptedAt,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  };
}
