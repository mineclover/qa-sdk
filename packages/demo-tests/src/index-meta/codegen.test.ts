// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * codegen 테스트
 *
 * MetaRegistryInput → TypeScript 타입 생성, lint, diff 포맷 검증.
 */

import { describe, it, expect } from "vitest";
import {
  generateTypes,
  lintSchema,
  formatSchemaDiff,
  defineTable,
  compileSchema,
  type MetaRegistryInput,
} from "index-meta";

// ── 공통 픽스처 ──────────────────────────────────────────────────────────────

const RBAC_SCHEMA: MetaRegistryInput = {
  dims: {
    role: {
      kind: { type: "string_enum" },
      snapshots: { v1: { entries: ["admin", "editor", "viewer"], capacity: 8 } },
    },
    action: {
      kind: { type: "string_enum" },
      snapshots: { v1: { entries: ["read", "write", "delete"], capacity: 8 } },
    },
    resource: {
      kind: { type: "string_enum" },
      snapshots: { v1: { entries: ["dashboard", "reports", "settings"], capacity: 8 } },
    },
  },
  indices: {
    perm: {
      dims: ["role", "action", "resource"],
      versions: {
        v1: { snapshots: { role: "v1", action: "v1", resource: "v1" } },
      },
    },
  },
};

// ── generateTypes ───────────────────────────────────────────────────────────

describe("generateTypes", () => {
  it("leaf dim별 entry union 타입을 생성한다", () => {
    const code = generateTypes(RBAC_SCHEMA);
    expect(code).toContain('type RoleEntry = "admin" | "editor" | "viewer"');
    expect(code).toContain('type ActionEntry = "read" | "write" | "delete"');
    expect(code).toContain('type ResourceEntry = "dashboard" | "reports" | "settings"');
  });

  it("composite index별 coord interface를 생성한다", () => {
    const code = generateTypes(RBAC_SCHEMA);
    expect(code).toContain("interface PermCoord {");
    expect(code).toContain("role: RoleEntry;");
    expect(code).toContain("action: ActionEntry;");
    expect(code).toContain("resource: ResourceEntry;");
  });

  it("version ID union 타입을 생성한다", () => {
    const code = generateTypes(RBAC_SCHEMA);
    expect(code).toContain('type PermVersion = "v1"');
  });

  it("namespace 옵션이 접두사를 붙인다", () => {
    const code = generateTypes(RBAC_SCHEMA, { namespace: "RBAC" });
    expect(code).toContain("type RBACRoleEntry");
    expect(code).toContain("interface RBACPermCoord");
    expect(code).toContain("type RBACPermVersion");
  });

  it("exportAll=false면 export 키워드를 생략한다", () => {
    const code = generateTypes(RBAC_SCHEMA, { exportAll: false });
    expect(code).not.toContain("export type");
    expect(code).toContain("type RoleEntry");
  });

  it("index_ref dim은 number 타입으로 생성한다", () => {
    const schema: MetaRegistryInput = {
      dims: {
        format: {
          kind: { type: "string_enum" },
          snapshots: { fv1: { entries: ["pdf", "html"] } },
        },
        quality_tier: {
          kind: { type: "index_ref", indexId: "doc_meta" },
          snapshots: { qtv1: { entries: [0, 2] } },
        },
      },
      indices: {
        doc_meta: {
          dims: ["format"],
          versions: { dmv1: { snapshots: { format: "fv1" } } },
        },
        article: {
          dims: ["quality_tier"],
          versions: { av1: { snapshots: { quality_tier: "qtv1" } } },
        },
      },
    };
    const code = generateTypes(schema);
    expect(code).toContain("quality_tier: number;");
    // index_ref dim은 entry union 타입이 생성되지 않음
    expect(code).not.toContain("QualityTierEntry");
  });

  it("number_enum dim은 숫자 리터럴 union으로 생성한다", () => {
    const schema: MetaRegistryInput = {
      dims: {
        priority: {
          kind: { type: "number_enum" },
          snapshots: { v1: { entries: [10, 20, 30] } },
        },
      },
      indices: {
        task: {
          dims: ["priority"],
          versions: { v1: { snapshots: { priority: "v1" } } },
        },
      },
    };
    const code = generateTypes(schema);
    expect(code).toContain("type PriorityEntry = 10 | 20 | 30");
  });
});

