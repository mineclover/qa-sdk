// @def.boundary sim-notification-api
// @def.doc sim-erp-pm-design

export class NotificationNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Notification not found: ${id}`);
    this.name = "NotificationNotFoundError";
  }
}
export class SubscriptionNotFoundError extends Error {
  constructor(public readonly userId: string, public readonly eventType: string) {
    super(`Subscription not found: ${userId}/${eventType}`);
    this.name = "SubscriptionNotFoundError";
  }
}
