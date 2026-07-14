// @def.boundary gate-system
// @def.doc gate-system

import { beforeEach, describe, it, expect, vi } from 'vitest';
import { MemoryEventBus } from '../adapters/memory-event-bus.js';
import { createCacheInvalidation, type CacheInvalidationService } from './cache-invalidation.js';
import type { GateLookupService } from '../lib/gate-service.js';
import type { GateEvent } from '../ports/event-bus.port.js';

const NOW = '2026-04-05T00:00:00Z';

/** recompute/cascadeRecompute 호출을 추적하는 mock gateService */
function createMockGateService(): GateLookupService & {
  recomputeCalls: Array<{ prefix: string; versionId: string }>;
  cascadeRecomputeCalls: Array<{ prefix: string; versionId: string }>;
} {
  const recomputeCalls: Array<{ prefix: string; versionId: string }> = [];
  const cascadeRecomputeCalls: Array<{ prefix: string; versionId: string }> = [];

  return {
    engine: null,
    recomputeCalls,
    cascadeRecomputeCalls,
    async checkGate() {
      return { encode: true, decode: true, state: 'active' as const, shouldVerify: false };
    },
    async classifyAddress() {
      return 'active' as const;
    },
    async getStateRanges() {
      return null;
    },
    async recompute(prefix, versionId) {
      recomputeCalls.push({ prefix, versionId });
    },
    async cascadeRecompute(prefix, versionId) {
      cascadeRecomputeCalls.push({ prefix, versionId });
    },
    async filterRanges() {
      return [];
    },
  };
}

