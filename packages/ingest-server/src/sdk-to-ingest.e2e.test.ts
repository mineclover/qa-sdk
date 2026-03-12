import type { EventRecord } from "@qa-sdk/core";
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
import pino from "pino";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpTransport, QaLogger } from "../../sdk/dist/index.js";
import { createApp } from "./app.js";
import { RecordStreamBroker } from "./lib/record-stream-broker.js";

interface PaginatedRecordResponse {
  items: EventRecord[];
  next_cursor: string | null;
  has_more: boolean;
}

interface SessionResponse {
  sessionId: string;
  scenarioId: string | null;
  labels: Record<string, string> | null;
  startedAt: string;
  closedAt: string | null;
}

interface RuntimeGraphResponse {
  trace_id: string;
  nodes: Array<{ log_id: string; event_key: string }>;
  edges: Array<{ from: string; to: string; type: string }>;
  nodeCount: number;
  edgeCount: number;
}

describe("SDK to ingest E2E", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends SDK records through HttpTransport and exposes them through trace, session, and graph queries", async () => {
    const traceId = "trace_sdk_to_ingest";
    const sessionId = "session_sdk_to_ingest";
    const rootSpanId = "span_root_checkout";
    const maskedField = "creditCard";

    const graphStore = new InMemoryGraphStore();
    const recordStore = new InMemoryRecordStore();
    const traceStore = new InMemoryTraceStore();
    const transmissionStore = new InMemoryTransmissionStore();
    const sessionStore = new InMemorySessionStore();
    const verdictStore = new InMemoryVerdictStore();
    const scenarioSpecStore = new InMemoryScenarioSpecStore();
    const dlqStore = new InMemoryDlqStore();
    const app = createApp({
      recordStore,
      traceStore,
      graphStore,
      transmissionStore,
      sessionStore,
      verdictStore,
      scenarioSpecStore,
      dlqStore,
      recordStreamBroker: new RecordStreamBroker(),
      logger: pino({ level: "silent" }),
    });

    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const request =
          input instanceof Request ? input : new Request(input, init);
        return app.fetch(request);
      },
    );

    const baseUrl = "http://ingest.local";

    const logger = new QaLogger({
      transport: new HttpTransport({
        endpoint: `${baseUrl}/v1/ingest`,
        timeout_ms: 5_000,
      }),
      owner: {
        owner_type: "workspace",
        owner_id: "workspace_e2e",
      },
      source: {
        service_name: "sdk-e2e-client",
        sdk_name: "@qa-sdk/sdk",
        sdk_version: "0.1.0",
      },
      runtime: {
        platform: "node",
        app_version: process.version,
      },
      build: {
        env: "dev",
        release_version: "2026.03.12",
      },
      maskingRules: [{ field: maskedField, mode: "mask" }],
      flushIntervalMs: 0,
      batchSize: 10,
    });

    try {
      const context = logger.startTrace({
        trace_id: traceId,
        qa_session_id: sessionId,
      });
      context.pushSpan(rootSpanId);

      const firstLog = logger.log({
        event_key: "checkout.started",
        event_version: "001",
        payload: { step: "opened" },
      });
      const nestedSpan = logger.startSpan({
        event_key: "checkout.authorize",
        event_version: "001",
        span_name: "authorize-payment",
      });
      const maskedLog = logger.log({
        event_key: "checkout.card.entered",
        event_version: "001",
        payload: {
          [maskedField]: "4111111111111111",
          last4: "1111",
        },
      });
      const nestedSpanRecord = nestedSpan.end({
        payload: { outcome: "approved" },
      });

      await logger.flush();

      const recordsResponse = await fetch(`${baseUrl}/v1/traces/${traceId}/records`);
      expect(recordsResponse.status).toBe(200);

      const recordsBody =
        (await recordsResponse.json()) as PaginatedRecordResponse;
      const expectedRecords = [firstLog, maskedLog, nestedSpanRecord].sort(
        compareEventRecords,
      );

      expect(recordsBody.items).toHaveLength(3);
      expect(recordsBody.items.map((record) => record.timestamp)).toEqual(
        expectedRecords.map((record) => record.timestamp),
      );
      expect(recordsBody.items.map(normalizeEventRecord)).toEqual(
        expectedRecords.map(normalizeEventRecord),
      );
      expect(recordsBody.items.every((record) => record.qa_session_id === sessionId)).toBe(
        true,
      );

      const maskedRecord = recordsBody.items.find(
        (record) => record.event_key === maskedLog.event_key,
      );
      expect(maskedRecord).toEqual(
        expect.objectContaining({
          payload_masking_applied: true,
          payload_masked_fields: [maskedField],
          payload: {
            [maskedField]: {
              _masked: true,
              _present: true,
            },
            last4: "1111",
          },
        }),
      );

      const paginatedResponse = await fetch(
        `${baseUrl}/v1/traces/${traceId}/records?limit=1`,
      );
      expect(paginatedResponse.status).toBe(200);

      const paginatedBody =
        (await paginatedResponse.json()) as PaginatedRecordResponse;
      expect(paginatedBody.items).toHaveLength(1);
      expect(normalizeEventRecord(paginatedBody.items[0]!)).toEqual(
        normalizeEventRecord(expectedRecords[0]!),
      );
      expect(paginatedBody.has_more).toBe(true);
      expect(paginatedBody.next_cursor).toEqual(expect.any(String));

      const sessionResponse = await fetch(`${baseUrl}/v1/sessions/${sessionId}`);
      expect(sessionResponse.status).toBe(200);

      const sessionBody = (await sessionResponse.json()) as SessionResponse;
      expect(sessionBody).toEqual({
        sessionId,
        scenarioId: null,
        labels: null,
        startedAt: expect.any(String),
        closedAt: null,
      });
      expect(new Date(sessionBody.startedAt).toISOString()).toBe(
        sessionBody.startedAt,
      );

      const graphResponse = await fetch(`${baseUrl}/v1/traces/${traceId}/graph`);
      expect(graphResponse.status).toBe(200);

      const graphBody = (await graphResponse.json()) as RuntimeGraphResponse;
      expect(graphBody.nodeCount).toBe(graphBody.nodes.length);
      expect(graphBody.edgeCount).toBe(graphBody.edges.length);
      expect(graphBody).toEqual(
        expect.objectContaining({
          trace_id: traceId,
          nodeCount: 3,
          nodes: expect.arrayContaining(
            expectedRecords.map((record) =>
              expect.objectContaining({
                log_id: record.log_id,
                event_key: record.event_key,
              }),
            ),
          ),
        }),
      );

      await expect(traceStore.findById(traceId)).resolves.toEqual(
        expect.objectContaining({
          traceId,
          sessionId,
          reconstructed: true,
        }),
      );
      await expect(graphStore.findByTraceId(traceId)).resolves.toEqual(
        expect.objectContaining({
          trace_id: traceId,
          nodes: expect.arrayContaining(
            expectedRecords.map((record) =>
              expect.objectContaining({
                log_id: record.log_id,
                event_key: record.event_key,
              }),
            ),
          ),
        }),
      );
    } finally {
      await logger.shutdown();
    }
  });
});

function compareEventRecords(left: EventRecord, right: EventRecord): number {
  const timestampDifference =
    new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();

  if (timestampDifference !== 0) {
    return timestampDifference;
  }

  return left.log_id.localeCompare(right.log_id);
}

function normalizeEventRecord(record: EventRecord) {
  return {
    log_id: record.log_id,
    timestamp: record.timestamp,
    record_kind: record.record_kind,
    trace_id: record.trace_id,
    span_id: record.span_id,
    parent_span_id: record.parent_span_id ?? null,
    event_key: record.event_key,
    event_version: record.event_version,
    span_name: record.span_name ?? null,
    start_time: record.start_time ?? null,
    end_time: record.end_time ?? null,
    status_code: record.status_code ?? null,
    payload_format: record.payload_format,
    payload_encoding: record.payload_encoding,
    payload_masking_applied: record.payload_masking_applied,
    payload_masked_fields: record.payload_masked_fields,
    payload: record.payload,
    qa_session_id: record.qa_session_id ?? null,
  };
}
