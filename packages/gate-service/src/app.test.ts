// @def.boundary gate-system
// @def.doc gate-system

import { beforeEach, describe, expect, it } from 'vitest';
import {
  GateEngine,
  InMemoryAddressRangeCache,
  InMemoryAddressStateStore,
  InMemoryEntryFlagStore,
  InMemoryIndexMetaStore,
  InMemoryPrefixRegistry,
  InMemoryVersionLifecycleStore,
  IndexNotFoundError,
  type AddressStateCacheRecord,
  type GateResult,
} from 'index-meta';
import { createApp } from './app.js';
import type { GateLookupService } from './lib/gate-service.js';

const AT = '2026-01-01T00:00:00Z';

interface TestContext {
  metaStore: InMemoryIndexMetaStore;
  prefixRegistry: InMemoryPrefixRegistry;
  entryFlagStore: InMemoryEntryFlagStore;
  versionStore: InMemoryVersionLifecycleStore;
  addressStateStore: InMemoryAddressStateStore;
  addressRangeCache: InMemoryAddressRangeCache;
  engine: GateEngine;
}

function createContext(): TestContext {
  const metaStore = new InMemoryIndexMetaStore();
  const prefixRegistry = new InMemoryPrefixRegistry();
  const entryFlagStore = new InMemoryEntryFlagStore();
  const versionStore = new InMemoryVersionLifecycleStore();
  const addressStateStore = new InMemoryAddressStateStore();
  const addressRangeCache = new InMemoryAddressRangeCache();
  const engine = new GateEngine({
    prefixRegistry,
    metaStore,
    entryFlagStore,
    versionLifecycleStore: versionStore,
    addressStateStore,
    addressRangeCache,
  });

  return {
    metaStore,
    prefixRegistry,
    entryFlagStore,
    versionStore,
    addressStateStore,
    addressRangeCache,
    engine,
  };
}

async function registerLeaf(
  ctx: TestContext,
  prefix: string,
  versionId: string,
  capacity: number,
  entries: string[],
): Promise<void> {
  await ctx.prefixRegistry.register({ prefix, versionId, capacity });
  await ctx.metaStore.insertSchemaVersion({ prefix, versionId, capacity, createdAt: AT });

  for (let i = 0; i < entries.length; i++) {
    await ctx.metaStore.insertEntry({
      prefix,
      versionId,
      position: i + 1,
      value: entries[i]!,
      createdAt: AT,
    });
  }
}

function req(app: ReturnType<typeof createApp>, method: string, path: string, body?: unknown) {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return app.request(path, init);
}

function withoutComputedAt(record: AddressStateCacheRecord) {
  const { computedAt: _computedAt, ...stableRecord } = record;
  return stableRecord;
}

