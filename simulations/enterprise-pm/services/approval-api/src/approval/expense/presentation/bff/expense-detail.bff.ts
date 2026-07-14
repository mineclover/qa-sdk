// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import {
  ExpenseReadModelQuery,
  type ExpenseDetailReadModel,
} from '../../application/queries/expense-read-model.query.js';
import type { ExpenseLoggerPort } from '../../application/ports/expense-logger.port.js';

export interface ExpenseDetailBffModel {
  readonly id: string;
  readonly title: string;
  readonly amountLabel: string;
  readonly statusLabel: string;
  readonly categoryLabel: string;
  readonly updatedAt: string;
  readonly cacheKey: string;
}

export class ExpenseDetailBff {
  readonly cachePrefix = 'expense-bff-detail:v1';

  constructor(
    private readonly readModel: ExpenseReadModelQuery,
    private readonly logger: ExpenseLoggerPort,
  ) {}

  async getDetail(input: {
    readonly id: string;
    readonly traceId: string;
    readonly correlationId: string;
  }): Promise<ExpenseDetailBffModel | null> {
    const cacheKey = `${this.cachePrefix}:${input.id}`;
    const detail: ExpenseDetailReadModel | null = await this.readModel.findDetail(input.id);
    this.logger.info(
      {
        traceId: input.traceId,
        correlationId: input.correlationId,
        domain: 'expense',
        useCase: 'ExpenseDetailBff.getDetail',
        aggregateId: input.id,
        queryName: 'ExpenseDetailBffQuery',
        outcome: detail ? 'success' : 'failure',
        cacheKeyPrefix: this.cachePrefix,
        cacheHit: false,
      },
      detail ? 'expense-detail.bff.success' : 'expense-detail.bff.miss',
    );
    if (!detail) return null;
    return {
      id: detail.id,
      title: `Expense Report ${detail.id}`,
      amountLabel: `${detail.amount.toLocaleString('en-US')} KRW`,
      statusLabel: detail.status.toUpperCase(),
      categoryLabel: detail.category,
      updatedAt: detail.updatedAt,
      cacheKey,
    };
  }
}
