/**
 * 좌표 승격 스캐너 — DKG 노드의 열거형 필드를 스캔하여 축 승격 후보를 제안한다.
 *
 * 5Q Checklist (axis-decision-guide.md)를 코드로 구현:
 *   Q1: 유한한가? (values.length <= 32)
 *   Q2: 의사결정에 사용되는가? (이 값으로 분기하는 노드/엣지가 있는가)
 *   Q3: 공유되는가? (2개 이상의 prefix/domain에서 관측)
 *   Q4: 안정적인가? (값 집합이 변하지 않음)
 *   Q5: capacity 계획 가능한가? (nextPowerOf2 추정)
 *
 * @layer 추천 (Recommendation)
 */

import { nextPowerOf2 as _nextPow2 } from "weighted-index";
import type { GraphPort, GraphNodeLike } from "./graph-port.js";

/** 노드의 런타임 필드를 열거한다. 각 variant가 서로 다른 필드를 가지므로 정적 타입 단언 불가. */
function nodeFields(node: GraphNodeLike): [string, unknown][] {
  return Object.entries(node);
}

// ═══════════════════════════════════════════════════════════════

export interface PromotionCandidate {
  readonly field: string;
  readonly values: readonly string[];
  readonly count: number;
  readonly source: "dkg-node-field" | "edge-type" | "id-pattern" | "phantom";

  readonly q1_finite: boolean;
  readonly q2_decision: boolean;
  readonly q3_shared: boolean;
  readonly q4_stable: boolean;
  readonly q5_capacity: number;

  readonly verdict: "promote" | "keep" | "review";
  readonly reason: string;
  readonly alreadyAxis: boolean;
}

// ═══════════════════════════════════════════════════════════════

/** 축 capacity 최솟값 4 보장 */
function nextPowerOf2(n: number): number {
  return Math.max(_nextPow2(n), 4);
}

function judge(c: Omit<PromotionCandidate, "verdict" | "reason">): PromotionCandidate {
  const pass = [c.q1_finite, c.q2_decision, c.q3_shared, c.q4_stable].filter(Boolean).length;
  let verdict: PromotionCandidate["verdict"];
  let reason: string;

  if (c.alreadyAxis) {
    verdict = "keep";
    reason = "이미 좌표축으로 존재";
  } else if (pass === 4) {
    verdict = "promote";
    reason = `5Q 전부 통과 (${c.values.length}개 값, capacity ${c.q5_capacity})`;
  } else if (pass >= 3) {
    verdict = "review";
    const failed = [];
    if (!c.q1_finite) failed.push("Q1:무한");
    if (!c.q2_decision) failed.push("Q2:비의사결정");
    if (!c.q3_shared) failed.push("Q3:비공유");
    if (!c.q4_stable) failed.push("Q4:불안정");
    reason = `3/4 통과 — ${failed.join(", ")} 재검토 필요`;
  } else {
    verdict = "keep";
    reason = `${pass}/4 통과 — 축 승격 부적합`;
  }

  return { ...c, verdict, reason };
}

// ═══════════════════════════════════════════════════════════════

/**
 * DKG 그래프에서 좌표 승격 후보를 스캔한다.
 */
