import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { createApprovalRepository } from "./factory.js";
import { SIM_APPROVAL_SQLITE_DDL } from "./sqlite/schema.js";

describe("createApprovalRepository", () => {
  it("sqlite dialect → SqliteApprovalRepository", async () => {
    const raw = new Database(":memory:");
    raw.exec(SIM_APPROVAL_SQLITE_DDL);
    const repo = await createApprovalRepository({ dialect: "sqlite", db: drizzle({ client: raw }) });
    const br = await repo.createBudgetRequest({ projectId: "p", amount: 500_000, requesterId: "u" });
    expect(br.id).toBeTruthy();
    raw.close();
  });

  it("unknown dialect → throw", async () => {
    await expect(createApprovalRepository({ dialect: "unknown" as never, db: {} as never })).rejects.toThrow(
      "지원하지 않는 dialect",
    );
  });
});
