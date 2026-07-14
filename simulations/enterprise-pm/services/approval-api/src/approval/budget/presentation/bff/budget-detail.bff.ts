// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import {
  BudgetReadModelQuery,
  type BudgetDetailReadModel,
  type BudgetStepReadModel,
} from '../../application/queries/budget-read-model.query.js';
import type { BudgetLoggerPort } from '../../application/ports/budget-logger.port.js';

/** BFF detail composition — UI 친화적 라벨 + cacheKey. domain entity 노출 금지. */
export interface BudgetDetailBffModel {
  readonly id: string;
  readonly title: string;
  readonly amountLabel: string;
  readonly statusLabel: string;
  readonly stageLabel: string;
  readonly steps: readonly BudgetStepReadModel[];
  readonly updatedAt: string;
  readonly cacheKey: string;
}

/**
 * Budget 화면 BFF.
 *
 * - read model 만 호출, write 금지.
 * - detail + steps 의 다중 read 합성.
 */
export class BudgetDetailBff {
  readonly cachePrefix = 'budget-bff-detail:v1';

  constructor(
    private readonly readModel: BudgetReadModelQuery,
    private readonly logger: BudgetLoggerPort,
  ) {}

  async getDetail(input: {
    readonly id: string;
    readonly traceId: string;
    readonly correlationId: string;
  }): Promise<BudgetDetailBffModel | null> {
    const cacheKey = `${this.cachePrefix}:${input.id}`;
    const detail: BudgetDetailReadModel | null = await this.readModel.findDetail(input.id);
    const steps = detail ? await this.readModel.listSteps(input.id) : [];
    this.logger.info(
      {
        traceId: input.traceId,
        correlationId: input.correlationId,
        domain: 'budget',
        useCase: 'BudgetDetailBff.getDetail',
        aggregateId: input.id,
        queryName: 'BudgetDetailBffQuery',
        outcome: detail ? 'success' : 'failure',
        cacheKeyPrefix: this.cachePrefix,
        cacheHit: false,
      },
      detail ? 'budget-detail.bff.success' : 'budget-detail.bff.miss',
    );
    if (!detail) return null;
    return {
      id: detail.id,
      title: `Budget Request ${detail.id}`,
      amountLabel: `${detail.amount.toLocaleString('en-US')} KRW`,
      statusLabel: detail.status.toUpperCase(),
      stageLabel: `${detail.currentStage}/${detail.totalStages}`,
      steps,
      updatedAt: detail.updatedAt,
      cacheKey,
    };
  }
}
