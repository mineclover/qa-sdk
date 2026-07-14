// @def.boundary observability-system-root
// @def.doc observability-system-root

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IngestForwarder, createIngestForwarder } from './ingest-forwarder.js';
import type { LogIngestBridgeConfig } from './ingest-forwarder.js';

// ── 테스트 유틸 ──────────────────────────────────────────

function baseConfig(overrides?: Partial<LogIngestBridgeConfig>): LogIngestBridgeConfig {
  return {
    endpoint: 'http://localhost:3200/v1/ingest',
    serviceName: 'test-service',
    batchSize: 3,
    flushIntervalMs: 0, // 타이머 비활성 (수동 flush)
    maxBufferSize: 10,
    timeoutMs: 5_000,
    ...overrides,
  };
}

/** addressContext 포함 pino log JSON */
function coordLog(ctx: Record<string, string>, extra?: Record<string, unknown>): string {
  return JSON.stringify({
    level: 30,
    time: Date.now(),
    name: 'test-service',
    msg: '테스트 로그',
    addressContext: ctx,
    ...extra,
  });
}

/** addressContext 없는 일반 pino log JSON */
function plainLog(msg = '일반 로그'): string {
  return JSON.stringify({
    level: 30,
    time: Date.now(),
    name: 'test-service',
    msg,
  });
}

// ── Filter ──────────────────────────────────────────────

describe('IngestForwarder 필터', () => {
  it('addressContext 없는 로그는 skip', async () => {
    const forwarder = new IngestForwarder(baseConfig());
    forwarder.write(plainLog());
    forwarder.write(plainLog('두번째'));

    const stats = forwarder.getStats();
    expect(stats.filtered).toBe(2);
    expect(stats.forwarded).toBe(0);
    await forwarder.shutdown();
  });

  it('addressContext가 빈 객체면 skip', async () => {
    const forwarder = new IngestForwarder(baseConfig());
    forwarder.write(
      JSON.stringify({
        level: 30,
        time: Date.now(),
        msg: '빈 컨텍스트',
        addressContext: {},
      }),
    );

    expect(forwarder.getStats().filtered).toBe(1);
    await forwarder.shutdown();
  });

  it('addressContext가 있으면 버퍼에 추가', async () => {
    const forwarder = new IngestForwarder(baseConfig());
    forwarder.write(coordLog({ service: 'service:v1:42' }));

    const stats = forwarder.getStats();
    expect(stats.filtered).toBe(0);
    // 아직 flush 안 됨 (batchSize=3, 1개만 넣음)
    expect(stats.forwarded).toBe(0);
    expect(stats.flushCount).toBe(0);
    await forwarder.shutdown();
  });

  it('잘못된 JSON은 drop', async () => {
    const forwarder = new IngestForwarder(baseConfig());
    forwarder.write('not json{{{');

    expect(forwarder.getStats().dropped).toBe(1);
    await forwarder.shutdown();
  });
});

// ── Transform ───────────────────────────────────────────

