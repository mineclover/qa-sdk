// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { buildIdempotencyKey } from "sim-identifier-grammar";
import { VersionEntity } from "../../domain/index.js";
import { SqliteVersionRepository } from "../persistence/version.repository.js";
import { SIM_DOC_VERSION_SQLITE_DDL } from "../persistence/sqlite.schema.js";
import { SIM_DOC_OUTBOX_SQLITE_DDL } from "../../../shared/outbox/index.js";
import { toGrammarSafeAggregateId } from "../../../shared/outbox/idempotency-key-source.js";
import { createVersionSqliteTransactionPort } from "./version.drizzle-transaction.js";
import { createVersionOutboxPort } from "../outbox/version.outbox.js";
import { VersionUnitOfWork } from "./version.unit-of-work.js";

function bootstrap() {
  const sqlite = new Database(":memory:");
  sqlite.exec(SIM_DOC_VERSION_SQLITE_DDL);
  sqlite.exec(SIM_DOC_OUTBOX_SQLITE_DDL);
  const db = drizzle({ client: sqlite });
  const repo = new SqliteVersionRepository(db);
  const transaction = createVersionSqliteTransactionPort(db);
  const outbox = createVersionOutboxPort({ dialect: "sqlite", db });
  return { sqlite, repo, uow: new VersionUnitOfWork(transaction, repo, outbox) };
}

describe("VersionUnitOfWork", () => {
  it("commit: version + shared outbox 동일 트랜잭션", async () => {
    const { sqlite, repo, uow } = bootstrap();
    const e = VersionEntity.create({
      documentId: "doc_1",
      versionNumber: 1,
      contentRef: "k",
      authorId: "u",
    });
    await uow.withinTransaction("version.create", async (ctx) => {
      await ctx.repository.save(e, ctx.scope);
      const occurredAt = new Date();
      const eventName = "version.created";
      const idempotencyEventName = "document.version.created";
      await ctx.outbox.append(
        {
          aggregateId: "doc_1",
          eventName,
          eventVersion: 1,
          payload: { documentId: "doc_1", versionNumber: 1 },
          occurredAt,
          idempotencyKey: buildIdempotencyKey({
            aggregateId: toGrammarSafeAggregateId("doc_1"),
            eventName: idempotencyEventName,
            occurredAt,
          }),
        },
        ctx.scope,
      );
    });
    expect(await repo.findByKey("doc_1", 1)).not.toBeNull();
    const rows = sqlite.prepare("SELECT * FROM document_outbox_events").all();
    expect(rows).toHaveLength(1);
    sqlite.close();
  });

  it("rollback 시 version + outbox 모두 미반영", async () => {
    const { sqlite, repo, uow } = bootstrap();
    await expect(
      uow.withinTransaction("version.create", async (ctx) => {
        await ctx.repository.save(
          VersionEntity.create({
            documentId: "doc_2",
            versionNumber: 1,
            contentRef: "k",
            authorId: "u",
          }),
          ctx.scope,
        );
        const occurredAt = new Date();
        const eventName = "version.created";
        const idempotencyEventName = "document.version.created";
        await ctx.outbox.append(
          {
            aggregateId: "doc_2",
            eventName,
            eventVersion: 1,
            payload: {},
            occurredAt,
            idempotencyKey: buildIdempotencyKey({
              aggregateId: toGrammarSafeAggregateId("doc_2"),
              eventName: idempotencyEventName,
              occurredAt,
            }),
          },
          ctx.scope,
        );
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await repo.findByKey("doc_2", 1)).toBeNull();
    expect(sqlite.prepare("SELECT * FROM document_outbox_events").all()).toHaveLength(0);
    sqlite.close();
  });
});
