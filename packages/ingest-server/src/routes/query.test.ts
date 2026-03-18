import { Hono } from "hono";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import {
  InMemoryGraphStore,
  InMemoryRecordStore,
  InMemorySessionStore,
  InMemoryTraceStore,
} from "@qa-sdk/store";
import { InMemoryDebugStore } from "../lib/in-memory-debug-store.js";
import type { DebugStore } from "../lib/debug-store.js";
import { createErrorHandler } from "../middleware/error-handler.js";
import { createQueryRoutes } from "./query.js";

interface QueryTestDeps {
  traceStore: InMemoryTraceStore;
  sessionStore: InMemorySessionStore;
  recordStore: InMemoryRecordStore;
  graphStore: InMemoryGraphStore;
  debugStore: DebugStore;
}

function buildDeps(overrides: Partial<QueryTestDeps> = {}): QueryTestDeps {
  return {
    traceStore: new InMemoryTraceStore(),
    sessionStore: new InMemorySessionStore(),
    recordStore: new InMemoryRecordStore(),
    graphStore: new InMemoryGraphStore(),
    debugStore: new InMemoryDebugStore({ ttlMs: 60_000 }),
    ...overrides,
  };
}

function buildApp(deps = buildDeps()) {
  const app = new Hono();
  app.onError(createErrorHandler(pino({ level: "silent" })));
  app.route("/", createQueryRoutes(deps));
  return { app, deps };
}

describe("GET /v1/traces/:traceId", () => {
  it("returns 404 when trace does not exist", async () => {
    const { app } = buildApp();
    const res = await app.request("/v1/traces/trc_missing");
    expect(res.status).toBe(404);
  });

  it("returns 200 with trace metadata when trace exists", async () => {
    const { app, deps } = buildApp();
    await deps.traceStore.upsert({
      traceId: "trc_001",
      sessionId: "qas_001",
      recordCount: 5,
      firstTimestamp: new Date("2026-03-13T00:00:00.000Z"),
      lastTimestamp: new Date("2026-03-13T00:00:05.000Z"),
    });

    const res = await app.request("/v1/traces/trc_001");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.traceId).toBe("trc_001");
    expect(body.sessionId).toBe("qas_001");
    expect(body.recordCount).toBe(5);
    expect(body.reconstructed).toBe(false);
  });
});

describe("GET /v1/traces/:traceId/records", () => {
  it("returns 404 when trace does not exist", async () => {
    const { app } = buildApp();
    const res = await app.request("/v1/traces/trc_missing/records");
    expect(res.status).toBe(404);
  });

  it("returns paginated records for a trace", async () => {
    const { app, deps } = buildApp();
    await deps.traceStore.upsert({
      traceId: "trc_001",
      recordCount: 1,
      firstTimestamp: new Date(),
      lastTimestamp: new Date(),
    });
    await deps.recordStore.insertBatch([
      {
        logId: "log_001",
        traceId: "trc_001",
        spanId: "spn_001",
        timestamp: new Date("2026-03-13T00:00:00.000Z"),
        recordKind: "log",
        eventKey: "page_view",
        eventVersion: "1",
        payloadFormat: "json",
        payloadEncoding: "raw",
        payloadMaskingApplied: false,
        payloadMaskedFields: [],
        payload: {},
      },
    ]);

    const res = await app.request("/v1/traces/trc_001/records");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].log_id).toBe("log_001");
    expect(body.has_more).toBe(false);
  });

  it("clamps limit to 200", async () => {
    const { app, deps } = buildApp();
    await deps.traceStore.upsert({
      traceId: "trc_001",
      recordCount: 0,
      firstTimestamp: new Date(),
      lastTimestamp: new Date(),
    });

    const res = await app.request("/v1/traces/trc_001/records?limit=9999");
    expect(res.status).toBe(200);
  });

  it("returns 400 for an invalid cursor", async () => {
    const { app, deps } = buildApp();
    await deps.traceStore.upsert({
      traceId: "trc_001",
      recordCount: 0,
      firstTimestamp: new Date(),
      lastTimestamp: new Date(),
    });

    const res = await app.request("/v1/traces/trc_001/records?cursor=!!!invalid!!!");
    expect(res.status).toBe(400);
  });

  it("returns 400 for a cursor with valid base64 but non-JSON content", async () => {
    const { app, deps } = buildApp();
    await deps.traceStore.upsert({
      traceId: "trc_001",
      recordCount: 0,
      firstTimestamp: new Date(),
      lastTimestamp: new Date(),
    });

    const cursor = Buffer.from("not valid json").toString("base64url");
    const res = await app.request(`/v1/traces/trc_001/records?cursor=${cursor}`);
    expect(res.status).toBe(400);
  });

  it("returns 400 for a cursor with valid JSON but missing required fields", async () => {
    const { app, deps } = buildApp();
    await deps.traceStore.upsert({
      traceId: "trc_001",
      recordCount: 0,
      firstTimestamp: new Date(),
      lastTimestamp: new Date(),
    });

    const cursor = Buffer.from(JSON.stringify({ timestamp: "2026-03-13T00:00:00.000Z" })).toString("base64url");
    const res = await app.request(`/v1/traces/trc_001/records?cursor=${cursor}`);
    expect(res.status).toBe(400);
  });

  it("returns 400 for limit=0", async () => {
    const { app, deps } = buildApp();
    await deps.traceStore.upsert({
      traceId: "trc_001",
      recordCount: 0,
      firstTimestamp: new Date(),
      lastTimestamp: new Date(),
    });

    const res = await app.request("/v1/traces/trc_001/records?limit=0");
    expect(res.status).toBe(400);
  });
});

