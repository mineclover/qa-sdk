// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { BudgetEntity } from '../../domain/index.js';
import { SqliteBudgetRepository, createBudgetRepository } from './budget.repository.js';
import { SIM_APPROVAL_BUDGET_SQLITE_DDL } from './sqlite.schema.js';
import type { BudgetTransactionScope } from '../../application/ports/budget-transaction.port.js';

function makeScope(): BudgetTransactionScope {
  return { id: 'tx-test', startedAt: new Date() };
}

describe('SqliteBudgetRepository', () => {
  it('save 후 findById 라운드트립', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SIM_APPROVAL_BUDGET_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteBudgetRepository(db);
    const entity = BudgetEntity.create({
      id: 'br_1',
      projectId: 'prj_1',
      projectDepartmentId: 'dept_eng',
      amount: 500_000,
      requesterId: 'u_1',
      now: new Date('2026-01-01T00:00:00.000Z'),
    });
    await repo.save(entity, makeScope());
    const found = await repo.findById('br_1');
    expect(found).not.toBeNull();
    expect(found!.toSnapshot()).toEqual(entity.toSnapshot());
    sqlite.close();
  });

  it('findById 미존재 → null', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SIM_APPROVAL_BUDGET_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteBudgetRepository(db);
    expect(await repo.findById('missing')).toBeNull();
    sqlite.close();
  });

  it('upsert: 동일 id save 시 update', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SIM_APPROVAL_BUDGET_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteBudgetRepository(db);
    const e1 = BudgetEntity.create({
      id: 'br_2',
      projectId: 'p',
      projectDepartmentId: 'd',
      amount: 500_000,
      requesterId: 'u',
      now: new Date('2026-01-01T00:00:00.000Z'),
    });
    await repo.save(e1, makeScope());
    const e2 = e1.submit(new Date('2026-01-02T00:00:00.000Z'));
    await repo.save(e2, makeScope());
    const found = await repo.findById('br_2');
    expect(found!.status).toBe('submitted');
    sqlite.close();
  });
});

describe('createBudgetRepository factory', () => {
  it('sqlite dialect → SqliteBudgetRepository', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SIM_APPROVAL_BUDGET_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const r = createBudgetRepository({ dialect: 'sqlite', db });
    expect(r).toBeInstanceOf(SqliteBudgetRepository);
    sqlite.close();
  });
  it('알 수 없는 dialect → throw', () => {
    expect(() => createBudgetRepository({ dialect: 'mysql' as never, db: {} as never })).toThrow();
  });
});
