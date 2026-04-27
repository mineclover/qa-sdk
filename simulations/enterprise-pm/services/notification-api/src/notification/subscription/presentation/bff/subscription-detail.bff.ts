// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import {
  SubscriptionReadModelQuery,
  type SubscriptionDetailReadModel,
} from "../../application/queries/subscription-read-model.query.js";
import type { SubscriptionLoggerPort } from "../../application/ports/subscription-logger.port.js";

export interface SubscriptionDetailBffModel {
  readonly userId: string;
  readonly eventType: string;
  readonly channelLabel: string;
  readonly statusLabel: "ACTIVE" | "PAUSED";
  readonly createdAt: string;
  readonly cacheKey: string;
}

/**
 * Subscription 화면 BFF.
 *
 * - read-model 만 호출, write 금지.
 */
export class SubscriptionDetailBff {
  readonly cachePrefix = "subscription-bff-detail:v1";

  constructor(
    private readonly readModel: SubscriptionReadModelQuery,
    private readonly logger: SubscriptionLoggerPort,
  ) {}

  async getDetail(input: {
    readonly userId: string;
    readonly eventType: string;
    readonly traceId: string;
    readonly correlationId: string;
  }): Promise<SubscriptionDetailBffModel | null> {
    const aggregateId = `${input.userId}:${input.eventType}`;
    const cacheKey = `${this.cachePrefix}:${aggregateId}`;
    const detail: SubscriptionDetailReadModel | null = await this.readModel.findDetail(
      input.userId,
      input.eventType,
    );
    this.logger.info(
      {
        traceId: input.traceId,
        correlationId: input.correlationId,
        domain: "subscription",
        useCase: "SubscriptionDetailBff.getDetail",
        aggregateId,
        queryName: "SubscriptionDetailBffQuery",
        outcome: detail ? "success" : "failure",
        cacheKeyPrefix: this.cachePrefix,
        cacheHit: false,
      },
      detail ? "subscription-detail.bff.success" : "subscription-detail.bff.miss",
    );

    if (!detail) return null;
    return {
      userId: detail.userId,
      eventType: detail.eventType,
      channelLabel: detail.channel === "email" ? "Email" : "In-App",
      statusLabel: detail.isActive ? "ACTIVE" : "PAUSED",
      createdAt: detail.createdAt,
      cacheKey,
    };
  }
}
