// @def.boundary ingest-system
// @def.doc ingest-system

import { asc, eq, isNull, sql } from 'drizzle-orm';
import type { DlqInsert, DlqPhase, DlqStore, StoredDlqItem } from '@qa-sdk/core';
import { deadLetterQueue } from '../db/schema.js';
import type { D1Db } from './d1-db-type.js';

/** DlqStore의 D1/SQLite 구현 */
export class D1DlqStore implements DlqStore {
  constructor(private readonly db: D1Db) {}

  async insert(params: DlqInsert): Promise<void> {
    await this.db.insert(deadLetterQueue).values({
      id: params.id,
      traceId: params.traceId,
      phase: params.phase,
      errorMessage: params.errorMessage,
      attemptCount: 0,
      createdAt: new Date().toISOString(),
    });
  }

  async findPending(limit = 100): Promise<StoredDlqItem[]> {
    const rows = await this.db
      .select()
      .from(deadLetterQueue)
      .where(isNull(deadLetterQueue.resolvedAt))
      .orderBy(asc(deadLetterQueue.createdAt))
      .limit(limit);
    return rows.map(toStoredDlqItem);
  }

  async markAttempted(id: string): Promise<void> {
    await this.db
      .update(deadLetterQueue)
      .set({
        attemptCount: sql`${deadLetterQueue.attemptCount} + 1`,
        lastAttemptedAt: new Date().toISOString(),
      })
      .where(eq(deadLetterQueue.id, id));
  }

  async markResolved(id: string): Promise<void> {
    await this.db
      .update(deadLetterQueue)
      .set({ resolvedAt: new Date().toISOString() })
      .where(eq(deadLetterQueue.id, id));
  }
}

function toStoredDlqItem(row: typeof deadLetterQueue.$inferSelect): StoredDlqItem {
  return {
    id: row.id,
    traceId: row.traceId,
    phase: row.phase as DlqPhase,
    errorMessage: row.errorMessage,
    attemptCount: row.attemptCount,
    lastAttemptedAt: row.lastAttemptedAt ? new Date(row.lastAttemptedAt) : null,
    createdAt: new Date(row.createdAt),
    resolvedAt: row.resolvedAt ? new Date(row.resolvedAt) : null,
  };
}
