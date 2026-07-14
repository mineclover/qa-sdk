// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { buildIdempotencyKey } from 'sim-identifier-grammar';
import { MemberEntity } from '../../domain/index.js';
import { toGrammarSafeAggregateId } from '../../../shared/outbox/idempotency-key-source.js';
import { SqliteMemberRepository } from '../persistence/member.repository.js';
import { SIM_PM_SQLITE_DDL } from '../../../sqlite/schema.js';
import { createMemberSqliteTransactionPort } from './member.drizzle-transaction.js';
import { createMemberOutboxPort } from '../outbox/member.outbox.js';
import { MemberUnitOfWork } from './member.unit-of-work.js';

function bootstrap() {
  const sqlite = new Database(':memory:');
  // SIM_PM_SQLITE_DDL: project_members 본 테이블 + pm-api domain 공유 outbox.
  sqlite.exec(SIM_PM_SQLITE_DDL);
  const db = drizzle({ client: sqlite });
  const repo = new SqliteMemberRepository(db);
  const transaction = createMemberSqliteTransactionPort(db);
  const outbox = createMemberOutboxPort({ dialect: 'sqlite', db });
  const uow = new MemberUnitOfWork(transaction, repo, outbox);
  return { sqlite, db, repo, uow };
}

describe('MemberUnitOfWork', () => {
  it('commit: repo.save + outbox.append 동일 트랜잭션', async () => {
    const { sqlite, repo, uow } = bootstrap();
    const e = MemberEntity.create({
      projectId: 'prj_1',
      userId: 'u_1',
      role: 'lead',
    });
    await uow.withinTransaction('member.add', async (ctx) => {
      await ctx.repository.save(e, ctx.scope);
      const occurredAt = new Date();
      const eventName = 'pm.member.added';
      await ctx.outbox.append(
        {
          aggregateId: 'prj_1:u_1',
          eventName,
          eventVersion: 1,
          payload: {},
          occurredAt,
          idempotencyKey: buildIdempotencyKey({
            aggregateId: toGrammarSafeAggregateId('prj_1:u_1'),
            eventName,
            occurredAt,
          }),
        },
        ctx.scope,
      );
    });
    expect(await repo.findById('prj_1', 'u_1')).not.toBeNull();
    const rows = sqlite.prepare('SELECT * FROM pm_outbox_events').all();
    expect(rows).toHaveLength(1);
    sqlite.close();
  });

  it('rollback: throw 시 미반영', async () => {
    const { sqlite, repo, uow } = bootstrap();
    await expect(
      uow.withinTransaction('member.add', async (ctx) => {
        await ctx.repository.save(
          MemberEntity.create({ projectId: 'p', userId: 'u', role: 'lead' }),
          ctx.scope,
        );
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await repo.findById('p', 'u')).toBeNull();
    sqlite.close();
  });
});
