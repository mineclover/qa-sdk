---
def:
  id: dec-svc-constraints
  address: def_document:v1:2137
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: decision-service
  tags: [tier-infra, decision]
  links:
    - target: decision-service-system
      type: constrains
---
# Decision Service — 기술 제약

## 목적 ^purpose

decision-service의 동작을 제한하는 불변 조건.

## 구성 ^overview

### 서비스 간 참조 제약

| 규칙 | 설명 |
|------|------|
| definition-service 참조 fail-open | 문서 존재 확인 실패 시 연결 생성 허용 (문서가 나중에 만들어질 수 있음) |
| fetch timeout 3초 | AbortSignal.timeout(3_000) |
| 단방향 참조만 | decision → definition (역방향 호출 없음) |

### 데이터 제약

| 규칙 | 설명 |
|------|------|
| flow_links UNIQUE | (instance_id, doc_id, link_type) 중복 등록 무시 |
| instance.schema_version 고정 | 실행 중 스키마 변경 영향 없음 |
| selections 순서 보장 | gate 선택 순서 = 배열 인덱스 |

### 로깅 제약

| 규칙 | 설명 |
|------|------|
| createLogger 필수 | console.log/warn/error 사용 금지 — pino 구조화 로깅 |
| 서비스명 포함 | createLogger("decision-service") |
