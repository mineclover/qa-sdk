// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios

import { describe, expect, it } from 'vitest';
import { runScenario } from '../runner/runner.js';
import { scenario16BitmapCacheVersionFallback } from './scenario-16-bitmap-cache-version-fallback.js';

const SKIP = process.env.SIM_SCENARIO_INPROC !== '1';

describe.skipIf(SKIP)('Scenario 16 — bitmap cache version fallback (TTL/version-check)', () => {
  it('scenario 16 통과 (in-process)', async () => {
    const result = await runScenario(scenario16BitmapCacheVersionFallback, {
      gatewayUrl: 'http://sim-gateway-inproc',
      mode: 'in-process',
    });
    if (result.status !== 'passed') {
      console.error('[Scenario 16 실패]', result.error);
    }
    expect(result.status).toBe('passed');
  }, 60_000);
});

describe('Scenario 16 — static check', () => {
  it('scenario object has required fields', () => {
    expect(scenario16BitmapCacheVersionFallback.name).toBe(
      'scenario-16-bitmap-cache-version-fallback',
    );
    expect(scenario16BitmapCacheVersionFallback.validates.length).toBeGreaterThan(0);
    expect(typeof scenario16BitmapCacheVersionFallback.setup).toBe('function');
    expect(typeof scenario16BitmapCacheVersionFallback.act).toBe('function');
    expect(typeof scenario16BitmapCacheVersionFallback.assert).toBe('function');
    expect(typeof scenario16BitmapCacheVersionFallback.teardown).toBe('function');
  });
});
