// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * PrefixRegistry + syncSchemaToRegistry 테스트
 *
 * SemanticAddress "perm:v1:1345" 복원에 필요한
 * DAG 구조가 올바르게 등록·조회되는지 검증한다.
 */

import { describe, it, expect } from "vitest";
import { defineTable } from "./table-def.js";
import { compileSchema } from "./compile-schema.js";
import { InMemoryPrefixRegistry } from "./adapters/memory-prefix-registry.js";
import { syncSchemaToRegistry, applySchemaDiff } from "./schema-sync.js";
import { ValidationError } from "./errors.js";

// ── 공통 픽스처 ────────────────────────────────────────────

const role     = () => defineTable("role",     { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 8 }, v2: { capacity: 16 } } });
const action   = () => defineTable("action",   { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 4 } } });
const resource = () => defineTable("resource", { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 16 }, v2: { capacity: 32 } } });
const env      = () => defineTable("env",      { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 4 } } });

const perm = () => defineTable("perm", {
  dims: [role(), action(), resource(), env()],
  versions: {
    v1: { refs: { role: { prefix: "role", version: "v1" }, action: { prefix: "action", version: "v1" }, resource: { prefix: "resource", version: "v1" }, env: { prefix: "env", version: "v1" } } },
    v2: { refs: { role: { prefix: "role", version: "v2" }, action: { prefix: "action", version: "v1" }, resource: { prefix: "resource", version: "v2" }, env: { prefix: "env", version: "v1" } } },
  },
});

// ── PrefixRegistry 기본 동작 ──────────────────────────────

describe("PrefixRegistry — 기본 동작", () => {
  it("leaf 등록 후 capacity와 record를 조회한다", async () => {
    const reg = new InMemoryPrefixRegistry();
    await reg.register({ prefix: "role", versionId: "v1", capacity: 8 });

    expect(await reg.getCapacity("role", "v1")).toBe(8);
    expect(await reg.getRecord("role", "v1")).toEqual({ prefix: "role", versionId: "v1", capacity: 8 });
  });

  it("composite 등록 시 refs가 보존된다", async () => {
    const reg = new InMemoryPrefixRegistry();
    await reg.register({ prefix: "perm", versionId: "v1", capacity: 2048,
      refs: [
        { prefix: "role",     versionId: "v1", capacity: 8  },
        { prefix: "action",   versionId: "v1", capacity: 4  },
        { prefix: "resource", versionId: "v1", capacity: 16 },
        { prefix: "env",      versionId: "v1", capacity: 4  },
      ],
    });

    const record = await reg.getRecord("perm", "v1");
    expect(record?.refs).toHaveLength(4);
    expect(record?.refs?.[0]).toEqual({ prefix: "role", versionId: "v1", capacity: 8 });
  });

  it("중복 등록은 ValidationError", async () => {
    const reg = new InMemoryPrefixRegistry();
    await reg.register({ prefix: "role", versionId: "v1", capacity: 8 });
    await expect(reg.register({ prefix: "role", versionId: "v1", capacity: 8 })).rejects.toThrow(ValidationError);
  });
});

// ── getDeps / getTransitiveDeps ───────────────────────────

describe("getDeps — 직접 의존 조회", () => {
  it("composite의 직접 refs를 반환한다", async () => {
    const reg = new InMemoryPrefixRegistry();
    await reg.register({ prefix: "role",   versionId: "v1", capacity: 8 });
    await reg.register({ prefix: "action", versionId: "v1", capacity: 4 });
    await reg.register({ prefix: "perm",   versionId: "v1", capacity: 32,
      refs: [
        { prefix: "role",   versionId: "v1", capacity: 8 },
        { prefix: "action", versionId: "v1", capacity: 4 },
      ],
    });

    const deps = await reg.getDeps("perm", "v1");
    expect(deps.map((d) => d.prefix)).toEqual(["role", "action"]);
  });

  it("leaf는 빈 배열을 반환한다", async () => {
    const reg = new InMemoryPrefixRegistry();
    await reg.register({ prefix: "role", versionId: "v1", capacity: 8 });
    expect(await reg.getDeps("role", "v1")).toEqual([]);
  });
});

