import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DlqStore,
  GraphStore,
  RecordInsert,
  RecordStore,
  RuntimeGraph,
  ScenarioSpec,
  ScenarioSpecStore,
  SessionStore,
  TaskPayload,
  TaskQueue,
  TraceStore,
  TransmissionEnvelope,
  TransmissionInsert,
  VerdictStore,
} from "@qa-sdk/core";
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
import pino, { type Logger } from "pino";
import { createApp } from "./app.js";
import type { DebugStore } from "./lib/debug-store.js";
import { InMemoryDebugStore } from "./lib/in-memory-debug-store.js";
import { InMemoryTaskQueue } from "./lib/in-memory-task-queue.js";
import { registerTaskQueueWorker } from "./lib/phase-two-worker.js";
import { RecordStreamBroker } from "./lib/record-stream-broker.js";
import type {
  RegistryEventValidator,
  RegistryValidationMode,
  TracePersistenceStores,
  TraceTransactionRunner,
} from "./routes/ingest.js";
import type { DbHealthChecker } from "./routes/health.js";

function createNoopLogger(): Logger {
  return pino({ level: "silent" });
}

function createTestApp(
  options: {
    dlqMaxRetryAttempts?: number;
    dlqStore?: DlqStore;
    debugStore?: DebugStore;
    graphStore?: GraphStore;
    logger?: Logger;
    checkDbHealth?: DbHealthChecker;
    getUptimeSeconds?: () => number;
    rateLimitMaxRequests?: number;
    rateLimitWindowMs?: number;
    recordStore?: RecordStore;
    registryValidationMode?: RegistryValidationMode;
    registryValidator?: RegistryEventValidator;
    scenarioSpecStore?: ScenarioSpecStore;
    sessionStore?: SessionStore;
    streamSubscriptionLimit?: number;
    taskQueue?: TaskQueue<TaskPayload>;
    traceStore?: TraceStore;
    verdictStore?: VerdictStore;
    withTraceTransaction?: TraceTransactionRunner;
  } = {},
) {
  const recordStore = options.recordStore ?? new InMemoryRecordStore();
  const traceStore = options.traceStore ?? new InMemoryTraceStore();
  const graphStore = options.graphStore ?? new InMemoryGraphStore();
  const transmissionStore = new InMemoryTransmissionStore();
  const sessionStore = options.sessionStore ?? new InMemorySessionStore();
  const verdictStore = options.verdictStore ?? new InMemoryVerdictStore();
  const scenarioSpecStore =
    options.scenarioSpecStore ?? new InMemoryScenarioSpecStore();
  const dlqStore = options.dlqStore ?? new InMemoryDlqStore();
  const debugStore = options.debugStore;
  const recordStreamBroker = new RecordStreamBroker();

  const app = createApp({
    recordStore,
    traceStore,
    graphStore,
    transmissionStore,
    sessionStore,
    verdictStore,
    scenarioSpecStore,
    dlqStore,
    debugStore,
    recordStreamBroker,
    streamSubscriptionLimit: options.streamSubscriptionLimit,
    dlqMaxRetryAttempts: options.dlqMaxRetryAttempts,
    rateLimitWindowMs: options.rateLimitWindowMs,
    rateLimitMaxRequests: options.rateLimitMaxRequests,
    registryValidationMode: options.registryValidationMode,
    registryValidator: options.registryValidator,
    taskQueue: options.taskQueue,
    withTraceTransaction: options.withTraceTransaction,
    checkDbHealth: options.checkDbHealth,
    getUptimeSeconds: options.getUptimeSeconds,
    logger: options.logger ?? createNoopLogger(),
  });

  return {
    app,
    graphStore,
    recordStore,
    traceStore,
    transmissionStore,
    sessionStore,
    verdictStore,
    scenarioSpecStore,
    dlqStore,
    debugStore,
    taskQueue: options.taskQueue,
    recordStreamBroker,
  };
}

function buildEnvelope(): TransmissionEnvelope {
  return {
    transmission_id: "tx_1",
    sent_at: "2026-03-12T10:00:05.000Z",
    owner: {
      owner_type: "workspace",
      owner_id: "workspace_1",
    },
    source: {
      service_name: "checkout-api",
      sdk_name: "qa-sdk-js",
      sdk_version: "0.1.0",
    },
    runtime: {
      platform: "node",
      app_version: "20.12.0",
    },
    build: {
      env: "staging",
      release_version: "2026.03.12",
    },
    records: [
      {
        log_id: "log_user_input",
        timestamp: "2026-03-12T09:59:58.000Z",
        record_kind: "log",
        trace_id: "trace_checkout",
        span_id: "span_form",
        event_key: "checkout.form.updated",
        event_version: "001",
        payload_format: "json",
        payload_encoding: "raw",
        payload_masking_applied: false,
        payload_masked_fields: [],
        payload: { field: "email" },
        qa_session_id: "session_1",
      },
      {
        log_id: "log_span_save",
        timestamp: "2026-03-12T09:59:57.000Z",
        record_kind: "span",
        trace_id: "trace_checkout",
        span_id: "span_save",
        parent_span_id: "span_form",
        event_key: "checkout.save",
        event_version: "001",
        span_name: "persist_order",
        start_time: "2026-03-12T09:59:56.000Z",
        end_time: "2026-03-12T09:59:57.000Z",
        status_code: "ok",
        payload_format: "json",
        payload_encoding: "raw",
        payload_masking_applied: false,
        payload_masked_fields: [],
        payload: { orderId: "order_1" },
      },
      {
        log_id: "log_async_note",
        timestamp: "2026-03-12T09:59:59.000Z",
        record_kind: "log",
        trace_id: "trace_checkout",
        span_id: "span_form",
        event_key: "checkout.audit",
        event_version: "001",
        payload_format: "json",
        payload_encoding: "raw",
        payload_masking_applied: false,
        payload_masked_fields: [],
        payload: { step: "queued" },
        qa_session_id: "session_2",
      },
      {
        log_id: "log_background",
        timestamp: "2026-03-12T10:00:00.000Z",
        record_kind: "log",
        trace_id: "trace_background",
        span_id: "span_worker",
        event_key: "worker.dispatched",
        event_version: "001",
        payload_format: "json",
        payload_encoding: "raw",
        payload_masking_applied: false,
        payload_masked_fields: [],
        payload: { queue: "reconciliation" },
      },
    ],
  };
}

function buildEnvelopeWithSuffix(suffix: string): TransmissionEnvelope {
  const envelope = buildEnvelope();

  return {
    ...envelope,
    transmission_id: `${envelope.transmission_id}_${suffix}`,
    records: envelope.records.map((record) => ({
      ...record,
      log_id: `${record.log_id}_${suffix}`,
      trace_id: `${record.trace_id}_${suffix}`,
      span_id: `${record.span_id}_${suffix}`,
      parent_span_id: record.parent_span_id
        ? `${record.parent_span_id}_${suffix}`
        : undefined,
      qa_session_id: record.qa_session_id
        ? `${record.qa_session_id}_${suffix}`
        : undefined,
    })),
  };
}

function buildExpectedCheckoutGraph(): RuntimeGraph {
  return {
    trace_id: "trace_checkout",
    nodes: [
      {
        id: "log_span_save",
        log_id: "log_span_save",
        timestamp: "2026-03-12T09:59:57.000Z",
        record_kind: "span",
        event_key: "checkout.save",
        event_version: "001",
        service_name: "checkout-api",
        span_name: "persist_order",
        start_time: "2026-03-12T09:59:56.000Z",
        end_time: "2026-03-12T09:59:57.000Z",
        status_code: "ok",
        payload: { orderId: "order_1" },
        payload_masking_applied: false,
        payload_masked_fields: [],
      },
      {
        id: "log_user_input",
        log_id: "log_user_input",
        timestamp: "2026-03-12T09:59:58.000Z",
        record_kind: "log",
        event_key: "checkout.form.updated",
        event_version: "001",
        service_name: "checkout-api",
        span_name: undefined,
        start_time: undefined,
        end_time: undefined,
        status_code: undefined,
        payload: { field: "email" },
        payload_masking_applied: false,
        payload_masked_fields: [],
      },
      {
        id: "log_async_note",
        log_id: "log_async_note",
        timestamp: "2026-03-12T09:59:59.000Z",
        record_kind: "log",
        event_key: "checkout.audit",
        event_version: "001",
        service_name: "checkout-api",
        span_name: undefined,
        start_time: undefined,
        end_time: undefined,
        status_code: undefined,
        payload: { step: "queued" },
        payload_masking_applied: false,
        payload_masked_fields: [],
      },
    ],
    edges: [
      {
        source: "log_user_input",
        target: "log_span_save",
        type: "parent_child",
      },
      {
        source: "log_user_input",
        target: "log_async_note",
        type: "temporal",
      },
    ],
  };
}

function buildExpectedBackgroundGraph(): RuntimeGraph {
  return {
    trace_id: "trace_background",
    nodes: [
      {
        id: "log_background",
        log_id: "log_background",
        timestamp: "2026-03-12T10:00:00.000Z",
        record_kind: "log",
        event_key: "worker.dispatched",
        event_version: "001",
        service_name: "checkout-api",
        span_name: undefined,
        start_time: undefined,
        end_time: undefined,
        status_code: undefined,
        payload: { queue: "reconciliation" },
        payload_masking_applied: false,
        payload_masked_fields: [],
      },
    ],
    edges: [],
  };
}

