// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios

import { describe, expect, it } from 'vitest';
import { runScenario } from '../runner/runner.js';
import { scenario10CanaryRollbackCompatibility } from './scenario-10-canary-rollback-compatibility.js';

const SKIP = process.env.SIM_SCENARIO_INPROC !== '1';

describe.skipIf(SKIP)('Scenario 10 — canary rollback (compatibility hard FAIL)', () => {
  it('scenario 10 통과 (in-process)', async () => {
    const result = await runScenario(scenario10CanaryRollbackCompatibility, {
      gatewayUrl: 'http://sim-gateway-inproc',
      mode: 'in-process',
    });
    if (result.status !== 'passed') {
      console.error('[Scenario 10 실패]', result.error);
    }
    expect(result.status).toBe('passed');
    expect(result.stepCount).toBeGreaterThanOrEqual(1);
  }, 60_000);
});

describe('Scenario 10 — static check', () => {
  it('scenario object has required fields', () => {
    expect(scenario10CanaryRollbackCompatibility.name).toBe(
      'scenario-10-canary-rollback-compatibility',
    );
    expect(scenario10CanaryRollbackCompatibility.validates.length).toBeGreaterThan(0);
    expect(typeof scenario10CanaryRollbackCompatibility.setup).toBe('function');
    expect(typeof scenario10CanaryRollbackCompatibility.act).toBe('function');
    expect(typeof scenario10CanaryRollbackCompatibility.assert).toBe('function');
    expect(typeof scenario10CanaryRollbackCompatibility.teardown).toBe('function');
  });
});
