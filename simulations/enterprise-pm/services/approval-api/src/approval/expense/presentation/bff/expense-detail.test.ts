// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from 'vitest';
import { ExpenseDetailBff } from './expense-detail.bff.js';
import type { ExpenseReadModelQuery } from '../../application/queries/expense-read-model.query.js';
import type { ExpenseLoggerPort } from '../../application/ports/expense-logger.port.js';

function makeLogger() {
  const logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> = [];
  const logger: ExpenseLoggerPort = {
    info: (ctx, msg) => logged.push({ level: 'info', ctx: ctx as never, msg }),
    warn: (ctx, msg) => logged.push({ level: 'warn', ctx: ctx as never, msg }),
    error: (ctx, msg) => logged.push({ level: 'error', ctx: ctx as never, msg }),
  };
  return { logger, logged };
}

describe('ExpenseDetailBff', () => {
  it('read model 합성 + cacheKey', async () => {
    const readModel: ExpenseReadModelQuery = {
      findDetail: vi.fn(async () => ({
        id: 'exp_1',
        requesterId: 'u',
        amount: 25_000,
        category: 'travel',
        description: 'x',
        status: 'submitted',
        updatedAt: '2026-04-01T00:00:00.000Z',
      })),
    } as never;
    const { logger } = makeLogger();
    const bff = new ExpenseDetailBff(readModel, logger);
    const r = await bff.getDetail({ id: 'exp_1', traceId: 't', correlationId: 'c' });
    expect(r).toMatchObject({
      id: 'exp_1',
      statusLabel: 'SUBMITTED',
      categoryLabel: 'travel',
      cacheKey: 'expense-bff-detail:v1:exp_1',
    });
  });

  it('null → null + miss', async () => {
    const readModel = { findDetail: vi.fn(async () => null) } as never;
    const { logger, logged } = makeLogger();
    const bff = new ExpenseDetailBff(readModel, logger);
    expect(await bff.getDetail({ id: 'x', traceId: 't', correlationId: 'c' })).toBeNull();
    expect(logged.some((l) => l.msg === 'expense-detail.bff.miss')).toBe(true);
  });
});
