// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { DocumentEntity } from "../../domain/index.js";
import { SqliteDocumentRepository } from "../persistence/document.repository.js";
import { SIM_DOC_DOCUMENT_SQLITE_DDL } from "../persistence/sqlite.schema.js";
import { SIM_DOC_OUTBOX_SQLITE_DDL } from "../../../shared/outbox/index.js";
import { createDocumentSqliteTransactionPort } from "./document.drizzle-transaction.js";
import { createDocumentOutboxPort } from "../outbox/document.outbox.js";
import { DocumentUnitOfWork } from "./document.unit-of-work.js";

function bootstrap() {
  const sqlite = new Database(":memory:");
  sqlite.exec(SIM_DOC_DOCUMENT_SQLITE_DDL);
  sqlite.exec(SIM_DOC_OUTBOX_SQLITE_DDL);
  const db = drizzle({ client: sqlite });
  const repo = new SqliteDocumentRepository(db);
  const transaction = createDocumentSqliteTransactionPort(db);
  const outbox = createDocumentOutboxPort({ dialect: "sqlite", db });
  const uow = new DocumentUnitOfWork(transaction, repo, outbox);
  return { sqlite, repo, uow };
}

describe("DocumentUnitOfWork", () => {
  it("commit: repo.save + outbox.append 가 동일 트랜잭션에서 영속", async () => {
    const { sqlite, repo, uow } = bootstrap();
    const entity = DocumentEntity.create({
      id: "doc_uow_1",
      projectId: "p",
      title: "T",
      ownerId: "u",
      now: new Date("2026-03-01T00:00:00.000Z"),
    });

    await uow.withinTransaction("document.create", async (ctx) => {
      await ctx.repository.save(entity, ctx.scope);
      await ctx.outbox.append(
        {
          aggregateId: "doc_uow_1",
          eventName: "document.created",
          eventVersion: 1,
          payload: { id: "doc_uow_1" },
          occurredAt: new Date("2026-03-01T00:00:01.000Z"),
        },
        ctx.scope,
      );
    });

    expect(await repo.findById("doc_uow_1")).not.toBeNull();
    const outboxRows = sqlite.prepare("SELECT * FROM document_outbox_events").all() as Array<{
      aggregate_id: string;
      event_name: string;
      status: string;
      scope_id: string;
    }>;
    expect(outboxRows).toHaveLength(1);
    expect(outboxRows[0].aggregate_id).toBe("doc_uow_1");
    expect(outboxRows[0].event_name).toBe("document.created");
    expect(outboxRows[0].status).toBe("pending");
    expect(outboxRows[0].scope_id).toMatch(/^document\.create:/);

    sqlite.close();
  });

  it("rollback: 핸들러 throw 시 repo + outbox 모두 미반영", async () => {
    const { sqlite, repo, uow } = bootstrap();

    await expect(
      uow.withinTransaction("document.create", async (ctx) => {
        const e = DocumentEntity.create({
          id: "doc_uow_2",
          projectId: "p",
          title: "T",
          ownerId: "u",
        });
        await ctx.repository.save(e, ctx.scope);
        await ctx.outbox.append(
          {
            aggregateId: "doc_uow_2",
            eventName: "document.created",
            eventVersion: 1,
            payload: { id: "doc_uow_2" },
            occurredAt: new Date(),
          },
          ctx.scope,
        );
        throw new Error("simulated failure");
      }),
    ).rejects.toThrow("simulated failure");

    expect(await repo.findById("doc_uow_2")).toBeNull();
    const outboxRows = sqlite.prepare("SELECT * FROM document_outbox_events").all();
    expect(outboxRows).toHaveLength(0);
    sqlite.close();
  });
});
