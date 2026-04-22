import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteApprovalRepository } from "../sqlite/adapter.js";
import { SIM_APPROVAL_SQLITE_DDL } from "../sqlite/schema.js";
import { ExpenseService } from "./expense.service.js";

function svc() {
  const raw = new Database(":memory:");
  raw.exec(SIM_APPROVAL_SQLITE_DDL);
  return new ExpenseService(new SqliteApprovalRepository(drizzle({ client: raw })));
}

describe("ExpenseService", () => {
  it("create + updateStatus", async () => {
    const s = svc();
    const r = await s.create({ requesterId: "u", amount: 10_000, category: "meal", description: "x" });
    const next = await s.updateStatus(r.id, "approved");
    expect(next.status).toBe("approved");
  });
});
