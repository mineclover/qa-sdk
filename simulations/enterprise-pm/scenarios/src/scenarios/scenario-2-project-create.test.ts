import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { runScenario } from '../runner/runner.js';
import { scenario2ProjectCreate } from './scenario-2-project-create.js';
import type { InProcessHandle } from '../env/in-process-env.js';

const SKIP = process.env.SIM_SCENARIO_INPROC !== '1';

describe.skipIf(SKIP)('Scenario 2 — project create + owner 자동 권한', () => {
  let handle: InProcessHandle;
  beforeAll(async () => {
    const { bootstrapInProcess } = await import('../env/in-process-env.js');
    handle = await bootstrapInProcess({
      jwtSecret: 'x'.repeat(32),
      dialect: 'sqlite',
    });
    const g = globalThis as unknown as {
      __simGatewayFetch: typeof handle.gatewayFetch;
      __simHandle: typeof handle;
    };
    g.__simGatewayFetch = handle.gatewayFetch;
    g.__simHandle = handle;
  }, 60_000);
  afterAll(async () => {
    if (handle) await handle.cleanup();
  });

  it('scenario 2 통과 (in-process)', async () => {
    const result = await runScenario(scenario2ProjectCreate, {
      gatewayUrl: 'http://sim-gateway-inproc',
      mode: 'in-process',
    });
    if (result.status !== 'passed') {
      console.error('[Scenario 2 실패]', result.error);
    }
    expect(result.status).toBe('passed');
    expect(result.stepCount).toBe(3);
  }, 30_000);
});
