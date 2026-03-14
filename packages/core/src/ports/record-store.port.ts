import type { EventRecord } from "../types/record.js";

/** EventRecord 저장소 계약 */
export interface RecordStore {
  insertBatch(records: RecordInsert[]): Promise<void>;
  findByTraceId(traceId: string): Promise<StoredRecord[]>;
  findByTraceIdPaginated(
    traceId: string,
    params?: RecordPaginationParams,
  ): Promise<StoredRecordPage>;
  findBySessionId(sessionId: string): Promise<StoredRecord[]>;
  findBySessionIdPaginated(
    sessionId: string,
    params?: RecordPaginationParams,
  ): Promise<StoredRecordPage>;
  findByTraceAndEventKey(traceId: string, eventKey: string): Promise<StoredRecord[]>;
}

export interface RecordPaginationCursor {
  timestamp: Date;
  logId: string;
}

export interface RecordPaginationParams {
  cursor?: RecordPaginationCursor;
  limit?: number;
}

export interface StoredRecordPage {
  items: StoredRecord[];
  nextCursor: RecordPaginationCursor | null;
  hasMore: boolean;
}

/** insert 시 필요한 필드 */
export interface RecordInsert {
  logId: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  timestamp: Date;
  recordKind: string;
  eventKey: string;
  eventVersion: string;
  spanName?: string;
  startTime?: Date;
  endTime?: Date;
  statusCode?: string;
  payloadFormat: string;
  payloadEncoding: string;
  payloadMaskingApplied: boolean;
  payloadMaskedFields: string[];
  payload: unknown;
  qaSessionId?: string;
  registryWarning?: string;
  actorId?: string;
  userId?: string;
  userAttributes?: Record<string, string>;
}

/** 조회 시 반환되는 필드 (RecordInsert + createdAt) */
export interface StoredRecord extends RecordInsert {
  createdAt: Date;
}
