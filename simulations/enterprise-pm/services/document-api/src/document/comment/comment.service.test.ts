import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteDocumentRepository } from "../sqlite/adapter.js";
import { SIM_DOC_SQLITE_DDL } from "../sqlite/schema.js";
import { CommentService } from "./comment.service.js";

function svc() {
  const raw = new Database(":memory:");
  raw.exec(SIM_DOC_SQLITE_DDL);
  return new CommentService(new SqliteDocumentRepository(drizzle({ client: raw })));
}

describe("CommentService", () => {
  it("create + listForDocument", async () => {
    const s = svc();
    await s.create({ documentId: "d", authorId: "u", body: "a" });
    await s.create({ documentId: "d", authorId: "u", body: "b" });
    expect((await s.listForDocument("d")).length).toBe(2);
  });
});
