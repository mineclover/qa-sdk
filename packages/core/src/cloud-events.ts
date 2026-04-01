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

/** 내부 EventRecord (간소화 — 실제로는 @qa-sdk/core의 EventRecord 사용) */
export interface EventRecordLike {
  event_key: string;
  timestamp: string;
  payload?: Record<string, unknown>;
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

/** EventRecord → CloudEvent 변환 */
export function toCloudEvent(
  record: EventRecordLike,
  manifest: ManifestRef,
  eventId?: string,
): CloudEvent {
  const ce: CloudEvent = {
    specversion: "1.0",
    id: eventId ?? generateId(),
    type: record.event_key,
    source: manifest.source,
    time: record.timestamp,
    datacontenttype: "application/json",
  };

  if (record.payload) ce.data = record.payload;

  if (record.coordinate != null) {
    ce.subject = manifest.prefix
      ? `${manifest.prefix}:${manifest.prefixVersion ?? "v1"}:${record.coordinate}`
      : String(record.coordinate);
  }

  if (manifest.prefix) ce.qasdk_prefix = manifest.prefix;
  if (manifest.prefixVersion) ce.qasdk_prefixversion = manifest.prefixVersion;
  if (manifest.manifestVersion) ce.qasdk_manifestversion = manifest.manifestVersion;
  if (record.trace_id) ce.qasdk_traceid = record.trace_id;
  if (record.qa_session_id) ce.qasdk_sessionid = record.qa_session_id;

  return ce;
}

/** CloudEvent → EventRecord 변환 */
export function fromCloudEvent(ce: CloudEvent): EventRecordLike {
  const record: EventRecordLike = {
    event_key: ce.type,
    timestamp: ce.time,
  };

  if (ce.data) record.payload = ce.data as Record<string, unknown>;

  // subject에서 coordinate 추출
  if (ce.subject) {
    const parts = ce.subject.split(":");
    const lastPart = parts[parts.length - 1];
    const num = Number(lastPart);
    if (!isNaN(num)) record.coordinate = num;
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

/** 배치 변환 — EventRecord[] → CloudEvent[] */
export function toCloudEventBatch(
  records: EventRecordLike[],
  manifest: ManifestRef,
): CloudEvent[] {
  return records.map(r => toCloudEvent(r, manifest));
}

/** 배치 역변환 — CloudEvent[] → EventRecord[] */
export function fromCloudEventBatch(events: CloudEvent[]): EventRecordLike[] {
  return events.map(fromCloudEvent);
}

// ── 유틸 ─────────────────────────────────────────────

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
