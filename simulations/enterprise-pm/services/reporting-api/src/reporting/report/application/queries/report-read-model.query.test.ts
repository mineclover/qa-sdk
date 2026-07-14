// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import { ReportReadModelQuery } from './report-read-model.query.js';
import type { ReportReadModel } from '../../domain/report.types.js';

class StubQuery extends ReportReadModelQuery {
  constructor(private readonly seed: Record<string, ReportReadModel>) {
    super();
  }
  async findDetail(id: string): Promise<ReportReadModel | null> {
    return this.seed[id] ?? null;
  }
  async listAll(): Promise<ReportReadModel[]> {
    return Object.values(this.seed);
  }
}

describe('ReportReadModelQuery (port contract)', () => {
  it('findDetail returns null for missing id', async () => {
    const q = new StubQuery({});
    expect(await q.findDetail('nope')).toBeNull();
  });

  it('listAll returns seeded entries', async () => {
    const seeded: ReportReadModel = {
      id: 'r-1' as ReportReadModel['id'],
      name: 'monthly',
      queryDefinition: '{}',
      createdBy: 'u',
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:00.000Z',
    };
    const q = new StubQuery({ 'r-1': seeded });
    const all = await q.listAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('monthly');
  });
});
