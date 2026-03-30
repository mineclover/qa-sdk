/**
 * ClickhouseRecordStore — RecordStore의 ClickHouse 구현.
 *
 * MergeTree 기반 append-only 저장.
 * batch insert 최적화 (단일 INSERT ... VALUES).
 */
import type { RecordStore, RecordInsert, StoredRecord, RecordPaginationParams, StoredRecordPage } from "@qa-sdk/core";

export interface ClickHouseClient {
  query(sql: string, params?: Record<string, unknown>): Promise<{ rows: Record<string, unknown>[] }>;
  insert(table: string, values: Record<string, unknown>[], columns: string[]): Promise<void>;
  exec(sql: string): Promise<void>;
}

export class ClickhouseRecordStore implements RecordStore {
  constructor(private readonly client: ClickHouseClient) {}

  async insertBatch(records: RecordInsert[]): Promise<void> {
    if (records.length === 0) return;
    const values = records.map(r => ({
      log_id: r.logId,
      trace_id: r.traceId,
      span_id: r.spanId,
      parent_span_id: r.parentSpanId ?? null,
      timestamp: r.timestamp.toISOString().replace("T", " ").replace("Z", ""),
      record_kind: r.recordKind,
      event_key: r.eventKey,
      event_version: r.eventVersion,
      span_name: r.spanName ?? null,
      start_time: r.startTime?.toISOString().replace("T", " ").replace("Z", "") ?? null,
      end_time: r.endTime?.toISOString().replace("T", " ").replace("Z", "") ?? null,
      status_code: r.statusCode ?? null,
      payload_format: r.payloadFormat,
      payload_encoding: r.payloadEncoding,
      payload_masking_applied: r.payloadMaskingApplied ? 1 : 0,
      payload_masked_fields: JSON.stringify(r.payloadMaskedFields),
      payload: r.payload ? JSON.stringify(r.payload) : null,
      registry_warning: r.registryWarning ?? null,
      address_context: r.addressContext ? JSON.stringify(r.addressContext) : null,
      qa_session_id: r.qaSessionId ?? null,
      actor_id: r.actorId ?? null,
      user_id: r.userId ?? null,
      user_attributes: r.userAttributes ? JSON.stringify(r.userAttributes) : null,
    }));

    await this.client.insert("event_records", values, Object.keys(values[0]));
  }

  async findByTraceId(traceId: string): Promise<StoredRecord[]> {
    const { rows } = await this.client.query(
      "SELECT * FROM event_records WHERE trace_id = {traceId:String} ORDER BY timestamp",
      { traceId },
    );
    return rows.map(toStoredRecord);
  }

  async findByTraceIdPaginated(traceId: string, params?: RecordPaginationParams): Promise<StoredRecordPage> {
    const limit = params?.limit ?? 100;
    const cursor = params?.cursor;
    let sql = "SELECT * FROM event_records WHERE trace_id = {traceId:String}";
    const p: Record<string, unknown> = { traceId };
    if (cursor) {
      sql += " AND (timestamp > {cursorTs:DateTime64(3)} OR (timestamp = {cursorTs:DateTime64(3)} AND log_id > {cursorId:String}))";
      p.cursorTs = cursor.timestamp.toISOString().replace("T", " ").replace("Z", "");
      p.cursorId = cursor.logId;
    }
    sql += ` ORDER BY timestamp, log_id LIMIT ${limit + 1}`;
    const { rows } = await this.client.query(sql, p);
    const items = rows.slice(0, limit).map(toStoredRecord);
    const hasMore = rows.length > limit;
    const last = items[items.length - 1];
    return { items, hasMore, nextCursor: hasMore && last ? { timestamp: last.timestamp, logId: last.logId } : null };
  }

  async findBySessionId(sessionId: string): Promise<StoredRecord[]> {
    const { rows } = await this.client.query(
      "SELECT * FROM event_records WHERE qa_session_id = {sessionId:String} ORDER BY timestamp",
      { sessionId },
    );
    return rows.map(toStoredRecord);
  }

  async findBySessionIdPaginated(sessionId: string, params?: RecordPaginationParams): Promise<StoredRecordPage> {
    return this.findByTraceIdPaginated(sessionId, params); // 동일 패턴
  }

  async findByTraceAndEventKey(traceId: string, eventKey: string): Promise<StoredRecord[]> {
    const { rows } = await this.client.query(
      "SELECT * FROM event_records WHERE trace_id = {traceId:String} AND event_key = {eventKey:String} ORDER BY timestamp",
      { traceId, eventKey },
    );
    return rows.map(toStoredRecord);
  }
}

import { parseJsonColumn } from "../db/json-types.js";

function parseJson<T>(val: string | null | undefined): T | undefined {
  return parseJsonColumn<T | undefined>(val, undefined);
}

function toStoredRecord(row: Record<string, unknown>): StoredRecord {
  return {
    logId: row.log_id as string,
    traceId: row.trace_id as string,
    spanId: row.span_id as string,
    parentSpanId: (row.parent_span_id as string | undefined) ?? undefined,
    timestamp: new Date(row.timestamp as string | number),
    recordKind: row.record_kind as string,
    eventKey: row.event_key as string,
    eventVersion: row.event_version as string,
    spanName: (row.span_name as string | undefined) ?? undefined,
    startTime: row.start_time ? new Date(row.start_time as string | number) : undefined,
    endTime: row.end_time ? new Date(row.end_time as string | number) : undefined,
    statusCode: (row.status_code as string | undefined) ?? undefined,
    payloadFormat: row.payload_format as string,
    payloadEncoding: row.payload_encoding as string,
    payloadMaskingApplied: !!row.payload_masking_applied,
    payloadMaskedFields: parseJson<string[]>(row.payload_masked_fields as string) ?? [],
    payload: parseJson(row.payload as string),
    registryWarning: (row.registry_warning as string | undefined) ?? undefined,
    addressContext: parseJson<Record<string, string>>(row.address_context as string),
    qaSessionId: (row.qa_session_id as string | undefined) ?? undefined,
    actorId: (row.actor_id as string | undefined) ?? undefined,
    userId: (row.user_id as string | undefined) ?? undefined,
    userAttributes: parseJson<Record<string, string>>(row.user_attributes as string),
    createdAt: new Date(row.created_at as string | number),
  };
}
