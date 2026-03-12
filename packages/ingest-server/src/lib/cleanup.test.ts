import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pino, { type Logger } from "pino";
import type { RuntimeGraph } from "@qa-sdk/core";
import {
  InMemoryDlqStore,
  InMemoryGraphStore,
  InMemoryRecordStore,
  InMemoryScenarioSpecStore,
  InMemorySessionStore,
  InMemoryTraceStore,
  InMemoryTransmissionStore,
  InMemoryVerdictStore,
} from "@qa-sdk/store";
import { createApp } from "../app.js";
import { RecordStreamBroker } from "./record-stream-broker.js";
import {
  cleanupExpiredData,
  createInMemoryCleanupStore,
} from "./cleanup.js";

const NOW = new Date("2026-03-12T10:05:00.000Z");

describe("cleanupExpiredData", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("deletes only data outside retention windows in batches and keeps active session links", async () => {
    const harness = createCleanupHarness();
    const logger = {
      info: vi.fn(),
    } as unknown as Logger;

    await seedTraceBundle(harness, {
      createdAt: "2026-01-31T10:05:00.000Z",
      recordLogId: "record_expired",
      sessionId: "session_expired",
      traceId: "trace_expired",
      verdicts: [
        {
          computedAt: "2026-03-07T10:05:00.000Z",
          id: "verdict_trace_expired",
          scenarioId: "scenario_expired",
        },
      ],
    });
    await seedTraceBundle(harness, {
      createdAt: "2026-01-31T11:05:00.000Z",
      recordLogId: "record_shared_expired",
      sessionId: "session_shared",
      traceId: "trace_shared_expired",
    });
    await seedTraceBundle(harness, {
      createdAt: "2026-03-08T10:05:00.000Z",
      recordLogId: "record_shared_fresh",
      sessionId: "session_shared",
      traceId: "trace_shared_fresh",
    });
    await seedTraceBundle(harness, {
      createdAt: "2026-03-08T11:05:00.000Z",
      recordLogId: "record_active",
      sessionId: "session_active",
      traceId: "trace_active",
      verdicts: [
        {
          computedAt: "2025-12-02T10:05:00.000Z",
          id: "verdict_old_only",
          scenarioId: "scenario_old",
        },
        {
          computedAt: "2026-03-07T11:05:00.000Z",
          id: "verdict_recent_only",
          scenarioId: "scenario_recent",
        },
      ],
    });

    const result = await cleanupExpiredData(
      {
        cleanupStore: harness.cleanupStore,
        logger,
        now: () => NOW,
      },
      {
        traceRetentionDays: 30,
        verdictRetentionDays: 90,
        batchSize: 1,
      },
    );

    expect(result).toEqual({
      options: {
        traceRetentionDays: 30,
        verdictRetentionDays: 90,
        batchSize: 1,
      },
      cutoffs: {
        traceCreatedBefore: "2026-02-10T10:05:00.000Z",
        verdictComputedBefore: "2025-12-12T10:05:00.000Z",
      },
      deleted: {
        eventRecords: 2,
        runtimeGraphs: 2,
        verdictReports: 2,
        traces: 2,
        qaSessions: 1,
      },
    });

    await expect(harness.traceStore.findById("trace_expired")).resolves.toBeNull();
    await expect(
      harness.traceStore.findById("trace_shared_expired"),
    ).resolves.toBeNull();
    await expect(
      harness.traceStore.findById("trace_shared_fresh"),
    ).resolves.toEqual(expect.objectContaining({ traceId: "trace_shared_fresh" }));
    await expect(harness.traceStore.findById("trace_active")).resolves.toEqual(
      expect.objectContaining({ traceId: "trace_active" }),
    );

    await expect(harness.recordStore.findByTraceId("trace_expired")).resolves.toEqual(
      [],
    );
    await expect(
      harness.recordStore.findByTraceId("trace_shared_expired"),
    ).resolves.toEqual([]);
    await expect(
      harness.recordStore.findByTraceId("trace_shared_fresh"),
    ).resolves.toHaveLength(1);
    await expect(harness.recordStore.findByTraceId("trace_active")).resolves.toHaveLength(
      1,
    );

    await expect(harness.graphStore.findByTraceId("trace_expired")).resolves.toBeNull();
    await expect(
      harness.graphStore.findByTraceId("trace_shared_expired"),
    ).resolves.toBeNull();
    await expect(
      harness.graphStore.findByTraceId("trace_shared_fresh"),
    ).resolves.toEqual(buildGraph("trace_shared_fresh"));
    await expect(harness.graphStore.findByTraceId("trace_active")).resolves.toEqual(
      buildGraph("trace_active"),
    );

    await expect(
      harness.verdictStore.findByTraceId("trace_expired"),
    ).resolves.toEqual([]);
    await expect(harness.verdictStore.findByTraceId("trace_active")).resolves.toEqual([
      expect.objectContaining({
        id: "verdict_recent_only",
        scenarioId: "scenario_recent",
      }),
    ]);

    await expect(harness.sessionStore.findById("session_expired")).resolves.toBeNull();
    await expect(harness.sessionStore.findById("session_shared")).resolves.toEqual(
      expect.objectContaining({ sessionId: "session_shared" }),
    );
    await expect(harness.sessionStore.findById("session_active")).resolves.toEqual(
      expect.objectContaining({ sessionId: "session_active" }),
    );

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted: {
          eventRecords: 2,
          runtimeGraphs: 2,
          verdictReports: 2,
          traces: 2,
          qaSessions: 1,
        },
      }),
      "expired data cleanup complete",
    );
  });

  it("uses default retention values from POST /v1/admin/cleanup with an empty body", async () => {
    const harness = createCleanupHarness();

    await seedTraceBundle(harness, {
      createdAt: "2026-02-01T10:05:00.000Z",
      recordLogId: "record_default_cleanup",
      sessionId: "session_default_cleanup",
      traceId: "trace_default_cleanup",
      verdicts: [
        {
          computedAt: "2026-03-10T10:05:00.000Z",
          id: "verdict_default_cleanup",
          scenarioId: "scenario_default_cleanup",
        },
      ],
    });

    const response = await harness.app.request("/v1/admin/cleanup", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      options: {
        traceRetentionDays: 30,
        verdictRetentionDays: 90,
        batchSize: 1000,
      },
      cutoffs: {
        traceCreatedBefore: "2026-02-10T10:05:00.000Z",
        verdictComputedBefore: "2025-12-12T10:05:00.000Z",
      },
      deleted: {
        eventRecords: 1,
        runtimeGraphs: 1,
        verdictReports: 1,
        traces: 1,
        qaSessions: 1,
      },
    });
  });

  it("allows POST /v1/admin/cleanup body overrides", async () => {
    const harness = createCleanupHarness();

    await seedTraceBundle(harness, {
      createdAt: "2026-03-01T10:05:00.000Z",
      recordLogId: "record_override_cleanup",
      sessionId: "session_override_cleanup",
      traceId: "trace_override_cleanup",
      verdicts: [
        {
          computedAt: "2026-02-20T10:05:00.000Z",
          id: "verdict_override_cleanup",
          scenarioId: "scenario_override_cleanup",
        },
      ],
    });

    const response = await harness.app.request("/v1/admin/cleanup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        traceRetentionDays: 7,
        verdictRetentionDays: 14,
        batchSize: 1,
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      options: {
        traceRetentionDays: 7,
        verdictRetentionDays: 14,
        batchSize: 1,
      },
      cutoffs: {
        traceCreatedBefore: "2026-03-05T10:05:00.000Z",
        verdictComputedBefore: "2026-02-26T10:05:00.000Z",
      },
      deleted: {
        eventRecords: 1,
        runtimeGraphs: 1,
        verdictReports: 1,
        traces: 1,
        qaSessions: 1,
      },
    });
  });
});

