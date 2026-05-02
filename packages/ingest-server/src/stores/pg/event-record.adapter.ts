// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * PgRecordStore — RecordStore의 PostgreSQL 영속 구현 (Plan 07c).
 *
 * D1 어댑터(`d1-record-store.ts`)와 동일 비즈니스 로직.
 * dialect 차이:
 *   - jsonb 컬럼: payload/address_context/user_attributes/payload_masked_fields는
 *     native 객체 대입 (D1은 JSON.stringify 필요).
 *   - boolean payload_masking_applied: PG native (D1은 INTEGER).
 *
 * address_context는 emit 시점 (sdk auto-track)에서 AddressContextV1Schema로 검증되므로
 * 본 어댑터는 추가 validation 안 함 — §4 P2 정책 준수.
 */

import { and, asc, eq, gt, gte, lte, or, type SQL } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type {
  RecordInsert,
  RecordPaginationCursor,
  RecordPaginationParams,
  RecordStore,
  StoredRecord,
  StoredRecordPage,
  TimeRangeParams,
} from "@qa-sdk/core";

import { eventRecords, type EventRecordPgRow } from "./schema.js";

const DEFAULT_PAGE_LIMIT = 100;
const DEFAULT_TIME_RANGE_LIMIT = 1000;

export class PgRecordStore implements RecordStore {
  constructor(private readonly db: PostgresJsDatabase) {}

  async insertBatch(records: RecordInsert[]): Promise<void> {
    if (records.length === 0) return;
    for (const r of records) {
      await this.db
        .insert(eventRecords)
        .values({
          logId: r.logId,
          traceId: r.traceId,
          spanId: r.spanId,
          parentSpanId: r.parentSpanId ?? null,
          timestamp: r.timestamp.toISOString(),
          recordKind: r.recordKind,
          eventKey: r.eventKey,
          eventVersion: r.eventVersion,
          spanName: r.spanName ?? null,
          startTime: r.startTime?.toISOString() ?? null,
          endTime: r.endTime?.toISOString() ?? null,
          statusCode: r.statusCode ?? null,
          payloadFormat: r.payloadFormat,
          payloadEncoding: r.payloadEncoding,
          payloadMaskingApplied: r.payloadMaskingApplied,
          payloadMaskedFields: r.payloadMaskedFields,
          payload: r.payload ?? null,
          registryWarning: r.registryWarning ?? null,
          addressContext: r.addressContext ?? null,
          qaSessionId: r.qaSessionId ?? null,
          actorId: r.actorId ?? null,
          userId: r.userId ?? null,
          userAttributes: r.userAttributes ?? null,
          createdAt: new Date().toISOString(),
        })
        .onConflictDoNothing({ target: eventRecords.logId });
    }
  }

  async findByTraceId(traceId: string): Promise<StoredRecord[]> {
    const rows = await this.db
      .select()
      .from(eventRecords)
      .where(eq(eventRecords.traceId, traceId))
      .orderBy(asc(eventRecords.timestamp));
    return rows.map(toStoredRecord);
  }

  async findByTraceIdPaginated(
    traceId: string,
    params?: RecordPaginationParams,
  ): Promise<StoredRecordPage> {
    return this.paginate(eq(eventRecords.traceId, traceId), params);
  }

  async findBySessionId(sessionId: string): Promise<StoredRecord[]> {
    const rows = await this.db
      .select()
      .from(eventRecords)
      .where(eq(eventRecords.qaSessionId, sessionId))
      .orderBy(asc(eventRecords.timestamp));
    return rows.map(toStoredRecord);
  }

  async findBySessionIdPaginated(
    sessionId: string,
    params?: RecordPaginationParams,
  ): Promise<StoredRecordPage> {
    return this.paginate(eq(eventRecords.qaSessionId, sessionId), params);
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
      .orderBy(asc(eventRecords.timestamp));
    return rows.map(toStoredRecord);
  }

  async findByTimeRange(params: TimeRangeParams): Promise<StoredRecord[]> {
    const conditions: SQL<unknown>[] = [];
    if (params.from) {
      conditions.push(
        gte(eventRecords.timestamp, params.from.toISOString()),
      );
    }
    if (params.to) {
      conditions.push(lte(eventRecords.timestamp, params.to.toISOString()));
    }
    if (params.eventKey) {
      conditions.push(eq(eventRecords.eventKey, params.eventKey));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = params.limit ?? DEFAULT_TIME_RANGE_LIMIT;

    const rows = await this.db
      .select()
      .from(eventRecords)
      .where(where)
      .orderBy(asc(eventRecords.timestamp), asc(eventRecords.logId))
      .limit(limit);
    return rows.map(toStoredRecord);
  }

  private async paginate(
    baseCondition: SQL<unknown>,
    params?: RecordPaginationParams,
  ): Promise<StoredRecordPage> {
    const limit = params?.limit ?? DEFAULT_PAGE_LIMIT;
    const where = buildPaginatedWhere(baseCondition, params?.cursor);

    const rows = await this.db
      .select()
      .from(eventRecords)
      .where(where)
      .orderBy(asc(eventRecords.timestamp), asc(eventRecords.logId))
      .limit(limit + 1);

    const items = rows.slice(0, limit).map(toStoredRecord);
    const hasMore = rows.length > limit;
    const last = items[items.length - 1];
    return {
      items,
      hasMore,
      nextCursor:
        hasMore && last
          ? { timestamp: last.timestamp, logId: last.logId }
          : null,
    };
  }
}

function buildPaginatedWhere(
  baseCondition: SQL<unknown>,
  cursor?: RecordPaginationCursor,
): SQL<unknown> {
  if (!cursor) return baseCondition;
  const ts = cursor.timestamp.toISOString();
  return and(
    baseCondition,
    or(
      gt(eventRecords.timestamp, ts),
      and(
        eq(eventRecords.timestamp, ts),
        gt(eventRecords.logId, cursor.logId),
      ),
    ),
  ) as SQL<unknown>;
}

function toStoredRecord(row: EventRecordPgRow): StoredRecord {
  return {
    logId: row.logId,
    traceId: row.traceId,
    spanId: row.spanId,
    parentSpanId: row.parentSpanId ?? undefined,
    timestamp: new Date(row.timestamp),
    recordKind: row.recordKind,
    eventKey: row.eventKey,
    eventVersion: row.eventVersion,
    spanName: row.spanName ?? undefined,
    startTime: row.startTime ? new Date(row.startTime) : undefined,
    endTime: row.endTime ? new Date(row.endTime) : undefined,
    statusCode: row.statusCode ?? undefined,
    payloadFormat: row.payloadFormat,
    payloadEncoding: row.payloadEncoding,
    payloadMaskingApplied: row.payloadMaskingApplied,
    payloadMaskedFields: (row.payloadMaskedFields as string[]) ?? [],
    payload: row.payload ?? undefined,
    registryWarning: row.registryWarning ?? undefined,
    addressContext:
      (row.addressContext as Record<string, string> | null) ?? undefined,
    qaSessionId: row.qaSessionId ?? undefined,
    actorId: row.actorId ?? undefined,
    userId: row.userId ?? undefined,
    userAttributes:
      (row.userAttributes as Record<string, string> | null) ?? undefined,
    createdAt: new Date(row.createdAt),
  };
}
