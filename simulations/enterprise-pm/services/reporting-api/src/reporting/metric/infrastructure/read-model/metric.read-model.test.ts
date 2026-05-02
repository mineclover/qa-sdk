// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteReportingRepository } from "../../../sqlite/adapter.js";
import { SIM_REPORTING_SQLITE_DDL } from "../../../sqlite/schema.js";
import { RepositoryMetricReadModel } from "./metric.read-model.js";

function makeReadModel() {
  const raw = new Database(":memory:");
  raw.exec(SIM_REPORTING_SQLITE_DDL);
  const repo = new SqliteReportingRepository(drizzle({ client: raw }));
  return { repo, readModel: new RepositoryMetricReadModel(repo) };
}

describe("RepositoryMetricReadModel", () => {
  it("findOne — null when missing", async () => {
    const { readModel } = makeReadModel();
    expect(await readModel.findOne("nope", "2026-04-22")).toBeNull();
  });

  it("findOne — returns mapped read model after insert", async () => {
    const { repo, readModel } = makeReadModel();
    await repo.recordMetric({
      metricKey: "k.density",
      date: "2026-04-22",
      value: 0.42,
      dimensions: "{}",
    });
    const got = await readModel.findOne("k.density", "2026-04-22");
    expect(got?.value).toBe(0.42);
    expect(got?.metricKey).toBe("k.density");
  });

  it("listByKey — range filter ascending", async () => {
    const { repo, readModel } = makeReadModel();
    await repo.recordMetric({ metricKey: "k", date: "2026-04-22", value: 1, dimensions: "{}" });
    await repo.recordMetric({ metricKey: "k", date: "2026-04-23", value: 2, dimensions: "{}" });
    await repo.recordMetric({ metricKey: "k", date: "2026-04-24", value: 3, dimensions: "{}" });
    const range = await readModel.listByKey("k", "2026-04-22", "2026-04-23");
    expect(range.length).toBe(2);
    expect(range[0].date <= range[1].date).toBe(true);
  });

  it("listKeys — distinct keys", async () => {
    const { repo, readModel } = makeReadModel();
    await repo.recordMetric({ metricKey: "a", date: "2026-04-22", value: 1, dimensions: "{}" });
    await repo.recordMetric({ metricKey: "b", date: "2026-04-22", value: 2, dimensions: "{}" });
    await repo.recordMetric({ metricKey: "a", date: "2026-04-23", value: 3, dimensions: "{}" });
    const keys = (await readModel.listKeys()).sort();
    expect(keys).toEqual(["a", "b"]);
  });
});
