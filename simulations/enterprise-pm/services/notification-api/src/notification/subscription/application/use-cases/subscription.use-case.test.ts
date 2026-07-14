// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from 'vitest';
import { SubscriptionUseCase } from './subscription.use-case.js';
import { SubscriptionEntity } from '../../domain/index.js';
import type { SubscriptionRepositoryPort } from '../ports/subscription-repository.port.js';
import type {
  SubscriptionOutboxPort,
  SubscriptionOutboxRecord,
} from '../ports/subscription-outbox.port.js';
import type {
  SubscriptionTransactionPort,
  SubscriptionTransactionScope,
} from '../ports/subscription-transaction.port.js';
import type { SubscriptionLoggerPort } from '../ports/subscription-logger.port.js';
import type { SubscriptionUserQueryPort } from '../ports/user-query.port.js';

function makeMocks(opts?: { userExists?: boolean }) {
  const calls: string[] = [];
  const scope: SubscriptionTransactionScope = {
    id: 'tx-1',
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const transaction: SubscriptionTransactionPort = {
    async run<T>(_name, work: (s: SubscriptionTransactionScope) => Promise<T>) {
      calls.push('transaction.run.start');
      const r = await work(scope);
      calls.push('transaction.run.commit');
      return r;
    },
  };

  const store = new Map<string, SubscriptionEntity>();
  const key = (u: string, e: string) => `${u}:${e}`;
  const repository: SubscriptionRepositoryPort = {
    save: vi.fn(async (entity: SubscriptionEntity) => {
      calls.push('repository.save');
      store.set(key(entity.userId, entity.eventType), entity);
    }),
    findById: vi.fn(async (u, e) => store.get(key(u, e)) ?? null),
    listForUser: vi.fn(async () => []),
    listSubscribersByEventType: vi.fn(async () => []),
    deleteById: vi.fn(async (u, e) => {
      calls.push('repository.deleteById');
      store.delete(key(u, e));
    }),
  };

  const outboxRecords: SubscriptionOutboxRecord[] = [];
  const outbox: SubscriptionOutboxPort = {
    append: vi.fn(async (record: SubscriptionOutboxRecord) => {
      calls.push('outbox.append');
      outboxRecords.push(record);
    }),
  };

  const logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> = [];
  const logger: SubscriptionLoggerPort = {
    info: (ctx, msg) => {
      calls.push(`logger.info:${ctx.outcome ?? 'started'}`);
      logged.push({ level: 'info', ctx: ctx as never, msg });
    },
    warn: (ctx, msg) => {
      logged.push({ level: 'warn', ctx: ctx as never, msg });
    },
    error: (ctx, msg) => {
      calls.push(`logger.error:${(ctx as { outcome?: string }).outcome ?? '?'}`);
      logged.push({ level: 'error', ctx: ctx as never, msg });
    },
  };

  const userQuery: SubscriptionUserQueryPort = {
    userExists: vi.fn(async () => opts?.userExists ?? true),
  };

  return {
    transaction,
    repository,
    outbox,
    outboxRecords,
    logger,
    logged,
    calls,
    store,
    userQuery,
  };
}

describe('SubscriptionUseCase.create', () => {
  const command = {
    userId: 'u1',
    eventType: 'budget.*',
    channel: 'in_app' as const,
    traceId: 'trc',
    correlationId: 'cor',
  };

  it('user 존재 확인 후 transaction 안에서 repo.save + outbox.append', async () => {
    const m = makeMocks();
    const useCase = new SubscriptionUseCase(
      m.repository,
      m.outbox,
      m.transaction,
      m.logger,
      m.userQuery,
    );
    const result = await useCase.create(command);

    expect(result).toEqual({ userId: 'u1', eventType: 'budget.*', isActive: true });
    expect(m.userQuery.userExists).toHaveBeenCalledWith('u1');
    expect(m.calls).toEqual([
      'logger.info:started',
      'transaction.run.start',
      'repository.save',
      'outbox.append',
      'transaction.run.commit',
      'logger.info:success',
    ]);
    expect(m.outboxRecords[0]).toMatchObject({
      eventName: 'notification.subscription.created',
      eventVersion: 1,
    });
  });

  it('user 미존재 시 ConflictError', async () => {
    const m = makeMocks({ userExists: false });
    const useCase = new SubscriptionUseCase(
      m.repository,
      m.outbox,
      m.transaction,
      m.logger,
      m.userQuery,
    );
    await expect(useCase.create(command)).rejects.toMatchObject({
      name: 'ConflictError',
      code: 'SUBSCRIPTION_USER_UNKNOWN',
    });
    // transaction must NOT run if user check fails
    expect(m.calls).not.toContain('transaction.run.start');
  });
});

describe('SubscriptionUseCase.setActive', () => {
  it('기존 subscription 의 active 를 토글하고 outbox emit', async () => {
    const m = makeMocks();
    m.store.set(
      'u1:budget.*',
      SubscriptionEntity.create({ userId: 'u1', eventType: 'budget.*', channel: 'in_app' }),
    );
    const useCase = new SubscriptionUseCase(
      m.repository,
      m.outbox,
      m.transaction,
      m.logger,
      m.userQuery,
    );
    const result = await useCase.setActive({
      userId: 'u1',
      eventType: 'budget.*',
      isActive: false,
    });
    expect(result.isActive).toBe(false);
    expect(m.outboxRecords[0].eventName).toBe('notification.subscription.active-changed');
  });

  it('미존재 → NotFoundError', async () => {
    const m = makeMocks();
    const useCase = new SubscriptionUseCase(
      m.repository,
      m.outbox,
      m.transaction,
      m.logger,
      m.userQuery,
    );
    await expect(
      useCase.setActive({ userId: 'u', eventType: 'x', isActive: false }),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });
});

describe('SubscriptionUseCase.delete', () => {
  it('delete + outbox emit', async () => {
    const m = makeMocks();
    const useCase = new SubscriptionUseCase(
      m.repository,
      m.outbox,
      m.transaction,
      m.logger,
      m.userQuery,
    );
    const result = await useCase.delete({ userId: 'u', eventType: 'x' });
    expect(result).toEqual({ deleted: true });
    expect(m.outboxRecords[0].eventName).toBe('notification.subscription.deleted');
  });
});
