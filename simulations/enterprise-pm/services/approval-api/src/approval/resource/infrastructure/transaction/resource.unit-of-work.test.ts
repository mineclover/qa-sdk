// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { ResourceEntity } from '../../domain/index.js';
import { SqliteResourceRepository } from '../persistence/resource.repository.js';
import { SIM_APPROVAL_RESOURCE_SQLITE_DDL } from '../persistence/sqlite.schema.js';
import { createResourceSqliteTransactionPort } from './resource.drizzle-transaction.js';
import { createResourceOutboxPort } from '../outbox/resource.outbox.js';
import { ResourceUnitOfWork } from './resource.unit-of-work.js';

function bootstrap() {
  const sqlite = new Database(':memory:');
  sqlite.exec(SIM_APPROVAL_RESOURCE_SQLITE_DDL);
  const db = drizzle({ client: sqlite });
  const repo = new SqliteResourceRepository(db);
  const transaction = createResourceSqliteTransactionPort(db);
  const outbox = createResourceOutboxPort({ dialect: 'sqlite', db });
  return { sqlite, repo, uow: new ResourceUnitOfWork(transaction, repo, outbox) };
}

describe('ResourceUnitOfWork', () => {
  it('commit: save + outbox 동일 트랜잭션', async () => {
    const { sqlite, repo, uow } = bootstrap();
    const e = ResourceEntity.create({
      id: 'rsr_uow_1',
      projectId: 'p',
      requesterId: 'u',
      resourceType: 'consultant',
      description: 'x',
    });
    await uow.withinTransaction('resource.create', async (ctx) => {
      await ctx.repository.save(e, ctx.scope);
      await ctx.outbox.append(
        {
          aggregateId: 'rsr_uow_1',
          eventName: 'approval.resource.submitted',
          eventVersion: 1,
          payload: {},
          occurredAt: new Date(),
          idempotencyKey: `rsr-uow-1:approval.resource.submitted:${Date.now()}`,
        },
        ctx.scope,
      );
    });
    expect(await repo.findById('rsr_uow_1')).not.toBeNull();
    sqlite.close();
  });

  it('rollback: throw 시 미반영', async () => {
    const { sqlite, repo, uow } = bootstrap();
    await expect(
      uow.withinTransaction('resource.create', async (ctx) => {
        const e = ResourceEntity.create({
          id: 'rsr_uow_2',
          projectId: 'p',
          requesterId: 'u',
          resourceType: 'x',
          description: 'y',
        });
        await ctx.repository.save(e, ctx.scope);
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');
    expect(await repo.findById('rsr_uow_2')).toBeNull();
    sqlite.close();
  });
});
