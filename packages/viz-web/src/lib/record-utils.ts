// @def.boundary viz-system-root
// @def.doc viz-system-root

import type { StoredRecord } from "@qa-sdk/core";

/**
 * 두 StoredRecord 배열을 logId 기준으로 dedup하고 timestamp 오름차순으로 정렬.
 * WS 버퍼(b)보다 서버 히스토리(a)를 먼저 순회하여 a의 레코드가 우선 보존됨.
 */
export function mergeAndSortRecords(a: StoredRecord[], b: StoredRecord[]): StoredRecord[] {
  const seen = new Set<string>();
  const merged: StoredRecord[] = [];

  for (const r of [...a, ...b]) {
    if (!seen.has(r.logId)) {
      seen.add(r.logId);
      merged.push(r);
    }
  }

  merged.sort((x, y) => {
    const tx = x.timestamp instanceof Date
      ? x.timestamp.getTime()
      : new Date(x.timestamp as string).getTime();
    const ty = y.timestamp instanceof Date
      ? y.timestamp.getTime()
      : new Date(y.timestamp as string).getTime();
    return tx - ty;
  });

  return merged;
}
