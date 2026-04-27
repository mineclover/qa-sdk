// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { ResourceEntity } from "../../domain/index.js";
import { SqliteResourceRepository, createResourceRepository } from "./resource.repository.js";
import { SIM_APPROVAL_RESOURCE_SQLITE_DDL } from "./sqlite.schema.js";
import type { ResourceTransactionScope } from "../../application/ports/resource-transaction.port.js";

function scope(): ResourceTransactionScope {
  return { id: "tx", startedAt: new Date() };
}

describe("SqliteResourceRepository", () => {
  it("save + findById 라운드트립", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_APPROVAL_RESOURCE_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteResourceRepository(db);
    const e = ResourceEntity.create({
      id: "rsr_1",
      projectId: "p",
      requesterId: "u",
      resourceType: "consultant",
      description: "x",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    await repo.save(e, scope());
    expect((await repo.findById("rsr_1"))!.toSnapshot()).toEqual(e.toSnapshot());
    sqlite.close();
  });
});

describe("createResourceRepository", () => {
  it("sqlite", () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_APPROVAL_RESOURCE_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    expect(createResourceRepository({ dialect: "sqlite", db })).toBeInstanceOf(SqliteResourceRepository);
    sqlite.close();
  });
  it("unknown → throw", () => {
    expect(() =>
      createResourceRepository({ dialect: "x" as never, db: {} as never }),
    ).toThrow();
  });
});
