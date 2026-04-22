import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteReportingRepository } from "../sqlite/adapter.js";
import { SIM_REPORTING_SQLITE_DDL } from "../sqlite/schema.js";
import { MetricService } from "./metric.service.js";

function svc() {
  const raw = new Database(":memory:");
  raw.exec(SIM_REPORTING_SQLITE_DDL);
  return new MetricService(new SqliteReportingRepository(drizzle({ client: raw })));
}

describe("MetricService", () => {
  it("record + find", async () => {
    const s = svc();
    await s.record({ metricKey: "k", date: "2026-04-22", value: 0.5, dimensions: "{}" });
    expect((await s.find("k", "2026-04-22"))?.value).toBe(0.5);
  });
});
