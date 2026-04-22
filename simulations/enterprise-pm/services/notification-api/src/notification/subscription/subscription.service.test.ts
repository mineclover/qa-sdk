import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteNotificationRepository } from "../sqlite/adapter.js";
import { SIM_NOTIF_SQLITE_DDL } from "../sqlite/schema.js";
import { SubscriptionService } from "./subscription.service.js";

function svc() {
  const raw = new Database(":memory:");
  raw.exec(SIM_NOTIF_SQLITE_DDL);
  return new SubscriptionService(new SqliteNotificationRepository(drizzle({ client: raw })));
}

describe("SubscriptionService", () => {
  it("create + listForUser", async () => {
    const s = svc();
    await s.create({ userId: "u", eventType: "budget.*", channel: "in_app" });
    expect((await s.listForUser("u")).length).toBe(1);
  });
  it("wildcard match", async () => {
    const s = svc();
    await s.create({ userId: "u", eventType: "budget.*", channel: "in_app" });
    expect((await s.listSubscribersByEventType("budget.approved")).length).toBe(1);
  });
});
