// @def.boundary sim-scenarios

import { describe, expect, it } from 'vitest';
import { createFaultInjector, type FetchLike } from './fault-injector.js';

describe('fault-injector handle', () => {
  function makeFetchSpy(): {
    fetch: FetchLike;
    calls: Array<{ url: string; body?: string }>;
  } {
    const calls: Array<{ url: string; body?: string }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      calls.push({ url: input, body: init?.body });
      return {
        ok: true,
        status: 200,
        async text() {
          return '';
        },
        async json() {
          return { ok: true };
        },
      };
    };
    return { fetch: fetchImpl, calls };
  }

  it('schemaBreak.on()이 schema-break kind로 enabled=true를 POST하고 off 핸들 반환', async () => {
    const { fetch, calls } = makeFetchSpy();
    const inj = createFaultInjector({
      controllerUrl: 'http://ctrl/',
      fetchImpl: fetch,
    });
    const handle = await inj.schemaBreak.on();
    expect(calls.length).toBe(1);
    expect(calls[0].url).toBe('http://ctrl/admin/fault/schema-break');
    expect(JSON.parse(calls[0].body!)).toEqual({ enabled: true });
    await handle.off();
    expect(calls.length).toBe(2);
    expect(JSON.parse(calls[1].body!)).toEqual({ enabled: false });
  });

  it('dbPool.tighten(pool)이 params를 같이 보낸다', async () => {
    const { fetch, calls } = makeFetchSpy();
    const inj = createFaultInjector({
      controllerUrl: 'http://ctrl',
      fetchImpl: fetch,
    });
    await inj.dbPool.tighten(4);
    expect(calls[0].url).toContain('/admin/fault/db-pool-pressure');
    expect(JSON.parse(calls[0].body!)).toEqual({
      enabled: true,
      params: { pool: 4 },
    });
  });

  it('replicationLag.inject(ms) → replication-lag, params.lagMs', async () => {
    const { fetch, calls } = makeFetchSpy();
    const inj = createFaultInjector({
      controllerUrl: 'http://ctrl',
      fetchImpl: fetch,
    });
    await inj.replicationLag.inject(3000);
    expect(calls[0].url).toContain('/admin/fault/replication-lag');
    expect(JSON.parse(calls[0].body!)).toEqual({
      enabled: true,
      params: { lagMs: 3000 },
    });
  });

  it('perfWarn.on() → perf-warn, pubsubInvalidate.drop() → pubsub-invalidate-drop', async () => {
    const { fetch, calls } = makeFetchSpy();
    const inj = createFaultInjector({
      controllerUrl: 'http://ctrl',
      fetchImpl: fetch,
    });
    await inj.perfWarn.on();
    await inj.pubsubInvalidate.drop();
    expect(calls[0].url).toContain('/admin/fault/perf-warn');
    expect(calls[1].url).toContain('/admin/fault/pubsub-invalidate-drop');
  });

  it('non-2xx 응답에 throw', async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: false,
      status: 400,
      async text() {
        return 'bad';
      },
      async json() {
        return {};
      },
    });
    const inj = createFaultInjector({
      controllerUrl: 'http://ctrl',
      fetchImpl,
    });
    await expect(inj.schemaBreak.on()).rejects.toThrow(/status=400/);
  });
});
