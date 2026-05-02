import { BROWSER_CATALOG, decode, type BrowserCatalog } from '@qa-sdk/browser-codec';
import { NoopTransport, type TransmissionEnvelope, type Transport } from '@qa-sdk/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_BROWSER_CATALOG } from './browser-catalog.js';
import { createQaBridge } from './qa-bridge.js';

function setupBrowserGlobals(): void {
  vi.stubGlobal('navigator', { userAgent: 'vitest/bridge' });
}

function setupFetch(ok = true): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function parseSentRecords(
  fetchMock: ReturnType<typeof vi.fn>,
  callIndex = 0,
): Array<Record<string, unknown>> {
  const init = fetchMock.mock.calls[callIndex]?.[1] as RequestInit | undefined;
  const body = JSON.parse((init?.body as string | undefined) ?? '{"records":[]}');
  return body.records as Array<Record<string, unknown>>;
}

describe('createQaBridge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setupBrowserGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('transport 미지정 시 noop bridge를 만든다', async () => {
    const bridge = createQaBridge({
      serviceName: 'viteplus-sdk-smoke',
      owner: { owner_type: 'workspace', owner_id: 'qa-sdk' },
      buildEnv: 'test',
      flushIntervalMs: 0,
    });

    const { sessionId, traceId } = bridge.startSession('smoke');
    bridge.emitEvent('sdk_smoke_loaded', { source: 'test' });
    await bridge.shutdown();

    const envelopes = bridge.getDebugEnvelopes();
    expect(bridge.transportMode).toBe('noop');
    expect(sessionId).toMatch(/^qas_/);
    expect(traceId).toMatch(/^trc_/);
    expect(envelopes).toHaveLength(1);
    expect(envelopes[0]?.records[0]?.event_key).toBe('session_start');
    expect(envelopes[0]?.records[1]?.event_key).toBe('sdk_smoke_loaded');
  });

  it('ingestUrl이 있으면 /v1/ingest를 붙여 HttpTransport를 사용한다', async () => {
    const fetchMock = setupFetch();
    const bridge = createQaBridge({
      serviceName: 'viteplus-sdk-smoke',
      owner: { owner_type: 'workspace', owner_id: 'qa-sdk' },
      buildEnv: 'test',
      ingestUrl: 'http://ingest.local/',
      flushIntervalMs: 0,
    });

    bridge.startSession();
    bridge.emitEvent('click', { element_id: 'cta' });
    await bridge.flush();

    expect(bridge.transportMode).toBe('http');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://ingest.local/v1/ingest');
    const records = parseSentRecords(fetchMock);
    const clickRecord = records.find((record) => record.event_key === 'click');
    expect(clickRecord?.event_version).toBe('001');
  });

  it('custom transport를 주입하면 custom mode로 유지한다', async () => {
    class MemoryTransport implements Transport {
      readonly sent: TransmissionEnvelope[] = [];

      async send(envelope: TransmissionEnvelope): Promise<void> {
        this.sent.push(envelope);
      }

      async flush(): Promise<void> {}

      async shutdown(): Promise<void> {}
    }

    const transport = new MemoryTransport();
    const bridge = createQaBridge({
      serviceName: 'viteplus-sdk-smoke',
      owner: { owner_type: 'workspace', owner_id: 'qa-sdk' },
      buildEnv: 'test',
      flushIntervalMs: 0,
      transport,
    });

    bridge.startSession();
    bridge.emitEvent('unknown_bridge_event');
    expect(bridge.transportMode).toBe('custom');
    expect(bridge.getDebugEnvelopes()).toHaveLength(0);
    await bridge.shutdown();
    expect(transport.sent).toHaveLength(1);
  });

  it('명시적 eventVersion을 주면 3자리로 패딩한다', async () => {
    const bridge = createQaBridge({
      serviceName: 'viteplus-sdk-smoke',
      owner: { owner_type: 'workspace', owner_id: 'qa-sdk' },
      buildEnv: 'test',
      flushIntervalMs: 0,
      transport: new NoopTransport(),
    });

    bridge.startSession();
    bridge.emitEvent('template_event', undefined, { eventVersion: '7' });
    await bridge.shutdown();

    const envelopes = bridge.getDebugEnvelopes();
    const record = envelopes[0]?.records.find((entry) => entry.event_key === 'template_event');
    expect(record?.event_version).toBe('007');
  });

  it('serviceConfig가 있으면 catalog에 없는 서비스도 local overlay로 infra_context.service를 남긴다', async () => {
    const bridge = createQaBridge({
      serviceName: 'viteplus-sdk-smoke',
      owner: { owner_type: 'workspace', owner_id: 'qa-sdk' },
      buildEnv: 'test',
      flushIntervalMs: 0,
      transport: new NoopTransport(),
      serviceConfig: {
        namespace: 'shop',
        name: 'confirm-web',
        env: 'local',
        region: 'asia',
      },
    });

    bridge.startSession();
    bridge.emitEvent('sdk_smoke_loaded');
    await bridge.shutdown();

    const serialized = bridge.getDebugEnvelopes()[0]?.infra_context?.service;
    expect(serialized).toMatch(/^service:v\d+:\d+$/);

    const decoded = serialized ? decode(BROWSER_CATALOG, serialized) : null;
    expect(decoded?.values.svc_name).not.toBe('confirm-web');

    const localDecoded = decode(LOCAL_BROWSER_CATALOG, serialized ?? '');
    expect(localDecoded?.values.svc_name).not.toBe('confirm-web');

    const overlayCatalog = {
      ...LOCAL_BROWSER_CATALOG,
      service: {
        ...LOCAL_BROWSER_CATALOG.service,
        dims: {
          ...LOCAL_BROWSER_CATALOG.service.dims,
          svc_name: {
            ...LOCAL_BROWSER_CATALOG.service.dims.svc_name,
            entries: [
              ...(LOCAL_BROWSER_CATALOG.service.dims.svc_name.entries ?? []),
              'confirm-web',
            ],
          },
        },
      },
    } satisfies BrowserCatalog;
    const overlayDecoded = decode(overlayCatalog, serialized ?? '');
    expect(overlayDecoded?.values).toMatchObject({
      env: 'local',
      region: 'asia',
      svc_name: 'confirm-web',
      namespace: 'shop',
    });
  });

  it('overlay조차 불가능하면 fail-open으로 infra_context를 생략한다', async () => {
    const onError = vi.fn();
    const constrainedCatalog: BrowserCatalog = {
      ...BROWSER_CATALOG,
      service: {
        ...BROWSER_CATALOG.service,
        dims: {
          ...BROWSER_CATALOG.service.dims,
          svc_name: {
            ...BROWSER_CATALOG.service.dims.svc_name,
            capacity: BROWSER_CATALOG.service.dims.svc_name.entries?.length ?? 0,
          },
        },
      },
    };
    const bridge = createQaBridge({
      serviceName: 'viteplus-sdk-smoke',
      owner: { owner_type: 'workspace', owner_id: 'qa-sdk' },
      buildEnv: 'test',
      flushIntervalMs: 0,
      transport: new NoopTransport(),
      onError,
      browserCatalog: constrainedCatalog,
      serviceConfig: {
        namespace: 'shop',
        name: 'confirm-web',
        env: 'local',
        region: 'asia',
      },
    });

    bridge.startSession();
    bridge.emitEvent('sdk_smoke_loaded');
    await bridge.shutdown();

    expect(bridge.getDebugEnvelopes()[0]?.infra_context?.service).toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'infra-context');
  });
});
