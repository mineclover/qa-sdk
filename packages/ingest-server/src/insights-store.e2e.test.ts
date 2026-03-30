/**
 * InsightsStore E2E 테스트.
 *
 * DrizzleInsightsStore + ingest pipeline 전체 파이프라인:
 *   이벤트 전송 → DB 저장 → InsightsStore 조회 → 결과 검증
 */

import { describe, expect, it, beforeAll } from "vitest";
import { NodeSqliteDriver } from "index-meta";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import {
  InMemoryDlqStore,
  InMemoryGraphStore,
  InMemoryScenarioSpecStore,
  InMemoryTransmissionStore,
  InMemoryVerdictStore,
} from "@qa-sdk/store";
import pino from "pino";
import { createApp } from "./app.js";
import { RecordStreamBroker } from "./lib/record-stream-broker.js";
import { DrizzleInsightsStore } from "./stores/drizzle-insights-store.js";
import { D1RecordStore } from "./stores/d1-record-store.js";
import { D1TraceStore } from "./stores/d1-trace-store.js";
import { D1SessionStore } from "./stores/d1-session-store.js";
import { createD1Drizzle } from "./stores/d1-db-type.js";
import type { InsightsStore } from "./ports/insights-store.port.js";

const migrationsFolder = new URL("../drizzle", import.meta.url).pathname;

/** 공유 SQLite DB — D1 stores + DrizzleInsightsStore가 같은 DB 사용 */
function createSharedDb() {
  const driver = new NodeSqliteDriver(":memory:", null);
  const plainDb = drizzle({ client: driver.$client });
  migrate(plainDb, { migrationsFolder });
  const d1Db = createD1Drizzle(driver.$client);
  return { d1Db, plainDb };
}

function now() {
  return new Date().toISOString();
}

function makeEnvelope(opts: {
  txId: string;
  service: string;
  env?: string;
  records: Array<{
    logId: string;
    traceId: string;
    eventKey: string;
    sessionId?: string;
    addressContext?: Record<string, string>;
    payload?: Record<string, unknown>;
    actorId?: string;
    recordKind?: string;
    parentSpanId?: string;
    spanName?: string;
  }>;
}) {
  const ts = now();
  return {
    transmission_id: opts.txId,
    sent_at: ts,
    owner: { owner_type: "workspace" as const, owner_id: "ws_e2e" },
    source: { service_name: opts.service, sdk_name: "@qa-sdk/sdk", sdk_version: "0.1.0" },
    runtime: { platform: "node", app_version: "1.0.0" },
    build: { env: opts.env ?? "dev", release_version: "2026.03.29" },
    records: opts.records.map((r, i) => ({
      log_id: r.logId,
      timestamp: ts,
      record_kind: r.recordKind ?? "log",
      trace_id: r.traceId,
      span_id: `span-${r.logId}`,
      parent_span_id: r.parentSpanId,
      event_key: r.eventKey,
      event_version: "001",
      span_name: r.spanName,
      start_time: r.recordKind === "span" ? ts : undefined,
      payload_format: "json" as const,
      payload_encoding: "raw" as const,
      payload_masking_applied: false,
      payload_masked_fields: [] as string[],
      payload: r.payload ?? {},
      qa_session_id: r.sessionId,
      address_context: r.addressContext,
      actor_id: r.actorId,
    })),
  };
}

