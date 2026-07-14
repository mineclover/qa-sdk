// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import {
  SubscriptionReadModelQuery,
  type SubscriptionDetailReadModel,
} from '../../application/queries/subscription-read-model.query.js';
import type { SubscriptionRepositoryPort } from '../../application/ports/subscription-repository.port.js';

export class RepositorySubscriptionReadModel extends SubscriptionReadModelQuery {
  constructor(private readonly repository: SubscriptionRepositoryPort) {
    super();
  }

  async findDetail(userId: string, eventType: string): Promise<SubscriptionDetailReadModel | null> {
    const e = await this.repository.findById(userId, eventType);
    if (!e) return null;
    return mapDetail(e.toSnapshot());
  }

  async listForUser(userId: string): Promise<SubscriptionDetailReadModel[]> {
    const items = await this.repository.listForUser(userId);
    return items.map((e) => mapDetail(e.toSnapshot()));
  }

  async listSubscribersByEventType(eventType: string): Promise<SubscriptionDetailReadModel[]> {
    const items = await this.repository.listSubscribersByEventType(eventType);
    return items.map((e) => mapDetail(e.toSnapshot()));
  }
}

function mapDetail(s: {
  userId: string;
  eventType: string;
  channel: string;
  isActive: boolean;
  createdAt: string;
}): SubscriptionDetailReadModel {
  return {
    userId: s.userId,
    eventType: s.eventType,
    channel: s.channel,
    isActive: s.isActive,
    createdAt: s.createdAt,
  };
}
