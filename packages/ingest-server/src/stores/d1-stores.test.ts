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
import { D1KeyObservationStore } from "./d1-key-observation-store.js";
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

// key_observations 테이블은 migration에 미포함 — DDL 직접 실행
const KEY_OBS_DDL = `
CREATE TABLE IF NOT EXISTS key_observations (
  packed_key      TEXT    NOT NULL PRIMARY KEY,
  prefix_id       TEXT    NOT NULL,
  registered      INTEGER NOT NULL DEFAULT 0,
  count           INTEGER NOT NULL DEFAULT 1,
  first_seen      TEXT    NOT NULL,
  last_seen       TEXT    NOT NULL,
  payload_summary TEXT    NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_key_obs_prefix ON key_observations(prefix_id);
CREATE INDEX IF NOT EXISTS idx_key_obs_last_seen ON key_observations(last_seen);
CREATE INDEX IF NOT EXISTS idx_key_obs_count ON key_observations(count DESC);
CREATE INDEX IF NOT EXISTS idx_key_obs_registered ON key_observations(registered);

CREATE TABLE IF NOT EXISTS key_observation_prefixes (
  prefix_id      TEXT    NOT NULL PRIMARY KEY,
  distinct_keys  INTEGER NOT NULL DEFAULT 1,
  total_count    INTEGER NOT NULL DEFAULT 0,
  first_seen     TEXT    NOT NULL,
  last_seen      TEXT    NOT NULL
);
`;

function createDbWithKeyObs(): D1Db {
  const driver = new NodeSqliteDriver(":memory:", null);
  const drizzleDb = drizzle({ client: driver.$client });
  migrate(drizzleDb, { migrationsFolder });
  // migration에 key_observations 미포함 — DDL 직접 실행
  (driver.$client as { exec(sql: string): void }).exec(KEY_OBS_DDL);
  return createD1Drizzle(driver.$client);
}

describe("D1KeyObservationStore", () => {
  let store: D1KeyObservationStore;

  beforeEach(() => {
    const db = createDbWithKeyObs();
    store = new D1KeyObservationStore(db);
  });

  it("observe + findByPrefix 라운드트립", async () => {
    await store.observe({
      packedKey: "svc:v1:42",
      prefixId: "svc",
      registered: true,
      timestamp: "2026-04-06T10:00:00Z",
      payloadFields: ["page", "action"],
      samplePayload: { page: "home", action: "click" },
    });

    const results = await store.findByPrefix("svc");
    expect(results).toHaveLength(1);
    expect(results[0].packedKey).toBe("svc:v1:42");
    expect(results[0].count).toBe(1);
    expect(results[0].registered).toBe(true);
    expect(results[0].payloadSummary.fieldFrequency).toEqual({ page: 1, action: 1 });
    expect(results[0].payloadSummary.sampleValues).toEqual({ page: "home", action: "click" });
  });

  it("반복 observe 시 count 누적", async () => {
    const entry = {
      packedKey: "svc:v1:42",
      prefixId: "svc",
      registered: true,
      timestamp: "2026-04-06T10:00:00Z",
    };
    await store.observe(entry);
    await store.observe({ ...entry, timestamp: "2026-04-06T11:00:00Z" });
    await store.observe({ ...entry, timestamp: "2026-04-06T12:00:00Z" });

    const results = await store.findByPrefix("svc");
    expect(results[0].count).toBe(3);
    expect(results[0].firstSeen).toBe("2026-04-06T10:00:00Z");
    expect(results[0].lastSeen).toBe("2026-04-06T12:00:00Z");
  });

  it("observeBatch 다건 처리", async () => {
    await store.observeBatch([
      { packedKey: "svc:v1:1", prefixId: "svc", registered: true, timestamp: "2026-04-06T10:00:00Z" },
      { packedKey: "svc:v1:2", prefixId: "svc", registered: true, timestamp: "2026-04-06T10:01:00Z" },
      { packedKey: "pv:v2:1", prefixId: "pv", registered: false, timestamp: "2026-04-06T10:02:00Z" },
    ]);

    const svcResults = await store.findByPrefix("svc");
    expect(svcResults).toHaveLength(2);

    const pvResults = await store.findByPrefix("pv");
    expect(pvResults).toHaveLength(1);
    expect(pvResults[0].registered).toBe(false);
  });

  it("summary 전체 통계", async () => {
    await store.observeBatch([
      { packedKey: "svc:v1:1", prefixId: "svc", registered: true, timestamp: "2026-04-06T10:00:00Z" },
      { packedKey: "svc:v1:1", prefixId: "svc", registered: true, timestamp: "2026-04-06T10:01:00Z" },
      { packedKey: "pv:v2:1", prefixId: "pv", registered: false, timestamp: "2026-04-06T10:02:00Z" },
    ]);

    const s = await store.summary();
    expect(s.totalKeys).toBe(2);
    expect(s.totalCount).toBe(3);
    expect(s.registeredKeys).toBe(1);
    expect(s.unregisteredKeys).toBe(1);
    expect(s.prefixBreakdown).toEqual({ svc: 2, pv: 1 });
  });

  it("findStale — 기준 시점 이전 관측", async () => {
    await store.observeBatch([
      { packedKey: "old:v1:1", prefixId: "old", registered: true, timestamp: "2026-01-01T00:00:00Z" },
      { packedKey: "new:v1:1", prefixId: "new", registered: true, timestamp: "2026-04-06T10:00:00Z" },
    ]);

    const stale = await store.findStale("2026-03-01T00:00:00Z");
    expect(stale).toHaveLength(1);
    expect(stale[0].prefixId).toBe("old");
  });

  it("findUnregistered — drift 감지", async () => {
    await store.observeBatch([
      { packedKey: "svc:v1:1", prefixId: "svc", registered: true, timestamp: "2026-04-06T10:00:00Z" },
      { packedKey: "unknown:v1:1", prefixId: "unknown", registered: false, timestamp: "2026-04-06T10:01:00Z" },
      { packedKey: "unknown:v1:2", prefixId: "unknown", registered: false, timestamp: "2026-04-06T10:02:00Z" },
    ]);

    const unregistered = await store.findUnregistered();
    expect(unregistered).toHaveLength(2);
    expect(unregistered.every((o) => !o.registered)).toBe(true);
  });

  it("prefixSummary — prefix 레벨 집계", async () => {
    await store.observeBatch([
      { packedKey: "svc:v1:1", prefixId: "svc", registered: true, timestamp: "2026-04-06T10:00:00Z" },
      { packedKey: "svc:v1:2", prefixId: "svc", registered: true, timestamp: "2026-04-06T10:01:00Z" },
      { packedKey: "svc:v1:1", prefixId: "svc", registered: true, timestamp: "2026-04-06T10:02:00Z" },
    ]);

    const prefixes = await store.prefixSummary("svc");
    expect(prefixes).toHaveLength(1);
    expect(prefixes[0].distinctKeys).toBe(2);
    expect(prefixes[0].totalCount).toBe(3);
  });

  it("findByPrefix orderBy=last_seen", async () => {
    await store.observeBatch([
      { packedKey: "svc:v1:1", prefixId: "svc", registered: true, timestamp: "2026-04-06T10:00:00Z" },
      { packedKey: "svc:v1:2", prefixId: "svc", registered: true, timestamp: "2026-04-06T12:00:00Z" },
    ]);

    const results = await store.findByPrefix("svc", { orderBy: "last_seen" });
    expect(results[0].packedKey).toBe("svc:v1:2");
  });
});
