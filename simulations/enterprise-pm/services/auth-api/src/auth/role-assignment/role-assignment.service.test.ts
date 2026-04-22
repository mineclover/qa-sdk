import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteAuthRepository } from "../sqlite/adapter.js";
import { SIM_AUTH_SQLITE_DDL } from "../sqlite/schema.js";
import { RoleAssignmentService } from "./role-assignment.service.js";

function fixture() {
  const raw = new Database(":memory:");
  raw.exec(SIM_AUTH_SQLITE_DDL);
  const repo = new SqliteAuthRepository(drizzle({ client: raw }));
  return { repo, svc: new RoleAssignmentService(repo) };
}

describe("RoleAssignmentService", () => {
  it("assign + listForUser", async () => {
    const { repo, svc } = fixture();
    const u = await repo.createUser({ email: "x@x", displayName: "x" });
    const r = await repo.createRole({ name: "admin", scopeType: "global", defaultMaskHex: "ff" });
    await svc.assign({ userId: u.id, roleId: r.id, scopeType: "global", scopeId: null });
    expect((await svc.listForUser(u.id))[0]?.roleId).toBe(r.id);
  });

  it("revoke — 삭제 후 list 비어있음", async () => {
    const { repo, svc } = fixture();
    const u = await repo.createUser({ email: "x@x", displayName: "x" });
    const r = await repo.createRole({ name: "admin", scopeType: "global", defaultMaskHex: "ff" });
    await svc.assign({ userId: u.id, roleId: r.id, scopeType: "global", scopeId: null });
    await svc.revoke(u.id, r.id, "global", null);
    expect((await svc.listForUser(u.id)).length).toBe(0);
  });
});
