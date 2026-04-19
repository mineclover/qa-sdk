// @def.boundary experience-layer-group
// @def.doc experience-layer-group

import { BROWSER_CATALOG, decode, withServiceOverlay } from '@qa-sdk/browser-codec';
import { NoopTransport } from '@qa-sdk/sdk';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LOCAL_BROWSER_CATALOG } from './browser-catalog.js';
import { createQaBridge } from './qa-bridge.js';

function setupFetch(ok = true): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('navigator', { userAgent: 'vitest/1.0' });
  return fetchMock;
}

function parseSentRecords(fetchMock: ReturnType<typeof vi.fn>, callIndex = 0) {
  const body = JSON.parse((fetchMock.mock.calls[callIndex][1] as RequestInit).body as string);
  return body.records as Array<Record<string, unknown>>;
}

describe('QaBridge — startSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('새 traceId와 sessionId를 반환한다', () => {
    setupFetch();
    const bridge = createQaBridge({ ingestUrl: 'http://test' });
    const { traceId, sessionId } = bridge.startSession();

    expect(bridge.transportMode).toBe('http');
    expect(typeof traceId).toBe('string');
    expect(traceId.length).toBeGreaterThan(0);
    expect(typeof sessionId).toBe('string');
    expect(sessionId.length).toBeGreaterThan(0);
    void bridge.shutdown();
  });

  it('existingSessionId를 전달하면 그 값이 sessionId로 사용된다', () => {
    setupFetch();
    const bridge = createQaBridge({ ingestUrl: 'http://test' });
    const { sessionId } = bridge.startSession(undefined, 'ses_provided');

    expect(sessionId).toBe('ses_provided');
    void bridge.shutdown();
  });

  it('scenarioId 제공 시 session_start 이벤트가 전송된다', async () => {
    const fetchMock = setupFetch();
    const bridge = createQaBridge({ ingestUrl: 'http://test' });
    bridge.startSession('checkout_v1');
    await bridge.flush();

    const records = parseSentRecords(fetchMock);
    const sessionStart = records.find((r) => r.event_key === 'session_start');
    expect(sessionStart).toBeDefined();
    expect(sessionStart?.payload).toMatchObject({ scenario_id: 'checkout_v1' });
  });

  it('scenarioId 미제공 시 session_start 이벤트가 전송되지 않는다', async () => {
    const fetchMock = setupFetch();
    const bridge = createQaBridge({ ingestUrl: 'http://test' });
    bridge.startSession();
    bridge.emitEvent('page_view', { page: '/' });
    await bridge.flush();

    const records = parseSentRecords(fetchMock);
    const sessionStart = records.find((r) => r.event_key === 'session_start');
    expect(sessionStart).toBeUndefined();
  });
});

