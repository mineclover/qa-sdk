// @def.doc definition-service

import { describe, expect, it, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { ASPECT_PARENTS } from "definition-catalog";
import * as schema from "../db/schema.js";
import { aspectParents } from "../db/schema.js";
import { syncAspectParents } from "./aspect-parents-sync.js";

function createInMemoryDb() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE aspect_parents (
      child_id TEXT PRIMARY KEY,
      parent_id TEXT NOT NULL,
      description TEXT,
      registered_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_ap_parent ON aspect_parents (parent_id);
  `);
  const db = drizzle({ client: sqlite, schema });
  return { sqlite, db };
}

describe("syncAspectParents", () => {
  let ctx: ReturnType<typeof createInMemoryDb>;

  beforeEach(() => {
    ctx = createInMemoryDb();
  });

  it("최초 호출 시 ASPECT_PARENTS map 의 모든 쌍을 INSERT 한다", () => {
    const report = syncAspectParents(ctx.db);

    const expectedCount = Object.keys(ASPECT_PARENTS).length;
    expect(report.inserted).toBe(expectedCount);
    expect(report.updated).toBe(0);
    expect(report.unchanged).toBe(0);
    expect(report.driftOrphans).toEqual([]);

    const rows = ctx.db.select().from(aspectParents).all();
    expect(rows.length).toBe(expectedCount);

    const rowByChild = Object.fromEntries(rows.map((r) => [r.childId, r.parentId]));
    for (const [child, parent] of Object.entries(ASPECT_PARENTS)) {
      expect(rowByChild[child]).toBe(parent);
    }
  });

  it("idempotent — 재호출 시 모두 unchanged", () => {
    const first = syncAspectParents(ctx.db);
    const second = syncAspectParents(ctx.db);

    expect(first.inserted).toBeGreaterThan(0);
    expect(second.inserted).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.unchanged).toBe(first.inserted);
    expect(second.driftOrphans).toEqual([]);
  });

  it("DB 의 부모가 map 과 다르면 map 기준으로 UPDATE 한다", () => {
    ctx.db
      .insert(aspectParents)
      .values({ childId: "codegen_func", parentId: "stale_parent", description: null })
      .run();

    const report = syncAspectParents(ctx.db);

    expect(report.updated).toBeGreaterThanOrEqual(1);

    const row = ctx.db
      .select()
      .from(aspectParents)
      .all()
      .find((r) => r.childId === "codegen_func");
    expect(row?.parentId).toBe(ASPECT_PARENTS.codegen_func);
  });

  it("DB 에만 있는 자식은 driftOrphans 로 보고하되 삭제하지 않는다", () => {
    ctx.db
      .insert(aspectParents)
      .values({ childId: "phantom_child", parentId: "phantom_parent", description: null })
      .run();

    const report = syncAspectParents(ctx.db);

    expect(report.driftOrphans).toContain("phantom_child");

    const row = ctx.db
      .select()
      .from(aspectParents)
      .all()
      .find((r) => r.childId === "phantom_child");
    expect(row).toBeDefined();
  });

  it("description 컬럼이 DEFINITION_TAXONOMY 에서 채워진다", () => {
    syncAspectParents(ctx.db);
    const rows = ctx.db.select().from(aspectParents).all();
    const codegen = rows.find((r) => r.childId === "codegen_func");
    expect(codegen?.description).toBeTruthy();
    expect(codegen?.description?.length ?? 0).toBeGreaterThan(0);
  });
});
