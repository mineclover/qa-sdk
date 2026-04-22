import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { createAuthRepository } from "./factory.js";
import { SIM_AUTH_SQLITE_DDL } from "./sqlite/schema.js";

describe("createAuthRepository", () => {
  it("sqlite dialect → SqliteAuthRepository 인스턴스", async () => {
    const raw = new Database(":memory:");
    raw.exec(SIM_AUTH_SQLITE_DDL);
    const repo = await createAuthRepository({
      dialect: "sqlite",
      db: drizzle({ client: raw }),
    });
    const u = await repo.createUser({ email: "f@x", displayName: "f" });
    expect(u.id).toBeTruthy();
    raw.close();
  });

  it("unknown dialect → throw", async () => {
    await expect(
      createAuthRepository({ dialect: "unknown" as never, db: {} as never }),
    ).rejects.toThrow("지원하지 않는 dialect");
  });
});
