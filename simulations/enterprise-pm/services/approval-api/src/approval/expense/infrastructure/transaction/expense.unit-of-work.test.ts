// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { ExpenseEntity } from '../../domain/index.js';
import { SqliteExpenseRepository } from '../persistence/expense.repository.js';
import { SIM_APPROVAL_EXPENSE_SQLITE_DDL } from '../persistence/sqlite.schema.js';
import { createExpenseSqliteTransactionPort } from './expense.drizzle-transaction.js';
import { createExpenseOutboxPort } from '../outbox/expense.outbox.js';
import { ExpenseUnitOfWork } from './expense.unit-of-work.js';

function bootstrap() {
  const sqlite = new Database(':memory:');
  sqlite.exec(SIM_APPROVAL_EXPENSE_SQLITE_DDL);
  const db = drizzle({ client: sqlite });
  const repo = new SqliteExpenseRepository(db);
  const transaction = createExpenseSqliteTransactionPort(db);
  const outbox = createExpenseOutboxPort({ dialect: 'sqlite', db });
  return { sqlite, repo, uow: new ExpenseUnitOfWork(transaction, repo, outbox) };
}

describe('ExpenseUnitOfWork', () => {
  it('commit: save + outbox 동일 트랜잭션', async () => {
    const { sqlite, repo, uow } = bootstrap();
    const e = ExpenseEntity.create({
      id: 'exp_uow_1',
      requesterId: 'u',
      amount: 1000,
      category: 'x',
      description: 'y',
    });
    await uow.withinTransaction('expense.create', async (ctx) => {
      await ctx.repository.save(e, ctx.scope);
      await ctx.outbox.append(
        {
          aggregateId: 'exp_uow_1',
          eventName: 'approval.expense.submitted',
          eventVersion: 1,
          payload: {},
          occurredAt: new Date(),
          idempotencyKey: `exp-uow-1:approval.expense.submitted:${Date.now()}`,
        },
        ctx.scope,
      );
    });
    expect(await repo.findById('exp_uow_1')).not.toBeNull();
    expect(sqlite.prepare('SELECT count(*) as c FROM approval_outbox_events').get()).toMatchObject({
      c: 1,
    });
    sqlite.close();
  });

  it('rollback: throw 시 미반영', async () => {
    const { sqlite, repo, uow } = bootstrap();
    await expect(
      uow.withinTransaction('expense.create', async (ctx) => {
        const e = ExpenseEntity.create({
          id: 'exp_uow_2',
          requesterId: 'u',
          amount: 100,
          category: 'c',
          description: 'd',
        });
        await ctx.repository.save(e, ctx.scope);
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await repo.findById('exp_uow_2')).toBeNull();
    sqlite.close();
  });
});
