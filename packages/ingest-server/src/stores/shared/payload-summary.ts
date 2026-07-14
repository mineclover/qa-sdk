// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * mergePayloadSummary — payload field 빈도 + sample 값 누적 merge.
 *
 * dialect-agnostic 순수 함수. D1/SQLite/PG 어댑터에서 공유.
 * 원본: packages/ingest-server/src/stores/d1-key-observation-store.ts (Plan 07b 추출).
 */

import type { KeyObservationEntry } from '@qa-sdk/core';
import type { PayloadSummaryJson } from '../../db/json-types.js';

export type { PayloadSummaryJson } from '../../db/json-types.js';

/** PayloadSummary SSOT — db/json-types.ts에서 정의된 빈 기본값을 그대로 재노출. */
export const EMPTY_PAYLOAD_SUMMARY: PayloadSummaryJson = {
  fieldFrequency: {},
  sampleValues: {},
};

/**
 * 기존 summary에 새 관측 데이터를 누적 merge.
 *
 * - payloadFields는 빈도(fieldFrequency)에 +1.
 * - samplePayload는 최대 5개 키만 sampleValues에 최신값으로 갱신.
 *
 * dialect 무관 — D1/SQLite/PG 어댑터가 동일 함수를 사용해야 §4 P1·P3 결과와 정합.
 */
export function mergePayloadSummary(
  prev: PayloadSummaryJson,
  entry: KeyObservationEntry,
): PayloadSummaryJson {
  const fieldFrequency = { ...prev.fieldFrequency };
  const sampleValues = { ...prev.sampleValues };

  if (entry.payloadFields) {
    for (const field of entry.payloadFields) {
      fieldFrequency[field] = (fieldFrequency[field] ?? 0) + 1;
    }
  }

  if (entry.samplePayload) {
    const keys = Object.keys(entry.samplePayload).slice(0, 5);
    for (const key of keys) {
      sampleValues[key] = entry.samplePayload[key];
    }
  }

  return { fieldFrequency, sampleValues };
}
