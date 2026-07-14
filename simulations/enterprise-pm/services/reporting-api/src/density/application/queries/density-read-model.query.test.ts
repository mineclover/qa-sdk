// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

import { describe, expect, it } from 'vitest';
import { DensityReadModelQuery, type ComputeDensityArgs } from './density-read-model.query.js';
import type { MarginalDensityReadModel } from '../../domain/density.types.js';

class StubQuery extends DensityReadModelQuery {
  constructor(private readonly result: MarginalDensityReadModel) {
    super();
  }
  async compute(_args: ComputeDensityArgs): Promise<MarginalDensityReadModel> {
    return this.result;
  }
}

describe('DensityReadModelQuery (port contract)', () => {
  it('compute returns shape from adapter', async () => {
    const seed: MarginalDensityReadModel = {
      catalog: 'sim',
      prefix: 'sim.bitmap',
      version: 'uv1',
      axes: [],
      underutilizedAxes: [],
      saturatedAxes: [],
    };
    const q = new StubQuery(seed);
    const r = await q.compute({ catalog: 'sim', prefix: 'sim.bitmap', version: 'uv1' });
    expect(r.prefix).toBe('sim.bitmap');
  });
});
