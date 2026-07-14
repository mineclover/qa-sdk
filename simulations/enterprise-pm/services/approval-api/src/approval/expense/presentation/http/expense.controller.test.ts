// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ExpenseController } from './expense.controller.js';
import { ExpenseUseCase } from '../../application/use-cases/expense.use-case.js';
import { ExpenseReadModelQuery } from '../../application/queries/expense-read-model.query.js';
import { mapDomainErrorToHttp } from '@qa-sdk/sim-domain-slice-kit';
import { ExpenseDomainException } from '../../domain/index.js';

async function build(args: {
  useCase?: Partial<ExpenseUseCase>;
  readModel?: Partial<ExpenseReadModelQuery>;
}) {
  const m = await Test.createTestingModule({
    controllers: [ExpenseController],
    providers: [
      { provide: ExpenseUseCase, useValue: args.useCase ?? {} },
      { provide: ExpenseReadModelQuery, useValue: args.readModel ?? {} },
    ],
  }).compile();
  return m.get(ExpenseController);
}

describe('ExpenseController', () => {
  it('POST / — create + read-model', async () => {
    const useCase = {
      create: vi.fn(async (cmd: { id: string }) => ({ id: cmd.id, status: 'draft' })),
    };
    const detail = {
      id: 'exp_1',
      requesterId: 'u',
      amount: 1000,
      category: 'x',
      description: 'y',
      status: 'draft',
      updatedAt: 'x',
    };
    const readModel = { findDetail: vi.fn(async () => detail) };
    const c = await build({ useCase, readModel });
    const r = await c.create({ requesterId: 'u', amount: 1000, category: 'x', description: 'y' });
    expect(r).toEqual(detail);
  });

  it('GET 미존재 → ExpenseNotFoundException', async () => {
    const readModel = { findDetail: vi.fn(async () => null) };
    const c = await build({ readModel });
    await expect(c.get('missing')).rejects.toMatchObject({
      name: 'NotFoundError',
      code: 'EXPENSE_NOT_FOUND',
    });
  });

  it('PUT /:id/status — update + read-model', async () => {
    const useCase = { updateStatus: vi.fn(async () => ({ id: 'exp_1', status: 'submitted' })) };
    const detail = {
      id: 'exp_1',
      requesterId: 'u',
      amount: 0,
      category: '',
      description: '',
      status: 'submitted',
      updatedAt: 'x',
    };
    const readModel = { findDetail: vi.fn(async () => detail) };
    const c = await build({ useCase, readModel });
    expect(await c.updateStatus('exp_1', { status: 'submitted' })).toEqual(detail);
  });

  it('도메인 예외 매핑', () => {
    const err = new ExpenseDomainException('EXPENSE_NOT_FOUND', 'missing');
    err.name = 'NotFoundError';
    const { status, payload } = mapDomainErrorToHttp(err, 'trc');
    expect(status).toBe(404);
    expect(payload).toEqual({ code: 'EXPENSE_NOT_FOUND', message: 'missing', traceId: 'trc' });
  });
});