describe('IngestForwarder 변환', () => {
  it('event_key 자동 생성 (svc_log.info)', async () => {
    const sent: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push(JSON.parse(init.body as string));
        return new Response(JSON.stringify({ accepted: true }), { status: 202 });
      }),
    );

    const forwarder = new IngestForwarder(baseConfig({ batchSize: 1 }));
    forwarder.write(coordLog({ service: 'service:v1:1' }));

    // batchSize=1이므로 즉시 flush
    await vi.waitFor(() => expect(sent.length).toBe(1));

    const envelope = sent[0] as { records: Array<{ event_key: string }> };
    expect(envelope.records[0].event_key).toBe('svc_log.info');

    await forwarder.shutdown();
    vi.unstubAllGlobals();
  });

  it('명시적 eventKey가 우선', async () => {
    const sent: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push(JSON.parse(init.body as string));
        return new Response(JSON.stringify({ accepted: true }), { status: 202 });
      }),
    );

    const forwarder = new IngestForwarder(baseConfig({ batchSize: 1 }));
    forwarder.write(coordLog({ permission: 'permission:v1:7' }, { eventKey: 'auth.grant.admin' }));

    await vi.waitFor(() => expect(sent.length).toBe(1));

    const envelope = sent[0] as { records: Array<{ event_key: string }> };
    expect(envelope.records[0].event_key).toBe('auth.grant.admin');

    await forwarder.shutdown();
    vi.unstubAllGlobals();
  });

  it('address_context가 EventRecord에 그대로 전달', async () => {
    const sent: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push(JSON.parse(init.body as string));
        return new Response(JSON.stringify({ accepted: true }), { status: 202 });
      }),
    );

    const ctx = { service: 'service:v1:42', permission: 'permission:v1:7' };
    const forwarder = new IngestForwarder(baseConfig({ batchSize: 1 }));
    forwarder.write(coordLog(ctx));

    await vi.waitFor(() => expect(sent.length).toBe(1));

    const envelope = sent[0] as { records: Array<{ address_context: Record<string, string> }> };
    expect(envelope.records[0].address_context).toEqual(ctx);

    await forwarder.shutdown();
    vi.unstubAllGlobals();
  });

  it('traceId/spanId 명시 시 그대로 사용', async () => {
    const sent: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push(JSON.parse(init.body as string));
        return new Response(JSON.stringify({ accepted: true }), { status: 202 });
      }),
    );

    const forwarder = new IngestForwarder(baseConfig({ batchSize: 1 }));
    forwarder.write(
      coordLog({ service: 'service:v1:1' }, { traceId: 'trc_CUSTOM', spanId: 'spn_CUSTOM' }),
    );

    await vi.waitFor(() => expect(sent.length).toBe(1));

    const record = (sent[0] as { records: Array<{ trace_id: string; span_id: string }> })
      .records[0];
    expect(record.trace_id).toBe('trc_CUSTOM');
    expect(record.span_id).toBe('spn_CUSTOM');

    await forwarder.shutdown();
    vi.unstubAllGlobals();
  });

  it('예약 필드는 payload에서 제외', async () => {
    const sent: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push(JSON.parse(init.body as string));
        return new Response(JSON.stringify({ accepted: true }), { status: 202 });
      }),
    );

    const forwarder = new IngestForwarder(baseConfig({ batchSize: 1 }));
    forwarder.write(coordLog({ service: 'service:v1:1' }, { userId: 'u123', latency: 42 }));

    await vi.waitFor(() => expect(sent.length).toBe(1));

    const payload = (sent[0] as { records: Array<{ payload: Record<string, unknown> }> }).records[0]
      .payload;
    // msg, service는 포함
    expect(payload.msg).toBe('테스트 로그');
    expect(payload.service).toBe('test-service');
    // 비즈니스 필드는 포함
    expect(payload.userId).toBe('u123');
    expect(payload.latency).toBe(42);
    // 예약 필드는 제외
    expect(payload).not.toHaveProperty('addressContext');
    expect(payload).not.toHaveProperty('time');
    expect(payload).not.toHaveProperty('pid');

    await forwarder.shutdown();
    vi.unstubAllGlobals();
  });
});

// ── Batching ────────────────────────────────────────────

describe('IngestForwarder 배치', () => {
  it('batchSize 도달 시 자동 flush', async () => {
    const sent: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push(JSON.parse(init.body as string));
        return new Response(JSON.stringify({ accepted: true }), { status: 202 });
      }),
    );

    const forwarder = new IngestForwarder(baseConfig({ batchSize: 3 }));
    forwarder.write(coordLog({ s: 's:v1:1' }));
    forwarder.write(coordLog({ s: 's:v1:2' }));
    // 아직 2개 — flush 안 됨
    expect(sent.length).toBe(0);

    forwarder.write(coordLog({ s: 's:v1:3' }));
    // 3개 도달 → 자동 flush (async이므로 waitFor)
    await vi.waitFor(() => expect(sent.length).toBe(1));
    await vi.waitFor(() => expect(forwarder.getStats().forwarded).toBe(3));

    const envelope = sent[0] as { records: unknown[] };
    expect(envelope.records.length).toBe(3);

    await forwarder.shutdown();
    vi.unstubAllGlobals();
  });

  it('shutdown 시 잔여 버퍼 drain', async () => {
    const sent: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push(JSON.parse(init.body as string));
        return new Response(JSON.stringify({ accepted: true }), { status: 202 });
      }),
    );

    const forwarder = new IngestForwarder(baseConfig({ batchSize: 100 }));
    forwarder.write(coordLog({ s: 's:v1:1' }));
    forwarder.write(coordLog({ s: 's:v1:2' }));

    // batchSize 미도달 → flush 안 됨
    expect(sent.length).toBe(0);

    await forwarder.shutdown();

    // shutdown이 잔여 drain
    expect(sent.length).toBe(1);
    const envelope = sent[0] as { records: unknown[] };
    expect(envelope.records.length).toBe(2);
  });
});

