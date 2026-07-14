// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { createApprovalRepository, type ApprovalRepoDialect } from './factory.js';
import { SIM_APPROVAL_SQLITE_DDL } from './sqlite/schema.js';
import { SIM_APPROVAL_PG_RESET_DDL } from './pg/schema.js';
import type { ApprovalRepository } from './shared/port.js';

interface FixtureRunner {
  setup(): Promise<{ repo: ApprovalRepository; cleanup(): Promise<void> }>;
}

const sqliteRunner: FixtureRunner = {
  async setup() {
    const raw = new Database(':memory:');
    raw.exec(SIM_APPROVAL_SQLITE_DDL);
    const repo = await createApprovalRepository({
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
      await sql.unsafe(SIM_APPROVAL_PG_RESET_DDL);
      const repo = await createApprovalRepository({
        dialect: 'pg',
        db: drizzlePg({ client: sql }),
      });
      return {
        repo,
        cleanup: async () => {
          try {
            await sql.unsafe(`DROP TABLE IF EXISTS sim.approval_steps CASCADE`);
            await sql.unsafe(`DROP TABLE IF EXISTS sim.approval_budget_requests CASCADE`);
            await sql.unsafe(`DROP TABLE IF EXISTS sim.approval_resource_requests CASCADE`);
            await sql.unsafe(`DROP TABLE IF EXISTS sim.approval_time_off_requests CASCADE`);
            await sql.unsafe(`DROP TABLE IF EXISTS sim.approval_expense_reports CASCADE`);
          } finally {
            await sql.end();
          }
        },
      };
    },
  };
}

const PG_AVAILABLE = process.env.QA_TEST_PG === '1';
const matrix: Array<[ApprovalRepoDialect, FixtureRunner]> = [
  ['sqlite', sqliteRunner],
  ...(PG_AVAILABLE
    ? ([['pg', makePgRunner()]] as Array<[ApprovalRepoDialect, FixtureRunner]>)
    : []),
];

describe.each(matrix)('ApprovalRepository contract — %s', (dialect, runner) => {
  let repo: ApprovalRepository;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const ctx = await runner.setup();
    repo = ctx.repo;
    cleanup = ctx.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it(`amount-based stage 결정 — ${dialect}`, async () => {
    const br1 = await repo.createBudgetRequest({
      projectId: 'p',
      amount: 500_000,
      requesterId: 'u',
    });
    const br2 = await repo.createBudgetRequest({
      projectId: 'p',
      amount: 5_000_000,
      requesterId: 'u',
    });
    const br3 = await repo.createBudgetRequest({
      projectId: 'p',
      amount: 20_000_000,
      requesterId: 'u',
    });
    expect([br1.totalStages, br2.totalStages, br3.totalStages]).toEqual([1, 2, 3]);
  });

  it(`recordDecision flow — ${dialect}`, async () => {
    const br = await repo.createBudgetRequest({
      projectId: 'p',
      amount: 500_000,
      requesterId: 'u',
    });
    await repo.recordDecision(br.id, 1, 'mgr-1', 'approved', 'ok');
    const steps = await repo.listSteps(br.id);
    expect(steps[0].decision).toBe('approved');
    expect(steps[0].approverId).toBe('mgr-1');
  });

  it(`ResourceRequest 생성 + status 변경 — ${dialect}`, async () => {
    const r = await repo.createResourceRequest({
      projectId: 'p',
      requesterId: 'u',
      resourceType: 'equipment',
      description: 'laptop',
    });
    const next = await repo.updateResourceRequestStatus(r.id, 'approved');
    expect(next.status).toBe('approved');
  });

  it(`ExpenseReport 생성 + status 변경 — ${dialect}`, async () => {
    const r = await repo.createExpenseReport({
      requesterId: 'u',
      amount: 30_000,
      category: 'travel',
      description: 'KTX',
    });
    const next = await repo.updateExpenseReportStatus(r.id, 'approved');
    expect(next.status).toBe('approved');
  });
});
