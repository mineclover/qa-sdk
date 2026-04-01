import { describe, it, expect } from "vitest";
import {
  checkCompatibility,
  computeSchemaHash,
  collectSchemaChanges,
  determineCompatibility,
  createSchemaVersion,
  LineageCollector,
  VersionCollector,
} from "./data-contract.js";
import type { DataSchema, FieldSet, FieldLineage } from "./types/data-schema.js";

// ── 헬퍼 ─────────────────────────────────────────────

function makeSchema(id: string, version: string, cols: Record<string, { type: string; required: boolean }>): DataSchema {
  const columns: DataSchema["columns"] = {};
  for (const [name, { type, required }] of Object.entries(cols)) {
    columns[name] = { ref: { kind: "scalar", type }, required };
  }
  return { schemaId: id, version, columns, primaryKey: ["id"], schemaHash: "" };
}

function makeFieldSet(fields: Record<string, { type: string; required: boolean }>): FieldSet {
  const result: FieldSet = { fields: {} };
  for (const [name, spec] of Object.entries(fields)) {
    result.fields[name] = { type: spec.type, required: spec.required };
  }
  return result;
}

// ── 호환성 검증 ──────────────────────────────────────

describe("checkCompatibility", () => {
  it("완전 호환", () => {
    const producer = makeFieldSet({ id: { type: "string", required: true }, name: { type: "string", required: true } });
    const consumer = makeFieldSet({ id: { type: "string", required: true }, name: { type: "string", required: true } });
    const result = checkCompatibility(producer, consumer);
    expect(result.compatible).toBe(true);
    expect(result.breaking).toBe(false);
  });

  it("상위 호환 — 생산자에 추가 필드", () => {
    const producer = makeFieldSet({ id: { type: "string", required: true }, name: { type: "string", required: true }, extra: { type: "number", required: false } });
    const consumer = makeFieldSet({ id: { type: "string", required: true }, name: { type: "string", required: true } });
    const result = checkCompatibility(producer, consumer);
    expect(result.compatible).toBe(true);
    expect(result.extraFields).toContain("extra");
  });

  it("비호환 — 소비자 필수 필드 누락", () => {
    const producer = makeFieldSet({ id: { type: "string", required: true } });
    const consumer = makeFieldSet({ id: { type: "string", required: true }, name: { type: "string", required: true } });
    const result = checkCompatibility(producer, consumer);
    expect(result.compatible).toBe(false);
    expect(result.missingFields).toContain("name");
    expect(result.breaking).toBe(true);
  });

  it("비호환 — 타입 불일치", () => {
    const producer = makeFieldSet({ id: { type: "string", required: true }, amount: { type: "string", required: true } });
    const consumer = makeFieldSet({ id: { type: "string", required: true }, amount: { type: "number", required: true } });
    const result = checkCompatibility(producer, consumer);
    expect(result.compatible).toBe(false);
    expect(result.typeMismatches).toHaveLength(1);
    expect(result.typeMismatches[0].field).toBe("amount");
  });

  it("소비자 optional 필드 누락 — 호환", () => {
    const producer = makeFieldSet({ id: { type: "string", required: true } });
    const consumer = makeFieldSet({ id: { type: "string", required: true }, hint: { type: "string", required: false } });
    const result = checkCompatibility(producer, consumer);
    expect(result.compatible).toBe(true);
  });
});

// ── 스키마 해시 ──────────────────────────────────────

describe("computeSchemaHash", () => {
  it("같은 구조 → 같은 해시", () => {
    const a = makeSchema("s", "v1", { name: { type: "string", required: true }, age: { type: "number", required: true } });
    const b = makeSchema("s", "v1", { age: { type: "number", required: true }, name: { type: "string", required: true } });
    expect(computeSchemaHash(a)).toBe(computeSchemaHash(b));
  });

  it("다른 구조 → 다른 해시", () => {
    const a = makeSchema("s", "v1", { name: { type: "string", required: true } });
    const b = makeSchema("s", "v1", { name: { type: "number", required: true } });
    expect(computeSchemaHash(a)).not.toBe(computeSchemaHash(b));
  });
});

// ── 스키마 변경 수집 ─────────────────────────────────

describe("collectSchemaChanges", () => {
  it("필드 추가 (optional)", () => {
    const old = makeSchema("s", "v1", { id: { type: "string", required: true } });
    const next = makeSchema("s", "v2", { id: { type: "string", required: true }, hint: { type: "string", required: false } });
    const changes = collectSchemaChanges(old, next);
    expect(changes).toEqual([{ type: "add-optional", column: "hint" }]);
  });

  it("필드 추가 (required) — breaking", () => {
    const old = makeSchema("s", "v1", { id: { type: "string", required: true } });
    const next = makeSchema("s", "v2", { id: { type: "string", required: true }, name: { type: "string", required: true } });
    const changes = collectSchemaChanges(old, next);
    expect(changes).toEqual([{ type: "add-required", column: "name" }]);
  });

  it("필드 제거 — breaking", () => {
    const old = makeSchema("s", "v1", { id: { type: "string", required: true }, legacy: { type: "string", required: false } });
    const next = makeSchema("s", "v2", { id: { type: "string", required: true } });
    const changes = collectSchemaChanges(old, next);
    expect(changes).toEqual([{ type: "remove", column: "legacy" }]);
  });

  it("타입 변경 — breaking", () => {
    const old = makeSchema("s", "v1", { amount: { type: "string", required: true } });
    const next = makeSchema("s", "v2", { amount: { type: "number", required: true } });
    const changes = collectSchemaChanges(old, next);
    expect(changes[0].type).toBe("type-change");
  });

  it("변경 없음", () => {
    const s = makeSchema("s", "v1", { id: { type: "string", required: true } });
    expect(collectSchemaChanges(s, s)).toEqual([]);
  });
});

