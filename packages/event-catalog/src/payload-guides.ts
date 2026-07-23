// @def.boundary event-vocab-system
import type { PayloadFieldGuide } from './types.js';

export const payloadGuides: readonly PayloadFieldGuide[] = [
  // ── Navigation ───────────────────────────────────────
  {
    event_key: 'page_view',
    fields: [
      { name: 'page', required: true, type: 'string', description: '페이지 경로' },
      { name: 'title', required: false, type: 'string', description: '페이지 제목' },
      { name: 'referrer', required: false, type: 'string', description: '이전 페이지' },
      { name: 'query', required: false, type: 'string', description: '주요 쿼리 파라미터' },
      { name: 'flow_id', required: false, type: 'string', description: '연결된 시나리오 흐름' },
    ],
  },
  {
    event_key: 'screen_view',
    fields: [
      { name: 'screen', required: true, type: 'string', description: '화면 식별자' },
      { name: 'screen_class', required: false, type: 'string', description: '화면 클래스' },
      { name: 'referrer_screen', required: false, type: 'string', description: '이전 화면' },
      { name: 'flow_id', required: false, type: 'string', description: '연결 흐름' },
    ],
  },
  {
    event_key: 'route_change',
    fields: [
      { name: 'from', required: true, type: 'string', description: '이전 경로/화면' },
      { name: 'to', required: true, type: 'string', description: '이동 경로/화면' },
      { name: 'reason', required: false, type: 'string', description: '이동 원인' },
    ],
  },
  {
    event_key: 'app_open',
    fields: [
      { name: 'launch_type', required: false, type: 'string', description: 'cold/warm 등' },
      { name: 'entry_point', required: false, type: 'string', description: '실행 진입점' },
      { name: 'deep_link', required: false, type: 'string', description: '딥링크 값' },
    ],
  },

  // ── Interaction ──────────────────────────────────────
  {
    event_key: 'click',
    fields: [
      { name: 'element_id', required: true, type: 'string', description: '요소 식별자' },
      { name: 'page', required: false, type: 'string', description: '현재 페이지' },
      { name: 'element_text', required: false, type: 'string', description: '버튼/링크 텍스트' },
      { name: 'element_type', required: false, type: 'string', description: 'button/link/card' },
      { name: 'flow_id', required: false, type: 'string', description: '연결 흐름' },
    ],
  },
  {
    event_key: 'tap',
    fields: [
      { name: 'element_id', required: true, type: 'string', description: '요소 식별자' },
      { name: 'screen', required: false, type: 'string', description: '현재 화면' },
      { name: 'element_text', required: false, type: 'string', description: '표시 텍스트' },
      { name: 'gesture_type', required: false, type: 'string', description: 'single/double' },
    ],
  },

  // ── Form ─────────────────────────────────────────────
  {
    event_key: 'input_change',
    fields: [
      { name: 'field_name', required: true, type: 'string', description: '입력 필드명' },
      { name: 'field_present', required: false, type: 'boolean', description: '값 존재 여부' },
      { name: 'masked', required: false, type: 'boolean', description: '값 마스킹 여부' },
      { name: 'input_length', required: false, type: 'number', description: '입력 길이' },
      { name: 'valid', required: false, type: 'boolean', description: '검증 상태' },
    ],
  },
  {
    event_key: 'form_submit',
    fields: [
      { name: 'form_id', required: true, type: 'string', description: '폼 식별자' },
      { name: 'field_count', required: false, type: 'number', description: '필드 수' },
      { name: 'valid', required: false, type: 'boolean', description: '제출 시점 유효성' },
      { name: 'flow_id', required: false, type: 'string', description: '연결 흐름' },
    ],
  },

  // ── Session ──────────────────────────────────────────
  {
    event_key: 'session_start',
    fields: [
      { name: 'session_type', required: false, type: 'string', description: 'user/test/agent' },
      { name: 'entry_point', required: false, type: 'string', description: '진입 지점' },
      { name: 'flow_id', required: false, type: 'string', description: '연결 흐름' },
    ],
  },
  {
    event_key: 'session_end',
    fields: [
      { name: 'duration_ms', required: false, type: 'number', description: '세션 길이' },
      { name: 'end_reason', required: false, type: 'string', description: '종료 원인' },
      { name: 'flow_id', required: false, type: 'string', description: '연결 흐름' },
    ],
  },

  // ── Network ──────────────────────────────────────────
  {
    event_key: 'http_request',
    fields: [
      { name: 'method', required: true, type: 'string', description: 'GET/POST 등' },
      { name: 'route', required: true, type: 'string', description: 'API 경로' },
      {
        name: 'request_present_fields',
        required: false,
        type: 'string[]',
        description: '전달된 주요 필드',
      },
      { name: 'masked_fields', required: false, type: 'string[]', description: '마스킹 필드 목록' },
      { name: 'request_size', required: false, type: 'number', description: '요청 크기' },
      { name: 'target_service', required: false, type: 'string', description: '대상 서비스' },
    ],
  },
  {
    event_key: 'http_response',
    fields: [
      { name: 'method', required: true, type: 'string', description: '요청 메서드' },
      { name: 'route', required: true, type: 'string', description: 'API 경로' },
      { name: 'status_code', required: true, type: 'number', description: '응답 코드' },
      { name: 'duration_ms', required: false, type: 'number', description: '응답 시간' },
      { name: 'error_code', required: false, type: 'string', description: '내부 에러 코드' },
    ],
  },

  // ── Execution ────────────────────────────────────────
  {
    event_key: 'sdk_init',
    fields: [
      { name: 'sdk_instance_id', required: false, type: 'string', description: 'SDK 인스턴스' },
      { name: 'init_mode', required: false, type: 'string', description: 'auto/manual' },
      { name: 'config_version', required: false, type: 'string', description: '설정 버전' },
      { name: 'result', required: false, type: 'string', description: '성공/실패' },
    ],
  },
  {
    event_key: 'sdk_flush',
    fields: [
      {
        name: 'flush_reason',
        required: false,
        type: 'string',
        description: 'timer/manual/background',
      },
      { name: 'record_count', required: false, type: 'number', description: '전송 이벤트 수' },
      { name: 'success_count', required: false, type: 'number', description: '성공 수' },
      { name: 'failure_count', required: false, type: 'number', description: '실패 수' },
      { name: 'duration_ms', required: false, type: 'number', description: 'flush 시간' },
    ],
  },
  {
    event_key: 'task_start',
    fields: [
      { name: 'task_name', required: true, type: 'string', description: '작업 이름' },
      { name: 'task_type', required: false, type: 'string', description: 'qa/agent/job' },
      { name: 'input_present', required: false, type: 'boolean', description: '입력 존재 여부' },
    ],
  },
  {
    event_key: 'task_finish',
    fields: [
      { name: 'task_name', required: true, type: 'string', description: '작업 이름' },
      { name: 'result', required: false, type: 'string', description: 'success/failure' },
      { name: 'duration_ms', required: false, type: 'number', description: '소요 시간' },
      { name: 'reason', required: false, type: 'string', description: '실패/종료 이유' },
    ],
  },
  {
    event_key: 'tool_invoke',
    fields: [
      {
        name: 'tool',
        required: true,
        type: 'string',
        description: 'facade action 이름 (예: echoAdd)',
      },
      {
        name: 'provider_id',
        required: true,
        type: 'string',
        description: 'provider catalog id (예: echo-demo)',
      },
      {
        name: 'channel',
        required: true,
        type: 'string',
        description: '호출 경로: facade | mcp | direct',
      },
      { name: 'trace_id', required: false, type: 'string', description: '분산 trace id' },
      { name: 'session_id', required: false, type: 'string', description: 'QA 세션 id' },
    ],
  },
  {
    event_key: 'tool_result',
    fields: [
      { name: 'tool', required: true, type: 'string', description: 'facade action 이름' },
      { name: 'provider_id', required: true, type: 'string', description: 'provider catalog id' },
      {
        name: 'channel',
        required: true,
        type: 'string',
        description: '호출 경로: facade | mcp | direct',
      },
      { name: 'kind', required: true, type: 'string', description: 'FacadeCallResult kind' },
      { name: 'ok', required: true, type: 'boolean', description: '성공 여부 (kind === success)' },
      { name: 'duration_ms', required: true, type: 'number', description: '호출 소요 시간(ms)' },
      { name: 'status', required: false, type: 'number', description: 'HTTP status' },
      { name: 'url', required: false, type: 'string', description: 'facade/direct 요청 URL' },
      {
        name: 'error_code',
        required: false,
        type: 'string',
        description: 'application_error 코드',
      },
      { name: 'error_message', required: false, type: 'string', description: '오류 메시지' },
      {
        name: 'validation_issue_count',
        required: false,
        type: 'number',
        description: 'validation_error 이슈 수',
      },
      { name: 'trace_id', required: false, type: 'string', description: '분산 trace id' },
      { name: 'session_id', required: false, type: 'string', description: 'QA 세션 id' },
    ],
  },

  // ── Outcome ──────────────────────────────────────────
  {
    event_key: 'success',
    fields: [
      { name: 'target', required: false, type: 'string', description: '성공 대상' },
      { name: 'reason', required: false, type: 'string', description: '성공 이유' },
      { name: 'flow_id', required: false, type: 'string', description: '흐름 식별' },
    ],
  },
  {
    event_key: 'failure',
    fields: [
      { name: 'target', required: false, type: 'string', description: '실패 대상' },
      { name: 'reason', required: true, type: 'string', description: '실패 이유' },
      { name: 'error_code', required: false, type: 'string', description: '에러 코드' },
      { name: 'flow_id', required: false, type: 'string', description: '흐름 식별' },
    ],
  },

  // ── Quality ──────────────────────────────────────────
  {
    event_key: 'error',
    fields: [
      { name: 'error_type', required: true, type: 'string', description: '오류 유형' },
      { name: 'error_code', required: false, type: 'string', description: '에러 코드' },
      { name: 'message', required: false, type: 'string', description: '에러 메시지' },
      { name: 'recoverable', required: false, type: 'boolean', description: '복구 가능 여부' },
    ],
  },
  {
    event_key: 'assertion',
    fields: [
      { name: 'assertion_key', required: true, type: 'string', description: '검증 식별자' },
      { name: 'expected', required: false, type: 'string', description: '기대값' },
      { name: 'actual', required: false, type: 'string', description: '실제값' },
      { name: 'passed', required: true, type: 'boolean', description: '성공 여부' },
      { name: 'reason', required: false, type: 'string', description: '실패 사유' },
    ],
  },
  {
    event_key: 'context_runtime_observation',
    fields: [
      { name: 'task_key', required: true, type: 'string', description: '컨텍스트 task 식별자' },
      {
        name: 'stage',
        required: true,
        type: 'string',
        description: 'discovery/working/verification 단계',
      },
      { name: 'status', required: true, type: 'string', description: '현재 closure 상태' },
      { name: 'route_keys', required: true, type: 'string[]', description: '선택된 route 키' },
      { name: 'fact_count', required: true, type: 'number', description: '해소된 Fact 개수' },
      {
        name: 'manifest_digest',
        required: false,
        type: 'string',
        description: 'closed context manifest digest',
      },
      {
        name: 'discovery_tokens',
        required: false,
        type: 'number',
        description: 'Discovery 사용량',
      },
      { name: 'working_tokens', required: false, type: 'number', description: 'Working 사용량' },
      { name: 'total_tokens', required: false, type: 'number', description: '전체 사용량' },
      {
        name: 'usage_measurement',
        required: false,
        type: 'string',
        description: 'estimated/measured/mixed',
      },
    ],
  },
];

/** Lookup map: event_key → PayloadFieldGuide */
export const payloadGuideMap: ReadonlyMap<string, PayloadFieldGuide> = new Map(
  payloadGuides.map((g) => [g.event_key, g]),
);

/** Get payload field guide for an event. */
export function getPayloadGuide(eventKey: string): PayloadFieldGuide | undefined {
  return payloadGuideMap.get(eventKey);
}