describe("InsightsStore E2E", () => {
  let store: InsightsStore;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    const { d1Db, plainDb } = createSharedDb();
    store = new DrizzleInsightsStore(plainDb);

    // D1 stores — ingest pipeline이 같은 SQLite DB에 기록
    const recordStore = new D1RecordStore(d1Db);
    const traceStore = new D1TraceStore(d1Db);
    const sessionStore = new D1SessionStore(d1Db);

    app = createApp({
      recordStore,
      traceStore,
      graphStore: new InMemoryGraphStore(),
      transmissionStore: new InMemoryTransmissionStore(),
      sessionStore,
      verdictStore: new InMemoryVerdictStore(),
      scenarioSpecStore: new InMemoryScenarioSpecStore(),
      dlqStore: new InMemoryDlqStore(),
      recordStreamBroker: new RecordStreamBroker(),
      insightsStore: store,
      logger: pino({ level: "silent" }),
      registryValidationMode: "off",
    });

    // ── 데모 이벤트 전송: 3개 서비스, 3개 세션 ──

    // 쇼핑 플로우 (session-alpha)
    const shoppingWebRes = await app.fetch(new Request("http://localhost/v1/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeEnvelope({
        txId: "tx-e2e-001",
        service: "shopping-web",
        records: [
          { logId: "r1", traceId: "t1", eventKey: "page_view", sessionId: "session-alpha",
            addressContext: { page_view: "pv:v1:42", tracking: "tr:v1:18" } },
          { logId: "r2", traceId: "t1", eventKey: "click", sessionId: "session-alpha",
            addressContext: { tracking: "tr:v1:18" } },
          { logId: "r3", traceId: "t1", eventKey: "cart.add", sessionId: "session-alpha",
            addressContext: { cart_event: "ce:v1:6" } },
        ],
      })),
    }));
    expect(shoppingWebRes.status).toBe(202);

    // 주문 처리 (session-alpha, 같은 trace)
    const backendRes = await app.fetch(new Request("http://localhost/v1/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeEnvelope({
        txId: "tx-e2e-002",
        service: "shopping-backend",
        records: [
          { logId: "r4", traceId: "t1", eventKey: "order.created", sessionId: "session-alpha",
            recordKind: "span", spanName: "create-order",
            addressContext: { order_event: "oe:v1:12", endpoint: "ep:v1:3" },
            payload: { order_id: "ord-999", total: 59800 } },
          { logId: "r5", traceId: "t1", eventKey: "order.paid", sessionId: "session-alpha",
            addressContext: { order_event: "oe:v1:12" } },
        ],
      })),
    }));
    expect(backendRes.status).toBe(202);

    // 인증 플로우 (session-beta)
    const authRes = await app.fetch(new Request("http://localhost/v1/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeEnvelope({
        txId: "tx-e2e-003",
        service: "auth",
        records: [
          { logId: "r6", traceId: "t2", eventKey: "auth.login", sessionId: "session-beta",
            actorId: "user@test.com",
            addressContext: { auth_event: "ae:v1:8" } },
          { logId: "r7", traceId: "t2", eventKey: "permission.check", sessionId: "session-beta",
            actorId: "user@test.com" },
        ],
      })),
    }));
    expect(authRes.status).toBe(202);

    // 결제 실패 (session-gamma)
    const paymentRes = await app.fetch(new Request("http://localhost/v1/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeEnvelope({
        txId: "tx-e2e-004",
        service: "payment",
        records: [
          { logId: "r8", traceId: "t3", eventKey: "error.payment_failed", sessionId: "session-gamma",
            addressContext: { event: "ev:v1:5" },
            payload: { code: "INSUFFICIENT_BALANCE", message: "잔액 부족", service: "payment" } },
        ],
      })),
    }));
    expect(paymentRes.status).toBe(202);
  });

  // ── insights API 라우트 테스트 ──

  it("GET /v1/insights/summary — 전체 요약", async () => {
    const res = await app.fetch(new Request("http://localhost/v1/insights/summary"));
    expect(res.status).toBe(200);
    const d = await res.json() as Record<string, number>;
    expect(d.traces).toBe(3);
    expect(d.records).toBe(8);
    expect(d.services).toBe(3);
    expect(d.actors).toBe(1);
    expect(d.errorRecords).toBe(1);
  });

  it("GET /v1/insights/services — 서비스별 분포", async () => {
    const res = await app.fetch(new Request("http://localhost/v1/insights/services"));
    const items = await res.json() as Array<Record<string, unknown>>;
    expect(items.length).toBe(3);
    const shopWeb = items.find((s) => s.service === "shopping-web");
    expect(shopWeb).toBeTruthy();
    // trace t1은 shopping-web이 소유하지만 backend/payment도 같은 trace에 기록
    // → trace의 recordCount가 누적되므로 3보다 큼
    expect(shopWeb!.records).toBeGreaterThanOrEqual(3);
  });

  it("GET /v1/insights/service-prefixes — 서비스별 prefix 사용", async () => {
    const res = await app.fetch(new Request("http://localhost/v1/insights/service-prefixes"));
    const items = await res.json() as Array<Record<string, unknown>>;
    expect(items.length).toBeGreaterThanOrEqual(3);

    const shopWeb = items.find((s) => s.service === "shopping-web");
    expect(shopWeb).toBeTruthy();
    const prefixes = shopWeb!.activePrefixes as string[];
    expect(prefixes).toContain("page_view");
    expect(prefixes).toContain("tracking");
    expect(prefixes).toContain("cart_event");
  });

  it("GET /v1/insights/prefixes — prefix 빈도", async () => {
    const res = await app.fetch(new Request("http://localhost/v1/insights/prefixes"));
    const items = await res.json() as Array<{ prefix: string; count: number }>;
    expect(items.length).toBeGreaterThan(0);
    const tracking = items.find((p) => p.prefix === "tracking");
    expect(tracking).toBeTruthy();
    expect(tracking!.count).toBe(2); // r1 + r2
  });

  it("GET /v1/insights/correlations — prefix 공출현 분석", async () => {
    const res = await app.fetch(new Request("http://localhost/v1/insights/correlations?min_support=1"));
    const d = await res.json() as Record<string, unknown>;
    expect(d.totalGroups).toBeGreaterThan(0);
    const correlations = d.correlations as Array<Record<string, unknown>>;
    // page_view와 tracking이 session-alpha에서 공출현
    const pvTracking = correlations.find(
      (c) => (c.prefixA === "page_view" && c.prefixB === "tracking") ||
             (c.prefixA === "tracking" && c.prefixB === "page_view"),
    );
    expect(pvTracking).toBeTruthy();
    expect(pvTracking!.jaccard).toBeGreaterThan(0);
  });

  it("GET /v1/insights/coverage — 이벤트 카테고리 커버리지", async () => {
    const res = await app.fetch(new Request("http://localhost/v1/insights/coverage"));
    const d = await res.json() as Record<string, unknown>;
    expect(d.totalRecords).toBe(8);
    const categories = d.categories as Array<Record<string, unknown>>;
    const outcome = categories.find((c) => c.category === "outcome");
    expect(outcome).toBeTruthy();
    // cart.add, order.created, order.paid
    expect((outcome!.observedKeys as string[]).length).toBeGreaterThanOrEqual(3);
  });

  it("GET /v1/insights/flows — 이벤트 시퀀스", async () => {
    const res = await app.fetch(new Request("http://localhost/v1/insights/flows?limit=10"));
    const items = await res.json() as Array<Record<string, unknown>>;
    // t1은 5 records, t2는 2 records → 둘 다 포함
    expect(items.length).toBe(2);
    const t1 = items.find((f) => f.traceId === "t1");
    expect(t1).toBeTruthy();
    expect((t1!.sequence as string[]).length).toBe(5);
    expect((t1!.prefixes as string[]).length).toBeGreaterThanOrEqual(4);
  });

  it("GET /v1/insights/errors — 에러 이벤트", async () => {
    const res = await app.fetch(new Request("http://localhost/v1/insights/errors"));
    const d = await res.json() as Record<string, unknown>;
    expect(d.total).toBe(1);
    const items = d.items as Array<Record<string, unknown>>;
    expect(items[0].eventKey).toBe("error.payment_failed");
    expect(items[0].code).toBe("INSUFFICIENT_BALANCE");
    expect(items[0].service).toBe("payment");
  });

  it("GET /v1/insights/permissions — 권한 이벤트", async () => {
    const res = await app.fetch(new Request("http://localhost/v1/insights/permissions"));
    const d = await res.json() as Record<string, unknown>;
    expect(d.total).toBe(2); // auth.login + permission.check
    const summary = d.summary as Record<string, number>;
    expect(summary["auth.login"]).toBe(1);
    expect(summary["permission.check"]).toBe(1);
  });

  // ── InsightsStore 직접 호출 테스트 ──

  it("store.getSummary() — 포트 인터페이스 직접 호출", async () => {
    const summary = await store.getSummary();
    expect(summary.traces).toBe(3);
    expect(summary.records).toBe(8);
    expect(summary.services).toBe(3);
  });

  it("store.collect() — local 모드는 no-op", async () => {
    // collect 호출해도 에러 없이 통과
    await expect(store.collect({
      records: [{ logId: "test", timestamp: now(), traceId: "tx", eventKey: "test", eventVersion: "001", recordKind: "log" }],
    })).resolves.toBeUndefined();
  });

  it("store.getServicePrefixes() — 서비스별 prefix 매핑", async () => {
    const svcPrefixes = await store.getServicePrefixes();
    const auth = svcPrefixes.find((s) => s.service === "auth");
    expect(auth).toBeTruthy();
    expect(auth!.activePrefixes).toContain("auth_event");
  });

  it("store.getTimeline() — 시간대별 분포", async () => {
    const timeline = await store.getTimeline();
    expect(timeline.length).toBeGreaterThan(0);
    // 모든 레코드가 같은 시간대에 들어왔으므로 1개 bucket
    expect(timeline[0].count).toBe(8);
  });
});
