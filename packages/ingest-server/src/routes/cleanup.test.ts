import { Hono } from "hono";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import { createErrorHandler } from "../middleware/error-handler.js";
import { createCleanupRoutes } from "./cleanup.js";
import type { CleanupStore } from "../lib/cleanup.js";

function buildNoopCleanupStore(): CleanupStore {
  return {
    listExpiredTraceIds: vi.fn().mockResolvedValue([]),
    deleteEventRecordsByTraceIds: vi.fn().mockResolvedValue(0),
    deleteRuntimeGraphsByTraceIds: vi.fn().mockResolvedValue(0),
    deleteVerdictReportsByTraceIds: vi.fn().mockResolvedValue(0),
    deleteTracesByIds: vi.fn().mockResolvedValue(0),
    listExpiredVerdictIds: vi.fn().mockResolvedValue([]),
    deleteVerdictReportsByIds: vi.fn().mockResolvedValue(0),
    listOrphanSessionIds: vi.fn().mockResolvedValue([]),
    deleteQaSessionsByIds: vi.fn().mockResolvedValue(0),
  };
}

function buildApp(cleanupStore = buildNoopCleanupStore()) {
  const app = new Hono();
  app.onError(createErrorHandler(pino({ level: "silent" })));
  app.route("/", createCleanupRoutes({ cleanupStore }));
  return { app, cleanupStore };
}

describe("POST /v1/admin/cleanup", () => {
  it("returns 200 with ok=true and default options", async () => {
    const { app } = buildApp();
    const res = await app.request("/v1/admin/cleanup", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.options.traceRetentionDays).toBe(30);
    expect(body.options.verdictRetentionDays).toBe(90);
    expect(body.options.batchSize).toBe(1000);
  });

  it("returns 200 with empty body (no JSON)", async () => {
    const { app } = buildApp();
    const res = await app.request("/v1/admin/cleanup", { method: "POST" });
    expect(res.status).toBe(200);
  });

  it("accepts custom retention options in body", async () => {
    const { app } = buildApp();
    const res = await app.request("/v1/admin/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traceRetentionDays: 7, verdictRetentionDays: 14 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.options.traceRetentionDays).toBe(7);
    expect(body.options.verdictRetentionDays).toBe(14);
  });

  it("returns 400 for invalid JSON body", async () => {
    const { app } = buildApp();
    const res = await app.request("/v1/admin/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ invalid json",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for traceRetentionDays=0", async () => {
    const { app } = buildApp();
    const res = await app.request("/v1/admin/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traceRetentionDays: 0 }),
    });
    expect(res.status).toBe(400);
  });

  it("deletes expired verdicts even when no expired traces exist", async () => {
    const cleanupStore: CleanupStore = {
      listExpiredTraceIds: vi.fn().mockResolvedValue([]),
      deleteEventRecordsByTraceIds: vi.fn().mockResolvedValue(0),
      deleteRuntimeGraphsByTraceIds: vi.fn().mockResolvedValue(0),
      deleteVerdictReportsByTraceIds: vi.fn().mockResolvedValue(0),
      deleteTracesByIds: vi.fn().mockResolvedValue(0),
      listExpiredVerdictIds: vi.fn()
        .mockResolvedValueOnce(["vrd_001"])
        .mockResolvedValue([]),
      deleteVerdictReportsByIds: vi.fn().mockResolvedValue(1),
      listOrphanSessionIds: vi.fn().mockResolvedValue([]),
      deleteQaSessionsByIds: vi.fn().mockResolvedValue(0),
    };

    const { app } = buildApp(cleanupStore);
    const res = await app.request("/v1/admin/cleanup", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted.verdictReports).toBe(1);
    expect(body.deleted.traces).toBe(0);
    expect(body.deleted.eventRecords).toBe(0);
  });

  it("reports deletion counts from the cleanup store", async () => {
    const cleanupStore: CleanupStore = {
      listExpiredTraceIds: vi.fn()
        .mockResolvedValueOnce(["trc_001"])
        .mockResolvedValue([]),
      deleteEventRecordsByTraceIds: vi.fn().mockResolvedValue(10),
      deleteRuntimeGraphsByTraceIds: vi.fn().mockResolvedValue(1),
      deleteVerdictReportsByTraceIds: vi.fn().mockResolvedValue(2),
      deleteTracesByIds: vi.fn().mockResolvedValue(1),
      listExpiredVerdictIds: vi.fn().mockResolvedValue([]),
      deleteVerdictReportsByIds: vi.fn().mockResolvedValue(0),
      listOrphanSessionIds: vi.fn().mockResolvedValue([]),
      deleteQaSessionsByIds: vi.fn().mockResolvedValue(0),
    };

    const { app } = buildApp(cleanupStore);
    const res = await app.request("/v1/admin/cleanup", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted.eventRecords).toBe(10);
    expect(body.deleted.runtimeGraphs).toBe(1);
    expect(body.deleted.traces).toBe(1);
  });
});
