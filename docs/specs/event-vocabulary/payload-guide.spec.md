---
def:
  id: payload-guide
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [tier-system]
  links:
    - target: event-core-pattern
      type: depends_on
---

# Payload Field Guide

## 목적 ^purpose

Core Event별 권장 payload 필드 가이드. SDK, 엔진, DSL이 같은 필드 이름으로 소통하기 위한 규격.

## 구성 ^overview

- **대상 이벤트 20종**: Navigation(4), Interaction(2), Form(2), Session(2), Network(2), Execution(4), Outcome(2), Quality(2)
- **필드 3계층**: 필수(이벤트 의미 식별 핵심), 권장(DSL constraint 공통 축), 확장(서비스별 자유)
- **PayloadFieldDef 구조**: name, required, type(string/number/boolean/string[]), description
- **정책**: required 필드 누락 시 경고만(거부 안 함), 민감값은 `_present`/`_masked` 검증 우선, 가이드 외 필드도 payload 확장 가능

## 상태

implemented

## 목적

- QA 엔진이 constraint 비교할 때 참조할 필드명 표준
- SDK가 자동 수집할 때 어떤 필드를 채울지 가이드
- 시나리오 DSL이 조건을 걸 때 사용할 필드명 제공

## 필드 정의 구조

```typescript
interface PayloadFieldDef {
  name: string;         // 필드명
  required: boolean;    // 필수 여부
  type: "string" | "number" | "boolean" | "string[]";
  description: string;  // 설명
}
```

## 설계 규칙

- **필수 필드**는 최소화 — 이벤트 의미를 식별하는 핵심만
- **권장 필드**는 공통 비교 축 제공 — DSL constraint에서 자주 사용될 것
- **확장 필드**는 서비스별 자유 허용 — 가이드에 없는 필드도 payload에 포함 가능

## 가이드 제공 이벤트 (20개, v1 최소 핵심 세트)

### Navigation
- `page_view`: page(필수), title, referrer, query, flow_id
- `screen_view`: screen(필수), screen_class, referrer_screen, flow_id
- `route_change`: from(필수), to(필수), reason
- `app_open`: launch_type, entry_point, deep_link

### Interaction
- `click`: element_id(필수), page, element_text, element_type, flow_id
- `tap`: element_id(필수), screen, element_text, gesture_type

### Form
- `input_change`: field_name(필수), field_present, masked, input_length, valid
- `form_submit`: form_id(필수), field_count, valid, flow_id

### Session
- `session_start`: session_type, entry_point, flow_id
- `session_end`: duration_ms, end_reason, flow_id

### Network
- `http_request`: method(필수), route(필수), request_present_fields, masked_fields, request_size, target_service
- `http_response`: method(필수), route(필수), status_code(필수), duration_ms, error_code

### Execution
- `sdk_init`: sdk_instance_id, init_mode, config_version, result
- `sdk_flush`: flush_reason, record_count, success_count, failure_count, duration_ms
- `task_start`: task_name(필수), task_type, input_present
- `task_finish`: task_name(필수), result, duration_ms, reason

### Outcome
- `success`: target, reason, flow_id
- `failure`: reason(필수), target, error_code, flow_id

### Quality
- `error`: error_type(필수), error_code, message, recoverable
- `assertion`: assertion_key(필수), passed(필수), expected, actual, reason

## 제약 조건

- 가이드에 없는 core event도 payload 자유 확장 가능
- required 필드 누락은 SDK/엔진에서 경고하되 거부하지 않음 (warn 정책)
- 민감값은 값 자체보다 `_present`, `_masked` 검증 우선
