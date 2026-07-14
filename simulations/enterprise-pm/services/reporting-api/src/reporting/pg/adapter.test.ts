// @def.boundary sim-reporting-api
// @def.doc sim-erp-pm-design

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PgReportingRepository } from './adapter.js';
import { SIM_REPORTING_PG_RESET_DDL } from './schema.js';

const PG_AVAILABLE = process.env.QA_TEST_PG === '1';

describe.skipIf(!PG_AVAILABLE)('PgReportingRepository — PG-specific', () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? 'localhost';
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? '5434');
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? 'qa_sdk_test';
  const PG_USER = process.env.QA_TEST_PG_USER ?? 'qa_admin';
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? '';

  let sql: ReturnType<typeof postgres>;
  let repo: PgReportingRepository;

  beforeEach(async () => {
    sql = postgres({
      host: PG_HOST,
      port: PG_PORT,
      database: PG_DATABASE,
      user: PG_USER,
      password: PG_PASSWORD,
      max: 5,
      onnotice: () => {},
    });
    await sql.unsafe(SIM_REPORTING_PG_RESET_DDL);
    repo = new PgReportingRepository(drizzle({ client: sql }));
  });

  afterEach(async () => {
    try {
      await sql.unsafe(`DROP TABLE IF EXISTS sim.reporting_daily_metrics CASCADE`);
      await sql.unsafe(`DROP TABLE IF EXISTS sim.reporting_reports CASCADE`);
    } finally {
      await sql.end();
    }
  });

  it('createReport round-trip', async () => {
    const r = await repo.createReport({ name: 'D', queryDefinition: '{}', createdBy: 'u' });
    expect((await repo.findReport(r.id))?.name).toBe('D');
  });

  it('recordMetric + listMetricsByKey range', async () => {
    await repo.recordMetric({ metricKey: 'k', date: '2026-04-22', value: 1, dimensions: '{}' });
    await repo.recordMetric({ metricKey: 'k', date: '2026-04-23', value: 2, dimensions: '{}' });
    const res = await repo.listMetricsByKey('k', '2026-04-22', '2026-04-23');
    expect(res.length).toBe(2);
  });
});
