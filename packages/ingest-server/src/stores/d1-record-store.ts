// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * D1RecordStore — RecordStore의 D1/SQLite drizzle ORM 구현.
 * text 컬럼 → ISO-8601 문자열로 저장, 조회 시 Date로 변환.
 */
import { and, asc, eq, gt, gte, lte, or, type SQL } from 'drizzle-orm';
import type {
  RecordStore,
  RecordInsert,
  RecordPaginationCursor,
  RecordPaginationParams,
  StoredRecord,
  StoredRecordPage,
  TimeRangeParams,
} from '@qa-sdk/core';
import { eventRecords } from '../db/schema.js';
import {
  parseJsonColumn,
  type AddressContextJson,
  type EventPayloadJson,
  type MetricLabelsJson,
  type MetricNumbersJson,
  type UserAttributesJson,
} from '../db/json-types.js';
import type { D1Db } from './d1-db-type.js';

export class D1RecordStore implements RecordStore {
  constructor(private readonly db: D1Db) {}

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
          payloadMaskedFields: JSON.stringify(r.payloadMaskedFields),
          payload: r.payload ? JSON.stringify(r.payload) : null,
          registryWarning: r.registryWarning ?? null,
          addressContext: r.addressContext ? JSON.stringify(r.addressContext) : null,
          qaSessionId: r.qaSessionId ?? null,
          actorId: r.actorId ?? null,
          userId: r.userId ?? null,
          userAttributes: r.userAttributes ? JSON.stringify(r.userAttributes) : null,
          metricType: r.metricType ?? null,
          metricName: r.metricName ?? null,
          metricValue: r.metricValue ?? null,
          metricUnit: r.metricUnit ?? null,
          metricLabels: r.metricLabels ? JSON.stringify(r.metricLabels) : null,
          metricBuckets: r.metricBuckets ? JSON.stringify(r.metricBuckets) : null,
          metricQuantiles: r.metricQuantiles ? JSON.stringify(r.metricQuantiles) : null,
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

  async findByTraceAndEventKey(traceId: string, eventKey: string): Promise<StoredRecord[]> {
    const rows = await this.db
      .select()
      .from(eventRecords)
      .where(and(eq(eventRecords.traceId, traceId), eq(eventRecords.eventKey, eventKey)))
      .orderBy(asc(eventRecords.timestamp));
    return rows.map(toStoredRecord);
  }

  async findByTimeRange(params: TimeRangeParams): Promise<StoredRecord[]> {
    const conditions: SQL<unknown>[] = [];
    if (params.from) conditions.push(gte(eventRecords.timestamp, params.from.toISOString()));
    if (params.to) conditions.push(lte(eventRecords.timestamp, params.to.toISOString()));
    if (params.eventKey) conditions.push(eq(eventRecords.eventKey, params.eventKey));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = params.limit ?? 1000;

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
    const limit = params?.limit ?? 100;
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
      nextCursor: hasMore && last ? { timestamp: last.timestamp, logId: last.logId } : null,
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
      and(eq(eventRecords.timestamp, ts), gt(eventRecords.logId, cursor.logId)),
    ),
  ) as SQL<unknown>;
}

function toStoredRecord(row: typeof eventRecords.$inferSelect): StoredRecord {
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
    payloadMaskingApplied: !!row.payloadMaskingApplied,
    payloadMaskedFields: parseJsonColumn<string[]>(row.payloadMaskedFields, []),
    payload: parseJsonColumn<EventPayloadJson | undefined>(row.payload, undefined),
    registryWarning: row.registryWarning ?? undefined,
    addressContext: parseJsonColumn<AddressContextJson | undefined>(row.addressContext, undefined),
    qaSessionId: row.qaSessionId ?? undefined,
    actorId: row.actorId ?? undefined,
    userId: row.userId ?? undefined,
    userAttributes: parseJsonColumn<UserAttributesJson | undefined>(row.userAttributes, undefined),
    metricType: row.metricType ?? undefined,
    metricName: row.metricName ?? undefined,
    metricValue: row.metricValue ?? undefined,
    metricUnit: row.metricUnit ?? undefined,
    metricLabels: parseJsonColumn<MetricLabelsJson | undefined>(row.metricLabels, undefined),
    metricBuckets: parseJsonColumn<MetricNumbersJson | undefined>(row.metricBuckets, undefined),
    metricQuantiles: parseJsonColumn<MetricNumbersJson | undefined>(row.metricQuantiles, undefined),
    createdAt: new Date(row.createdAt),
  };
}
