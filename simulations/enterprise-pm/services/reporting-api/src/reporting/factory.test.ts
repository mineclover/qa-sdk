import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { createReportingRepository } from "./factory.js";
import { SIM_REPORTING_SQLITE_DDL } from "./sqlite/schema.js";

describe("createReportingRepository", () => {
  it("sqlite → SqliteReportingRepository", async () => {
    const raw = new Database(":memory:");
    raw.exec(SIM_REPORTING_SQLITE_DDL);
    const repo = await createReportingRepository({ dialect: "sqlite", db: drizzle({ client: raw }) });
    const r = await repo.createReport({ name: "D", queryDefinition: "{}", createdBy: "u" });
    expect(r.id).toBeTruthy();
    raw.close();
  });

  it("unknown → throw", async () => {
    await expect(createReportingRepository({ dialect: "unknown" as never, db: {} as never })).rejects.toThrow(
      "지원하지 않는 dialect",
    );
  });
});