function buildScenarioSpec(
  overrides: Partial<ScenarioSpec> = {},
): ScenarioSpec {
  return {
    scenario_id: "scenario_checkout",
    version: "1.0.0",
    domain: "checkout",
    steps: [
      {
        id: "step_checkout_updated",
        event_key: "checkout.form.updated",
        required: true,
        kind: "sequence",
        next: ["step_checkout_save"],
      },
      {
        id: "step_checkout_save",
        event_key: "checkout.save",
        required: true,
        kind: "sequence",
      },
    ],
    ...overrides,
  };
}

function getTransmissions(
  store: InMemoryTransmissionStore,
): Map<string, TransmissionInsert> {
  return Reflect.get(store, "transmissions") as Map<string, TransmissionInsert>;
}

function createFailingRecordStore(
  backingStore: InMemoryRecordStore,
  failingLogId: string,
): RecordStore {
  return {
    async insertBatch(records) {
      if (records.some((record) => record.logId === failingLogId)) {
        throw new Error(`invalid record: ${failingLogId}`);
      }

      await backingStore.insertBatch(records);
    },
    findByTraceId(traceId) {
      return backingStore.findByTraceId(traceId);
    },
    findByTraceIdPaginated(traceId, params) {
      return backingStore.findByTraceIdPaginated(traceId, params);
    },
    findBySessionId(sessionId) {
      return backingStore.findBySessionId(sessionId);
    },
    findBySessionIdPaginated(sessionId, params) {
      return backingStore.findBySessionIdPaginated(sessionId, params);
    },
    findByTraceAndEventKey(traceId, eventKey) {
      return backingStore.findByTraceAndEventKey(traceId, eventKey);
    },
  };
}

function createInMemoryTraceTransaction(
  stores: {
    recordStore: InMemoryRecordStore;
    traceStore: InMemoryTraceStore;
    sessionStore: InMemorySessionStore;
  },
  transactionStores: TracePersistenceStores,
): TraceTransactionRunner {
  return async (fn) => {
    const recordsSnapshot = structuredClone(
      Reflect.get(stores.recordStore, "records") as Map<string, unknown>,
    );
    const tracesSnapshot = structuredClone(
      Reflect.get(stores.traceStore, "traces") as Map<string, unknown>,
    );
    const sessionsSnapshot = structuredClone(
      Reflect.get(stores.sessionStore, "sessions") as Map<string, unknown>,
    );

    try {
      return await fn(transactionStores);
    } catch (error) {
      Reflect.set(stores.recordStore, "records", recordsSnapshot);
      Reflect.set(stores.traceStore, "traces", tracesSnapshot);
      Reflect.set(stores.sessionStore, "sessions", sessionsSnapshot);
      throw error;
    }
  };
}

function buildStoredRecord(overrides: Partial<RecordInsert> = {}): RecordInsert {
  return {
    logId: "log_1",
    traceId: "trace_1",
    spanId: "span_1",
    timestamp: new Date("2026-03-12T09:59:58.000Z"),
    recordKind: "log",
    eventKey: "event.one",
    eventVersion: "001",
    payloadFormat: "json",
    payloadEncoding: "raw",
    payloadMaskingApplied: false,
    payloadMaskedFields: [],
    payload: { ok: true },
    qaSessionId: "session_1",
    ...overrides,
  };
}

function buildEnvelopeWithRecords(
  records: TransmissionEnvelope["records"],
): TransmissionEnvelope {
  return {
    ...buildEnvelope(),
    transmission_id: "tx_stream",
    records,
  };
}

interface SseCommentFrame {
  type: "comment";
  comment: string;
}

interface SseRecordEvent {
  type: "event";
  event: string | null;
  data: {
    logId: string;
    traceId: string;
    qaSessionId?: string;
    timestamp: string;
    createdAt: string;
    [key: string]: unknown;
  };
}

type SseFrame = SseCommentFrame | SseRecordEvent;

function createSseClient(response: Response) {
  if (!response.body) {
    throw new Error("expected SSE response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const nextFrame = async (): Promise<SseFrame> => {
    while (true) {
      const delimiterIndex = buffer.indexOf("\n\n");

      if (delimiterIndex >= 0) {
        const rawEvent = buffer.slice(0, delimiterIndex);
        buffer = buffer.slice(delimiterIndex + 2);

        if (rawEvent.length === 0) {
          continue;
        }

        return parseSseFrame(rawEvent);
      }

      const { done, value } = await reader.read();

      if (done) {
        throw new Error("SSE stream closed before the next event arrived");
      }

      buffer += decoder.decode(value, { stream: true });
    }
  };

  return {
    async nextComment(): Promise<SseCommentFrame> {
      while (true) {
        const frame = await nextFrame();

        if (frame.type === "comment") {
          return frame;
        }
      }
    },
    async nextRecordEvent(): Promise<SseRecordEvent> {
      while (true) {
        const frame = await nextFrame();

        if (frame.type === "event") {
          return frame;
        }
      }
    },
    async close() {
      await reader.cancel();
    },
  };
}

function parseSseFrame(rawEvent: string): SseFrame {
  const lines = rawEvent.split("\n");
  const commentLines: string[] = [];
  let event: string | null = null;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith(":")) {
      commentLines.push(line.slice(1).trimStart());
      continue;
    }

    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trimStart();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (commentLines.length > 0 && event === null && dataLines.length === 0) {
    return {
      type: "comment",
      comment: commentLines.join("\n"),
    };
  }

  return {
    type: "event",
    event,
    data: JSON.parse(dataLines.join("\n")) as SseRecordEvent["data"],
  };
}

async function expectNoEventBeforeIngest(eventPromise: Promise<unknown>) {
  const outcome = Promise.race([
    eventPromise.then(() => "event"),
    new Promise<"timeout">((resolve) => {
      setTimeout(() => resolve("timeout"), 1);
    }),
  ]);

  await vi.advanceTimersByTimeAsync(1);
  await expect(outcome).resolves.toBe("timeout");
}

