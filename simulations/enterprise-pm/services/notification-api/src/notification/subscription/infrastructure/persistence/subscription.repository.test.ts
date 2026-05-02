// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SubscriptionEntity } from "../../domain/index.js";
import {
  SqliteSubscriptionRepository,
  createSubscriptionRepository,
} from "./subscription.repository.js";
import { SIM_NOTIF_SUBSCRIPTION_SQLITE_DDL } from "./sqlite.schema.js";
import * as pgSchemaModule from "./pg.schema.js";
import * as sqliteSchemaModule from "./sqlite.schema.js";
import type { SubscriptionTransactionScope } from "../../application/ports/subscription-transaction.port.js";

function makeScope(): SubscriptionTransactionScope {
  return { id: "tx-test", startedAt: new Date() };
}

function makeSqlite() {
  const sqlite = new Database(":memory:");
  sqlite.exec(SIM_NOTIF_SUBSCRIPTION_SQLITE_DDL);
  const db = drizzle({ client: sqlite });
  return { sqlite, db, repo: new SqliteSubscriptionRepository(db) };
}

describe("SqliteSubscriptionRepository", () => {
  it("save 후 findById 라운드트립", async () => {
    const { sqlite, repo } = makeSqlite();
    const e = SubscriptionEntity.create({
      userId: "u1",
      eventType: "budget.*",
      channel: "in_app",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    await repo.save(e, makeScope());
    const found = await repo.findById("u1", "budget.*");
    expect(found!.toSnapshot()).toEqual(e.toSnapshot());
    sqlite.close();
  });

  it("upsert: 같은 (userId, eventType) → update channel/isActive", async () => {
    const { sqlite, repo } = makeSqlite();
    const e1 = SubscriptionEntity.create({
      userId: "u1",
      eventType: "x",
      channel: "in_app",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    await repo.save(e1, makeScope());
    const e2 = e1.setActive(false);
    await repo.save(e2, makeScope());
    expect((await repo.findById("u1", "x"))!.isActive).toBe(false);
    sqlite.close();
  });

  it("listForUser", async () => {
    const { sqlite, repo } = makeSqlite();
    await repo.save(
      SubscriptionEntity.create({ userId: "u1", eventType: "a.*", channel: "in_app" }),
      makeScope(),
    );
    await repo.save(
      SubscriptionEntity.create({ userId: "u1", eventType: "b.*", channel: "email" }),
      makeScope(),
    );
    expect((await repo.listForUser("u1")).length).toBe(2);
    sqlite.close();
  });

  it("listSubscribersByEventType — wildcard match + active filter", async () => {
    const { sqlite, repo } = makeSqlite();
    await repo.save(
      SubscriptionEntity.create({ userId: "u1", eventType: "budget.*", channel: "in_app" }),
      makeScope(),
    );
    await repo.save(
      SubscriptionEntity.create({
        userId: "u2",
        eventType: "task.*",
        channel: "in_app",
        isActive: false,
      }),
      makeScope(),
    );
    const subs = await repo.listSubscribersByEventType("budget.approved");
    expect(subs.map((s) => s.userId)).toEqual(["u1"]);
    expect(await repo.listSubscribersByEventType("task.created")).toEqual([]);
    sqlite.close();
  });

  it("deleteById", async () => {
    const { sqlite, repo } = makeSqlite();
    await repo.save(
      SubscriptionEntity.create({ userId: "u1", eventType: "x", channel: "in_app" }),
      makeScope(),
    );
    await repo.deleteById("u1", "x", makeScope());
    expect(await repo.findById("u1", "x")).toBeNull();
    sqlite.close();
  });
});

describe("subscription column symmetry sqlite ↔ pg", () => {
  it("동일 JS 필드", () => {
    const sqliteCols = Object.keys(sqliteSchemaModule.subscriptions);
    const pgCols = Object.keys(pgSchemaModule.subscriptions);
    for (const c of ["userId", "eventType", "channel", "isActive", "createdAt"]) {
      expect(sqliteCols).toContain(c);
      expect(pgCols).toContain(c);
    }
  });
});

describe("createSubscriptionRepository factory", () => {
  it("sqlite", () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_NOTIF_SUBSCRIPTION_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const r = createSubscriptionRepository({ dialect: "sqlite", db });
    expect(r).toBeInstanceOf(SqliteSubscriptionRepository);
    sqlite.close();
  });
  it("unknown → throw", () => {
    expect(() =>
      createSubscriptionRepository({ dialect: "mysql" as never, db: {} as never }),
    ).toThrow();
  });
});
