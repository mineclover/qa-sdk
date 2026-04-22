import { describe, expect, it, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteReportingRepository } from "./adapter.js";
import { SIM_REPORTING_SQLITE_DDL } from "./schema.js";

function fixture() {
  const raw = new Database(":memory:");
  raw.exec(SIM_REPORTING_SQLITE_DDL);
  return {
    repo: new SqliteReportingRepository(drizzle({ client: raw })),
    close: () => raw.close(),
  };
}

describe("SqliteReportingRepository", () => {
  let f: ReturnType<typeof fixture>;
  beforeEach(() => {
    f = fixture();
  });
  afterEach(() => f.close());

  it("createReport + findReport", async () => {
    const r = await f.repo.createReport({ name: "Daily", queryDefinition: "{}", createdBy: "u" });
    expect((await f.repo.findReport(r.id))?.name).toBe("Daily");
  });

  it("listReports", async () => {
    await f.repo.createReport({ name: "A", queryDefinition: "{}", createdBy: "u" });
    await f.repo.createReport({ name: "B", queryDefinition: "{}", createdBy: "u" });
    expect((await f.repo.listReports()).length).toBe(2);
  });

  it("updateReport patch", async () => {
    const r = await f.repo.createReport({ name: "old", queryDefinition: "{}", createdBy: "u" });
    const updated = await f.repo.updateReport(r.id, { name: "new" });
    expect(updated.name).toBe("new");
  });

  it("recordMetric + findMetric", async () => {
    await f.repo.recordMetric({
      metricKey: "marginal_density.sim.budget",
      date: "2026-04-22",
      value: 0.42,
      dimensions: "{}",
    });
    const m = await f.repo.findMetric("marginal_density.sim.budget", "2026-04-22");
    expect(m?.value).toBe(0.42);
  });

  it("listMetricsByKey range query", async () => {
    await f.repo.recordMetric({ metricKey: "k", date: "2026-04-21", value: 1, dimensions: "{}" });
    await f.repo.recordMetric({ metricKey: "k", date: "2026-04-22", value: 2, dimensions: "{}" });
    await f.repo.recordMetric({ metricKey: "k", date: "2026-04-23", value: 3, dimensions: "{}" });
    const res = await f.repo.listMetricsByKey("k", "2026-04-22", "2026-04-23");
    expect(res.map((m) => m.value)).toEqual([2, 3]);
  });

  it("listMetricKeys distinct", async () => {
    await f.repo.recordMetric({ metricKey: "a", date: "2026-04-22", value: 1, dimensions: "{}" });
    await f.repo.recordMetric({ metricKey: "a", date: "2026-04-23", value: 2, dimensions: "{}" });
    await f.repo.recordMetric({ metricKey: "b", date: "2026-04-22", value: 3, dimensions: "{}" });
    const keys = await f.repo.listMetricKeys();
    expect(keys.sort()).toEqual(["a", "b"]);
  });
});
