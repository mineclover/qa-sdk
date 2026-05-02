// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { buildIdempotencyKey } from "sim-identifier-grammar";
import { RoleEntity } from "../../domain/index.js";
import { SqliteRoleRepository } from "../persistence/role.repository.js";
import { SIM_AUTH_ROLE_SQLITE_DDL } from "../persistence/sqlite.schema.js";
import { SIM_AUTH_OUTBOX_SQLITE_DDL } from "../../../_outbox/auth-outbox.schema.js";
import { toGrammarSafeAggregateId } from "../../../_outbox/idempotency-key-source.js";
import { createRoleSqliteTransactionPort } from "./role.drizzle-transaction.js";
import { createRoleOutboxPort } from "../outbox/role.outbox.js";
import { RoleUnitOfWork } from "./role.unit-of-work.js";

function bootstrap() {
  const sqlite = new Database(":memory:");
  sqlite.exec(SIM_AUTH_ROLE_SQLITE_DDL);
  sqlite.exec(SIM_AUTH_OUTBOX_SQLITE_DDL);
  const db = drizzle({ client: sqlite });
  const repo = new SqliteRoleRepository(db);
  const transaction = createRoleSqliteTransactionPort(db);
  const outbox = createRoleOutboxPort({ dialect: "sqlite", db });
  const uow = new RoleUnitOfWork(transaction, repo, outbox);
  return { sqlite, db, repo, uow };
}

describe("RoleUnitOfWork", () => {
  it("commit: repo.save + outbox.append", async () => {
    const { sqlite, repo, uow } = bootstrap();
    const e = RoleEntity.create({
      id: "r_uow_1",
      name: "manager",
      scopeType: "department",
      defaultMaskHex: "ffff",
    });
    const eventName = "auth.role.created";
    const occurredAt = new Date();
    await uow.withinTransaction("role.create", async (ctx) => {
      await ctx.repository.save(e, ctx.scope);
      await ctx.outbox.append(
        {
          aggregateId: "r_uow_1",
          eventName,
          eventVersion: 1,
          payload: { id: "r_uow_1" },
          occurredAt,
          idempotencyKey: buildIdempotencyKey({
            aggregateId: toGrammarSafeAggregateId("r_uow_1"),
            eventName,
            occurredAt,
          }),
        },
        ctx.scope,
      );
    });
    expect(await repo.findById("r_uow_1")).not.toBeNull();
    const rows = sqlite.prepare("SELECT * FROM auth_outbox_events").all();
    expect(rows).toHaveLength(1);
    sqlite.close();
  });

  it("rollback: throw 시 미반영", async () => {
    const { sqlite, repo, uow } = bootstrap();
    await expect(
      uow.withinTransaction("role.create", async (ctx) => {
        await ctx.repository.save(
          RoleEntity.create({ id: "r_uow_2", name: "x", scopeType: "global", defaultMaskHex: "ff" }),
          ctx.scope,
        );
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await repo.findById("r_uow_2")).toBeNull();
    sqlite.close();
  });
});
