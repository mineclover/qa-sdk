// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { RoleEntity } from "../../domain/index.js";
import { SqliteRoleRepository, createRoleRepository } from "./role.repository.js";
import { SIM_AUTH_ROLE_SQLITE_DDL } from "./sqlite.schema.js";
import * as pgSchemaModule from "./pg.schema.js";
import * as sqliteSchemaModule from "./sqlite.schema.js";
import type { RoleTransactionScope } from "../../application/ports/role-transaction.port.js";

function scope(): RoleTransactionScope {
  return { id: "tx-test", startedAt: new Date() };
}

describe("SqliteRoleRepository", () => {
  it("save 후 findById 라운드트립", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_AUTH_ROLE_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteRoleRepository(db);
    const e = RoleEntity.create({
      id: "role_1",
      name: "admin",
      scopeType: "global",
      defaultMaskHex: "ffff",
    });
    await repo.save(e, scope());
    const found = await repo.findById("role_1");
    expect(found!.toSnapshot()).toEqual(e.toSnapshot());
    sqlite.close();
  });

  it("findByName 라운드트립", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_AUTH_ROLE_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteRoleRepository(db);
    await repo.save(
      RoleEntity.create({ id: "r1", name: "admin", scopeType: "global", defaultMaskHex: "ff" }),
      scope(),
    );
    expect((await repo.findByName("admin"))!.id).toBe("r1");
    sqlite.close();
  });

  it("list", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_AUTH_ROLE_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteRoleRepository(db);
    await repo.save(
      RoleEntity.create({ id: "r1", name: "admin", scopeType: "global", defaultMaskHex: "ff" }),
      scope(),
    );
    await repo.save(
      RoleEntity.create({ id: "r2", name: "member", scopeType: "project", defaultMaskHex: "0f" }),
      scope(),
    );
    expect((await repo.list()).length).toBe(2);
    sqlite.close();
  });

  it("delete", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_AUTH_ROLE_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteRoleRepository(db);
    await repo.save(
      RoleEntity.create({ id: "r1", name: "admin", scopeType: "global", defaultMaskHex: "ff" }),
      scope(),
    );
    await repo.delete("r1", scope());
    expect(await repo.findById("r1")).toBeNull();
    sqlite.close();
  });
});

describe("dialect symmetry", () => {
  it("sqlite/pg 동일 컬럼셋", () => {
    const sqliteCols = Object.keys(sqliteSchemaModule.roles);
    const pgCols = Object.keys(pgSchemaModule.roles);
    for (const c of ["id", "name", "scopeType", "defaultMaskHex", "createdAt"]) {
      expect(sqliteCols).toContain(c);
      expect(pgCols).toContain(c);
    }
  });
});

describe("createRoleRepository", () => {
  it("알 수 없는 dialect 는 예외", () => {
    expect(() => createRoleRepository({ dialect: "x" as never, db: {} as never })).toThrow();
  });
});
