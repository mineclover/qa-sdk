/**
 * D1 Store 단위 테스트 — InMemory SQLite 기반.
 *
 * NestJS 패턴: 각 Store를 독립적으로 생성+테스트.
 * NodeSqliteDriver(:memory:) → drizzle 인스턴스로 D1 시뮬레이션.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { NodeSqliteDriver } from "index-meta";
import { D1RecordStore } from "./d1-record-store.js";
import { D1TraceStore } from "./d1-trace-store.js";
import { D1SessionStore } from "./d1-session-store.js";
import { D1VerdictStore } from "./d1-verdict-store.js";
import { createD1Drizzle, type D1Db } from "./d1-db-type.js";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";

const migrationsFolder = new URL("../../drizzle", import.meta.url).pathname;

function createDb(): D1Db {
  const driver = new NodeSqliteDriver(":memory:", null);
  const drizzleDb = drizzle({ client: driver.$client });
  migrate(drizzleDb, { migrationsFolder });
  return createD1Drizzle(driver.$client);
}

describe("D1RecordStore", () => {
  let store: D1RecordStore;

  beforeEach(() => {
    const db = createDb();
    store = new D1RecordStore(db);
  });

  it("insertBatch + findByTraceId", async () => {
    await store.insertBatch([
      { logId: "r1", traceId: "t1", spanId: "s1", timestamp: new Date("2026-01-01T00:00:00Z"), recordKind: "log", eventKey: "page.view", eventVersion: "001", payloadFormat: "json", payloadEncoding: "raw", payloadMaskingApplied: false, payloadMaskedFields: [], payload: { page: "home" } },
      { logId: "r2", traceId: "t1", spanId: "s2", timestamp: new Date("2026-01-01T00:00:01Z"), recordKind: "log", eventKey: "cart.add", eventVersion: "001", payloadFormat: "json", payloadEncoding: "raw", payloadMaskingApplied: false, payloadMaskedFields: [] },
    ]);

    const records = await store.findByTraceId("t1");
    expect(records).toHaveLength(2);
    expect(records[0].eventKey).toBe("page.view");
    expect(records[0].payload).toEqual({ page: "home" });
    expect(records[1].eventKey).toBe("cart.add");
  });

  it("findBySessionId", async () => {
    await store.insertBatch([
      { logId: "r1", traceId: "t1", spanId: "s1", timestamp: new Date(), recordKind: "log", eventKey: "e1", eventVersion: "001", payloadFormat: "json", payloadEncoding: "raw", payloadMaskingApplied: false, payloadMaskedFields: [], qaSessionId: "sess-1" },
      { logId: "r2", traceId: "t2", spanId: "s2", timestamp: new Date(), recordKind: "log", eventKey: "e2", eventVersion: "001", payloadFormat: "json", payloadEncoding: "raw", payloadMaskingApplied: false, payloadMaskedFields: [], qaSessionId: "sess-1" },
      { logId: "r3", traceId: "t3", spanId: "s3", timestamp: new Date(), recordKind: "log", eventKey: "e3", eventVersion: "001", payloadFormat: "json", payloadEncoding: "raw", payloadMaskingApplied: false, payloadMaskedFields: [], qaSessionId: "sess-2" },
    ]);

    const records = await store.findBySessionId("sess-1");
    expect(records).toHaveLength(2);
  });

  it("ON CONFLICT DO NOTHING (중복 삽입 무시)", async () => {
    const record = { logId: "dup", traceId: "t1", spanId: "s1", timestamp: new Date(), recordKind: "log", eventKey: "e1", eventVersion: "001", payloadFormat: "json", payloadEncoding: "raw", payloadMaskingApplied: false, payloadMaskedFields: [] as string[] };
    await store.insertBatch([record]);
    await store.insertBatch([record]); // 중복
    const records = await store.findByTraceId("t1");
    expect(records).toHaveLength(1);
  });

  it("address_context JSON 파싱", async () => {
    await store.insertBatch([
      { logId: "r1", traceId: "t1", spanId: "s1", timestamp: new Date(), recordKind: "log", eventKey: "e1", eventVersion: "001", payloadFormat: "json", payloadEncoding: "raw", payloadMaskingApplied: false, payloadMaskedFields: [], addressContext: { service: "s:v1:0", page_view: "pv:v2:1" } },
    ]);
    const records = await store.findByTraceId("t1");
    expect(records[0].addressContext).toEqual({ service: "s:v1:0", page_view: "pv:v2:1" });
  });
});

describe("D1TraceStore", () => {
  let store: D1TraceStore;

  beforeEach(() => {
    const db = createDb();
    store = new D1TraceStore(db);
  });

  it("upsert + findById", async () => {
    await store.upsert({ traceId: "t1", serviceName: "web", recordCount: 3, firstTimestamp: new Date("2026-01-01"), lastTimestamp: new Date("2026-01-01T00:00:02") });
    const trace = await store.findById("t1");
    expect(trace).not.toBeNull();
    expect(trace!.recordCount).toBe(3);
    expect(trace!.serviceName).toBe("web");
  });

  it("upsert 중복 시 recordCount 누적", async () => {
    await store.upsert({ traceId: "t1", recordCount: 2, firstTimestamp: new Date("2026-01-01"), lastTimestamp: new Date("2026-01-01T00:00:01") });
    await store.upsert({ traceId: "t1", recordCount: 3, firstTimestamp: new Date("2026-01-01T00:00:02"), lastTimestamp: new Date("2026-01-01T00:00:04") });
    const trace = await store.findById("t1");
    expect(trace!.recordCount).toBe(5); // 2 + 3
  });

  it("findRecent", async () => {
    await store.upsert({ traceId: "t1", recordCount: 1, firstTimestamp: new Date("2026-01-01"), lastTimestamp: new Date("2026-01-01") });
    await store.upsert({ traceId: "t2", recordCount: 1, firstTimestamp: new Date("2026-01-02"), lastTimestamp: new Date("2026-01-02") });
    const recent = await store.findRecent(10);
    expect(recent.length).toBe(2);
    // 두 trace가 모두 포함됨 (순서는 updated_at 의존이므로 id set으로 확인)
    const ids = new Set(recent.map(t => t.traceId));
    expect(ids.has("t1")).toBe(true);
    expect(ids.has("t2")).toBe(true);
  });

  it("markReconstructed", async () => {
    await store.upsert({ traceId: "t1", recordCount: 1, firstTimestamp: new Date(), lastTimestamp: new Date() });
    await store.markReconstructed("t1");
    const trace = await store.findById("t1");
    expect(trace!.reconstructed).toBe(true);
  });
});

describe("D1SessionStore", () => {
  let store: D1SessionStore;

  beforeEach(() => {
    const db = createDb();
    store = new D1SessionStore(db);
  });

  it("upsert + findById", async () => {
    await store.upsert({ sessionId: "s1", scenarioId: "sc1" });
    const session = await store.findById("s1");
    expect(session).not.toBeNull();
    expect(session!.scenarioId).toBe("sc1");
  });

  it("close", async () => {
    await store.upsert({ sessionId: "s1" });
    await store.close("s1");
    const session = await store.findById("s1");
    expect(session!.closedAt).not.toBeNull();
  });
});

describe("D1VerdictStore", () => {
  let store: D1VerdictStore;

  beforeEach(() => {
    const db = createDb();
    store = new D1VerdictStore(db);
  });

  it("insert + findByTraceId", async () => {
    await store.insert({ id: "v1", scenarioId: "sc1", traceId: "t1", overallVerdict: "pass", report: { steps: [] } });
    const verdicts = await store.findByTraceId("t1");
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0].overallVerdict).toBe("pass");
  });

  it("ON CONFLICT 시 업데이트", async () => {
    await store.insert({ id: "v1", scenarioId: "sc1", traceId: "t1", overallVerdict: "pass", report: { steps: [] } });
    await store.insert({ id: "v2", scenarioId: "sc1", traceId: "t1", overallVerdict: "fail", report: { steps: [{ error: "timeout" }] } });
    const verdicts = await store.findByTraceId("t1");
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0].overallVerdict).toBe("fail");
  });
});
