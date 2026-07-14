// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import {
  ResourceReadModelQuery,
  type ResourceDetailReadModel,
} from '../../application/queries/resource-read-model.query.js';
import type { ResourceLoggerPort } from '../../application/ports/resource-logger.port.js';

export interface ResourceDetailBffModel {
  readonly id: string;
  readonly title: string;
  readonly typeLabel: string;
  readonly statusLabel: string;
  readonly updatedAt: string;
  readonly cacheKey: string;
}

export class ResourceDetailBff {
  readonly cachePrefix = 'resource-bff-detail:v1';
  constructor(
    private readonly readModel: ResourceReadModelQuery,
    private readonly logger: ResourceLoggerPort,
  ) {}
  async getDetail(input: {
    readonly id: string;
    readonly traceId: string;
    readonly correlationId: string;
  }): Promise<ResourceDetailBffModel | null> {
    const cacheKey = `${this.cachePrefix}:${input.id}`;
    const detail: ResourceDetailReadModel | null = await this.readModel.findDetail(input.id);
    this.logger.info(
      {
        traceId: input.traceId,
        correlationId: input.correlationId,
        domain: 'resource',
        useCase: 'ResourceDetailBff.getDetail',
        aggregateId: input.id,
        queryName: 'ResourceDetailBffQuery',
        outcome: detail ? 'success' : 'failure',
        cacheKeyPrefix: this.cachePrefix,
        cacheHit: false,
      },
      detail ? 'resource-detail.bff.success' : 'resource-detail.bff.miss',
    );
    if (!detail) return null;
    return {
      id: detail.id,
      title: `Resource Request ${detail.id}`,
      typeLabel: detail.resourceType,
      statusLabel: detail.status.toUpperCase(),
      updatedAt: detail.updatedAt,
      cacheKey,
    };
  }
}