describe("getTransitiveDeps — 전이적 의존 조회", () => {
  it("중첩 composite의 모든 deps를 평탄화해 반환한다", async () => {
    // format, lang → doc_meta → article
    const reg = new InMemoryPrefixRegistry();
    await reg.register({ prefix: "format", versionId: "v1", capacity: 2 });
    await reg.register({ prefix: "lang",   versionId: "v1", capacity: 2 });
    await reg.register({ prefix: "doc_meta", versionId: "v1", capacity: 4,
      refs: [
        { prefix: "format", versionId: "v1", capacity: 2 },
        { prefix: "lang",   versionId: "v1", capacity: 2 },
      ],
    });
    await reg.register({ prefix: "tier", versionId: "v1", capacity: 3 });
    await reg.register({ prefix: "article", versionId: "v1", capacity: 12,
      refs: [
        { prefix: "doc_meta", versionId: "v1", capacity: 4 },
        { prefix: "tier",     versionId: "v1", capacity: 3 },
      ],
    });

    const deps = await reg.getTransitiveDeps("article", "v1");
    const prefixes = deps.map((d) => d.prefix);

    // doc_meta, tier (직접) + format, lang (doc_meta의 deps)
    expect(prefixes).toContain("doc_meta");
    expect(prefixes).toContain("tier");
    expect(prefixes).toContain("format");
    expect(prefixes).toContain("lang");
  });

  it("leaf는 빈 배열을 반환한다", async () => {
    const reg = new InMemoryPrefixRegistry();
    await reg.register({ prefix: "role", versionId: "v1", capacity: 8 });
    expect(await reg.getTransitiveDeps("role", "v1")).toEqual([]);
  });
});

// ── getReverseRefs — cascade 감지 ─────────────────────────

describe("getReverseRefs — 역방향 조회", () => {
  it("role:v1을 참조하는 composite를 찾는다", async () => {
    const reg = new InMemoryPrefixRegistry();
    await reg.register({ prefix: "role",   versionId: "v1", capacity: 8 });
    await reg.register({ prefix: "action", versionId: "v1", capacity: 4 });
    await reg.register({ prefix: "perm",   versionId: "v1", capacity: 32,
      refs: [
        { prefix: "role",   versionId: "v1", capacity: 8 },
        { prefix: "action", versionId: "v1", capacity: 4 },
      ],
    });
    await reg.register({ prefix: "audit",  versionId: "v1", capacity: 16,
      refs: [{ prefix: "role", versionId: "v1", capacity: 8 }],
    });

    const reverses = await reg.getReverseRefs("role", "v1");
    const prefixes = reverses.map((r) => r.prefix).toSorted();
    expect(prefixes).toEqual(["audit", "perm"]);
  });

  it("role:v2를 참조하는 composite는 role:v1 reverse에 포함되지 않는다", async () => {
    const reg = new InMemoryPrefixRegistry();
    await reg.register({ prefix: "role", versionId: "v1", capacity: 8 });
    await reg.register({ prefix: "role", versionId: "v2", capacity: 16 });
    await reg.register({ prefix: "perm", versionId: "v2", capacity: 64,
      refs: [{ prefix: "role", versionId: "v2", capacity: 16 }],
    });

    const reverses = await reg.getReverseRefs("role", "v1");
    expect(reverses).toHaveLength(0);
  });
});

// ── syncSchemaToRegistry ──────────────────────────────────

