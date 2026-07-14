import { describe, expect, it, vi } from 'vitest';
import { runScenario } from './runner.js';
import type { Scenario } from './types.js';

describe('runScenario', () => {
  it('성공 시나리오 — setup→act→assert→teardown 4 phase 실행 + status=passed', async () => {
    const setup = vi.fn(async () => ({ x: 1 }));
    const act = vi.fn(async () => ({
      data: { ok: true },
      traceIds: ['t1'],
      stepCount: 2,
      operatorHints: [
        'pnpm --filter @qa-sdk/sim-scenarios start -- audit context --root-span-id root-1 --graph-id graph-1',
      ],
    }));
    const assertFn = vi.fn(async () => undefined);
    const teardown = vi.fn(async () => undefined);

    const scenario: Scenario<{ x: number }> = {
      name: 'test',
      description: 't',
      validates: [],
      setup,
      act,
      assert: assertFn,
      teardown,
    };
    const result = await runScenario(scenario, {
      gatewayUrl: 'http://x',
      mode: 'in-process',
    });
    expect(result.status).toBe('passed');
    expect(result.stepCount).toBe(2);
    expect(result.traceIds).toEqual(['t1']);
    expect(result.operatorHints).toEqual([
      'pnpm --filter @qa-sdk/sim-scenarios start -- audit context --root-span-id root-1 --graph-id graph-1',
    ]);
    expect(setup).toHaveBeenCalledTimes(1);
    expect(act).toHaveBeenCalledTimes(1);
    expect(assertFn).toHaveBeenCalledTimes(1);
    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it('assert 실패 — status=failed, phase=assert, teardown 호출 보장', async () => {
    const teardown = vi.fn(async () => undefined);
    const scenario: Scenario = {
      name: 'fail',
      description: '',
      validates: [],
      setup: async () => ({}),
      act: async () => ({ data: {}, traceIds: [], stepCount: 0 }),
      assert: async () => {
        throw new Error('assert boom');
      },
      teardown,
    };
    const result = await runScenario(scenario, {
      gatewayUrl: 'http://x',
      mode: 'in-process',
    });
    expect(result.status).toBe('failed');
    expect(result.error?.phase).toBe('assert');
    expect(result.error?.message).toBe('assert boom');
    expect(teardown).toHaveBeenCalled();
  });

  it('setup 실패 — phase=setup, act/assert/teardown 호출 안 됨', async () => {
    const act = vi.fn();
    const teardown = vi.fn();
    const scenario: Scenario = {
      name: 'setup-fail',
      description: '',
      validates: [],
      setup: async () => {
        throw new Error('setup boom');
      },
      act,
      assert: async () => {},
      teardown,
    };
    const result = await runScenario(scenario, {
      gatewayUrl: 'http://x',
      mode: 'in-process',
    });
    expect(result.status).toBe('failed');
    expect(result.error?.phase).toBe('setup');
    expect(act).not.toHaveBeenCalled();
    expect(teardown).not.toHaveBeenCalled();
  });

  it('teardown 실패 — assert 성공 후에도 status=failed, phase=teardown', async () => {
    const scenario: Scenario = {
      name: 'td-fail',
      description: '',
      validates: [],
      setup: async () => ({}),
      act: async () => ({ data: {}, traceIds: [], stepCount: 1 }),
      assert: async () => {},
      teardown: async () => {
        throw new Error('td boom');
      },
    };
    const result = await runScenario(scenario, {
      gatewayUrl: 'http://x',
      mode: 'in-process',
    });
    expect(result.status).toBe('failed');
    expect(result.error?.phase).toBe('teardown');
  });

  it('durationMs 측정 (≥ 0)', async () => {
    const scenario: Scenario = {
      name: 'dur',
      description: '',
      validates: [],
      setup: async () => ({}),
      act: async () => ({ data: {}, traceIds: [], stepCount: 0 }),
      assert: async () => {},
      teardown: async () => {},
    };
    const result = await runScenario(scenario, {
      gatewayUrl: 'http://x',
      mode: 'in-process',
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
