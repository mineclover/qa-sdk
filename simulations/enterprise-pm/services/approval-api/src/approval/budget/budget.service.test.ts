import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteApprovalRepository } from "../sqlite/adapter.js";
import { SIM_APPROVAL_SQLITE_DDL } from "../sqlite/schema.js";
import { BudgetService } from "./budget.service.js";

function svc() {
  const raw = new Database(":memory:");
  raw.exec(SIM_APPROVAL_SQLITE_DDL);
  return new BudgetService(new SqliteApprovalRepository(drizzle({ client: raw })));
}

describe("BudgetService", () => {
  it("create amount=500K → totalStages=1", async () => {
    const s = svc();
    const br = await s.create({ projectId: "p", amount: 500_000, requesterId: "u" });
    expect(br.totalStages).toBe(1);
  });

  it("submit → submitted", async () => {
    const s = svc();
    const br = await s.create({ projectId: "p", amount: 500_000, requesterId: "u" });
    const next = await s.submit(br.id);
    expect(next.status).toBe("submitted");
  });

  it("decide approved 1단계 → approved (1-stage)", async () => {
    const s = svc();
    const br = await s.create({ projectId: "p", amount: 500_000, requesterId: "u" });
    await s.submit(br.id);
    await s.startReview(br.id);
    const final = await s.decide(br.id, "mgr-1", "approved");
    expect(final.status).toBe("approved");
  });

  it("decide rejected → rejected (즉시)", async () => {
    const s = svc();
    const br = await s.create({ projectId: "p", amount: 20_000_000, requesterId: "u" });
    await s.submit(br.id);
    await s.startReview(br.id);
    const final = await s.decide(br.id, "mgr-1", "rejected");
    expect(final.status).toBe("rejected");
  });
});
