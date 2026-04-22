import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteReportingRepository } from "../sqlite/adapter.js";
import { SIM_REPORTING_SQLITE_DDL } from "../sqlite/schema.js";
import { ReportService } from "./report.service.js";

function svc() {
  const raw = new Database(":memory:");
  raw.exec(SIM_REPORTING_SQLITE_DDL);
  return new ReportService(new SqliteReportingRepository(drizzle({ client: raw })));
}

describe("ReportService", () => {
  it("create + find", async () => {
    const s = svc();
    const r = await s.create({ name: "D", queryDefinition: "{}", createdBy: "u" });
    expect((await s.find(r.id))?.name).toBe("D");
  });
});
