// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * 에러 리포터 — 서비스 에러를 이벤트로 수집.
 *
 * CF Worker에서는 fire-and-forget으로 ingest에 전송.
 * ingest-server 자체에서는 직접 D1 삽입 가능.
 *
 * 이벤트 키: error.service (카테고리: quality)
 * payload: { service, code, message, path, method }
 */

export interface ErrorEvent {
  service: string;
  code: string;
  message: string;
  path?: string;
  method?: string;
  statusCode?: number;
}

/**
 * ingest API로 에러 이벤트를 전송하는 fire-and-forget 함수.
 * 실패 시 무시 — 에러 리포팅 자체가 에러를 발생시키면 안 됨.
 */
/** 에러 리포트 자체의 에러 → 무한 루프 방지용 플래그 */
let _reporting = false;

export function reportError(ingestUrl: string, event: ErrorEvent): void {
  if (!ingestUrl) return;
  // 무한 루프 방지: 리포트 중 에러 발생 시 스킵
  if (_reporting) return;
  // ingest-server 자체 에러는 자기에게 보내지 않음 (순환 방지)
  if (event.service === 'ingest-server') return;
  // error.service 이벤트 처리 중 에러도 스킵
  if (event.path === '/v1/ingest') return;

  const now = new Date().toISOString();
  const body = {
    transmission_id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sent_at: now,
    source: { service_name: event.service, sdk_name: 'error-reporter', sdk_version: '1.0' },
    build: { env: 'prod' },
    owner: { owner_type: 'agent', owner_id: 'error-reporter' },
    runtime: { platform: 'worker' },
    records: [
      {
        log_id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        trace_id: `err-trace-${event.service}-${Date.now()}`,
        span_id: 'err',
        timestamp: now,
        record_kind: 'log',
        event_key: 'error.service',
        event_version: '001',
        payload_format: 'json',
        payload_encoding: 'raw',
        payload_masking_applied: false,
        payload_masked_fields: [],
        payload: {
          service: event.service,
          code: event.code,
          message: event.message.slice(0, 500),
          path: event.path,
          method: event.method,
          statusCode: event.statusCode,
        },
      },
    ],
  };

  try {
    _reporting = true;
    fetch(`${ingestUrl}/v1/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3_000),
    })
      .catch(() => {})
      .finally(() => {
        _reporting = false;
      });
  } catch {
    _reporting = false;
  }
}

/**
 * Service Binding을 사용한 에러 리포트 (Worker→Worker 직접 호출).
 */
export function reportErrorViaBinding(
  binding: { fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response> },
  event: ErrorEvent,
): void {
  if (_reporting) return;
  if (event.service === 'ingest-server') return;
  const now = new Date().toISOString();
  const body = {
    transmission_id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sent_at: now,
    source: { service_name: event.service, sdk_name: 'error-reporter', sdk_version: '1.0' },
    build: { env: 'prod' },
    owner: { owner_type: 'agent', owner_id: 'error-reporter' },
    runtime: { platform: 'worker' },
    records: [
      {
        log_id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        trace_id: `err-trace-${event.service}-${Date.now()}`,
        span_id: 'err',
        timestamp: now,
        record_kind: 'log',
        event_key: 'error.service',
        event_version: '001',
        payload_format: 'json',
        payload_encoding: 'raw',
        payload_masking_applied: false,
        payload_masked_fields: [],
        payload: {
          service: event.service,
          code: event.code,
          message: event.message.slice(0, 500),
          path: event.path,
          method: event.method,
          statusCode: event.statusCode,
        },
      },
    ],
  };

  try {
    binding
      .fetch(
        new Request('https://internal/v1/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      )
      .catch(() => {});
  } catch {}
}
