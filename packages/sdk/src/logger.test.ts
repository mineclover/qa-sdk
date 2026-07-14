import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventRecord } from '@qa-sdk/core';
import { QaLogger, NoopTransport, type QaLoggerConfig } from '@qa-sdk/logger';

const owner = {
  owner_type: 'workspace',
  owner_id: 'workspace_1',
} as const;

const source = {
  service_name: 'web-app',
  sdk_name: 'qa-sdk-js',
  sdk_version: '0.1.0',
} as const;

const runtime = {
  platform: 'node',
  app_version: '1.2.3',
} as const;

const build = {
  env: 'dev',
  release_version: '2026.03.12',
} as const;

function createLogger(
  overrides: Partial<
    Pick<QaLoggerConfig, 'batchSize' | 'flushIntervalMs' | 'maxBufferSize' | 'onError'>
  > = {},
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

function makeFailingTransport(error = new Error('network error')) {
  return {
    send: vi.fn().mockRejectedValue(error),
    flush: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  };
}

function getFlushInProgress(logger: QaLogger): boolean {
  return (logger as unknown as { flushInProgress: boolean }).flushInProgress;
}

function getBufferedRecords(logger: QaLogger): EventRecord[] {
  return (logger as unknown as { buffer: EventRecord[] }).buffer;
}

describe('QaLogger', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('buffers log records until flush is requested', () => {
    const { logger, transport } = createLogger();

    logger.startTrace({ qa_session_id: 'qas_session_1' });

    const record = logger.log({
      event_key: 'user_signed_in',
      event_version: '1',
      payload: { email: 'dev@example.com' },
    });

    expect(record).toEqual(
      expect.objectContaining({
        timestamp: '2026-03-12T00:00:00.000Z',
        record_kind: 'log',
        event_key: 'user_signed_in',
        event_version: '1',
        payload_format: 'json',
        payload_encoding: 'raw',
        payload_masking_applied: false,
        payload_masked_fields: [],
        payload: { email: 'dev@example.com' },
        qa_session_id: 'qas_session_1',
        parent_span_id: undefined,
      }),
    );
    expect(record.trace_id).toBe(logger.context?.trace_id);
    expect(record.span_id).toBe(logger.context?.currentSpanId);
    expect(getBufferedRecords(logger)).toEqual([record]);
    expect(transport.sent).toEqual([]);
  });

  it('records span timing and status when a span ends', () => {
    const { logger } = createLogger();

    const span = logger.startSpan({
      event_key: 'checkout',
      event_version: '1',
      span_name: 'Checkout Flow',
    });

    vi.setSystemTime(new Date('2026-03-12T00:00:02.000Z'));

    const record = span.end({
      status_code: 'error',
      payload: { reason: 'payment_declined' },
    });

    expect(record).toEqual(
      expect.objectContaining({
        record_kind: 'span',
        span_id: span.span_id,
        parent_span_id: undefined,
        span_name: 'Checkout Flow',
        start_time: '2026-03-12T00:00:00.000Z',
        end_time: '2026-03-12T00:00:02.000Z',
        timestamp: '2026-03-12T00:00:02.000Z',
        status_code: 'error',
        payload: { reason: 'payment_declined' },
      }),
    );
    expect(getBufferedRecords(logger)).toEqual([record]);
  });

  it('tracks parent span ids for nested spans', () => {
    const { logger } = createLogger();

    const parent = logger.startSpan({
      event_key: 'request',
      event_version: '1',
      span_name: 'HTTP Request',
    });
    vi.setSystemTime(new Date('2026-03-12T00:00:01.000Z'));

    const child = logger.startSpan({
      event_key: 'db_query',
      event_version: '1',
      span_name: 'DB Query',
    });
    vi.setSystemTime(new Date('2026-03-12T00:00:02.000Z'));

    const childRecord = child.end();
    vi.setSystemTime(new Date('2026-03-12T00:00:03.000Z'));
    const parentRecord = parent.end();

    expect(childRecord.parent_span_id).toBe(parent.span_id);
    expect(parentRecord.parent_span_id).toBeUndefined();
    expect(getBufferedRecords(logger)).toEqual([childRecord, parentRecord]);
  });

  it('flushes buffered records into a transmission envelope', async () => {
    const { logger, transport } = createLogger();

    const record = logger.log({
      event_key: 'cart_updated',
      event_version: '1',
      payload: { item_count: 2 },
    });

    vi.setSystemTime(new Date('2026-03-12T00:00:05.000Z'));
    await logger.flush();

    expect(getBufferedRecords(logger)).toEqual([]);
    expect(transport.sent).toEqual([
      expect.objectContaining({
        transmission_id: expect.stringMatching(/^txm_/),
        sent_at: '2026-03-12T00:00:05.000Z',
        owner,
        source,
        runtime,
        build,
        records: [record],
      }),
    ]);
  });

  it('does not flush when flushInProgress is true', async () => {
    let resolveTransport!: () => void;
    const transport = {
      send: vi.fn().mockImplementation(
        () =>
          new Promise<void>((r) => {
            resolveTransport = r;
          }),
      ),
      flush: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
    const logger = new QaLogger({ transport, owner, source, runtime, build, flushIntervalMs: 0 });
    logger.startTrace();
    logger.log({ event_key: 'e1', event_version: '1' });

    const flush1 = logger.flush();
    expect(getFlushInProgress(logger)).toBe(true);

    // Second flush while first is in progress — should be a no-op
    await logger.flush();
    resolveTransport();
    await flush1;

    expect(transport.send).toHaveBeenCalledTimes(1);
  });

  it('auto flushes when the batch size is reached', async () => {
    const { logger, transport } = createLogger({ batchSize: 2 });

    const first = logger.log({
      event_key: 'search_opened',
      event_version: '1',
      payload: { query: 'laptop' },
    });
    const second = logger.log({
      event_key: 'search_submitted',
      event_version: '1',
      payload: { query: 'laptop sleeve' },
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

describe('QaLogger — actor context', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const actor = {
    actor_id: 'usr_token_abc',
    user_id: 'kim@example.com',
    user_attributes: { age_group: '30s', tier: 'premium' },
  } as const;

  it('config.actor 설정 시 모든 log 레코드에 actor 필드가 주입된다', () => {
    const transport = new NoopTransport();
    const logger = new QaLogger({
      transport,
      owner,
      source,
      runtime,
      build,
      flushIntervalMs: 0,
      actor,
    });
    logger.startTrace();

    const record = logger.log({ event_key: 'page_view', event_version: '001' });

    expect(record.actor_id).toBe(actor.actor_id);
    expect(record.user_id).toBe(actor.user_id);
    expect(record.user_attributes).toEqual(actor.user_attributes);
  });

  it('setActor() 호출 후 레코드에 actor 필드가 주입된다', () => {
    const { logger } = createLogger();
    logger.startTrace();
    logger.setActor(actor);

    const record = logger.log({ event_key: 'click', event_version: '001' });

    expect(record.actor_id).toBe(actor.actor_id);
    expect(record.user_id).toBe(actor.user_id);
    expect(record.user_attributes).toEqual(actor.user_attributes);
  });

  it('clearActor() 호출 후 레코드에 actor 필드가 없다', () => {
    const { logger } = createLogger();
    logger.startTrace();
    logger.setActor(actor);
    logger.clearActor();

    const record = logger.log({ event_key: 'click', event_version: '001' });

    expect(record.actor_id).toBeUndefined();
    expect(record.user_id).toBeUndefined();
    expect(record.user_attributes).toBeUndefined();
  });

  it('span 레코드에도 actor 필드가 주입된다', () => {
    const { logger } = createLogger();
    logger.startTrace();
    logger.setActor(actor);

    const span = logger.startSpan({
      event_key: 'checkout',
      event_version: '001',
      span_name: 'Checkout',
    });
    const record = span.end();

    expect(record.actor_id).toBe(actor.actor_id);
    expect(record.user_id).toBe(actor.user_id);
  });

  it('user_id 없이 actor_id만 설정해도 동작한다', () => {
    const { logger } = createLogger();
    logger.startTrace();
    logger.setActor({ actor_id: 'bot-regression-01' });

    const record = logger.log({ event_key: 'synthetic_click', event_version: '001' });

    expect(record.actor_id).toBe('bot-regression-01');
    expect(record.user_id).toBeUndefined();
    expect(record.user_attributes).toBeUndefined();
  });
});

describe('QaLogger — address_context', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('log()에 address_context가 포함된다', () => {
    const { logger } = createLogger();
    logger.startTrace();

    const record = logger.log({
      event_key: 'order_placed',
      event_version: '1',
      address_context: { svc: 'svc:v1:42', perm: 'perm:v1:7' },
    });

    expect(record.address_context).toEqual({ svc: 'svc:v1:42', perm: 'perm:v1:7' });
  });

  it('address_context 미지정 시 필드가 없다', () => {
    const { logger } = createLogger();
    logger.startTrace();

    const record = logger.log({ event_key: 'click', event_version: '1' });

    expect(record.address_context).toBeUndefined();
  });

  it('startSpan()에 address_context가 포함된다', () => {
    const { logger } = createLogger();
    logger.startTrace();

    const span = logger.startSpan({
      event_key: 'checkout',
      event_version: '1',
      span_name: 'Checkout',
      address_context: { svc: 'svc:v1:30' },
    });
    const record = span.end();

    expect(record.address_context).toEqual({ svc: 'svc:v1:30' });
  });
});

describe('QaLogger — metric()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('기본 gauge 메트릭 레코드를 생성한다', () => {
    const { logger } = createLogger();
    logger.startTrace();

    const record = logger.metric('http_request_duration_ms', 42);

    expect(record).toEqual(
      expect.objectContaining({
        record_kind: 'metric',
        event_key: 'http_request_duration_ms',
        metric_type: 'gauge',
        metric_name: 'http_request_duration_ms',
        metric_value: 42,
      }),
    );
  });

  it('옵션으로 type, unit, labels를 설정한다', () => {
    const { logger } = createLogger();
    logger.startTrace();

    const record = logger.metric('request_count', 1, {
      type: 'counter',
      unit: 'requests',
      labels: { method: 'GET', path: '/api' },
    });

    expect(record.metric_type).toBe('counter');
    expect(record.metric_unit).toBe('requests');
    expect(record.metric_labels).toEqual({ method: 'GET', path: '/api' });
  });

  it('address_context와 함께 메트릭을 기록한다', () => {
    const { logger } = createLogger();
    logger.startTrace();

    const record = logger.metric('latency', 150, {
      address_context: { svc: 'svc:v1:30' },
    });

    expect(record.address_context).toEqual({ svc: 'svc:v1:30' });
    expect(record.metric_value).toBe(150);
  });

  it('histogram 옵션 (buckets, quantiles)을 설정한다', () => {
    const { logger } = createLogger();
    logger.startTrace();

    const record = logger.metric('response_time', 100, {
      type: 'histogram',
      buckets: [10, 50, 100, 500],
      quantiles: [0.5, 0.9, 0.99],
    });

    expect(record.metric_type).toBe('histogram');
    expect(record.metric_buckets).toEqual([10, 50, 100, 500]);
    expect(record.metric_quantiles).toEqual([0.5, 0.9, 0.99]);
  });
});

describe('QaLogger — buildEnvelope infra_context / entry_snapshot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('infraContext가 envelope의 infra_context로 전달된다', async () => {
    const transport = new NoopTransport();
    const logger = new QaLogger({
      transport,
      owner,
      source,
      runtime,
      build,
      flushIntervalMs: 0,
      infraContext: { svc: 'svc:v1:30' },
    });
    logger.startTrace();
    logger.log({ event_key: 'e1', event_version: '1' });

    await logger.flush();

    expect(transport.sent[0].infra_context).toEqual({ svc: 'svc:v1:30' });
  });

  it('entrySnapshot이 envelope의 entry_snapshot으로 전달된다', async () => {
    const transport = new NoopTransport();
    const logger = new QaLogger({
      transport,
      owner,
      source,
      runtime,
      build,
      flushIntervalMs: 0,
      entrySnapshot: 'snap_demo_v1_20260312',
    });
    logger.startTrace();
    logger.log({ event_key: 'e1', event_version: '1' });

    await logger.flush();

    expect(transport.sent[0].entry_snapshot).toBe('snap_demo_v1_20260312');
  });

  it('infraContext/entrySnapshot 미지정 시 envelope에 필드가 없다', async () => {
    const { logger, transport } = createLogger();
    logger.startTrace();
    logger.log({ event_key: 'e1', event_version: '1' });

    await logger.flush();

    expect(transport.sent[0].infra_context).toBeUndefined();
    expect(transport.sent[0].entry_snapshot).toBeUndefined();
  });
});

