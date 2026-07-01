// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * ClickhouseRecordStore 단위 테스트.
 *
 * Docker ClickHouse 없이 SQL 생성 + 결과 파싱을 검증.
 */
import { describe, it, expect, vi } from "vitest";
import { ClickHouseAnalyticsStore, ClickhouseRecordStore, type ClickHouseClient } from "./clickhouse-record-store.js";
import type { RecordInsert } from "@qa-sdk/core";

function createMockClient(): ClickHouseClient & { calls: Array<{ method: string; args: any[] }> } {
  const calls: Array<{ method: string; args: any[] }> = [];
  return {
    calls,
    async query(sql: string, params?: Record<string, unknown>) {
      calls.push({ method: "query", args: [sql, params] });
      return { rows: [] };
    },
    async insert(table: string, values: any[], columns: string[]) {
      calls.push({ method: "insert", args: [table, values, columns] });
    },
    async exec(sql: string) {
      calls.push({ method: "exec", args: [sql] });
    },
  };
}

function makeRecord(overrides: Partial<RecordInsert> = {}): RecordInsert {
  return {
    logId: "log-1",
    traceId: "trace-1",
    spanId: "span-1",
    timestamp: new Date("2026-03-23T00:00:00Z"),
    recordKind: "log",
    eventKey: "page.home",
    eventVersion: "001",
    payloadFormat: "json",
    payloadEncoding: "raw",
    payloadMaskingApplied: false,
    payloadMaskedFields: [],
    ...overrides,
  };
}

describe("ClickhouseRecordStore", () => {
  it("insertBatch — 올바른 테이블과 컬럼으로 insert 호출", async () => {
    const client = createMockClient();
    const store = new ClickhouseRecordStore(client);

    await store.insertBatch([makeRecord(), makeRecord({ logId: "log-2" })]);

    expect(client.calls.length).toBe(1);
    expect(client.calls[0].method).toBe("insert");
    expect(client.calls[0].args[0]).toBe("event_records");
    expect(client.calls[0].args[1].length).toBe(2);
    expect(client.calls[0].args[2]).toContain("log_id");
    expect(client.calls[0].args[2]).toContain("trace_id");
    expect(client.calls[0].args[2]).toContain("event_key");
  });

  it("insertBatch — 빈 배열이면 호출 없음", async () => {
    const client = createMockClient();
    const store = new ClickhouseRecordStore(client);

    await store.insertBatch([]);
    expect(client.calls.length).toBe(0);
  });

  it("insertBatch — timestamp가 ClickHouse 형식으로 변환됨", async () => {
    const client = createMockClient();
    const store = new ClickhouseRecordStore(client);

    await store.insertBatch([makeRecord()]);

    const row = client.calls[0].args[1][0];
    expect(row.timestamp).toBe("2026-03-23 00:00:00.000");
    expect(row.timestamp).not.toContain("T");
    expect(row.timestamp).not.toContain("Z");
  });

  it("insertBatch — addressContext가 JSON string으로 직렬화됨", async () => {
    const client = createMockClient();
    const store = new ClickhouseRecordStore(client);

    await store.insertBatch([makeRecord({ addressContext: { service: "svc:v1:0" } })]);

    const row = client.calls[0].args[1][0];
    expect(row.address_context).toBe('{"service":"svc:v1:0"}');
  });

  it("findByTraceId — 올바른 SQL과 파라미터", async () => {
    const client = createMockClient();
    const store = new ClickhouseRecordStore(client);

    await store.findByTraceId("trace-123");

    expect(client.calls[0].method).toBe("query");
    expect(client.calls[0].args[0]).toContain("trace_id = {traceId:String}");
    expect(client.calls[0].args[1]).toEqual({ traceId: "trace-123" });
  });

  it("findBySessionId — qa_session_id 필터", async () => {
    const client = createMockClient();
    const store = new ClickhouseRecordStore(client);

    await store.findBySessionId("sess-456");

    expect(client.calls[0].args[0]).toContain("qa_session_id = {sessionId:String}");
  });

  it("findBySessionIdPaginated — qa_session_id 필터와 cursor를 함께 적용", async () => {
    const client = createMockClient();
    const store = new ClickhouseRecordStore(client);

    await store.findBySessionIdPaginated("sess-456", {
      limit: 10,
      cursor: {
        timestamp: new Date("2026-03-23T00:00:00Z"),
        logId: "log-1",
      },
    });

    expect(client.calls[0].args[0]).toContain("qa_session_id = {sessionId:String}");
    expect(client.calls[0].args[0]).not.toContain("trace_id = {traceId:String}");
    expect(client.calls[0].args[0]).toContain("LIMIT 11");
    expect(client.calls[0].args[1]).toEqual({
      sessionId: "sess-456",
      cursorTs: "2026-03-23 00:00:00.000",
      cursorId: "log-1",
    });
  });

  it("findByTraceAndEventKey — trace + event_key 복합 필터", async () => {
    const client = createMockClient();
    const store = new ClickhouseRecordStore(client);

    await store.findByTraceAndEventKey("trace-1", "page.home");

    expect(client.calls[0].args[0]).toContain("trace_id = {traceId:String}");
    expect(client.calls[0].args[0]).toContain("event_key = {eventKey:String}");
  });

  it("findByTraceIdPaginated — LIMIT + cursor 적용", async () => {
    const client = createMockClient();
    const store = new ClickhouseRecordStore(client);

    const result = await store.findByTraceIdPaginated("trace-1", { limit: 10 });

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(client.calls[0].args[0]).toContain("LIMIT 11"); // limit+1 for hasMore
  });

});

