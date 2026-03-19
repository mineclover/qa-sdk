import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLabelRegistry, PrefixCodec } from "weighted-index";
import { NoopTransport } from "@qa-sdk/sdk";
import { ApmLogger, createApmLogger } from "./apm-logger.js";

// ── Test Fixtures ──────────────────────────────────────

const labels = createLabelRegistry({
  env:      [{ version: "v1", ids: ["dev", "prod"] }],
  region:   [{ version: "v1", ids: ["asia", "usa"] }],
  service:  [{ version: "v1", ids: ["web", "api", "worker"] }],
  action:   [{ version: "v1", ids: ["read", "write"] }],
});

const codec = new PrefixCodec(labels, {
  svc: {
    labels: ["env", "region", "service", "action"],
    versions: [{ version: "v1", labelVersions: { env: "v1", region: "v1", service: "v1", action: "v1" } }],
  },
});

const owner = { owner_type: "tenant", owner_id: "test-tenant" } as const;
const source = { service_name: "test-svc", sdk_name: "@qa-sdk/apm", sdk_version: "0.1.0" };
const runtime = { platform: "node" };
const build = { env: "dev" } as const;

function makeTransport() {
  return new NoopTransport();
}

function createTestLogger(overrides?: { fixedDims?: Record<string, string> }) {
  const transport = makeTransport();
  const logger = new ApmLogger({
    transport,
    owner,
    source,
    runtime,
    build,
    codec,
    prefix: "svc",
    fixedDims: overrides?.fixedDims ?? { env: "prod", region: "asia" },
    flushIntervalMs: 0,
  });
  return { logger, transport };
}

// ── Tests ──────────────────────────────────────────────

describe("ApmLogger", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-12T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("constructor에서 PartialBinder를 생성한다", () => {
    const { logger } = createTestLogger();

    expect(logger.partialBinder.bound).toEqual({ env: "prod", region: "asia" });
    expect(logger.partialBinder.free).toEqual(["service", "action"]);
    expect(logger.partialBinder.prefix).toBe("svc");
  });

  it("log(dims)에서 address_context에 'prefix:gen:id' 형식을 생성한다", () => {
    const { logger } = createTestLogger();
    logger.startTrace();

    const record = logger.log({
      event_key: "order_placed",
      event_version: "1",
      dims: { service: "web", action: "read" },
    });

    // 주소 형식: "svc:v1:<id>"
    expect(record.address_context).toBeDefined();
    const addr = record.address_context!["svc"];
    expect(addr).toMatch(/^svc:v1:\d+$/);
  });

  it("dims 미지정 시 address_context가 없다", () => {
    const { logger } = createTestLogger();
    logger.startTrace();

    const record = logger.log({
      event_key: "heartbeat",
      event_version: "1",
    });

    expect(record.address_context).toBeUndefined();
  });

  it("metric(name, value, { dims })에서 address_context + metric 필드를 생성한다", () => {
    const { logger } = createTestLogger();
    logger.startTrace();

    const record = logger.metric("latency_ms", 42, {
      type: "histogram",
      dims: { service: "api", action: "write" },
    });

    expect(record.record_kind).toBe("metric");
    expect(record.metric_name).toBe("latency_ms");
    expect(record.metric_value).toBe(42);
    expect(record.metric_type).toBe("histogram");
    expect(record.address_context).toBeDefined();
    expect(record.address_context!["svc"]).toMatch(/^svc:v1:\d+$/);
  });

  it("편의 메서드 info/warn/error가 동작한다", () => {
    const { logger } = createTestLogger();
    logger.startTrace();

    const info = logger.info("started", { detail: "boot" });
    const warn = logger.warn("slow_query", { ms: 500 });
    const err = logger.error("crash", { code: "E001" });

    expect(info.event_key).toBe("started");
    expect(warn.event_key).toBe("slow_query");
    expect(err.event_key).toBe("crash");
  });

  it("startSpan에 dims를 전달하면 address_context가 생성된다", () => {
    const { logger } = createTestLogger();
    logger.startTrace();

    const span = logger.startSpan({
      event_key: "db_query",
      event_version: "1",
      span_name: "SELECT",
      dims: { service: "api", action: "read" },
    });
    const record = span.end();

    expect(record.address_context).toBeDefined();
    expect(record.address_context!["svc"]).toMatch(/^svc:v1:\d+$/);
  });

  it("동일한 dims는 동일한 주소를 생성한다 (결정론적)", () => {
    const { logger } = createTestLogger();
    logger.startTrace();

    const r1 = logger.log({
      event_key: "e1", event_version: "1",
      dims: { service: "web", action: "read" },
    });
    const r2 = logger.log({
      event_key: "e2", event_version: "1",
      dims: { service: "web", action: "read" },
    });

    expect(r1.address_context!["svc"]).toBe(r2.address_context!["svc"]);
  });

  it("다른 dims는 다른 주소를 생성한다", () => {
    const { logger } = createTestLogger();
    logger.startTrace();

    const r1 = logger.log({
      event_key: "e1", event_version: "1",
      dims: { service: "web", action: "read" },
    });
    const r2 = logger.log({
      event_key: "e2", event_version: "1",
      dims: { service: "api", action: "write" },
    });

    expect(r1.address_context!["svc"]).not.toBe(r2.address_context!["svc"]);
  });

  it("fully bound (자유 차원 없음) 시 infra_context로 자동 설정된다", async () => {
    const transport = makeTransport();
    const logger = new ApmLogger({
      transport, owner, source, runtime, build,
      codec,
      prefix: "svc",
      fixedDims: { env: "prod", region: "asia", service: "web", action: "read" },
      flushIntervalMs: 0,
    });
    logger.startTrace();
    logger.log({ event_key: "e1", event_version: "1" });

    await logger.flush();

    const envelope = transport.sent[0];
    expect(envelope.infra_context).toBeDefined();
    expect(envelope.infra_context!["svc"]).toMatch(/^svc:v1:\d+$/);
  });

  it("createApmLogger 팩토리가 동작한다", () => {
    const transport = makeTransport();
    const logger = createApmLogger({
      transport, owner, source, runtime, build,
      codec, prefix: "svc",
      fixedDims: { env: "dev", region: "usa" },
      flushIntervalMs: 0,
    });

    expect(logger).toBeInstanceOf(ApmLogger);
    expect(logger.partialBinder.free).toEqual(["service", "action"]);
  });

  it("flush/shutdown이 정상 동작한다", async () => {
    const { logger, transport } = createTestLogger();
    logger.startTrace();
    logger.info("e1");

    await logger.flush();
    expect(transport.sent).toHaveLength(1);

    logger.info("e2");
    await logger.shutdown();
    expect(transport.sent).toHaveLength(2);
  });
});