// ── Overflow ────────────────────────────────────────────

describe('IngestForwarder overflow', () => {
  it('maxBufferSize 초과 시 oldest drop', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ accepted: true }), { status: 202 })),
    );

    const forwarder = new IngestForwarder(
      baseConfig({
        batchSize: 100, // 높게 → 자동 flush 방지
        maxBufferSize: 3,
      }),
    );

    forwarder.write(coordLog({ s: 's:v1:1' }));
    forwarder.write(coordLog({ s: 's:v1:2' }));
    forwarder.write(coordLog({ s: 's:v1:3' }));
    // 여기까지 3개 (maxBufferSize)

    forwarder.write(coordLog({ s: 's:v1:4' }));
    // 4번째 → oldest(1번) drop

    expect(forwarder.getStats().dropped).toBe(1);

    await forwarder.shutdown();
    vi.unstubAllGlobals();
  });
});

// ── Fail-open ───────────────────────────────────────────

describe('IngestForwarder fail-open', () => {
  it('HTTP 에러 시 throw 없이 drop', async () => {
    const errors: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Internal Server Error', { status: 500 })),
    );

    const forwarder = new IngestForwarder(
      baseConfig({
        batchSize: 1,
        onError: (err) => errors.push(err),
      }),
    );

    forwarder.write(coordLog({ s: 's:v1:1' }));

    await vi.waitFor(() => expect(forwarder.getStats().flushCount).toBe(1));

    expect(forwarder.getStats().dropped).toBe(1);
    expect(forwarder.getStats().forwarded).toBe(0);
    expect(errors.length).toBe(1);

    await forwarder.shutdown();
    vi.unstubAllGlobals();
  });

  it('네트워크 에러 시 throw 없이 drop', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );

    const forwarder = new IngestForwarder(baseConfig({ batchSize: 1 }));
    forwarder.write(coordLog({ s: 's:v1:1' }));

    await vi.waitFor(() => expect(forwarder.getStats().flushCount).toBe(1));

    expect(forwarder.getStats().dropped).toBe(1);

    await forwarder.shutdown();
    vi.unstubAllGlobals();
  });
});

// ── Envelope 구조 ───────────────────────────────────────

describe('IngestForwarder envelope', () => {
  it('envelope 메타데이터가 올바르게 구성', async () => {
    const sent: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push(JSON.parse(init.body as string));
        return new Response(JSON.stringify({ accepted: true }), { status: 202 });
      }),
    );

    const forwarder = new IngestForwarder(
      baseConfig({
        batchSize: 1,
        serviceName: 'my-service',
        buildEnv: 'staging',
        infraContext: { service: 'service:v1:99' },
      }),
    );

    forwarder.write(coordLog({ permission: 'permission:v1:1' }));
    await vi.waitFor(() => expect(sent.length).toBe(1));

    const envelope = sent[0] as Record<string, unknown>;
    expect(envelope.transmission_id).toMatch(/^txm_/);
    expect(envelope.sent_at).toBeTruthy();
    expect(envelope.owner).toEqual({ owner_type: 'agent', owner_id: 'svc:my-service' });
    expect(envelope.source).toEqual({
      service_name: 'my-service',
      sdk_name: '@qa-sdk/logger',
      sdk_version: '0.1.0',
    });
    expect(envelope.build).toEqual({ env: 'staging' });
    expect(envelope.infra_context).toEqual({ service: 'service:v1:99' });

    await forwarder.shutdown();
    vi.unstubAllGlobals();
  });
});

// ── Factory ─────────────────────────────────────────────

describe('createIngestForwarder', () => {
  it('IngestForwarder 인스턴스를 반환', async () => {
    const forwarder = createIngestForwarder(baseConfig());
    expect(forwarder).toBeInstanceOf(IngestForwarder);
    await forwarder.shutdown();
  });
});
