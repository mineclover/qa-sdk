import { describe, it, expect } from "vitest";
import { defineTable } from "./table-def.js";
import { compileSchema } from "./compile-schema.js";
import { ValidationError } from "./errors.js";

// ── 공통 픽스처 ────────────────────────────────────────────

const role = () =>
  defineTable("role", {
    source: { kind: { type: "string_enum" as const } },
    versions: { v1: { capacity: 8 }, v2: { capacity: 16 } },
  });

const action = () =>
  defineTable("action", {
    source: { kind: { type: "string_enum" as const } },
    versions: { v1: { capacity: 4 } },
  });

const resource = () =>
  defineTable("resource", {
    source: { kind: { type: "string_enum" as const } },
    versions: { v1: { capacity: 16 }, v2: { capacity: 32 } },
  });

const perm = () =>
  defineTable("perm", {
    dims: [role(), action(), resource()],
    versions: {
      v1: {
        refs: {
          role:     { prefix: "role",     version: "v1" }, // 8
          action:   { prefix: "action",   version: "v1" }, // 4
          resource: { prefix: "resource", version: "v1" }, // 16 → 512
        },
      },
      v2: {
        refs: {
          role:     { prefix: "role",     version: "v2" }, // 16 → capacity 변화
          action:   { prefix: "action",   version: "v1" }, // 4
          resource: { prefix: "resource", version: "v2" }, // 32 → 2048
        },
      },
    },
  });

// ── 기본 동작 ─────────────────────────────────────────────

describe("compileSchema — 기본 동작", () => {
  it("leaf 테이블의 kind와 versions를 그대로 보존한다", () => {
    const schema = compileSchema([role()]);
    const spec = schema.getTable("role")!;

    expect(spec.kind).toBe("leaf");
    expect((spec as any).entryKind).toEqual({ type: "string_enum" });
    expect(spec.versions.get("v1")!.capacity).toBe(8);
    expect(spec.versions.get("v2")!.capacity).toBe(16);
  });

  it("composite capacity는 dim capacity의 곱이다", () => {
    const schema = compileSchema([perm()]);
    const spec = schema.getTable("perm")!;

    expect(spec.kind).toBe("composite");
    expect(spec.versions.get("v1")!.capacity).toBe(8 * 4 * 16);  // 512
    expect(spec.versions.get("v2")!.capacity).toBe(16 * 4 * 32); // 2048
  });

  it("composite dims에 각 dim의 ref capacity가 포함된다", () => {
    const schema = compileSchema([perm()]);
    const v1 = (schema.getTable("perm")! as any).versions.get("v1")!;

    expect(v1.dims).toHaveLength(3);
    expect(v1.dims[0]).toEqual({ dimId: "role",     ref: { prefix: "role",     version: "v1", capacity: 8  } });
    expect(v1.dims[1]).toEqual({ dimId: "action",   ref: { prefix: "action",   version: "v1", capacity: 4  } });
    expect(v1.dims[2]).toEqual({ dimId: "resource", ref: { prefix: "resource", version: "v1", capacity: 16 } });
  });

  it("dims 체인에 있는 테이블은 자동 수집된다", () => {
    // perm만 넘겨도 role, action, resource가 자동 포함
    const schema = compileSchema([perm()]);
    expect(schema.getTable("role")).toBeDefined();
    expect(schema.getTable("action")).toBeDefined();
    expect(schema.getTable("resource")).toBeDefined();
    expect(schema.getTable("perm")).toBeDefined();
  });

  it("tables는 leaf가 composite보다 앞에 위치한다 (topological order)", () => {
    const schema = compileSchema([perm()]);
    const ids = schema.tables.map((t) => t.id);
    const permIdx = ids.indexOf("perm");
    const roleIdx = ids.indexOf("role");
    expect(roleIdx).toBeLessThan(permIdx);
  });

  it("getTable은 미등록 id에 undefined를 반환한다", () => {
    const schema = compileSchema([role()]);
    expect(schema.getTable("unknown")).toBeUndefined();
  });
});

// ── 중첩 composite ────────────────────────────────────────

describe("compileSchema — 중첩 composite", () => {
  it("composite가 composite를 참조하는 경우 capacity가 재귀 계산된다", () => {
    const docMeta = defineTable("doc_meta", {
      dims: [role(), action()],
      versions: {
        dm1: {
          refs: {
            role:   { prefix: "role",   version: "v1" }, // 8
            action: { prefix: "action", version: "v1" }, // 4 → 32
          },
        },
      },
    });

    const article = defineTable("article", {
      dims: [docMeta, resource()],
      versions: {
        av1: {
          refs: {
            doc_meta: { prefix: "doc_meta", version: "dm1" }, // 32
            resource: { prefix: "resource", version: "v1"  }, // 16 → 512
          },
        },
      },
    });

    const schema = compileSchema([article]);
    expect(schema.getTable("article")!.versions.get("av1")!.capacity).toBe(32 * 16);
  });
});

