import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteAuthRepository } from "../sqlite/adapter.js";
import { SIM_AUTH_SQLITE_DDL } from "../sqlite/schema.js";
import { DepartmentService } from "./department.service.js";

function svc() {
  const raw = new Database(":memory:");
  raw.exec(SIM_AUTH_SQLITE_DDL);
  return new DepartmentService(new SqliteAuthRepository(drizzle({ client: raw })));
}

describe("DepartmentService", () => {
  it("create + find", async () => {
    const s = svc();
    const d = await s.create({ name: "Eng" });
    expect((await s.find(d.id))?.name).toBe("Eng");
  });
  it("chain — parent traversal", async () => {
    const s = svc();
    const root = await s.create({ name: "Root" });
    const mid = await s.create({ name: "Mid", parentId: root.id });
    const leaf = await s.create({ name: "Leaf", parentId: mid.id });
    const chain = await s.chain(leaf.id);
    expect(chain.map((d) => d.name)).toEqual(["Leaf", "Mid", "Root"]);
  });
});