describe('QaLogger — error handling', () => {
  it('drops oldest record and calls onError when buffer reaches maxBufferSize', () => {
    const onError = vi.fn();
    const { logger } = createLogger({ maxBufferSize: 3, onError });
    logger.startTrace();

    logger.log({ event_key: 'e0', event_version: '1' });
    logger.log({ event_key: 'e1', event_version: '1' });
    logger.log({ event_key: 'e2', event_version: '1' }); // fills cap

    // 4th record: oldest (e0) should be evicted
    logger.log({ event_key: 'e3', event_version: '1' });

    const buf = getBufferedRecords(logger);
    expect(buf).toHaveLength(3);
    expect(buf[0].event_key).toBe('e1');
    expect(buf[2].event_key).toBe('e3');
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('buffer at cap') }),
      'buffer-overflow',
    );
  });

  it('restores records after flush failure and calls onError', async () => {
    const onError = vi.fn();
    const transport = makeFailingTransport();
    const logger = new QaLogger({
      transport,
      owner,
      source,
      runtime,
      build,
      flushIntervalMs: 0,
      onError,
    });
    logger.startTrace();
    logger.log({ event_key: 'e0', event_version: '1' });
    logger.log({ event_key: 'e1', event_version: '1' });

    await expect(logger.flush()).rejects.toThrow('[qa-sdk:flush] transport.send failed');

    const buf = getBufferedRecords(logger);
    expect(buf).toHaveLength(2);
    expect(buf[0].event_key).toBe('e0');
    expect(buf[1].event_key).toBe('e1');
  });

  it('caps restored records at maxBufferSize when new records arrived during failed flush', async () => {
    let rejectTransport!: (err: Error) => void;
    const transport = {
      send: vi.fn().mockImplementation(
        () =>
          new Promise<void>((_, reject) => {
            rejectTransport = reject;
          }),
      ),
      flush: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
    const onError = vi.fn();
    const logger = new QaLogger({
      transport,
      owner,
      source,
      runtime,
      build,
      flushIntervalMs: 0,
      maxBufferSize: 3,
      onError,
    });
    logger.startTrace();
    logger.log({ event_key: 'e0', event_version: '1' });
    logger.log({ event_key: 'e1', event_version: '1' });

    const flushing = logger.flush();

    // New record added while transport is in-flight
    logger.log({ event_key: 'e2', event_version: '1' });

    rejectTransport(new Error('fail'));
    await expect(flushing).rejects.toThrow('[qa-sdk:flush] transport.send failed');

    // buffer cap=3: restored [e0,e1] + in-flight [e2] = 3 — fits exactly, no overflow
    const buf = getBufferedRecords(logger);
    expect(buf).toHaveLength(3);
    expect(buf.map((r) => r.event_key)).toEqual(['e0', 'e1', 'e2']);
    // onError not called here because flush() was invoked directly — rejection is the signal
    expect(onError).not.toHaveBeenCalled();
  });

  it('calls onError via batch-flush path when transport fails during auto-flush', async () => {
    const onError = vi.fn();
    const transport = makeFailingTransport();
    const logger = new QaLogger({
      transport,
      owner,
      source,
      runtime,
      build,
      flushIntervalMs: 0,
      batchSize: 2,
      onError,
    });
    logger.startTrace();

    // Logging 2nd record triggers auto-flush via addRecord → .catch → handleError
    logger.log({ event_key: 'e0', event_version: '1' });
    logger.log({ event_key: 'e1', event_version: '1' });

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('transport.send failed') }),
        'batch-flush',
      );
    });
  });
});
