// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * ClickhouseRecordStore 단위 테스트.
 *
 * Docker ClickHouse 없이 SQL 생성 + 결과 파싱을 검증.
 */
import { describe, it, expect, vi } from "vitest";
import { ClickhouseRecordStore, type ClickHouseClient } from "./clickhouse-record-store.js";
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
