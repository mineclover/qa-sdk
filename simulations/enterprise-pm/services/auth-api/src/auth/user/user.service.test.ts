import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteAuthRepository } from "../sqlite/adapter.js";
import { SIM_AUTH_SQLITE_DDL } from "../sqlite/schema.js";
import { UserService } from "./user.service.js";

function svc() {
  const raw = new Database(":memory:");
  raw.exec(SIM_AUTH_SQLITE_DDL);
  return new UserService(new SqliteAuthRepository(drizzle({ client: raw })));
}

describe("UserService", () => {
  it("create + find", async () => {
    const s = svc();
    const u = await s.create({ email: "a@x", displayName: "A" });
    expect((await s.find(u.id))?.email).toBe("a@x");
  });
  it("findByEmail", async () => {
    const s = svc();
    await s.create({ email: "b@x", displayName: "B" });
    expect((await s.findByEmail("b@x"))?.displayName).toBe("B");
  });
});
