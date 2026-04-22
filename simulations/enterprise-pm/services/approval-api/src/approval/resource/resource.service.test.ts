import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteApprovalRepository } from "../sqlite/adapter.js";
import { SIM_APPROVAL_SQLITE_DDL } from "../sqlite/schema.js";
import { ResourceService } from "./resource.service.js";

function svc() {
  const raw = new Database(":memory:");
  raw.exec(SIM_APPROVAL_SQLITE_DDL);
  return new ResourceService(new SqliteApprovalRepository(drizzle({ client: raw })));
}

describe("ResourceService", () => {
  it("create + find", async () => {
    const s = svc();
    const r = await s.create({ projectId: "p", requesterId: "u", resourceType: "laptop", description: "x" });
    expect((await s.find(r.id))?.resourceType).toBe("laptop");
  });
  it("updateStatus", async () => {
    const s = svc();
    const r = await s.create({ projectId: "p", requesterId: "u", resourceType: "x", description: "y" });
    const next = await s.updateStatus(r.id, "approved");
    expect(next.status).toBe("approved");
  });
});
