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
import type { DataSchema, FieldSet, FieldLineage } from "../types/data-schema.js";

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

// ── 추가 엣지 케이스 ─────────────────────────────────

describe("checkCompatibility — 엣지 케이스", () => {
  it("빈 생산자 + 소비자 필수 필드 → breaking", () => {
    const producer = makeFieldSet({});
    const consumer = makeFieldSet({ id: { type: "string", required: true } });
    const result = checkCompatibility(producer, consumer);
    expect(result.breaking).toBe(true);
    expect(result.missingFields).toEqual(["id"]);
  });

  it("빈 소비자 → 항상 호환 (아무것도 기대 안 함)", () => {
    const producer = makeFieldSet({ id: { type: "string", required: true }, name: { type: "string", required: true } });
    const consumer = makeFieldSet({});
    const result = checkCompatibility(producer, consumer);
    expect(result.compatible).toBe(true);
    expect(result.extraFields).toHaveLength(2);
  });

  it("복합 실패 — 누락 + 타입 불일치 동시", () => {
    const producer = makeFieldSet({ id: { type: "string", required: true }, amount: { type: "string", required: true } });
    const consumer = makeFieldSet({ id: { type: "string", required: true }, amount: { type: "number", required: true }, status: { type: "string", required: true } });
    const result = checkCompatibility(producer, consumer);
    expect(result.breaking).toBe(true);
    expect(result.missingFields).toContain("status");
    expect(result.typeMismatches).toHaveLength(1);
  });

  it("양쪽 모두 optional — 호환", () => {
    const producer = makeFieldSet({ hint: { type: "string", required: false } });
    const consumer = makeFieldSet({ hint: { type: "string", required: false }, extra: { type: "number", required: false } });
    const result = checkCompatibility(producer, consumer);
    expect(result.compatible).toBe(true);
  });
});

describe("collectSchemaChanges — 복합 변경", () => {
  it("추가 + 제거 + 타입 변경 동시", () => {
    const old = makeSchema("s", "v1", {
      id: { type: "string", required: true },
      legacy: { type: "string", required: false },
      amount: { type: "string", required: true },
    });
    const next = makeSchema("s", "v2", {
      id: { type: "string", required: true },
      amount: { type: "number", required: true },   // 타입 변경
      newField: { type: "string", required: false }, // 추가
      // legacy 제거
    });
    const changes = collectSchemaChanges(old, next);
    expect(changes.some(c => c.type === "remove" && c.column === "legacy")).toBe(true);
    expect(changes.some(c => c.type === "type-change" && c.column === "amount")).toBe(true);
    expect(changes.some(c => c.type === "add-optional" && c.column === "newField")).toBe(true);
    expect(determineCompatibility(changes)).toBe("breaking");
  });

  it("제약 추가 + 기본값 추가 동시", () => {
    const old = makeSchema("s", "v1", { id: { type: "string", required: true } });
    old.columns["id"].constraints = [];
    const next = makeSchema("s", "v2", { id: { type: "string", required: true } });
    next.columns["id"].constraints = [{ type: "unique" }];
    next.columns["id"].defaultValue = "auto";

    const changes = collectSchemaChanges(old, next);
    expect(changes.some(c => c.type === "constraint-add")).toBe(true);
    expect(changes.some(c => c.type === "default-add")).toBe(true);
  });
});

