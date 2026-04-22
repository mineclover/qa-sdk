import { describe, expect, it, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteAuthRepository } from "./adapter.js";
import { SIM_AUTH_SQLITE_DDL } from "./schema.js";

function fixture() {
  const raw = new Database(":memory:");
  raw.exec(SIM_AUTH_SQLITE_DDL);
  return {
    repo: new SqliteAuthRepository(drizzle({ client: raw })),
    close: () => raw.close(),
  };
}

describe("SqliteAuthRepository", () => {
  let f: ReturnType<typeof fixture>;
  beforeEach(() => {
    f = fixture();
  });
  afterEach(() => {
    f.close();
  });

  it("createUser → findUser round-trip", async () => {
    const u = await f.repo.createUser({ email: "a@b.c", displayName: "A" });
    const read = await f.repo.findUser(u.id);
    expect(read?.email).toBe("a@b.c");
  });

  it("createUser duplicate email → DuplicateUserError", async () => {
    await f.repo.createUser({ email: "a@b.c", displayName: "A" });
    await expect(f.repo.createUser({ email: "a@b.c", displayName: "B" })).rejects.toThrow(
      "User already exists",
    );
  });

  it("listUsersByDepartment", async () => {
    const dept = await f.repo.createDepartment({ name: "Eng" });
    await f.repo.createUser({ email: "1@x", displayName: "u1", departmentId: dept.id });
    await f.repo.createUser({ email: "2@x", displayName: "u2", departmentId: dept.id });
    await f.repo.createUser({ email: "3@x", displayName: "u3" });
    expect((await f.repo.listUsersByDepartment(dept.id)).length).toBe(2);
  });

  it("resolveDepartmentChain — root까지", async () => {
    const root = await f.repo.createDepartment({ name: "Root" });
    const mid = await f.repo.createDepartment({ name: "Mid", parentId: root.id });
    const leaf = await f.repo.createDepartment({ name: "Leaf", parentId: mid.id });
    const chain = await f.repo.resolveDepartmentChain(leaf.id);
    expect(chain.map((d) => d.name)).toEqual(["Leaf", "Mid", "Root"]);
  });

  it("createRole + assignRole + listAssignmentsForUser", async () => {
    const role = await f.repo.createRole({ name: "admin", scopeType: "global", defaultMaskHex: "ff" });
    const u = await f.repo.createUser({ email: "x@x", displayName: "x" });
    await f.repo.assignRole({ userId: u.id, roleId: role.id, scopeType: "global", scopeId: null });
    const list = await f.repo.listAssignmentsForUser(u.id);
    expect(list[0]?.roleId).toBe(role.id);
  });

  it("assignRole에 unknown roleId → RoleNotFoundError", async () => {
    const u = await f.repo.createUser({ email: "x@x", displayName: "x" });
    await expect(
      f.repo.assignRole({ userId: u.id, roleId: "missing", scopeType: "global", scopeId: null }),
    ).rejects.toThrow("Role not found");
  });

  it("revokeRole — assignment 삭제", async () => {
    const role = await f.repo.createRole({ name: "r", scopeType: "global", defaultMaskHex: "ff" });
    const u = await f.repo.createUser({ email: "x@x", displayName: "x" });
    await f.repo.assignRole({ userId: u.id, roleId: role.id, scopeType: "global", scopeId: null });
    await f.repo.revokeRole(u.id, role.id, "global", null);
    expect((await f.repo.listAssignmentsForUser(u.id)).length).toBe(0);
  });

  it("updateUser — patch만 적용", async () => {
    const u = await f.repo.createUser({ email: "x@x", displayName: "old" });
    const updated = await f.repo.updateUser(u.id, { displayName: "new" });
    expect(updated.displayName).toBe("new");
    expect(updated.email).toBe("x@x");
  });
});
