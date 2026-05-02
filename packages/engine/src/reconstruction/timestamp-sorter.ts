// @def.boundary qa-sdk-engine-system
// @def.doc qa-sdk-engine-system

import type { EventRecord } from "@qa-sdk/core";

/**
 * Step 2: timestamp 기준 오름차순 정렬.
 * 같은 timestamp면 span이 log보다 먼저 온다 (span은 구간 시작).
 * 원본 배열을 변경하지 않고 새 배열을 반환한다.
 */
export function sortByTimestamp(records: EventRecord[]): EventRecord[] {
  return [...records].toSorted((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    if (ta !== tb) return ta - tb;

    // 동일 timestamp: span을 먼저 (구간 시작이 log보다 앞)
    if (a.record_kind === "span" && b.record_kind === "log") return -1;
    if (a.record_kind === "log" && b.record_kind === "span") return 1;
    return 0;
  });
}