describe("GET /v1/traces/:traceId/graph", () => {
  it("returns 404 when graph does not exist", async () => {
    const { app } = buildApp();
    const res = await app.request("/v1/traces/trc_missing/graph");
    expect(res.status).toBe(404);
  });

  it("returns 200 with the graph when it exists", async () => {
    const { app, deps } = buildApp();
    const graph = {
      trace_id: "trc_001",
      nodes: [],
      edges: [],
    };
    await deps.graphStore.upsert("trc_001", graph);

    const res = await app.request("/v1/traces/trc_001/graph");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trace_id).toBe("trc_001");
    expect(body.nodeCount).toBe(0);
    expect(body.edgeCount).toBe(0);
  });
});

describe("GET /v1/debug/traces/:traceId/recent", () => {
  it("returns 404 when trace does not exist", async () => {
    const { app } = buildApp();
    const res = await app.request("/v1/debug/traces/trc_missing/recent");
    expect(res.status).toBe(404);
  });

  it("returns recent trace records in descending timestamp order", async () => {
    const { app, deps } = buildApp();
    await deps.traceStore.upsert({
      traceId: "trc_001",
      sessionId: "qas_001",
      recordCount: 3,
      firstTimestamp: new Date("2026-03-13T00:00:00.000Z"),
      lastTimestamp: new Date("2026-03-13T00:00:02.000Z"),
    });

    await deps.debugStore.append({
      logId: "log_001",
      traceId: "trc_001",
      spanId: "spn_001",
      timestamp: new Date("2026-03-13T00:00:00.000Z"),
      recordKind: "log",
      eventKey: "page_view",
      eventVersion: "001",
      payloadFormat: "json",
      payloadEncoding: "raw",
      payloadMaskingApplied: false,
      payloadMaskedFields: [],
      payload: {},
      qaSessionId: "qas_001",
      createdAt: new Date("2026-03-13T00:00:10.000Z"),
    });
    await deps.debugStore.append({
      logId: "log_002",
      traceId: "trc_001",
      spanId: "spn_002",
      timestamp: new Date("2026-03-13T00:00:01.000Z"),
      recordKind: "log",
      eventKey: "page_view",
      eventVersion: "001",
      payloadFormat: "json",
      payloadEncoding: "raw",
      payloadMaskingApplied: false,
      payloadMaskedFields: [],
      payload: {},
      qaSessionId: "qas_001",
      createdAt: new Date("2026-03-13T00:00:11.000Z"),
    });
    await deps.debugStore.append({
      logId: "log_003",
      traceId: "trc_001",
      spanId: "spn_003",
      timestamp: new Date("2026-03-13T00:00:02.000Z"),
      recordKind: "log",
      eventKey: "page_view",
      eventVersion: "001",
      payloadFormat: "json",
      payloadEncoding: "raw",
      payloadMaskingApplied: false,
      payloadMaskedFields: [],
      payload: {},
      qaSessionId: "qas_001",
      createdAt: new Date("2026-03-13T00:00:12.000Z"),
    });

    const res = await app.request("/v1/debug/traces/trc_001/recent?limit=2");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      items: [
        expect.objectContaining({ log_id: "log_003", trace_id: "trc_001" }),
        expect.objectContaining({ log_id: "log_002", trace_id: "trc_001" }),
      ],
    });
  });

  it("caps debug trace limit at 200", async () => {
    const debugStore: DebugStore = {
      append: vi.fn().mockResolvedValue(undefined),
      getRecentByTrace: vi.fn().mockResolvedValue([]),
      getRecentBySession: vi.fn().mockResolvedValue([]),
    };
    const deps = buildDeps({ debugStore });
    const { app } = buildApp(deps);
    await deps.traceStore.upsert({
      traceId: "trc_001",
      recordCount: 0,
      firstTimestamp: new Date(),
      lastTimestamp: new Date(),
    });

    const res = await app.request("/v1/debug/traces/trc_001/recent?limit=9999");

    expect(res.status).toBe(200);
    expect(debugStore.getRecentByTrace).toHaveBeenCalledWith("trc_001", 200);
  });
});

