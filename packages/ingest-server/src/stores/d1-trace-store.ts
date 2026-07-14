// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * D1TraceStore — TraceStore의 D1/SQLite drizzle ORM 구현.
 * upsert: 없으면 insert, 있으면 recordCount 누적 + timestamp MIN/MAX 갱신.
 */
import { desc, eq, sql } from 'drizzle-orm';
import type { TraceStore, TraceUpsert, StoredTrace } from '@qa-sdk/core';
import { traces } from '../db/schema.js';
import { parseJsonColumn, type UserAttributesJson } from '../db/json-types.js';
import type { D1Db } from './d1-db-type.js';

export class D1TraceStore implements TraceStore {
  constructor(private readonly db: D1Db) {}

  async upsert(params: TraceUpsert): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .insert(traces)
      .values({
        traceId: params.traceId,
        sessionId: params.sessionId ?? null,
        serviceName: params.serviceName ?? null,
        actorId: params.actorId ?? null,
        userId: params.userId ?? null,
        userAttributes: params.userAttributes ? JSON.stringify(params.userAttributes) : null,
        recordCount: params.recordCount,
        firstTimestamp: params.firstTimestamp.toISOString(),
        lastTimestamp: params.lastTimestamp.toISOString(),
        reconstructed: false,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: traces.traceId,
        set: {
          recordCount: sql`${traces.recordCount} + ${params.recordCount}`,
          firstTimestamp: sql`MIN(${traces.firstTimestamp}, ${params.firstTimestamp.toISOString()})`,
          lastTimestamp: sql`MAX(${traces.lastTimestamp}, ${params.lastTimestamp.toISOString()})`,
          updatedAt: now,
        },
      });
  }

  async findById(traceId: string): Promise<StoredTrace | null> {
    const [row] = await this.db.select().from(traces).where(eq(traces.traceId, traceId));
    return row ? toStoredTrace(row) : null;
  }

  async findUnreconstructed(limit?: number): Promise<StoredTrace[]> {
    const rows = await this.db
      .select()
      .from(traces)
      .where(eq(traces.reconstructed, false))
      .orderBy(desc(traces.createdAt))
      .limit(limit ?? 100);
    return rows.map(toStoredTrace);
  }

  async findRecent(limit?: number): Promise<StoredTrace[]> {
    const rows = await this.db
      .select()
      .from(traces)
      .orderBy(desc(traces.updatedAt))
      .limit(limit ?? 50);
    return rows.map(toStoredTrace);
  }

  async markReconstructed(traceId: string): Promise<void> {
    await this.db
      .update(traces)
      .set({
        reconstructed: true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(traces.traceId, traceId));
  }
}

function toStoredTrace(row: typeof traces.$inferSelect): StoredTrace {
  return {
    traceId: row.traceId,
    sessionId: row.sessionId,
    serviceName: row.serviceName,
    actorId: row.actorId,
    userId: row.userId,
    userAttributes: parseJsonColumn<UserAttributesJson | null>(row.userAttributes, null),
    recordCount: row.recordCount,
    firstTimestamp: row.firstTimestamp ? new Date(row.firstTimestamp) : null,
    lastTimestamp: row.lastTimestamp ? new Date(row.lastTimestamp) : null,
    reconstructed: !!row.reconstructed,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}
