import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteDocumentRepository } from "../sqlite/adapter.js";
import { SIM_DOC_SQLITE_DDL } from "../sqlite/schema.js";
import { DocumentService } from "./document.service.js";

function svc() {
  const raw = new Database(":memory:");
  raw.exec(SIM_DOC_SQLITE_DDL);
  return new DocumentService(new SqliteDocumentRepository(drizzle({ client: raw })));
}

describe("DocumentService", () => {
  it("create + find", async () => {
    const s = svc();
    const d = await s.create({ projectId: "p", title: "T", ownerId: "u" });
    expect((await s.find(d.id))?.title).toBe("T");
  });
});
