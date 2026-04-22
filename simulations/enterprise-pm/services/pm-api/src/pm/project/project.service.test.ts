import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqlitePmRepository } from "../sqlite/adapter.js";
import { SIM_PM_SQLITE_DDL } from "../sqlite/schema.js";
import { ProjectService } from "./project.service.js";

function svc() {
  const raw = new Database(":memory:");
  raw.exec(SIM_PM_SQLITE_DDL);
  return new ProjectService(new SqlitePmRepository(drizzle({ client: raw })));
}

describe("ProjectService", () => {
  it("create + find", async () => {
    const s = svc();
    const p = await s.create({ name: "P1", ownerId: "u", departmentId: "d" });
    expect((await s.find(p.id))?.name).toBe("P1");
  });
  it("listByOwner + listByDepartment", async () => {
    const s = svc();
    await s.create({ name: "A", ownerId: "u-1", departmentId: "d-1" });
    await s.create({ name: "B", ownerId: "u-1", departmentId: "d-2" });
    expect((await s.listByOwner("u-1")).length).toBe(2);
    expect((await s.listByDepartment("d-1")).length).toBe(1);
  });
});
