/**
 * QaMonitor 통합 테스트 — 단위 mock 수준을 넘어
 * 실제 emit → buffer → flush → HTTP 전송 파이프라인을 검증한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createQaMonitorAsync, QaMonitor } from './monitor.js';
import type { TransmissionEnvelope } from '@qa-sdk/core';
import { toServiceDims } from '@qa-sdk/core';
import { BROWSER_CATALOG, decode, withServiceOverlay } from '@qa-sdk/browser-codec';

// sendBeacon을 사용하지 않도록 설정하고 fetch를 캡처한다
function setupCaptureFetch(): { calls: () => TransmissionEnvelope[] } {
  const bodies: TransmissionEnvelope[] = [];
  vi.stubGlobal('navigator', {
    userAgent: 'vitest/1.0',
    sendBeacon: vi.fn().mockReturnValue(false),
  });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string) as TransmissionEnvelope);
      return { ok: true };
    }),
  );
  return { calls: () => bodies };
}

function setupBeaconCapture(): { calls: () => TransmissionEnvelope[] } {
  const bodies: TransmissionEnvelope[] = [];
  vi.stubGlobal('navigator', {
    userAgent: 'vitest/1.0',
    sendBeacon: vi.fn().mockImplementation((_url: string, blob: Blob) => {
      // Read blob synchronously isn't possible, capture for later
      void blob.text().then((text) => bodies.push(JSON.parse(text) as TransmissionEnvelope));
      return true;
    }),
  });
  vi.stubGlobal('fetch', vi.fn());
  return { calls: () => bodies };
}

describe('QaMonitor — 전송 envelope 구조', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('envelope에 올바른 owner / source / runtime / build 필드가 포함된다', async () => {
    const { calls } = setupCaptureFetch();
    const monitor = new QaMonitor({
      ingestUrl: 'http://localhost:3200',
      scenarioId: 'test_scenario',
      meta: { serviceName: 'my-app', env: 'staging' },
    });

    await monitor.flush();
    await monitor.shutdown();

    expect(calls()).toHaveLength(1);
    const env = calls()[0];
    expect(env.owner.owner_type).toBe('tenant');
    expect(env.source.sdk_name).toBe('@qa-sdk/browser');
    expect(env.source.service_name).toBe('my-app');
    expect(env.runtime.platform).toBe('browser');
    expect(env.build.env).toBe('staging');
    expect(env.transmission_id).toBeTruthy();
    expect(env.sent_at).toBeTruthy();
  });

  it('레코드에 sessionId (qa_session_id)와 traceId가 포함된다', async () => {
    const { calls } = setupCaptureFetch();
    const monitor = new QaMonitor({
      ingestUrl: 'http://localhost:3200',
      scenarioId: 'test',
    });
    const { sessionId, traceId } = monitor.getSession();

    await monitor.flush();
    await monitor.shutdown();

    const record = calls()[0].records[0];
    expect(record.trace_id).toBe(traceId);
    expect(record.qa_session_id).toBe(sessionId);
  });

  it('serviceConfig가 있으면 emitWithCoords prefix_ref 차원에 service 주소를 명시 주입한다', async () => {
    const { calls } = setupCaptureFetch();
    const monitor = new QaMonitor({
      ingestUrl: 'http://localhost:3200',
      serviceConfig: {
        namespace: 'shop',
        name: 'shopping-web',
        env: 'prod',
        region: 'asia',
      },
    });

    monitor.emitWithCoords('page.home', {
      page_view: { page: 'home', locale: 'ko', userType: 'guest' },
      tracking: { trackAction: 'view', page: 'home', userType: 'guest' },
    });

    await monitor.flush();
    await monitor.shutdown();

    const record = calls()[0].records[0];
    expect(record.address_context?.page_view).toMatch(/^page_view:v2:\d+$/);
    expect(record.address_context?.tracking).toMatch(/^tracking:v3:\d+$/);

    const pageView = decode(BROWSER_CATALOG, record.address_context!.page_view!);
    const tracking = decode(BROWSER_CATALOG, record.address_context!.tracking!);
    expect(pageView?.values.svc_ref).toBe(65536);
    expect(tracking?.values.svc_ref).toBe(65536);
  });
});

describe('QaMonitor — event-catalog 버전 해석', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("'click' (등록 이벤트)는 event_version '001'로 전송된다", async () => {
    const { calls } = setupCaptureFetch();
    const monitor = new QaMonitor({ ingestUrl: 'http://localhost:3200' });
    monitor.emit('click', { target: 'btn' });
    await monitor.flush();
    await monitor.shutdown();

    expect(calls()[0].records[0].event_version).toBe('001');
  });

  it("등록되지 않은 custom 이벤트도 '001'로 fallback된다", async () => {
    const { calls } = setupCaptureFetch();
    const monitor = new QaMonitor({ ingestUrl: 'http://localhost:3200' });
    monitor.emit('my_custom_event_xyz');
    await monitor.flush();
    await monitor.shutdown();

    expect(calls()[0].records[0].event_version).toBe('001');
    expect(calls()[0].records[0].event_key).toBe('my_custom_event_xyz');
  });

  it("'form_submit' (등록 이벤트)는 event_version '001'로 전송된다", async () => {
    const { calls } = setupCaptureFetch();
    const monitor = new QaMonitor({ ingestUrl: 'http://localhost:3200' });
    monitor.emit('form_submit');
    await monitor.flush();
    await monitor.shutdown();

    expect(calls()[0].records[0].event_version).toBe('001');
  });
});

describe('QaMonitorAsync — registry + service overlay', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('registry catalog에 서비스가 없어도 service overlay로 infra_context.service를 남긴다', async () => {
    const envelopes: TransmissionEnvelope[] = [];
    const registryCatalog = {
      service: {
        version: 'v1',
        labels: ['env', 'region', 'svc_name', 'namespace'],
        dims: {
          env: { kind: 'axis', entries: ['local'], capacity: 32 },
          region: { kind: 'axis', entries: ['asia'], capacity: 32 },
          svc_name: { kind: 'axis', entries: ['platform-demo'], capacity: 32 },
          namespace: { kind: 'axis', entries: ['shop'], capacity: 32 },
        },
      },
    } as const;
    vi.stubGlobal('navigator', {
      userAgent: 'vitest/1.0',
      sendBeacon: vi.fn().mockReturnValue(false),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/resolve/active')) {
          return {
            ok: true,
            json: async () => registryCatalog,
          };
        }

        envelopes.push(JSON.parse(init?.body as string) as TransmissionEnvelope);
        return { ok: true };
      }),
    );

    const serviceConfig = {
      namespace: 'shop',
      name: 'overlay-web',
      env: 'local',
      region: 'asia',
    } as const;

    const monitor = await createQaMonitorAsync({
      ingestUrl: 'http://localhost:3200',
      registry: 'http://registry.test',
      serviceConfig,
    });

    monitor.emit('click', { target: 'btn_overlay' });
    await monitor.flush();
    await monitor.shutdown();

    const serialized = envelopes[0]?.infra_context?.service;
    expect(serialized).toMatch(/^service:v\d+:\d+$/);

    const overlayCatalog = withServiceOverlay(registryCatalog, toServiceDims(serviceConfig));
    const decoded = serialized ? decode(overlayCatalog, serialized) : null;
    expect(decoded?.values).toMatchObject({
      env: 'local',
      region: 'asia',
      svc_name: 'overlay-web',
      namespace: 'shop',
    });
  });
});

describe('QaMonitor — 배치 처리', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('여러 emit이 하나의 envelope에 배치된다', async () => {
    const { calls } = setupCaptureFetch();
    const monitor = new QaMonitor({ ingestUrl: 'http://localhost:3200' });

    monitor.emit('click', { id: 'btn_1' });
    monitor.emit('input_change', { field: 'email' });
    monitor.emit('form_submit', { form: 'login' });
    await monitor.flush();
    await monitor.shutdown();

    expect(calls()).toHaveLength(1);
    expect(calls()[0].records).toHaveLength(3);
    expect(calls()[0].records.map((r) => r.event_key)).toEqual([
      'click',
      'input_change',
      'form_submit',
    ]);
  });

  it('flush 후 버퍼가 비워져 두 번째 flush는 HTTP 호출 없음', async () => {
    const { calls } = setupCaptureFetch();
    const monitor = new QaMonitor({ ingestUrl: 'http://localhost:3200' });

    monitor.emit('click');
    await monitor.flush();
    await monitor.flush(); // empty buffer
    await monitor.shutdown();

    expect(calls()).toHaveLength(1); // only one HTTP call
  });
});

describe('QaMonitor — autoCapture 통합', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("버튼 클릭이 'click' 이벤트로 전송된다", async () => {
    const { calls } = setupCaptureFetch();
    const monitor = new QaMonitor({
      ingestUrl: 'http://localhost:3200',
      autoCapture: { clicks: true },
    });

    const btn = document.createElement('button');
    btn.textContent = 'Add to Cart';
    document.body.appendChild(btn);
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await monitor.flush();
    await monitor.shutdown();

    const record = calls()[0].records[0];
    expect(record.event_key).toBe('click');
    expect((record.payload as Record<string, unknown>).text).toBe('Add to Cart');
  });

  it("form submit이 'form_submit' 이벤트로 전송된다", async () => {
    const { calls } = setupCaptureFetch();
    const monitor = new QaMonitor({
      ingestUrl: 'http://localhost:3200',
      autoCapture: { forms: true },
    });

    const form = document.createElement('form');
    form.id = 'signup-form';
    document.body.appendChild(form);
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true }));

    await monitor.flush();
    await monitor.shutdown();

    const record = calls()[0].records[0];
    expect(record.event_key).toBe('form_submit');
    expect((record.payload as Record<string, unknown>).form_id).toBe('signup-form');
  });

  it('shutdown 후 autoCapture 리스너가 제거된다', async () => {
    const { calls } = setupCaptureFetch();
    const monitor = new QaMonitor({
      ingestUrl: 'http://localhost:3200',
      autoCapture: { clicks: true },
    });
    await monitor.shutdown();

    // click after shutdown → should not be captured
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // No flush needed — nothing in buffer
    expect(calls()).toHaveLength(0);
  });
});

describe('QaMonitor — sendBeacon 경로', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('sendBeacon 성공 시 fetch를 호출하지 않는다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', {
      userAgent: 'test',
      sendBeacon: vi.fn().mockReturnValue(true),
    });

    const monitor = new QaMonitor({ ingestUrl: 'http://localhost:3200', scenarioId: 's1' });
    await monitor.flush();
    await monitor.shutdown();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// pagehide 테스트는 QaLogger의 setInterval과 충돌하지 않도록 real timers 사용
describe('QaMonitor — pagehide 자동 flush', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pagehide 이벤트 발생 시 버퍼의 이벤트가 전송된다', async () => {
    const { calls } = setupCaptureFetch();
    const monitor = new QaMonitor({ ingestUrl: 'http://localhost:3200' });
    monitor.emit('click', { source: 'pagehide_test' });

    window.dispatchEvent(new Event('pagehide'));
    // Promise chain이 완전히 drain될 때까지 대기 (sendBeacon false → fetch mock)
    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    await monitor.shutdown();

    expect(calls().length).toBeGreaterThan(0);
    expect(calls()[0].records[0].event_key).toBe('click');
  });

  it('shutdown 후 pagehide는 추가 flush를 유발하지 않는다', async () => {
    const { calls } = setupCaptureFetch();
    const monitor = new QaMonitor({ ingestUrl: 'http://localhost:3200', scenarioId: 's1' });

    await monitor.flush(); // session_start 전송
    await monitor.shutdown(); // 리스너 제거

    const countAfterShutdown = calls().length;

    window.dispatchEvent(new Event('pagehide')); // 리스너 이미 제거됨
    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    expect(calls().length).toBe(countAfterShutdown);
  });
});

describe('QaMonitor — storageKey 격리', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('서로 다른 storageKey를 가진 두 모니터는 독립적인 세션을 갖는다', () => {
    setupCaptureFetch();
    const m1 = new QaMonitor({ ingestUrl: 'http://localhost:3200', storageKey: 'app_a' });
    const m2 = new QaMonitor({ ingestUrl: 'http://localhost:3200', storageKey: 'app_b' });

    expect(m1.getSession().sessionId).not.toBe(m2.getSession().sessionId);
    expect(m1.getSession().traceId).not.toBe(m2.getSession().traceId);

    void m1.shutdown();
    void m2.shutdown();
  });

  it('newSession() 후 새 QaMonitor 인스턴스가 새 세션을 복원한다', () => {
    setupCaptureFetch();
    const m1 = new QaMonitor({ ingestUrl: 'http://localhost:3200' });
    const fresh = m1.newSession();
    void m1.shutdown();

    setupCaptureFetch();
    const m2 = new QaMonitor({ ingestUrl: 'http://localhost:3200' });
    expect(m2.getSession().sessionId).toBe(fresh.sessionId);
    void m2.shutdown();
  });
});
