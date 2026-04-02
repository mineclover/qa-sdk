import { describe, it, expect } from "vitest";
import { validateTableRefs } from "./table-ref-validate.js";
import type { Catalog } from "./catalog.types.js";

function makeCatalog(overrides?: Partial<Catalog>): Catalog {
  return {
    id: "test",
    name: "테스트",
    axes: {},
    prefixes: {},
    ...overrides,
  };
}

describe("validateTableRefs", () => {
  it("빈 카탈로그 → 이슈 없음", () => {
    expect(validateTableRefs(makeCatalog())).toEqual([]);
  });

  it("정합: prefix table_ref ↔ table referencedBy 일치 → 이슈 없음", () => {
    const catalog = makeCatalog({
      prefixes: {
        cart_event: {
          id: "cart_event", name: "장바구니 이벤트",
          labels: ["actor", "action"],
          dims: {
            actor: { kind: "table_ref", table: "members" },
            action: { kind: "axis", axisId: "cart_action" },
          },
          versions: [{ version: "v1", axisVersions: { action: "v1" } }],
        },
      },
      tables: {
        members: {
          table: "members",
          columns: { id: { kind: "scalar", type: "integer" } },
          referencedBy: [{ prefixId: "cart_event", dimLabel: "actor" }],
        },
      },
    });
    expect(validateTableRefs(catalog)).toEqual([]);
  });

  it("prefix table_ref → table 미존재 → warning", () => {
    const catalog = makeCatalog({
      prefixes: {
        cart_event: {
          id: "cart_event", name: "장바구니 이벤트",
          labels: ["actor"],
          dims: { actor: { kind: "table_ref", table: "nonexistent" } },
          versions: [],
        },
      },
    });
    const issues = validateTableRefs(catalog);
    expect(issues).toHaveLength(2); // table 미존재 + referencedBy 미선언
    expect(issues[0]!.message).toContain("nonexistent");
    expect(issues[0]!.message).toContain("catalog.tables에 없음");
  });

  it("referencedBy에 선언했지만 prefix에 table_ref 없음 → warning", () => {
    const catalog = makeCatalog({
      prefixes: {},
      tables: {
        members: {
          table: "members",
          columns: { id: { kind: "scalar", type: "integer" } },
          referencedBy: [{ prefixId: "ghost_prefix", dimLabel: "actor" }],
        },
      },
    });
    const issues = validateTableRefs(catalog);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain("ghost_prefix.actor");
    expect(issues[0]!.message).toContain("실제 prefix dim에 table_ref 없음");
  });

  it("prefix table_ref 있지만 referencedBy 미선언 → colocation 누락 warning", () => {
    const catalog = makeCatalog({
      prefixes: {
        cart_event: {
          id: "cart_event", name: "장바구니 이벤트",
          labels: ["actor"],
          dims: { actor: { kind: "table_ref", table: "members" } },
          versions: [],
        },
      },
      tables: {
        members: {
          table: "members",
          columns: { id: { kind: "scalar", type: "integer" } },
          // referencedBy 없음
        },
      },
    });
    const issues = validateTableRefs(catalog);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain("colocation 누락");
  });

  it("다중 참조 정합", () => {
    const catalog = makeCatalog({
      prefixes: {
        cart_event: {
          id: "cart_event", name: "",
          labels: ["actor", "target"],
          dims: {
            actor: { kind: "table_ref", table: "members" },
            target: { kind: "table_ref", table: "items" },
          },
          versions: [],
        },
        auth_event: {
          id: "auth_event", name: "",
          labels: ["actor"],
          dims: { actor: { kind: "table_ref", table: "members" } },
          versions: [],
        },
      },
      tables: {
        members: {
          table: "members",
          columns: { id: { kind: "scalar", type: "integer" } },
          referencedBy: [
            { prefixId: "cart_event", dimLabel: "actor" },
            { prefixId: "auth_event", dimLabel: "actor" },
          ],
        },
        items: {
          table: "items",
          columns: { id: { kind: "scalar", type: "integer" } },
          referencedBy: [
            { prefixId: "cart_event", dimLabel: "target" },
          ],
        },
      },
    });
    expect(validateTableRefs(catalog)).toEqual([]);
  });
});
