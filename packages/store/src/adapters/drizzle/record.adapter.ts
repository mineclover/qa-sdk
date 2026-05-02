// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { and, asc, eq, gt, gte, lte, or, type SQL } from "drizzle-orm";
import type {
  RecordStore,
  RecordInsert,
  RecordPaginationCursor,
  RecordPaginationParams,
  StoredRecord,
  StoredRecordPage,
  TimeRangeParams,
} from "@qa-sdk/core";
import type { DbExecutor } from "../../db/client.js";
import { eventRecords } from "../../db/schema.js";

/** RecordStore의 Drizzle/PostgreSQL 구현 */
export class DrizzleRecordStore implements RecordStore {
  constructor(private readonly db: DbExecutor) {}

  async insertBatch(records: RecordInsert[]): Promise<void> {
    if (records.length === 0) return;
    await this.db.insert(eventRecords).values(
      records.map((r) => ({
        logId: r.logId,
        traceId: r.traceId,
        spanId: r.spanId,
        parentSpanId: r.parentSpanId,
        timestamp: r.timestamp,
        recordKind: r.recordKind,
        eventKey: r.eventKey,
        eventVersion: r.eventVersion,
        spanName: r.spanName,
        startTime: r.startTime,
        endTime: r.endTime,
        statusCode: r.statusCode,
        payloadFormat: r.payloadFormat,
        payloadEncoding: r.payloadEncoding,
        payloadMaskingApplied: r.payloadMaskingApplied,
        payloadMaskedFields: r.payloadMaskedFields,
        payload: r.payload,
        registryWarning: r.registryWarning,
        addressContext: r.addressContext,
        qaSessionId: r.qaSessionId,
        actorId: r.actorId,
        userId: r.userId,
        userAttributes: r.userAttributes,
      })),
    ).onConflictDoNothing({ target: eventRecords.logId })
      .comment({ adapter: "RecordStore", method: "insertBatch" });
  }

  async findByTraceId(traceId: string): Promise<StoredRecord[]> {
    const rows = await this.db
      .select()
      .from(eventRecords)
      .where(eq(eventRecords.traceId, traceId))
      .orderBy(asc(eventRecords.timestamp), asc(eventRecords.logId))
      .comment({ adapter: "RecordStore", method: "findByTraceId" });
    return rows.map(toStoredRecord);
  }

  async findByTraceIdPaginated(
    traceId: string,
    params: RecordPaginationParams = {},
  ): Promise<StoredRecordPage> {
    const limit = params.limit ?? 50;
    const rows = await this.db
      .select()
      .from(eventRecords)
      .where(buildPaginatedWhere(eq(eventRecords.traceId, traceId), params.cursor))
      .orderBy(asc(eventRecords.timestamp), asc(eventRecords.logId))
      .limit(limit + 1)
      .comment({ adapter: "RecordStore", method: "findByTraceIdPaginated" });

    return toStoredRecordPage(rows, limit);
  }

  async findBySessionId(sessionId: string): Promise<StoredRecord[]> {
    const rows = await this.db
      .select()
      .from(eventRecords)
      .where(eq(eventRecords.qaSessionId, sessionId))
      .orderBy(asc(eventRecords.timestamp), asc(eventRecords.logId))
      .comment({ adapter: "RecordStore", method: "findBySessionId" });
    return rows.map(toStoredRecord);
  }

  async findBySessionIdPaginated(
    sessionId: string,
    params: RecordPaginationParams = {},
  ): Promise<StoredRecordPage> {
    const limit = params.limit ?? 50;
    const rows = await this.db
      .select()
      .from(eventRecords)
      .where(
        buildPaginatedWhere(eq(eventRecords.qaSessionId, sessionId), params.cursor),
      )
      .orderBy(asc(eventRecords.timestamp), asc(eventRecords.logId))
      .limit(limit + 1)
      .comment({ adapter: "RecordStore", method: "findBySessionIdPaginated" });

    return toStoredRecordPage(rows, limit);
  }

  async findByTraceAndEventKey(
    traceId: string,
    eventKey: string,
  ): Promise<StoredRecord[]> {
    const rows = await this.db
      .select()
      .from(eventRecords)
      .where(
        and(
          eq(eventRecords.traceId, traceId),
          eq(eventRecords.eventKey, eventKey),
        ),
      )
      .orderBy(asc(eventRecords.timestamp), asc(eventRecords.logId))
      .comment({ adapter: "RecordStore", method: "findByTraceAndEventKey" });
    return rows.map(toStoredRecord);
  }

  async findByTimeRange(params: TimeRangeParams): Promise<StoredRecord[]> {
    const conditions: SQL<unknown>[] = [];
    if (params.from) conditions.push(gte(eventRecords.timestamp, params.from));
    if (params.to) conditions.push(lte(eventRecords.timestamp, params.to));
    if (params.eventKey) conditions.push(eq(eventRecords.eventKey, params.eventKey));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = params.limit ?? 1000;

    const rows = await this.db
      .select()
      .from(eventRecords)
      .where(where)
      .orderBy(asc(eventRecords.timestamp), asc(eventRecords.logId))
      .limit(limit)
      .comment({ adapter: "RecordStore", method: "findByTimeRange" });

    return rows.map(toStoredRecord);
  }
}

function buildPaginatedWhere(
  baseCondition: SQL<unknown>,
  cursor?: RecordPaginationCursor,
): SQL<unknown> {
  if (!cursor) {
    return baseCondition;
  }

  return and(
    baseCondition,
    or(
      gt(eventRecords.timestamp, cursor.timestamp),
      and(
        eq(eventRecords.timestamp, cursor.timestamp),
        gt(eventRecords.logId, cursor.logId),
      ),
    ),
  ) as SQL<unknown>;
}

function toStoredRecordPage(
  rows: Array<typeof eventRecords.$inferSelect>,
  limit: number,
): StoredRecordPage {
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(toStoredRecord);
  const lastItem = items.at(-1);

  return {
    items,
    nextCursor:
      hasMore && lastItem
        ? {
            timestamp: new Date(lastItem.timestamp),
            logId: lastItem.logId,
          }
        : null,
    hasMore,
  };
}

function toStoredRecord(row: typeof eventRecords.$inferSelect): StoredRecord {
  return {
    logId: row.logId,
    traceId: row.traceId,
    spanId: row.spanId,
    parentSpanId: row.parentSpanId ?? undefined,
    timestamp: row.timestamp,
    recordKind: row.recordKind,
    eventKey: row.eventKey,
    eventVersion: row.eventVersion,
    spanName: row.spanName ?? undefined,
    startTime: row.startTime ?? undefined,
    endTime: row.endTime ?? undefined,
    statusCode: row.statusCode ?? undefined,
    payloadFormat: row.payloadFormat,
    payloadEncoding: row.payloadEncoding,
    payloadMaskingApplied: row.payloadMaskingApplied,
    payloadMaskedFields: row.payloadMaskedFields,
    payload: row.payload,
    registryWarning: row.registryWarning ?? undefined,
    addressContext: row.addressContext ?? undefined,
    qaSessionId: row.qaSessionId ?? undefined,
    actorId: row.actorId ?? undefined,
    userId: row.userId ?? undefined,
    userAttributes: row.userAttributes ?? undefined,
    createdAt: row.createdAt,
  };
}
