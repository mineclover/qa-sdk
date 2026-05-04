// @def.doc definition-catalog-spec

import { describe, it, expect } from "vitest";
import { MemoryDefinitionRegistry } from "./registry.js";
import {
  isDomainTier,
  selectPrimaryParent,
  deriveDomainRoot,
  deriveSubDocRoot,
  deriveAllDomainRoots,
  detectOwnerRootMismatch,
  SUB_DOC_EXTENSIONS,
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

// ───────────────────────────────────────────────────────────────
// Phase 1 확장 — sub-doc rollup (Hybrid D > A > C)
// 시뮬레이션 근거: 2026-04-21-subdoc-rollup-simulation.md
// ───────────────────────────────────────────────────────────────

describe("SUB_DOC_EXTENSIONS", () => {
  it("6종 확장자 (.todo, .plan, .memo, .test, .cases, .rule)", () => {
    expect([...SUB_DOC_EXTENSIONS].toSorted()).toEqual(
      [".cases.md", ".memo.md", ".plan.md", ".rule.md", ".test.md", ".todo.md"].toSorted(),
    );
  });
});

describe("deriveDomainRoot — sub-doc rollup Strategy D (id-prefix)", () => {
  it("foo-todo 가 registry 에 있고 foo 가 있으면 foo 로 rollup", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "foo", tier: "system" },
      {
        id: "foo-todo",
        tier: "component",
        ref: "docs/foo.todo.md",
      },
    ]);
    expect(deriveDomainRoot(r.get("foo-todo")!, r)).toBe("foo");
  });

  it("foo-todo 가 있지만 foo 가 없으면 -system/-spec fallback", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "foo-system", tier: "system" },
      {
        id: "foo-todo",
        tier: "component",
        ref: "docs/foo.todo.md",
      },
    ]);
    expect(deriveDomainRoot(r.get("foo-todo")!, r)).toBe("foo-system");
  });

  it("-spec fallback 이 작동", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "foo-spec", tier: "system" },
      {
        id: "foo-plan",
        tier: "component",
        ref: "docs/foo.plan.md",
      },
    ]);
    expect(deriveDomainRoot(r.get("foo-plan")!, r)).toBe("foo-spec");
  });

  it("base/-system/-spec 모두 없으면 D 에서는 포기 (다음 전략으로 fallthrough)", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      {
        id: "ghost-todo",
        tier: "component",
        ref: "docs/ghost.todo.md",
      },
    ]);
    // A, C 모두 실패 → self
    expect(deriveDomainRoot(r.get("ghost-todo")!, r)).toBe("ghost-todo");
  });

  it("D 가 self 로 귀결해도 다음 전략으로 이어짐 (parent 가 존재하지만 domain root 를 못 찾는 경우 self 반환)", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      // foo 가 component 인데 부모가 없어 self → D 시도해도 foo 자신이 root
      { id: "foo", tier: "component" },
      {
        id: "foo-todo",
        tier: "component",
        ref: "docs/foo.todo.md",
      },
    ]);
    // D 의 foo 도 self 로 귀결 → 다음 전략 없으니 최종 self (foo-todo)
    expect(deriveDomainRoot(r.get("foo-todo")!, r)).toBe("foo");
  });
});

describe("deriveDomainRoot — sub-doc rollup Strategy A (contains-inverse)", () => {
  it("Y contains X → X 는 Y 의 rollup 을 상속", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "domain-group", tier: "system" },
      {
        id: "alpha-todo",
        tier: "component",
        ref: "docs/alpha.todo.md",
      },
    ]);
    r.link("domain-group", "alpha-todo", "contains");
    expect(deriveDomainRoot(r.get("alpha-todo")!, r)).toBe("domain-group");
  });

  it("다중 parent: system tier 우선, 동률이면 id 오름차순", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "p-layout", tier: "layout" },
      { id: "p-zebra", tier: "system" },
      { id: "p-apple", tier: "system" },
      {
        id: "orphan-todo",
        tier: "component",
        ref: "docs/orphan.todo.md",
      },
    ]);
    r.link("p-layout", "orphan-todo", "contains");
    r.link("p-zebra", "orphan-todo", "contains");
    r.link("p-apple", "orphan-todo", "contains");
    // system 이 layout 보다 우선, system 들 중 apple 이 localeCompare 에서 앞.
    expect(deriveDomainRoot(r.get("orphan-todo")!, r)).toBe("p-apple");
  });

  it("D 가 실패하고 A 가 성공하면 A 가 결정", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "group", tier: "system" },
      // stripSubDocIdSuffix("weird-todo") → "weird" 가 없고 -system/-spec 도 없음.
      {
        id: "weird-todo",
        tier: "component",
        ref: "docs/weird.todo.md",
      },
    ]);
    r.link("group", "weird-todo", "contains");
    expect(deriveDomainRoot(r.get("weird-todo")!, r)).toBe("group");
  });
});

