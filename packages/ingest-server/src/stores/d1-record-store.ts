/**
 * D1RecordStore — RecordStore의 D1/SQLite 구현.
 * jsonb → TEXT (JSON string), timestamp → TEXT (ISO-8601).
 */
import type { SqlDriver } from "index-meta";
import type { RecordStore, RecordInsert, StoredRecord, RecordPaginationParams, StoredRecordPage } from "@qa-sdk/core";

export class D1RecordStore implements RecordStore {
  constructor(private readonly driver: SqlDriver) {}

  async insertBatch(records: RecordInsert[]): Promise<void> {
    for (const r of records) {
      await this.driver.execute(
        `INSERT INTO event_records (
          log_id, trace_id, span_id, parent_span_id, timestamp, record_kind,
          event_key, event_version, span_name, start_time, end_time, status_code,
          payload_format, payload_encoding, payload_masking_applied, payload_masked_fields,
          payload, registry_warning, address_context, qa_session_id,
          actor_id, user_id, user_attributes, created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT (log_id) DO NOTHING`,
        [
          r.logId, r.traceId, r.spanId, r.parentSpanId ?? null,
          r.timestamp.toISOString(), r.recordKind,
          r.eventKey, r.eventVersion,
          r.spanName ?? null, r.startTime?.toISOString() ?? null,
          r.endTime?.toISOString() ?? null, r.statusCode ?? null,
          r.payloadFormat, r.payloadEncoding,
          r.payloadMaskingApplied ? 1 : 0,
          JSON.stringify(r.payloadMaskedFields),
          r.payload ? JSON.stringify(r.payload) : null,
          r.registryWarning ?? null,
          r.addressContext ? JSON.stringify(r.addressContext) : null,
          r.qaSessionId ?? null,
          r.actorId ?? null, r.userId ?? null,
          r.userAttributes ? JSON.stringify(r.userAttributes) : null,
          new Date().toISOString(),
        ],
      );
    }
  }

  async findByTraceId(traceId: string): Promise<StoredRecord[]> {
    const rows = await this.driver.query<RawRow>(
      "SELECT * FROM event_records WHERE trace_id = ? ORDER BY timestamp",
      [traceId],
    );
    return rows.map(toStoredRecord);
  }

  async findByTraceIdPaginated(traceId: string, params?: RecordPaginationParams): Promise<StoredRecordPage> {
    return this.paginate(
      "SELECT * FROM event_records WHERE trace_id = ?",
      [traceId], params,
    );
  }

  async findBySessionId(sessionId: string): Promise<StoredRecord[]> {
    const rows = await this.driver.query<RawRow>(
      "SELECT * FROM event_records WHERE qa_session_id = ? ORDER BY timestamp",
      [sessionId],
    );
    return rows.map(toStoredRecord);
  }

  async findBySessionIdPaginated(sessionId: string, params?: RecordPaginationParams): Promise<StoredRecordPage> {
    return this.paginate(
      "SELECT * FROM event_records WHERE qa_session_id = ?",
      [sessionId], params,
    );
  }

  async findByTraceAndEventKey(traceId: string, eventKey: string): Promise<StoredRecord[]> {
    const rows = await this.driver.query<RawRow>(
      "SELECT * FROM event_records WHERE trace_id = ? AND event_key = ? ORDER BY timestamp",
      [traceId, eventKey],
    );
    return rows.map(toStoredRecord);
  }

  private async paginate(baseQuery: string, baseParams: unknown[], params?: RecordPaginationParams): Promise<StoredRecordPage> {
    const limit = params?.limit ?? 100;
    let query = baseQuery;
    const qParams = [...baseParams];
    if (params?.cursor) {
      query += " AND (timestamp > ? OR (timestamp = ? AND log_id > ?))";
      const ts = params.cursor.timestamp.toISOString();
      qParams.push(ts, ts, params.cursor.logId);
    }
    query += ` ORDER BY timestamp, log_id LIMIT ${limit + 1}`;
    const rows = await this.driver.query<RawRow>(query, qParams);
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

interface RawRow extends Record<string, unknown> {
  log_id: string; trace_id: string; span_id: string; parent_span_id: string | null;
  timestamp: string; record_kind: string; event_key: string; event_version: string;
  span_name: string | null; start_time: string | null; end_time: string | null;
  status_code: string | null; payload_format: string; payload_encoding: string;
  payload_masking_applied: number; payload_masked_fields: string;
  payload: string | null; registry_warning: string | null;
  address_context: string | null; qa_session_id: string | null;
  actor_id: string | null; user_id: string | null; user_attributes: string | null;
  created_at: string;
}

function parseJson<T>(val: string | null): T | undefined {
  if (!val) return undefined;
  try { return JSON.parse(val); } catch { return undefined; }
}

function toStoredRecord(row: RawRow): StoredRecord {
  return {
    logId: row.log_id,
    traceId: row.trace_id,
    spanId: row.span_id,
    parentSpanId: row.parent_span_id ?? undefined,
    timestamp: new Date(row.timestamp),
    recordKind: row.record_kind,
    eventKey: row.event_key,
    eventVersion: row.event_version,
    spanName: row.span_name ?? undefined,
    startTime: row.start_time ? new Date(row.start_time) : undefined,
    endTime: row.end_time ? new Date(row.end_time) : undefined,
    statusCode: row.status_code ?? undefined,
    payloadFormat: row.payload_format,
    payloadEncoding: row.payload_encoding,
    payloadMaskingApplied: !!row.payload_masking_applied,
    payloadMaskedFields: parseJson<string[]>(row.payload_masked_fields) ?? [],
    payload: parseJson(row.payload),
    registryWarning: row.registry_warning ?? undefined,
    addressContext: parseJson<Record<string, string>>(row.address_context),
    qaSessionId: row.qa_session_id ?? undefined,
    actorId: row.actor_id ?? undefined,
    userId: row.user_id ?? undefined,
    userAttributes: parseJson<Record<string, string>>(row.user_attributes),
    createdAt: new Date(row.created_at),
  };
}
