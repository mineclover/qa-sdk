// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * ClickhouseRecordStore — RecordStore의 ClickHouse 구현.
 *
 * MergeTree 기반 append-only 저장.
 * batch insert 최적화 (단일 INSERT ... VALUES).
 */
import type { RecordStore, RecordInsert, StoredRecord, RecordPaginationParams, StoredRecordPage, TimeRangeParams } from "@qa-sdk/core";

export interface ClickHouseClient {
  query(sql: string, params?: Record<string, unknown>): Promise<{ rows: Record<string, unknown>[] }>;
  insert(table: string, values: Record<string, unknown>[], columns: string[]): Promise<void>;
  exec(sql: string): Promise<void>;
}

export type AnalyticsInterval = "minute" | "hour" | "day";

export interface TimeSeriesQuery {
  table?: string;
  timestampColumn?: string;
  interval: AnalyticsInterval;
  from?: Date;
  to?: Date;
  eventKey?: string;
  limit?: number;
}

export interface TimeSeriesBucket {
  bucket: Date;
  count: number;
}

export interface TopKeysQuery {
  table?: string;
  keyColumn?: string;
  timestampColumn?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

export interface TopKeyEntry {
  key: string;
  count: number;
}

export interface DistributionQuery {
  table?: string;
  valueColumn: string;
  timestampColumn?: string;
  from?: Date;
  to?: Date;
  bucketSize?: number;
  limit?: number;
}

export interface DistributionBucket {
  bucket: number;
  count: number;
}

export interface KeyObservationAnalyticsQuery {
  prefixId?: string;
  registered?: boolean;
  orderBy?: "count" | "last_seen";
  limit?: number;
}

export interface KeyObservationAnalyticsEntry {
  prefixId: string;
  packedKey: string;
  registered: boolean;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
}

export interface TraceAnalyticsQuery {
  serviceName?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

export interface TraceServiceStats {
  serviceName: string;
  traceCount: number;
  recordCount: number;
  firstTimestamp: Date | null;
  lastTimestamp: Date | null;
}

export interface AnalyticsStore {
  bulkInsert(table: string, rows: Record<string, unknown>[]): Promise<void>;
  queryTimeSeries(params: TimeSeriesQuery): Promise<TimeSeriesBucket[]>;
  queryTopKeys(params?: TopKeysQuery): Promise<TopKeyEntry[]>;
  queryDistribution(params: DistributionQuery): Promise<DistributionBucket[]>;
  queryKeyObservations(params?: KeyObservationAnalyticsQuery): Promise<KeyObservationAnalyticsEntry[]>;
  queryTraceStats(params?: TraceAnalyticsQuery): Promise<TraceServiceStats[]>;
}

export class ClickHouseAnalyticsStore implements AnalyticsStore {
  constructor(private readonly client: ClickHouseClient) {}

  async bulkInsert(table: string, rows: Record<string, unknown>[]): Promise<void> {
    if (rows.length === 0) return;
    const tableName = sqlIdentifier(table, "table");
    const columns = Object.keys(rows[0]).map((column) => sqlIdentifier(column, "column"));
    await this.client.insert(tableName, rows, columns);
  }

  async queryTimeSeries(params: TimeSeriesQuery): Promise<TimeSeriesBucket[]> {
    const table = sqlIdentifier(params.table ?? "event_records", "table");
    const timestampColumn = sqlIdentifier(params.timestampColumn ?? "timestamp", "timestamp column");
    const bucketFn = bucketFunction(params.interval);
    const { where, values } = buildTimeRangeWhere(params, timestampColumn);
    const limit = normalizeLimit(params.limit, 1000);
    const sql = [
      `SELECT ${bucketFn}(${timestampColumn}) AS bucket, count() AS count`,
      `FROM ${table}`,
      where,
      "GROUP BY bucket",
      "ORDER BY bucket",
      `LIMIT ${limit}`,
    ].filter(Boolean).join(" ");

    const { rows } = await this.client.query(sql, values);
    return rows.map((row) => ({
      bucket: parseClickHouseDate(row.bucket),
      count: Number(row.count),
    }));
  }

