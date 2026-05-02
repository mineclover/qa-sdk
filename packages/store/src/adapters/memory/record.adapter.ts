// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import type {
  RecordInsert,
  RecordPaginationCursor,
  RecordPaginationParams,
  RecordStore,
  StoredRecord,
  StoredRecordPage,
  TimeRangeParams,
} from "@qa-sdk/core";

/** RecordStore의 in-memory 구현 */
export class InMemoryRecordStore implements RecordStore {
  private readonly records = new Map<string, StoredRecord>();

  async insertBatch(records: RecordInsert[]): Promise<void> {
    if (records.length === 0) return;

    const pendingLogIds = new Set<string>();

    for (const record of records) {
      if (this.records.has(record.logId) || pendingLogIds.has(record.logId)) {
        throw new Error(`Record already exists for logId: ${record.logId}`);
      }

      pendingLogIds.add(record.logId);
    }

    for (const record of records) {
      this.records.set(record.logId, {
        ...structuredClone(record),
        createdAt: new Date(),
      });
    }
  }

  async findByTraceId(traceId: string): Promise<StoredRecord[]> {
    return this.selectRecords((record) => record.traceId === traceId);
  }

  async findByTraceIdPaginated(
    traceId: string,
    params: RecordPaginationParams = {},
  ): Promise<StoredRecordPage> {
    return this.paginateRecords(
      this.selectRecords((record) => record.traceId === traceId),
      params,
    );
  }

  async findBySessionId(sessionId: string): Promise<StoredRecord[]> {
    return this.selectRecords((record) => record.qaSessionId === sessionId);
  }

  async findBySessionIdPaginated(
    sessionId: string,
    params: RecordPaginationParams = {},
  ): Promise<StoredRecordPage> {
    return this.paginateRecords(
      this.selectRecords((record) => record.qaSessionId === sessionId),
      params,
    );
  }

  async findByTraceAndEventKey(
    traceId: string,
    eventKey: string,
  ): Promise<StoredRecord[]> {
    return this.selectRecords(
      (record) => record.traceId === traceId && record.eventKey === eventKey,
    );
  }

  async findByTimeRange(params: TimeRangeParams): Promise<StoredRecord[]> {
    return this.selectRecords((r) => {
      if (params.from && r.timestamp.getTime() < params.from.getTime()) return false;
      if (params.to && r.timestamp.getTime() > params.to.getTime()) return false;
      if (params.eventKey && r.eventKey !== params.eventKey) return false;
      return true;
    }).slice(0, params.limit ?? 1000);
  }

  /** 전체 고유 traceId 목록 반환 */
  getTraceIds(): string[] {
    const ids = new Set<string>();
    for (const record of this.records.values()) {
      ids.add(record.traceId);
    }
    return [...ids];
  }

  /** 저장된 레코드 수 */
  get size(): number {
    return this.records.size;
  }

  private selectRecords(
    predicate: (record: StoredRecord) => boolean,
  ): StoredRecord[] {
    return Array.from(this.records.values())
      .filter(predicate)
      .toSorted(compareRecords)
      .map((record) => structuredClone(record));
  }

  private paginateRecords(
    records: StoredRecord[],
    params: RecordPaginationParams,
  ): StoredRecordPage {
    const limit = params.limit ?? records.length;
    const cursor = params.cursor;
    const startIndex = cursor
      ? records.findIndex((record) => compareRecordToCursor(record, cursor) > 0)
      : 0;
    const normalizedStartIndex = startIndex === -1 ? records.length : startIndex;
    const pageWindow = records.slice(
      normalizedStartIndex,
      normalizedStartIndex + limit + 1,
    );
    const hasMore = pageWindow.length > limit;
    const items = pageWindow.slice(0, limit).map((record) => structuredClone(record));
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
}

function compareRecords(left: StoredRecord, right: StoredRecord): number {
  const timestampDifference =
    left.timestamp.getTime() - right.timestamp.getTime();

  if (timestampDifference !== 0) {
    return timestampDifference;
  }

  return left.logId.localeCompare(right.logId);
}

function compareRecordToCursor(
  record: StoredRecord,
  cursor: RecordPaginationCursor,
): number {
  const timestampDifference =
    record.timestamp.getTime() - cursor.timestamp.getTime();

  if (timestampDifference !== 0) {
    return timestampDifference;
  }

  return record.logId.localeCompare(cursor.logId);
}
