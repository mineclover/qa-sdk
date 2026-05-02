// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SubscriptionEntity } from "../../domain/index.js";
import { SqliteSubscriptionRepository } from "../persistence/subscription.repository.js";
import { SIM_NOTIF_SUBSCRIPTION_SQLITE_DDL } from "../persistence/sqlite.schema.js";
import { createSubscriptionSqliteTransactionPort } from "./subscription.drizzle-transaction.js";
import { createSubscriptionOutboxPort } from "../outbox/subscription.outbox.js";
import { SubscriptionUnitOfWork } from "./subscription.unit-of-work.js";

/**
 * outbox 물리 테이블 DDL — 본 슬라이스 안에 colocate (cross-slice import 금지).
 * 정의는 notification 슬라이스의 SIM_NOTIF_OUTBOX_SQLITE_DDL 과 동일하다.
 */
const OUTBOX_DDL = `
CREATE TABLE IF NOT EXISTS notification_outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
`;

function bootstrap() {
  const sqlite = new Database(":memory:");
  sqlite.exec(SIM_NOTIF_SUBSCRIPTION_SQLITE_DDL);
  sqlite.exec(OUTBOX_DDL);
  const db = drizzle({ client: sqlite });
  const repo = new SqliteSubscriptionRepository(db);
  const transaction = createSubscriptionSqliteTransactionPort(db);
  const outbox = createSubscriptionOutboxPort({ dialect: "sqlite", db });
  const uow = new SubscriptionUnitOfWork(transaction, repo, outbox);
  return { sqlite, repo, uow };
}

describe("SubscriptionUnitOfWork", () => {
  it("commit: repo.save + outbox.append 가 동일 트랜잭션", async () => {
    const { sqlite, repo, uow } = bootstrap();
    const e = SubscriptionEntity.create({
      userId: "u1",
      eventType: "x",
      channel: "in_app",
      now: new Date("2026-03-01T00:00:00.000Z"),
    });
    await uow.withinTransaction("subscription.create", async (ctx) => {
      await ctx.repository.save(e, ctx.scope);
      await ctx.outbox.append(
        {
          aggregateId: "u1:x",
          eventName: "subscription.created",
          eventVersion: 1,
          payload: {},
          occurredAt: new Date(),
        },
        ctx.scope,
      );
    });
    expect(await repo.findById("u1", "x")).not.toBeNull();
    const rows = sqlite
      .prepare("SELECT * FROM notification_outbox_events")
      .all() as Array<{ event_name: string; scope_id: string }>;
    expect(rows[0].event_name).toBe("subscription.created");
    expect(rows[0].scope_id).toMatch(/^subscription\.create:/);
    sqlite.close();
  });

  it("rollback", async () => {
    const { sqlite, repo, uow } = bootstrap();
    await expect(
      uow.withinTransaction("subscription.create", async (ctx) => {
        await ctx.repository.save(
          SubscriptionEntity.create({ userId: "u2", eventType: "y", channel: "email" }),
          ctx.scope,
        );
        await ctx.outbox.append(
          {
            aggregateId: "u2:y",
            eventName: "subscription.created",
            eventVersion: 1,
            payload: {},
            occurredAt: new Date(),
          },
          ctx.scope,
        );
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await repo.findById("u2", "y")).toBeNull();
    expect(sqlite.prepare("SELECT * FROM notification_outbox_events").all()).toHaveLength(0);
    sqlite.close();
  });
});
