// ── d1-verdict-store.test.ts 분리 from d1-stores.test.ts ───

import { describe, expect, it, beforeEach } from "vitest";
import { NodeSqliteDriver } from "index-meta";
import { D1VerdictStore } from "./d1-verdict-store.js";
import { createD1Drizzle, type D1Db } from "./d1-db-type.js";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";

const migrationsFolder = new URL("../../drizzle", import.meta.url).pathname;

function createDb(): D1Db {
  const driver = new NodeSqliteDriver(":memory:", null);
  const drizzleDb = drizzle({ client: driver.$client });
  migrate(drizzleDb, { migrationsFolder });
  return createD1Drizzle(driver.$client);
}

describe("D1VerdictStore", () => {
  let store: D1VerdictStore;

  beforeEach(() => {
    const db = createDb();
    store = new D1VerdictStore(db);
  });

  it("insert + findByTraceId", async () => {
    await store.insert({ id: "v1", scenarioId: "sc1", traceId: "t1", overallVerdict: "pass", report: { steps: [] } });
    const verdicts = await store.findByTraceId("t1");
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0].overallVerdict).toBe("pass");
  });

  it("ON CONFLICT 시 업데이트", async () => {
    await store.insert({ id: "v1", scenarioId: "sc1", traceId: "t1", overallVerdict: "pass", report: { steps: [] } });
    await store.insert({ id: "v2", scenarioId: "sc1", traceId: "t1", overallVerdict: "fail", report: { steps: [{ error: "timeout" }] } });
    const verdicts = await store.findByTraceId("t1");
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0].overallVerdict).toBe("fail");
  });
});
