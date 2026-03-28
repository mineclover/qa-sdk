---
def:
  id: decode-svc-constraints
  address: def_document:v1:2137
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: decode-service
  tags: [tier-infra]
  links:
    - target: decode-service-system
      type: constrains
    - target: decode-svc-core-logic
      type: constrains
---
# Decode Service — 기술 제약

## 목적 ^purpose

decode-service의 동작을 제한하는 불변 조건과 에러 매핑 규칙을 정의한다.

## 구성 ^overview

### 에러 매핑 규칙

| 원본 에러 | HTTP | 코드 | 설명 |
|----------|------|------|------|
| EntryNotFoundError | 404 | NOT_FOUND | 엔트리 없음 |
| ParseError | 400 | INVALID_INPUT | 주소 파싱 실패 |
| ValidationError | 400 | INVALID_INPUT | 검증 실패 |
| IndexVersionNotFoundError | 404 | NOT_FOUND | 버전 없음 |
| IndexMetaError (기타) | 500 | INTERNAL_ERROR | 매핑 안 된 라이브러리 에러 |
| ZodError | 400 | INVALID_INPUT | 요청 스키마 검증 실패 |
| IndexRangeError | 400 | RANGE_EXCEEDED | 주소 범위 초과 |

### 제약 규칙

| 규칙 | 설명 |
|------|------|
| registry fetch timeout | AbortSignal.timeout(5_000) 필수 |
| fail-open 시작 | registry 미응답 시 빈 pool로 시작 (서비스 차단 없음) |
| batch 상한 | 10,000 inputs (Zod maxItems) |
| prefix+version 쌍 규칙 | 둘 다 있거나 둘 다 없어야 함 (하나만 → 400) |
| TTL 만료 후 미복구 | 만료된 decoder는 재로딩 없이 evict → 서비스 재시작 필요 |
