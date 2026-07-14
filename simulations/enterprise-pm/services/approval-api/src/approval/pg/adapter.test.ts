// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PgApprovalRepository } from './adapter.js';
import { SIM_APPROVAL_PG_RESET_DDL } from './schema.js';

const PG_AVAILABLE = process.env.QA_TEST_PG === '1';

describe.skipIf(!PG_AVAILABLE)('PgApprovalRepository — PG-specific', () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? 'localhost';
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? '5434');
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? 'qa_sdk_test';
  const PG_USER = process.env.QA_TEST_PG_USER ?? 'qa_admin';
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? '';

  let sql: ReturnType<typeof postgres>;
  let repo: PgApprovalRepository;

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
    await sql.unsafe(SIM_APPROVAL_PG_RESET_DDL);
    repo = new PgApprovalRepository(drizzle({ client: sql }));
  });

  afterEach(async () => {
    try {
      await sql.unsafe(`DROP TABLE IF EXISTS sim.approval_steps CASCADE`);
      await sql.unsafe(`DROP TABLE IF EXISTS sim.approval_budget_requests CASCADE`);
      await sql.unsafe(`DROP TABLE IF EXISTS sim.approval_resource_requests CASCADE`);
      await sql.unsafe(`DROP TABLE IF EXISTS sim.approval_time_off_requests CASCADE`);
      await sql.unsafe(`DROP TABLE IF EXISTS sim.approval_expense_reports CASCADE`);
    } finally {
      await sql.end();
    }
  });

  it('createBudgetRequest amount-based stage', async () => {
    const br = await repo.createBudgetRequest({
      projectId: 'p',
      amount: 5_000_000,
      requesterId: 'u',
    });
    expect(br.totalStages).toBe(2);
    const steps = await repo.listSteps(br.id);
    expect(steps.length).toBe(2);
  });

  it('recordDecision flow — step 갱신 후 listSteps 반영', async () => {
    const br = await repo.createBudgetRequest({
      projectId: 'p',
      amount: 500_000,
      requesterId: 'u',
    });
    await repo.recordDecision(br.id, 1, 'mgr-1', 'approved', 'ok');
    const steps = await repo.listSteps(br.id);
    expect(steps[0].approverId).toBe('mgr-1');
    expect(steps[0].decision).toBe('approved');
  });
});
