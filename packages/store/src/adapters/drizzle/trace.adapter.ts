// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { asc, eq } from "drizzle-orm";
import type { TraceStore, TraceUpsert, StoredTrace } from "@qa-sdk/core";
import type { DbExecutor } from "../../db/client.js";
import { traces } from "../../db/schema.js";

/** TraceStore의 Drizzle/PostgreSQL 구현 */
export class DrizzleTraceStore implements TraceStore {
  constructor(private readonly db: DbExecutor) {}

  async upsert(params: TraceUpsert): Promise<void> {
    const existing = await this.findById(params.traceId);

    if (!existing) {
      await this.db
        .insert(traces)
        .values({
          traceId: params.traceId,
          sessionId: params.sessionId,
          serviceName: params.serviceName,
          actorId: params.actorId,
          userId: params.userId,
          userAttributes: params.userAttributes,
          recordCount: params.recordCount,
          firstTimestamp: params.firstTimestamp,
          lastTimestamp: params.lastTimestamp,
        })
        .comment({ adapter: "TraceStore", method: "upsert.insert" });
      return;
    }

    const newFirst =
      existing.firstTimestamp && existing.firstTimestamp < params.firstTimestamp
        ? existing.firstTimestamp
        : params.firstTimestamp;

    const newLast =
      existing.lastTimestamp && existing.lastTimestamp > params.lastTimestamp
        ? existing.lastTimestamp
        : params.lastTimestamp;

    await this.db
      .update(traces)
      .set({
        recordCount: existing.recordCount + params.recordCount,
        firstTimestamp: newFirst,
        lastTimestamp: newLast,
        updatedAt: new Date(),
      })
      .where(eq(traces.traceId, params.traceId))
      .comment({ adapter: "TraceStore", method: "upsert.update" });
  }

  async findById(traceId: string): Promise<StoredTrace | null> {
    const [row] = await this.db
      .select()
      .from(traces)
      .where(eq(traces.traceId, traceId))
      .comment({ adapter: "TraceStore", method: "findById" });
    return row ? toStoredTrace(row) : null;
  }

  async findUnreconstructed(limit = 100): Promise<StoredTrace[]> {
    const rows = await this.db
      .select()
      .from(traces)
      .where(eq(traces.reconstructed, false))
      .orderBy(asc(traces.createdAt))
      .limit(limit)
      .comment({ adapter: "TraceStore", method: "findUnreconstructed" });
    return rows.map(toStoredTrace);
  }

  async markReconstructed(traceId: string): Promise<void> {
    await this.db
      .update(traces)
      .set({ reconstructed: true, updatedAt: new Date() })
      .where(eq(traces.traceId, traceId))
      .comment({ adapter: "TraceStore", method: "markReconstructed" });
  }
}

function toStoredTrace(row: typeof traces.$inferSelect): StoredTrace {
  return {
    traceId: row.traceId,
    sessionId: row.sessionId ?? null,
    serviceName: row.serviceName ?? null,
    actorId: row.actorId ?? null,
    userId: row.userId ?? null,
    userAttributes: row.userAttributes ?? null,
    recordCount: row.recordCount,
    firstTimestamp: row.firstTimestamp ?? null,
    lastTimestamp: row.lastTimestamp ?? null,
    reconstructed: row.reconstructed,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