describe("syncSchemaToRegistry", () => {
  it("leaf와 composite가 모두 registry에 등록된다", async () => {
    const schema = compileSchema([perm()]);
    const reg = new InMemoryPrefixRegistry();
    await syncSchemaToRegistry(schema, reg);

    // leaf들
    expect(await reg.getCapacity("role",     "v1")).toBe(8);
    expect(await reg.getCapacity("action",   "v1")).toBe(4);
    expect(await reg.getCapacity("resource", "v1")).toBe(16);
    expect(await reg.getCapacity("env",      "v1")).toBe(4);

    // composite
    expect(await reg.getCapacity("perm", "v1")).toBe(8 * 4 * 16 * 4); // 2048
    expect(await reg.getCapacity("perm", "v2")).toBe(16 * 4 * 32 * 4); // 8192
  });

  it("composite의 refs가 올바르게 등록된다", async () => {
    const schema = compileSchema([perm()]);
    const reg = new InMemoryPrefixRegistry();
    await syncSchemaToRegistry(schema, reg);

    const record = await reg.getRecord("perm", "v1");
    expect(record?.refs).toHaveLength(4);
    expect(record?.refs?.map((r) => r.prefix)).toEqual(["role", "action", "resource", "env"]);
    expect(record?.refs?.map((r) => r.capacity)).toEqual([8, 4, 16, 4]);
  });

  it("이미 등록된 버전은 건너뛴다 (idempotent)", async () => {
    const schema = compileSchema([perm()]);
    const reg = new InMemoryPrefixRegistry();
    await syncSchemaToRegistry(schema, reg);
    await syncSchemaToRegistry(schema, reg); // 두 번 호출해도 에러 없음

    expect(await reg.getCapacity("perm", "v1")).toBe(2048);
  });

  it("syncSchemaToRegistry 후 SemanticAddress 복원 경로가 완성된다", async () => {
    // "perm:v1:1345" 복원에 필요한 정보가 모두 registry에 있는지 확인
    const schema = compileSchema([perm()]);
    const reg = new InMemoryPrefixRegistry();
    await syncSchemaToRegistry(schema, reg);

    // 1. capacity로 WeightedIndex 생성 가능
    const permRecord = await reg.getRecord("perm", "v1");
    expect(permRecord?.capacity).toBe(2048); // 1345 < 2048 → 유효한 주소

    // 2. refs로 각 dim의 주소 공간 파악 가능
    const shape = permRecord!.refs!.map((r) => r.capacity);
    expect(shape).toEqual([8, 4, 16, 4]); // WeightedIndex([8,4,16,4]) 복원 가능

    // 3. 각 dim ref가 registry에 등록되어 있어 재귀 조회 가능
    for (const ref of permRecord!.refs!) {
      expect(await reg.getCapacity(ref.prefix, ref.versionId)).not.toBeNull();
    }
  });

  it("cascade 감지: role에 새 버전이 생기면 perm이 reverse에 잡힌다", async () => {
    const schema = compileSchema([perm()]);
    const reg = new InMemoryPrefixRegistry();
    await syncSchemaToRegistry(schema, reg);

    // role:v1을 참조하는 composite 조회
    const affected = await reg.getReverseRefs("role", "v1");
    const prefixes = affected.map((r) => r.prefix);
    expect(prefixes).toContain("perm"); // perm v1이 영향권
  });
});

// ── updateCapacity ──────────────────────────────────────

describe("updateCapacity", () => {
  it("leaf의 capacity를 갱신한다", async () => {
    const reg = new InMemoryPrefixRegistry();
    await reg.register({ prefix: "role", versionId: "v1", capacity: 8 });

    await reg.updateCapacity("role", "v1", 16);
    expect(await reg.getCapacity("role", "v1")).toBe(16);
  });

  it("composite의 capacity와 refs를 함께 갱신한다", async () => {
    const reg = new InMemoryPrefixRegistry();
    await reg.register({ prefix: "role",   versionId: "v1", capacity: 8 });
    await reg.register({ prefix: "action", versionId: "v1", capacity: 4 });
    await reg.register({ prefix: "perm",   versionId: "v1", capacity: 32,
      refs: [
        { prefix: "role",   versionId: "v1", capacity: 8 },
        { prefix: "action", versionId: "v1", capacity: 4 },
      ],
    });

    await reg.updateCapacity("perm", "v1", 64, [
      { prefix: "role",   versionId: "v1", capacity: 16 },
      { prefix: "action", versionId: "v1", capacity: 4 },
    ]);

    expect(await reg.getCapacity("perm", "v1")).toBe(64);
    const record = await reg.getRecord("perm", "v1");
    expect(record?.refs?.[0].capacity).toBe(16);
  });

  it("미등록 prefix에 대해 ValidationError", async () => {
    const reg = new InMemoryPrefixRegistry();
    await expect(reg.updateCapacity("role", "v1", 16)).rejects.toThrow(ValidationError);
  });
});

// ── applySchemaDiff ─────────────────────────────────────

