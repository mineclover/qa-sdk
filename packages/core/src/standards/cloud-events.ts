// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * CloudEvents 호환 — EventRecord ↔ CloudEvents 변환
 *
 * 내부: EventRecord (성능 최적화)
 * 외부: CloudEvents JSON (표준 호환)
 *
 * qa-sdk 확장 속성:
 *   qasdk_prefix, qasdk_prefixversion, qasdk_manifestversion,
 *   qasdk_traceid, qasdk_sessionid
 */

import type { EventRecord } from "../types/record.js";

// ── CloudEvents 타입 ─────────────────────────────────

export interface CloudEvent {
  /** CloudEvents 스펙 버전 (고정) */
  specversion: "1.0";
  /** 이벤트 고유 ID */
  id: string;
  /** 이벤트 유형 */
  type: string;
  /** 이벤트 발생 소스 (URI) */
  source: string;
  /** 발생 시각 (ISO-8601) */
  time: string;
  /** 이벤트 대상 (좌표 주소) */
  subject?: string;
  /** 페이로드 */
  data?: unknown;
  /** 페이로드 형식 */
  datacontenttype?: string;

  // qa-sdk 확장 속성
  qasdk_prefix?: string;
  qasdk_prefixversion?: string;
  qasdk_manifestversion?: string;
  qasdk_traceid?: string;
  qasdk_sessionid?: string;
}

/**
 * CloudEvent 변환 소스 — EventRecord 호환 최소 인터페이스.
 * EventRecord를 직접 전달하거나 최소 필드만 가진 객체를 전달할 수 있다.
 */
export interface EventRecordLike {
  event_key: string;
  timestamp: string;
  payload?: unknown;
  /** n차원 주소 컨텍스트 (EventRecord 호환) */
  address_context?: Record<string, string>;
  /** @deprecated address_context 사용. 레거시 단일 좌표 */
  coordinate?: number;
  trace_id?: string;
  qa_session_id?: string;
  [key: string]: unknown;
}

/** 매니페스트 참조 정보 */
export interface ManifestRef {
  source: string;            // 서비스 URI (예: "//order-service")
  prefix?: string;           // prefix ID
  prefixVersion?: string;    // prefix 버전
  manifestVersion?: string;  // 매니페스트 버전
}

// ── 변환 함수 ────────────────────────────────────────

/** EventRecord → CloudEvent 변환. EventRecord 또는 EventRecordLike 모두 허용. */
export function toCloudEvent(
  record: EventRecord | EventRecordLike,
  manifest: ManifestRef,
  eventId?: string,
): CloudEvent {
  const r = record as EventRecordLike;
  const ce: CloudEvent = {
    specversion: "1.0",
    id: eventId ?? generateId(),
    type: r.event_key,
    source: manifest.source,
    time: r.timestamp,
    datacontenttype: "application/json",
  };

  if (r.payload != null) ce.data = r.payload;

  // address_context 우선, 없으면 레거시 coordinate
  if (r.address_context && manifest.prefix && r.address_context[manifest.prefix]) {
    ce.subject = r.address_context[manifest.prefix];
  } else if (r.coordinate != null) {
    ce.subject = manifest.prefix
      ? `${manifest.prefix}:${manifest.prefixVersion ?? "v1"}:${r.coordinate}`
      : String(r.coordinate);
  }

  if (manifest.prefix) ce.qasdk_prefix = manifest.prefix;
  if (manifest.prefixVersion) ce.qasdk_prefixversion = manifest.prefixVersion;
  if (manifest.manifestVersion) ce.qasdk_manifestversion = manifest.manifestVersion;
  if (r.trace_id) ce.qasdk_traceid = r.trace_id;
  if (r.qa_session_id) ce.qasdk_sessionid = r.qa_session_id;

  return ce;
}

/** CloudEvent → EventRecordLike 변환 */
export function fromCloudEvent(ce: CloudEvent): EventRecordLike {
  const record: EventRecordLike = {
    event_key: ce.type,
    timestamp: ce.time,
  };

  if (ce.data != null) record.payload = ce.data as Record<string, unknown>;

  // subject → address_context + 레거시 coordinate
  if (ce.subject) {
    const parts = ce.subject.split(":");
    const lastPart = parts[parts.length - 1];
    const num = Number(lastPart);
    if (!isNaN(num)) record.coordinate = num;

    // prefix:version:address 형식이면 address_context 복원
    if (parts.length >= 3 && ce.qasdk_prefix) {
      record.address_context = { [ce.qasdk_prefix]: ce.subject };
    }
  }

  if (ce.qasdk_traceid) record.trace_id = ce.qasdk_traceid;
  if (ce.qasdk_sessionid) record.qa_session_id = ce.qasdk_sessionid;

  return record;
}

/** CloudEvents JSON 직렬화 */
export function serializeCloudEvent(ce: CloudEvent): string {
  return JSON.stringify(ce);
}

/** CloudEvents JSON 역직렬화 + 검증 */
export function deserializeCloudEvent(json: string): CloudEvent {
  const parsed = JSON.parse(json);
  if (parsed.specversion !== "1.0") {
    throw new Error(`CloudEvents specversion "${parsed.specversion}" 미지원. 1.0만 지원`);
  }
  if (!parsed.id || !parsed.type || !parsed.source || !parsed.time) {
    throw new Error("CloudEvents 필수 필드 누락: id, type, source, time");
  }
  return parsed as CloudEvent;
}

/** 배치 변환 — EventRecord[] | EventRecordLike[] → CloudEvent[] */
export function toCloudEventBatch(
  records: readonly (EventRecord | EventRecordLike)[],
  manifest: ManifestRef,
): CloudEvent[] {
  return records.map(r => toCloudEvent(r, manifest));
}

/** 배치 역변환 — CloudEvent[] → EventRecordLike[] */
export function fromCloudEventBatch(events: readonly CloudEvent[]): EventRecordLike[] {
  return events.map(fromCloudEvent);
}

// ── 유틸 ─────────────────────────────────────────────

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
