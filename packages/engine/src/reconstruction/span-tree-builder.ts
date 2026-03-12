import type { EventRecord, RuntimeEdge } from "@qa-sdk/core";

/**
 * Step 3: span parent-child 관계를 복원하여 parent_child edge를 생성한다.
 *
 * parent_span_id가 있는 레코드에 대해
 * parent_span_id → span_id 방향의 edge를 만든다.
 *
 * span_id → log_id 매핑이 필요하므로 먼저 인덱스를 구축한다.
 */
export function buildSpanTree(records: EventRecord[]): RuntimeEdge[] {
  // span_id → 해당 span_id를 가진 첫 번째 레코드의 log_id
  const spanToLogId = new Map<string, string>();
  for (const r of records) {
    if (!spanToLogId.has(r.span_id)) {
      spanToLogId.set(r.span_id, r.log_id);
    }
  }

  const edges: RuntimeEdge[] = [];
  const seen = new Set<string>();

  for (const r of records) {
    if (!r.parent_span_id) continue;

    const parentLogId = spanToLogId.get(r.parent_span_id);
    if (!parentLogId) continue;

    // 같은 parent→child edge 중복 방지
    const key = `${parentLogId}:${r.log_id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    edges.push({
      from: parentLogId,
      to: r.log_id,
      type: "parent_child",
    });
  }

  return edges;
}