describe('gate-service', () => {
  let ctx: TestContext;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    ctx = createContext();
    await registerLeaf(ctx, 'role', 'v1', 4, ['admin', 'editor']);
    await ctx.entryFlagStore.setFlag({
      prefix: 'role',
      versionId: 'v1',
      position: 2,
      status: 'inactive',
      updatedAt: AT,
    });
    await ctx.engine.recompute('role', 'v1');

    app = createApp({
      addressStateStore: ctx.addressStateStore,
      gateEngine: ctx.engine,
    });
  });

  describe('GET /health', () => {
    it('reports service health and engine availability', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('ok');
      expect(json.gate_engine_configured).toBe(true);
    });
  });

  describe('POST /gate/check', () => {
    it('returns GateResult from cached ranges', async () => {
      const res = await req(app, 'POST', '/gate/check', {
        prefix: 'role',
        versionId: 'v1',
        address: 1,
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as GateResult;
      expect(json).toEqual({
        encode: false,
        decode: true,
        state: 'inactive',
        shouldVerify: false,
      });
    });

    it('treats missing cache as fully active', async () => {
      const res = await req(app, 'POST', '/gate/check', {
        prefix: 'missing',
        versionId: 'v1',
        address: 42,
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as GateResult;
      expect(json).toEqual({
        encode: true,
        decode: true,
        state: 'active',
        shouldVerify: false,
      });
    });
  });

  describe('POST /gate/classify', () => {
    it('returns the address state only', async () => {
      const res = await req(app, 'POST', '/gate/classify', {
        prefix: 'role',
        versionId: 'v1',
        address: 3,
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toBe('open');
    });
  });

  describe('GET /gate/state/:prefix/:version', () => {
    it('returns the cached state record when available', async () => {
      const res = await app.request('/gate/state/role/v1');
      expect(res.status).toBe(200);

      const json = (await res.json()) as AddressStateCacheRecord;
      expect(json.prefix).toBe('role');
      expect(json.versionId).toBe('v1');
      expect(json.inactiveRanges).toEqual([[1, 1]]);
      expect(json.openRanges).toEqual([[2, 3]]);
    });

    it('returns null when no state has been computed yet', async () => {
      const res = await app.request('/gate/state/role/v2');
      expect(res.status).toBe(200);
      expect(await res.json()).toBeNull();
    });
  });

  describe('POST /gate/recompute', () => {
    it('recomputes and overwrites the cached state', async () => {
      await ctx.entryFlagStore.setFlag({
        prefix: 'role',
        versionId: 'v1',
        position: 1,
        status: 'inactive',
        updatedAt: AT,
      });
      await ctx.addressStateStore.delete('role', 'v1');

      const res = await req(app, 'POST', '/gate/recompute', {
        prefix: 'role',
        versionId: 'v1',
      });

      expect(res.status).toBe(204);
      const record = await ctx.addressStateStore.get('role', 'v1');
      expect(record).not.toBeNull();
      expect(record!.inactiveRanges).toEqual([[0, 1]]);
      expect(record!.openRanges).toEqual([[2, 3]]);
    });

    it('is idempotent for identical requests', async () => {
      const firstRes = await req(app, 'POST', '/gate/recompute', {
        prefix: 'role',
        versionId: 'v1',
      });
      expect(firstRes.status).toBe(204);

      const firstRecord = await ctx.addressStateStore.get('role', 'v1');
      expect(firstRecord).not.toBeNull();

      const secondRes = await req(app, 'POST', '/gate/recompute', {
        prefix: 'role',
        versionId: 'v1',
      });
      expect(secondRes.status).toBe(204);

      const secondRecord = await ctx.addressStateStore.get('role', 'v1');
      expect(secondRecord).not.toBeNull();
      expect(withoutComputedAt(secondRecord!)).toEqual(withoutComputedAt(firstRecord!));
    });
  });

  describe('POST /gate/cascade-recompute', () => {
    it('recomputes the target and dependent composite prefixes', async () => {
      await registerLeaf(ctx, 'action', 'v1', 3, ['read', 'write', 'delete']);
      // action leaf도 recompute해야 composite 계산에 포함됨
      await ctx.engine.recompute('action', 'v1');

      await ctx.prefixRegistry.register({
        prefix: 'perm',
        versionId: 'v1',
        capacity: 12,
        refs: [
          { prefix: 'role', versionId: 'v1', capacity: 4 },
          { prefix: 'action', versionId: 'v1', capacity: 3 },
        ],
      });
      await ctx.addressStateStore.delete('perm', 'v1');

      const res = await req(app, 'POST', '/gate/cascade-recompute', {
        prefix: 'role',
        versionId: 'v1',
      });

      expect(res.status).toBe(204);
      expect(await ctx.addressStateStore.get('role', 'v1')).not.toBeNull();

      const compositeRecord = await ctx.addressStateStore.get('perm', 'v1');
      expect(compositeRecord).not.toBeNull();
      // cascade가 동작하여 composite가 (재)계산되었는지 확인
      expect(compositeRecord!.computedAt).toBeTruthy();
    });
  });

  describe('POST /gate/filter-ranges', () => {
    it('filters blocked addresses using the cached gate state', async () => {
      const res = await req(app, 'POST', '/gate/filter-ranges', {
        prefix: 'role',
        versionId: 'v1',
        ranges: [[0, 3]],
        mode: 'active',
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([[0, 0]]);
    });
  });

  describe('error mapping', () => {
    it('maps IndexMetaError failures to HTTP status codes', async () => {
      const failingService: GateLookupService = {
        engine: null,
        async getStateRanges() {
          throw new IndexNotFoundError('index "role" not found');
        },
        async checkGate() {
          throw new IndexNotFoundError('index "role" not found');
        },
        async classifyAddress() {
          throw new IndexNotFoundError('index "role" not found');
        },
        async recompute() {
          throw new IndexNotFoundError('index "role" not found');
        },
        async cascadeRecompute() {
          throw new IndexNotFoundError('index "role" not found');
        },
        async filterRanges() {
          throw new IndexNotFoundError('index "role" not found');
        },
      };

      const errorApp = createApp({ gateService: failingService });
      const res = await req(errorApp, 'POST', '/gate/cascade-recompute', {
        prefix: 'role',
        versionId: 'v1',
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 for invalid request payloads', async () => {
      const res = await req(app, 'POST', '/gate/check', {
        prefix: 'role',
        versionId: 'v1',
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('INVALID_INPUT');
    });

    it('returns 400 for invalid recompute payloads', async () => {
      const res = await req(app, 'POST', '/gate/recompute', {
        prefix: '',
        versionId: 'v1',
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('INVALID_INPUT');
    });

    it('returns 400 for invalid filter-ranges payloads', async () => {
      const res = await req(app, 'POST', '/gate/filter-ranges', {
        prefix: 'role',
        versionId: 'v1',
        ranges: [[3, 1]],
        mode: 'active',
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('INVALID_INPUT');
    });
  });
});
