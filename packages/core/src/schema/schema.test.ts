import { describe, it, expect } from "vitest";
import { transmissionEnvelopeSchema } from "./envelope.schema.js";
import { eventRecordSchema } from "./record.schema.js";
import { scenarioSpecSchema } from "./scenario.schema.js";

// ── 헬퍼 ──────────────────────────────────────────────────

function makeValidRecord(overrides: Record<string, unknown> = {}) {
  return {
    log_id: "log_01ABCDEF",
    timestamp: "2026-03-01T00:00:00.000Z",
    record_kind: "log",
    trace_id: "trc_01ABCDEF",
    span_id: "spn_01ABCDEF",
    event_key: "click",
    event_version: "001",
    payload_format: "json",
    payload_encoding: "raw",
    payload_masking_applied: false,
    payload_masked_fields: [],
    payload: { element_id: "btn" },
    ...overrides,
  };
}

function makeValidEnvelope(recordOverrides: Record<string, unknown> = {}) {
  return {
    transmission_id: "txn_01ABCDEF",
    sent_at: "2026-03-01T00:00:00.000Z",
    owner: { owner_type: "tenant", owner_id: "my-service" },
    source: { service_name: "shop", sdk_name: "@qa-sdk/sdk", sdk_version: "0.1.0" },
    runtime: { platform: "browser" },
    build: { env: "production" },
    records: [makeValidRecord(recordOverrides)],
  };
}

function makeValidScenario() {
  return {
    scenario_id: "sc_checkout",
    version: "1",
    domain: "checkout",
    steps: [
      {
        id: "step_1",
        event_key: "session_start",
        required: true,
        kind: "sequence",
      },
    ],
  };
}

// ── eventRecordSchema ─────────────────────────────────────

describe("eventRecordSchema — 유효한 레코드", () => {
  it("최소 필수 필드만 있어도 파싱 성공", () => {
    const result = eventRecordSchema.safeParse(makeValidRecord());
    expect(result.success).toBe(true);
  });

  it("optional 필드(span_name, qa_session_id 등) 포함 시 파싱 성공", () => {
    const result = eventRecordSchema.safeParse(makeValidRecord({
      span_name: "checkout-span",
      qa_session_id: "ses_001",
      parent_span_id: "spn_parent",
    }));
    expect(result.success).toBe(true);
  });
});

describe("eventRecordSchema — 잘못된 입력 거부", () => {
  it("event_version이 3자리 숫자가 아니면 실패", () => {
    expect(eventRecordSchema.safeParse(makeValidRecord({ event_version: "1" })).success).toBe(false);
    expect(eventRecordSchema.safeParse(makeValidRecord({ event_version: "01" })).success).toBe(false);
    expect(eventRecordSchema.safeParse(makeValidRecord({ event_version: "0001" })).success).toBe(false);
    expect(eventRecordSchema.safeParse(makeValidRecord({ event_version: "abc" })).success).toBe(false);
  });

  it("record_kind가 enum 외 값이면 실패", () => {
    expect(eventRecordSchema.safeParse(makeValidRecord({ record_kind: "trace" })).success).toBe(false);
  });

  it("payload_format이 enum 외 값이면 실패", () => {
    expect(eventRecordSchema.safeParse(makeValidRecord({ payload_format: "xml" })).success).toBe(false);
  });

  it("payload_encoding이 enum 외 값이면 실패", () => {
    expect(eventRecordSchema.safeParse(makeValidRecord({ payload_encoding: "utf8" })).success).toBe(false);
  });

  it("timestamp가 ISO datetime 형식이 아니면 실패", () => {
    expect(eventRecordSchema.safeParse(makeValidRecord({ timestamp: "2026-03-01" })).success).toBe(false);
    expect(eventRecordSchema.safeParse(makeValidRecord({ timestamp: "not-a-date" })).success).toBe(false);
  });

  it("필수 필드(log_id, trace_id, event_key) 누락 시 실패", () => {
    const { log_id: _, ...noLogId } = makeValidRecord();
    expect(eventRecordSchema.safeParse(noLogId).success).toBe(false);

    const { trace_id: __, ...noTraceId } = makeValidRecord();
    expect(eventRecordSchema.safeParse(noTraceId).success).toBe(false);

    const { event_key: ___, ...noEventKey } = makeValidRecord();
    expect(eventRecordSchema.safeParse(noEventKey).success).toBe(false);
  });

  it("빈 문자열 필드(log_id, event_key 등)는 실패", () => {
    expect(eventRecordSchema.safeParse(makeValidRecord({ log_id: "" })).success).toBe(false);
    expect(eventRecordSchema.safeParse(makeValidRecord({ event_key: "" })).success).toBe(false);
  });
});

