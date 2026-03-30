import { Hono } from "hono";
import { describe, expect, it, beforeEach } from "vitest";
import { getDatabaseSync } from "index-meta";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { createInsightsRoutes } from "./insights.js";
import { DrizzleInsightsStore } from "../stores/drizzle-insights-store.js";
import { traces, eventRecords } from "../db/schema.js";

const migrationsFolder = new URL("../../drizzle", import.meta.url).pathname;

type DrizzleDb = ReturnType<typeof drizzle>;

function createDb(): DrizzleDb {
  const DatabaseSync = getDatabaseSync();
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA journal_mode = WAL");
  raw.exec("PRAGMA busy_timeout = 3000");
  const db = drizzle({ client: raw });
  migrate(db, { migrationsFolder });
  return db;
}

function buildApp(db: DrizzleDb) {
  const app = new Hono();
  app.route("/", createInsightsRoutes({ store: new DrizzleInsightsStore(db) }));
  return app;
}

function insertTrace(db: DrizzleDb, traceId: string, serviceName: string, recordCount: number) {
  const now = new Date().toISOString();
  db.insert(traces).values({
    traceId,
    serviceName,
    recordCount,
    firstTimestamp: now,
    lastTimestamp: now,
    createdAt: now,
    updatedAt: now,
  }).run();
}

function insertRecord(db: DrizzleDb, opts: {
  logId: string; traceId: string; eventKey: string;
  addressContext?: string; actorId?: string; sessionId?: string;
}) {
  const now = new Date().toISOString();
  db.insert(eventRecords).values({
    logId: opts.logId,
    traceId: opts.traceId,
    spanId: "sp",
    timestamp: now,
    recordKind: "log",
    eventKey: opts.eventKey,
    eventVersion: "001",
    payloadFormat: "json",
    payloadEncoding: "raw",
    payloadMaskingApplied: false,
    payloadMaskedFields: "[]",
    addressContext: opts.addressContext ?? null,
    actorId: opts.actorId ?? null,
    qaSessionId: opts.sessionId ?? null,
    createdAt: now,
  }).run();
}

describe("insights API", () => {
  let db: DrizzleDb;
  let app: Hono;

  beforeEach(() => {
    db = createDb();
    app = buildApp(db);

    // seed data
    insertTrace(db, "t1", "shop/web", 3);
    insertTrace(db, "t2", "shop/web", 1);
    insertTrace(db, "t3", "auth-svc", 2);

    insertRecord(db, { logId: "r1", traceId: "t1", eventKey: "page.view", addressContext: '{"service":"s:v1:0","page_view":"pv:v2:0"}' });
    insertRecord(db, { logId: "r2", traceId: "t1", eventKey: "cart.add", addressContext: '{"cart_event":"ce:v1:0"}' });
    insertRecord(db, { logId: "r3", traceId: "t1", eventKey: "checkout.entry" });
    insertRecord(db, { logId: "r4", traceId: "t2", eventKey: "page.view" });
    insertRecord(db, { logId: "r5", traceId: "t3", eventKey: "auth.login", actorId: "user@test.com", sessionId: "sess-1" });
    insertRecord(db, { logId: "r6", traceId: "t3", eventKey: "permission.check" });
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
