/**
 * Decision Demo 페이지용 샘플 markdown.
 * 3종: skeleton(빈 결정), single-gate(단일 분기), multi-gate(다중 분기 + depends_on).
 */

export const SAMPLE_SKELETON = `---
id: auth-method
subject: 인증 방식 선택
lifecycle: draft
created: 2026-05-22T00:00:00.000Z
updated: 2026-05-22T00:00:00.000Z
---

# Decision

OAuth 통합 시 어떤 인증 방식을 채택할까? ^purpose

## 옵션

(미정)

## 증거

(미정)

## 결정

(미정) ^outcome
`;

export const SAMPLE_SINGLE_GATE = `---
id: token-storage
subject: 토큰 저장 위치
lifecycle: review
created: 2026-05-20T00:00:00.000Z
updated: 2026-05-22T00:00:00.000Z
---

# Decision

JWT 토큰을 어디에 저장할까? ^purpose ^phase:evaluate ^weight:structural

XSS와 CSRF 위험을 모두 고려해야 함 ^context

## 옵션

httpOnly Cookie — 서버 세팅, XSS 안전 ^option:cookie

서버 인프라 추가 필요 ^cost:cookie

XSS 면역, CSRF는 SameSite로 방어 ^benefit:cookie

LocalStorage — 클라이언트 제어, XSS 취약 ^option:localstorage

추가 인프라 0 ^benefit:localstorage

XSS 노출 시 즉시 탈취 ^risk:localstorage

Memory only — 새로고침 시 손실, 가장 안전 ^option:memory

새로고침마다 재인증 UX 손상 ^cost:memory

XSS/CSRF 모두 면역 ^benefit:memory

## 증거

OWASP 권장 사항: httpOnly cookie ^evidence:rule weight=3

이전 프로젝트에서 LocalStorage 사용 후 XSS 사고 발생 ^evidence:precedent weight=2

CSRF 토큰 추가 필요 ^evidence:rule weight=1
`;

export const SAMPLE_MULTI_GATE = `---
id: api-architecture
subject: API 아키텍처 설계
lifecycle: review
created: 2026-05-15T00:00:00.000Z
updated: 2026-05-22T00:00:00.000Z
---

# Decision

신규 마이크로서비스의 API 계약 형태와 통신 방식을 정한다 ^purpose

## Gate: 프로토콜 선택

^gate:protocol ^phase:perceive ^weight:core

REST/JSON — 가장 보편적, 디버깅 쉬움 ^option:rest

gRPC — 타입 안전, 성능 우수 ^option:grpc

GraphQL — 클라이언트 주도 쿼리 ^option:graphql

벤치마크: gRPC가 REST 대비 3배 처리량 ^evidence:data weight=3

팀 전체 REST 경험 5년+ ^evidence:precedent weight=2

## Gate: 스키마 관리

^gate:schema-mgmt ^phase:evaluate ^weight:structural ^depends_on:protocol:enables

OpenAPI 3 — REST 친화, 광범위한 생태계 ^option:openapi

Protobuf — gRPC 필수, 강한 타입 ^option:protobuf

스키마 호환성 검증 도구 필요 ^evidence:rule weight=2

## Gate: 배포 방식

^gate:deployment ^phase:plan ^weight:tactical ^depends_on:protocol:constrains ^depends_on:schema-mgmt:enables

Blue-Green — 무중단, 인프라 비용 2배 ^option:blue-green

Canary — 점진 롤아웃, 모니터링 복잡 ^option:canary

Rolling — 표준, 롤백 어려움 ^option:rolling
`;
