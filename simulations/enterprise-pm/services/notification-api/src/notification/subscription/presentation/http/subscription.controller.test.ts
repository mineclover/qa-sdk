// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { SubscriptionController } from './subscription.controller.js';
import { SubscriptionUseCase } from '../../application/use-cases/subscription.use-case.js';
import { SubscriptionReadModelQuery } from '../../application/queries/subscription-read-model.query.js';
import {
  SubscriptionDomainException,
  SubscriptionNotFoundException,
} from '../../domain/subscription.exceptions.js';
import { mapDomainErrorToHttp } from '@qa-sdk/sim-domain-slice-kit';

async function build({
  useCase,
  readModel,
}: {
  useCase: Partial<SubscriptionUseCase>;
  readModel: Partial<SubscriptionReadModelQuery>;
}) {
  const moduleRef = await Test.createTestingModule({
    controllers: [SubscriptionController],
    providers: [
      { provide: SubscriptionUseCase, useValue: useCase },
      { provide: SubscriptionReadModelQuery, useValue: readModel },
    ],
  }).compile();
  return moduleRef.get(SubscriptionController);
}

describe('SubscriptionController', () => {
  it('POST /subscriptions — create', async () => {
    const useCase = {
      create: vi.fn(async () => ({ userId: 'u1', eventType: 'x', isActive: true })),
    };
    const controller = await build({ useCase, readModel: {} });
    const r = await controller.create({ userId: 'u1', eventType: 'x', channel: 'in_app' });
    expect(r).toEqual({ userId: 'u1', eventType: 'x', isActive: true });
  });

  it('POST 입력 검증 실패 zod', async () => {
    const controller = await build({ useCase: { create: vi.fn() }, readModel: {} });
    await expect(controller.create({ userId: '' })).rejects.toThrow();
  });

  it('GET /users/:id/subscriptions — list', async () => {
    const items = [
      {
        userId: 'u',
        eventType: 'x',
        channel: 'in_app',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const controller = await build({
      useCase: { create: vi.fn() },
      readModel: { listForUser: vi.fn(async () => items) },
    });
    expect(await controller.listForUser('u')).toEqual(items);
  });

  it('PUT /subscriptions/:userId/:eventType/active — setActive', async () => {
    const useCase = {
      setActive: vi.fn(async () => ({ userId: 'u', eventType: 'x', isActive: false })),
    };
    const controller = await build({ useCase, readModel: {} });
    const r = await controller.setActive('u', 'x', { isActive: false });
    expect(r).toEqual({ userId: 'u', eventType: 'x', isActive: false });
  });

  it('DELETE /subscriptions/:userId/:eventType — delete', async () => {
    const useCase = { delete: vi.fn(async () => ({ deleted: true })) };
    const controller = await build({ useCase, readModel: {} });
    expect(await controller.remove('u', 'x')).toEqual({ status: 'deleted' });
  });

  it('도메인 예외 매핑 (NotFoundError → 404, ConflictError → 409, ValidationError → 400)', () => {
    expect(mapDomainErrorToHttp(new SubscriptionNotFoundException('u', 'x'), 't').status).toBe(404);
    const conflict = new SubscriptionDomainException('X', 'y');
    conflict.name = 'ConflictError';
    expect(mapDomainErrorToHttp(conflict, 't').status).toBe(409);
    const validation = new SubscriptionDomainException('X', 'y');
    validation.name = 'ValidationError';
    expect(mapDomainErrorToHttp(validation, 't').status).toBe(400);
  });
});