describe("determineCompatibility", () => {
  it("breaking 변경 → breaking", () => {
    expect(determineCompatibility([{ type: "remove", column: "x" }])).toBe("breaking");
    expect(determineCompatibility([{ type: "add-required", column: "x" }])).toBe("breaking");
    expect(determineCompatibility([{ type: "type-change", column: "x" }])).toBe("breaking");
  });

  it("optional 추가만 → backward", () => {
    expect(determineCompatibility([{ type: "add-optional", column: "x" }])).toBe("backward");
  });

  it("변경 없음 → full", () => {
    expect(determineCompatibility([])).toBe("full");
  });

  it("제약 추가 → forward", () => {
    expect(determineCompatibility([{ type: "constraint-add", column: "x" }])).toBe("forward");
  });
});

describe("createSchemaVersion", () => {
  it("두 스키마에서 SchemaVersion 생성", () => {
    const old = makeSchema("orders", "v1", { id: { type: "string", required: true } });
    const next = makeSchema("orders", "v2", { id: { type: "string", required: true }, discount: { type: "number", required: false } });
    const version = createSchemaVersion(old, next, "discount 필드 추가");
    expect(version.schemaId).toBe("orders");
    expect(version.version).toBe("v2");
    expect(version.previousVersion).toBe("v1");
    expect(version.compatibility).toBe("backward");
    expect(version.changes).toHaveLength(1);
    expect(version.changelog).toBe("discount 필드 추가");
  });
});

// ── 계보 수집 ─────────────────────────────────────────

describe("LineageCollector", () => {
  function makeLineage(
    target: [string, string],
    sources: [string, string][],
    transform: FieldLineage["transform"] = "direct",
  ): FieldLineage {
    return {
      target: { schemaId: target[0], column: target[1] },
      sources: sources.map(([s, c]) => ({ schemaId: s, column: c })),
      transform,
      pipeId: "p1",
      stepPath: "flow.steps[0]",
    };
  }

  it("계보 기록 + 원본 추적", () => {
    const collector = new LineageCollector();
    collector.record(makeLineage(["orders", "total"], [["items", "price"]], "compute"));
    collector.record(makeLineage(["items", "price"], [["catalog", "base_price"]], "direct"));

    const origins = collector.traceOrigins({ schemaId: "orders", column: "total" });
    expect(origins).toHaveLength(2); // orders.total ← items.price ← catalog.base_price
  });

  it("영향 추적 (순방향)", () => {
    const collector = new LineageCollector();
    collector.record(makeLineage(["orders", "total"], [["items", "price"]], "compute"));
    collector.record(makeLineage(["report", "revenue"], [["orders", "total"]], "aggregate"));

    const impact = collector.traceImpact({ schemaId: "items", column: "price" });
    expect(impact).toHaveLength(2); // items.price → orders.total → report.revenue
  });

  it("스키마별 계보 조회", () => {
    const collector = new LineageCollector();
    collector.record(makeLineage(["orders", "total"], [["items", "price"]]));
    collector.record(makeLineage(["orders", "status"], [["workflow", "state"]]));
    collector.record(makeLineage(["report", "count"], [["events", "id"]]));

    expect(collector.getSchemaLineage("orders")).toHaveLength(2);
    expect(collector.getSchemaLineage("report")).toHaveLength(1);
  });
});

// ── 버전 수집 ─────────────────────────────────────────

describe("VersionCollector", () => {
  it("버전 기록 + 이력 조회", () => {
    const collector = new VersionCollector();
    const old = makeSchema("orders", "v1", { id: { type: "string", required: true } });
    const v2 = makeSchema("orders", "v2", { id: { type: "string", required: true }, hint: { type: "string", required: false } });
    const v3 = makeSchema("orders", "v3", { id: { type: "string", required: true } }); // hint 제거

    collector.record(createSchemaVersion(old, v2, "hint 추가"));
    collector.record(createSchemaVersion(v2, v3, "hint 제거"));

    expect(collector.getHistory("orders")).toHaveLength(2);
    expect(collector.getLatest("orders")!.version).toBe("v3");
  });

  it("breaking 변경 필터링", () => {
    const collector = new VersionCollector();
    const v1 = makeSchema("s", "v1", { id: { type: "string", required: true } });
    const v2 = makeSchema("s", "v2", { id: { type: "string", required: true }, opt: { type: "string", required: false } });
    const v3 = makeSchema("s", "v3", { id: { type: "string", required: true } }); // opt 제거

    collector.record(createSchemaVersion(v1, v2)); // backward
    collector.record(createSchemaVersion(v2, v3)); // breaking (remove)

    expect(collector.getBreakingChanges("s")).toHaveLength(1);
    expect(collector.getBreakingChanges("s")[0].version).toBe("v3");
  });

  it("전체 스키마 목록", () => {
    const collector = new VersionCollector();
    const a = makeSchema("orders", "v1", { id: { type: "string", required: true } });
    const b = makeSchema("users", "v1", { id: { type: "string", required: true } });
    collector.record(createSchemaVersion(a, { ...a, version: "v2" }));
    collector.record(createSchemaVersion(b, { ...b, version: "v2" }));

    expect(collector.listSchemas()).toContain("orders");
    expect(collector.listSchemas()).toContain("users");
  });
});
