// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { TimeOffEntity } from "../../domain/index.js";
import { SqliteTimeOffRepository, createTimeOffRepository } from "./timeoff.repository.js";
import { SIM_APPROVAL_TIMEOFF_SQLITE_DDL } from "./sqlite.schema.js";
import type { TimeOffTransactionScope } from "../../application/ports/timeoff-transaction.port.js";

function scope(): TimeOffTransactionScope {
  return { id: "tx", startedAt: new Date() };
}

describe("SqliteTimeOffRepository", () => {
  it("save + findById 라운드트립", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_APPROVAL_TIMEOFF_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    const repo = new SqliteTimeOffRepository(db);
    const e = TimeOffEntity.create({
      id: "tof_1",
      requesterId: "u",
      startDate: "2026-05-01",
      endDate: "2026-05-03",
      reason: "vacation",
      now: new Date("2026-04-01T00:00:00.000Z"),
    });
    await repo.save(e, scope());
    expect((await repo.findById("tof_1"))!.toSnapshot()).toEqual(e.toSnapshot());
    sqlite.close();
  });
});

describe("createTimeOffRepository", () => {
  it("sqlite", () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(SIM_APPROVAL_TIMEOFF_SQLITE_DDL);
    const db = drizzle({ client: sqlite });
    expect(createTimeOffRepository({ dialect: "sqlite", db })).toBeInstanceOf(SqliteTimeOffRepository);
    sqlite.close();
  });
  it("unknown → throw", () => {
    expect(() =>
      createTimeOffRepository({ dialect: "x" as never, db: {} as never }),
    ).toThrow();
  });
});
