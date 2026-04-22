import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { createDocumentRepository } from "./factory.js";
import { SIM_DOC_SQLITE_DDL } from "./sqlite/schema.js";

describe("createDocumentRepository", () => {
  it("sqlite → SqliteDocumentRepository", async () => {
    const raw = new Database(":memory:");
    raw.exec(SIM_DOC_SQLITE_DDL);
    const repo = await createDocumentRepository({ dialect: "sqlite", db: drizzle({ client: raw }) });
    const d = await repo.createDocument({ projectId: "p", title: "S", ownerId: "u" });
    expect(d.id).toBeTruthy();
    raw.close();
  });

  it("unknown → throw", async () => {
    await expect(createDocumentRepository({ dialect: "unknown" as never, db: {} as never })).rejects.toThrow(
      "지원하지 않는 dialect",
    );
  });
});