describe("GET /v1/sessions/:sessionId", () => {
  it("returns 404 when session does not exist", async () => {
    const { app } = buildApp();
    const res = await app.request("/v1/sessions/qas_missing");
    expect(res.status).toBe(404);
  });

  it("returns 200 with session metadata when session exists", async () => {
    const { app, deps } = buildApp();
    await deps.sessionStore.upsert({ sessionId: "qas_001", scenarioId: "checkout-flow" });

    const res = await app.request("/v1/sessions/qas_001");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionId).toBe("qas_001");
    expect(body.scenarioId).toBe("checkout-flow");
    expect(body.closedAt).toBeNull();
  });
});

describe("GET /v1/sessions/:sessionId/records", () => {
  it("returns 404 when session does not exist", async () => {
    const { app } = buildApp();
    const res = await app.request("/v1/sessions/qas_missing/records");
    expect(res.status).toBe(404);
  });

  it("returns 400 for limit=0 in session records", async () => {
    const { app, deps } = buildApp();
    await deps.sessionStore.upsert({ sessionId: "qas_001" });

    const res = await app.request("/v1/sessions/qas_001/records?limit=0");
    expect(res.status).toBe(400);
  });

  it("returns paginated records for a session", async () => {
    const { app, deps } = buildApp();
    await deps.sessionStore.upsert({ sessionId: "qas_001" });
    await deps.recordStore.insertBatch([
      {
        logId: "log_001",
        traceId: "trc_001",
        spanId: "spn_001",
        timestamp: new Date("2026-03-13T00:00:00.000Z"),
        recordKind: "log",
        eventKey: "page_view",
        eventVersion: "1",
        payloadFormat: "json",
        payloadEncoding: "raw",
        payloadMaskingApplied: false,
        payloadMaskedFields: [],
        payload: {},
        qaSessionId: "qas_001",
      },
    ]);

    const res = await app.request("/v1/sessions/qas_001/records");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].qa_session_id).toBe("qas_001");
  });
});

describe("GET /v1/debug/sessions/:sessionId/recent", () => {
  it("returns 404 when session does not exist", async () => {
    const { app } = buildApp();
    const res = await app.request("/v1/debug/sessions/qas_missing/recent");
    expect(res.status).toBe(404);
  });

  it("returns recent session records with the default limit", async () => {
    const { app, deps } = buildApp();
    await deps.sessionStore.upsert({ sessionId: "qas_001" });

    await deps.debugStore.append({
      logId: "log_001",
      traceId: "trc_001",
      spanId: "spn_001",
      timestamp: new Date("2026-03-13T00:00:00.000Z"),
      recordKind: "log",
      eventKey: "page_view",
      eventVersion: "001",
      payloadFormat: "json",
      payloadEncoding: "raw",
      payloadMaskingApplied: false,
      payloadMaskedFields: [],
      payload: {},
      qaSessionId: "qas_001",
      createdAt: new Date("2026-03-13T00:00:10.000Z"),
    });

    const res = await app.request("/v1/debug/sessions/qas_001/recent");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      items: [expect.objectContaining({ log_id: "log_001", qa_session_id: "qas_001" })],
    });
  });
});
