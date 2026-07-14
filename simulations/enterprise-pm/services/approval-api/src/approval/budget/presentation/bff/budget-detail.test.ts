// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from 'vitest';
import { BudgetDetailBff } from './budget-detail.bff.js';
import type { BudgetReadModelQuery } from '../../application/queries/budget-read-model.query.js';
import type { BudgetLoggerPort } from '../../application/ports/budget-logger.port.js';

function makeLogger() {
  const logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> = [];
  const logger: BudgetLoggerPort = {
    info: (ctx, msg) => logged.push({ level: 'info', ctx: ctx as never, msg }),
    warn: (ctx, msg) => logged.push({ level: 'warn', ctx: ctx as never, msg }),
    error: (ctx, msg) => logged.push({ level: 'error', ctx: ctx as never, msg }),
  };
  return { logger, logged };
}

describe('BudgetDetailBff', () => {
  it('read model + steps 합성 (cacheKey 포함)', async () => {
    const readModel: BudgetReadModelQuery = {
      findDetail: vi.fn(async () => ({
        id: 'br_1',
        projectId: 'p',
        projectDepartmentId: 'd',
        amount: 1_500_000,
        requesterId: 'u',
        status: 'in_review',
        currentStage: 1,
        totalStages: 2,
        updatedAt: '2026-04-01T00:00:00.000Z',
      })),
      listByProject: vi.fn(),
      listByRequester: vi.fn(),
      listSteps: vi.fn(async () => [
        {
          requestId: 'br_1',
          stageNumber: 1,
          approverId: null,
          decision: 'pending',
          comment: null,
          decidedAt: null,
        },
      ]),
    } as never;
    const { logger, logged } = makeLogger();
    const bff = new BudgetDetailBff(readModel, logger);
    const r = await bff.getDetail({
      id: 'br_1',
      traceId: 'trc',
      correlationId: 'cor',
    });
    expect(r).toMatchObject({
      id: 'br_1',
      stageLabel: '1/2',
      statusLabel: 'IN_REVIEW',
      cacheKey: 'budget-bff-detail:v1:br_1',
    });
    expect(r!.steps).toHaveLength(1);
    expect(logged.find((l) => l.msg === 'budget-detail.bff.success')?.ctx).toMatchObject({
      cacheKeyPrefix: 'budget-bff-detail:v1',
      outcome: 'success',
    });
  });

  it('read model null → null + miss 로깅', async () => {
    const readModel: BudgetReadModelQuery = {
      findDetail: vi.fn(async () => null),
      listByProject: vi.fn(),
      listByRequester: vi.fn(),
      listSteps: vi.fn(),
    } as never;
    const { logger, logged } = makeLogger();
    const bff = new BudgetDetailBff(readModel, logger);
    expect(await bff.getDetail({ id: 'x', traceId: 't', correlationId: 'c' })).toBeNull();
    expect(logged.some((l) => l.msg === 'budget-detail.bff.miss')).toBe(true);
  });

  it('cachePrefix 와 OM seed 일치', () => {
    const { logger } = makeLogger();
    const bff = new BudgetDetailBff({} as never, logger);
    expect(bff.cachePrefix).toBe('budget-bff-detail:v1');
  });
});
