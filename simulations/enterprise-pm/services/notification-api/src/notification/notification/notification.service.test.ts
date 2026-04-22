import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteNotificationRepository } from "../sqlite/adapter.js";
import { SIM_NOTIF_SQLITE_DDL } from "../sqlite/schema.js";
import { NotificationService } from "./notification.service.js";

function svc() {
  const raw = new Database(":memory:");
  raw.exec(SIM_NOTIF_SQLITE_DDL);
  return new NotificationService(new SqliteNotificationRepository(drizzle({ client: raw })));
}

describe("NotificationService", () => {
  it("create + find + markRead", async () => {
    const s = svc();
    const n = await s.create({ recipientUserId: "u", type: "x", title: "t", body: "b" });
    expect((await s.find(n.id))?.status).toBe("pending");
    const read = await s.markRead(n.id);
    expect(read.status).toBe("read");
  });
});
