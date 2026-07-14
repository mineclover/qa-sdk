// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { buildIdempotencyKey } from 'sim-identifier-grammar';
import { RoleAssignmentEntity } from '../../domain/index.js';
import { SqliteRoleAssignmentRepository } from '../persistence/role-assignment.repository.js';
import { SIM_AUTH_ROLE_ASSIGNMENT_SQLITE_DDL } from '../persistence/sqlite.schema.js';
import { SIM_AUTH_OUTBOX_SQLITE_DDL } from '../../../_outbox/auth-outbox.schema.js';
import { toGrammarSafeAggregateId } from '../../../_outbox/idempotency-key-source.js';
import { createRoleAssignmentSqliteTransactionPort } from './role-assignment.drizzle-transaction.js';
import { createRoleAssignmentOutboxPort } from '../outbox/role-assignment.outbox.js';
import { RoleAssignmentUnitOfWork } from './role-assignment.unit-of-work.js';

function bootstrap() {
  const sqlite = new Database(':memory:');
  sqlite.exec(SIM_AUTH_ROLE_ASSIGNMENT_SQLITE_DDL);
  sqlite.exec(SIM_AUTH_OUTBOX_SQLITE_DDL);
  const db = drizzle({ client: sqlite });
  const repo = new SqliteRoleAssignmentRepository(db);
  const transaction = createRoleAssignmentSqliteTransactionPort(db);
  const outbox = createRoleAssignmentOutboxPort({ dialect: 'sqlite', db });
  const uow = new RoleAssignmentUnitOfWork(transaction, repo, outbox);
  return { sqlite, db, repo, uow };
}

describe('RoleAssignmentUnitOfWork', () => {
  it('commit', async () => {
    const { sqlite, repo, uow } = bootstrap();
    const ra = RoleAssignmentEntity.create({
      userId: 'u1',
      roleId: 'r1',
      scopeType: 'global',
      scopeId: null,
    });
    const eventName = 'auth.role-assignment.assigned';
    const occurredAt = new Date();
    await uow.withinTransaction('role-assignment.assign', async (ctx) => {
      await ctx.repository.save(ra, ctx.scope);
      await ctx.outbox.append(
        {
          aggregateId: ra.id,
          eventName,
          eventVersion: 1,
          payload: {},
          occurredAt,
          idempotencyKey: buildIdempotencyKey({
            aggregateId: toGrammarSafeAggregateId(ra.id),
            eventName,
            occurredAt,
          }),
        },
        ctx.scope,
      );
    });
    expect(await repo.findOne('u1', 'r1', 'global', null)).not.toBeNull();
    sqlite.close();
  });

  it('rollback', async () => {
    const { sqlite, repo, uow } = bootstrap();
    await expect(
      uow.withinTransaction('role-assignment.assign', async (ctx) => {
        await ctx.repository.save(
          RoleAssignmentEntity.create({
            userId: 'u2',
            roleId: 'r2',
            scopeType: 'global',
            scopeId: null,
          }),
          ctx.scope,
        );
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await repo.findOne('u2', 'r2', 'global', null)).toBeNull();
    sqlite.close();
  });
});