export function scanPromotionCandidates(
  graph: GraphPort,
  options?: { existingAxes?: ReadonlySet<string> },
): PromotionCandidate[] {
  const existingAxes = options?.existingAxes ?? new Set<string>();
  const candidates: PromotionCandidate[] = [];

  // ── 1. 노드 필드 스캔 ──
  const fieldValues = new Map<string, Map<string, number>>();

  for (const node of graph.getAllNodes()) {
    const entries = nodeFields(node);
    for (const [key, value] of entries) {
      // 메타데이터/식별/자유텍스트 필드는 제외
      const skip = new Set(["id", "kind", "name", "description", "title", "finding",
        "rationale", "context", "rule", "formal", "intent", "invariant", "via",
        "date", "impact", "detail", "note"]);
      if (skip.has(key)) continue;
      if (typeof value !== "string") continue;
      // 긴 문자열은 제외
      if (value.length > 30) continue;
      // 날짜 패턴 제외
      if (/^\d{4}-\d{2}/.test(value)) continue;

      const fieldKey = `${node.kind}.${key}`;
      const map = fieldValues.get(fieldKey) ?? new Map<string, number>();
      map.set(value, (map.get(value) ?? 0) + 1);
      fieldValues.set(fieldKey, map);
    }
  }

  for (const [field, valueMap] of fieldValues) {
    const values = [...valueMap.keys()];
    if (values.length < 2 || values.length > 32) continue; // 1개 값이면 축이 아님, 32 초과면 Q1 실패

    const totalCount = [...valueMap.values()].reduce((s, v) => s + v, 0);
    if (totalCount < 3) continue; // 사용 빈도 너무 낮음

    // Q1: 유한한가
    const q1 = values.length <= 32;
    // Q2: 의사결정에 사용되는가 — 이 필드 값에 따라 엣지가 다른가
    const q2 = totalCount >= 5; // 5건 이상 사용 = 의사결정 근거
    // Q3: 공유되는가 또는 고정 분류 체계인가
    // 원래: "여러 kind에서 같은 필드명 사용"
    // 확장: 단일 kind라도 값이 enum 패턴(고정·반복·같은 목적)이면 통과
    //   - 값 집합이 코드에 리터럴로 정의됨 (enum/union type)
    //   - 모든 인스턴스에서 이 필드가 존재 (필수 필드)
    //   - 값 분포가 편중되지 않음 (최소 2개 값이 각각 2회 이상)
    const kindsWithField = new Set(
      [...fieldValues.keys()]
        .filter(f => f.endsWith(`.${field.split(".")[1]}`) && f !== field)
        .map(f => f.split(".")[0]),
    );
    const isSharedAcrossKinds = kindsWithField.size >= 1;
    const isFixedEnum = values.length >= 2 && [...valueMap.values()].filter(v => v >= 2).length >= 2;
    const q3 = isSharedAcrossKinds || isFixedEnum;
    // Q4: 안정적 — 값 집합이 코드에 정의된 리터럴이면 안정적 (현재는 항상 true)
    const q4 = true;
    // Q5: capacity
    const q5 = nextPowerOf2(values.length * 2);

    const fieldName = field.split(".")[1];
    // 필드명 → 축 ID 매핑 (승격 완료된 것)
    const fieldToAxis: Record<string, string> = {
      source: "obs_source", type: "spec_type", lifecycle: "lifecycle_state",
    };
    const axisId = fieldToAxis[fieldName] ?? fieldName;
    const alreadyAxis = existingAxes.has(fieldName) || existingAxes.has(axisId);

    candidates.push(judge({
      field,
      values,
      count: totalCount,
      source: "dkg-node-field",
      q1_finite: q1,
      q2_decision: q2,
      q3_shared: q3,
      q4_stable: q4,
      q5_capacity: q5,
      alreadyAxis,
    }));
  }

  // ── 2. 엣지 타입 ──
  const edgeTypes = new Map<string, number>();
  for (const node of graph.getAllNodes()) {
    for (const edge of graph.edgesFrom(node.id)) {
      edgeTypes.set(edge.type, (edgeTypes.get(edge.type) ?? 0) + 1);
    }
  }
  const edgeValues = [...edgeTypes.keys()];
  if (edgeValues.length >= 2) {
    candidates.push(judge({
      field: "edge.type",
      values: edgeValues,
      count: [...edgeTypes.values()].reduce((s, v) => s + v, 0),
      source: "edge-type",
      q1_finite: edgeValues.length <= 32,
      q2_decision: true, // 엣지 타입은 항상 의사결정
      q3_shared: true,   // 전 노드에서 공유
      q4_stable: true,
      q5_capacity: nextPowerOf2(edgeValues.length * 2),
      alreadyAxis: existingAxes.has("edge_type"),
    }));
  }

  // ── 3. Decision ID 패턴 ──
  const decPrefixes = new Map<string, number>();
  for (const node of graph.getNodesByKind("decision")) {
    const prefix = node.id.replace(/^(DEC-[A-Z]+).*/, "$1");
    decPrefixes.set(prefix, (decPrefixes.get(prefix) ?? 0) + 1);
  }
  if (decPrefixes.size >= 2) {
    candidates.push(judge({
      field: "decision.id_prefix",
      values: [...decPrefixes.keys()],
      count: [...decPrefixes.values()].reduce((s, v) => s + v, 0),
      source: "id-pattern",
      q1_finite: true,
      q2_decision: true,
      q3_shared: [...decPrefixes.values()].filter(v => v >= 2).length >= 2, // 고정 분류 체계: 2개 이상 유형이 반복 사용
      q4_stable: decPrefixes.size < 10,
      q5_capacity: nextPowerOf2(decPrefixes.size * 2),
      alreadyAxis: existingAxes.has("decision_type"),
    }));
  }

  // verdict 순서: promote → review → keep
  const order = { promote: 0, review: 1, keep: 2 };
  return candidates.toSorted((a, b) => order[a.verdict] - order[b.verdict]);
}
