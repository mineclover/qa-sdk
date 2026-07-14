// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { buildIdempotencyKey } from 'sim-identifier-grammar';
import { AssignmentEntity } from '../../domain/index.js';
import { toGrammarSafeAggregateId } from '../../../shared/outbox/idempotency-key-source.js';
import { SqliteAssignmentRepository } from '../persistence/assignment.repository.js';
import { SIM_PM_ASSIGNMENT_SQLITE_DDL } from '../persistence/sqlite.schema.js';
import { SIM_PM_SQLITE_DDL } from '../../../sqlite/schema.js';
import { createAssignmentSqliteTransactionPort } from './assignment.drizzle-transaction.js';
import { createAssignmentOutboxPort } from '../outbox/assignment.outbox.js';
import { AssignmentUnitOfWork } from './assignment.unit-of-work.js';

function bootstrap() {
  const sqlite = new Database(':memory:');
  // pm-api domain 공유 outbox (`pm_outbox_events`) + 슬라이스 본 테이블(`pm_assignments`).
  sqlite.exec(SIM_PM_SQLITE_DDL);
  sqlite.exec(SIM_PM_ASSIGNMENT_SQLITE_DDL);
  const db = drizzle({ client: sqlite });
  const repo = new SqliteAssignmentRepository(db);
  const transaction = createAssignmentSqliteTransactionPort(db);
  const outbox = createAssignmentOutboxPort({ dialect: 'sqlite', db });
  const uow = new AssignmentUnitOfWork(transaction, repo, outbox);
  return { sqlite, db, repo, uow };
}

describe('AssignmentUnitOfWork', () => {
  it('commit: repo.save + outbox.append 가 동일 트랜잭션에서 영속된다', async () => {
    const { sqlite, db, repo, uow } = bootstrap();
    const entity = AssignmentEntity.create({
      id: 'asg_uow_1',
      projectId: 'prj_1',
      managerId: 'mgr_1',
      now: new Date('2026-03-01T00:00:00.000Z'),
    }).assign();

    await uow.withinTransaction('assignment.create', async (ctx) => {
      await ctx.repository.save(entity, ctx.scope);
      const occurredAt = new Date('2026-03-01T00:00:01.000Z');
      const eventName = 'pm.assignment.created';
      await ctx.outbox.append(
        {
          aggregateId: 'asg_uow_1',
          eventName,
          eventVersion: 1,
          payload: { id: 'asg_uow_1' },
          occurredAt,
          idempotencyKey: buildIdempotencyKey({
            aggregateId: toGrammarSafeAggregateId('asg_uow_1'),
            eventName,
            occurredAt,
          }),
        },
        ctx.scope,
      );
    });

    const found = await repo.findById('asg_uow_1');
    expect(found).not.toBeNull();
    const outboxRows = sqlite.prepare('SELECT * FROM pm_outbox_events').all() as Array<{
      aggregate_id: string;
      event_name: string;
      event_version: number;
      status: string;
      scope_id: string;
    }>;
    expect(outboxRows).toHaveLength(1);
    expect(outboxRows[0].aggregate_id).toBe('asg_uow_1');
    expect(outboxRows[0].event_name).toBe('pm.assignment.created');
    expect(outboxRows[0].event_version).toBe(1);
    expect(outboxRows[0].status).toBe('pending');
    expect(outboxRows[0].scope_id).toMatch(/^assignment\.create:/);

    sqlite.close();
  });

  it('rollback: 핸들러 throw 시 repo + outbox 모두 미반영', async () => {
    const { sqlite, repo, uow } = bootstrap();

    await expect(
      uow.withinTransaction('assignment.create', async (ctx) => {
        const e = AssignmentEntity.create({
          id: 'asg_uow_2',
          projectId: 'p',
          managerId: 'm',
          now: new Date(),
        });
        await ctx.repository.save(e, ctx.scope);
        const occurredAt = new Date();
        const eventName = 'pm.assignment.created';
        await ctx.outbox.append(
          {
            aggregateId: 'asg_uow_2',
            eventName,
            eventVersion: 1,
            payload: { id: 'asg_uow_2' },
            occurredAt,
            idempotencyKey: buildIdempotencyKey({
              aggregateId: toGrammarSafeAggregateId('asg_uow_2'),
              eventName,
              occurredAt,
            }),
          },
          ctx.scope,
        );
        throw new Error('simulated failure');
      }),
    ).rejects.toThrow('simulated failure');

    expect(await repo.findById('asg_uow_2')).toBeNull();
    const outboxRows = sqlite.prepare('SELECT * FROM pm_outbox_events').all();
    expect(outboxRows).toHaveLength(0);
    sqlite.close();
  });

  it('transaction.run 의 name 이 outbox scope_id prefix 로 전파된다', async () => {
    const { sqlite, uow } = bootstrap();
    const e = AssignmentEntity.create({
      id: 'asg_uow_3',
      projectId: 'p',
      managerId: 'm',
      now: new Date(),
    });
    await uow.withinTransaction('custom.label', async (ctx) => {
      await ctx.repository.save(e, ctx.scope);
      const occurredAt = new Date();
      const eventName = 'pm.assignment.created';
      await ctx.outbox.append(
        {
          aggregateId: 'asg_uow_3',
          eventName,
          eventVersion: 1,
          payload: {},
          occurredAt,
          idempotencyKey: buildIdempotencyKey({
            aggregateId: toGrammarSafeAggregateId('asg_uow_3'),
            eventName,
            occurredAt,
          }),
        },
        ctx.scope,
      );
    });
    const row = sqlite.prepare('SELECT scope_id FROM pm_outbox_events').get() as {
      scope_id: string;
    };
    expect(row.scope_id.startsWith('custom.label:')).toBe(true);
    sqlite.close();
  });
});
