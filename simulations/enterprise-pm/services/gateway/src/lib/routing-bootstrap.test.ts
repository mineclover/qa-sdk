// @def.boundary sim-gateway
// @def.doc canary-routing-decision

import { describe, it, expect, vi, afterEach } from 'vitest';
import { bootstrapRouting, buildFallbackSeed } from './routing-bootstrap.js';
import { InMemoryRoutingStore, type RouteEntry } from '../routing/routing-table.js';

afterEach(() => vi.restoreAllMocks());

const FALLBACK_TARGETS = {
  'sim-approval-api': {
    v1: 'http://sim-approval-api-v1:4500',
    v2: 'http://sim-approval-api-v2:4500',
  },
};

describe('buildFallbackSeed', () => {
  it('seeds revision=0 + v1 stable + null candidate + weight=0 for each service', () => {
    const seed = buildFallbackSeed(FALLBACK_TARGETS);
    expect(seed['sim-approval-api']).toEqual<RouteEntry>({
      revision: 0,
      stable: { version: 'v1', upstream: 'http://sim-approval-api-v1:4500' },
      candidate: null,
      weight: 0,
      stickyKey: 'user_id',
    });
  });

  it('empty map → empty seed', () => {
    expect(buildFallbackSeed({})).toEqual({});
  });
});

describe('bootstrapRouting', () => {
  it('controller 200 → store 일괄 upsert from response.routes', async () => {
    const store = new InMemoryRoutingStore();
    const remote: RouteEntry = {
      revision: 7,
      stable: { version: 'v3', upstream: 'http://sim-approval-api-v1:4500' },
      candidate: { version: 'v4-candidate', upstream: 'http://sim-approval-api-v2:4500' },
      weight: 25,
      stickyKey: 'user_id',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        expect(String(url)).toBe('http://controller.local:6000/controller/routing');
        return new Response(JSON.stringify({ routes: { 'sim-approval-api': remote } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    const result = await bootstrapRouting({
      store,
      controllerUrl: 'http://controller.local:6000',
      fallbackTargets: FALLBACK_TARGETS,
      fetchTimeoutMs: 1000,
    });
    expect(result.source).toBe('controller');
    expect(result.applied).toEqual(['sim-approval-api']);
    expect(store.getRoute('sim-approval-api')?.revision).toBe(7);
  });

  it('controller 5xx → fallback seed', async () => {
    const store = new InMemoryRoutingStore();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 503 })),
    );
    const result = await bootstrapRouting({
      store,
      controllerUrl: 'http://controller.local:6000',
      fallbackTargets: FALLBACK_TARGETS,
      fetchTimeoutMs: 1000,
    });
    expect(result.source).toBe('fallback');
    expect(store.getRoute('sim-approval-api')?.stable.version).toBe('v1');
    expect(store.getRoute('sim-approval-api')?.weight).toBe(0);
  });

  it('controller timeout → fallback seed (fail-open, no throw)', async () => {
    const store = new InMemoryRoutingStore();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL, init?: RequestInit) => {
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        });
      }),
    );
    const result = await bootstrapRouting({
      store,
      controllerUrl: 'http://controller.local:6000',
      fallbackTargets: FALLBACK_TARGETS,
      fetchTimeoutMs: 30,
    });
    expect(result.source).toBe('fallback');
    expect(store.getRoute('sim-approval-api')?.stable.version).toBe('v1');
  });

  it('malformed JSON → fallback seed', async () => {
    const store = new InMemoryRoutingStore();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('not-json', { status: 200, headers: { 'content-type': 'text/plain' } }),
      ),
    );
    const result = await bootstrapRouting({
      store,
      controllerUrl: 'http://controller.local:6000',
      fallbackTargets: FALLBACK_TARGETS,
      fetchTimeoutMs: 1000,
    });
    expect(result.source).toBe('fallback');
    expect(store.getRoute('sim-approval-api')?.weight).toBe(0);
  });

  it('controllerUrl undefined → fallback seed (no fetch call)', async () => {
    const store = new InMemoryRoutingStore();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const result = await bootstrapRouting({
      store,
      controllerUrl: undefined,
      fallbackTargets: FALLBACK_TARGETS,
      fetchTimeoutMs: 1000,
    });
    expect(result.source).toBe('fallback');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
