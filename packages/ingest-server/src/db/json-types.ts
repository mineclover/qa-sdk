// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * DB JSON 컬럼의 내부 타입 선언.
 * drizzle text() 컬럼에 저장된 JSON의 실제 구조를 TypeScript로 표현.
 * 데이터 추적성의 기반 — 스키마에서 도메인 타입까지 추적 가능.
 */

import type { AddressContextV1 } from '@qa-sdk/core/coordinates/address-context-schema';

/** eventRecords.addressContext — prefix별 인코딩된 좌표 (계약: AddressContextV1) */
export type AddressContextJson = AddressContextV1;

/** eventRecords.payload — 이벤트 페이로드 */
export type EventPayloadJson = Record<string, unknown>;

/** eventRecords.metricLabels — metric label 맵 */
export type MetricLabelsJson = Record<string, string>;

/** eventRecords.metricBuckets / metricQuantiles — histogram bucket 경계, summary quantile */
export type MetricNumbersJson = number[];

/** traces.userAttributes — 사용자 속성 */
export type UserAttributesJson = Record<string, string>;

/** verdictReports.report — 판정 리포트. @qa-sdk/core VerdictReport 참조 */
export type { VerdictReport as VerdictReportJson } from '@qa-sdk/core';

/** qaSessions.labels — 세션 레이블 */
export type SessionLabelsJson = Record<string, string>;

/** insightLabels.metadata — 인사이트 메타데이터 */
export type InsightMetadataJson = Record<string, unknown>;

/**
 * JSON text 컬럼을 타입 안전하게 파싱.
 * null/undefined/빈 문자열 → fallback 반환, 파싱 실패 → fallback 반환.
 */
export function parseJsonColumn<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** keyObservations.payloadSummary — 필드 빈도 + 샘플 값 */
export type PayloadSummaryJson = {
  fieldFrequency: Record<string, number>;
  sampleValues: Record<string, unknown>;
};

/** 빈 PayloadSummary 기본값 */
export const EMPTY_PAYLOAD_SUMMARY: PayloadSummaryJson = {
  fieldFrequency: {},
  sampleValues: {},
};

export {
  AddressContextV1Schema,
  parsePackedAddress,
  serializePackedAddress,
  type AddressContextV1,
  type ParsedPackedAddress,
} from '@qa-sdk/core/coordinates/address-context-schema';