describe("ClickHouseAnalyticsStore", () => {
  it("bulkInsert — 분석 테이블과 row 컬럼으로 insert 호출", async () => {
    const client = createMockClient();
    const analytics = new ClickHouseAnalyticsStore(client);

    await analytics.bulkInsert("event_records", [
      { log_id: "log-1", event_key: "page.home" },
      { log_id: "log-2", event_key: "cart.add" },
    ]);

    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].method).toBe("insert");
    expect(client.calls[0].args[0]).toBe("event_records");
    expect(client.calls[0].args[2]).toEqual(["log_id", "event_key"]);
  });

  it("queryTimeSeries — 시간 bucket 집계 SQL을 생성", async () => {
    const client = createMockClient();
    const analytics = new ClickHouseAnalyticsStore(client);

    await analytics.queryTimeSeries({
      interval: "hour",
      from: new Date("2026-03-23T00:00:00Z"),
      to: new Date("2026-03-24T00:00:00Z"),
      eventKey: "page.home",
      limit: 24,
    });

    expect(client.calls[0].method).toBe("query");
    expect(client.calls[0].args[0]).toContain("toStartOfHour(timestamp) AS bucket");
    expect(client.calls[0].args[0]).toContain("event_key = {eventKey:String}");
    expect(client.calls[0].args[0]).toContain("LIMIT 24");
    expect(client.calls[0].args[1]).toEqual({
      from: "2026-03-23 00:00:00.000",
      to: "2026-03-24 00:00:00.000",
      eventKey: "page.home",
    });
  });

  it("queryTopKeys — key 빈도 상위 항목을 count 기준으로 반환", async () => {
    const client = createMockClient();
    client.query = async (sql, params) => {
      client.calls.push({ method: "query", args: [sql, params] });
      return { rows: [{ key: "page.home", count: 7 }] };
    };
    const analytics = new ClickHouseAnalyticsStore(client);

    const result = await analytics.queryTopKeys({ limit: 10 });

    expect(client.calls[0].args[0]).toContain("event_key AS key");
    expect(client.calls[0].args[0]).toContain("ORDER BY count DESC");
    expect(result).toEqual([{ key: "page.home", count: 7 }]);
  });

  it("queryDistribution — 숫자 컬럼 bucket 분포를 반환", async () => {
    const client = createMockClient();
    client.query = async (sql, params) => {
      client.calls.push({ method: "query", args: [sql, params] });
      return { rows: [{ bucket: 100, count: 3 }] };
    };
    const analytics = new ClickHouseAnalyticsStore(client);

    const result = await analytics.queryDistribution({
      valueColumn: "duration_ms",
      bucketSize: 50,
      limit: 20,
    });

    expect(client.calls[0].args[0]).toContain("floor(duration_ms / {bucketSize:Float64})");
    expect(client.calls[0].args[0]).toContain("LIMIT 20");
    expect(client.calls[0].args[1]).toEqual({ bucketSize: 50 });
    expect(result).toEqual([{ bucket: 100, count: 3 }]);
  });

  it("queryKeyObservations — packed_key 관측 상위 항목을 반환", async () => {
    const client = createMockClient();
    client.query = async (sql, params) => {
      client.calls.push({ method: "query", args: [sql, params] });
      return {
        rows: [{
          prefix_id: "page_view",
          packed_key: "page_view:v1:12",
          registered: 0,
          count: 9,
          first_seen: "2026-03-23 00:00:00.000",
          last_seen: "2026-03-23 01:00:00.000",
        }],
      };
    };
    const analytics = new ClickHouseAnalyticsStore(client);

    const result = await analytics.queryKeyObservations({
      prefixId: "page_view",
      registered: false,
      limit: 5,
    });

    expect(client.calls[0].args[0]).toContain("FROM key_observations");
    expect(client.calls[0].args[0]).toContain("prefix_id = {prefixId:String}");
    expect(client.calls[0].args[0]).toContain("registered = {registered:UInt8}");
    expect(client.calls[0].args[0]).toContain("ORDER BY count DESC");
    expect(result).toEqual([{
      prefixId: "page_view",
      packedKey: "page_view:v1:12",
      registered: false,
      count: 9,
      firstSeen: new Date("2026-03-23T00:00:00.000Z"),
      lastSeen: new Date("2026-03-23T01:00:00.000Z"),
    }]);
  });

  it("queryTraceStats — 서비스별 trace 통계를 반환", async () => {
    const client = createMockClient();
    client.query = async (sql, params) => {
      client.calls.push({ method: "query", args: [sql, params] });
      return {
        rows: [{
          service_name: "checkout",
          trace_count: 4,
          record_count: 27,
          first_timestamp: "2026-03-23 00:00:00.000",
          last_timestamp: "2026-03-23 02:00:00.000",
        }],
      };
    };
    const analytics = new ClickHouseAnalyticsStore(client);

    const result = await analytics.queryTraceStats({ serviceName: "checkout", limit: 5 });

    expect(client.calls[0].args[0]).toContain("FROM traces");
    expect(client.calls[0].args[0]).toContain("service_name = {serviceName:String}");
    expect(client.calls[0].args[0]).toContain("GROUP BY service_name");
    expect(client.calls[0].args[0]).toContain("ORDER BY trace_count DESC");
    expect(result).toEqual([{
      serviceName: "checkout",
      traceCount: 4,
      recordCount: 27,
      firstTimestamp: new Date("2026-03-23T00:00:00.000Z"),
      lastTimestamp: new Date("2026-03-23T02:00:00.000Z"),
    }]);
  });

  it("동적 table/column identifier는 안전한 식별자만 허용", async () => {
    const client = createMockClient();
    const analytics = new ClickHouseAnalyticsStore(client);

    await expect(
      analytics.bulkInsert("event_records;DROP TABLE traces", [{ log_id: "log-1" }]),
    ).rejects.toThrow("Invalid ClickHouse table");
    await expect(
      analytics.queryDistribution({ valueColumn: "duration_ms) FROM traces --" }),
    ).rejects.toThrow("Invalid ClickHouse value column");
    await expect(
      analytics.queryTimeSeries({ table: "event-records", interval: "hour" }),
    ).rejects.toThrow("Invalid ClickHouse table");
    expect(client.calls).toEqual([]);
  });

  it("분석 조회 limit은 유한한 상한으로 보정", async () => {
    const client = createMockClient();
    const analytics = new ClickHouseAnalyticsStore(client);

    await analytics.queryTopKeys({ limit: 1_000_000 });
    await analytics.queryTimeSeries({ interval: "hour", limit: Number.POSITIVE_INFINITY });

    expect(client.calls[0].args[0]).toContain("LIMIT 10000");
    expect(client.calls[1].args[0]).toContain("LIMIT 1000");
  });
});
