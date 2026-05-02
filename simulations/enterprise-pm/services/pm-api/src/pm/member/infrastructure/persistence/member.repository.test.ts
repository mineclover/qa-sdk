// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { MemberEntity } from "../../domain/index.js";
import {
  SqliteMemberRepository,
  createMemberRepository,
} from "./member.repository.js";
import { SIM_PM_SQLITE_DDL } from "../../../sqlite/schema.js";
import type { MemberTransactionScope } from "../../application/ports/member-transaction.port.js";

function makeScope(): MemberTransactionScope {
  return { id: "tx-test", startedAt: new Date() };
}

describe("SqliteMemberRepository", () => {
  it("save 후 findById 라운드트립", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_PM_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteMemberRepository(db);
    const e = MemberEntity.create({
      projectId: "prj_1",
      userId: "u_1",
      role: "lead",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    await repo.save(e, makeScope());

    const found = await repo.findById("prj_1", "u_1");
    expect(found?.role).toBe("lead");
    sqlite.close();
  });

  it("listForProject + listForUser", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_PM_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteMemberRepository(db);
    await repo.save(
      MemberEntity.create({ projectId: "prj_1", userId: "u_1", role: "lead" }),
      makeScope(),
    );
    await repo.save(
      MemberEntity.create({ projectId: "prj_1", userId: "u_2", role: "contributor" }),
      makeScope(),
    );
    await repo.save(
      MemberEntity.create({ projectId: "prj_2", userId: "u_1", role: "viewer" }),
      makeScope(),
    );

    expect((await repo.listForProject("prj_1")).length).toBe(2);
    expect((await repo.listForUser("u_1")).length).toBe(2);
    sqlite.close();
  });

  it("delete — composite key", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_PM_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteMemberRepository(db);
    const e = MemberEntity.create({ projectId: "prj_1", userId: "u_1", role: "lead" });
    await repo.save(e, makeScope());
    await repo.delete("prj_1", "u_1", makeScope());
    expect(await repo.findById("prj_1", "u_1")).toBeNull();
    sqlite.close();
  });
});

describe("createMemberRepository factory", () => {
  it("sqlite dialect → SqliteMemberRepository", () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_PM_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const r = createMemberRepository({ dialect: "sqlite", db });
    expect(r).toBeInstanceOf(SqliteMemberRepository);
    sqlite.close();
  });

  it("알 수 없는 dialect 는 예외", () => {
    expect(() => createMemberRepository({ dialect: "mysql" as never, db: {} as never })).toThrow();
  });
});
