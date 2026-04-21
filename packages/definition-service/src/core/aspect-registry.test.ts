// @def.doc definition-service

import { describe, expect, it, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { ASPECT_PARENTS, deriveAspectParent } from "definition-catalog";
import * as schema from "../db/schema.js";
import { aspectParents } from "../db/schema.js";
import { createAspectRegistry } from "./aspect-registry.js";

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

describe("createAspectRegistry", () => {
  describe("DB 경로", () => {
    let ctx: ReturnType<typeof createInMemoryDb>;

    beforeEach(() => {
      ctx = createInMemoryDb();
      // populate
      const rows = Object.entries(ASPECT_PARENTS).map(([childId, parentId]) => ({
        childId,
        parentId,
        description: null,
      }));
      if (rows.length > 0) {
        ctx.db.insert(aspectParents).values(rows).run();
      }
    });

    it("getAspectParent — DB row 가 있으면 해당 parent 반환", () => {
      const registry = createAspectRegistry(ctx.db);
      for (const [child, parent] of Object.entries(ASPECT_PARENTS)) {
        expect(registry.getAspectParent(child)).toBe(parent);
      }
    });

    it("getChildrenOf — DB row 기반으로 자식 목록 반환", () => {
      const registry = createAspectRegistry(ctx.db);
      const children = registry.getChildrenOf("func_def");
      expect(children.length).toBeGreaterThan(0);
      for (const c of children) {
        expect(ASPECT_PARENTS[c]).toBe("func_def");
      }
    });
  });

  describe("Fallback 경로 (빈 DB)", () => {
    let ctx: ReturnType<typeof createInMemoryDb>;

    beforeEach(() => {
      ctx = createInMemoryDb(); // 빈 테이블 상태
    });

    it("DB 에 row 가 없으면 runtime map fallback 으로 응답", () => {
      const registry = createAspectRegistry(ctx.db);
      for (const [child, parent] of Object.entries(ASPECT_PARENTS)) {
        expect(registry.getAspectParent(child)).toBe(parent);
      }
    });

    it("getChildrenOf — DB 비어있으면 runtime map 기반으로 반환", () => {
      const registry = createAspectRegistry(ctx.db);
      const children = registry.getChildrenOf("process_flow");
      expect(children.length).toBeGreaterThan(0);
      for (const c of children) {
        expect(ASPECT_PARENTS[c]).toBe("process_flow");
      }
    });

    it("미등록 최상위 aspect 는 null 반환", () => {
      const registry = createAspectRegistry(ctx.db);
      expect(registry.getAspectParent("func_def")).toBeNull();
      expect(registry.getAspectParent("layout")).toBeNull();
      expect(registry.getAspectParent("unknown_aspect")).toBeNull();
    });
  });

  describe("DB 미전달 (pure fallback)", () => {
    it("db 없이 registry 생성 시 runtime map 만 사용", () => {
      const registry = createAspectRegistry();
      for (const child of Object.keys(ASPECT_PARENTS)) {
        expect(registry.getAspectParent(child)).toBe(deriveAspectParent(child));
      }
    });
  });

  describe("getAspectFamily (Phase C-2)", () => {
    describe("DB 경로", () => {
      let ctx: ReturnType<typeof createInMemoryDb>;

      beforeEach(() => {
        ctx = createInMemoryDb();
        const rows = Object.entries(ASPECT_PARENTS).map(([childId, parentId]) => ({
          childId,
          parentId,
          description: null,
        }));
        if (rows.length > 0) {
          ctx.db.insert(aspectParents).values(rows).run();
        }
      });

      it("부모 aspect 는 self + 모든 자식을 포함", () => {
        const registry = createAspectRegistry(ctx.db);
        const family = registry.getAspectFamily("func_def");
        expect(family[0]).toBe("func_def");
        const expectedChildren = Object.entries(ASPECT_PARENTS)
          .filter(([, parent]) => parent === "func_def")
          .map(([child]) => child);
        for (const c of expectedChildren) {
          expect(family).toContain(c);
        }
        expect(family.length).toBe(1 + expectedChildren.length);
      });

      it("leaf aspect 는 자기 자신만 반환", () => {
        const registry = createAspectRegistry(ctx.db);
        expect(registry.getAspectFamily("codegen_func")).toEqual(["codegen_func"]);
      });

      it("결과에 중복 없음 (cycle 방어)", () => {
        const registry = createAspectRegistry(ctx.db);
        const family = registry.getAspectFamily("process_flow");
        expect(new Set(family).size).toBe(family.length);
      });
    });

    describe("Fallback 경로 (빈 DB)", () => {
      let ctx: ReturnType<typeof createInMemoryDb>;

      beforeEach(() => {
        ctx = createInMemoryDb();
      });

      it("빈 DB → runtime map 기반 family 와 동일", () => {
        const registry = createAspectRegistry(ctx.db);
        const family = registry.getAspectFamily("func_def");
        expect(family[0]).toBe("func_def");
        const expected = Object.entries(ASPECT_PARENTS)
          .filter(([, p]) => p === "func_def")
          .map(([c]) => c);
        for (const c of expected) expect(family).toContain(c);
      });
    });

    describe("DB 미전달", () => {
      it("db 없이도 runtime map 기반으로 작동", () => {
        const registry = createAspectRegistry();
        const family = registry.getAspectFamily("func_def");
        expect(family[0]).toBe("func_def");
        expect(family.length).toBeGreaterThan(1);
      });
    });
  });
});
