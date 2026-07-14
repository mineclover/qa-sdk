// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios

import { describe, expect, it } from 'vitest';
import { runScenario } from '../runner/runner.js';
import { scenario12ScaleUpLoadPressure } from './scenario-12-scale-up-load-pressure.js';

const SKIP = process.env.SIM_SCENARIO_INPROC !== '1';

describe.skipIf(SKIP)('Scenario 12 — scale-up on load pressure (RPS burst)', () => {
  it('scenario 12 통과 (in-process)', async () => {
    const result = await runScenario(scenario12ScaleUpLoadPressure, {
      gatewayUrl: 'http://sim-gateway-inproc',
      mode: 'in-process',
    });
    if (result.status !== 'passed') {
      console.error('[Scenario 12 실패]', result.error);
    }
    expect(result.status).toBe('passed');
    expect(result.stepCount).toBeGreaterThanOrEqual(1);
  }, 90_000);
});

describe('Scenario 12 — static check', () => {
  it('scenario object has required fields', () => {
    expect(scenario12ScaleUpLoadPressure.name).toBe('scenario-12-scale-up-load-pressure');
    expect(scenario12ScaleUpLoadPressure.validates.length).toBeGreaterThan(0);
    expect(typeof scenario12ScaleUpLoadPressure.setup).toBe('function');
    expect(typeof scenario12ScaleUpLoadPressure.act).toBe('function');
    expect(typeof scenario12ScaleUpLoadPressure.assert).toBe('function');
    expect(typeof scenario12ScaleUpLoadPressure.teardown).toBe('function');
  });
});
