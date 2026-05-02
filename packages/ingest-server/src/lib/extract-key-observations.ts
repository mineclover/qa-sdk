// @def.boundary ingest-system
// @def.doc ingest-system

import type { KeyObservationEntry, RecordInsert } from "@qa-sdk/core";

/**
 * RecordInsert[]에서 KeyObservationEntry[]를 추출한다.
 * addressContext의 각 (prefixId, packedKey) 쌍이 하나의 entry가 된다.
 *
 * @param records - 저장된 레코드 목록
 * @param knownPrefixes - 등록된 prefix 집합 (없으면 전부 unregistered 처리)
 */
export function extractKeyObservations(
  records: readonly RecordInsert[],
  knownPrefixes?: ReadonlySet<string>,
): KeyObservationEntry[] {
  const entries: KeyObservationEntry[] = [];

  for (const record of records) {
    if (!record.addressContext) continue;

    const timestamp = record.timestamp.toISOString();
    const payloadFields =
      record.payload && typeof record.payload === "object"
        ? Object.keys(record.payload as Record<string, unknown>)
        : undefined;
    const samplePayload =
      record.payload && typeof record.payload === "object"
        ? extractSample(record.payload as Record<string, unknown>, 5)
        : undefined;

    for (const [prefixId, packedKey] of Object.entries(
      record.addressContext,
    )) {
      entries.push({
        packedKey,
        prefixId,
        registered: knownPrefixes ? knownPrefixes.has(prefixId) : false,
        timestamp,
        payloadFields,
        samplePayload,
      });
    }
  }

  return entries;
}

function extractSample(
  payload: Record<string, unknown>,
  maxFields: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let count = 0;
  for (const [key, value] of Object.entries(payload)) {
    if (count >= maxFields) break;
    result[key] = value;
    count++;
  }
  return result;
}
