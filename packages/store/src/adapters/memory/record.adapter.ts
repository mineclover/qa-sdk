import type {
  RecordInsert,
  RecordPaginationCursor,
  RecordPaginationParams,
  RecordStore,
  StoredRecord,
  StoredRecordPage,
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

  private selectRecords(
    predicate: (record: StoredRecord) => boolean,
  ): StoredRecord[] {
    return Array.from(this.records.values())
      .filter(predicate)
      .sort(compareRecords)
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
