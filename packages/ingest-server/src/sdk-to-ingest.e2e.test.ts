import type { EventRecord, ScenarioSpec } from "@qa-sdk/core";
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
  edges: Array<{ source: string; target: string; type: string }>;
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

interface VerdictItemResponse {
  scenarioId: string;
  overallVerdict: string;
  report: {
    missing_steps: string[];
    step_matches: Array<{ step_id: string; matched_node_id?: string; verdict: string }>;
  };
}

// ── E2E 시나리오 정의 ────────────────────────────────────
//
// 각 케이스는 시나리오 스펙 + 발생 이벤트 + 기대 verdict를 명시한다.
// 이를 통해 파이프라인의 각 분기(통과/누락/제약/선택)를 독립적으로 검증한다.

interface E2EScenarioCase {
  name: string;
  scenario: ScenarioSpec;
  events: Array<{ event_key: string; event_version: string; payload?: Record<string, unknown> }>;
  expected: {
    verdict: "pass" | "fail" | "warn";
    // missing_steps: 이벤트 자체가 발생하지 않은 step ID 목록
    // constraint 실패는 이벤트가 발생했으므로 missing_steps에 포함되지 않음
    missing_steps: string[];
  };
}

const E2E_SCENARIO_CASES: E2EScenarioCase[] = [
  {
    // 정상 흐름: 모든 required step이 순서대로 발생
    name: "required step 전체 발생 → pass",
    scenario: {
      scenario_id: "e2e-all-required",
      version: "1.0.0",
      domain: "test",
      steps: [
        { id: "s1", event_key: "flow.started", required: true, kind: "sequence" },
        { id: "s2", event_key: "flow.processed", required: true, kind: "sequence" },
        { id: "s3", event_key: "flow.completed", required: true, kind: "sequence" },
      ],
    },
    events: [
      { event_key: "flow.started", event_version: "001" },
      { event_key: "flow.processed", event_version: "001" },
      { event_key: "flow.completed", event_version: "001" },
    ],
    expected: { verdict: "pass", missing_steps: [] },
  },
  {
    // required step 누락: 이벤트가 발생하지 않아 missing_steps에 기록됨
    name: "required step 누락 → fail (missing_steps 포함)",
    scenario: {
      scenario_id: "e2e-required-missing",
      version: "1.0.0",
      domain: "test",
      steps: [
        { id: "s1", event_key: "flow.started", required: true, kind: "sequence" },
        { id: "s2", event_key: "flow.processed", required: true, kind: "sequence" },
        { id: "s3", event_key: "flow.completed", required: true, kind: "sequence" },
      ],
    },
    events: [
      { event_key: "flow.started", event_version: "001" },
      { event_key: "flow.processed", event_version: "001" },
      // flow.completed 누락 → missing_steps: ["s3"]
    ],
    expected: { verdict: "fail", missing_steps: ["s3"] },
  },
  {
    // optional step 누락: required는 통과했으므로 fail이 아닌 warn
    name: "optional step 누락 → warn (fail 아님)",
    scenario: {
      scenario_id: "e2e-optional-missing",
      version: "1.0.0",
      domain: "test",
      steps: [
        { id: "s1", event_key: "flow.started", required: true, kind: "sequence" },
        { id: "s2", event_key: "flow.bonus", required: false, kind: "optional" },
      ],
    },
    events: [
      { event_key: "flow.started", event_version: "001" },
      // flow.bonus 누락 — optional이므로 warn
    ],
    expected: { verdict: "warn", missing_steps: ["s2"] },
  },
  {
    // payload constraint 통과: 이벤트는 발생했고 payload 값도 스펙 일치
    name: "payload constraint 통과 → pass",
    scenario: {
      scenario_id: "e2e-constraint-pass",
      version: "1.0.0",
      domain: "checkout",
      steps: [
        {
          id: "s1",
          event_key: "order.confirmed",
          required: true,
          kind: "sequence",
          constraints: [{ field: "payload.status", op: "eq", value: "approved" }],
        },
      ],
    },
    events: [
      { event_key: "order.confirmed", event_version: "001", payload: { status: "approved" } },
    ],
    expected: { verdict: "pass", missing_steps: [] },
  },
  {
    // payload constraint 실패: 이벤트는 발생했으나 payload가 스펙 불일치
    // → missing_steps에 포함되지 않음 (노드는 매칭됨), step_match.verdict = "fail"
    name: "payload constraint 실패 → fail (missing_steps는 비어 있음)",
    scenario: {
      scenario_id: "e2e-constraint-fail",
      version: "1.0.0",
      domain: "checkout",
      steps: [
        {
          id: "s1",
          event_key: "order.confirmed",
          required: true,
          kind: "sequence",
          constraints: [{ field: "payload.status", op: "eq", value: "approved" }],
        },
      ],
    },
    events: [
      { event_key: "order.confirmed", event_version: "001", payload: { status: "declined" } },
    ],
    expected: { verdict: "fail", missing_steps: [] },
  },
  {
    // 시나리오 외 이벤트: unmatched_nodes로 기록되지만 verdict에 영향 없음
    name: "시나리오 외 이벤트 발생 → pass 유지",
    scenario: {
      scenario_id: "e2e-extra-events",
      version: "1.0.0",
      domain: "checkout",
      steps: [
        { id: "s1", event_key: "checkout.started", required: true, kind: "sequence" },
      ],
    },
    events: [
      { event_key: "checkout.started", event_version: "001" },
      { event_key: "analytics.tracked", event_version: "001" },
      { event_key: "debug.breadcrumb", event_version: "001" },
    ],
    expected: { verdict: "pass", missing_steps: [] },
  },
  {
    // 백엔드 도메인: 프론트엔드가 아닌 API 요청 흐름도 동일하게 수집·검증 가능
    name: "백엔드 API 요청 흐름 → pass",
    scenario: {
      scenario_id: "e2e-api-flow",
      version: "1.0.0",
      domain: "backend",
      steps: [
        { id: "s1", event_key: "api.request.received", required: true, kind: "sequence" },
        { id: "s2", event_key: "api.validation.passed", required: true, kind: "sequence" },
        { id: "s3", event_key: "api.response.sent", required: true, kind: "sequence" },
      ],
    },
    events: [
      { event_key: "api.request.received", event_version: "001", payload: { method: "POST", path: "/v1/ingest" } },
      { event_key: "api.validation.passed", event_version: "001", payload: { schema: "TransmissionEnvelope" } },
      { event_key: "api.response.sent", event_version: "001", payload: { status: 202 } },
    ],
    expected: { verdict: "pass", missing_steps: [] },
  },
];

