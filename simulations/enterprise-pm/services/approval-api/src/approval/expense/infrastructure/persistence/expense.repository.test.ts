// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { ExpenseEntity } from '../../domain/index.js';
import { SqliteExpenseRepository, createExpenseRepository } from './expense.repository.js';
import { SIM_APPROVAL_EXPENSE_SQLITE_DDL } from './sqlite.schema.js';
import type { ExpenseTransactionScope } from '../../application/ports/expense-transaction.port.js';

function scope(): ExpenseTransactionScope {
  return { id: 'tx', startedAt: new Date() };
}

describe('SqliteExpenseRepository', () => {
  it('save + findById 라운드트립', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SIM_APPROVAL_EXPENSE_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteExpenseRepository(db);
    const e = ExpenseEntity.create({
      id: 'exp_1',
      requesterId: 'u',
      amount: 1000,
      category: 'travel',
      description: 'x',
      now: new Date('2026-01-01T00:00:00.000Z'),
    });
    await repo.save(e, scope());
    const found = await repo.findById('exp_1');
    expect(found!.toSnapshot()).toEqual(e.toSnapshot());
    sqlite.close();
  });
});

describe('createExpenseRepository', () => {
  it('sqlite → SqliteExpenseRepository', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SIM_APPROVAL_EXPENSE_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const r = createExpenseRepository({ dialect: 'sqlite', db });
    expect(r).toBeInstanceOf(SqliteExpenseRepository);
    sqlite.close();
  });
  it('unknown dialect → throw', () => {
    expect(() => createExpenseRepository({ dialect: 'mysql' as never, db: {} as never })).toThrow();
  });
});
