// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import type {
  RLSCDocument,
  LayoutPattern,
  LayoutMetrics,
  ConformanceViolation,
  ConformanceResult,
  GridSystemPattern,
  SpacingPattern,
  TextOccupancy,
} from "./types.js";
import { measureLayout } from "./metrics.js";
import { classifyLayout } from "./pattern.js";

// ─── 내부 체커 ───────────────────────────────────────────────────────

function checkBalance(
  declared: LayoutPattern,
  recognized: LayoutPattern,
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  const dx = declared.balanceRatio?.x;
  const rx = recognized.balanceRatio?.x;
  if (!dx) return violations;

  const declaredRatio = dx[0] / dx[1];
  const recognizedRatio = rx ? rx[0] / rx[1] : 1.0;
  const diff = Math.abs(declaredRatio - recognizedRatio) / declaredRatio;

  if (diff > 0.5) {
    violations.push({
      rule: "balance.x",
      declared: dx,
      recognized: rx ?? null,
      severity: "error",
      description: `균형 비율 불일치: 선언 [${dx}], 인식 ${rx ? `[${rx}]` : "균형(1:1)"}`,
    });
  } else if (diff > 0.2) {
    violations.push({
      rule: "balance.x",
      declared: dx,
      recognized: rx ?? null,
      severity: "warning",
      description: `균형 비율 경고: 선언 [${dx}], 인식 ${rx ? `[${rx}]` : "균형(1:1)"}`,
    });
  }
  return violations;
}

function normalizeGridPattern(
  p: LayoutPattern["gridPattern"],
): { cols: number; rows: number } | null {
  if (!p) return null;
  if (typeof p === "string") {
    if (p === "3x3") return { cols: 3, rows: 3 };
    if (p === "2-col") return { cols: 2, rows: 1 };
    if (p === "1-col") return { cols: 1, rows: 1 };
    return null;
  }
  return p;
}

function checkGrid(
  declared: LayoutPattern,
  recognized: LayoutPattern,
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  if (declared.gridPattern === undefined) return violations;

  const d = normalizeGridPattern(declared.gridPattern);
  const r = normalizeGridPattern(recognized.gridPattern);

  if (!r || !d || d.cols !== r.cols || d.rows !== r.rows) {
    violations.push({
      rule: "gridPattern",
      declared: declared.gridPattern,
      recognized: recognized.gridPattern ?? null,
      severity: "error",
      description: `그리드 패턴 불일치: 선언 ${JSON.stringify(declared.gridPattern)}, 인식 ${JSON.stringify(recognized.gridPattern ?? null)}`,
    });
  }
  return violations;
}

function checkFlow(
  declared: LayoutPattern,
  recognized: LayoutPattern,
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  if (!declared.flowDirection) return violations;

  if (declared.flowDirection !== recognized.flowDirection) {
    violations.push({
      rule: "flowDirection",
      declared: declared.flowDirection,
      recognized: recognized.flowDirection ?? null,
      severity: "warning",
      description: `흐름 방향 불일치: 선언 "${declared.flowDirection}", 인식 "${recognized.flowDirection ?? "없음"}"`,
    });
  }
  return violations;
}

function checkGoldenRatio(
  declared: LayoutPattern,
  recognized: LayoutPattern,
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  if (declared.goldenRatio !== true) return violations;

  if (recognized.goldenRatio !== true) {
    violations.push({
      rule: "goldenRatio",
      declared: true,
      recognized: recognized.goldenRatio ?? false,
      severity: "warning",
      description: "황금비 미충족: 선언 true, 인식 false",
    });
  }
  return violations;
}

function checkGestalt(
  declared: LayoutPattern,
  recognized: LayoutPattern,
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  const dg = declared.gestalt;
  const rg = recognized.gestalt;
  if (!dg) return violations;

  if (dg.proximity && dg.proximity !== rg?.proximity) {
    violations.push({
      rule: "gestalt.proximity",
      declared: dg.proximity,
      recognized: rg?.proximity ?? null,
      severity: "warning",
      description: `근접성 패턴 불일치: 선언 "${dg.proximity}", 인식 "${rg?.proximity ?? "없음"}"`,
    });
  }
  if (dg.continuity && dg.continuity !== rg?.continuity) {
    violations.push({
      rule: "gestalt.continuity",
      declared: dg.continuity,
      recognized: rg?.continuity ?? null,
      severity: "warning",
      description: `연속성 패턴 불일치: 선언 "${dg.continuity}", 인식 "${rg?.continuity ?? "없음"}"`,
    });
  }
  return violations;
}

function checkGridSystem(
  declared: LayoutPattern,
  recognized: LayoutPattern,
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  const d: GridSystemPattern | undefined = declared.gridSystem;
  const r: GridSystemPattern | undefined = recognized.gridSystem;
  if (!d) return violations;

  if (!r || d.columns !== r.columns) {
    violations.push({
      rule: "gridSystem.columns",
      declared: d.columns,
      recognized: r?.columns ?? null,
      severity: "error",
      description: `컬럼 수 불일치: 선언 ${d.columns}-col, 인식 ${r?.columns ?? "없음"}-col`,
    });
  } else if (d.gutter !== undefined && Math.abs(d.gutter - (r?.gutter ?? 0)) > 4) {
    violations.push({
      rule: "gridSystem.gutter",
      declared: d.gutter,
      recognized: r?.gutter ?? null,
      severity: "warning",
      description: `거터 불일치: 선언 ${d.gutter}px, 인식 ${r?.gutter ?? 0}px`,
    });
  }
  return violations;
}

