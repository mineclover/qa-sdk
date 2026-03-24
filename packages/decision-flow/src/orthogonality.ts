/**
 * 직교성 검증 (Orthogonality Check)
 *
 * 사전 설계된 축들이 실제 데이터에서도 독립적인지 검증한다.
 *
 * 설계 시점(a priori)에서 직교를 선언했더라도,
 * 실제 의사결정 이력이 쌓이면 특정 축 쌍이 상관될 수 있다.
 * 예: perceive 단계에서 항상 data 근거만 사용한다면
 *     cognitive_phase와 evidence_kind의 직교성이 깨진 것이다.
 *
 * Cramér's V를 사용하여 범주형 변수 간 연관 강도를 측정한다.
 *   V = 0   → 완전 독립 (직교)
 *   V = 1   → 완전 종속 (같은 축)
 *   V > 0.7 → 직교성 의심
 *   V > 0.9 → 축 병합 또는 재설계 필요
 */

import type { FlowInstance, GateSelection } from "./types.js";

// ─── 타입 ────────────────────────────────────────────────

/** 축 쌍의 직교성 검증 결과 */
export interface OrthogonalityResult {
  readonly axisA: string;
  readonly axisB: string;
  /** Cramér's V (0~1). 0=독립, 1=종속 */
  readonly cramersV: number;
  /** 직교로 판정되는가 (V < 0.3) */
  readonly isOrthogonal: boolean;
  /** 표본 수 */
  readonly sampleSize: number;
  /** 경고 메시지 (V >= 0.7일 때) */
  readonly warning?: string;
}

/** 관찰된 축 값 쌍 */
export interface ObservedPair {
  readonly a: string;
  readonly b: string;
}

/** 인스턴스에서 축 값 쌍을 추출하는 전략 */
export type PairExtractor = (instance: FlowInstance) => readonly ObservedPair[];

// ─── 핵심 함수 ──────────────────────────────────────────

/**
 * 관찰된 값 쌍에서 두 축의 직교성을 검증한다.
 *
 * Cramér's V = sqrt( χ² / (n × min(k₁-1, k₂-1)) )
 * - χ²: 카이제곱 통계량 (관찰 빈도 vs 기대 빈도)
 * - n: 총 표본 수
 * - k₁, k₂: 각 축의 고유값 수
 */
export function checkOrthogonality(
  axisA: string,
  axisB: string,
  pairs: readonly ObservedPair[],
): OrthogonalityResult {
  if (pairs.length < 5) {
    return {
      axisA,
      axisB,
      cramersV: 0,
      isOrthogonal: true,
      sampleSize: pairs.length,
      warning: pairs.length === 0
        ? undefined
        : `표본 부족 (${pairs.length}건) — 최소 5건 필요`,
    };
  }

  // 분할표 구성
  const contingency = buildContingencyTable(pairs);
  const n = pairs.length;
  const rowKeys = [...contingency.keys()].sort();
  const colKeysSet = new Set<string>();
  for (const cols of contingency.values()) {
    for (const key of cols.keys()) colKeysSet.add(key);
  }
  const colKeys = [...colKeysSet].sort();

  const k1 = rowKeys.length;
  const k2 = colKeys.length;

  // 축 값이 1종뿐이면 분산 없음 → 직교 판정 불가
  if (k1 <= 1 || k2 <= 1) {
    return { axisA, axisB, cramersV: 0, isOrthogonal: true, sampleSize: n };
  }

  // 행/열 합계
  const rowTotals = new Map<string, number>();
  const colTotals = new Map<string, number>();
  for (const rowKey of rowKeys) {
    let rowSum = 0;
    const cols = contingency.get(rowKey)!;
    for (const colKey of colKeys) {
      const observed = cols.get(colKey) ?? 0;
      rowSum += observed;
      colTotals.set(colKey, (colTotals.get(colKey) ?? 0) + observed);
    }
    rowTotals.set(rowKey, rowSum);
  }

  // χ² 계산
  let chiSquared = 0;
  for (const rowKey of rowKeys) {
    const cols = contingency.get(rowKey)!;
    const rowTotal = rowTotals.get(rowKey)!;
    for (const colKey of colKeys) {
      const observed = cols.get(colKey) ?? 0;
      const colTotal = colTotals.get(colKey)!;
      const expected = (rowTotal * colTotal) / n;
      if (expected > 0) {
        chiSquared += ((observed - expected) ** 2) / expected;
      }
    }
  }

  // Cramér's V
  const minDim = Math.min(k1 - 1, k2 - 1);
  const v = minDim > 0 ? Math.sqrt(chiSquared / (n * minDim)) : 0;
  const normalizedV = Number(v.toFixed(6));

  let warning: string | undefined;
  if (normalizedV >= 0.9) {
    warning = `직교성 위반 (V=${normalizedV}) — 축 병합 또는 재설계 필요`;
  } else if (normalizedV >= 0.7) {
    warning = `직교성 의심 (V=${normalizedV}) — 두 축이 같은 것을 측정하고 있을 수 있다`;
  }

  return {
    axisA,
    axisB,
    cramersV: normalizedV,
    isOrthogonal: normalizedV < 0.3,
    sampleSize: n,
    warning,
  };
}

