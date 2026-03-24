import { describe, it, expect, beforeEach } from "vitest";
import { MemoryDefinitionRegistry } from "./registry.js";
import type { DefinitionEntryInput, DefScope } from "./types.js";
import { DEF_SCOPE } from "./vocabulary.js";

function makeEntry(overrides: Partial<DefinitionEntryInput> = {}): DefinitionEntryInput {
  const now = new Date().toISOString();
  return {
    id: `doc-${Math.random().toString(36).slice(2, 8)}`,
    title: "테스트 문서",
    scope: "ui",
    aspect: "component",
    depth: "specification",
    lifecycle: "draft",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("MemoryDefinitionRegistry", () => {
  let registry: MemoryDefinitionRegistry;

  beforeEach(() => {
    registry = new MemoryDefinitionRegistry();
  });

  // ─── CRUD ──────────────────────────────────────────────

  describe("register", () => {
    it("문서를 등록하고 좌표를 자동 계산한다", () => {
      const entry = registry.register(makeEntry({ id: "doc-1" }));
      expect(entry.address).toBeDefined();
      expect(entry.serialized).toMatch(/^def_document:v1:\d+$/);
    });

    it("중복 ID 등록 시 에러", () => {
      registry.register(makeEntry({ id: "dup" }));
      expect(() => registry.register(makeEntry({ id: "dup" }))).toThrow("이미 등록된 ID");
    });

    it("무효한 scope-aspect 조합 시 에러", () => {
      expect(() => registry.register(makeEntry({
        scope: "ui",
        aspect: "domain_data" as any,
      }))).toThrow();
    });
  });

  describe("get", () => {
    it("등록된 문서를 반환한다", () => {
      registry.register(makeEntry({ id: "doc-1", title: "컴포넌트 스펙" }));
      const got = registry.get("doc-1");
      expect(got).toBeDefined();
      expect(got!.title).toBe("컴포넌트 스펙");
    });

    it("미등록 ID는 undefined", () => {
      expect(registry.get("nonexistent")).toBeUndefined();
    });
  });

  describe("update", () => {
    it("title을 수정할 수 있다", () => {
      registry.register(makeEntry({ id: "doc-1", title: "v1" }));
      const updated = registry.update("doc-1", { title: "v2" });
      expect(updated.title).toBe("v2");
    });

    it("lifecycle 변경 시 좌표는 불변이다 (주소 안정성)", () => {
      const entry = registry.register(makeEntry({ id: "doc-1", lifecycle: "draft" }));
      const updated = registry.update("doc-1", { lifecycle: "approved" });
      expect(updated.address).toBe(entry.address);
      expect(updated.serialized).toBe(entry.serialized);
      expect(updated.lifecycle).toBe("approved");
    });

    it("depth 변경 시 좌표가 재계산된다", () => {
      const entry = registry.register(makeEntry({ id: "doc-2", depth: "overview" }));
      const updated = registry.update("doc-2", { depth: "specification" });
      expect(updated.address).not.toBe(entry.address);
      expect(updated.depth).toBe("specification");
    });

    it("미등록 ID 수정 시 에러", () => {
      expect(() => registry.update("nonexistent", { title: "x" })).toThrow("등록되지 않은 ID");
    });
  });

  describe("remove", () => {
    it("등록된 문서를 삭제한다", () => {
      registry.register(makeEntry({ id: "doc-1" }));
      expect(registry.remove("doc-1")).toBe(true);
      expect(registry.get("doc-1")).toBeUndefined();
    });

    it("미등록 ID 삭제는 false", () => {
      expect(registry.remove("nonexistent")).toBe(false);
    });

    it("삭제 시 관련 관계도 제거된다", () => {
      registry.register(makeEntry({ id: "a", scope: "ui", aspect: "layout" }));
      registry.register(makeEntry({ id: "b", scope: "ui", aspect: "component" }));
      registry.link("a", "b", "depends_on");
      expect(registry.getLinks("a").length).toBe(1);

      registry.remove("a");
      expect(registry.getLinks("b").length).toBe(0);
    });
  });

  // ─── 관계 ──────────────────────────────────────────────

  describe("link / unlink", () => {
    it("관계를 등록하고 좌표를 계산한다", () => {
      registry.register(makeEntry({ id: "a", scope: "feature", aspect: "func_def" }));
      registry.register(makeEntry({ id: "b", scope: "feature", aspect: "scenario" }));
      const link = registry.link("a", "b", "refines");
      expect(link.address).toBeDefined();
      expect(link.linkType).toBe("refines");
    });

    it("관계를 삭제할 수 있다", () => {
      registry.register(makeEntry({ id: "a", scope: "ui", aspect: "layout" }));
      registry.register(makeEntry({ id: "b", scope: "ui", aspect: "component" }));
      registry.link("a", "b", "constrains");
      expect(registry.unlink("a", "b", "constrains")).toBe(true);
      expect(registry.getLinks("a").length).toBe(0);
    });

    it("미등록 문서 간 관계 등록 시 에러", () => {
      registry.register(makeEntry({ id: "a" }));
      expect(() => registry.link("a", "nonexistent", "depends_on")).toThrow("도착 문서 미등록");
    });
  });

  describe("getLinks", () => {
    beforeEach(() => {
      registry.register(makeEntry({ id: "a", scope: "flow", aspect: "process_flow" }));
      registry.register(makeEntry({ id: "b", scope: "flow", aspect: "user_scenario" }));
      registry.register(makeEntry({ id: "c", scope: "flow", aspect: "relation" }));
      registry.link("a", "b", "depends_on");
      registry.link("c", "a", "refines");
    });

    it("outgoing만 조회", () => {
      const out = registry.getLinks("a", "outgoing");
      expect(out.length).toBe(1);
      expect(out[0].targetId).toBe("b");
    });

    it("incoming만 조회", () => {
      const inc = registry.getLinks("a", "incoming");
      expect(inc.length).toBe(1);
      expect(inc[0].sourceId).toBe("c");
    });

    it("both(기본값)로 전체 조회", () => {
      const all = registry.getLinks("a");
      expect(all.length).toBe(2);
    });
  });

  // ─── 질의 ──────────────────────────────────────────────

  describe("findByScope", () => {
    it("scope로 필터링한다", () => {
      registry.register(makeEntry({ id: "a", scope: "ui", aspect: "layout" }));
      registry.register(makeEntry({ id: "b", scope: "ui", aspect: "component" }));
      registry.register(makeEntry({ id: "c", scope: "data", aspect: "domain_data" }));
      expect(registry.findByScope("ui").length).toBe(2);
      expect(registry.findByScope("data").length).toBe(1);
    });
  });

  describe("findByAddress", () => {
    it("좌표 주소로 문서를 찾는다", () => {
      const entry = registry.register(makeEntry({ id: "addr-test" }));
      const found = registry.findByAddress(entry.address!);
      expect(found).toBeDefined();
      expect(found!.id).toBe("addr-test");
    });

    it("존재하지 않는 주소는 undefined", () => {
      expect(registry.findByAddress(999999)).toBeUndefined();
    });
  });

  describe("query", () => {
    beforeEach(() => {
      registry.register(makeEntry({ id: "a", scope: "ui", aspect: "layout", depth: "overview", lifecycle: "draft" }));
      registry.register(makeEntry({ id: "b", scope: "ui", aspect: "component", depth: "specification", lifecycle: "approved" }));
      registry.register(makeEntry({ id: "c", scope: "data", aspect: "domain_data", depth: "specification", lifecycle: "draft" }));
    });

    it("단일 조건 필터", () => {
      expect(registry.query({ scope: "ui" }).length).toBe(2);
      expect(registry.query({ lifecycle: "draft" }).length).toBe(2);
      expect(registry.query({ depth: "specification" }).length).toBe(2);
    });

    it("복합 조건 필터", () => {
      const result = registry.query({ scope: "ui", lifecycle: "approved" });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("b");
    });

    it("태그 필터", () => {
      registry.register(makeEntry({ id: "d", scope: "state", aspect: "app_state", tags: ["auth", "session"] }));
      registry.register(makeEntry({ id: "e", scope: "state", aspect: "domain_state", tags: ["auth"] }));
      expect(registry.query({ tags: ["auth"] }).length).toBe(2);
      expect(registry.query({ tags: ["auth", "session"] }).length).toBe(1);
    });

    it("빈 필터는 전체 반환", () => {
      expect(registry.query({}).length).toBe(3);
    });
  });

  // ─── 통계 ──────────────────────────────────────────────

  describe("stats", () => {
    it("등록된 문서와 관계 수를 반환한다", () => {
      registry.register(makeEntry({ id: "a", scope: "ui", aspect: "layout", lifecycle: "draft", depth: "overview" }));
      registry.register(makeEntry({ id: "b", scope: "ui", aspect: "component", lifecycle: "approved", depth: "specification" }));
      registry.register(makeEntry({ id: "c", scope: "data", aspect: "domain_data", lifecycle: "draft", depth: "overview" }));
      registry.link("a", "b", "depends_on");

      const s = registry.stats();
      expect(s.totalEntries).toBe(3);
      expect(s.totalLinks).toBe(1);
      expect(s.byScope.ui).toBe(2);
      expect(s.byScope.data).toBe(1);
      expect(s.byLifecycle.draft).toBe(2);
      expect(s.byLifecycle.approved).toBe(1);
      expect(s.byDepth.overview).toBe(2);
      expect(s.byDepth.specification).toBe(1);
    });

    it("빈 레지스트리의 통계", () => {
      const s = registry.stats();
      expect(s.totalEntries).toBe(0);
      expect(s.totalLinks).toBe(0);
      for (const scope of DEF_SCOPE.entries) {
        expect(s.byScope[scope as DefScope]).toBe(0);
      }
    });
  });
});
