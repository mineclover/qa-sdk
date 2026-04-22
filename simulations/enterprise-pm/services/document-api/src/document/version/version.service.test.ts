import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteDocumentRepository } from "../sqlite/adapter.js";
import { SIM_DOC_SQLITE_DDL } from "../sqlite/schema.js";
import { VersionService } from "./version.service.js";

function fixture() {
  const raw = new Database(":memory:");
  raw.exec(SIM_DOC_SQLITE_DDL);
  const repo = new SqliteDocumentRepository(drizzle({ client: raw }));
  return { repo, svc: new VersionService(repo) };
}

describe("VersionService", () => {
  it("create + list", async () => {
    const { repo, svc } = fixture();
    const d = await repo.createDocument({ projectId: "p", title: "T", ownerId: "u" });
    await svc.create({ documentId: d.id, contentRef: "k1", authorId: "u" });
    await svc.create({ documentId: d.id, contentRef: "k2", authorId: "u" });
    expect((await svc.list(d.id)).length).toBe(2);
  });
});
