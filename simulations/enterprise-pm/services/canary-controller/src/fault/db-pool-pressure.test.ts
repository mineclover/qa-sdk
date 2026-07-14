// @def.boundary sim-canary-controller
// @def.doc canary-controller-config

import { describe, it, expect, beforeEach } from 'vitest';
import { DbPoolPressureFault, type DbPoolGaugeStore } from './db-pool-pressure.js';

class InMem implements DbPoolGaugeStore {
  state = new Map<string, { active: number; max: number }>();
  async setForcedUtilization(svc: string, active: number, max: number) {
    this.state.set(svc, { active, max });
  }
  async clear(svc?: string) {
    if (svc) this.state.delete(svc);
    else this.state.clear();
  }
}

describe('DbPoolPressureFault (시나리오 #13)', () => {
  let g: InMem, f: DbPoolPressureFault;
  beforeEach(() => {
    g = new InMem();
    f = new DbPoolPressureFault(g);
  });

  it('enable forces utilization=1.0 by default + supports custom active below max', async () => {
    await f.enable({ service: 'approval-api-v2', poolMax: 4 });
    expect(g.state.get('approval-api-v2')).toEqual({ active: 4, max: 4 });
    await f.enable({ service: 'approval-api-v2', poolMax: 4, active: 3 });
    expect(g.state.get('approval-api-v2')).toEqual({ active: 3, max: 4 });
  });
  it('disable clears only the target service, reset clears all', async () => {
    await f.enable({ service: 'approval-api-v2', poolMax: 4 });
    await f.enable({ service: 'reporting-api-v1', poolMax: 4 });
    await f.disable('approval-api-v2');
    expect(g.state.has('approval-api-v2')).toBe(false);
    expect(g.state.has('reporting-api-v1')).toBe(true);
    await f.reset();
    expect(g.state.size).toBe(0);
  });
  it('rejects active > poolMax', async () => {
    await expect(f.enable({ service: 'x', poolMax: 4, active: 5 })).rejects.toThrow();
  });
});
