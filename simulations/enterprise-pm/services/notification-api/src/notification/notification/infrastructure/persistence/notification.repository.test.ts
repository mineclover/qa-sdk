// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { NotificationEntity } from "../../domain/index.js";
import {
  SqliteNotificationRepository,
  createNotificationRepository,
} from "./notification.repository.js";
import { SIM_NOTIF_NOTIFICATION_SQLITE_DDL } from "./sqlite.schema.js";
import * as pgSchemaModule from "./pg.schema.js";
import * as sqliteSchemaModule from "./sqlite.schema.js";
import type { NotificationTransactionScope } from "../../application/ports/notification-transaction.port.js";

function makeScope(): NotificationTransactionScope {
  return { id: "tx-test", startedAt: new Date() };
}

describe("SqliteNotificationRepository", () => {
  it("save 후 findById 가 entity 를 라운드트립한다", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_NOTIF_NOTIFICATION_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteNotificationRepository(db);
    const entity = NotificationEntity.create({
      id: "ntf_1",
      recipientUserId: "usr_1",
      type: "budget.approved",
      title: "title",
      body: "body",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    await repo.save(entity, makeScope());

    const found = await repo.findById("ntf_1");
    expect(found).not.toBeNull();
    expect(found!.toSnapshot()).toEqual(entity.toSnapshot());

    sqlite.close();
  });

  it("findById 미존재 시 null", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_NOTIF_NOTIFICATION_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteNotificationRepository(db);
    expect(await repo.findById("missing")).toBeNull();
    sqlite.close();
  });

  it("upsert: 동일 id save 시 update", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_NOTIF_NOTIFICATION_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteNotificationRepository(db);

    const e1 = NotificationEntity.create({
      id: "ntf_2",
      recipientUserId: "u",
      type: "x",
      title: "t",
      body: "b",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    await repo.save(e1, makeScope());

    const e2 = e1.markSent(new Date("2026-01-03T00:00:00.000Z"));
    await repo.save(e2, makeScope());

    const found = await repo.findById("ntf_2");
    expect(found!.status).toBe("sent");
    sqlite.close();
  });

  it("listForUser status 필터링", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_NOTIF_NOTIFICATION_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteNotificationRepository(db);

    const e1 = NotificationEntity.create({
      id: "ntf_a",
      recipientUserId: "u1",
      type: "x",
      title: "t",
      body: "b",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    const e2 = NotificationEntity.create({
      id: "ntf_b",
      recipientUserId: "u1",
      type: "y",
      title: "t",
      body: "b",
      now: new Date("2026-01-02T00:00:00.000Z"),
    }).markSent();

    await repo.save(e1, makeScope());
    await repo.save(e2, makeScope());

    const all = await repo.listForUser("u1");
    expect(all.length).toBe(2);

    const onlySent = await repo.listForUser("u1", "sent");
    expect(onlySent.length).toBe(1);
    expect(onlySent[0].id).toBe("ntf_b");

    sqlite.close();
  });
});

describe("PgNotificationRepository (column mapping symmetry)", () => {
  it("sqlite/pg 둘 다 동일 컬럼셋(JS 필드) 을 사용한다", () => {
    const sqliteCols = Object.keys(sqliteSchemaModule.notifications);
    const pgCols = Object.keys(pgSchemaModule.notifications);
    const expected = [
      "id",
      "recipientUserId",
      "type",
      "title",
      "body",
      "status",
      "createdAt",
      "sentAt",
      "readAt",
    ];
    for (const c of expected) {
      expect(sqliteCols).toContain(c);
      expect(pgCols).toContain(c);
    }
  });
});

describe("createNotificationRepository factory", () => {
  it("sqlite dialect → SqliteNotificationRepository", () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_NOTIF_NOTIFICATION_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const r = createNotificationRepository({ dialect: "sqlite", db });
    expect(r).toBeInstanceOf(SqliteNotificationRepository);
    sqlite.close();
  });

  it("알 수 없는 dialect 는 예외", () => {
    expect(() =>
      createNotificationRepository({ dialect: "mysql" as never, db: {} as never }),
    ).toThrow();
  });
});