// ── lintSchema ──────────────────────────────────────────────────────────────

describe("lintSchema", () => {
  it("올바른 스키마에서 에러가 없다", () => {
    const diags = lintSchema(RBAC_SCHEMA);
    const errors = diags.filter((d) => d.level === "error");
    expect(errors).toHaveLength(0);
  });

  it("미참조 dim을 경고한다", () => {
    const schema: MetaRegistryInput = {
      dims: {
        role: { kind: { type: "string_enum" }, snapshots: { v1: { entries: ["admin"] } } },
        orphan: { kind: { type: "string_enum" }, snapshots: { v1: { entries: ["x"] } } },
      },
      indices: {
        perm: {
          dims: ["role"],
          versions: { v1: { snapshots: { role: "v1" } } },
        },
      },
    };
    const diags = lintSchema(schema);
    expect(diags.some((d) => d.dimId === "orphan" && d.level === "warning")).toBe(true);
  });

  it("존재하지 않는 index_ref 대상을 에러로 보고한다", () => {
    const schema: MetaRegistryInput = {
      dims: {
        ref_dim: {
          kind: { type: "index_ref", indexId: "nonexistent" },
          snapshots: { v1: { entries: [0] } },
        },
      },
      indices: {
        test: {
          dims: ["ref_dim"],
          versions: { v1: { snapshots: { ref_dim: "v1" } } },
        },
      },
    };
    const diags = lintSchema(schema);
    expect(diags.some((d) => d.level === "error" && d.message.includes("nonexistent"))).toBe(true);
  });

  it("중복 entry를 에러로 보고한다", () => {
    const schema: MetaRegistryInput = {
      dims: {
        role: {
          kind: { type: "string_enum" },
          snapshots: { v1: { entries: ["admin", "admin", "viewer"] } },
        },
      },
      indices: {
        perm: {
          dims: ["role"],
          versions: { v1: { snapshots: { role: "v1" } } },
        },
      },
    };
    const diags = lintSchema(schema);
    expect(diags.some((d) => d.level === "error" && d.message.includes("duplicate"))).toBe(true);
  });

  it("존재하지 않는 snapshot 참조를 에러로 보고한다", () => {
    const schema: MetaRegistryInput = {
      dims: {
        role: {
          kind: { type: "string_enum" },
          snapshots: { v1: { entries: ["admin"] } },
        },
      },
      indices: {
        perm: {
          dims: ["role"],
          versions: { v1: { snapshots: { role: "v99" } } },
        },
      },
    };
    const diags = lintSchema(schema);
    expect(diags.some((d) => d.level === "error" && d.message.includes("v99"))).toBe(true);
  });
});

// ── formatSchemaDiff ────────────────────────────────────────────────────────

describe("formatSchemaDiff", () => {
  it("변경 없으면 'No changes.' 반환", () => {
    const role = defineTable("role", { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 8 } } });
    const schema = compileSchema([role]);
    const diff = schema.diff(schema);
    expect(formatSchemaDiff(diff)).toBe("No changes.");
  });

  it("추가/변경/삭제를 사람이 읽을 수 있게 포맷한다", () => {
    const roleV1 = defineTable("role", { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 8 } } });
    const schema1 = compileSchema([roleV1]);

    const roleV1Expanded = defineTable("role", { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 16 } } });
    const actionDef = defineTable("action", { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 4 } } });
    const schema2 = compileSchema([roleV1Expanded, actionDef]);

    const diff = schema2.diff(schema1);
    const report = formatSchemaDiff(diff);

    expect(report).toContain("Added tables:");
    expect(report).toContain("+ action");
    expect(report).toContain("Changed tables:");
    expect(report).toContain("capacity v1: 8 → 16");
  });
});