// ─── 값 쌍 추출기 ────────────────────────────────────────

/**
 * FlowInstance 이력에서 cognitive_phase × evidence_kind 쌍을 추출한다.
 *
 * 각 selection의 phase(gate 정의에서)와 evidence.kind를 쌍으로 만든다.
 * 하나의 selection에 여러 evidence가 있으면 각각 독립 쌍.
 */
export function extractPhaseEvidencePairs(
  instances: readonly FlowInstance[],
  gatePhases: ReadonlyMap<string, string>,
): ObservedPair[] {
  const pairs: ObservedPair[] = [];
  for (const instance of instances) {
    for (const sel of instance.selections) {
      const phase = gatePhases.get(sel.gateId);
      if (!phase) continue;
      if (sel.evidence.length === 0) {
        pairs.push({ a: phase, b: "none" });
      } else {
        for (const ev of sel.evidence) {
          pairs.push({ a: phase, b: ev.kind });
        }
      }
    }
  }
  return pairs;
}

/**
 * FlowInstance 이력에서 evidence_kind × confidence_band 쌍을 추출한다.
 */
export function extractEvidenceConfidencePairs(
  instances: readonly FlowInstance[],
): ObservedPair[] {
  const pairs: ObservedPair[] = [];
  for (const instance of instances) {
    for (const sel of instance.selections) {
      const band = discretizeBand(sel.confidence);
      if (sel.evidence.length === 0) {
        pairs.push({ a: "none", b: band });
      } else {
        for (const ev of sel.evidence) {
          pairs.push({ a: ev.kind, b: band });
        }
      }
    }
  }
  return pairs;
}

/**
 * 모든 선언된 직교 쌍을 이력 데이터로 일괄 검증한다.
 */
export function checkAllDeclaredOrthogonality(
  instances: readonly FlowInstance[],
  gatePhases: ReadonlyMap<string, string>,
): OrthogonalityResult[] {
  const results: OrthogonalityResult[] = [];

  // cognitive_phase × evidence_kind
  const phaseEvidence = extractPhaseEvidencePairs(instances, gatePhases);
  results.push(checkOrthogonality("cognitive_phase", "evidence_kind", phaseEvidence));

  // evidence_kind × confidence_band
  const evidenceConfidence = extractEvidenceConfidencePairs(instances);
  results.push(checkOrthogonality("evidence_kind", "confidence_band", evidenceConfidence));

  return results;
}

// ─── 내부 유틸 ──────────────────────────────────────────

function buildContingencyTable(
  pairs: readonly ObservedPair[],
): Map<string, Map<string, number>> {
  const table = new Map<string, Map<string, number>>();
  for (const { a, b } of pairs) {
    let row = table.get(a);
    if (!row) {
      row = new Map<string, number>();
      table.set(a, row);
    }
    row.set(b, (row.get(b) ?? 0) + 1);
  }
  return table;
}

function discretizeBand(confidence: number): string {
  if (confidence >= 0.9) return "exact";
  if (confidence >= 0.7) return "high";
  if (confidence >= 0.4) return "medium";
  return "low";
}
