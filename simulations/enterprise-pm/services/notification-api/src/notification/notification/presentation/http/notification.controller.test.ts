// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotificationController } from './notification.controller.js';
import { NotificationUseCase } from '../../application/use-cases/notification.use-case.js';
import { NotificationReadModelQuery } from '../../application/queries/notification-read-model.query.js';
import {
  NotificationDomainException,
  NotificationNotFoundException,
} from '../../domain/notification.exceptions.js';
import { mapDomainErrorToHttp } from '@qa-sdk/sim-domain-slice-kit';

async function build({
  useCase,
  readModel,
}: {
  useCase: Partial<NotificationUseCase>;
  readModel: Partial<NotificationReadModelQuery>;
}) {
  const moduleRef = await Test.createTestingModule({
    controllers: [NotificationController],
    providers: [
      { provide: NotificationUseCase, useValue: useCase },
      { provide: NotificationReadModelQuery, useValue: readModel },
    ],
  }).compile();
  return moduleRef.get(NotificationController);
}

describe('NotificationController', () => {
  it('POST /notifications — id+status 응답', async () => {
    const useCase = {
      create: vi.fn(async () => ({ id: 'ntf_1', status: 'pending' as const })),
    };
    const controller = await build({ useCase, readModel: {} });
    const res = await controller.create({
      recipientUserId: 'u',
      type: 'x',
      title: 't',
      body: 'b',
      idempotencyKey: 'ntf_1',
    });
    expect(res).toEqual({ id: 'ntf_1', status: 'pending' });
    expect(useCase.create).toHaveBeenCalledWith({
      id: 'ntf_1',
      recipientUserId: 'u',
      type: 'x',
      title: 't',
      body: 'b',
    });
  });

  it('POST 입력 schema 검증 실패 시 zod error', async () => {
    const controller = await build({
      useCase: { create: vi.fn() },
      readModel: {},
    });
    await expect(controller.create({ recipientUserId: '' })).rejects.toThrow();
  });

  it('GET /notifications/:id — 200 (read model)', async () => {
    const detail = {
      id: 'ntf_1',
      recipientUserId: 'u',
      type: 'x',
      title: 't',
      body: 'b',
      status: 'pending',
      createdAt: '2026-01-01T00:00:00.000Z',
      sentAt: null,
      readAt: null,
    };
    const controller = await build({
      useCase: { create: vi.fn() },
      readModel: { findDetail: vi.fn(async () => detail), listForUser: vi.fn() },
    });
    expect(await controller.get('ntf_1')).toEqual(detail);
  });

  it('GET 미존재 시 NotFoundError 도메인 예외', async () => {
    const controller = await build({
      useCase: { create: vi.fn() },
      readModel: { findDetail: vi.fn(async () => null), listForUser: vi.fn() },
    });
    await expect(controller.get('missing')).rejects.toMatchObject({
      name: 'NotFoundError',
      code: 'NOTIFICATION_NOT_FOUND',
    });
  });

  it('GET /users/:userId/notifications — list', async () => {
    const items = [
      {
        id: 'ntf_a',
        type: 'x',
        title: 't',
        status: 'pending',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const controller = await build({
      useCase: { create: vi.fn() },
      readModel: { findDetail: vi.fn(), listForUser: vi.fn(async () => items) },
    });
    expect(await controller.listForUser('u')).toEqual(items);
  });

  it('PUT /notifications/:id/sent → use-case.markSent', async () => {
    const useCase = {
      markSent: vi.fn(async () => ({ id: 'ntf_1', status: 'sent' as const })),
    };
    const controller = await build({ useCase, readModel: {} });
    expect(await controller.markSent('ntf_1')).toEqual({ id: 'ntf_1', status: 'sent' });
  });

  it('도메인 예외가 mapDomainErrorToHttp 로 표준 페이로드 매핑된다', () => {
    const err = new NotificationNotFoundException('missing');
    const { status, payload } = mapDomainErrorToHttp(err, 'trc_x');
    expect(status).toBe(404);
    expect(payload).toMatchObject({
      code: 'NOTIFICATION_NOT_FOUND',
      traceId: 'trc_x',
    });
  });

  it('NotificationDomainException 베이스 인스턴스 + ValidationError 매핑', () => {
    const err = new NotificationDomainException('X', 'boom');
    err.name = 'ValidationError';
    const { status } = mapDomainErrorToHttp(err, 't');
    expect(status).toBe(400);
  });
});
