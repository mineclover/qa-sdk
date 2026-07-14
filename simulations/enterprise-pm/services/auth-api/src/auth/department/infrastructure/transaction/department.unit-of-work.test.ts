// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { buildIdempotencyKey } from 'sim-identifier-grammar';
import { DepartmentEntity } from '../../domain/index.js';
import { SqliteDepartmentRepository } from '../persistence/department.repository.js';
import { SIM_AUTH_DEPARTMENT_SQLITE_DDL } from '../persistence/sqlite.schema.js';
import { SIM_AUTH_OUTBOX_SQLITE_DDL } from '../../../_outbox/auth-outbox.schema.js';
import { toGrammarSafeAggregateId } from '../../../_outbox/idempotency-key-source.js';
import { createDepartmentSqliteTransactionPort } from './department.drizzle-transaction.js';
import { createDepartmentOutboxPort } from '../outbox/department.outbox.js';
import { DepartmentUnitOfWork } from './department.unit-of-work.js';

function bootstrap() {
  const sqlite = new Database(':memory:');
  sqlite.exec(SIM_AUTH_DEPARTMENT_SQLITE_DDL);
  sqlite.exec(SIM_AUTH_OUTBOX_SQLITE_DDL);
  const db = drizzle({ client: sqlite });
  const repo = new SqliteDepartmentRepository(db);
  const transaction = createDepartmentSqliteTransactionPort(db);
  const outbox = createDepartmentOutboxPort({ dialect: 'sqlite', db });
  const uow = new DepartmentUnitOfWork(transaction, repo, outbox);
  return { sqlite, db, repo, uow };
}

describe('DepartmentUnitOfWork', () => {
  it('commit', async () => {
    const { sqlite, repo, uow } = bootstrap();
    const eventName = 'auth.department.created';
    const occurredAt = new Date();
    await uow.withinTransaction('department.create', async (ctx) => {
      await ctx.repository.save(DepartmentEntity.create({ id: 'd1', name: 'X' }), ctx.scope);
      await ctx.outbox.append(
        {
          aggregateId: 'd1',
          eventName,
          eventVersion: 1,
          payload: { id: 'd1' },
          occurredAt,
          idempotencyKey: buildIdempotencyKey({
            aggregateId: toGrammarSafeAggregateId('d1'),
            eventName,
            occurredAt,
          }),
        },
        ctx.scope,
      );
    });
    expect(await repo.findById('d1')).not.toBeNull();
    sqlite.close();
  });

  it('rollback', async () => {
    const { sqlite, repo, uow } = bootstrap();
    await expect(
      uow.withinTransaction('department.create', async (ctx) => {
        await ctx.repository.save(DepartmentEntity.create({ id: 'd2', name: 'X' }), ctx.scope);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await repo.findById('d2')).toBeNull();
    sqlite.close();
  });
});
