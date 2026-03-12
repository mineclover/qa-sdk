import { eq, and, asc } from "drizzle-orm";
import type { RecordStore, RecordInsert, StoredRecord } from "@qa-sdk/core";
import type { Db } from "../../db/client.js";
import { eventRecords } from "../../db/schema.js";

/** RecordStore의 Drizzle/PostgreSQL 구현 */
export class DrizzleRecordStore implements RecordStore {
  constructor(private readonly db: Db) {}

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
        qaSessionId: r.qaSessionId,
      })),
    );
  }

  async findByTraceId(traceId: string): Promise<StoredRecord[]> {
    const rows = await this.db
      .select()
      .from(eventRecords)
      .where(eq(eventRecords.traceId, traceId))
      .orderBy(asc(eventRecords.timestamp));
    return rows.map(toStoredRecord);
  }

  async findBySessionId(sessionId: string): Promise<StoredRecord[]> {
    const rows = await this.db
      .select()
      .from(eventRecords)
      .where(eq(eventRecords.qaSessionId, sessionId))
      .orderBy(asc(eventRecords.timestamp));
    return rows.map(toStoredRecord);
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
    qaSessionId: row.qaSessionId ?? undefined,
    createdAt: row.createdAt,
  };
}
