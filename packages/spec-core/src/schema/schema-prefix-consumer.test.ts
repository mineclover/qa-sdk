/**
 * SchemaValidator as Prefix Consumer — 통합 테스트.
 *
 * Phase 2: schema-validation-codec
 * Phase 3: schema-observation-bridge
 * Phase 4: schema-health-audit
 */
import { describe, it, expect, beforeEach } from "vitest";
import { DEMO_CATALOG } from "demo-snapshot";
import { GraphRegistry } from "../dkg/graph-registry.js";
import { deriveFromCatalog } from "../dkg/catalog-derive.js";
import { SchemaRegistry } from "./schema.registry.js";
import { SchemaValidator, type ValidationResult } from "./schema.validator.js";
import {
  mapErrorToCoordinate,
  mapValidationToCoordinates,
  decodeCoordinate,
  AXIS_ENTRIES,
} from "./schema-validation-codec.js";
import { bridgeValidationToObservation } from "./schema-observation-bridge.js";
import { auditSchemaHealth } from "./schema-health-audit.js";
import type { ValidationErrorDetail } from "../shared/errors.js";

let graph: GraphRegistry;

beforeEach(() => {
  graph = deriveFromCatalog(DEMO_CATALOG);
});

// ═══════════════════════════════════════════════════════════════
//  Phase 2: schema-validation-codec
// ═══════════════════════════════════════════════════════════════

describe("SchemaValidationCodec", () => {
  it("에러를 좌표로 매핑", () => {
    const error: ValidationErrorDetail = { layer: 2, axis: "actor", rule: "required", message: "missing" };
    const coord = mapErrorToCoordinate(error);

    expect(coord.validationLayer).toBe(2); // constraint
    expect(coord.constraintRule).toBe(0);  // "required" 는 첫 번째
    expect(coord.verdictResult).toBe(1);   // "fail"
  });

  it("에러 없으면 pass 좌표", () => {
    const coords = mapValidationToCoordinates([]);
    expect(coords).toHaveLength(1);
    expect(coords[0].verdictResult).toBe(0); // "pass"
  });

  it("좌표 디코딩", () => {
    const coord = { schemaRef: 0, validationLayer: 1, constraintRule: 7, verdictResult: 1 };
    const decoded = decodeCoordinate(coord);
    expect(decoded.layer).toBe("structural");
    expect(decoded.rule).toBe("unknownAxis");
    expect(decoded.verdict).toBe("fail");
  });

  it("축 entries가 DEMO_CATALOG과 일치 확인", () => {
    // validation_layer
    const vlAxis = DEMO_CATALOG.axes.validation_layer;
    const vlEntries = vlAxis.versions.v1.entries;
    expect([...vlEntries]).toEqual([...AXIS_ENTRIES.validationLayer]);

    // constraint_rule
    const crAxis = DEMO_CATALOG.axes.constraint_rule;
    const crEntries = crAxis.versions.v1.entries;
    expect([...crEntries]).toEqual([...AXIS_ENTRIES.constraintRule]);
  });
});

// ═══════════════════════════════════════════════════════════════
//  Phase 3: schema-observation-bridge
// ═══════════════════════════════════════════════════════════════

describe("SchemaObservationBridge", () => {
  it("valid 결과 → observation 없음", () => {
    const result: ValidationResult = { valid: true, errors: [] };
    const bridged = bridgeValidationToObservation("event.base", result, { date: "2026-03-21" });

    expect(bridged.observations).toHaveLength(0);
    expect(bridged.summary).toContain("통과");
  });

  it("에러 → 레이어별 observation 생성", () => {
    const result: ValidationResult = {
      valid: false,
      errors: [
        { layer: 0, axis: "action", rule: "type", message: "wrong type" },
        { layer: 2, axis: "actor", rule: "required", message: "missing" },
        { layer: 2, axis: "target", rule: "maxCount", message: "too many" },
      ],
    };

    const bridged = bridgeValidationToObservation("event.base", result, {
      date: "2026-03-21",
      prefixId: "order_event",
    });

    // L0 1건, L2 2건 → 레이어별 2개 observation
    expect(bridged.observations).toHaveLength(2);
    expect(bridged.observations[0].id).toBe("OBS-SCHEMA-event.base-L0");
    expect(bridged.observations[1].id).toBe("OBS-SCHEMA-event.base-L2");

    // subjects에 prefixId 포함
    expect(bridged.observations[0].subjects).toContain("order_event");

    // L2는 suggestion 있음
    expect(bridged.observations[1].suggestion).toBeDefined();
  });

  it("결정적 ID — 멱등성", () => {
    const result: ValidationResult = {
      valid: false,
      errors: [{ layer: 1, axis: "unknown", rule: "unknownAxis", message: "unknown" }],
    };

    const a = bridgeValidationToObservation("test.schema", result);
    const b = bridgeValidationToObservation("test.schema", result);
    expect(a.observations[0].id).toBe(b.observations[0].id);
  });
});

// ═══════════════════════════════════════════════════════════════
//  Phase 4: schema-health-audit
// ═══════════════════════════════════════════════════════════════

describe("SchemaHealthAudit", () => {
  it("DEMO_CATALOG 기반 DKG → 건전성 감사 실행", () => {
    const report = auditSchemaHealth(graph, { date: "2026-03-21" });

    expect(report.totalPrefixes).toBeGreaterThan(0);
    expect(report.passed + report.failed).toBe(report.totalPrefixes);
    expect(report.summary).toBeDefined();
  });

  it("observation ID는 결정적", () => {
    const a = auditSchemaHealth(graph, { date: "2026-03-21" });
    const b = auditSchemaHealth(graph, { date: "2026-03-21" });

    const aIds = a.observations.map(o => o.id).toSorted();
    const bIds = b.observations.map(o => o.id).toSorted();
    expect(aIds).toEqual(bIds);
  });

  it("위반이 있으면 observation 수 ≥ 1", () => {
    const report = auditSchemaHealth(graph);
    if (report.failed > 0) {
      expect(report.observations.length).toBeGreaterThanOrEqual(1);
      expect(report.observations[0].intent).toBe("action-needed");
    }
  });
});
