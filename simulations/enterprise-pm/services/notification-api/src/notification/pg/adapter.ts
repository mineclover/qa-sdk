// @def.boundary sim-notification-api
// @def.doc sim-erp-pm-design

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { NotificationRepository } from "../shared/port.js";
import type {
  Notification,
  NotificationCreate,
  NotificationStatus,
  Subscription,
  SubscriptionCreate,
} from "../shared/types.js";
import {
  NotificationNotFoundError,
  SubscriptionNotFoundError,
} from "../shared/errors.js";
import { notifications, subscriptions, matchesEventType } from "./schema.js";

export class PgNotificationRepository implements NotificationRepository {
  constructor(private readonly db: PostgresJsDatabase) {}

  async createNotification(args: NotificationCreate): Promise<Notification> {
    const now = new Date().toISOString();
    const n: Notification = {
      id: randomUUID(),
      recipientUserId: args.recipientUserId,
      type: args.type,
      title: args.title,
      body: args.body,
      status: "pending",
      createdAt: now,
      sentAt: null,
      readAt: null,
    };
    await this.db.insert(notifications).values(n);
    return n;
  }

  async findNotification(id: string): Promise<Notification | null> {
    const rows = await this.db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
    return rows[0] ? toNotification(rows[0]) : null;
  }

  async listNotificationsForUser(
    userId: string,
    status?: NotificationStatus,
  ): Promise<Notification[]> {
    const rows = status
      ? await this.db.select().from(notifications).where(
          and(eq(notifications.recipientUserId, userId), eq(notifications.status, status)),
        )
      : await this.db.select().from(notifications).where(eq(notifications.recipientUserId, userId));
    return rows.map(toNotification);
  }

  async markAsSent(id: string): Promise<Notification> {
    return this.updateStatus(id, "sent", "sentAt");
  }
  async markAsRead(id: string): Promise<Notification> {
    return this.updateStatus(id, "read", "readAt");
  }
  async markAsFailed(id: string): Promise<Notification> {
    return this.updateStatus(id, "failed", null);
  }

  private async updateStatus(
    id: string,
    status: NotificationStatus,
    tsField: "sentAt" | "readAt" | null,
  ): Promise<Notification> {
    const cur = await this.findNotification(id);
    if (!cur) throw new NotificationNotFoundError(id);
    const now = new Date().toISOString();
    const patch: Partial<Notification> = { status };
    if (tsField === "sentAt") patch.sentAt = now;
    if (tsField === "readAt") patch.readAt = now;
    const next: Notification = { ...cur, ...patch };
    await this.db.update(notifications).set({
      status: next.status,
      sentAt: next.sentAt,
      readAt: next.readAt,
    }).where(eq(notifications.id, id));
    return next;
  }

  async createSubscription(args: SubscriptionCreate): Promise<Subscription> {
    const now = new Date().toISOString();
    const s: Subscription = {
      userId: args.userId,
      eventType: args.eventType,
      channel: args.channel,
      isActive: args.isActive ?? true,
      createdAt: now,
    };
    await this.db.insert(subscriptions).values(s).onConflictDoNothing();
    return s;
  }

  async findSubscription(userId: string, eventType: string): Promise<Subscription | null> {
    const rows = await this.db.select().from(subscriptions).where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.eventType, eventType)),
    ).limit(1);
    return rows[0] ? (rows[0] as Subscription) : null;
  }

  async listSubscriptionsForUser(userId: string): Promise<Subscription[]> {
    return (await this.db.select().from(subscriptions).where(eq(subscriptions.userId, userId))) as Subscription[];
  }

  async listSubscribersByEventType(eventType: string): Promise<Subscription[]> {
    const rows = (await this.db.select().from(subscriptions).where(eq(subscriptions.isActive, true))) as Subscription[];
    return rows.filter((s) => matchesEventType(s.eventType, eventType));
  }

  async setSubscriptionActive(
    userId: string,
    eventType: string,
    isActive: boolean,
  ): Promise<Subscription> {
    const cur = await this.findSubscription(userId, eventType);
    if (!cur) throw new SubscriptionNotFoundError(userId, eventType);
    const next: Subscription = { ...cur, isActive };
    await this.db.update(subscriptions).set({ isActive }).where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.eventType, eventType)),
    );
    return next;
  }

  async deleteSubscription(userId: string, eventType: string): Promise<void> {
    await this.db.delete(subscriptions).where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.eventType, eventType)),
    );
  }
}

function toNotification(row: typeof notifications.$inferSelect): Notification {
  return {
    id: row.id,
    recipientUserId: row.recipientUserId,
    type: row.type,
    title: row.title,
    body: row.body,
    status: row.status,
    createdAt: row.createdAt,
    sentAt: row.sentAt ?? null,
    readAt: row.readAt ?? null,
  };
}
