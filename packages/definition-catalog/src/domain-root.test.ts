// @def.doc definition-catalog-spec

import { describe, it, expect } from "vitest";
import { MemoryDefinitionRegistry } from "./registry.js";
import {
  isDomainTier,
  selectPrimaryParent,
  deriveDomainRoot,
  deriveAllDomainRoots,
  detectOwnerRootMismatch,
} from "./domain-root.js";
import type { DefinitionEntry, DefinitionEntryInput, DefTier } from "./types.js";

function makeDoc(overrides: Partial<DefinitionEntryInput> = {}): DefinitionEntryInput {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? `doc-${Math.random().toString(36).slice(2, 8)}`,
    title: overrides.title ?? "테스트 문서",
    scope: overrides.scope ?? "data",
    aspect: overrides.aspect ?? "domain_data",
    depth: overrides.depth ?? "specification",
    lifecycle: overrides.lifecycle ?? "approved",
    tier: overrides.tier ?? "system",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function registerDocs(
  registry: MemoryDefinitionRegistry,
  docs: Partial<DefinitionEntryInput>[],
): void {
  for (const d of docs) registry.register(makeDoc(d));
}

describe("isDomainTier", () => {
  it("tier=system은 domain tier", () => {
    const doc = { tier: "system" as DefTier } as DefinitionEntry;
    expect(isDomainTier(doc)).toBe(true);
  });

  it("tier=layout은 domain tier", () => {
    const doc = { tier: "layout" as DefTier } as DefinitionEntry;
    expect(isDomainTier(doc)).toBe(true);
  });

  it("tier=component는 domain tier가 아님", () => {
    const doc = { tier: "component" as DefTier } as DefinitionEntry;
    expect(isDomainTier(doc)).toBe(false);
  });

  it("tier=entry/exempt는 domain tier가 아님", () => {
    expect(isDomainTier({ tier: "entry" } as DefinitionEntry)).toBe(false);
    expect(isDomainTier({ tier: "exempt" } as DefinitionEntry)).toBe(false);
  });

  it("undefined / null 방어", () => {
    expect(isDomainTier(undefined)).toBe(false);
    expect(isDomainTier(null)).toBe(false);
    expect(isDomainTier({ tier: undefined } as DefinitionEntry)).toBe(false);
  });
});

describe("deriveDomainRoot — 기본 케이스", () => {
  it("self-root: tier=system, 부모 없음 → self", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [{ id: "a", tier: "system" }]);
    expect(deriveDomainRoot(r.get("a")!, r)).toBe("a");
  });

  it("single-parent-refines: refines 부모로 올라감", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "parent", tier: "system" },
      { id: "child", tier: "system" },
    ]);
    r.link("child", "parent", "refines");
    expect(deriveDomainRoot(r.get("child")!, r)).toBe("parent");
  });

  it("single-parent-depends: depends_on 부모로 올라감", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "parent", tier: "system" },
      { id: "child", tier: "system" },
    ]);
    r.link("child", "parent", "depends_on");
    expect(deriveDomainRoot(r.get("child")!, r)).toBe("parent");
  });

  it("non-domain-doc: tier=component, 후보 없음 → self", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [{ id: "c", tier: "component" }]);
    expect(deriveDomainRoot(r.get("c")!, r)).toBe("c");
  });

  it("component→system refines는 따라감", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "parent", tier: "system" },
      { id: "c", tier: "component" },
    ]);
    r.link("c", "parent", "refines");
    expect(deriveDomainRoot(r.get("c")!, r)).toBe("parent");
  });

  it("component 부모는 무시 (domain tier가 아님)", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "c1", tier: "component" },
      { id: "c2", tier: "component" },
    ]);
    r.link("c2", "c1", "refines");
    expect(deriveDomainRoot(r.get("c2")!, r)).toBe("c2");
  });

  it("non-domain 링크 타입(implements, traces_to)은 무시", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "parent", tier: "system" },
      { id: "child", tier: "system" },
    ]);
    r.link("child", "parent", "implements");
    r.link("child", "parent", "traces_to");
    expect(deriveDomainRoot(r.get("child")!, r)).toBe("child");
  });
});

