import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { SqliteApprovalRepository } from './adapter.js';
import { SIM_APPROVAL_SQLITE_DDL } from './schema.js';

function fixture() {
  const raw = new Database(':memory:');
  raw.exec(SIM_APPROVAL_SQLITE_DDL);
  return {
    repo: new SqliteApprovalRepository(drizzle({ client: raw })),
    close: () => raw.close(),
  };
}

describe('SqliteApprovalRepository', () => {
  let f: ReturnType<typeof fixture>;
  beforeEach(() => {
    f = fixture();
  });
  afterEach(() => f.close());

  it('createBudgetRequest amount=500_000 → totalStages=1, currentStage=1, status=draft', async () => {
    const br = await f.repo.createBudgetRequest({
      projectId: 'p',
      amount: 500_000,
      requesterId: 'u',
    });
    expect(br.totalStages).toBe(1);
    expect(br.currentStage).toBe(1);
    expect(br.status).toBe('draft');
  });

  it('createBudgetRequest amount=5_000_000 → totalStages=2', async () => {
    const br = await f.repo.createBudgetRequest({
      projectId: 'p',
      amount: 5_000_000,
      requesterId: 'u',
    });
    expect(br.totalStages).toBe(2);
  });

  it('createBudgetRequest amount=20_000_000 → totalStages=3', async () => {
    const br = await f.repo.createBudgetRequest({
      projectId: 'p',
      amount: 20_000_000,
      requesterId: 'u',
    });
    expect(br.totalStages).toBe(3);
  });

  it('createApprovalSteps — totalStages 만큼 pending row', async () => {
    const br = await f.repo.createBudgetRequest({
      projectId: 'p',
      amount: 5_000_000,
      requesterId: 'u',
    });
    const steps = await f.repo.listSteps(br.id);
    expect(steps.length).toBe(2);
    expect(steps.every((s) => s.decision === 'pending')).toBe(true);
  });

  it('recordDecision — approver_id + decision 갱신', async () => {
    const br = await f.repo.createBudgetRequest({
      projectId: 'p',
      amount: 500_000,
      requesterId: 'u',
    });
    await f.repo.recordDecision(br.id, 1, 'mgr-1', 'approved', 'ok');
    const steps = await f.repo.listSteps(br.id);
    expect(steps[0].approverId).toBe('mgr-1');
    expect(steps[0].decision).toBe('approved');
    expect(steps[0].comment).toBe('ok');
  });

  it('updateBudgetRequestState — status + currentStage', async () => {
    const br = await f.repo.createBudgetRequest({
      projectId: 'p',
      amount: 500_000,
      requesterId: 'u',
    });
    const next = await f.repo.updateBudgetRequestState(br.id, 'approved', 1);
    expect(next.status).toBe('approved');
  });

  it('listBudgetRequestsByProject / Requester', async () => {
    await f.repo.createBudgetRequest({ projectId: 'p-1', amount: 100_000, requesterId: 'u-1' });
    await f.repo.createBudgetRequest({ projectId: 'p-1', amount: 200_000, requesterId: 'u-2' });
    await f.repo.createBudgetRequest({ projectId: 'p-2', amount: 300_000, requesterId: 'u-1' });
    expect((await f.repo.listBudgetRequestsByProject('p-1')).length).toBe(2);
    expect((await f.repo.listBudgetRequestsByRequester('u-1')).length).toBe(2);
  });

  it('createResourceRequest + updateResourceRequestStatus', async () => {
    const r = await f.repo.createResourceRequest({
      projectId: 'p',
      requesterId: 'u',
      resourceType: 'consultant',
      description: 'x',
    });
    expect(r.status).toBe('draft');
    const next = await f.repo.updateResourceRequestStatus(r.id, 'approved');
    expect(next.status).toBe('approved');
  });

  it('createTimeOffRequest + status 변경', async () => {
    const r = await f.repo.createTimeOffRequest({
      requesterId: 'u',
      startDate: '2026-05-01',
      endDate: '2026-05-03',
      reason: 'vacation',
    });
    const next = await f.repo.updateTimeOffRequestStatus(r.id, 'approved');
    expect(next.status).toBe('approved');
  });

  it('createExpenseReport + status 변경', async () => {
    const r = await f.repo.createExpenseReport({
      requesterId: 'u',
      amount: 50_000,
      category: 'meal',
      description: 'lunch',
    });
    const next = await f.repo.updateExpenseReportStatus(r.id, 'approved');
    expect(next.status).toBe('approved');
  });

  it('findBudgetRequest non-existent → null', async () => {
    expect(await f.repo.findBudgetRequest('missing')).toBeNull();
  });

  it('listSteps 정렬 (stage_number asc)', async () => {
    const br = await f.repo.createBudgetRequest({
      projectId: 'p',
      amount: 20_000_000,
      requesterId: 'u',
    });
    const steps = await f.repo.listSteps(br.id);
    expect(steps.map((s) => s.stageNumber)).toEqual([1, 2, 3]);
  });
});