function checkProportions(
  declared: LayoutPattern,
  recognized: LayoutPattern,
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  const d = declared.proportions;
  const r = recognized.proportions;
  if (!d) return violations;

  if (d.dominant !== undefined) {
    const recognizedDominant = r?.dominant ?? null;
    const diff = recognizedDominant !== null ? Math.abs(d.dominant - recognizedDominant) : Infinity;
    if (diff > 0.1) {
      violations.push({
        rule: "proportions.dominant",
        declared: d.dominant,
        recognized: recognizedDominant,
        severity: "warning",
        description: `주요 비율 불일치: 선언 ${d.dominant}, 인식 ${recognizedDominant ?? "없음"}`,
      });
    }
  }
  if (d.namedRatio !== undefined && d.namedRatio !== r?.namedRatio) {
    violations.push({
      rule: "proportions.namedRatio",
      declared: d.namedRatio,
      recognized: r?.namedRatio ?? null,
      severity: "warning",
      description: `비율 명칭 불일치: 선언 "${d.namedRatio}", 인식 "${r?.namedRatio ?? "없음"}"`,
    });
  }
  return violations;
}

function checkSpacing(
  declared: LayoutPattern,
  recognized: LayoutPattern,
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  const d: SpacingPattern | undefined = declared.spacing;
  const r: SpacingPattern | undefined = recognized.spacing;
  if (!d) return violations;

  if (d.base !== undefined && d.base !== r?.base) {
    violations.push({
      rule: "spacing.base",
      declared: d.base,
      recognized: r?.base ?? null,
      severity: "warning",
      description: `간격 기본 단위 불일치: 선언 ${d.base}px, 인식 ${r?.base ?? "없음"}`,
    });
  }
  if (d.consistent === true && r?.consistent !== true) {
    violations.push({
      rule: "spacing.consistent",
      declared: true,
      recognized: r?.consistent ?? false,
      severity: "warning",
      description: "간격 일관성 미충족: 선언 consistent=true",
    });
  }
  return violations;
}

function checkTextOccupancy(
  declared: LayoutPattern,
  doc: RLSCDocument,
  textOccupancies?: readonly TextOccupancy[],
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  if (!textOccupancies || textOccupancies.length === 0) return violations;

  // text-overflow: 오버플로우 노드 경고
  const overflowing = textOccupancies.filter((o) => o.overflows);
  if (overflowing.length > 0) {
    violations.push({
      rule: "text-overflow",
      declared: "no overflow",
      recognized: `${overflowing.length}개 노드 오버플로우: ${overflowing.map((o) => o.nodeId).join(", ")}`,
      severity: "warning",
      description: `텍스트 오버플로우 감지: ${overflowing.length}개 노드`,
    });
  }

  // textDensityRange: 텍스트 밀도 범위 검증
  if (declared.textDensityRange) {
    const viewportArea = doc.viewport.width * doc.viewport.height;
    let totalTextArea = 0;
    for (const occ of textOccupancies) {
      totalTextArea += occ.renderedRect.width * occ.renderedRect.height;
    }
    const density = viewportArea > 0 ? totalTextArea / viewportArea : 0;
    const [min, max] = declared.textDensityRange;

    if (density < min || density > max) {
      violations.push({
        rule: "textDensityRange",
        declared: declared.textDensityRange,
        recognized: density,
        severity: "warning",
        description: `텍스트 밀도 범위 밖: ${density.toFixed(4)} (허용 ${min}–${max})`,
      });
    }
  }

  return violations;
}

// ─── 선언된 필드 수 카운트 ───────────────────────────────────────────

function countDeclaredFields(pattern: LayoutPattern): number {
  return [
    pattern.gridPattern,
    pattern.balanceRatio,
    pattern.flowDirection,
    pattern.goldenRatio,
    pattern.gestalt,
    pattern.gridSystem,
    pattern.spacing,
    pattern.proportions,
    pattern.textDensityRange,
  ].filter((v) => v !== undefined).length;
}

// ─── 공개 API ────────────────────────────────────────────────────────

/**
 * RLSCDocument와 선언된 LayoutPattern을 비교하여 위반 목록과 점수를 반환한다.
 * 선언되지 않은 필드는 비교하지 않는다.
 */
export function checkConformance(
  doc: RLSCDocument,
  declared: LayoutPattern,
  textOccupancies?: readonly TextOccupancy[],
): ConformanceResult {
  const metrics: LayoutMetrics = measureLayout(doc);
  const recognized: LayoutPattern = classifyLayout(metrics);

  const violations: ConformanceViolation[] = [
    ...checkBalance(declared, recognized),
    ...checkGrid(declared, recognized),
    ...checkFlow(declared, recognized),
    ...checkGoldenRatio(declared, recognized),
    ...checkGestalt(declared, recognized),
    ...checkGridSystem(declared, recognized),
    ...checkSpacing(declared, recognized),
    ...checkProportions(declared, recognized),
    ...checkTextOccupancy(declared, doc, textOccupancies),
  ];

  const total = countDeclaredFields(declared);
  const score =
    total === 0
      ? 1.0
      : (total - violations.length) / total;

  return {
    declared,
    recognized,
    metrics,
    violations,
    score: Math.max(0, score),
  };
}

/**
 * 선언 없이 DOM만으로 패턴 인식 — "이 페이지가 어떤 레이아웃 패턴인가?"
 */
export function recognizeLayout(doc: RLSCDocument): LayoutPattern {
  return classifyLayout(measureLayout(doc));
}