// ── transmissionEnvelopeSchema ────────────────────────────

describe("transmissionEnvelopeSchema — 유효한 envelope", () => {
  it("최소 필수 필드 파싱 성공", () => {
    const result = transmissionEnvelopeSchema.safeParse(makeValidEnvelope());
    expect(result.success).toBe(true);
  });

  it("records 배열에 여러 레코드가 있어도 성공", () => {
    const envelope = {
      ...makeValidEnvelope(),
      records: [makeValidRecord(), makeValidRecord({ event_key: "page_view" })],
    };
    expect(transmissionEnvelopeSchema.safeParse(envelope).success).toBe(true);
  });
});

describe("transmissionEnvelopeSchema — 잘못된 입력 거부", () => {
  it("records 배열이 비어 있으면 실패 (min(1) 위반)", () => {
    const envelope = { ...makeValidEnvelope(), records: [] };
    expect(transmissionEnvelopeSchema.safeParse(envelope).success).toBe(false);
  });

  it("owner_type이 enum 외 값이면 실패", () => {
    const envelope = makeValidEnvelope();
    (envelope.owner as Record<string, unknown>).owner_type = "service";
    expect(transmissionEnvelopeSchema.safeParse(envelope).success).toBe(false);
  });

  it("build.env가 enum 외 값이면 실패", () => {
    const envelope = makeValidEnvelope();
    (envelope.build as Record<string, unknown>).env = "test";
    expect(transmissionEnvelopeSchema.safeParse(envelope).success).toBe(false);
  });

  it("sent_at이 ISO datetime 형식이 아니면 실패", () => {
    const envelope = { ...makeValidEnvelope(), sent_at: "2026-03-01" };
    expect(transmissionEnvelopeSchema.safeParse(envelope).success).toBe(false);
  });

  it("source의 service_name이 빈 문자열이면 실패", () => {
    const envelope = makeValidEnvelope();
    (envelope.source as Record<string, unknown>).service_name = "";
    expect(transmissionEnvelopeSchema.safeParse(envelope).success).toBe(false);
  });

  it("records 내 레코드에 유효하지 않은 event_version이 있으면 실패", () => {
    const envelope = makeValidEnvelope({ event_version: "1" });
    expect(transmissionEnvelopeSchema.safeParse(envelope).success).toBe(false);
  });
});

// ── scenarioSpecSchema ────────────────────────────────────

describe("scenarioSpecSchema — 유효한 시나리오", () => {
  it("최소 필수 필드 파싱 성공", () => {
    const result = scenarioSpecSchema.safeParse(makeValidScenario());
    expect(result.success).toBe(true);
  });

  it("constraint가 있는 step 파싱 성공", () => {
    const scenario = {
      ...makeValidScenario(),
      steps: [
        {
          id: "step_1",
          event_key: "click",
          required: true,
          kind: "sequence",
          constraints: [{ field: "element_id", op: "eq", value: "btn" }],
        },
      ],
    };
    expect(scenarioSpecSchema.safeParse(scenario).success).toBe(true);
  });
});

describe("scenarioSpecSchema — 잘못된 입력 거부", () => {
  it("steps 배열이 비어 있으면 실패", () => {
    const scenario = { ...makeValidScenario(), steps: [] };
    expect(scenarioSpecSchema.safeParse(scenario).success).toBe(false);
  });

  it("step.kind가 enum 외 값이면 실패", () => {
    const scenario = {
      ...makeValidScenario(),
      steps: [{ id: "s1", event_key: "click", required: true, kind: "parallel" }],
    };
    expect(scenarioSpecSchema.safeParse(scenario).success).toBe(false);
  });

  it("step.event_version이 3자리가 아니면 실패", () => {
    const scenario = {
      ...makeValidScenario(),
      steps: [{ id: "s1", event_key: "click", event_version: "1", required: true, kind: "sequence" }],
    };
    expect(scenarioSpecSchema.safeParse(scenario).success).toBe(false);
  });

  it("constraint.op가 enum 외 값이면 실패", () => {
    const scenario = {
      ...makeValidScenario(),
      steps: [
        {
          id: "s1",
          event_key: "click",
          required: true,
          kind: "sequence",
          constraints: [{ field: "x", op: "regex" }],
        },
      ],
    };
    expect(scenarioSpecSchema.safeParse(scenario).success).toBe(false);
  });
});
