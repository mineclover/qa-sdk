// @def.boundary qa-sdk-engine-system
// @def.doc qa-sdk-engine-system

import type { EventRecord } from '@qa-sdk/core';

/**
 * Step 1: trace_id 기준으로 레코드를 그룹핑한다.
 * 입력: 정렬되지 않은 EventRecord 배열
 * 출력: trace_id → EventRecord[] 맵
 */
export function groupByTrace(records: EventRecord[]): Map<string, EventRecord[]> {
  const groups = new Map<string, EventRecord[]>();

  for (const record of records) {
    const group = groups.get(record.trace_id);
    if (group) {
      group.push(record);
    } else {
      groups.set(record.trace_id, [record]);
    }
  }

  return groups;
}
