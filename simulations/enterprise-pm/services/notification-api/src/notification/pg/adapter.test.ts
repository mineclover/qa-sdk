// @def.boundary sim-notification-api
// @def.doc sim-erp-pm-design

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PgNotificationRepository } from "./adapter.js";
import { SIM_NOTIF_PG_RESET_DDL } from "./schema.js";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

describe.skipIf(!PG_AVAILABLE)("PgNotificationRepository — PG-specific", () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? "localhost";
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? "5434");
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test";
  const PG_USER = process.env.QA_TEST_PG_USER ?? "qa_admin";
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? "";

  let sql: ReturnType<typeof postgres>;
  let repo: PgNotificationRepository;

  beforeEach(async () => {
    sql = postgres({
      host: PG_HOST, port: PG_PORT, database: PG_DATABASE,
      user: PG_USER, password: PG_PASSWORD, max: 5, onnotice: () => {},
    });
    await sql.unsafe(SIM_NOTIF_PG_RESET_DDL);
    repo = new PgNotificationRepository(drizzle({ client: sql }));
  });

  afterEach(async () => {
    try {
      await sql.unsafe(`DROP TABLE IF EXISTS sim.notif_subscriptions CASCADE`);
      await sql.unsafe(`DROP TABLE IF EXISTS sim.notif_notifications CASCADE`);
    } finally {
      await sql.end();
    }
  });

  it("createNotification round-trip", async () => {
    const n = await repo.createNotification({
      recipientUserId: "u", type: "budget.approved", title: "t", body: "b",
    });
    expect((await repo.findNotification(n.id))?.title).toBe("t");
  });

  it("listSubscribersByEventType wildcard — 'budget.*' 매치", async () => {
    await repo.createSubscription({ userId: "u-1", eventType: "budget.*", channel: "in_app" });
    await repo.createSubscription({ userId: "u-2", eventType: "task.*", channel: "in_app" });
    const subs = await repo.listSubscribersByEventType("budget.approved");
    expect(subs.length).toBe(1);
    expect(subs[0].userId).toBe("u-1");
  });
});