describe("LineageCollector — 엣지 케이스", () => {
  function makeLineage2(
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

  it("다이아몬드 계보: A,B → C → D", () => {
    const collector = new LineageCollector();
    collector.record(makeLineage2(["c", "val"], [["a", "x"], ["b", "y"]], "compute"));
    collector.record(makeLineage2(["d", "result"], [["c", "val"]], "direct"));

    // D의 원본 추적 → C, A, B
    const origins = collector.traceOrigins({ schemaId: "d", column: "result" });
    expect(origins).toHaveLength(2); // d←c, c←(a,b)

    // A의 영향 추적 → C, D
    const impact = collector.traceImpact({ schemaId: "a", column: "x" });
    expect(impact).toHaveLength(2); // a→c, c→d
  });

  it("빈 collector에서 조회 → 빈 배열", () => {
    const collector = new LineageCollector();
    expect(collector.traceOrigins({ schemaId: "x", column: "y" })).toEqual([]);
    expect(collector.traceImpact({ schemaId: "x", column: "y" })).toEqual([]);
    expect(collector.getSchemaLineage("x")).toEqual([]);
    expect(collector.getAll()).toEqual([]);
  });

  it("순환 계보 방지 (A → B → A)", () => {
    const collector = new LineageCollector();
    collector.record(makeLineage2(["b", "val"], [["a", "val"]]));
    collector.record(makeLineage2(["a", "val"], [["b", "val"]]));

    // 무한 루프 없이 종료
    const origins = collector.traceOrigins({ schemaId: "a", column: "val" });
    expect(origins.length).toBeGreaterThan(0);
    expect(origins.length).toBeLessThanOrEqual(2);
  });

  it("다중 변환 유형 추적", () => {
    const collector = new LineageCollector();
    collector.record(makeLineage2(["order", "total"], [["item", "price"], ["item", "qty"]], "compute"));
    collector.record(makeLineage2(["order", "user_name"], [["user", "name"]], "rename"));
    collector.record(makeLineage2(["report", "revenue"], [["order", "total"]], "aggregate"));

    const all = collector.getAll();
    expect(all.map(l => l.transform)).toContain("compute");
    expect(all.map(l => l.transform)).toContain("rename");
    expect(all.map(l => l.transform)).toContain("aggregate");
  });
});

describe("VersionCollector — 버전 체인", () => {
  it("v1→v2→v3→v4 체인 전체 이력", () => {
    const collector = new VersionCollector();
    const v1 = makeSchema("s", "v1", { id: { type: "string", required: true } });
    const v2 = makeSchema("s", "v2", { id: { type: "string", required: true }, a: { type: "string", required: false } });
    const v3 = makeSchema("s", "v3", { id: { type: "string", required: true }, a: { type: "string", required: false }, b: { type: "number", required: false } });
    const v4 = makeSchema("s", "v4", { id: { type: "string", required: true }, b: { type: "number", required: false } }); // a 제거

    collector.record(createSchemaVersion(v1, v2, "a 추가"));
    collector.record(createSchemaVersion(v2, v3, "b 추가"));
    collector.record(createSchemaVersion(v3, v4, "a 제거"));

    expect(collector.getHistory("s")).toHaveLength(3);
    expect(collector.getHistory("s").map(v => v.compatibility)).toEqual(["backward", "backward", "breaking"]);
    expect(collector.getBreakingChanges("s")).toHaveLength(1);
    expect(collector.getLatest("s")!.version).toBe("v4");
  });
});

// ── 통합 시나리오 ────────────────────────────────────

describe("실전 시나리오: 주문→결제→리포트 전체 계보", () => {
  it("catalog → cart → order → payment → report 필드 추적", () => {
    const collector = new LineageCollector();

    // catalog.base_price → items.price (direct)
    collector.record({
      target: { schemaId: "items", column: "price" },
      sources: [{ schemaId: "catalog", column: "base_price" }],
      transform: "direct",
      pipeId: "sync-catalog",
      stepPath: "flow.steps[0]",
    });

    // items.price × cart_items.qty → cart_items.subtotal (compute)
    collector.record({
      target: { schemaId: "cart_items", column: "subtotal" },
      sources: [
        { schemaId: "items", column: "price" },
        { schemaId: "cart_items", column: "quantity" },
      ],
      transform: "compute",
      pipeId: "calc-subtotal",
      stepPath: "flow.steps[1]",
    });

    // Σ cart_items.subtotal → orders.total_amount (aggregate)
    collector.record({
      target: { schemaId: "orders", column: "total_amount" },
      sources: [{ schemaId: "cart_items", column: "subtotal" }],
      transform: "aggregate",
      pipeId: "create-order",
      stepPath: "flow.steps[2]",
    });

    // orders.total_amount → payments.amount (direct)
    collector.record({
      target: { schemaId: "payments", column: "amount" },
      sources: [{ schemaId: "orders", column: "total_amount" }],
      transform: "direct",
      pipeId: "process-payment",
      stepPath: "flow.steps[0]",
    });

    // Σ payments.amount → report.revenue (aggregate)
    collector.record({
      target: { schemaId: "report", column: "revenue" },
      sources: [{ schemaId: "payments", column: "amount" }],
      transform: "aggregate",
      pipeId: "generate-report",
      stepPath: "flow.steps[0]",
    });

    // catalog.base_price 변경 시 영향 범위
    const impact = collector.traceImpact({ schemaId: "catalog", column: "base_price" });
    const affectedSchemas = new Set(impact.map(l => l.target.schemaId));

    expect(affectedSchemas).toContain("items");
    expect(affectedSchemas).toContain("cart_items");
    expect(affectedSchemas).toContain("orders");
    expect(affectedSchemas).toContain("payments");
    expect(affectedSchemas).toContain("report");
    expect(impact).toHaveLength(5); // 5단계 전파

    // report.revenue의 원본 추적
    const origins = collector.traceOrigins({ schemaId: "report", column: "revenue" });
    const originSchemas = new Set(origins.flatMap(l => l.sources.map(s => s.schemaId)));
    expect(originSchemas).toContain("catalog");
    expect(originSchemas).toContain("items");
    expect(originSchemas).toContain("cart_items");
    expect(originSchemas).toContain("orders");
    expect(originSchemas).toContain("payments");
  });

  it("스키마 진화 + 호환 검증 + 계보 영향 분석", () => {
    // v1: orders 스키마
    const ordersV1 = makeSchema("orders", "v1", {
      id: { type: "string", required: true },
      total_amount: { type: "number", required: true },
      member_id: { type: "string", required: true },
    });

    // v2: discount 필드 추가 (backward compatible)
    const ordersV2 = makeSchema("orders", "v2", {
      id: { type: "string", required: true },
      total_amount: { type: "number", required: true },
      member_id: { type: "string", required: true },
      discount: { type: "number", required: false },
    });

    // v3: member_id 제거 (BREAKING)
    const ordersV3 = makeSchema("orders", "v3", {
      id: { type: "string", required: true },
      total_amount: { type: "number", required: true },
      discount: { type: "number", required: false },
    });

    // 버전 수집
    const versionCollector = new VersionCollector();
    versionCollector.record(createSchemaVersion(ordersV1, ordersV2));
    versionCollector.record(createSchemaVersion(ordersV2, ordersV3));

    expect(versionCollector.getHistory("orders")[0].compatibility).toBe("backward");
    expect(versionCollector.getHistory("orders")[1].compatibility).toBe("breaking");

    // v3에서 member_id를 소비하는 파이프는 호환 실패
    const consumerExpected = makeFieldSet({
      id: { type: "string", required: true },
      total_amount: { type: "number", required: true },
      member_id: { type: "string", required: true }, // 여전히 기대
    });
    const producerV3 = makeFieldSet({
      id: { type: "string", required: true },
      total_amount: { type: "number", required: true },
      discount: { type: "number", required: false },
    });

    const compat = checkCompatibility(producerV3, consumerExpected);
    expect(compat.breaking).toBe(true);
    expect(compat.missingFields).toContain("member_id");
  });
});
