import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqlitePmRepository } from "../sqlite/adapter.js";
import { SIM_PM_SQLITE_DDL } from "../sqlite/schema.js";
import { MemberService } from "./member.service.js";

function svc() {
  const raw = new Database(":memory:");
  raw.exec(SIM_PM_SQLITE_DDL);
  return new MemberService(new SqlitePmRepository(drizzle({ client: raw })));
}

describe("MemberService", () => {
  it("add + listForProject", async () => {
    const s = svc();
    await s.add({ projectId: "p-1", userId: "u-1", role: "lead" });
    await s.add({ projectId: "p-1", userId: "u-2", role: "contributor" });
    expect((await s.listForProject("p-1")).length).toBe(2);
  });
  it("listForUser", async () => {
    const s = svc();
    await s.add({ projectId: "p-1", userId: "u-1", role: "lead" });
    await s.add({ projectId: "p-2", userId: "u-1", role: "contributor" });
    expect((await s.listForUser("u-1")).length).toBe(2);
  });
});
