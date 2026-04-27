// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import {
  NotificationReadModelQuery,
  type NotificationDetailReadModel,
} from "../../application/queries/notification-read-model.query.js";
import type { NotificationLoggerPort } from "../../application/ports/notification-logger.port.js";

/** BFF detail composition — UI 친화적 라벨 + cacheKey. */
export interface NotificationDetailBffModel {
  readonly id: string;
  readonly title: string;
  readonly statusLabel: string;
  readonly recipientLabel: string;
  readonly createdAt: string;
  readonly sentAt: string | null;
  readonly readAt: string | null;
  readonly cacheKey: string;
}

/**
 * Notification 화면 BFF.
 *
 * - read-model 만 호출, write 금지.
 */
export class NotificationDetailBff {
  readonly cachePrefix = "notification-bff-detail:v1";

  constructor(
    private readonly readModel: NotificationReadModelQuery,
    private readonly logger: NotificationLoggerPort,
  ) {}

  async getDetail(input: {
    readonly id: string;
    readonly traceId: string;
    readonly correlationId: string;
  }): Promise<NotificationDetailBffModel | null> {
    const cacheKey = `${this.cachePrefix}:${input.id}`;
    const detail: NotificationDetailReadModel | null = await this.readModel.findDetail(input.id);
    this.logger.info(
      {
        traceId: input.traceId,
        correlationId: input.correlationId,
        domain: "notification",
        useCase: "NotificationDetailBff.getDetail",
        aggregateId: input.id,
        queryName: "NotificationDetailBffQuery",
        outcome: detail ? "success" : "failure",
        cacheKeyPrefix: this.cachePrefix,
        cacheHit: false,
      },
      detail ? "notification-detail.bff.success" : "notification-detail.bff.miss",
    );

    if (!detail) return null;
    return {
      id: detail.id,
      title: detail.title,
      statusLabel: detail.status.toUpperCase(),
      recipientLabel: `User ${detail.recipientUserId}`,
      createdAt: detail.createdAt,
      sentAt: detail.sentAt,
      readAt: detail.readAt,
      cacheKey,
    };
  }
}
