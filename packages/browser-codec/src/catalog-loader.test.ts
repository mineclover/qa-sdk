import { afterEach, describe, expect, it, vi } from 'vitest';
import { decode, track, type BrowserCatalog, type BrowserServiceDims } from './browser-codec.js';
import { BROWSER_CATALOG } from './demo-catalog-browser.js';
import { loadCatalog } from './catalog-loader.js';

const SERVICE_OVERLAY: BrowserServiceDims = {
  env: 'local',
  region: 'asia',
  svc_name: 'overlay-web',
  namespace: 'shop',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadCatalog', () => {
  it('static fallback에도 service overlay를 적용한다', async () => {
    const result = await loadCatalog({
      serviceOverlay: SERVICE_OVERLAY,
    });

    expect(result.source).toBe('static');
    const service = result.catalog.service;
    expect(service.dims.svc_name.entries).toContain('overlay-web');

    const context = track(result.catalog, { service: { ...SERVICE_OVERLAY } });
    const decoded = decode(result.catalog, context.service);
    expect(decoded?.values).toMatchObject({
      env: 'local',
      region: 'asia',
      svc_name: 'overlay-web',
      namespace: 'shop',
    });
  });

  it('registry catalog에도 service overlay를 적용한다', async () => {
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
    } satisfies BrowserCatalog;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async (): Promise<Record<string, unknown>> => registryCatalog,
      }),
    );

    const result = await loadCatalog({
      registryUrl: 'http://registry.test',
      serviceOverlay: SERVICE_OVERLAY,
    });

    expect(result.source).toBe('api');
    expect(result.catalog.service.dims.svc_name.entries).toContain('overlay-web');

    const context = track(result.catalog, { service: { ...SERVICE_OVERLAY } });
    const decoded = decode(result.catalog, context.service);
    expect(decoded?.values).toMatchObject({
      env: 'local',
      region: 'asia',
      svc_name: 'overlay-web',
      namespace: 'shop',
    });
  });

  it('overlay가 없으면 기존 static catalog를 그대로 사용한다', async () => {
    const result = await loadCatalog();
    expect(result.catalog).toEqual(BROWSER_CATALOG);
  });

  it('overlay capacity를 넘기면 static catalog로 fail-open 한다', async () => {
    const tinyCatalog: BrowserCatalog = {
      service: {
        version: 'v1',
        labels: ['env', 'region', 'svc_name', 'namespace'],
        dims: {
          env: { kind: 'axis', entries: ['local'], capacity: 1 },
          region: { kind: 'axis', entries: ['asia'], capacity: 1 },
          svc_name: { kind: 'axis', entries: ['platform-demo'], capacity: 1 },
          namespace: { kind: 'axis', entries: ['shop'], capacity: 1 },
        },
      },
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async (): Promise<Record<string, unknown>> => tinyCatalog,
      }),
    );

    const result = await loadCatalog({
      registryUrl: 'http://registry.test',
      serviceOverlay: SERVICE_OVERLAY,
    });

    expect(result.source).toBe('api');
    expect(result.catalog.service.dims.svc_name.entries).toEqual(['platform-demo']);
  });
});
