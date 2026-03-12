import type { EventRecord, RuntimeGraph, RuntimeNode } from "@qa-sdk/core";
import { sortByTimestamp } from "./timestamp-sorter.js";
import { buildSpanTree } from "./span-tree-builder.js";
import { buildTemporalEdges, buildGlobalTemporalEdges } from "./edge-factory.js";

export interface ReconstructionOptions {
  /**
   * temporal edge 전략.
   * - "span-local": 같은 span 내에서만 temporal edge (default, 정확도 높음)
   * - "global": 전체 trace 레벨 temporal edge (span 정보 부족 시 fallback)
   */
  temporalStrategy?: "span-local" | "global";
}

/**
 * Step 5 — 단일 trace의 EventRecord[]를 RuntimeGraph로 재구성한다.
 *
 * 파이프라인:
 *   records → timestamp sort → node 생성 → span tree → temporal edges → RuntimeGraph
 */
export function reconstruct(
  traceId: string,
  records: EventRecord[],
  options?: ReconstructionOptions,
): RuntimeGraph {
  const strategy = options?.temporalStrategy ?? "span-local";

  // 1. timestamp 정렬
  const sorted = sortByTimestamp(records);

  // 2. RuntimeNode 생성
  const nodes: RuntimeNode[] = sorted.map(toRuntimeNode);

  // 3. parent_child edge (span 구조)
  const parentChildEdges = buildSpanTree(sorted);

  // 4. temporal edge
  const temporalEdges =
    strategy === "global"
      ? buildGlobalTemporalEdges(sorted)
      : buildTemporalEdges(sorted);

  // 5. edge 병합 (중복 제거)
  const edgeSet = new Set<string>();
  const edges = [...parentChildEdges, ...temporalEdges].filter((e) => {
    const key = `${e.from}:${e.to}:${e.type}`;
    if (edgeSet.has(key)) return false;
    edgeSet.add(key);
    return true;
  });

  return { trace_id: traceId, nodes, edges };
}

function toRuntimeNode(record: EventRecord): RuntimeNode {
  return {
    id: record.log_id,
    log_id: record.log_id,
    timestamp: record.timestamp,
    record_kind: record.record_kind,
    event_key: record.event_key,
    event_version: record.event_version,
    span_name: record.span_name,
    start_time: record.start_time,
    end_time: record.end_time,
    status_code: record.status_code,
    payload: record.payload,
    payload_masking_applied: record.payload_masking_applied,
    payload_masked_fields: record.payload_masked_fields,
  };
}
