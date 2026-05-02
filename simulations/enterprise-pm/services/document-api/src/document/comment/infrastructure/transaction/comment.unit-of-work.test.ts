// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { CommentEntity } from "../../domain/index.js";
import { SqliteCommentRepository } from "../persistence/comment.repository.js";
import { SIM_DOC_COMMENT_SQLITE_DDL } from "../persistence/sqlite.schema.js";
import { SIM_DOC_OUTBOX_SQLITE_DDL } from "../../../shared/outbox/index.js";
import { createCommentSqliteTransactionPort } from "./comment.drizzle-transaction.js";
import { createCommentOutboxPort } from "../outbox/comment.outbox.js";
import { CommentUnitOfWork } from "./comment.unit-of-work.js";

function bootstrap() {
  const sqlite = new Database(":memory:");
  sqlite.exec(SIM_DOC_COMMENT_SQLITE_DDL);
  sqlite.exec(SIM_DOC_OUTBOX_SQLITE_DDL);
  const db = drizzle({ client: sqlite });
  const repo = new SqliteCommentRepository(db);
  const transaction = createCommentSqliteTransactionPort(db);
  const outbox = createCommentOutboxPort({ dialect: "sqlite", db });
  return { sqlite, repo, uow: new CommentUnitOfWork(transaction, repo, outbox) };
}

describe("CommentUnitOfWork", () => {
  it("commit: comment + shared outbox 동일 트랜잭션 영속", async () => {
    const { sqlite, repo, uow } = bootstrap();
    const e = CommentEntity.create({
      id: "uw_1",
      documentId: "doc_1",
      authorId: "u",
      body: "hi",
    });
    await uow.withinTransaction("comment.create", async (ctx) => {
      await ctx.repository.save(e, ctx.scope);
      await ctx.outbox.append(
        {
          aggregateId: "uw_1",
          eventName: "comment.created",
          eventVersion: 1,
          payload: { id: "uw_1" },
          occurredAt: new Date(),
        },
        ctx.scope,
      );
    });
    expect(await repo.findById("uw_1")).not.toBeNull();
    const rows = sqlite.prepare("SELECT * FROM document_outbox_events").all();
    expect(rows).toHaveLength(1);
    sqlite.close();
  });

  it("rollback 시 comment + outbox 모두 미반영", async () => {
    const { sqlite, repo, uow } = bootstrap();
    await expect(
      uow.withinTransaction("comment.create", async (ctx) => {
        await ctx.repository.save(
          CommentEntity.create({ id: "uw_2", documentId: "d", authorId: "u", body: "x" }),
          ctx.scope,
        );
        await ctx.outbox.append(
          {
            aggregateId: "uw_2",
            eventName: "comment.created",
            eventVersion: 1,
            payload: {},
            occurredAt: new Date(),
          },
          ctx.scope,
        );
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await repo.findById("uw_2")).toBeNull();
    const rows = sqlite.prepare("SELECT * FROM document_outbox_events").all();
    expect(rows).toHaveLength(0);
    sqlite.close();
  });
});
