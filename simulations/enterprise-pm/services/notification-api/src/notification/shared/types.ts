// @def.boundary sim-notification-api
// @def.doc sim-erp-pm-design

export type NotificationStatus = "pending" | "sent" | "read" | "failed";
export type NotificationChannel = "in_app" | "email";

export interface Notification {
  id: string;
  recipientUserId: string;
  type: string;            // "budget.approved", "task.assigned" 등
  title: string;
  body: string;
  status: NotificationStatus;
  createdAt: string;
  sentAt: string | null;
  readAt: string | null;
}

export interface Subscription {
  userId: string;
  eventType: string;       // wildcard 지원: "budget.*", "task.*"
  channel: NotificationChannel;
  isActive: boolean;
  createdAt: string;
}

export interface NotificationCreate {
  recipientUserId: string;
  type: string;
  title: string;
  body: string;
}

export interface SubscriptionCreate {
  userId: string;
  eventType: string;
  channel: NotificationChannel;
  isActive?: boolean;
}
