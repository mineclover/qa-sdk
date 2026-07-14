// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import { MetricReadModelQuery } from './metric-read-model.query.js';
import type { DailyMetricReadModel } from '../../domain/metric.types.js';
import type { MetricId, MetricKey } from '../../domain/metric.ids.js';

class StubQuery extends MetricReadModelQuery {
  constructor(private readonly seed: DailyMetricReadModel[]) {
    super();
  }
  async findOne(metricKey: string, date: string): Promise<DailyMetricReadModel | null> {
    return this.seed.find((m) => m.metricKey === metricKey && m.date === date) ?? null;
  }
  async listByKey(
    metricKey: string,
    fromDate: string,
    toDate: string,
  ): Promise<DailyMetricReadModel[]> {
    return this.seed.filter(
      (m) => m.metricKey === metricKey && m.date >= fromDate && m.date <= toDate,
    );
  }
  async listKeys(): Promise<string[]> {
    return Array.from(new Set(this.seed.map((m) => m.metricKey)));
  }
}

describe('MetricReadModelQuery (port contract)', () => {
  const sample: DailyMetricReadModel = {
    id: 'm-1' as MetricId,
    metricKey: 'k.density' as MetricKey,
    date: '2026-04-22',
    value: 0.5,
    dimensions: '{}',
    computedAt: '2026-04-22T00:00:00.000Z',
  };

  it('findOne returns matching entry', async () => {
    const q = new StubQuery([sample]);
    expect(await q.findOne('k.density', '2026-04-22')).toEqual(sample);
  });

  it('listByKey filters by range', async () => {
    const q = new StubQuery([sample]);
    expect((await q.listByKey('k.density', '2026-04-21', '2026-04-23')).length).toBe(1);
    expect((await q.listByKey('k.density', '2026-04-23', '2026-04-24')).length).toBe(0);
  });

  it('listKeys distinct', async () => {
    const q = new StubQuery([sample, { ...sample, date: '2026-04-23' }]);
    expect(await q.listKeys()).toEqual(['k.density']);
  });
});