  async queryTopKeys(params: TopKeysQuery = {}): Promise<TopKeyEntry[]> {
    const table = sqlIdentifier(params.table ?? "event_records", "table");
    const keyColumn = sqlIdentifier(params.keyColumn ?? "event_key", "key column");
    const timestampColumn = sqlIdentifier(params.timestampColumn ?? "timestamp", "timestamp column");
    const { where, values } = buildTimeRangeWhere(params, timestampColumn);
    const limit = normalizeLimit(params.limit, 100);
    const sql = [
      `SELECT ${keyColumn} AS key, count() AS count`,
      `FROM ${table}`,
      where,
      "GROUP BY key",
      "ORDER BY count DESC",
      `LIMIT ${limit}`,
    ].filter(Boolean).join(" ");

    const { rows } = await this.client.query(sql, values);
    return rows.map((row) => ({
      key: String(row.key),
      count: Number(row.count),
    }));
  }

  async queryDistribution(params: DistributionQuery): Promise<DistributionBucket[]> {
    const table = sqlIdentifier(params.table ?? "event_records", "table");
    const valueColumn = sqlIdentifier(params.valueColumn, "value column");
    const timestampColumn = sqlIdentifier(params.timestampColumn ?? "timestamp", "timestamp column");
    const bucketSize = normalizeBucketSize(params.bucketSize);
    const { where, values } = buildTimeRangeWhere(params, timestampColumn);
    values.bucketSize = bucketSize;
    const limit = normalizeLimit(params.limit, 100);
    const sql = [
      `SELECT floor(${valueColumn} / {bucketSize:Float64}) * {bucketSize:Float64} AS bucket, count() AS count`,
      `FROM ${table}`,
      where,
      "GROUP BY bucket",
      "ORDER BY bucket",
      `LIMIT ${limit}`,
    ].filter(Boolean).join(" ");

    const { rows } = await this.client.query(sql, values);
    return rows.map((row) => ({
      bucket: Number(row.bucket),
      count: Number(row.count),
    }));
  }

