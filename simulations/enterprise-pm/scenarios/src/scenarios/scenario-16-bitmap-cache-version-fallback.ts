// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// 시나리오 16 — publisher가 invalidate 메시지 drop, version 진화 발생.
// 단언: TTL 만료 또는 version-check 시점에 refresh 자동 발동, denyRate baseline 유지,
// 회복 시간 ≤ TTL+1cycle. spec 05 §1 bitmap cache deny fail-closed —
// 권한 정합성이 가용성보다 우선이므로 invalidate drop 후에도 stale data로
// 부정확한 allow가 발생하지 않아야 함.

import { ok } from 'node:assert/strict';
import type { Scenario } from '../runner/types.js';

interface S16Ctx {
  faultHandle: { off: () => Promise<void> };
  baselineDenyRate: number;
  ttlMs: number;
}

export const scenario16BitmapCacheVersionFallback: Scenario<S16Ctx> = {
  name: 'scenario-16-bitmap-cache-version-fallback',
  description: 'pub/sub drop → version 진화 → TTL/version-check refresh → denyRate 유지',
  validates: [
    'spec 05 §1 bitmap cache deny fail-closed',
    'TTL/version-check 기반 refresh fallback',
    'stale data로 부정확한 allow 미발생',
  ],

  async setup() {
    const inj = (
      globalThis as unknown as {
        __simFaultInjector?: {
          pubsubInvalidate: {
            drop: () => Promise<{ off: () => Promise<void> }>;
          };
        };
      }
    ).__simFaultInjector;
    if (!inj) throw new Error('__simFaultInjector not bound');

    const m = (
      globalThis as unknown as {
        __simBitmapMetrics?: {
          denyRate(): Promise<number>;
          bitmapTtlMs(): Promise<number>;
        };
      }
    ).__simBitmapMetrics;
    if (!m) throw new Error('__simBitmapMetrics not bound');
    const baselineDenyRate = await m.denyRate();
    const ttlMs = await m.bitmapTtlMs();

    const faultHandle = await inj.pubsubInvalidate.drop();
    return { faultHandle, baselineDenyRate, ttlMs };
  },

  async act(ctx) {
    // 권한 정의 변경(role 추가) → bitmap version v1→v2. publisher가 invalidate 보내지만 drop됨.
    const mut = (
      globalThis as unknown as {
        __simBitmapVersionMutator?: () => Promise<{ newVersion: string }>;
      }
    ).__simBitmapVersionMutator;
    if (!mut) throw new Error('__simBitmapVersionMutator not bound');
    const { newVersion } = await mut();

    // refresh 발동 경로 둘 — version-check (즉시) 또는 TTL 만료.
    const startedAt = Date.now();
    const checker = (
      globalThis as unknown as {
        __simBitmapVersionCheck?: (
          expected: string,
          timeoutMs: number,
        ) => Promise<{
          recoveredAtMs: number;
          recoveredVia: 'version-check' | 'ttl';
        }>;
      }
    ).__simBitmapVersionCheck;
    if (!checker) throw new Error('__simBitmapVersionCheck not bound');
    const recovery = await checker(newVersion, ctx.ttlMs + 30_000);
    const elapsedMs = recovery.recoveredAtMs - startedAt;

    return {
      data: { newVersion, elapsedMs, recoveredVia: recovery.recoveredVia },
      traceIds: [],
      stepCount: 1,
    };
  },

  async assert(ctx, actResult) {
    const elapsedMs = actResult.data.elapsedMs as number;
    const recoveredVia = actResult.data.recoveredVia as 'version-check' | 'ttl';

    // 회복 시간 ≤ TTL+1cycle (cycle=2s).
    const cycleMs = 2_000;
    ok(
      elapsedMs <= ctx.ttlMs + cycleMs,
      `recovery elapsed ${elapsedMs}ms must be ≤ TTL+cycle (${ctx.ttlMs + cycleMs}ms)`,
    );

    ok(
      recoveredVia === 'version-check' || recoveredVia === 'ttl',
      `recoveredVia must be 'version-check' or 'ttl', got ${recoveredVia}`,
    );

    // denyRate baseline ±5% — refresh 후 재측정.
    const m = (
      globalThis as unknown as {
        __simBitmapMetrics: { denyRate(): Promise<number> };
      }
    ).__simBitmapMetrics;
    const after = await m.denyRate();
    ok(
      Math.abs(after - ctx.baselineDenyRate) <= 0.05,
      `denyRate Δ must stay within ±5%, baseline=${ctx.baselineDenyRate} after=${after}`,
    );
  },

  async teardown(ctx) {
    await ctx.faultHandle.off();
  },
};