function createCleanupHarness() {
  const recordStore = new InMemoryRecordStore();
  const traceStore = new InMemoryTraceStore();
  const graphStore = new InMemoryGraphStore();
  const transmissionStore = new InMemoryTransmissionStore();
  const sessionStore = new InMemorySessionStore();
  const verdictStore = new InMemoryVerdictStore();
  const scenarioSpecStore = new InMemoryScenarioSpecStore();
  const dlqStore = new InMemoryDlqStore();
  const cleanupStore = createInMemoryCleanupStore({
    graphStore,
    recordStore,
    sessionStore,
    traceStore,
    verdictStore,
  });
  const app = createApp({
    cleanupStore,
    dlqStore,
    graphStore,
    logger: pino({ level: "silent" }),
    recordStore,
    recordStreamBroker: new RecordStreamBroker(),
    scenarioSpecStore,
    sessionStore,
    traceStore,
    transmissionStore,
    verdictStore,
  });

  return {
    app,
    cleanupStore,
    graphStore,
    recordStore,
    sessionStore,
    traceStore,
    verdictStore,
  };
}

async function seedTraceBundle(
  harness: ReturnType<typeof createCleanupHarness>,
  options: {
    traceId: string;
    sessionId: string;
    recordLogId: string;
    createdAt: string;
    verdicts?: Array<{
      id: string;
      scenarioId: string;
      computedAt: string;
    }>;
  },
) {
  const traceTimestamp = new Date(options.createdAt);
  const verdicts = options.verdicts ?? [];

  vi.setSystemTime(traceTimestamp);
  await harness.sessionStore.upsert({ sessionId: options.sessionId });
  await harness.traceStore.upsert({
    traceId: options.traceId,
    sessionId: options.sessionId,
    serviceName: "checkout-api",
    recordCount: 1,
    firstTimestamp: traceTimestamp,
    lastTimestamp: traceTimestamp,
  });
  await harness.recordStore.insertBatch([
    {
      logId: options.recordLogId,
      traceId: options.traceId,
      spanId: `${options.traceId}_span`,
      timestamp: traceTimestamp,
      recordKind: "log",
      eventKey: `${options.traceId}.event`,
      eventVersion: "001",
      payloadFormat: "json",
      payloadEncoding: "raw",
      payloadMaskingApplied: false,
      payloadMaskedFields: [],
      payload: { traceId: options.traceId },
      qaSessionId: options.sessionId,
    },
  ]);
  await harness.graphStore.upsert(options.traceId, buildGraph(options.traceId));

  for (const verdict of verdicts) {
    vi.setSystemTime(new Date(verdict.computedAt));
    await harness.verdictStore.insert({
      id: verdict.id,
      scenarioId: verdict.scenarioId,
      traceId: options.traceId,
      qaSessionId: options.sessionId,
      overallVerdict: "pass",
      report: {
        scenario_id: verdict.scenarioId,
        trace_id: options.traceId,
        qa_session_id: options.sessionId,
        overall_verdict: "pass",
        passed_steps: ["step_1"],
        failed_steps: [],
        warning_steps: [],
        missing_steps: [],
        unexpected_nodes: [],
        latency_violations: [],
        summary: "ok",
      },
    });
  }

  vi.setSystemTime(NOW);
}

function buildGraph(traceId: string): RuntimeGraph {
  return {
    trace_id: traceId,
    nodes: [
      {
        id: `${traceId}_node`,
        log_id: `${traceId}_log`,
        timestamp: NOW.toISOString(),
        record_kind: "log",
        event_key: `${traceId}.event`,
        event_version: "001",
        payload: { traceId },
        payload_masking_applied: false,
        payload_masked_fields: [],
      },
    ],
    edges: [],
  };
}