describe('CacheInvalidation', () => {
  let bus: MemoryEventBus;
  let gateService: ReturnType<typeof createMockGateService>;
  let service: CacheInvalidationService;

  beforeEach(() => {
    bus = new MemoryEventBus();
    gateService = createMockGateService();
  });

  describe('flag-change → recompute', () => {
    it('flag-change 이벤트로 cascadeRecompute가 트리거된다', async () => {
      service = createCacheInvalidation({ eventBus: bus, gateService });

      bus.publish({
        type: 'flag-change',
        prefix: 'role',
        versionId: 'v1',
        position: 2,
        status: 'inactive',
        timestamp: NOW,
      });

      // async 핸들러 완료 대기
      await new Promise((r) => setTimeout(r, 10));

      expect(gateService.cascadeRecomputeCalls).toHaveLength(1);
      expect(gateService.cascadeRecomputeCalls[0]).toEqual({
        prefix: 'role',
        versionId: 'v1',
      });
    });

    it('flag-change 후 recompute-complete 이벤트가 발행된다', async () => {
      const recomputeEvents: GateEvent[] = [];
      bus.subscribe('recompute-complete', (e) => {
        recomputeEvents.push(e);
      });
      service = createCacheInvalidation({ eventBus: bus, gateService });

      bus.publish({
        type: 'flag-change',
        prefix: 'role',
        versionId: 'v1',
        position: 2,
        status: 'inactive',
        timestamp: NOW,
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(recomputeEvents).toHaveLength(1);
      expect(recomputeEvents[0]!.type).toBe('recompute-complete');
    });
  });

  describe('release → recompute', () => {
    it('release 이벤트로 cascadeRecompute가 트리거된다', async () => {
      service = createCacheInvalidation({ eventBus: bus, gateService });

      bus.publish({
        type: 'release',
        prefix: 'role',
        versionId: 'v2',
        timestamp: NOW,
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(gateService.cascadeRecomputeCalls).toHaveLength(1);
      expect(gateService.cascadeRecomputeCalls[0]).toEqual({
        prefix: 'role',
        versionId: 'v2',
      });
    });

    it('release 후 recompute-complete 이벤트에 triggeredBy=release가 포함된다', async () => {
      const recomputeEvents: GateEvent[] = [];
      bus.subscribe('recompute-complete', (e) => {
        recomputeEvents.push(e);
      });
      service = createCacheInvalidation({ eventBus: bus, gateService });

      bus.publish({
        type: 'release',
        prefix: 'action',
        versionId: 'v1',
        timestamp: NOW,
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(recomputeEvents).toHaveLength(1);
      if (recomputeEvents[0]!.type === 'recompute-complete') {
        expect(recomputeEvents[0]!.triggeredBy).toBe('release');
      }
    });
  });

  describe('recompute-complete → broadcast', () => {
    it('broadcast 대상이 없으면 HTTP 호출 없이 완료된다', async () => {
      const mockFetch = vi.fn();
      service = createCacheInvalidation({
        eventBus: bus,
        gateService,
        targets: [],
        fetch: mockFetch as any,
      });

      bus.publish({
        type: 'recompute-complete',
        prefix: 'role',
        versionId: 'v1',
        timestamp: NOW,
      });

      await new Promise((r) => setTimeout(r, 10));
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('broadcast 대상에 POST 요청을 전송한다', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      service = createCacheInvalidation({
        eventBus: bus,
        gateService,
        targets: [{ name: 'query-service', endpoint: 'http://localhost:3500/gate/invalidate' }],
        fetch: mockFetch as any,
      });

      bus.publish({
        type: 'recompute-complete',
        prefix: 'role',
        versionId: 'v1',
        timestamp: NOW,
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0]!;
      expect(url).toBe('http://localhost:3500/gate/invalidate');
      expect(opts.method).toBe('POST');
      expect(opts.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(opts.body);
      expect(body.prefix).toBe('role');
      expect(body.versionId).toBe('v1');
    });

    it('여러 대상에 병렬로 broadcast한다', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      service = createCacheInvalidation({
        eventBus: bus,
        gateService,
        targets: [
          { name: 'query-service', endpoint: 'http://localhost:3500/gate/invalidate' },
          { name: 'decode-service', endpoint: 'http://localhost:3600/gate/invalidate' },
        ],
        fetch: mockFetch as any,
      });

      bus.publish({
        type: 'recompute-complete',
        prefix: 'role',
        versionId: 'v1',
        timestamp: NOW,
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(service.completedBroadcasts).toBe(1);
    });

    it('broadcast 실패가 다른 대상 전송을 차단하지 않는다 (fail-open)', async () => {
      const errors: unknown[] = [];
      const mockFetch = vi
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce({ ok: true });

      service = createCacheInvalidation({
        eventBus: bus,
        gateService,
        targets: [
          { name: 'failing', endpoint: 'http://fail:9999/gate/invalidate' },
          { name: 'working', endpoint: 'http://localhost:3500/gate/invalidate' },
        ],
        fetch: mockFetch as any,
        onError: (err) => errors.push(err),
      });

      bus.publish({
        type: 'recompute-complete',
        prefix: 'role',
        versionId: 'v1',
        timestamp: NOW,
      });

      await new Promise((r) => setTimeout(r, 50));

      // 두 대상 모두 호출됨
      expect(mockFetch).toHaveBeenCalledTimes(2);
      // 에러 보고됨
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('recompute 실패 격리', () => {
    it('cascadeRecompute 실패 시 onError 콜백이 호출된다', async () => {
      const errors: string[] = [];
      const failingService = {
        ...createMockGateService(),
        cascadeRecompute: async () => {
          throw new Error('recompute failed');
        },
      };

      service = createCacheInvalidation({
        eventBus: bus,
        gateService: failingService,
        onError: (_err, ctx) => errors.push(ctx),
      });

      bus.publish({
        type: 'flag-change',
        prefix: 'role',
        versionId: 'v1',
        position: 1,
        status: 'inactive',
        timestamp: NOW,
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('recompute after flag-change');
    });
  });

  describe('close()', () => {
    it('close 후에는 이벤트 수신이 중단된다', async () => {
      service = createCacheInvalidation({ eventBus: bus, gateService });
      service.close();

      bus.publish({
        type: 'flag-change',
        prefix: 'role',
        versionId: 'v1',
        position: 1,
        status: 'inactive',
        timestamp: NOW,
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(gateService.cascadeRecomputeCalls).toHaveLength(0);
    });
  });
});