describe("createApp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-12T10:05:00.000Z"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns detailed ok status from GET /health", async () => {
    const { app } = createTestApp({
      checkDbHealth: async () => ({
        connected: true,
        latencyMs: 0,
      }),
      getUptimeSeconds: () => 300,
    });

    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      version: "0.1.0",
      uptime_seconds: 300,
      db: {
        connected: true,
        latency_ms: 0,
      },
    });
  });

  it("rate limits POST /v1/ingest per forwarded client IP and returns rate limit headers", async () => {
    const { app } = createTestApp({
      rateLimitMaxRequests: 2,
      rateLimitWindowMs: 1_000,
    });
    const resetAt = Date.now() + 1_000;

    const firstResponse = await app.request("/v1/ingest", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      },
      body: JSON.stringify(buildEnvelopeWithSuffix("limit_a")),
    });

    expect(firstResponse.status).toBe(202);
    expect(firstResponse.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(firstResponse.headers.get("X-RateLimit-Remaining")).toBe("1");
    expect(firstResponse.headers.get("X-RateLimit-Reset")).toBe(
      String(resetAt),
    );

    const secondResponse = await app.request("/v1/ingest", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      },
      body: JSON.stringify(buildEnvelopeWithSuffix("limit_b")),
    });

    expect(secondResponse.status).toBe(202);
    expect(secondResponse.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(secondResponse.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(secondResponse.headers.get("X-RateLimit-Reset")).toBe(
      String(resetAt),
    );

    const limitedResponse = await app.request("/v1/ingest", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      },
      body: JSON.stringify(buildEnvelopeWithSuffix("limit_c")),
    });

    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(limitedResponse.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(limitedResponse.headers.get("X-RateLimit-Reset")).toBe(
      String(resetAt),
    );
    await expect(limitedResponse.json()).resolves.toEqual({
      error: {
        code: "RATE_LIMITED",
        message:
          "rate limit exceeded for POST /v1/ingest (max 2 requests per 1000ms window)",
        retryAfterMs: 1_000,
      },
    });

    const otherClientResponse = await app.request("/v1/ingest", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.24",
      },
      body: JSON.stringify(buildEnvelopeWithSuffix("limit_d")),
    });

    expect(otherClientResponse.status).toBe(202);
    expect(otherClientResponse.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(otherClientResponse.headers.get("X-RateLimit-Remaining")).toBe("1");
    expect(otherClientResponse.headers.get("X-RateLimit-Reset")).toBe(
      String(resetAt),
    );
  });

  it("allows POST /v1/ingest again after the sliding window elapses", async () => {
    const { app } = createTestApp({
      rateLimitMaxRequests: 1,
      rateLimitWindowMs: 1_000,
    });

    const firstResponse = await app.request("/v1/ingest", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.50",
      },
      body: JSON.stringify(buildEnvelopeWithSuffix("window_a")),
    });

    expect(firstResponse.status).toBe(202);
    expect(firstResponse.headers.get("X-RateLimit-Remaining")).toBe("0");

    const limitedResponse = await app.request("/v1/ingest", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.50",
      },
      body: JSON.stringify(buildEnvelopeWithSuffix("window_b")),
    });

    expect(limitedResponse.status).toBe(429);
    await expect(limitedResponse.json()).resolves.toEqual({
      error: {
        code: "RATE_LIMITED",
        message:
          "rate limit exceeded for POST /v1/ingest (max 1 requests per 1000ms window)",
        retryAfterMs: 1_000,
      },
    });

    await vi.advanceTimersByTimeAsync(1_000);

    const reopenedResponse = await app.request("/v1/ingest", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.50",
      },
      body: JSON.stringify(buildEnvelopeWithSuffix("window_c")),
    });

    expect(reopenedResponse.status).toBe(202);
    expect(reopenedResponse.headers.get("X-RateLimit-Limit")).toBe("1");
    expect(reopenedResponse.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(reopenedResponse.headers.get("X-RateLimit-Reset")).toBe(
      String(Date.now() + 1_000),
    );
  });

  it("accepts a valid envelope and stores transmission, traces, records, sessions, and runtime graphs", async () => {
    const {
      app,
      graphStore,
      recordStore,
      traceStore,
      transmissionStore,
      sessionStore,
    } = createTestApp();
    const envelope = buildEnvelope();

    const response = await app.request("/v1/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(envelope),
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      record_count: 4,
    });

    expect(getTransmissions(transmissionStore).get("tx_1")).toEqual({
      transmissionId: "tx_1",
      sentAt: new Date("2026-03-12T10:00:05.000Z"),
      ownerType: "workspace",
      ownerId: "workspace_1",
      serviceName: "checkout-api",
      sdkName: "qa-sdk-js",
      sdkVersion: "0.1.0",
      platform: "node",
      env: "staging",
      recordCount: 4,
    });

    await expect(traceStore.findById("trace_checkout")).resolves.toEqual(
      expect.objectContaining({
        traceId: "trace_checkout",
        sessionId: "session_1",
        serviceName: "checkout-api",
        recordCount: 3,
        firstTimestamp: new Date("2026-03-12T09:59:57.000Z"),
        lastTimestamp: new Date("2026-03-12T09:59:59.000Z"),
        reconstructed: true,
      }),
    );
    await expect(traceStore.findById("trace_background")).resolves.toEqual(
      expect.objectContaining({
        traceId: "trace_background",
        sessionId: null,
        serviceName: "checkout-api",
        recordCount: 1,
        firstTimestamp: new Date("2026-03-12T10:00:00.000Z"),
        lastTimestamp: new Date("2026-03-12T10:00:00.000Z"),
        reconstructed: true,
      }),
    );

    const checkoutRecords = await recordStore.findByTraceId("trace_checkout");

    expect(checkoutRecords.map((record) => record.logId)).toEqual([
      "log_span_save",
      "log_user_input",
      "log_async_note",
    ]);
    expect(checkoutRecords.map((record) => record.qaSessionId ?? null)).toEqual([
      null,
      "session_1",
      "session_2",
    ]);

    await expect(recordStore.findByTraceId("trace_background")).resolves.toEqual([
      expect.objectContaining({
        logId: "log_background",
        traceId: "trace_background",
      }),
    ]);

    await expect(sessionStore.findById("session_1")).resolves.toEqual(
      expect.objectContaining({
        sessionId: "session_1",
        closedAt: null,
        startedAt: new Date("2026-03-12T10:05:00.000Z"),
      }),
    );
    await expect(sessionStore.findById("session_2")).resolves.toEqual(
      expect.objectContaining({
        sessionId: "session_2",
        closedAt: null,
        startedAt: new Date("2026-03-12T10:05:00.000Z"),
      }),
    );

    await expect(graphStore.findByTraceId("trace_checkout")).resolves.toEqual(
      buildExpectedCheckoutGraph(),
    );
    await expect(graphStore.findByTraceId("trace_background")).resolves.toEqual(
      buildExpectedBackgroundGraph(),
    );

    const checkoutGraphResponse = await app.request(
      "/v1/traces/trace_checkout/graph",
    );

    expect(checkoutGraphResponse.status).toBe(200);
    await expect(checkoutGraphResponse.json()).resolves.toEqual({
      ...buildExpectedCheckoutGraph(),
      nodeCount: 3,
      edgeCount: 2,
    });

    const backgroundGraphResponse = await app.request(
      "/v1/traces/trace_background/graph",
    );

    expect(backgroundGraphResponse.status).toBe(200);
    await expect(backgroundGraphResponse.json()).resolves.toEqual({
      ...buildExpectedBackgroundGraph(),
      nodeCount: 1,
      edgeCount: 0,
    });
  });

  it("accepts registry-validated events without attaching warnings", async () => {
    const registryValidator: RegistryEventValidator = {
      validateEvent: vi.fn(async () => ({ valid: true })),
    };
    const { app, recordStore } = createTestApp({
      registryValidationMode: "warn",
      registryValidator,
    });

    const response = await app.request("/v1/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildEnvelope()),
    });

    expect(response.status).toBe(202);
    expect(registryValidator.validateEvent).toHaveBeenCalledTimes(4);

    const checkoutRecords = await recordStore.findByTraceId("trace_checkout");
    expect(checkoutRecords.every((record) => record.registryWarning === undefined)).toBe(
      true,
    );
  });

  it("stores unregistered events with _registry_warning in warn mode", async () => {
    const warningReason = "event 'checkout.audit' version '001' not found";
    const registryValidator: RegistryEventValidator = {
      validateEvent: vi.fn(async (_serviceName, eventKey) =>
        eventKey === "checkout.audit"
          ? { valid: false, reason: warningReason }
          : { valid: true },
      ),
    };
    const { app, recordStore } = createTestApp({
      registryValidationMode: "warn",
      registryValidator,
    });

    const response = await app.request("/v1/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildEnvelope()),
    });

    expect(response.status).toBe(202);

    const checkoutRecords = await recordStore.findByTraceId("trace_checkout");
    expect(
      checkoutRecords.find((record) => record.logId === "log_async_note")
        ?.registryWarning,
    ).toBe(warningReason);
    expect(
      checkoutRecords
        .filter((record) => record.logId !== "log_async_note")
        .every((record) => record.registryWarning === undefined),
    ).toBe(true);

    const recordsResponse = await app.request("/v1/traces/trace_checkout/records");
    const body = (await recordsResponse.json()) as {
      items: Array<{ log_id: string; _registry_warning?: string }>;
    };

    expect(recordsResponse.status).toBe(200);
    expect(
      body.items.find((record) => record.log_id === "log_async_note")
        ?._registry_warning,
    ).toBe(warningReason);
  });

  it("rejects unregistered events in strict mode before persisting the envelope", async () => {
    const { app, recordStore, traceStore, transmissionStore } = createTestApp({
      registryValidationMode: "strict",
      registryValidator: {
        validateEvent: vi.fn(async (_serviceName, eventKey) =>
          eventKey === "checkout.audit"
            ? {
                valid: false,
                reason: "event 'checkout.audit' version '001' not found",
              }
            : { valid: true },
        ),
      },
    });

    const response = await app.request("/v1/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildEnvelope()),
    });
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_INPUT");
    expect(body.error.message).toContain("checkout.audit@001");
    expect(getTransmissions(transmissionStore).size).toBe(0);
    await expect(recordStore.findByTraceId("trace_checkout")).resolves.toEqual([]);
    await expect(traceStore.findById("trace_checkout")).resolves.toBeNull();
  });

  it("fails open when registry validation throws and logs a warning", async () => {
    const logger = createNoopLogger();
    const warnSpy = vi.spyOn(logger, "warn");
    const registryValidator: RegistryEventValidator = {
      validateEvent: vi.fn(async () => {
        throw new Error("connect ECONNREFUSED");
      }),
    };
    const { app, recordStore } = createTestApp({
      logger,
      registryValidationMode: "warn",
      registryValidator,
    });

    const response = await app.request("/v1/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildEnvelope()),
    });

    expect(response.status).toBe(202);
    expect(warnSpy).toHaveBeenCalled();

    const checkoutRecords = await recordStore.findByTraceId("trace_checkout");
    expect(checkoutRecords.every((record) => record.registryWarning === undefined)).toBe(
      true,
    );
  });

  it("returns 400 for an invalid envelope without persisting data", async () => {
    const {
      app,
      graphStore,
      recordStore,
      traceStore,
      transmissionStore,
      sessionStore,
    } = createTestApp();
    const { transmission_id: _omittedTransmissionId, ...invalidEnvelope } =
      buildEnvelope();

    const response = await app.request("/v1/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(invalidEnvelope),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "INVALID_INPUT",
        }),
      }),
    );
    expect(getTransmissions(transmissionStore).size).toBe(0);
    await expect(recordStore.findByTraceId("trace_checkout")).resolves.toEqual(
      [],
    );
    await expect(graphStore.findByTraceId("trace_checkout")).resolves.toBeNull();
    await expect(traceStore.findById("trace_checkout")).resolves.toBeNull();
    await expect(sessionStore.findById("session_1")).resolves.toBeNull();
  });

  it("stores valid traces and rolls back only the invalid trace when trace transactions are enabled", async () => {
    const backingRecordStore = new InMemoryRecordStore();
    const traceStore = new InMemoryTraceStore();
    const sessionStore = new InMemorySessionStore();
    const recordStore = createFailingRecordStore(backingRecordStore, "log_invalid");
    const withTraceTransaction = createInMemoryTraceTransaction(
      {
        recordStore: backingRecordStore,
        traceStore,
        sessionStore,
      },
      {
        recordStore,
        traceStore,
        sessionStore,
      },
    );
    const { app, graphStore, transmissionStore } = createTestApp({
      recordStore,
      traceStore,
      sessionStore,
      withTraceTransaction,
    });
    const envelope = buildEnvelope();

    envelope.records.unshift({
      log_id: "log_invalid",
      timestamp: "2026-03-12T09:59:55.000Z",
      record_kind: "log",
      trace_id: "trace_invalid",
      span_id: "span_invalid",
      event_key: "checkout.invalid",
      event_version: "001",
      payload_format: "json",
      payload_encoding: "raw",
      payload_masking_applied: false,
      payload_masked_fields: [],
      payload: { ok: false },
      qa_session_id: "session_invalid",
    });

    const response = await app.request("/v1/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(envelope),
    });

    expect(response.status).toBe(202);
    expect(getTransmissions(transmissionStore).size).toBe(1);
    await expect(backingRecordStore.findByTraceId("trace_invalid")).resolves.toEqual(
      [],
    );
    await expect(traceStore.findById("trace_invalid")).resolves.toBeNull();
    await expect(sessionStore.findById("session_invalid")).resolves.toBeNull();

    await expect(
      backingRecordStore.findByTraceId("trace_checkout"),
    ).resolves.toHaveLength(3);
    await expect(
      backingRecordStore.findByTraceId("trace_background"),
    ).resolves.toHaveLength(1);
    await expect(traceStore.findById("trace_checkout")).resolves.toEqual(
      expect.objectContaining({
        traceId: "trace_checkout",
        recordCount: 3,
      }),
    );
    await expect(traceStore.findById("trace_background")).resolves.toEqual(
      expect.objectContaining({
        traceId: "trace_background",
        recordCount: 1,
      }),
    );
    await expect(sessionStore.findById("session_1")).resolves.toEqual(
      expect.objectContaining({
        sessionId: "session_1",
      }),
    );
    await expect(sessionStore.findById("session_2")).resolves.toEqual(
      expect.objectContaining({
        sessionId: "session_2",
      }),
    );
    await expect(graphStore.findByTraceId("trace_checkout")).resolves.toEqual(
      buildExpectedCheckoutGraph(),
    );
    await expect(graphStore.findByTraceId("trace_background")).resolves.toEqual(
      buildExpectedBackgroundGraph(),
    );
    await expect(graphStore.findByTraceId("trace_invalid")).resolves.toBeNull();
  });

  it("logs reconstruction failures and continues processing later unreconstructed traces", async () => {
    const backingGraphStore = new InMemoryGraphStore();
    const graphStore: GraphStore = {
      async upsert(traceId, graph) {
        if (traceId === "trace_checkout") {
          throw new Error("boom");
        }

        await backingGraphStore.upsert(traceId, graph);
      },
      findByTraceId(traceId) {
        return backingGraphStore.findByTraceId(traceId);
      },
    };
    const logger = {
      error: vi.fn(),
    } as unknown as Logger;
    const { app, traceStore } = createTestApp({
      graphStore,
      logger,
    });

    const response = await app.request("/v1/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildEnvelope()),
    });

    expect(response.status).toBe(202);
    expect(logger.error).toHaveBeenCalledWith(
      {
        err: expect.any(Error),
        traceId: "trace_checkout",
      },
      "failed to reconstruct trace",
    );

    await expect(traceStore.findById("trace_checkout")).resolves.toEqual(
      expect.objectContaining({
        traceId: "trace_checkout",
        reconstructed: false,
      }),
    );
    await expect(traceStore.findById("trace_background")).resolves.toEqual(
      expect.objectContaining({
        traceId: "trace_background",
        reconstructed: true,
      }),
    );

    await expect(graphStore.findByTraceId("trace_checkout")).resolves.toBeNull();
    await expect(graphStore.findByTraceId("trace_background")).resolves.toEqual(
      buildExpectedBackgroundGraph(),
    );
  });

  it("stores reconstruction failures in the dlq and retries them successfully", async () => {
    const backingGraphStore = new InMemoryGraphStore();
    let shouldFail = true;
    const graphStore: GraphStore = {
      async upsert(traceId, graph) {
        if (traceId === "trace_checkout" && shouldFail) {
          throw new Error("reconstruction boom");
        }

        await backingGraphStore.upsert(traceId, graph);
      },
      findByTraceId(traceId) {
        return backingGraphStore.findByTraceId(traceId);
      },
    };
    const { app, dlqStore, traceStore } = createTestApp({
      graphStore,
    });

    const ingestResponse = await app.request("/v1/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildEnvelope()),
    });

    expect(ingestResponse.status).toBe(202);

    const listedPendingResponse = await app.request(
      "/v1/admin/dlq?status=pending&limit=10",
    );
    expect(listedPendingResponse.status).toBe(200);
    await expect(listedPendingResponse.json()).resolves.toEqual({
      items: [
        expect.objectContaining({
          traceId: "trace_checkout",
          phase: "reconstruction",
          errorMessage: "reconstruction boom",
          attemptCount: 0,
          lastAttemptedAt: null,
        }),
      ],
    });

    await expect(dlqStore.findPending()).resolves.toHaveLength(1);
    await expect(traceStore.findById("trace_checkout")).resolves.toEqual(
      expect.objectContaining({
        traceId: "trace_checkout",
        reconstructed: false,
      }),
    );

    shouldFail = false;

    const retryResponse = await app.request("/v1/admin/dlq/retry", {
      method: "POST",
    });

    expect(retryResponse.status).toBe(200);
    await expect(retryResponse.json()).resolves.toEqual({
      total: 1,
      resolved: [expect.any(String)],
      failed: [],
      skipped: [],
    });

    await expect(dlqStore.findPending()).resolves.toEqual([]);
    await expect(traceStore.findById("trace_checkout")).resolves.toEqual(
      expect.objectContaining({
        traceId: "trace_checkout",
        reconstructed: true,
      }),
    );
    await expect(graphStore.findByTraceId("trace_checkout")).resolves.toEqual(
      buildExpectedCheckoutGraph(),
    );
  });

  it("stores verdict failures in the dlq", async () => {
    const backingVerdictStore = new InMemoryVerdictStore();
    const verdictStore: VerdictStore = {
      async insert(params) {
        if (params.traceId === "trace_checkout") {
          throw new Error("verdict boom");
        }

        await backingVerdictStore.insert(params);
      },
      removeByScenarioAndTrace(scenarioId, traceId) {
        return backingVerdictStore.removeByScenarioAndTrace(scenarioId, traceId);
      },
      findByScenarioAndTrace(scenarioId, traceId) {
        return backingVerdictStore.findByScenarioAndTrace(scenarioId, traceId);
      },
      findByTraceId(traceId) {
        return backingVerdictStore.findByTraceId(traceId);
      },
      findBySessionId(sessionId) {
        return backingVerdictStore.findBySessionId(sessionId);
      },
    };
    const logger = {
      error: vi.fn(),
    } as unknown as Logger;
    const { app, dlqStore, scenarioSpecStore, sessionStore, traceStore } =
      createTestApp({
        verdictStore,
        logger,
      });

    await sessionStore.upsert({
      sessionId: "session_1",
      scenarioId: "scenario_checkout",
    });
    await scenarioSpecStore.upsert(buildScenarioSpec());

    const response = await app.request("/v1/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildEnvelope()),
    });

    expect(response.status).toBe(202);
    expect(logger.error).toHaveBeenCalledWith(
      {
        err: expect.any(Error),
        traceId: "trace_checkout",
      },
      "failed to compute verdict",
    );

    await expect(traceStore.findById("trace_checkout")).resolves.toEqual(
      expect.objectContaining({
        traceId: "trace_checkout",
        reconstructed: true,
      }),
    );
    await expect(dlqStore.findPending()).resolves.toEqual([
      expect.objectContaining({
        traceId: "trace_checkout",
        phase: "verdict",
        errorMessage: "verdict boom",
      }),
    ]);
  });

  it("skips retrying dlq items that exceeded the max retry attempts", async () => {
    const logger = {
      warn: vi.fn(),
    } as unknown as Logger;
    const { app, dlqStore } = createTestApp({
      dlqMaxRetryAttempts: 1,
      logger,
    });

    await dlqStore.insert({
      id: "dlq_maxed",
      traceId: "trace_checkout",
      phase: "verdict",
      errorMessage: "still failing",
    });
    await dlqStore.markAttempted("dlq_maxed");

    const response = await app.request("/v1/admin/dlq/retry", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      total: 1,
      resolved: [],
      failed: [],
      skipped: ["dlq_maxed"],
    });
    expect(logger.warn).toHaveBeenCalledWith(
      {
        dlqId: "dlq_maxed",
        traceId: "trace_checkout",
        phase: "verdict",
        attemptCount: 1,
        maxRetryAttempts: 1,
      },
      "skipping dlq item after max retry attempts",
    );
  });

  it("returns trace and session metadata plus paginated records", async () => {
    const { app, recordStore, traceStore, sessionStore } = createTestApp();

    await sessionStore.upsert({ sessionId: "session_1" });
    await traceStore.upsert({
      traceId: "trace_1",
      sessionId: "session_1",
      serviceName: "checkout-api",
      recordCount: 3,
      firstTimestamp: new Date("2026-03-12T09:59:57.000Z"),
      lastTimestamp: new Date("2026-03-12T09:59:59.000Z"),
    });
    await traceStore.upsert({
      traceId: "trace_2",
      sessionId: "session_1",
      serviceName: "checkout-api",
      recordCount: 1,
      firstTimestamp: new Date("2026-03-12T10:00:00.000Z"),
      lastTimestamp: new Date("2026-03-12T10:00:00.000Z"),
    });
    await recordStore.insertBatch([
      buildStoredRecord({
        logId: "log_2",
        traceId: "trace_1",
        timestamp: new Date("2026-03-12T09:59:57.000Z"),
        eventKey: "checkout.started",
      }),
      buildStoredRecord({
        logId: "log_1",
        traceId: "trace_1",
        timestamp: new Date("2026-03-12T09:59:58.000Z"),
        eventKey: "checkout.validated",
      }),
      buildStoredRecord({
        logId: "log_3",
        traceId: "trace_1",
        timestamp: new Date("2026-03-12T09:59:59.000Z"),
        eventKey: "checkout.completed",
        spanId: "span_2",
      }),
      buildStoredRecord({
        logId: "log_4",
        traceId: "trace_2",
        timestamp: new Date("2026-03-12T10:00:00.000Z"),
        eventKey: "checkout.followup",
        spanId: "span_3",
      }),
    ]);

    const traceResponse = await app.request("/v1/traces/trace_1");

    expect(traceResponse.status).toBe(200);
    await expect(traceResponse.json()).resolves.toEqual({
      traceId: "trace_1",
      sessionId: "session_1",
      serviceName: "checkout-api",
      actorId: null,
      userId: null,
      userAttributes: null,
      recordCount: 3,
      firstTimestamp: "2026-03-12T09:59:57.000Z",
      lastTimestamp: "2026-03-12T09:59:59.000Z",
      reconstructed: false,
    });

    const traceRecordsPageOne = await app.request(
      "/v1/traces/trace_1/records?limit=2",
    );
    const traceRecordsPageOneBody = (await traceRecordsPageOne.json()) as {
      items: Array<{ log_id: string }>;
      next_cursor: string | null;
      has_more: boolean;
    };

    expect(traceRecordsPageOne.status).toBe(200);
    expect(traceRecordsPageOneBody.items.map((record) => record.log_id)).toEqual([
      "log_2",
      "log_1",
    ]);
    expect(traceRecordsPageOneBody.has_more).toBe(true);
    expect(traceRecordsPageOneBody.next_cursor).toEqual(expect.any(String));

    const traceRecordsPageTwo = await app.request(
      `/v1/traces/trace_1/records?limit=2&cursor=${encodeURIComponent(traceRecordsPageOneBody.next_cursor!)}`,
    );

    await expect(traceRecordsPageTwo.json()).resolves.toEqual({
      items: [
        expect.objectContaining({
          log_id: "log_3",
          trace_id: "trace_1",
          qa_session_id: "session_1",
        }),
      ],
      next_cursor: null,
      has_more: false,
    });

    const sessionResponse = await app.request("/v1/sessions/session_1");

    expect(sessionResponse.status).toBe(200);
    await expect(sessionResponse.json()).resolves.toEqual({
      sessionId: "session_1",
      scenarioId: null,
      labels: null,
      actorId: null,
      userId: null,
      userAttributes: null,
      startedAt: "2026-03-12T10:05:00.000Z",
      closedAt: null,
    });

    const sessionRecordsResponse = await app.request(
      "/v1/sessions/session_1/records?limit=2",
    );
    const sessionRecordsBody = (await sessionRecordsResponse.json()) as {
      items: Array<{ log_id: string }>;
      next_cursor: string | null;
      has_more: boolean;
    };

    expect(sessionRecordsResponse.status).toBe(200);
    expect(sessionRecordsBody.items.map((record) => record.log_id)).toEqual([
      "log_2",
      "log_1",
    ]);
    expect(sessionRecordsBody.has_more).toBe(true);
    expect(sessionRecordsBody.next_cursor).toEqual(expect.any(String));

    const sessionRecordsPageTwo = await app.request(
      `/v1/sessions/session_1/records?limit=2&cursor=${encodeURIComponent(sessionRecordsBody.next_cursor!)}`,
    );

    await expect(sessionRecordsPageTwo.json()).resolves.toEqual({
      items: [
        expect.objectContaining({ log_id: "log_3", trace_id: "trace_1" }),
        expect.objectContaining({ log_id: "log_4", trace_id: "trace_2" }),
      ],
      next_cursor: null,
      has_more: false,
    });
  });

  it("returns 404 when a trace has not been reconstructed yet", async () => {
    const { app, traceStore } = createTestApp();

    await traceStore.upsert({
      traceId: "trace_pending",
      sessionId: "session_pending",
      serviceName: "checkout-api",
      recordCount: 1,
      firstTimestamp: new Date("2026-03-12T09:59:57.000Z"),
      lastTimestamp: new Date("2026-03-12T09:59:57.000Z"),
    });

    const response = await app.request("/v1/traces/trace_pending/graph");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "GRAPH_NOT_FOUND",
        message: "runtime graph for trace 'trace_pending' not found",
      },
    });
  });

  it("uses default pagination size 50 and caps limit at 200", async () => {
    const { app, recordStore, traceStore, sessionStore } = createTestApp();
    const records = Array.from({ length: 205 }, (_, index) =>
      buildStoredRecord({
        logId: `bulk_${String(index + 1).padStart(3, "0")}`,
        traceId: "trace_bulk",
        timestamp: new Date(
          Date.parse("2026-03-12T09:00:00.000Z") + index * 1000,
        ),
        eventKey: `bulk.event.${index + 1}`,
        spanId: `span_${index + 1}`,
        qaSessionId: "session_bulk",
      }),
    );

    await sessionStore.upsert({ sessionId: "session_bulk" });
    await traceStore.upsert({
      traceId: "trace_bulk",
      sessionId: "session_bulk",
      serviceName: "checkout-api",
      recordCount: records.length,
      firstTimestamp: records[0]!.timestamp,
      lastTimestamp: records.at(-1)!.timestamp,
    });
    await recordStore.insertBatch(records);

    const defaultLimitResponse = await app.request("/v1/traces/trace_bulk/records");
    const defaultLimitBody = (await defaultLimitResponse.json()) as {
      items: Array<{ log_id: string }>;
      next_cursor: string | null;
      has_more: boolean;
    };

    expect(defaultLimitResponse.status).toBe(200);
    expect(defaultLimitBody.items).toHaveLength(50);
    expect(defaultLimitBody.items[0]).toEqual(
      expect.objectContaining({ log_id: "bulk_001" }),
    );
    expect(defaultLimitBody.items.at(-1)).toEqual(
      expect.objectContaining({ log_id: "bulk_050" }),
    );
    expect(defaultLimitBody.has_more).toBe(true);
    expect(defaultLimitBody.next_cursor).toEqual(expect.any(String));

    const cappedLimitResponse = await app.request(
      "/v1/traces/trace_bulk/records?limit=999",
    );
    const cappedLimitBody = (await cappedLimitResponse.json()) as {
      items: Array<{ log_id: string }>;
      next_cursor: string | null;
      has_more: boolean;
    };

    expect(cappedLimitResponse.status).toBe(200);
    expect(cappedLimitBody.items).toHaveLength(200);
    expect(cappedLimitBody.items.at(-1)).toEqual(
      expect.objectContaining({ log_id: "bulk_200" }),
    );
    expect(cappedLimitBody.has_more).toBe(true);
    expect(cappedLimitBody.next_cursor).toEqual(expect.any(String));
  });

  it("round-trips ingested records through the debug store recent endpoints", async () => {
    const { app } = createTestApp({
      debugStore: new InMemoryDebugStore({ ttlMs: 60_000 }),
    });

    const response = await app.request("/v1/ingest", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(
        buildEnvelopeWithRecords([
          {
            log_id: "log_debug_1",
            timestamp: "2026-03-12T10:00:00.000Z",
            record_kind: "log",
            trace_id: "trace_debug",
            span_id: "span_debug_1",
            event_key: "debug.one",
            event_version: "001",
            payload_format: "json",
            payload_encoding: "raw",
            payload_masking_applied: false,
            payload_masked_fields: [],
            payload: { order: 1 },
            qa_session_id: "session_debug",
          },
          {
            log_id: "log_debug_2",
            timestamp: "2026-03-12T10:00:02.000Z",
            record_kind: "log",
            trace_id: "trace_debug",
            span_id: "span_debug_2",
            event_key: "debug.two",
            event_version: "001",
            payload_format: "json",
            payload_encoding: "raw",
            payload_masking_applied: false,
            payload_masked_fields: [],
            payload: { order: 2 },
            qa_session_id: "session_debug",
          },
          {
            log_id: "log_debug_3",
            timestamp: "2026-03-12T10:00:01.000Z",
            record_kind: "log",
            trace_id: "trace_debug",
            span_id: "span_debug_3",
            event_key: "debug.three",
            event_version: "001",
            payload_format: "json",
            payload_encoding: "raw",
            payload_masking_applied: false,
            payload_masked_fields: [],
            payload: { order: 3 },
            qa_session_id: "session_debug",
          },
        ]),
      ),
    });

    expect(response.status).toBe(202);

    const traceRecentResponse = await app.request(
      "/v1/debug/traces/trace_debug/recent?limit=2",
    );
    const sessionRecentResponse = await app.request(
      "/v1/debug/sessions/session_debug/recent?limit=2",
    );

    await expect(traceRecentResponse.json()).resolves.toEqual({
      items: [
        expect.objectContaining({ log_id: "log_debug_2", trace_id: "trace_debug" }),
        expect.objectContaining({ log_id: "log_debug_3", trace_id: "trace_debug" }),
      ],
    });
    await expect(sessionRecentResponse.json()).resolves.toEqual({
      items: [
        expect.objectContaining({
          log_id: "log_debug_2",
          qa_session_id: "session_debug",
        }),
        expect.objectContaining({
          log_id: "log_debug_3",
          qa_session_id: "session_debug",
        }),
      ],
    });
  });

  it("streams only newly ingested records to trace and session subscribers", async () => {
    const { app, recordStore } = createTestApp();

    await recordStore.insertBatch([
      buildStoredRecord({
        logId: "log_existing",
        traceId: "trace_live",
        qaSessionId: "session_live",
        timestamp: new Date("2026-03-12T09:59:50.000Z"),
      }),
    ]);

    const traceResponseA = await app.request("/v1/streams/traces/trace_live");
    const traceResponseB = await app.request("/v1/streams/traces/trace_live");
    const sessionResponse = await app.request(
      "/v1/streams/sessions/session_live",
    );

    expect(traceResponseA.status).toBe(200);
    expect(traceResponseA.headers.get("content-type")).toContain(
      "text/event-stream",
    );
    expect(traceResponseB.status).toBe(200);
    expect(sessionResponse.status).toBe(200);

    const traceClientA = createSseClient(traceResponseA);
    const traceClientB = createSseClient(traceResponseB);
    const sessionClient = createSseClient(sessionResponse);

    const traceEventAPromise = traceClientA.nextRecordEvent();
    const traceEventBPromise = traceClientB.nextRecordEvent();
    const sessionEventPromise = sessionClient.nextRecordEvent();

    await expectNoEventBeforeIngest(traceEventAPromise);
    await expectNoEventBeforeIngest(traceEventBPromise);
    await expectNoEventBeforeIngest(sessionEventPromise);

    const ingestResponse = await app.request("/v1/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        buildEnvelopeWithRecords([
          {
            log_id: "log_live",
            timestamp: "2026-03-12T10:00:06.000Z",
            record_kind: "log",
            trace_id: "trace_live",
            span_id: "span_live",
            event_key: "trace.live",
            event_version: "001",
            payload_format: "json",
            payload_encoding: "raw",
            payload_masking_applied: false,
            payload_masked_fields: [],
            payload: { live: true },
            qa_session_id: "session_live",
          },
        ]),
      ),
    });

    expect(ingestResponse.status).toBe(202);

    const [traceEventA, traceEventB, sessionEvent] = await Promise.all([
      traceEventAPromise,
      traceEventBPromise,
      sessionEventPromise,
    ]);

    expect(traceEventA).toEqual(
      expect.objectContaining({
        event: "record",
        data: expect.objectContaining({
          logId: "log_live",
          traceId: "trace_live",
          spanId: "span_live",
          timestamp: "2026-03-12T10:00:06.000Z",
          recordKind: "log",
          eventKey: "trace.live",
          eventVersion: "001",
          payloadFormat: "json",
          payloadEncoding: "raw",
          payloadMaskingApplied: false,
          payloadMaskedFields: [],
          payload: { live: true },
          qaSessionId: "session_live",
          createdAt: expect.any(String),
        }),
      }),
    );
    expect(new Date(traceEventA.data.createdAt).toISOString()).toBe(
      traceEventA.data.createdAt,
    );
    expect(traceEventA.data).not.toEqual(
      expect.objectContaining({
        logId: "log_existing",
      }),
    );
    expect(traceEventB).toEqual(traceEventA);
    expect(sessionEvent).toEqual(traceEventA);

    await Promise.all([
      traceClientA.close(),
      traceClientB.close(),
      sessionClient.close(),
    ]);
  });

  it("returns 429 when trace subscriptions exceed the default concurrent limit", async () => {
    const { app, recordStreamBroker } = createTestApp();
    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        app.request("/v1/streams/traces/trace_limited"),
      ),
    );

    responses.forEach((response) => {
      expect(response.status).toBe(200);
    });

    const clients = responses.map((response) => createSseClient(response));

    expect(recordStreamBroker.getTraceSubscriberCount("trace_limited")).toBe(10);

    const limitedResponse = await app.request("/v1/streams/traces/trace_limited");

    expect(limitedResponse.status).toBe(429);
    await expect(limitedResponse.json()).resolves.toEqual({
      error: {
        code: "TOO_MANY_SUBSCRIPTIONS",
        message:
          "too many active SSE subscriptions for trace 'trace_limited' (limit: 10)",
      },
    });

    await clients[0]!.close();
    await Promise.resolve();
    expect(recordStreamBroker.getTraceSubscriberCount("trace_limited")).toBe(9);

    const reopenedResponse = await app.request(
      "/v1/streams/traces/trace_limited",
    );

    expect(reopenedResponse.status).toBe(200);
    const reopenedClient = createSseClient(reopenedResponse);

    await Promise.all([
      reopenedClient.close(),
      ...clients.slice(1).map((client) => client.close()),
    ]);
  });

  it("uses the configured session subscription limit", async () => {
    const { app, recordStreamBroker } = createTestApp({
      streamSubscriptionLimit: 1,
    });

    const firstResponse = await app.request("/v1/streams/sessions/session_limited");

    expect(firstResponse.status).toBe(200);
    const firstClient = createSseClient(firstResponse);
    expect(recordStreamBroker.getSessionSubscriberCount("session_limited")).toBe(
      1,
    );

    const limitedResponse = await app.request(
      "/v1/streams/sessions/session_limited",
    );

    expect(limitedResponse.status).toBe(429);
    await expect(limitedResponse.json()).resolves.toEqual({
      error: {
        code: "TOO_MANY_SUBSCRIPTIONS",
        message:
          "too many active SSE subscriptions for session 'session_limited' (limit: 1)",
      },
    });

    await firstClient.close();
    await Promise.resolve();
    expect(recordStreamBroker.getSessionSubscriberCount("session_limited")).toBe(
      0,
    );

    const reopenedResponse = await app.request(
      "/v1/streams/sessions/session_limited",
    );

    expect(reopenedResponse.status).toBe(200);
    const reopenedClient = createSseClient(reopenedResponse);

    await reopenedClient.close();
  });

  it("sends heartbeat comments every 15 seconds without affecting record events", async () => {
    const { app } = createTestApp();

    const response = await app.request("/v1/streams/traces/trace_heartbeat");
    const client = createSseClient(response);

    const firstHeartbeatPromise = client.nextComment();
    let heartbeatResolved = false;
    void firstHeartbeatPromise.then(() => {
      heartbeatResolved = true;
    });

    await vi.advanceTimersByTimeAsync(14_999);
    await Promise.resolve();
    expect(heartbeatResolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(firstHeartbeatPromise).resolves.toEqual({
      type: "comment",
      comment: "heartbeat",
    });

    const secondHeartbeatPromise = client.nextComment();

    await vi.advanceTimersByTimeAsync(15_000);
    await expect(secondHeartbeatPromise).resolves.toEqual({
      type: "comment",
      comment: "heartbeat",
    });

    const recordEventPromise = client.nextRecordEvent();
    const ingestResponse = await app.request("/v1/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        buildEnvelopeWithRecords([
          {
            log_id: "log_heartbeat",
            timestamp: "2026-03-12T10:00:07.000Z",
            record_kind: "log",
            trace_id: "trace_heartbeat",
            span_id: "span_heartbeat",
            event_key: "trace.heartbeat",
            event_version: "001",
            payload_format: "json",
            payload_encoding: "raw",
            payload_masking_applied: false,
            payload_masked_fields: [],
            payload: { live: true },
          },
        ]),
      ),
    });

    expect(ingestResponse.status).toBe(202);
    await expect(recordEventPromise).resolves.toEqual(
      expect.objectContaining({
        type: "event",
        event: "record",
        data: expect.objectContaining({
          logId: "log_heartbeat",
          traceId: "trace_heartbeat",
          eventKey: "trace.heartbeat",
        }),
      }),
    );

    await client.close();
  });

  it("cleans up SSE subscriptions when clients disconnect", async () => {
    const { app, recordStreamBroker } = createTestApp();
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    const traceResponseA = await app.request("/v1/streams/traces/trace_cleanup");
    const traceResponseB = await app.request("/v1/streams/traces/trace_cleanup");
    const sessionResponse = await app.request(
      "/v1/streams/sessions/session_cleanup",
    );

    const traceClientA = createSseClient(traceResponseA);
    const traceClientB = createSseClient(traceResponseB);
    const sessionClient = createSseClient(sessionResponse);

    expect(setIntervalSpy).toHaveBeenCalledTimes(3);
    expect(recordStreamBroker.getTraceSubscriberCount("trace_cleanup")).toBe(2);
    expect(recordStreamBroker.getSessionSubscriberCount("session_cleanup")).toBe(1);

    await traceClientA.close();
    await Promise.resolve();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(recordStreamBroker.getTraceSubscriberCount("trace_cleanup")).toBe(1);

    await sessionClient.close();
    await Promise.resolve();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
    expect(recordStreamBroker.getSessionSubscriberCount("session_cleanup")).toBe(0);

    await traceClientB.close();
    await Promise.resolve();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(3);
    expect(recordStreamBroker.getTraceSubscriberCount("trace_cleanup")).toBe(0);
  });

  it("returns 404 for missing traces, missing graphs, and sessions", async () => {
    const { app } = createTestApp();

    const traceResponse = await app.request("/v1/traces/missing");
    const traceRecordsResponse = await app.request("/v1/traces/missing/records");
    const traceGraphResponse = await app.request("/v1/traces/missing/graph");
    const sessionResponse = await app.request("/v1/sessions/missing");
    const sessionRecordsResponse = await app.request(
      "/v1/sessions/missing/records",
    );

    expect(traceResponse.status).toBe(404);
    await expect(traceResponse.json()).resolves.toEqual({
      error: {
        code: "TRACE_NOT_FOUND",
        message: "trace 'missing' not found",
      },
    });

    expect(traceRecordsResponse.status).toBe(404);
    await expect(traceRecordsResponse.json()).resolves.toEqual({
      error: {
        code: "TRACE_NOT_FOUND",
        message: "trace 'missing' not found",
      },
    });

    expect(traceGraphResponse.status).toBe(404);
    await expect(traceGraphResponse.json()).resolves.toEqual({
      error: {
        code: "GRAPH_NOT_FOUND",
        message: "runtime graph for trace 'missing' not found",
      },
    });

    expect(sessionResponse.status).toBe(404);
    await expect(sessionResponse.json()).resolves.toEqual({
      error: {
        code: "SESSION_NOT_FOUND",
        message: "session 'missing' not found",
      },
    });

    expect(sessionRecordsResponse.status).toBe(404);
    await expect(sessionRecordsResponse.json()).resolves.toEqual({
      error: {
        code: "SESSION_NOT_FOUND",
        message: "session 'missing' not found",
      },
    });
  });

  // ── Scenario CRUD ──────────────────────────────────────

  it("creates, retrieves, lists, and deletes a scenario spec", async () => {
    const { app } = createTestApp();
    const spec: ScenarioSpec = {
      scenario_id: "checkout-happy-path",
      version: "1.0.0",
      domain: "checkout",
      description: "Basic checkout flow",
      steps: [
        {
          id: "step_form",
          event_key: "checkout.form.updated",
          required: true,
          kind: "sequence",
        },
        {
          id: "step_save",
          event_key: "checkout.save",
          required: true,
          kind: "sequence",
        },
      ],
    };

    const createResponse = await app.request("/v1/scenarios", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(spec),
    });

    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toEqual({
      accepted: true,
      scenario_id: "checkout-happy-path",
    });

    const getResponse = await app.request("/v1/scenarios/checkout-happy-path");

    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toEqual(spec);

    const listResponse = await app.request("/v1/scenarios");
    const listBody = (await listResponse.json()) as { items: ScenarioSpec[] };

    expect(listResponse.status).toBe(200);
    expect(listBody.items).toHaveLength(1);
    expect(listBody.items[0]!.scenario_id).toBe("checkout-happy-path");

    const domainListResponse = await app.request("/v1/scenarios?domain=checkout");
    const domainListBody = (await domainListResponse.json()) as { items: ScenarioSpec[] };

    expect(domainListBody.items).toHaveLength(1);

    const emptyDomainResponse = await app.request("/v1/scenarios?domain=payments");
    const emptyDomainBody = (await emptyDomainResponse.json()) as { items: ScenarioSpec[] };

    expect(emptyDomainBody.items).toHaveLength(0);

    const deleteResponse = await app.request("/v1/scenarios/checkout-happy-path", {
      method: "DELETE",
    });

    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toEqual({
      deleted: true,
      scenario_id: "checkout-happy-path",
    });

    const getAfterDelete = await app.request("/v1/scenarios/checkout-happy-path");

    expect(getAfterDelete.status).toBe(404);
  });

  it("returns 404 for missing scenario", async () => {
    const { app } = createTestApp();

    const response = await app.request("/v1/scenarios/nonexistent");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "SCENARIO_NOT_FOUND",
        message: "scenario 'nonexistent' not found",
      },
    });
  });

  it("upserts scenario spec on repeated create", async () => {
    const { app } = createTestApp();
    const spec: ScenarioSpec = {
      scenario_id: "checkout-v1",
      version: "1.0.0",
      domain: "checkout",
      steps: [
        { id: "s1", event_key: "checkout.start", required: true, kind: "sequence" },
      ],
    };

    await app.request("/v1/scenarios", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(spec),
    });

    const updatedSpec = { ...spec, version: "2.0.0" };

    await app.request("/v1/scenarios", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(updatedSpec),
    });

    const getResponse = await app.request("/v1/scenarios/checkout-v1");
    const body = await getResponse.json();

    expect(body).toEqual(expect.objectContaining({ version: "2.0.0" }));
  });

  // ── Scenario Validation ──────────────────────────────

  it("rejects scenario with invalid spec (Zod validation)", async () => {
    const { app } = createTestApp();

    const response = await app.request("/v1/scenarios", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scenario_id: "bad",
        version: "1.0.0",
        domain: "checkout",
        steps: [], // steps must have at least 1 element
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_INPUT");
  });

  // ── Scenario List Limit ─────────────────────────────

  it("limits scenario list results", async () => {
    const { app } = createTestApp();

    for (let i = 1; i <= 5; i++) {
      await app.request("/v1/scenarios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scenario_id: `scenario-${i}`,
          version: "1.0.0",
          domain: "checkout",
          steps: [
            { id: `s${i}`, event_key: `event.${i}`, required: true, kind: "sequence" },
          ],
        }),
      });
    }

    const limited = await app.request("/v1/scenarios?limit=2");
    expect(limited.status).toBe(200);
    const body = (await limited.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(2);

    const all = await app.request("/v1/scenarios");
    const allBody = (await all.json()) as { items: unknown[] };
    expect(allBody.items).toHaveLength(5);
  });

  // ── Verdict Query ─────────────────────────────────────

  it("returns verdicts by trace and session", async () => {
    const { app, verdictStore, traceStore, sessionStore } = createTestApp();

    await sessionStore.upsert({ sessionId: "qas_verdict_test" });
    await traceStore.upsert({
      traceId: "trc_verdict_test",
      sessionId: "qas_verdict_test",
      serviceName: "test",
      recordCount: 1,
      firstTimestamp: new Date(),
      lastTimestamp: new Date(),
    });

    await verdictStore.insert({
      id: "vrd_001",
      scenarioId: "scenario_checkout",
      traceId: "trc_verdict_test",
      qaSessionId: "qas_verdict_test",
      overallVerdict: "pass",
      report: {
        scenario_id: "scenario_checkout",
        trace_id: "trc_verdict_test",
        qa_session_id: "qas_verdict_test",
        overall_verdict: "pass",
        step_matches: [
          {
            step_id: "s1",
            matched_node_id: "log_checkout",
            verdict: "pass",
            constraint_results: [],
          },
        ],
        missing_steps: [],
        unexpected_nodes: [],
        latency_violations: [],
        ordering_violations: [],
        summary: "verdict=pass, passed=1",
        computed_at: "2026-03-12T10:05:00.000Z",
      },
    });

    const traceVerdicts = await app.request("/v1/traces/trc_verdict_test/verdicts");

    expect(traceVerdicts.status).toBe(200);
    const traceBody = (await traceVerdicts.json()) as { items: unknown[] };
    expect(traceBody.items).toHaveLength(1);
    expect(traceBody.items[0]).toEqual(
      expect.objectContaining({
        id: "vrd_001",
        scenarioId: "scenario_checkout",
        traceId: "trc_verdict_test",
        overallVerdict: "pass",
      }),
    );

    const sessionVerdicts = await app.request(
      "/v1/sessions/qas_verdict_test/verdicts",
    );

    expect(sessionVerdicts.status).toBe(200);
    const sessionBody = (await sessionVerdicts.json()) as { items: unknown[] };
    expect(sessionBody.items).toHaveLength(1);
  });

  it("returns 404 for verdict queries with missing trace or session", async () => {
    const { app } = createTestApp();

    const traceVerdicts = await app.request("/v1/traces/missing/verdicts");
    expect(traceVerdicts.status).toBe(404);

    const sessionVerdicts = await app.request("/v1/sessions/missing/verdicts");
    expect(sessionVerdicts.status).toBe(404);
  });

  // ── Verdict Orchestration E2E ─────────────────────────

  it("automatically computes verdict after ingest when session has a scenarioId", async () => {
    const { app, scenarioSpecStore, sessionStore, verdictStore } = createTestApp();

    const spec: ScenarioSpec = {
      scenario_id: "checkout-flow",
      version: "1.0.0",
      domain: "checkout",
      steps: [
        {
          id: "step_form",
          event_key: "checkout.form.updated",
          required: true,
          kind: "sequence",
        },
        {
          id: "step_save",
          event_key: "checkout.save",
          required: true,
          kind: "sequence",
        },
      ],
    };

    await scenarioSpecStore.upsert(spec);
    await sessionStore.upsert({
      sessionId: "session_verdict",
      scenarioId: "checkout-flow",
    });

    const envelope: TransmissionEnvelope = {
      transmission_id: "tx_verdict",
      sent_at: "2026-03-12T10:00:05.000Z",
      owner: { owner_type: "workspace", owner_id: "workspace_1" },
      source: { service_name: "checkout-api", sdk_name: "qa-sdk-js", sdk_version: "0.1.0" },
      runtime: { platform: "node", app_version: "20.12.0" },
      build: { env: "staging", release_version: "2026.03.12" },
      records: [
        {
          log_id: "log_v_form",
          timestamp: "2026-03-12T10:00:01.000Z",
          record_kind: "log",
          trace_id: "trace_verdict",
          span_id: "span_form",
          event_key: "checkout.form.updated",
          event_version: "001",
          payload_format: "json",
          payload_encoding: "raw",
          payload_masking_applied: false,
          payload_masked_fields: [],
          payload: { field: "email" },
          qa_session_id: "session_verdict",
        },
        {
          log_id: "log_v_save",
          timestamp: "2026-03-12T10:00:02.000Z",
          record_kind: "span",
          trace_id: "trace_verdict",
          span_id: "span_save",
          parent_span_id: "span_form",
          event_key: "checkout.save",
          event_version: "001",
          span_name: "persist_order",
          start_time: "2026-03-12T10:00:01.500Z",
          end_time: "2026-03-12T10:00:02.000Z",
          status_code: "ok",
          payload_format: "json",
          payload_encoding: "raw",
          payload_masking_applied: false,
          payload_masked_fields: [],
          payload: { orderId: "order_1" },
          qa_session_id: "session_verdict",
        },
      ],
    };

    const response = await app.request("/v1/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(envelope),
    });

    expect(response.status).toBe(202);

    // Verdict should have been auto-computed
    const verdicts = await verdictStore.findBySessionId("session_verdict");
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0]).toEqual(
      expect.objectContaining({
        scenarioId: "checkout-flow",
        traceId: "trace_verdict",
        qaSessionId: "session_verdict",
        overallVerdict: "pass",
      }),
    );

    // Verdict should also be queryable via API
    const verdictsResponse = await app.request(
      "/v1/traces/trace_verdict/verdicts",
    );

    expect(verdictsResponse.status).toBe(200);
    const body = (await verdictsResponse.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toEqual(
      expect.objectContaining({
        scenarioId: "checkout-flow",
        overallVerdict: "pass",
      }),
    );
  });

  it("enqueues Phase 2 and completes reconstruct plus verdict when the TaskQueue worker processes pending jobs", async () => {
    const taskQueue = new InMemoryTaskQueue<TaskPayload>();
    const {
      app,
      dlqStore,
      graphStore,
      recordStore,
      scenarioSpecStore,
      sessionStore,
      traceStore,
      verdictStore,
    } = createTestApp({
      taskQueue,
    });

    await scenarioSpecStore.upsert({
      scenario_id: "checkout-flow-queued",
      version: "1.0.0",
      domain: "checkout",
      steps: [
        {
          id: "step_form",
          event_key: "checkout.form.updated",
          required: true,
          kind: "sequence",
        },
        {
          id: "step_save",
          event_key: "checkout.save",
          required: true,
          kind: "sequence",
        },
      ],
    });
    await sessionStore.upsert({
      sessionId: "session_verdict_queued",
      scenarioId: "checkout-flow-queued",
    });

    const envelope: TransmissionEnvelope = {
      transmission_id: "tx_verdict_queued",
      sent_at: "2026-03-12T10:00:05.000Z",
      owner: { owner_type: "workspace", owner_id: "workspace_1" },
      source: { service_name: "checkout-api", sdk_name: "qa-sdk-js", sdk_version: "0.1.0" },
      runtime: { platform: "node", app_version: "20.12.0" },
      build: { env: "staging", release_version: "2026.03.12" },
      records: [
        {
          log_id: "log_q_form",
          timestamp: "2026-03-12T10:00:01.000Z",
          record_kind: "log",
          trace_id: "trace_verdict_queued",
          span_id: "span_form",
          event_key: "checkout.form.updated",
          event_version: "001",
          payload_format: "json",
          payload_encoding: "raw",
          payload_masking_applied: false,
          payload_masked_fields: [],
          payload: { field: "email" },
          qa_session_id: "session_verdict_queued",
        },
        {
          log_id: "log_q_save",
          timestamp: "2026-03-12T10:00:02.000Z",
          record_kind: "span",
          trace_id: "trace_verdict_queued",
          span_id: "span_save",
          parent_span_id: "span_form",
          event_key: "checkout.save",
          event_version: "001",
          span_name: "persist_order",
          start_time: "2026-03-12T10:00:01.500Z",
          end_time: "2026-03-12T10:00:02.000Z",
          status_code: "ok",
          payload_format: "json",
          payload_encoding: "raw",
          payload_masking_applied: false,
          payload_masked_fields: [],
          payload: { orderId: "order_1" },
          qa_session_id: "session_verdict_queued",
        },
      ],
    };

    const response = await app.request("/v1/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(envelope),
    });

    expect(response.status).toBe(202);
    await expect(graphStore.findByTraceId("trace_verdict_queued")).resolves.toBeNull();
    await expect(verdictStore.findByTraceId("trace_verdict_queued")).resolves.toEqual([]);
    await expect(traceStore.findById("trace_verdict_queued")).resolves.toEqual(
      expect.objectContaining({
        traceId: "trace_verdict_queued",
        reconstructed: false,
      }),
    );

    await registerTaskQueueWorker(taskQueue, {
      recordStore,
      traceStore,
      graphStore,
      sessionStore,
      verdictStore,
      scenarioSpecStore,
      dlqStore,
      logger: createNoopLogger(),
    });

    await expect(graphStore.findByTraceId("trace_verdict_queued")).resolves.toEqual(
      expect.objectContaining({
        trace_id: "trace_verdict_queued",
      }),
    );
    await expect(verdictStore.findByTraceId("trace_verdict_queued")).resolves.toEqual([
      expect.objectContaining({
        scenarioId: "checkout-flow-queued",
        traceId: "trace_verdict_queued",
        overallVerdict: "pass",
      }),
    ]);
    await expect(traceStore.findById("trace_verdict_queued")).resolves.toEqual(
      expect.objectContaining({
        traceId: "trace_verdict_queued",
        reconstructed: true,
      }),
    );
  });

  // ── Verdict Recompute ───────────────────────────────

  it("recomputes verdict via recompute endpoint", async () => {
    const { app, scenarioSpecStore, sessionStore, verdictStore } = createTestApp();

    const spec: ScenarioSpec = {
      scenario_id: "checkout-flow",
      version: "1.0.0",
      domain: "checkout",
      steps: [
        { id: "step_form", event_key: "checkout.form.updated", required: true, kind: "sequence" },
        { id: "step_save", event_key: "checkout.save", required: true, kind: "sequence" },
      ],
    };

    await scenarioSpecStore.upsert(spec);
    await sessionStore.upsert({ sessionId: "session_recompute", scenarioId: "checkout-flow" });

    const envelope: TransmissionEnvelope = {
      transmission_id: "tx_recompute",
      sent_at: "2026-03-12T10:00:05.000Z",
      owner: { owner_type: "workspace", owner_id: "workspace_1" },
      source: { service_name: "checkout-api", sdk_name: "qa-sdk-js", sdk_version: "0.1.0" },
      runtime: { platform: "node", app_version: "20.12.0" },
      build: { env: "staging", release_version: "2026.03.12" },
      records: [
        {
          log_id: "log_rc_form",
          timestamp: "2026-03-12T10:00:01.000Z",
          record_kind: "log",
          trace_id: "trace_recompute",
          span_id: "span_form",
          event_key: "checkout.form.updated",
          event_version: "001",
          payload_format: "json",
          payload_encoding: "raw",
          payload_masking_applied: false,
          payload_masked_fields: [],
          payload: { field: "email" },
          qa_session_id: "session_recompute",
        },
        {
          log_id: "log_rc_save",
          timestamp: "2026-03-12T10:00:02.000Z",
          record_kind: "span",
          trace_id: "trace_recompute",
          span_id: "span_save",
          parent_span_id: "span_form",
          event_key: "checkout.save",
          event_version: "001",
          span_name: "persist_order",
          start_time: "2026-03-12T10:00:01.500Z",
          end_time: "2026-03-12T10:00:02.000Z",
          status_code: "ok",
          payload_format: "json",
          payload_encoding: "raw",
          payload_masking_applied: false,
          payload_masked_fields: [],
          payload: { orderId: "order_1" },
          qa_session_id: "session_recompute",
        },
      ],
    };

    // Ingest → auto verdict
    await app.request("/v1/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(envelope),
    });

    const beforeRecompute = await verdictStore.findByTraceId("trace_recompute");
    expect(beforeRecompute).toHaveLength(1);
    const originalId = beforeRecompute[0]!.id;

    // Recompute → should replace the verdict
    const recomputeRes = await app.request(
      "/v1/traces/trace_recompute/verdicts/recompute",
      { method: "POST" },
    );

    expect(recomputeRes.status).toBe(200);
    const recomputeBody = (await recomputeRes.json()) as {
      computed: unknown[];
      skipped: unknown[];
      failed: unknown[];
    };
    expect(recomputeBody.computed).toHaveLength(1);

    const afterRecompute = await verdictStore.findByTraceId("trace_recompute");
    expect(afterRecompute).toHaveLength(1);
    // New verdict should have a different ID (old one removed, new one created)
    expect(afterRecompute[0]!.id).not.toBe(originalId);
  });

  it("returns 404 when recomputing verdict for missing trace", async () => {
    const { app } = createTestApp();

    const response = await app.request(
      "/v1/traces/nonexistent/verdicts/recompute",
      { method: "POST" },
    );

    expect(response.status).toBe(404);
  });
});
