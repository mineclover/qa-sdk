// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from 'vitest';
import { NotificationDetailBff } from './notification-detail.bff.js';
import type { NotificationReadModelQuery } from '../../application/queries/notification-read-model.query.js';
import type { NotificationLoggerPort } from '../../application/ports/notification-logger.port.js';

function makeLogger() {
  const logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> = [];
  const logger: NotificationLoggerPort = {
    info: (ctx, msg) => {
      logged.push({ level: 'info', ctx: ctx as never, msg });
    },
    warn: (ctx, msg) => {
      logged.push({ level: 'warn', ctx: ctx as never, msg });
    },
    error: (ctx, msg) => {
      logged.push({ level: 'error', ctx: ctx as never, msg });
    },
  };
  return { logger, logged };
}

describe('NotificationDetailBff', () => {
  it('read model detail 을 BFF DTO 로 합성한다 (cacheKey 포함)', async () => {
    const readModel: NotificationReadModelQuery = {
      findDetail: vi.fn(async () => ({
        id: 'ntf_1',
        recipientUserId: 'u',
        type: 'budget.approved',
        title: 'Budget approved',
        body: 'body',
        status: 'sent',
        createdAt: '2026-04-01T00:00:00.000Z',
        sentAt: '2026-04-01T00:00:01.000Z',
        readAt: null,
      })),
      listForUser: vi.fn(),
    };
    const { logger, logged } = makeLogger();
    const bff = new NotificationDetailBff(readModel, logger);

    const result = await bff.getDetail({
      id: 'ntf_1',
      traceId: 'trc_a',
      correlationId: 'cor_a',
    });

    expect(result).toEqual({
      id: 'ntf_1',
      title: 'Budget approved',
      statusLabel: 'SENT',
      recipientLabel: 'User u',
      createdAt: '2026-04-01T00:00:00.000Z',
      sentAt: '2026-04-01T00:00:01.000Z',
      readAt: null,
      cacheKey: 'notification-bff-detail:v1:ntf_1',
    });

    const log = logged.find((l) => l.msg === 'notification-detail.bff.success')!;
    expect(log.ctx).toMatchObject({
      domain: 'notification',
      useCase: 'NotificationDetailBff.getDetail',
      cacheKeyPrefix: 'notification-bff-detail:v1',
      outcome: 'success',
    });
  });

  it('read model 이 null 이면 null 반환 + outcome=failure 로깅', async () => {
    const readModel: NotificationReadModelQuery = {
      findDetail: vi.fn(async () => null),
      listForUser: vi.fn(),
    };
    const { logger, logged } = makeLogger();
    const bff = new NotificationDetailBff(readModel, logger);
    expect(await bff.getDetail({ id: 'missing', traceId: 't', correlationId: 'c' })).toBeNull();
    expect(logged.find((l) => l.msg === 'notification-detail.bff.miss')!.ctx.outcome).toBe(
      'failure',
    );
  });

  it('cachePrefix 가 OM seed 와 일치한다', () => {
    const { logger } = makeLogger();
    const bff = new NotificationDetailBff(
      { findDetail: vi.fn(), listForUser: vi.fn() } as never,
      logger,
    );
    expect(bff.cachePrefix).toBe('notification-bff-detail:v1');
  });
});
