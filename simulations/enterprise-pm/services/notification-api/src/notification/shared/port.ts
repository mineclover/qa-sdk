// @def.boundary sim-notification-api
// @def.doc sim-erp-pm-design

import type {
  Notification,
  NotificationCreate,
  NotificationStatus,
  Subscription,
  SubscriptionCreate,
} from "./types.js";

export interface NotificationRepository {
  // Notification
  createNotification(args: NotificationCreate): Promise<Notification>;
  findNotification(id: string): Promise<Notification | null>;
  listNotificationsForUser(userId: string, status?: NotificationStatus): Promise<Notification[]>;
  markAsSent(id: string): Promise<Notification>;
  markAsRead(id: string): Promise<Notification>;
  markAsFailed(id: string): Promise<Notification>;

  // Subscription
  createSubscription(args: SubscriptionCreate): Promise<Subscription>;
  findSubscription(userId: string, eventType: string): Promise<Subscription | null>;
  listSubscriptionsForUser(userId: string): Promise<Subscription[]>;
  /** event matching: 정확 일치 + wildcard "domain.*" */
  listSubscribersByEventType(eventType: string): Promise<Subscription[]>;
  setSubscriptionActive(userId: string, eventType: string, isActive: boolean): Promise<Subscription>;
  deleteSubscription(userId: string, eventType: string): Promise<void>;
}
