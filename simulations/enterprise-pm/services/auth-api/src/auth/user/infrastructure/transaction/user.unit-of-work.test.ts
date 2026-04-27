// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { UserEntity } from "../../domain/index.js";
import { SqliteUserRepository } from "../persistence/user.repository.js";
import { SIM_AUTH_USER_SQLITE_DDL } from "../persistence/sqlite.schema.js";
import { SIM_AUTH_OUTBOX_SQLITE_DDL } from "../../../_outbox/auth-outbox.schema.js";
import { createUserSqliteTransactionPort } from "./user.drizzle-transaction.js";
import { createUserOutboxPort } from "../outbox/user.outbox.js";
import { UserUnitOfWork } from "./user.unit-of-work.js";

function bootstrap() {
  const sqlite = new Database(":memory:");
  sqlite.exec(SIM_AUTH_USER_SQLITE_DDL);
  sqlite.exec(SIM_AUTH_OUTBOX_SQLITE_DDL);
  const db = drizzle({ client: sqlite });
  const repo = new SqliteUserRepository(db);
  const transaction = createUserSqliteTransactionPort(db);
  const outbox = createUserOutboxPort({ dialect: "sqlite", db });
  const uow = new UserUnitOfWork(transaction, repo, outbox);
  return { sqlite, db, repo, uow };
}

describe("UserUnitOfWork", () => {
  it("commit: repo.save + outbox.append 가 동일 트랜잭션에서 영속된다", async () => {
    const { sqlite, repo, uow } = bootstrap();
    const entity = UserEntity.create({
      id: "u_uow_1",
      email: "uow1@x",
      displayName: "UOW1",
      now: new Date("2026-03-01T00:00:00.000Z"),
    });

    await uow.withinTransaction("user.create", async (ctx) => {
      await ctx.repository.save(entity, ctx.scope);
      await ctx.outbox.append(
        {
          aggregateId: "u_uow_1",
          eventName: "user.created",
          eventVersion: 1,
          payload: { id: "u_uow_1" },
          occurredAt: new Date("2026-03-01T00:00:01.000Z"),
        },
        ctx.scope,
      );
    });

    const found = await repo.findById("u_uow_1");
    expect(found).not.toBeNull();
    const outboxRows = sqlite.prepare("SELECT * FROM auth_outbox_events").all() as Array<{
      aggregate_id: string;
      event_name: string;
      event_version: number;
      status: string;
      scope_id: string;
    }>;
    expect(outboxRows).toHaveLength(1);
    expect(outboxRows[0].aggregate_id).toBe("u_uow_1");
    expect(outboxRows[0].event_name).toBe("user.created");
    expect(outboxRows[0].status).toBe("pending");
    expect(outboxRows[0].scope_id).toMatch(/^user\.create:/);

    sqlite.close();
  });

  it("rollback: 핸들러 throw 시 repo + outbox 모두 미반영", async () => {
    const { sqlite, repo, uow } = bootstrap();

    await expect(
      uow.withinTransaction("user.create", async (ctx) => {
        const e = UserEntity.create({ id: "u_uow_2", email: "uow2@x", displayName: "UOW2" });
        await ctx.repository.save(e, ctx.scope);
        await ctx.outbox.append(
          {
            aggregateId: "u_uow_2",
            eventName: "user.created",
            eventVersion: 1,
            payload: { id: "u_uow_2" },
            occurredAt: new Date(),
          },
          ctx.scope,
        );
        throw new Error("simulated failure");
      }),
    ).rejects.toThrow("simulated failure");

    expect(await repo.findById("u_uow_2")).toBeNull();
    const outboxRows = sqlite.prepare("SELECT * FROM auth_outbox_events").all();
    expect(outboxRows).toHaveLength(0);
    sqlite.close();
  });
});
