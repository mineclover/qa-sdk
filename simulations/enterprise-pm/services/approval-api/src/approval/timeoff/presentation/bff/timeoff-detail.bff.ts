// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import {
  TimeOffReadModelQuery,
  type TimeOffDetailReadModel,
} from '../../application/queries/timeoff-read-model.query.js';
import type { TimeOffLoggerPort } from '../../application/ports/timeoff-logger.port.js';

export interface TimeOffDetailBffModel {
  readonly id: string;
  readonly title: string;
  readonly periodLabel: string;
  readonly statusLabel: string;
  readonly updatedAt: string;
  readonly cacheKey: string;
}

export class TimeOffDetailBff {
  readonly cachePrefix = 'timeoff-bff-detail:v1';
  constructor(
    private readonly readModel: TimeOffReadModelQuery,
    private readonly logger: TimeOffLoggerPort,
  ) {}
  async getDetail(input: {
    readonly id: string;
    readonly traceId: string;
    readonly correlationId: string;
  }): Promise<TimeOffDetailBffModel | null> {
    const cacheKey = `${this.cachePrefix}:${input.id}`;
    const detail: TimeOffDetailReadModel | null = await this.readModel.findDetail(input.id);
    this.logger.info(
      {
        traceId: input.traceId,
        correlationId: input.correlationId,
        domain: 'timeoff',
        useCase: 'TimeOffDetailBff.getDetail',
        aggregateId: input.id,
        queryName: 'TimeOffDetailBffQuery',
        outcome: detail ? 'success' : 'failure',
        cacheKeyPrefix: this.cachePrefix,
        cacheHit: false,
      },
      detail ? 'timeoff-detail.bff.success' : 'timeoff-detail.bff.miss',
    );
    if (!detail) return null;
    return {
      id: detail.id,
      title: `Time-off ${detail.id}`,
      periodLabel: `${detail.startDate} → ${detail.endDate}`,
      statusLabel: detail.status.toUpperCase(),
      updatedAt: detail.updatedAt,
      cacheKey,
    };
  }
}