describe('QaBridge — emitEvent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('알려진 이벤트 키는 event-catalog의 버전을 3자리로 패딩해 사용한다', async () => {
    const fetchMock = setupFetch();
    const bridge = createQaBridge({ ingestUrl: 'http://test' });
    bridge.startSession();
    bridge.emitEvent('click', { element_id: 'btn' });
    await bridge.flush();

    const records = parseSentRecords(fetchMock);
    const clickRecord = records.find((r) => r.event_key === 'click');
    expect(clickRecord?.event_version).toBe('001');
  });

  it('명시적 eventVersion을 주면 3자리 문자열로 맞춘다', async () => {
    const bridge = createQaBridge({ transport: new NoopTransport(), flushIntervalMs: 0 });
    bridge.startSession();
    bridge.emitEvent('roleplay_custom_event', { ok: true }, { eventVersion: '7' });
    await bridge.shutdown();

    const records = bridge.getDebugEnvelopes()[0]?.records;
    const record = records?.find((r) => r.event_key === 'roleplay_custom_event');
    expect(bridge.transportMode).toBe('noop');
    expect(record?.event_version).toBe('007');
  });

  it("미등록 이벤트 키는 '001'로 fallback된다", async () => {
    const fetchMock = setupFetch();
    const bridge = createQaBridge({ ingestUrl: 'http://test' });
    bridge.startSession();
    bridge.emitEvent('completely_unknown_event_xyz');
    await bridge.flush();

    const records = parseSentRecords(fetchMock);
    const record = records.find((r) => r.event_key === 'completely_unknown_event_xyz');
    expect(record?.event_version).toBe('001');
  });

  it('emit한 이벤트가 올바른 엔드포인트로 전송된다', async () => {
    const fetchMock = setupFetch();
    const bridge = createQaBridge({ ingestUrl: 'http://ingest-server:3200' });
    bridge.startSession();
    bridge.emitEvent('page_view', { page: '/home' });
    await bridge.flush();

    expect(fetchMock.mock.calls[0][0]).toBe('http://ingest-server:3200/v1/ingest');
  });

  it('startSession으로 설정된 sessionId가 각 레코드의 qa_session_id에 포함된다', async () => {
    const fetchMock = setupFetch();
    const bridge = createQaBridge({ ingestUrl: 'http://test' });
    const { sessionId } = bridge.startSession();
    bridge.emitEvent('click');
    await bridge.flush();

    const records = parseSentRecords(fetchMock);
    const clickRecord = records.find((r) => r.event_key === 'click');
    expect(clickRecord?.qa_session_id).toBe(sessionId);
  });

  it('noop transport를 주입하면 디버그 엔벨로프를 조회할 수 있다', async () => {
    const bridge = createQaBridge({ transport: new NoopTransport(), flushIntervalMs: 0 });
    bridge.startSession('roleplay_scenario');
    bridge.emitEvent('page_view', { page: '/' });
    await bridge.shutdown();

    const envelopes = bridge.getDebugEnvelopes();
    expect(envelopes).toHaveLength(1);
    expect(envelopes[0]?.records[0]?.event_key).toBe('session_start');
    expect(envelopes[0]?.records[1]?.event_key).toBe('page_view');
  });

  it('serviceConfig가 있으면 infra_context.service에 service prefix를 남긴다', async () => {
    const bridge = createQaBridge({
      transport: new NoopTransport(),
      flushIntervalMs: 0,
      serviceConfig: {
        namespace: 'shop',
        name: 'roleplay-web',
        env: 'local',
        region: 'asia',
      },
    });

    bridge.startSession();
    bridge.emitEvent('page_view', { page: '/' });
    await bridge.shutdown();

    const serialized = bridge.getDebugEnvelopes()[0]?.infra_context?.service;
    expect(serialized).toMatch(/^service:v\d+:\d+$/);

    const decoded = serialized ? decode(BROWSER_CATALOG, serialized) : null;
    expect(decoded?.values).toMatchObject({
      env: 'local',
      region: 'asia',
      svc_name: 'roleplay-web',
      namespace: 'shop',
    });

    const localDecoded = serialized ? decode(LOCAL_BROWSER_CATALOG, serialized) : null;
    expect(localDecoded?.values).toMatchObject({
      env: 'local',
      region: 'asia',
      svc_name: 'roleplay-web',
      namespace: 'shop',
    });

    const overlayCatalog = withServiceOverlay(BROWSER_CATALOG, {
      env: 'local',
      region: 'asia',
      svc_name: 'roleplay-web',
      namespace: 'shop',
    });
    const overlayDecoded = serialized ? decode(overlayCatalog, serialized) : null;
    expect(overlayDecoded?.values).toMatchObject({
      env: 'local',
      region: 'asia',
      svc_name: 'roleplay-web',
      namespace: 'shop',
    });
  });
});

describe('QaBridge — flush & shutdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('flush()는 버퍼의 이벤트를 즉시 전송한다', async () => {
    const fetchMock = setupFetch();
    const bridge = createQaBridge({ ingestUrl: 'http://test' });
    bridge.startSession();
    bridge.emitEvent('page_view', { page: '/' });
    bridge.emitEvent('click');

    expect(fetchMock).not.toHaveBeenCalled();
    await bridge.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shutdown()은 남은 이벤트를 전송하고 완료한다', async () => {
    const fetchMock = setupFetch();
    const bridge = createQaBridge({ ingestUrl: 'http://test' });
    bridge.startSession();
    bridge.emitEvent('session_end');

    await bridge.shutdown();

    expect(fetchMock).toHaveBeenCalled();
  });

  it('onError 콜백은 자동 flush 실패 시 호출된다', async () => {
    setupFetch(false);
    const onError = vi.fn();
    const bridge = createQaBridge({ ingestUrl: 'http://test', onError });
    bridge.startSession();
    bridge.emitEvent('click');

    await vi.advanceTimersByTimeAsync(3_000);

    expect(onError).toHaveBeenCalled();
  });
});
