// @def.boundary sim-notification-api
// @def.doc sim-erp-pm-design

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
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

export class SqliteNotificationRepository implements NotificationRepository {
  constructor(private readonly db: BetterSQLite3Database) {}

  // ── Notification ────
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
    this.db.insert(notifications).values(n).run();
    return n;
  }

  async findNotification(id: string): Promise<Notification | null> {
    const rows = this.db.select().from(notifications).where(eq(notifications.id, id)).limit(1).all();
    return rows[0] ? toNotification(rows[0]) : null;
  }

  async listNotificationsForUser(
    userId: string,
    status?: NotificationStatus,
  ): Promise<Notification[]> {
    const rows = status
      ? this.db.select().from(notifications).where(
          and(eq(notifications.recipientUserId, userId), eq(notifications.status, status)),
        ).all()
      : this.db.select().from(notifications).where(eq(notifications.recipientUserId, userId)).all();
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
    this.db.update(notifications).set({
      status: next.status,
      sentAt: next.sentAt,
      readAt: next.readAt,
    }).where(eq(notifications.id, id)).run();
    return next;
  }

  // ── Subscription ────
  async createSubscription(args: SubscriptionCreate): Promise<Subscription> {
    const now = new Date().toISOString();
    const s: Subscription = {
      userId: args.userId,
      eventType: args.eventType,
      channel: args.channel,
      isActive: args.isActive ?? true,
      createdAt: now,
    };
    this.db.insert(subscriptions).values(s).onConflictDoNothing().run();
    return s;
  }

  async findSubscription(userId: string, eventType: string): Promise<Subscription | null> {
    const rows = this.db.select().from(subscriptions).where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.eventType, eventType)),
    ).limit(1).all();
    return rows[0] ? (rows[0] as Subscription) : null;
  }

  async listSubscriptionsForUser(userId: string): Promise<Subscription[]> {
    return this.db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).all() as Subscription[];
  }

  async listSubscribersByEventType(eventType: string): Promise<Subscription[]> {
    const rows = this.db.select().from(subscriptions).where(eq(subscriptions.isActive, true)).all() as Subscription[];
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
    this.db.update(subscriptions).set({ isActive }).where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.eventType, eventType)),
    ).run();
    return next;
  }

  async deleteSubscription(userId: string, eventType: string): Promise<void> {
    this.db.delete(subscriptions).where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.eventType, eventType)),
    ).run();
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
