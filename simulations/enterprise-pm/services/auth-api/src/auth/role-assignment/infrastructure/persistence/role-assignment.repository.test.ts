// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { RoleAssignmentEntity } from "../../domain/index.js";
import {
  SqliteRoleAssignmentRepository,
  createRoleAssignmentRepository,
} from "./role-assignment.repository.js";
import { SIM_AUTH_ROLE_ASSIGNMENT_SQLITE_DDL } from "./sqlite.schema.js";
import * as sqliteSchemaModule from "./sqlite.schema.js";
import * as pgSchemaModule from "./pg.schema.js";
import type { RoleAssignmentTransactionScope } from "../../application/ports/role-assignment-transaction.port.js";

function scope(): RoleAssignmentTransactionScope {
  return { id: "tx-test", startedAt: new Date() };
}

describe("SqliteRoleAssignmentRepository", () => {
  it("save 후 findOne 라운드트립", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_AUTH_ROLE_ASSIGNMENT_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteRoleAssignmentRepository(db);
    const ra = RoleAssignmentEntity.create({
      userId: "u1",
      roleId: "r1",
      scopeType: "global",
      scopeId: null,
    });
    await repo.save(ra, scope());
    const found = await repo.findOne("u1", "r1", "global", null);
    expect(found!.toSnapshot()).toEqual(ra.toSnapshot());
    sqlite.close();
  });

  it("listForUser", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_AUTH_ROLE_ASSIGNMENT_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteRoleAssignmentRepository(db);
    await repo.save(
      RoleAssignmentEntity.create({ userId: "u1", roleId: "r1", scopeType: "global", scopeId: null }),
      scope(),
    );
    await repo.save(
      RoleAssignmentEntity.create({
        userId: "u1",
        roleId: "r2",
        scopeType: "department",
        scopeId: "d1",
      }),
      scope(),
    );
    expect((await repo.listForUser("u1")).length).toBe(2);
    sqlite.close();
  });

  it("delete", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_AUTH_ROLE_ASSIGNMENT_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteRoleAssignmentRepository(db);
    await repo.save(
      RoleAssignmentEntity.create({ userId: "u1", roleId: "r1", scopeType: "global", scopeId: null }),
      scope(),
    );
    await repo.delete("u1", "r1", "global", null, scope());
    expect((await repo.listForUser("u1")).length).toBe(0);
    sqlite.close();
  });
});

describe("dialect symmetry", () => {
  it("sqlite/pg 동일 컬럼", () => {
    const sqliteCols = Object.keys(sqliteSchemaModule.roleAssignments);
    const pgCols = Object.keys(pgSchemaModule.roleAssignments);
    for (const c of ["userId", "roleId", "scopeType", "scopeId", "assignedAt"]) {
      expect(sqliteCols).toContain(c);
      expect(pgCols).toContain(c);
    }
  });
});

describe("createRoleAssignmentRepository", () => {
  it("알 수 없는 dialect 는 예외", () => {
    expect(() => createRoleAssignmentRepository({ dialect: "x" as never, db: {} as never })).toThrow();
  });
});
