import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { createNotificationRepository } from "./factory.js";
import { SIM_NOTIF_SQLITE_DDL } from "./sqlite/schema.js";

describe("createNotificationRepository", () => {
  it("sqlite → SqliteNotificationRepository", async () => {
    const raw = new Database(":memory:");
    raw.exec(SIM_NOTIF_SQLITE_DDL);
    const repo = await createNotificationRepository({ dialect: "sqlite", db: drizzle({ client: raw }) });
    const n = await repo.createNotification({ recipientUserId: "u", type: "x", title: "t", body: "b" });
    expect(n.id).toBeTruthy();
    raw.close();
  });

  it("unknown → throw", async () => {
    await expect(createNotificationRepository({ dialect: "unknown" as never, db: {} as never })).rejects.toThrow(
      "지원하지 않는 dialect",
    );
  });
});