describe("applySchemaDiff", () => {
  it("신규 테이블이 diff.added에서 등록된다", async () => {
    // v1 스키마 → 등록
    const roleV1 = defineTable("role", { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 8 } } });
    const schema1 = compileSchema([roleV1]);
    const reg = new InMemoryPrefixRegistry();
    await syncSchemaToRegistry(schema1, reg);

    // v2 스키마: action 추가
    const actionDef = defineTable("action", { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 4 } } });
    const schema2 = compileSchema([roleV1, actionDef]);
    const diff = schema2.diff(schema1);

    const result = await applySchemaDiff(diff, schema2, reg);
    expect(result.registered).toEqual([{ prefix: "action", versionId: "v1" }]);
    expect(await reg.getCapacity("action", "v1")).toBe(4);
  });

  it("capacity 변경이 updateCapacity로 반영된다", async () => {
    const roleV1 = defineTable("role", { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 8 } } });
    const schema1 = compileSchema([roleV1]);
    const reg = new InMemoryPrefixRegistry();
    await syncSchemaToRegistry(schema1, reg);

    // capacity 확장: 8 → 16
    const roleV1Expanded = defineTable("role", { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 16 } } });
    const schema2 = compileSchema([roleV1Expanded]);
    const diff = schema2.diff(schema1);

    const result = await applySchemaDiff(diff, schema2, reg);
    expect(result.updated).toEqual([{ prefix: "role", versionId: "v1", previousCapacity: 8, capacity: 16 }]);
    expect(await reg.getCapacity("role", "v1")).toBe(16);
  });

  it("leaf capacity 변경이 composite에 cascade된다", async () => {
    const roleDef = defineTable("role", { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 8 } } });
    const actionDef = defineTable("action", { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 4 } } });
    const permDef = defineTable("perm", {
      dims: [roleDef, actionDef],
      versions: { v1: { refs: { role: { prefix: "role", version: "v1" }, action: { prefix: "action", version: "v1" } } } },
    });
    const schema1 = compileSchema([permDef]);
    const reg = new InMemoryPrefixRegistry();
    await syncSchemaToRegistry(schema1, reg);
    expect(await reg.getCapacity("perm", "v1")).toBe(32); // 8 * 4

    // role capacity 확장: 8 → 16
    const roleExpanded = defineTable("role", { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 16 } } });
    const permExpanded = defineTable("perm", {
      dims: [roleExpanded, actionDef],
      versions: { v1: { refs: { role: { prefix: "role", version: "v1" }, action: { prefix: "action", version: "v1" } } } },
    });
    const schema2 = compileSchema([permExpanded]);
    const diff = schema2.diff(schema1);

    const result = await applySchemaDiff(diff, schema2, reg);

    // role과 perm 모두 갱신
    expect(result.updated.find((u) => u.prefix === "role")?.capacity).toBe(16);
    expect(result.updated.find((u) => u.prefix === "perm")?.capacity).toBe(64); // 16 * 4
    expect(await reg.getCapacity("perm", "v1")).toBe(64);
  });

  it("제거된 테이블은 removedWarnings로 반환된다", async () => {
    const roleDef = defineTable("role", { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 8 } } });
    const actionDef = defineTable("action", { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 4 } } });
    const schema1 = compileSchema([roleDef, actionDef]);
    const reg = new InMemoryPrefixRegistry();
    await syncSchemaToRegistry(schema1, reg);

    // action 제거
    const schema2 = compileSchema([roleDef]);
    const diff = schema2.diff(schema1);

    const result = await applySchemaDiff(diff, schema2, reg);
    expect(result.removedWarnings).toEqual(["action"]);
    // 레지스트리에서는 삭제되지 않음
    expect(await reg.getCapacity("action", "v1")).toBe(4);
  });

  it("신규 버전 추가가 올바르게 등록된다", async () => {
    const roleDef = defineTable("role", { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 8 } } });
    const schema1 = compileSchema([roleDef]);
    const reg = new InMemoryPrefixRegistry();
    await syncSchemaToRegistry(schema1, reg);

    // v2 버전 추가
    const roleWithV2 = defineTable("role", { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 8 }, v2: { capacity: 16 } } });
    const schema2 = compileSchema([roleWithV2]);
    const diff = schema2.diff(schema1);

    const result = await applySchemaDiff(diff, schema2, reg);
    expect(result.registered).toEqual([{ prefix: "role", versionId: "v2" }]);
    expect(await reg.getCapacity("role", "v2")).toBe(16);
    // 기존 v1은 그대로
    expect(await reg.getCapacity("role", "v1")).toBe(8);
  });
});
