import { describe, expect, it, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteNotificationRepository } from "./adapter.js";
import { SIM_NOTIF_SQLITE_DDL } from "./schema.js";

function fixture() {
  const raw = new Database(":memory:");
  raw.exec(SIM_NOTIF_SQLITE_DDL);
  return {
    repo: new SqliteNotificationRepository(drizzle({ client: raw })),
    close: () => raw.close(),
  };
}

describe("SqliteNotificationRepository", () => {
  let f: ReturnType<typeof fixture>;
  beforeEach(() => {
    f = fixture();
  });
  afterEach(() => f.close());

  it("createNotification + findNotification round-trip", async () => {
    const n = await f.repo.createNotification({
      recipientUserId: "u",
      type: "budget.approved",
      title: "t",
      body: "b",
    });
    expect((await f.repo.findNotification(n.id))?.title).toBe("t");
  });

  it("listNotificationsForUser status filter", async () => {
    await f.repo.createNotification({ recipientUserId: "u", type: "x", title: "a", body: "a" });
    const n2 = await f.repo.createNotification({ recipientUserId: "u", type: "y", title: "b", body: "b" });
    await f.repo.markAsSent(n2.id);
    expect((await f.repo.listNotificationsForUser("u", "pending")).length).toBe(1);
    expect((await f.repo.listNotificationsForUser("u", "sent")).length).toBe(1);
  });

  it("markAsSent → status=sent + sentAt 갱신", async () => {
    const n = await f.repo.createNotification({ recipientUserId: "u", type: "x", title: "t", body: "b" });
    const next = await f.repo.markAsSent(n.id);
    expect(next.status).toBe("sent");
    expect(next.sentAt).not.toBeNull();
  });

  it("markAsRead → status=read + readAt 갱신", async () => {
    const n = await f.repo.createNotification({ recipientUserId: "u", type: "x", title: "t", body: "b" });
    const next = await f.repo.markAsRead(n.id);
    expect(next.status).toBe("read");
    expect(next.readAt).not.toBeNull();
  });

  it("createSubscription + listSubscriptionsForUser", async () => {
    await f.repo.createSubscription({ userId: "u", eventType: "budget.approved", channel: "in_app" });
    await f.repo.createSubscription({ userId: "u", eventType: "task.*", channel: "email" });
    expect((await f.repo.listSubscriptionsForUser("u")).length).toBe(2);
  });

  it("listSubscribersByEventType — 정확 매치", async () => {
    await f.repo.createSubscription({ userId: "u-1", eventType: "budget.approved", channel: "in_app" });
    await f.repo.createSubscription({ userId: "u-2", eventType: "task.created", channel: "in_app" });
    const subs = await f.repo.listSubscribersByEventType("budget.approved");
    expect(subs.length).toBe(1);
    expect(subs[0].userId).toBe("u-1");
  });

  it("listSubscribersByEventType — wildcard 'budget.*' 매치", async () => {
    await f.repo.createSubscription({ userId: "u-1", eventType: "budget.*", channel: "in_app" });
    await f.repo.createSubscription({ userId: "u-2", eventType: "task.*", channel: "in_app" });
    const subs = await f.repo.listSubscribersByEventType("budget.approved");
    expect(subs.length).toBe(1);
    expect(subs[0].userId).toBe("u-1");
  });

  it("setSubscriptionActive false → listSubscribersByEventType에서 제외", async () => {
    await f.repo.createSubscription({ userId: "u", eventType: "budget.*", channel: "in_app" });
    await f.repo.setSubscriptionActive("u", "budget.*", false);
    expect((await f.repo.listSubscribersByEventType("budget.approved")).length).toBe(0);
  });
});