  async queryKeyObservations(params: KeyObservationAnalyticsQuery = {}): Promise<KeyObservationAnalyticsEntry[]> {
    const conditions: string[] = [];
    const values: Record<string, unknown> = {};
    if (params.prefixId) {
      conditions.push("prefix_id = {prefixId:String}");
      values.prefixId = params.prefixId;
    }
    if (params.registered !== undefined) {
      conditions.push("registered = {registered:UInt8}");
      values.registered = params.registered ? 1 : 0;
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderBy = params.orderBy === "last_seen" ? "last_seen" : "count";
    const limit = normalizeLimit(params.limit, 100);
    const sql = [
      "SELECT prefix_id, packed_key, registered, count, first_seen, last_seen",
      "FROM key_observations",
      where,
      `ORDER BY ${orderBy} DESC`,
      `LIMIT ${limit}`,
    ].filter(Boolean).join(" ");

    const { rows } = await this.client.query(sql, values);
    return rows.map((row) => ({
      prefixId: String(row.prefix_id),
      packedKey: String(row.packed_key),
      registered: Number(row.registered) === 1,
      count: Number(row.count),
      firstSeen: parseClickHouseDate(row.first_seen),
      lastSeen: parseClickHouseDate(row.last_seen),
    }));
  }

  async queryTraceStats(params: TraceAnalyticsQuery = {}): Promise<TraceServiceStats[]> {
    const conditions: string[] = [];
    const values: Record<string, unknown> = {};
    if (params.serviceName) {
      conditions.push("service_name = {serviceName:String}");
      values.serviceName = params.serviceName;
    }
    if (params.from) {
      conditions.push("first_timestamp >= {from:DateTime64(3)}");
      values.from = formatClickHouseDate(params.from);
    }
    if (params.to) {
      conditions.push("last_timestamp <= {to:DateTime64(3)}");
      values.to = formatClickHouseDate(params.to);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = normalizeLimit(params.limit, 100);
    const sql = [
      "SELECT service_name, count() AS trace_count, sum(record_count) AS record_count, min(first_timestamp) AS first_timestamp, max(last_timestamp) AS last_timestamp",
      "FROM traces",
      where,
      "GROUP BY service_name",
      "ORDER BY trace_count DESC",
      `LIMIT ${limit}`,
    ].filter(Boolean).join(" ");

    const { rows } = await this.client.query(sql, values);
    return rows.map((row) => ({
      serviceName: String(row.service_name ?? ""),
      traceCount: Number(row.trace_count),
      recordCount: Number(row.record_count),
      firstTimestamp: row.first_timestamp == null ? null : parseClickHouseDate(row.first_timestamp),
      lastTimestamp: row.last_timestamp == null ? null : parseClickHouseDate(row.last_timestamp),
    }));
  }
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
    const limit = params?.limit ?? 100;
    const cursor = params?.cursor;
    let sql = "SELECT * FROM event_records WHERE qa_session_id = {sessionId:String}";
    const p: Record<string, unknown> = { sessionId };
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

  async findByTraceAndEventKey(traceId: string, eventKey: string): Promise<StoredRecord[]> {
    const { rows } = await this.client.query(
      "SELECT * FROM event_records WHERE trace_id = {traceId:String} AND event_key = {eventKey:String} ORDER BY timestamp",
      { traceId, eventKey },
    );
    return rows.map(toStoredRecord);
  }

  async findByTimeRange(params: TimeRangeParams): Promise<StoredRecord[]> {
    const conditions: string[] = [];
    const p: Record<string, unknown> = {};

    if (params.from) {
      conditions.push("timestamp >= {from:DateTime64(3)}");
      p.from = params.from.toISOString().replace("T", " ").replace("Z", "");
    }
    if (params.to) {
      conditions.push("timestamp <= {to:DateTime64(3)}");
      p.to = params.to.toISOString().replace("T", " ").replace("Z", "");
    }
    if (params.eventKey) {
      conditions.push("event_key = {eventKey:String}");
      p.eventKey = params.eventKey;
    }

    const limit = params.limit ?? 1000;
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
    const sql = `SELECT * FROM event_records${where} ORDER BY timestamp, log_id LIMIT ${limit}`;

    const { rows } = await this.client.query(sql, p);
    return rows.map(toStoredRecord);
  }
}

import { parseJsonColumn } from "../db/json-types.js";

function sqlIdentifier(value: string, label: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid ClickHouse ${label}: ${value}`);
  }
  return value;
}

function bucketFunction(interval: AnalyticsInterval): string {
  switch (interval) {
    case "minute": return "toStartOfMinute";
    case "hour": return "toStartOfHour";
    case "day": return "toStartOfDay";
  }
}

function buildTimeRangeWhere(
  params: { from?: Date; to?: Date; eventKey?: string },
  timestampColumn: string,
): { where: string; values: Record<string, unknown> } {
  const conditions: string[] = [];
  const values: Record<string, unknown> = {};
  if (params.from) {
    conditions.push(`${timestampColumn} >= {from:DateTime64(3)}`);
    values.from = formatClickHouseDate(params.from);
  }
  if (params.to) {
    conditions.push(`${timestampColumn} <= {to:DateTime64(3)}`);
    values.to = formatClickHouseDate(params.to);
  }
  if (params.eventKey) {
    conditions.push("event_key = {eventKey:String}");
    values.eventKey = params.eventKey;
  }
  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
}

function normalizeLimit(limit: number | undefined, fallback: number): number {
  const maxLimit = 10_000;
  if (limit === undefined) return fallback;
  if (!Number.isFinite(limit)) return fallback;
  return Math.min(maxLimit, Math.max(1, Math.trunc(limit)));
}

function normalizeBucketSize(bucketSize: number | undefined): number {
  if (bucketSize === undefined) return 1;
  if (!Number.isFinite(bucketSize) || bucketSize <= 0) {
    throw new Error(`Invalid ClickHouse distribution bucketSize: ${bucketSize}`);
  }
  return bucketSize;
}

function formatClickHouseDate(date: Date): string {
  return date.toISOString().replace("T", " ").replace("Z", "");
}

function parseClickHouseDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" && value.includes(" ")) {
    return new Date(`${value.replace(" ", "T")}Z`);
  }
  return new Date(value as string | number);
}

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
