// @def.boundary registry-system
// @def.doc registry-system

import pino from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRegistryConfigClient, RegistryClient } from './index.js';

describe('RegistryClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns valid true and reuses cached successful validations', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    const client = new RegistryClient({
      baseUrl: 'https://registry.qa-sdk.test',
      fetch: fetchMock,
    });

    await expect(
      client.validateEvent('checkout-api', 'checkout.form.updated', '001'),
    ).resolves.toEqual({ valid: true });
    await expect(
      client.validateEvent('checkout-api', 'checkout.form.updated', '001'),
    ).resolves.toEqual({ valid: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        '/api/event-schemas/checkout-api/checkout.form.updated/001',
        'https://registry.qa-sdk.test/',
      ),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('returns valid false with the registry error message on 404', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'EVENT_NOT_FOUND',
              message: "event 'checkout.audit' version '001' not found",
            },
          }),
          {
            headers: {
              'content-type': 'application/json',
            },
            status: 404,
          },
        ),
    );
    const client = new RegistryClient({
      baseUrl: 'https://registry.qa-sdk.test',
      fetch: fetchMock,
    });

    await expect(client.validateEvent('checkout-api', 'checkout.audit', '001')).resolves.toEqual({
      valid: false,
      reason: "event 'checkout.audit' version '001' not found",
    });
  });

  it('warns and fails open when the registry is unavailable', async () => {
    const logger = pino({ level: 'silent' });
    const warnSpy = vi.spyOn(logger, 'warn');
    const fetchMock = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED');
    });
    const client = new RegistryClient({
      baseUrl: 'https://registry.qa-sdk.test',
      fetch: fetchMock,
      logger,
    });

    await expect(client.validateEvent('checkout-api', 'checkout.audit', '001')).resolves.toEqual({
      valid: true,
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('fails open (valid: true) on non-404 HTTP errors (5xx)', async () => {
    const logger = pino({ level: 'silent' });
    const warnSpy = vi.spyOn(logger, 'warn');
    const fetchMock = vi.fn(async () => new Response(null, { status: 503 }));
    const client = new RegistryClient({
      baseUrl: 'https://registry.qa-sdk.test',
      fetch: fetchMock,
      logger,
    });

    await expect(client.validateEvent('my-service', 'some.event', '001')).resolves.toEqual({
      valid: true,
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('returns fallback reason when 404 body is not JSON', async () => {
    const fetchMock = vi.fn(async () => new Response('Not Found', { status: 404 }));
    const client = new RegistryClient({
      baseUrl: 'https://registry.qa-sdk.test',
      fetch: fetchMock,
    });

    const result = await client.validateEvent('svc', 'no.such.event', '001');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('event not found in registry');
  });

  it('cache key includes service name — different services are cached separately', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    const client = new RegistryClient({
      baseUrl: 'https://registry.qa-sdk.test',
      fetch: fetchMock,
    });

    await client.validateEvent('service-a', 'click', '001');
    await client.validateEvent('service-b', 'click', '001');

    // 서비스가 다르므로 캐시 키가 달라야 함 → fetch 2회
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('cache key includes event version — same event different version cached separately', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    const client = new RegistryClient({
      baseUrl: 'https://registry.qa-sdk.test',
      fetch: fetchMock,
    });

    await client.validateEvent('svc', 'click', '001');
    await client.validateEvent('svc', 'click', '002');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('TTL 만료 후에는 캐시를 사용하지 않고 새로 요청한다', async () => {
    const cacheTtlMs = 60_000; // 1분
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    const client = new RegistryClient({
      baseUrl: 'https://registry.qa-sdk.test',
      fetch: fetchMock,
      cacheTtlMs,
    });

    await client.validateEvent('svc', 'click', '001');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // TTL 이내 — 캐시 히트
    vi.advanceTimersByTime(cacheTtlMs - 1);
    await client.validateEvent('svc', 'click', '001');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // TTL 초과 — 캐시 미스
    vi.advanceTimersByTime(2);
    await client.validateEvent('svc', 'click', '001');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('LRU 캐시가 maxEntries 초과 시 가장 오래된(LRU) 항목을 축출한다', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    const client = new RegistryClient({
      baseUrl: 'https://registry.qa-sdk.test',
      fetch: fetchMock,
      cacheMaxEntries: 2,
    });

    // 1. a, b 순서로 캐시 채움 (a=LRU, b=MRU)
    await client.validateEvent('svc', 'event-a', '001'); // fetch 1, cache: {a}
    await client.validateEvent('svc', 'event-b', '001'); // fetch 2, cache: {a(LRU), b}
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // 2. b에 다시 접근 → b가 MRU, a가 LRU
    await client.validateEvent('svc', 'event-b', '001'); // cache hit, cache: {a(LRU), b(MRU)}
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // 3. 세 번째 항목 추가 → LRU인 a 축출, cache: {b, c}
    await client.validateEvent('svc', 'event-c', '001'); // fetch 3
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // 4. b, c는 여전히 캐시에 있음
    await client.validateEvent('svc', 'event-b', '001'); // cache hit
    await client.validateEvent('svc', 'event-c', '001'); // cache hit
    expect(fetchMock).toHaveBeenCalledTimes(3); // fetch 수 변화 없음

    // 5. a는 축출되었으므로 cache miss
    await client.validateEvent('svc', 'event-a', '001'); // fetch 4
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('config client uses the injected fetch and applies endpoint defaults', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(
        'http://registry.local/api/endpoints/resolve?catalog=demo&namespace=shop&name=ingest-server&env=dev&region=asia',
      );
      return new Response(JSON.stringify({ url: 'http://localhost:3200' }), { status: 200 });
    });
    const client = createRegistryConfigClient({
      registryUrl: 'http://registry.local/',
      fetch: fetchMock,
    });

    await expect(client.resolveEndpoint({ name: 'ingest-server' })).resolves.toBe(
      'http://localhost:3200',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(client.defaults).toEqual({
      registryUrl: 'http://registry.local',
      catalogId: 'demo',
      env: 'dev',
      namespace: 'shop',
      region: 'asia',
    });
  });

  it('config client parses catalog/config/generation responses through the injected fetch', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path === '/catalogs/demo') {
        return new Response(JSON.stringify({ data: JSON.stringify({ axes: ['service'] }) }), {
          status: 200,
        });
      }
      if (path === '/catalogs/demo/config') {
        return new Response(JSON.stringify({ data: JSON.stringify({ mode: 'local' }) }), {
          status: 200,
        });
      }
      if (path === '/health/generation') {
        return new Response(
          JSON.stringify({
            generations: {
              demo: {
                catalogHash: 'catalog-v1',
                dkgConfigHash: null,
                prefixCount: 2,
                axisCount: 1,
              },
            },
          }),
          { status: 200 },
        );
      }
      return new Response(null, { status: 404 });
    });
    const client = createRegistryConfigClient({
      registryUrl: 'http://registry.local',
      fetch: fetchMock,
    });

    await expect(client.fetchCatalog()).resolves.toEqual({ axes: ['service'] });
    await expect(client.fetchConfig('config')).resolves.toEqual({ mode: 'local' });
    await expect(client.fetchGeneration()).resolves.toEqual({
      catalogHash: 'catalog-v1',
      dkgConfigHash: null,
      prefixCount: 2,
      axisCount: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('config client fails soft when the injected fetch is unavailable', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED');
    });
    const client = createRegistryConfigClient({
      registryUrl: 'http://registry.local',
      fetch: fetchMock,
    });

    await expect(client.listEndpoints()).resolves.toEqual([]);
    await expect(client.fetchServiceUrls()).resolves.toEqual({});
    await expect(client.fetchCatalog()).resolves.toBeNull();
    await expect(client.isHealthy()).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
