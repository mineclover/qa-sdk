// @def.boundary sim-reporting-api
// @def.doc sim-erp-pm-design

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { createReportingRepository, type ReportingRepoDialect } from './factory.js';
import { SIM_REPORTING_SQLITE_DDL } from './sqlite/schema.js';
import { SIM_REPORTING_PG_RESET_DDL } from './pg/schema.js';
import type { ReportingRepository } from './shared/port.js';

interface FixtureRunner {
  setup(): Promise<{ repo: ReportingRepository; cleanup(): Promise<void> }>;
}

const sqliteRunner: FixtureRunner = {
  async setup() {
    const raw = new Database(':memory:');
    raw.exec(SIM_REPORTING_SQLITE_DDL);
    const repo = await createReportingRepository({
      dialect: 'sqlite',
      db: drizzleSqlite({ client: raw }),
    });
    return {
      repo,
      cleanup: async () => {
        raw.close();
      },
    };
  },
};

function makePgRunner(): FixtureRunner {
  const PG_CFG = {
    host: process.env.QA_TEST_PG_HOST ?? 'localhost',
    port: Number(process.env.QA_TEST_PG_PORT ?? '5434'),
    database: process.env.QA_TEST_PG_DATABASE ?? 'qa_sdk_test',
    user: process.env.QA_TEST_PG_USER ?? 'qa_admin',
    password: process.env.QA_TEST_PG_PASSWORD ?? '',
  };
  return {
    async setup() {
      const sql = postgres({
        host: PG_CFG.host,
        port: PG_CFG.port,
        database: PG_CFG.database,
        user: PG_CFG.user,
        password: PG_CFG.password,
        max: 5,
        onnotice: () => {},
      });
      await sql.unsafe(SIM_REPORTING_PG_RESET_DDL);
      const repo = await createReportingRepository({
        dialect: 'pg',
        db: drizzlePg({ client: sql }),
      });
      return {
        repo,
        cleanup: async () => {
          try {
            await sql.unsafe(`DROP TABLE IF EXISTS sim.reporting_daily_metrics CASCADE`);
            await sql.unsafe(`DROP TABLE IF EXISTS sim.reporting_reports CASCADE`);
          } finally {
            await sql.end();
          }
        },
      };
    },
  };
}

const PG_AVAILABLE = process.env.QA_TEST_PG === '1';
const matrix: Array<[ReportingRepoDialect, FixtureRunner]> = [
  ['sqlite', sqliteRunner],
  ...(PG_AVAILABLE
    ? ([['pg', makePgRunner()]] as Array<[ReportingRepoDialect, FixtureRunner]>)
    : []),
];

describe.each(matrix)('ReportingRepository contract — %s', (dialect, runner) => {
  let repo: ReportingRepository;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const ctx = await runner.setup();
    repo = ctx.repo;
    cleanup = ctx.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it(`createReport + findReport — ${dialect}`, async () => {
    const r = await repo.createReport({
      name: `n-${dialect}`,
      queryDefinition: '{}',
      createdBy: 'u',
    });
    expect((await repo.findReport(r.id))?.name).toBe(`n-${dialect}`);
  });

  it(`listReports — ${dialect}`, async () => {
    await repo.createReport({ name: `a-${dialect}`, queryDefinition: '{}', createdBy: 'u' });
    await repo.createReport({ name: `b-${dialect}`, queryDefinition: '{}', createdBy: 'u' });
    expect((await repo.listReports()).length).toBe(2);
  });

  it(`recordMetric + listMetricsByKey range — ${dialect}`, async () => {
    await repo.recordMetric({
      metricKey: `k-${dialect}`,
      date: '2026-04-22',
      value: 1,
      dimensions: '{}',
    });
    await repo.recordMetric({
      metricKey: `k-${dialect}`,
      date: '2026-04-23',
      value: 2,
      dimensions: '{}',
    });
    const res = await repo.listMetricsByKey(`k-${dialect}`, '2026-04-22', '2026-04-23');
    expect(res.length).toBe(2);
  });

  it(`listMetricKeys distinct — ${dialect}`, async () => {
    await repo.recordMetric({
      metricKey: `a-${dialect}`,
      date: '2026-04-22',
      value: 1,
      dimensions: '{}',
    });
    await repo.recordMetric({
      metricKey: `a-${dialect}`,
      date: '2026-04-23',
      value: 2,
      dimensions: '{}',
    });
    await repo.recordMetric({
      metricKey: `b-${dialect}`,
      date: '2026-04-22',
      value: 3,
      dimensions: '{}',
    });
    const keys = await repo.listMetricKeys();
    expect(keys.includes(`a-${dialect}`)).toBe(true);
    expect(keys.includes(`b-${dialect}`)).toBe(true);
  });
});
