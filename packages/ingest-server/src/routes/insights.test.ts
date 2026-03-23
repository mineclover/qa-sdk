import { Hono } from "hono";
import { describe, expect, it, beforeEach } from "vitest";
import { NodeSqliteDriver } from "index-meta";
import { INGEST_D1_SCHEMA_DDL } from "../stores/d1-schema.sql.js";
import { createInsightsRoutes } from "./insights.js";

async function createDb() {
  const driver = new NodeSqliteDriver(":memory:");
  // DDL 초기화
  for (const stmt of INGEST_D1_SCHEMA_DDL.split(";").map(s => s.trim()).filter(s => s.length > 0)) {
    await driver.execute(stmt);
  }
  return driver;
}

function buildApp(driver: NodeSqliteDriver) {
  const app = new Hono();
  app.route("/", createInsightsRoutes({ driver }));
  return app;
}

async function insertTrace(driver: NodeSqliteDriver, traceId: string, serviceName: string, recordCount: number) {
  const now = new Date().toISOString();
  await driver.execute(
    `INSERT INTO traces (trace_id, service_name, record_count, first_timestamp, last_timestamp, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [traceId, serviceName, recordCount, now, now, now, now],
  );
}

async function insertRecord(driver: NodeSqliteDriver, opts: {
  logId: string; traceId: string; eventKey: string;
  addressContext?: string; actorId?: string; sessionId?: string;
}) {
  const now = new Date().toISOString();
  await driver.execute(
    `INSERT INTO event_records (log_id, trace_id, span_id, timestamp, record_kind, event_key, event_version,
       payload_format, payload_encoding, payload_masking_applied, payload_masked_fields,
       address_context, actor_id, qa_session_id, created_at)
     VALUES (?, ?, 'sp', ?, 'log', ?, '001', 'json', 'raw', 0, '[]', ?, ?, ?, ?)`,
    [opts.logId, opts.traceId, now, opts.eventKey, opts.addressContext ?? null, opts.actorId ?? null, opts.sessionId ?? null, now],
  );
}

describe("insights API", () => {
  let driver: NodeSqliteDriver;
  let app: Hono;

  beforeEach(async () => {
    driver = await createDb();
    app = buildApp(driver);

    // seed data
    await insertTrace(driver, "t1", "shop/web", 3);
    await insertTrace(driver, "t2", "shop/web", 1);
    await insertTrace(driver, "t3", "auth-svc", 2);

    await insertRecord(driver, { logId: "r1", traceId: "t1", eventKey: "page.view", addressContext: '{"service":"s:v1:0","page_view":"pv:v2:0"}' });
    await insertRecord(driver, { logId: "r2", traceId: "t1", eventKey: "cart.add", addressContext: '{"cart_event":"ce:v1:0"}' });
    await insertRecord(driver, { logId: "r3", traceId: "t1", eventKey: "checkout.entry" });
    await insertRecord(driver, { logId: "r4", traceId: "t2", eventKey: "page.view" });
    await insertRecord(driver, { logId: "r5", traceId: "t3", eventKey: "auth.login", actorId: "user@test.com", sessionId: "sess-1" });
    await insertRecord(driver, { logId: "r6", traceId: "t3", eventKey: "permission.check" });
  });

  it("GET /v1/insights/summary — 전체 카운트", async () => {
    const res = await app.request("/v1/insights/summary");
    expect(res.status).toBe(200);
    const d = await res.json() as any;
    expect(d.traces).toBe(3);
    expect(d.records).toBe(6);
    expect(d.services).toBe(2);
    expect(d.eventKeys).toBe(5); // page.view, cart.add, checkout.entry, auth.login, permission.check
    expect(d.autoRecords).toBe(0);
    expect(d.manualRecords).toBe(6);
    expect(d.actors).toBe(1);
  });

  it("GET /v1/insights/services — 서비스별 분포", async () => {
    const res = await app.request("/v1/insights/services");
    const items = await res.json() as any[];
    expect(items.length).toBe(2);
    const shopWeb = items.find((s: any) => s.service === "shop/web");
    expect(shopWeb.traces).toBe(2);
    expect(shopWeb.records).toBe(4);
  });

  it("GET /v1/insights/event-keys — 이벤트 키 빈도 + category", async () => {
    const res = await app.request("/v1/insights/event-keys");
    const items = await res.json() as any[];
    expect(items.length).toBe(5);
    const pageView = items.find((e: any) => e.eventKey === "page.view");
    expect(pageView.count).toBe(2);
    expect(pageView.category).toBe("navigation");
    const cartAdd = items.find((e: any) => e.eventKey === "cart.add");
    expect(cartAdd.category).toBe("outcome");
    const authLogin = items.find((e: any) => e.eventKey === "auth.login");
    expect(authLogin.category).toBe("session");
  });

  it("GET /v1/insights/prefixes — address_context prefix 빈도", async () => {
    const res = await app.request("/v1/insights/prefixes");
    const items = await res.json() as any[];
    expect(items.length).toBeGreaterThan(0);
    const service = items.find((p: any) => p.prefix === "service");
    expect(service).toBeTruthy();
    expect(service.count).toBe(1);
  });

  it("GET /v1/insights/timeline — 시간대별 분포", async () => {
    const res = await app.request("/v1/insights/timeline");
    const items = await res.json() as any[];
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].hour).toBeTruthy();
    expect(items[0].count).toBeGreaterThan(0);
  });

  it("GET /v1/insights/flows — 다단계 trace 시퀀스", async () => {
    const res = await app.request("/v1/insights/flows?limit=10");
    const items = await res.json() as any[];
    // t1은 record_count=3 → 포함, t3은 2 → 포함
    expect(items.length).toBe(2);
    const t1 = items.find((f: any) => f.traceId === "t1");
    expect(t1.sequence).toEqual(["page.view", "cart.add", "checkout.entry"]);
    expect(t1.prefixes).toContain("service");
  });

  it("GET /v1/insights/coverage — 카테고리별 커버리지", async () => {
    const res = await app.request("/v1/insights/coverage");
    const d = await res.json() as any;
    expect(d.totalObservedKeys).toBe(5);
    expect(d.totalRecords).toBe(6);
    const nav = d.categories.find((c: any) => c.category === "navigation");
    expect(nav).toBeTruthy();
    expect(nav.observedKeys).toContain("page.view");
  });

  it("GET /v1/insights/permissions — 권한 히스토리", async () => {
    const res = await app.request("/v1/insights/permissions");
    const d = await res.json() as any;
    expect(d.total).toBe(2); // auth.login + permission.check
    expect(d.summary["auth.login"]).toBe(1);
    expect(d.summary["permission.check"]).toBe(1);
  });
});
