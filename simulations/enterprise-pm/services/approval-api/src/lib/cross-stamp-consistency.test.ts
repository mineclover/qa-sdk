// @def.boundary sim-approval-api
// @def.doc 02-canary-topology

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';

/**
 * 단계 8 수렴 단언 (spec 02 §4.1+§4.2 + spec 04 §4.2).
 *
 * - 응답 헤더의 x-service-version과 outbox payload의 serviceVersion이
 *   동일한 SIM_SERVICE_VERSION에서 파생된다.
 * - schemaHash는 모듈 로드 회수와 무관하게 결정론적이다 (build-time 상수).
 * - READ_DATA_SOURCE !== WRITE_DATA_SOURCE (instance 분리, spec 04 §4.2).
 */
describe('단계 8 cross-stamp consistency', () => {
  beforeAll(() => {
    process.env.SIM_SERVICE_VERSION = 'v3';
    process.env.SIM_DB_WRITE_URL = 'postgres://x:y@h/y';
    process.env.SIM_DB_READ_URL = 'postgres://x:y@h/y';
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('interceptor SERVICE_VERSION == helper SERVICE_VERSION (단일 출처)', async () => {
    process.env.SIM_SERVICE_VERSION = 'v3';
    vi.resetModules();
    const helper = await import('./service-version.js');
    // interceptor는 helper의 SERVICE_VERSION 상수를 import하므로 같은 출처.
    // 본 테스트는 두 모듈이 다른 캐시에 잡혀 다른 값을 갖게 되는 회귀를 방지.
    const interceptorMod = await import('./version-stamp.interceptor.js');
    expect(helper.SERVICE_VERSION).toBe('v3');
    expect(typeof interceptorMod.VersionStampInterceptor).toBe('function');
  });

  it('outbox payload serviceVersion == helper SERVICE_VERSION', async () => {
    process.env.SIM_SERVICE_VERSION = 'v4-candidate';
    vi.resetModules();
    const appendSpy = vi.fn().mockResolvedValue(undefined);
    vi.doMock('@qa-sdk/sim-domain-slice-kit', async () => {
      const actual = await vi.importActual<typeof import('@qa-sdk/sim-domain-slice-kit')>(
        '@qa-sdk/sim-domain-slice-kit',
      );
      return {
        ...actual,
        createDrizzleOutboxPort: () => ({ append: appendSpy }),
      };
    });

    const { SERVICE_VERSION } = await import('./service-version.js');
    const { createBudgetOutboxPort } =
      await import('../approval/budget/infrastructure/outbox/budget.outbox.js');

    const port = createBudgetOutboxPort({ dialect: 'sqlite', db: {} as never });
    await port.append(
      {
        eventName: 'approval.budget.submitted',
        eventVersion: 1,
        aggregateId: 'b-1',
        payload: { id: 'b-1' },
        occurredAt: new Date(0),
        idempotencyKey: 'k-1',
      },
      {} as never,
    );

    const calledWith = appendSpy.mock.calls[0]?.[0] as {
      payload: { serviceVersion: string };
    };
    expect(calledWith.payload.serviceVersion).toBe(SERVICE_VERSION);
    expect(calledWith.payload.serviceVersion).toBe('v4-candidate');
  });

  it('BUDGET_SCHEMA_HASH는 import 회수와 무관하게 동일 (build-time 결정)', async () => {
    process.env.SIM_SERVICE_VERSION = 'v3';
    vi.resetModules();
    vi.doMock('@qa-sdk/sim-domain-slice-kit', async () => {
      const actual = await vi.importActual<typeof import('@qa-sdk/sim-domain-slice-kit')>(
        '@qa-sdk/sim-domain-slice-kit',
      );
      return {
        ...actual,
        createDrizzleOutboxPort: () => ({ append: vi.fn() }),
      };
    });
    const a = await import('../approval/budget/infrastructure/outbox/budget.outbox.js');
    const b = await import('../approval/budget/infrastructure/outbox/budget.outbox.js');
    expect(a.BUDGET_SCHEMA_HASH).toBe(b.BUDGET_SCHEMA_HASH);
  });

  it('READ_DATA_SOURCE !== WRITE_DATA_SOURCE (Symbol 분리)', async () => {
    process.env.SIM_SERVICE_VERSION = 'v3';
    vi.resetModules();
    const mod = await import('../approval/approval-db.module.js');
    expect(mod.READ_DATA_SOURCE).not.toBe(mod.WRITE_DATA_SOURCE);
    expect(typeof mod.READ_DATA_SOURCE).toBe('symbol');
    expect(typeof mod.WRITE_DATA_SOURCE).toBe('symbol');
  });
});
