// @def.boundary qa-sdk-engine-system
// @def.doc qa-sdk-engine-system

import type { EventRecord, RuntimeEdge } from "@qa-sdk/core";

/**
 * Step 4: 시간 순서 기반 temporal edge를 생성한다.
 * 입력은 이미 timestamp 정렬된 레코드여야 한다.
 *
 * 인접한 레코드 간 temporal edge를 만든다.
 * 같은 span_id 내에서만 연결하여 noise를 줄인다.
 */
export function buildTemporalEdges(sortedRecords: EventRecord[]): RuntimeEdge[] {
  const edges: RuntimeEdge[] = [];

  // 같은 span 내 temporal 연결
  const spanGroups = new Map<string, EventRecord[]>();
  for (const r of sortedRecords) {
    const group = spanGroups.get(r.span_id);
    if (group) {
      group.push(r);
    } else {
      spanGroups.set(r.span_id, [r]);
    }
  }

  for (const group of spanGroups.values()) {
    for (let i = 0; i < group.length - 1; i++) {
      edges.push({
        source: group[i].log_id,
        target: group[i + 1].log_id,
        type: "temporal",
      });
    }
  }

  return edges;
}

/**
 * 전체 trace 레벨 temporal edge.
 * span 경계를 무시하고 전체 시간 순서로 연결한다.
 * span tree가 부족할 때 fallback으로 사용.
 */
export function buildGlobalTemporalEdges(sortedRecords: EventRecord[]): RuntimeEdge[] {
  const edges: RuntimeEdge[] = [];

  for (let i = 0; i < sortedRecords.length - 1; i++) {
    edges.push({
      source: sortedRecords[i].log_id,
      target: sortedRecords[i + 1].log_id,
      type: "temporal",
    });
  }

  return edges;
}
