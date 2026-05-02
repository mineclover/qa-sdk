// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/** 시간 범위 쿼리 파라미터 */
export interface TimeRangeParams {
  /** 시작 시각 (inclusive) */
  from?: Date;
  /** 종료 시각 (inclusive) */
  to?: Date;
  /** 이벤트 키 필터 (선택) */
  eventKey?: string;
  /** 최대 반환 건수 */
  limit?: number;
}

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
  /** 시간 범위로 레코드를 조회한다. timestamp ASC 정렬. */
  findByTimeRange(params: TimeRangeParams): Promise<StoredRecord[]>;
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
  // Address context
  addressContext?: Record<string, string>;
  // Metric (when recordKind === "metric")
  metricType?: string;
  metricName?: string;
  metricValue?: number;
  metricUnit?: string;
  metricLabels?: Record<string, string>;
  metricBuckets?: number[];
  metricQuantiles?: number[];
  // Actor
  actorId?: string;
  userId?: string;
  userAttributes?: Record<string, string>;
}

/** 조회 시 반환되는 필드 (RecordInsert + createdAt) */
export interface StoredRecord extends RecordInsert {
  createdAt: Date;
}
