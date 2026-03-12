import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventRecord } from "@qa-sdk/core";
import type { QaLoggerConfig } from "./config.js";
import { QaLogger } from "./logger.js";
import { NoopTransport } from "./transport/noop.js";

const owner = {
  owner_type: "workspace",
  owner_id: "workspace_1",
} as const;

const source = {
  service_name: "web-app",
  sdk_name: "qa-sdk-js",
  sdk_version: "0.1.0",
} as const;

const runtime = {
  platform: "node",
  app_version: "1.2.3",
} as const;

const build = {
  env: "dev",
  release_version: "2026.03.12",
} as const;

function createLogger(
  overrides: Partial<Pick<QaLoggerConfig, "batchSize" | "flushIntervalMs">> = {},
) {
  const transport = new NoopTransport();
  const logger = new QaLogger({
    transport,
    owner,
    source,
    runtime,
    build,
    batchSize: 10,
    flushIntervalMs: 0,
    ...overrides,
  });

  return { logger, transport };
}

function getBufferedRecords(logger: QaLogger): EventRecord[] {
  return (logger as unknown as { buffer: EventRecord[] }).buffer;
}

describe("QaLogger", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-12T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("buffers log records until flush is requested", () => {
    const { logger, transport } = createLogger();

    logger.startTrace({ qa_session_id: "qas_session_1" });

    const record = logger.log({
      event_key: "user_signed_in",
      event_version: "1",
      payload: { email: "dev@example.com" },
    });

    expect(record).toEqual(
      expect.objectContaining({
        timestamp: "2026-03-12T00:00:00.000Z",
        record_kind: "log",
        event_key: "user_signed_in",
        event_version: "1",
        payload_format: "json",
        payload_encoding: "raw",
        payload_masking_applied: false,
        payload_masked_fields: [],
        payload: { email: "dev@example.com" },
        qa_session_id: "qas_session_1",
        parent_span_id: undefined,
      }),
    );
    expect(record.trace_id).toBe(logger.context?.trace_id);
    expect(record.span_id).toBe(logger.context?.currentSpanId);
    expect(getBufferedRecords(logger)).toEqual([record]);
    expect(transport.sent).toEqual([]);
  });

  it("records span timing and status when a span ends", () => {
    const { logger } = createLogger();

    const span = logger.startSpan({
      event_key: "checkout",
      event_version: "1",
      span_name: "Checkout Flow",
    });

    vi.setSystemTime(new Date("2026-03-12T00:00:02.000Z"));

    const record = span.end({
      status_code: "error",
      payload: { reason: "payment_declined" },
    });

    expect(record).toEqual(
      expect.objectContaining({
        record_kind: "span",
        span_id: span.span_id,
        parent_span_id: undefined,
        span_name: "Checkout Flow",
        start_time: "2026-03-12T00:00:00.000Z",
        end_time: "2026-03-12T00:00:02.000Z",
        timestamp: "2026-03-12T00:00:02.000Z",
        status_code: "error",
        payload: { reason: "payment_declined" },
      }),
    );
    expect(getBufferedRecords(logger)).toEqual([record]);
  });

  it("tracks parent span ids for nested spans", () => {
    const { logger } = createLogger();

    const parent = logger.startSpan({
      event_key: "request",
      event_version: "1",
      span_name: "HTTP Request",
    });
    vi.setSystemTime(new Date("2026-03-12T00:00:01.000Z"));

    const child = logger.startSpan({
      event_key: "db_query",
      event_version: "1",
      span_name: "DB Query",
    });
    vi.setSystemTime(new Date("2026-03-12T00:00:02.000Z"));

    const childRecord = child.end();
    vi.setSystemTime(new Date("2026-03-12T00:00:03.000Z"));
    const parentRecord = parent.end();

    expect(childRecord.parent_span_id).toBe(parent.span_id);
    expect(parentRecord.parent_span_id).toBeUndefined();
    expect(getBufferedRecords(logger)).toEqual([childRecord, parentRecord]);
  });

  it("flushes buffered records into a transmission envelope", async () => {
    const { logger, transport } = createLogger();

    const record = logger.log({
      event_key: "cart_updated",
      event_version: "1",
      payload: { item_count: 2 },
    });

    vi.setSystemTime(new Date("2026-03-12T00:00:05.000Z"));
    await logger.flush();

    expect(getBufferedRecords(logger)).toEqual([]);
    expect(transport.sent).toEqual([
      expect.objectContaining({
        transmission_id: expect.stringMatching(/^txm_/),
        sent_at: "2026-03-12T00:00:05.000Z",
        owner,
        source,
        runtime,
        build,
        records: [record],
      }),
    ]);
  });

  it("auto flushes when the batch size is reached", async () => {
    const { logger, transport } = createLogger({ batchSize: 2 });

    const first = logger.log({
      event_key: "search_opened",
      event_version: "1",
      payload: { query: "laptop" },
    });
    const second = logger.log({
      event_key: "search_submitted",
      event_version: "1",
      payload: { query: "laptop sleeve" },
    });

    await Promise.resolve();

    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]).toEqual(
      expect.objectContaining({
        records: [first, second],
      }),
    );
    expect(getBufferedRecords(logger)).toEqual([]);
  });
});
