// @def.boundary query-api-spec
// @def.doc query-api-spec

/**
 * Replay 전용 RecordStore — query-service 내부 구현.
 *
 * ingest-server의 D1RecordStore에 의존하지 않고,
 * raw SQL로 event_records 테이블에서 시간 범위 쿼리만 수행한다.
 */

import type { StoredRecord } from "@qa-sdk/core";

/** replay에 필요한 최소 포트 */
export interface ReplayRecordStore {
  findByTimeRange(params: { to?: Date; limit?: number }): Promise<StoredRecord[]>;
}

/** createSqliteDriver가 반환하는 drizzle DB 타입 (최소 인터페이스) */
interface SqliteDb {
  all(query: { toSQL(): { sql: string; params: unknown[] } }): unknown[];
}

/**
 * SQLite driver에서 replay용 RecordStore를 생성한다.
 * event_records 테이블이 존재해야 한다 (ingest-server가 생성).
 */
export function createReplayRecordStore(db: unknown): ReplayRecordStore {
  return {
    async findByTimeRange(params) {
      const limit = params.limit ?? 1000;
      const toTs = params.to?.toISOString() ?? new Date().toISOString();

      try {
        // raw SQL — drizzle 스키마 import 없이 직접 쿼리
        const sqlDb = db as { all(sql: string, ...params: unknown[]): unknown[] };
        if (typeof sqlDb.all !== "function") {
          // drizzle db wrapper인 경우
          return [];
        }

        const rows = (db as Record<string, (...args: unknown[]) => unknown[]>)
          .constructor === Object ? [] :
          executeQuery(db, toTs, limit);

        return rows.map(rowToStoredRecord);
      } catch {
        return [];
      }
    },
  };
}

function executeQuery(db: unknown, toTs: string, limit: number): Record<string, unknown>[] {
  try {
    // getDatabaseSync 기반 node:sqlite 인터페이스
    const rawDb = db as { prepare?(sql: string): { all(...params: unknown[]): unknown[] } };
    if (rawDb.prepare) {
      return rawDb.prepare(
        `SELECT * FROM event_records WHERE timestamp <= ? ORDER BY timestamp ASC, log_id ASC LIMIT ?`,
      ).all(toTs, limit) as Record<string, unknown>[];
    }

    // drizzle db의 raw all 인터페이스
    const drizzleDb = db as { $client?: { prepare?(sql: string): { all(...params: unknown[]): unknown[] } } };
    if (drizzleDb.$client?.prepare) {
      return drizzleDb.$client.prepare(
        `SELECT * FROM event_records WHERE timestamp <= ? ORDER BY timestamp ASC, log_id ASC LIMIT ?`,
      ).all(toTs, limit) as Record<string, unknown>[];
    }
  } catch {
    // 테이블 미존재 등
  }
  return [];
}

function safeJsonParse(value: unknown): unknown {
  if (!value) return undefined;
  try { return JSON.parse(String(value)); }
  catch { return undefined; }
}

function rowToStoredRecord(row: Record<string, unknown>): StoredRecord {
  return {
    logId: String(row.log_id ?? ""),
    traceId: String(row.trace_id ?? ""),
    spanId: String(row.span_id ?? ""),
    parentSpanId: row.parent_span_id ? String(row.parent_span_id) : undefined,
    timestamp: new Date(String(row.timestamp ?? "")),
    recordKind: String(row.record_kind ?? "log"),
    eventKey: String(row.event_key ?? ""),
    eventVersion: String(row.event_version ?? ""),
    payloadFormat: String(row.payload_format ?? "json"),
    payloadEncoding: String(row.payload_encoding ?? "raw"),
    payloadMaskingApplied: !!row.payload_masking_applied,
    payloadMaskedFields: [],
    payload: safeJsonParse(row.payload),
    addressContext: safeJsonParse(row.address_context) as Record<string, string> | undefined,
    qaSessionId: row.qa_session_id ? String(row.qa_session_id) : undefined,
    createdAt: new Date(String(row.created_at ?? "")),
  };
}
