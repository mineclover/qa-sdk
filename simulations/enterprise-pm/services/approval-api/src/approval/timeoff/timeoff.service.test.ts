import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteApprovalRepository } from "../sqlite/adapter.js";
import { SIM_APPROVAL_SQLITE_DDL } from "../sqlite/schema.js";
import { TimeOffService } from "./timeoff.service.js";

function svc() {
  const raw = new Database(":memory:");
  raw.exec(SIM_APPROVAL_SQLITE_DDL);
  return new TimeOffService(new SqliteApprovalRepository(drizzle({ client: raw })));
}

describe("TimeOffService", () => {
  it("create + updateStatus", async () => {
    const s = svc();
    const r = await s.create({ requesterId: "u", startDate: "2026-05-01", endDate: "2026-05-03", reason: "v" });
    const next = await s.updateStatus(r.id, "approved");
    expect(next.status).toBe("approved");
  });
});
