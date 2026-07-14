// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { buildIdempotencyKey } from 'sim-identifier-grammar';
import { NotificationEntity } from '../../domain/index.js';
import { toGrammarSafeAggregateId } from '../../../shared/outbox/idempotency-key-source.js';
import { SqliteNotificationRepository } from '../persistence/notification.repository.js';
import {
  SIM_NOTIF_NOTIFICATION_SQLITE_DDL,
  SIM_NOTIF_OUTBOX_SQLITE_DDL,
} from '../persistence/sqlite.schema.js';
import { createNotificationSqliteTransactionPort } from './notification.drizzle-transaction.js';
import { createNotificationOutboxPort } from '../outbox/notification.outbox.js';
import { NotificationUnitOfWork } from './notification.unit-of-work.js';

function bootstrap() {
  const sqlite = new Database(':memory:');
  sqlite.exec(SIM_NOTIF_NOTIFICATION_SQLITE_DDL);
  sqlite.exec(SIM_NOTIF_OUTBOX_SQLITE_DDL);
  const db = drizzle({ client: sqlite });
  const repo = new SqliteNotificationRepository(db);
  const transaction = createNotificationSqliteTransactionPort(db);
  const outbox = createNotificationOutboxPort({ dialect: 'sqlite', db });
  const uow = new NotificationUnitOfWork(transaction, repo, outbox);
  return { sqlite, db, repo, uow };
}

describe('NotificationUnitOfWork', () => {
  it('commit: repo.save + outbox.append 가 동일 트랜잭션에서 영속된다', async () => {
    const { sqlite, repo, uow } = bootstrap();
    const entity = NotificationEntity.create({
      id: 'ntf_uow_1',
      recipientUserId: 'u',
      type: 'x',
      title: 't',
      body: 'b',
      now: new Date('2026-03-01T00:00:00.000Z'),
    }).markSent(new Date('2026-03-01T00:01:00.000Z'));

    await uow.withinTransaction('notification.markSent', async (ctx) => {
      await ctx.repository.save(entity, ctx.scope);
      const occurredAt = new Date('2026-03-01T00:00:01.000Z');
      const eventName = 'notification.notification.sent';
      await ctx.outbox.append(
        {
          aggregateId: 'ntf_uow_1',
          eventName,
          eventVersion: 1,
          payload: { id: 'ntf_uow_1' },
          occurredAt,
          idempotencyKey: buildIdempotencyKey({
            aggregateId: toGrammarSafeAggregateId('ntf_uow_1'),
            eventName,
            occurredAt,
          }),
        },
        ctx.scope,
      );
    });

    const found = await repo.findById('ntf_uow_1');
    expect(found).not.toBeNull();
    const outboxRows = sqlite.prepare('SELECT * FROM notification_outbox_events').all() as Array<{
      aggregate_id: string;
      event_name: string;
      event_version: number;
      status: string;
      scope_id: string;
    }>;
    expect(outboxRows).toHaveLength(1);
    expect(outboxRows[0].aggregate_id).toBe('ntf_uow_1');
    expect(outboxRows[0].event_name).toBe('notification.notification.sent');
    expect(outboxRows[0].event_version).toBe(1);
    expect(outboxRows[0].status).toBe('pending');
    expect(outboxRows[0].scope_id).toMatch(/^notification\.markSent:/);

    sqlite.close();
  });

  it('rollback: 핸들러 throw 시 repo + outbox 모두 미반영', async () => {
    const { sqlite, repo, uow } = bootstrap();

    await expect(
      uow.withinTransaction('notification.create', async (ctx) => {
        const e = NotificationEntity.create({
          id: 'ntf_uow_2',
          recipientUserId: 'u',
          type: 'x',
          title: 't',
          body: 'b',
          now: new Date(),
        });
        await ctx.repository.save(e, ctx.scope);
        const occurredAt = new Date();
        const eventName = 'notification.notification.sent';
        await ctx.outbox.append(
          {
            aggregateId: 'ntf_uow_2',
            eventName,
            eventVersion: 1,
            payload: {},
            occurredAt,
            idempotencyKey: buildIdempotencyKey({
              aggregateId: toGrammarSafeAggregateId('ntf_uow_2'),
              eventName,
              occurredAt,
            }),
          },
          ctx.scope,
        );
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await repo.findById('ntf_uow_2')).toBeNull();
    const rows = sqlite.prepare('SELECT * FROM notification_outbox_events').all();
    expect(rows).toHaveLength(0);
    sqlite.close();
  });
});
