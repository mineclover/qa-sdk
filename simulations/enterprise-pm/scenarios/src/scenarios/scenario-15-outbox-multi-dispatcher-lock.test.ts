// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios

import { describe, expect, it } from 'vitest';
import { runScenario } from '../runner/runner.js';
import { scenario15OutboxMultiDispatcherLock } from './scenario-15-outbox-multi-dispatcher-lock.js';

const SKIP = process.env.SIM_SCENARIO_INPROC !== '1';

describe.skipIf(SKIP)('Scenario 15 — outbox multi dispatcher (5 disjoint, lag<100ms)', () => {
  it('scenario 15 통과 (in-process)', async () => {
    const result = await runScenario(scenario15OutboxMultiDispatcherLock, {
      gatewayUrl: 'http://sim-gateway-inproc',
      mode: 'in-process',
    });
    if (result.status !== 'passed') {
      console.error('[Scenario 15 실패]', result.error);
    }
    expect(result.status).toBe('passed');
    expect(result.stepCount).toBe(5);
  }, 30_000);
});

describe('Scenario 15 — static check', () => {
  it('scenario object has required fields', () => {
    expect(scenario15OutboxMultiDispatcherLock.name).toBe(
      'scenario-15-outbox-multi-dispatcher-lock',
    );
    expect(scenario15OutboxMultiDispatcherLock.validates.length).toBeGreaterThan(0);
    expect(typeof scenario15OutboxMultiDispatcherLock.setup).toBe('function');
    expect(typeof scenario15OutboxMultiDispatcherLock.act).toBe('function');
    expect(typeof scenario15OutboxMultiDispatcherLock.assert).toBe('function');
    expect(typeof scenario15OutboxMultiDispatcherLock.teardown).toBe('function');
  });
});
