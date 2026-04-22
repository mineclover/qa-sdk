// @def.boundary sim-notification-api
// @def.doc sim-erp-pm-design

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { createNotificationRepository, type NotificationRepoDialect } from "./factory.js";
import { SIM_NOTIF_SQLITE_DDL } from "./sqlite/schema.js";
import { SIM_NOTIF_PG_RESET_DDL } from "./pg/schema.js";
import type { NotificationRepository } from "./shared/port.js";

interface FixtureRunner {
  setup(): Promise<{ repo: NotificationRepository; cleanup(): Promise<void> }>;
}

const sqliteRunner: FixtureRunner = {
  async setup() {
    const raw = new Database(":memory:");
    raw.exec(SIM_NOTIF_SQLITE_DDL);
    const repo = await createNotificationRepository({
      dialect: "sqlite",
      db: drizzleSqlite({ client: raw }),
    });
    return { repo, cleanup: async () => { raw.close(); } };
  },
};

function makePgRunner(): FixtureRunner {
  const PG_CFG = {
    host: process.env.QA_TEST_PG_HOST ?? "localhost",
    port: Number(process.env.QA_TEST_PG_PORT ?? "5434"),
    database: process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test",
    user: process.env.QA_TEST_PG_USER ?? "qa_admin",
    password: process.env.QA_TEST_PG_PASSWORD ?? "",
  };
  return {
    async setup() {
      const sql = postgres({
        host: PG_CFG.host, port: PG_CFG.port, database: PG_CFG.database,
        user: PG_CFG.user, password: PG_CFG.password, max: 5, onnotice: () => {},
      });
      await sql.unsafe(SIM_NOTIF_PG_RESET_DDL);
      const repo = await createNotificationRepository({ dialect: "pg", db: drizzlePg({ client: sql }) });
      return {
        repo,
        cleanup: async () => {
          try {
            await sql.unsafe(`DROP TABLE IF EXISTS sim.notif_subscriptions CASCADE`);
            await sql.unsafe(`DROP TABLE IF EXISTS sim.notif_notifications CASCADE`);
          } finally {
            await sql.end();
          }
        },
      };
    },
  };
}

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";
const matrix: Array<[NotificationRepoDialect, FixtureRunner]> = [
  ["sqlite", sqliteRunner],
  ...(PG_AVAILABLE ? ([["pg", makePgRunner()]] as Array<[NotificationRepoDialect, FixtureRunner]>) : []),
];

describe.each(matrix)("NotificationRepository contract — %s", (dialect, runner) => {
  let repo: NotificationRepository;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const ctx = await runner.setup();
    repo = ctx.repo;
    cleanup = ctx.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it(`createNotification + markAsRead — ${dialect}`, async () => {
    const n = await repo.createNotification({
      recipientUserId: "u", type: "budget.approved", title: "t", body: "b",
    });
    const read = await repo.markAsRead(n.id);
    expect(read.status).toBe("read");
  });

  it(`createSubscription + listSubscriptionsForUser — ${dialect}`, async () => {
    await repo.createSubscription({
      userId: "u", eventType: "budget.approved", channel: "in_app",
    });
    expect((await repo.listSubscriptionsForUser("u")).length).toBe(1);
  });

  it(`wildcard match — ${dialect}`, async () => {
    await repo.createSubscription({ userId: "u", eventType: "budget.*", channel: "in_app" });
    const subs = await repo.listSubscribersByEventType("budget.approved");
    expect(subs.length).toBe(1);
  });

  it(`setSubscriptionActive false → 제외 — ${dialect}`, async () => {
    await repo.createSubscription({ userId: "u", eventType: "task.*", channel: "email" });
    await repo.setSubscriptionActive("u", "task.*", false);
    expect((await repo.listSubscribersByEventType("task.created")).length).toBe(0);
  });
});