describe("selectPrimaryParent — Q2 tiebreak 규칙", () => {
  it("both-link-types: refines + depends_on 동시 → refines 승 (Q2)", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "p-refines", tier: "system" },
      { id: "p-depends", tier: "system" },
      { id: "child", tier: "system" },
    ]);
    r.link("child", "p-refines", "refines");
    r.link("child", "p-depends", "depends_on");
    expect(deriveDomainRoot(r.get("child")!, r)).toBe("p-refines");
  });

  it("multi-refines-tiebreak: 계층 상위(추가 부모 없음) 우선", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "grandparent", tier: "system" },
      { id: "p-higher", tier: "system" },
      { id: "p-lower", tier: "system" },
      { id: "child", tier: "system" },
    ]);
    r.link("p-lower", "grandparent", "refines");
    r.link("child", "p-higher", "refines");
    r.link("child", "p-lower", "refines");
    expect(deriveDomainRoot(r.get("child")!, r)).toBe("p-higher");
  });

  it("동률이면 localeCompare 오름차순", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "p-banana", tier: "system" },
      { id: "p-apple", tier: "system" },
      { id: "child", tier: "system" },
    ]);
    r.link("child", "p-banana", "refines");
    r.link("child", "p-apple", "refines");
    expect(deriveDomainRoot(r.get("child")!, r)).toBe("p-apple");
  });

  it("선택된 primary가 target 문서 사라지면 current 반환", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "parent", tier: "system" },
      { id: "child", tier: "system" },
    ]);
    r.link("child", "parent", "refines");
    r.remove("parent");
    expect(deriveDomainRoot(r.get("child")!, r)).toBe("child");
  });

  it("빈 후보 배열을 넘기면 에러", () => {
    const r = new MemoryDefinitionRegistry();
    expect(() => selectPrimaryParent([], r)).toThrow();
  });
});

describe("deriveDomainRoot — 안전장치", () => {
  it("cycle-defense: a→refines→b→refines→a 무한 루프 방지", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "a", tier: "system" },
      { id: "b", tier: "system" },
    ]);
    r.link("a", "b", "refines");
    r.link("b", "a", "refines");
    const root = deriveDomainRoot(r.get("a")!, r);
    expect([root]).toContain(root);
    expect(["a", "b"]).toContain(root);
  });

  it("self-ref: a→refines→a 는 self 반환", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [{ id: "a", tier: "system" }]);
    r.link("a", "a", "refines");
    expect(deriveDomainRoot(r.get("a")!, r)).toBe("a");
  });

  it("depth-cap: 12-deep chain 은 10 단계에서 절단", () => {
    const r = new MemoryDefinitionRegistry();
    const ids = Array.from({ length: 13 }, (_, i) => `d${i}`);
    for (const id of ids) registerDocs(r, [{ id, tier: "system" }]);
    for (let i = 0; i < ids.length - 1; i++) {
      r.link(ids[i], ids[i + 1], "refines");
    }
    const root = deriveDomainRoot(r.get("d0")!, r);
    expect(root).toBe("d10");
  });
});

