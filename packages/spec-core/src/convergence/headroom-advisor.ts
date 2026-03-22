/**
 * Headroom Advisor — headroom이 부족한 축을 감지하고 capacity 확장 Decision을 생성한다.
 *
 * @layer 추천 (Recommendation)
 */

import { nextPowerOf2 } from "weighted-index";
import type { GraphPort } from "../shared/graph-port.js";
import type { DecisionNode } from "../dkg/dkg.types.js";
import { scaffoldDecision } from "../shared/decision-scaffold.js";

export interface HeadroomIssue {
  readonly axisId: string;
  readonly name: string;
  readonly entries: number;
  readonly capacity: number;
  readonly headroom: number;
  readonly proposedCapacity: number;
  readonly severity: "critical" | "warning" | "ok";

  /** 이 축을 사용하는 prefix 수 — capacity 변경 시 영향 범위 */
  readonly affectedPrefixes: number;

  /** capacity 변경 시 stride-break 발생 여부 */
  readonly strideBreakOnChange: boolean;

  /**
   * 비용 등급:
   *   "free" — sealed 전이므로 자유롭게 변경
   *   "size-only" — stride는 보존, size(bitmask)만 변경
   *   "stride-break" — stride 변경, 전체 re-encode + cascade
   */
  readonly migrationCost: "free" | "size-only" | "stride-break";
}

export interface HeadroomReport {
  readonly issues: readonly HeadroomIssue[];
  readonly decisions: readonly DecisionNode[];
}

/**
 * 축 데이터에서 headroom 부족을 감지하고 capacity 확장 Decision을 생성한다.
 *
 * 규칙:
 *   headroom=0 → critical, 다음 2의 거듭제곱으로 확장 제안
 *   headroom=1 → warning, 여유 있는 확장 제안
 *   headroom≥2 → ok
 *
 * 최소 capacity: entries의 2배 또는 다음 2의 거듭제곱 중 큰 값
 */
/**
 * @param graph — DKG 그래프 (영향 범위 계산용)
 */
export function analyzeHeadroom(
  axisData: ReadonlyArray<{
    id: string;
    name: string;
    entries: number;
    capacity: number;
    /** 이미 sealed된 version이 있는가 (데이터가 인코딩되어 있을 수 있음) */
    sealed?: boolean;
  }>,
  options?: { date?: string; graph?: GraphPort },
): HeadroomReport {
  const date = options?.date ?? new Date().toISOString().slice(0, 10);
  const graph = options?.graph;
  const issues: HeadroomIssue[] = [];
  const decisions: DecisionNode[] = [];

  for (const axis of axisData) {
    const headroom = axis.capacity - axis.entries;

    let severity: HeadroomIssue["severity"];
    if (headroom <= 0) severity = "critical";
    else if (headroom <= 1) severity = "warning";
    else { severity = "ok"; continue; }

    // 영향 범위
    const affectedPrefixes = graph
      ? graph.cascadeFromAxis(axis.id).length
      : 0;

    // stride-break 판정:
    // capacity 변경 → 이 축이 마지막 차원이 아닌 prefix에서는 stride[i]가 바뀔 수 있음
    // 하지만 실제로는 shape이 바뀌면 size만 바뀌고 stride는 보존될 수도 있음
    // 정확한 판정은 prefix별 shape을 봐야 하지만, 보수적으로:
    // sealed + 영향 prefix 있음 → stride-break 가능
    const sealed = axis.sealed ?? (axis.capacity > axis.entries ? false : true);
    const strideBreakOnChange = sealed && affectedPrefixes > 0;

    let migrationCost: HeadroomIssue["migrationCost"];
    if (!sealed) {
      migrationCost = "free";
    } else if (affectedPrefixes === 0) {
      migrationCost = "free";
    } else {
      // capacity만 변경이면 stride는 보존될 수 있지만
      // prefix_ref cascade에서는 size 변경이 상위 shape에 영향
      migrationCost = affectedPrefixes > 1 ? "stride-break" : "size-only";
    }

    // 제안 capacity: 다음 2의 거듭제곱 또는 entries × 2 중 큰 값
    const nextPow2 = nextPowerOf2(axis.entries + 1);
    const doubled = axis.entries * 2;
    const proposedCapacity = Math.max(nextPow2, doubled, 4); // 최소 4

    issues.push({
      axisId: axis.id,
      name: axis.name,
      entries: axis.entries,
      capacity: axis.capacity,
      headroom,
      proposedCapacity,
      severity,
      affectedPrefixes,
      strideBreakOnChange,
      migrationCost,
    });

    const costWarning = migrationCost === "stride-break"
      ? ` ⚠ stride-break: ${affectedPrefixes}개 prefix cascade 영향. 전체 re-encode + bitmask 재생성 필요.`
      : migrationCost === "size-only"
        ? ` △ size 변경: bitmask 재생성 필요. stride는 보존.`
        : ` ✓ sealed 전이므로 자유롭게 변경 가능.`;

    decisions.push(scaffoldDecision({
      type: "capacity",
      id: `DEC-HEADROOM-${axis.id}`,
      date,
      title: `${axis.id} capacity ${axis.capacity}→${proposedCapacity} 확장`,
      params: {
        axis: axis.id,
        currentUsed: axis.entries,
        currentCapacity: axis.capacity,
        proposedCapacity,
      },
      rationale: (headroom <= 0
        ? `headroom 없음. 다음 entry 추가 시 즉시 stride-break.`
        : `headroom ${headroom}개. 추가 여유 확보 권장.`)
        + costWarning,
    }));
  }

  return { issues, decisions };
}

/**
 * HeadroomReport의 Decision들을 DKG에 등록한다.
 */
export function applyHeadroomDecisions(
  graph: GraphPort,
  report: HeadroomReport,
): void {
  for (const decision of report.decisions) {
    graph.addNode(decision);
    // Decision → Axis justifies 엣지
    const axisId = report.issues.find(
      i => decision.id === `DEC-HEADROOM-${i.axisId}`,
    )?.axisId;
    if (axisId) {
      graph.addEdge("justifies", decision.id, axisId);
    }
  }
}

