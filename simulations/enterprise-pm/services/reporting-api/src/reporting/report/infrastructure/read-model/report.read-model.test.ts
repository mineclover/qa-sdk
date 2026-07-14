// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { SqliteReportingRepository } from '../../../sqlite/adapter.js';
import { SIM_REPORTING_SQLITE_DDL } from '../../../sqlite/schema.js';
import { RepositoryReportReadModel } from './report.read-model.js';

function makeReadModel() {
  const raw = new Database(':memory:');
  raw.exec(SIM_REPORTING_SQLITE_DDL);
  const repo = new SqliteReportingRepository(drizzle({ client: raw }));
  return { repo, readModel: new RepositoryReportReadModel(repo), raw };
}

describe('RepositoryReportReadModel', () => {
  it('findDetail — null when missing', async () => {
    const { readModel } = makeReadModel();
    expect(await readModel.findDetail('missing')).toBeNull();
  });

  it('findDetail — returns mapped read model after insert', async () => {
    const { repo, readModel } = makeReadModel();
    const created = await repo.createReport({
      name: 'weekly',
      queryDefinition: '{}',
      createdBy: 'alice',
    });
    const found = await readModel.findDetail(created.id);
    expect(found?.name).toBe('weekly');
    expect(found?.id).toBe(created.id);
    expect(found?.createdBy).toBe('alice');
  });

  it('listAll — returns multiple reports', async () => {
    const { repo, readModel } = makeReadModel();
    await repo.createReport({ name: 'a', queryDefinition: '{}', createdBy: 'u' });
    await repo.createReport({ name: 'b', queryDefinition: '{}', createdBy: 'u' });
    const all = await readModel.listAll();
    expect(all.map((r) => r.name).sort()).toEqual(['a', 'b']);
  });
});