describe("deriveAllDomainRoots", () => {
  it("레지스트리의 모든 문서에 대해 root 맵 생성", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "root-1", tier: "system" },
      { id: "child-1", tier: "system" },
      { id: "child-2", tier: "system" },
      { id: "leaf-1", tier: "component" },
    ]);
    r.link("child-1", "root-1", "refines");
    r.link("child-2", "root-1", "depends_on");
    r.link("leaf-1", "child-1", "refines");

    const roots = deriveAllDomainRoots(r);
    expect(roots.get("root-1")).toBe("root-1");
    expect(roots.get("child-1")).toBe("root-1");
    expect(roots.get("child-2")).toBe("root-1");
    expect(roots.get("leaf-1")).toBe("root-1");
  });

  it("결정론: 동일 입력 → 동일 출력", () => {
    const build = (): MemoryDefinitionRegistry => {
      const r = new MemoryDefinitionRegistry();
      registerDocs(r, [
        { id: "p1", tier: "system" },
        { id: "p2", tier: "system" },
        { id: "c", tier: "system" },
      ]);
      r.link("c", "p1", "refines");
      r.link("c", "p2", "refines");
      return r;
    };
    const r1 = deriveAllDomainRoots(build());
    const r2 = deriveAllDomainRoots(build());
    expect([...r1.entries()]).toEqual([...r2.entries()]);
  });
});

describe("detectOwnerRootMismatch", () => {
  it("no-owner: owner_system 비어 있음", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [{ id: "a", tier: "system" }]);
    expect(detectOwnerRootMismatch(r.get("a")!, "a", r)).toBe("no-owner");
  });

  it("ok: owner_system === derivedRoot", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [{ id: "a", tier: "system", owner_system: "a" }]);
    expect(detectOwnerRootMismatch(r.get("a")!, "a", r)).toBe("ok");
  });

  it("ok: root 문서의 owner_system이 내 owner_system과 일치", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "root", tier: "system", owner_system: "shared" },
      { id: "child", tier: "system", owner_system: "shared" },
    ]);
    expect(detectOwnerRootMismatch(r.get("child")!, "root", r)).toBe("ok");
  });

  it("mismatch: 다른 owner_system 가 derivedRoot에 매핑됨", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "root", tier: "system", owner_system: "foo" },
      { id: "child", tier: "system", owner_system: "bar" },
    ]);
    expect(detectOwnerRootMismatch(r.get("child")!, "root", r)).toBe("mismatch");
  });

  it("mismatch: 미등록 root여도 owner 비교 가능", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [{ id: "a", tier: "system", owner_system: "me" }]);
    expect(detectOwnerRootMismatch(r.get("a")!, "ghost", r)).toBe("mismatch");
  });
});

describe("Phase 0b 통합 fixture — 알려진 케이스 재현", () => {
  it("index-meta-store-contract: refines(index-meta-store-group) > depends_on(table-schema-spec)", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "table-schema-spec", tier: "system" },
      { id: "index-meta-store-group", tier: "system" },
      { id: "index-meta-store-contract", tier: "system" },
    ]);
    r.link("index-meta-store-contract", "index-meta-store-group", "refines");
    r.link("index-meta-store-contract", "table-schema-spec", "depends_on");
    expect(deriveDomainRoot(r.get("index-meta-store-contract")!, r)).toBe("index-meta-store-group");
  });

  it("skill-def-explore: refines(claude-skill-group) > depends_on(definition-catalog-spec)", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "definition-catalog-spec", tier: "system" },
      { id: "claude-skill-group", tier: "system" },
      { id: "skill-def-explore", tier: "system" },
    ]);
    r.link("skill-def-explore", "claude-skill-group", "refines");
    r.link("skill-def-explore", "definition-catalog-spec", "depends_on");
    expect(deriveDomainRoot(r.get("skill-def-explore")!, r)).toBe("claude-skill-group");
  });

  it("spec-core-identifiers: spec-core-types-group refines 로 올라감", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "definition-catalog-spec", tier: "system" },
      { id: "spec-core-types-group", tier: "system" },
      { id: "spec-core-identifiers", tier: "system" },
    ]);
    r.link("spec-core-identifiers", "spec-core-types-group", "refines");
    r.link("spec-core-identifiers", "definition-catalog-spec", "depends_on");
    expect(deriveDomainRoot(r.get("spec-core-identifiers")!, r)).toBe("spec-core-types-group");
  });
});
