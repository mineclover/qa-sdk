// @def.boundary sim-notification-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable } from "@nestjs/common";
import { NOTIFICATION_REPOSITORY } from "../notification-db.module.js";
import type { NotificationRepository } from "../shared/port.js";
import type { Subscription, SubscriptionCreate } from "../shared/types.js";

@Injectable()
export class SubscriptionService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly repo: NotificationRepository,
  ) {}

  create(args: SubscriptionCreate): Promise<Subscription> {
    return this.repo.createSubscription(args);
  }
  listForUser(userId: string): Promise<Subscription[]> {
    return this.repo.listSubscriptionsForUser(userId);
  }
  listSubscribersByEventType(eventType: string): Promise<Subscription[]> {
    return this.repo.listSubscribersByEventType(eventType);
  }
  setActive(userId: string, eventType: string, isActive: boolean): Promise<Subscription> {
    return this.repo.setSubscriptionActive(userId, eventType, isActive);
  }
  delete(userId: string, eventType: string): Promise<void> {
    return this.repo.deleteSubscription(userId, eventType);
  }
}
