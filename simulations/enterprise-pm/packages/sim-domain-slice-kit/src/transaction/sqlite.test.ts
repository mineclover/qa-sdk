// @def.boundary sim-domain-slice-kit
// @def.doc domain-slice-architecture

import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import { createSqliteTransactionPort } from "./sqlite.js";

describe("createSqliteTransactionPort", () => {
  async function freshDb() {
    const sqlite = new Database(":memory:");
    const db = drizzle(sqlite);
    await db.run(sql`CREATE TABLE items (id TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    return db;
  }

  it("commits work when handler resolves", async () => {
    const db = await freshDb();
    const port = createSqliteTransactionPort(db, sql);
    const result = await port.run("test.commit", async (scope) => {
      expect(scope.id.startsWith("test.commit:")).toBe(true);
      expect(scope.startedAt).toBeInstanceOf(Date);
      await db.run(sql`INSERT INTO items (id, value) VALUES ('a', 'x')`);
      return "ok";
    });
    expect(result).toBe("ok");
    const rows = await db.all<{ id: string; value: string }>(sql`SELECT * FROM items`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ id: "a", value: "x" });
  });

  it("rolls back when handler throws", async () => {
    const db = await freshDb();
    const port = createSqliteTransactionPort(db, sql);
    await expect(
      port.run("test.rollback", async () => {
        await db.run(sql`INSERT INTO items (id, value) VALUES ('b', 'y')`);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const rows = await db.all<{ id: string; value: string }>(sql`SELECT * FROM items`);
    expect(rows).toHaveLength(0);
  });

  it("provides a unique scope id per run", async () => {
    const db = await freshDb();
    const port = createSqliteTransactionPort(db, sql);
    const ids: string[] = [];
    await port.run("a", async (s) => {
      ids.push(s.id);
    });
    await port.run("a", async (s) => {
      ids.push(s.id);
    });
    expect(ids[0]).not.toBe(ids[1]);
  });
});