describe("deriveDomainRoot — sub-doc rollup Strategy C (file co-location)", () => {
  it("foo.todo.md + foo.spec.md 같은 디렉토리 → spec 으로 rollup", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "foo-spec", tier: "system", ref: "docs/specs/foo.spec.md" },
      {
        id: "unrelated-id",
        tier: "component",
        ref: "docs/specs/foo.todo.md",
      },
    ]);
    // id 접미(D)도 contains(A)도 없는 상황에서 ref 위치로만 결정.
    expect(deriveDomainRoot(r.get("unrelated-id")!, r)).toBe("foo-spec");
  });

  it("foo.todo.md + foo.md (non-spec) 도 sibling 으로 인정", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "bar-plain", tier: "system", ref: "docs/notes/bar.md" },
      {
        id: "bar-note-todo",
        tier: "component",
        ref: "docs/notes/bar.todo.md",
      },
    ]);
    expect(deriveDomainRoot(r.get("bar-note-todo")!, r)).toBe("bar-plain");
  });

  it("sibling 이 없으면 self", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      {
        id: "lonely-todo",
        tier: "component",
        ref: "docs/lonely.todo.md",
      },
    ]);
    expect(deriveDomainRoot(r.get("lonely-todo")!, r)).toBe("lonely-todo");
  });
});

describe("deriveDomainRoot — sub-doc rollup 우선순위 D > A > C", () => {
  it("D/A/C 모두 적용 가능하면 D 가 승리", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "foo", tier: "system" }, // D 가 찾을 parent
      { id: "other-group", tier: "system" }, // A 가 찾을 parent
      { id: "foo-spec", tier: "system", ref: "docs/foo.spec.md" }, // C 가 찾을 sibling
      {
        id: "foo-todo",
        tier: "component",
        ref: "docs/foo.todo.md",
      },
    ]);
    r.link("other-group", "foo-todo", "contains");
    expect(deriveDomainRoot(r.get("foo-todo")!, r)).toBe("foo");
  });

  it("D 실패 + A 성공 + C 성공 → A 가 승리", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "a-group", tier: "system" },
      { id: "c-spec", tier: "system", ref: "docs/mystery.spec.md" },
      {
        id: "mystery-todo",
        tier: "component",
        ref: "docs/mystery.todo.md",
      },
    ]);
    // id 는 "mystery-todo" — base "mystery" 는 없으니 D 실패.
    r.link("a-group", "mystery-todo", "contains");
    expect(deriveDomainRoot(r.get("mystery-todo")!, r)).toBe("a-group");
  });

  it("D/A 실패 + C 성공 → C 가 결정", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "co-located-spec", tier: "system", ref: "docs/co-located.spec.md" },
      {
        id: "orphan-id",
        tier: "component",
        ref: "docs/co-located.todo.md",
      },
    ]);
    expect(deriveDomainRoot(r.get("orphan-id")!, r)).toBe("co-located-spec");
  });

  it("D/A/C 전부 실패 → self", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      {
        id: "no-match",
        tier: "component",
        ref: "docs/no-match.todo.md",
      },
    ]);
    expect(deriveDomainRoot(r.get("no-match")!, r)).toBe("no-match");
  });
});

describe("deriveDomainRoot — sub-doc rollup backward compat", () => {
  it("tier=system 은 sub-doc 로직이 작동하지 않음 (walk 기본 규칙 유지)", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "parent", tier: "system" },
      // tier=system + ref=*.todo.md 인 예외적 케이스: sub-doc 분기가 발동하지 않아야 함.
      {
        id: "solo-system-todo",
        tier: "system",
        ref: "docs/solo-system.todo.md",
      },
    ]);
    // refines/depends_on 부모 없음 → self (기존 동작).
    expect(deriveDomainRoot(r.get("solo-system-todo")!, r)).toBe("solo-system-todo");
  });

  it("tier=component 인데 sub-doc 확장자가 아니면 기존 동작 유지 (self)", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "parent", tier: "system" },
      {
        id: "regular-component",
        tier: "component",
        ref: "packages/foo/src/bar.ts", // md 아님
      },
    ]);
    // ref 가 sub-doc 확장자가 아니므로 rollup 시도 없이 self.
    expect(deriveDomainRoot(r.get("regular-component")!, r)).toBe("regular-component");
  });

  it("component 에 refines 부모가 있으면 기존 walk 가 우선 (sub-doc 분기 도달 안 함)", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "explicit-parent", tier: "system" },
      { id: "co-located-spec", tier: "system", ref: "docs/alpha.spec.md" },
      // 명시적 refines 가 있으므로 기본 walk 가 성공.
      {
        id: "alpha-todo",
        tier: "component",
        ref: "docs/alpha.todo.md",
      },
    ]);
    r.link("alpha-todo", "explicit-parent", "refines");
    // 기본 walk 로 바로 explicit-parent → sub-doc rollup 로직 진입 안 함.
    expect(deriveDomainRoot(r.get("alpha-todo")!, r)).toBe("explicit-parent");
  });
});

describe("deriveSubDocRoot — 직접 호출 계약", () => {
  it("전략 하나도 성공 못하면 null", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      {
        id: "lonely-todo",
        tier: "component",
        ref: "docs/lonely.todo.md",
      },
    ]);
    expect(deriveSubDocRoot(r.get("lonely-todo")!, r)).toBeNull();
  });

  it("depth-cap: 부모 체인이 너무 깊어도 안전 반환", () => {
    const r = new MemoryDefinitionRegistry();
    registerDocs(r, [
      { id: "deep-root", tier: "system" },
      {
        id: "deep-todo",
        tier: "component",
        ref: "docs/deep.todo.md",
      },
    ]);
    r.link("deep-root", "deep-todo", "contains");
    // depth=8 로 호출 → deriveDomainRoot depth+1 로 부모 탐색해도 MAX_DEPTH 이내.
    expect(deriveSubDocRoot(r.get("deep-todo")!, r, new Set(["deep-todo"]), 8)).toBe("deep-root");
  });
});