// ── 검증 ─────────────────────────────────────────────────

describe("compileSchema — 검증", () => {
  it("중복 id를 가진 서로 다른 TableDef는 ValidationError", () => {
    const a = role();
    const b = defineTable("role", {
      source: { kind: { type: "string_enum" as const } },
      versions: { v1: { capacity: 4 } },
    });
    expect(() => compileSchema([a, b])).toThrow(ValidationError);
  });

  it("composite가 존재하지 않는 버전을 참조하면 ValidationError", () => {
    const bad = defineTable("perm", {
      dims: [role()],
      versions: {
        v1: { refs: { role: { prefix: "role", version: "v99" } } }, // 없는 버전
      },
    });
    expect(() => compileSchema([bad])).toThrow(ValidationError);
  });

  it("순환 의존성이 있으면 ValidationError", () => {
    // TypeScript 타입 시스템으로는 막기 어려우므로 런타임 검증
    const a: any = { _type: "table", id: "a", dims: [], versions: {} };
    const b: any = { _type: "table", id: "b", dims: [a], versions: { v1: { refs: { a: { prefix: "a", version: "v1" } } } } };
    a.dims = [b]; // 순환
    expect(() => compileSchema([a])).toThrow(ValidationError);
  });
});

// ── diff ──────────────────────────────────────────────────

describe("compileSchema — diff", () => {
  it("테이블이 추가되면 added에 포함된다", () => {
    const prev = compileSchema([role()]);
    const next = compileSchema([role(), action()]);
    const diff = next.diff(prev);

    expect(diff.added.map((t) => t.id)).toContain("action");
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
  });

  it("테이블이 제거되면 removed에 포함된다", () => {
    const prev = compileSchema([role(), action()]);
    const next = compileSchema([role()]);
    const diff = next.diff(prev);

    expect(diff.removed).toContain("action");
    expect(diff.added).toHaveLength(0);
  });

  it("capacity가 변경된 버전은 changed에 previousCapacity와 함께 포함된다", () => {
    const v1Role = defineTable("role", {
      source: { kind: { type: "string_enum" as const } },
      versions: { v1: { capacity: 8 } },
    });
    const v2Role = defineTable("role", {
      source: { kind: { type: "string_enum" as const } },
      versions: { v1: { capacity: 16 } }, // 같은 versionId, 다른 capacity
    });

    const prev = compileSchema([v1Role]);
    const next = compileSchema([v2Role]);
    const diff = next.diff(prev);

    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].tableId).toBe("role");
    expect(diff.changed[0].addedVersions[0]).toEqual({
      versionId: "v1",
      capacity: 16,
      previousCapacity: 8,
    });
  });

  it("새 버전이 추가되면 changed.addedVersions에 포함된다", () => {
    const roleV1Only = defineTable("role", {
      source: { kind: { type: "string_enum" as const } },
      versions: { v1: { capacity: 8 } },
    });
    const roleV1V2 = defineTable("role", {
      source: { kind: { type: "string_enum" as const } },
      versions: { v1: { capacity: 8 }, v2: { capacity: 16 } },
    });

    const prev = compileSchema([roleV1Only]); // v1만
    const next = compileSchema([roleV1V2]);   // v1, v2
    const diff = next.diff(prev);

    const roleChange = diff.changed.find((c) => c.tableId === "role");
    expect(roleChange).toBeDefined();
    expect(roleChange!.addedVersions.map((v) => v.versionId)).toContain("v2");
  });

  it("capacity 변화 없으면 changed에 나타나지 않는다", () => {
    const prev = compileSchema([role()]);
    const next = compileSchema([role()]); // 동일
    const diff = next.diff(prev);

    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
  });

  it("composite의 capacity 변화도 changed에 반영된다", () => {
    const permV1 = defineTable("perm", {
      dims: [role(), action()],
      versions: {
        v1: {
          refs: {
            role:   { prefix: "role",   version: "v1" },
            action: { prefix: "action", version: "v1" },
          },
        },
      },
    });

    const roleV2 = defineTable("role", {
      source: { kind: { type: "string_enum" as const } },
      versions: { v1: { capacity: 8 }, v2: { capacity: 16 } },
    });
    const permV2 = defineTable("perm", {
      dims: [roleV2, action()],
      versions: {
        v1: { refs: { role: { prefix: "role", version: "v1" }, action: { prefix: "action", version: "v1" } } },
        v2: { refs: { role: { prefix: "role", version: "v2" }, action: { prefix: "action", version: "v1" } } },
      },
    });

    const prev = compileSchema([permV1]);
    const next = compileSchema([permV2]);
    const diff = next.diff(prev);

    const permChange = diff.changed.find((c) => c.tableId === "perm");
    expect(permChange).toBeDefined();
    expect(permChange!.addedVersions.find((v) => v.versionId === "v2")).toBeDefined();
  });
});