describe("SDK scenario E2E — systematic verdict coverage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function createTestSetup() {
    const baseUrl = "http://ingest.local";
    const scenarioSpecStore = new InMemoryScenarioSpecStore();
    const sessionStore = new InMemorySessionStore();

    const app = createApp({
      recordStore: new InMemoryRecordStore(),
      traceStore: new InMemoryTraceStore(),
      graphStore: new InMemoryGraphStore(),
      transmissionStore: new InMemoryTransmissionStore(),
      sessionStore,
      verdictStore: new InMemoryVerdictStore(),
      scenarioSpecStore,
      dlqStore: new InMemoryDlqStore(),
      recordStreamBroker: new RecordStreamBroker(),
      logger: pino({ level: "silent" }),
    });

    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = input instanceof Request ? input : new Request(input, init);
        return app.fetch(request);
      },
    );

    const makeLogger = () =>
      new QaLogger({
        transport: new HttpTransport({ endpoint: `${baseUrl}/v1/ingest`, timeout_ms: 5_000 }),
        owner: { owner_type: "workspace", owner_id: "workspace_e2e" },
        source: { service_name: "test-runner", sdk_name: "@qa-sdk/sdk", sdk_version: "0.1.0" },
        runtime: { platform: "node" },
        build: { env: "dev" },
        flushIntervalMs: 0,
        batchSize: 100,
      });

    return { scenarioSpecStore, sessionStore, baseUrl, makeLogger };
  }

  it.each(E2E_SCENARIO_CASES)(
    "$name",
    async ({ scenario, events, expected }) => {
      const { scenarioSpecStore, sessionStore, baseUrl, makeLogger } = createTestSetup();
      const traceId = `trace_${scenario.scenario_id}`;
      const sessionId = `session_${scenario.scenario_id}`;

      await scenarioSpecStore.upsert(scenario);
      await sessionStore.upsert({ sessionId, scenarioId: scenario.scenario_id });

      const logger = makeLogger();
      try {
        const ctx = logger.startTrace({ trace_id: traceId, qa_session_id: sessionId });
        ctx.pushSpan("span_root");

        for (const event of events) {
          logger.log(event);
        }

        await logger.flush();
      } finally {
        await logger.shutdown();
      }

      const res = await fetch(`${baseUrl}/v1/traces/${traceId}/verdicts`);
      expect(res.status).toBe(200);
      const body = await res.json() as { items: VerdictItemResponse[] };
      expect(body.items).toHaveLength(1);
      expect(body.items[0]!.overallVerdict).toBe(expected.verdict);
      expect(body.items[0]!.report.missing_steps).toEqual(expected.missing_steps);
    },
  );
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
