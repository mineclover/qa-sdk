import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteAuthRepository } from "../sqlite/adapter.js";
import { SIM_AUTH_SQLITE_DDL } from "../sqlite/schema.js";
import { RoleService } from "./role.service.js";

function svc() {
  const raw = new Database(":memory:");
  raw.exec(SIM_AUTH_SQLITE_DDL);
  return new RoleService(new SqliteAuthRepository(drizzle({ client: raw })));
}

describe("RoleService", () => {
  it("create + find", async () => {
    const s = svc();
    const r = await s.create({ name: "admin", scopeType: "global", defaultMaskHex: "ff" });
    expect((await s.find(r.id))?.name).toBe("admin");
  });
  it("list 전체 반환", async () => {
    const s = svc();
    await s.create({ name: "r1", scopeType: "global", defaultMaskHex: "ff" });
    await s.create({ name: "r2", scopeType: "department", defaultMaskHex: "aa" });
    expect((await s.list()).length).toBe(2);
  });
});
