---
def:
  id: registry-events-spec
  address: def_document:v2:414851
  scope: interface
  aspect: event_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: registry-service
  tags: [contract, runtime, observability]
  links:
    - target: registry-data-model
      type: depends_on
    - target: registry-version-lifecycle
      type: depends_on
---

# Events API

## 목적 ^purpose

이벤트 정의 CRUD. event_key + event_version 으로 시맨틱 버전 관리.

## 구성 ^overview

- **이벤트 CRUD**: 서비스별 이벤트 정의 생성, 조회, 수정 엔드포인트 제공
- **버전 자동 발급**: event_version은 3자리 문자열로 자동 증가 (e.g. "001" → "002")
- **복합 유일성**: (service_id, event_key, event_version) 조합이 unique 제약
- **내부 계층**: EventService(비즈니스 로직) → EventRepository(데이터 접근) + Zod 검증 스키마

## 상태

implemented

## 엔드포인트

### POST /services/:serviceId/events

이벤트 정의 생성. 버전 자동 발급.

요청:
```json
{
  "event_key": "page_view",
  "description": "User viewed a page",
  "category": "navigation",
  "payload_schema": { ... }
}
```

응답 201: 생성된 EventEntry (event_version 자동 할당).

### GET /services/:serviceName/events/:eventKey

해당 event_key의 모든 버전 목록.

응답 200: EventEntry[].

### GET /services/:serviceName/events/:eventKey/versions/:eventVersion

특정 버전 조회.

응답 200: EventEntry.
응답 404: 이벤트/버전 없음.

### PATCH /events/:eventId

이벤트 수정.

요청: 변경할 필드만 포함.
응답 200: 수정된 EventEntry.

## 내부 구조

- `EventService` — 비즈니스 로직 (버전 자동 발급 포함)
- `EventRepository` — 데이터 접근
- `createEventSchema` / `updateEventSchema` — Zod 검증

## 제약 조건

- (service_id, event_key, event_version) 복합 unique
- event_version은 3자리 문자열 (e.g. "001", "002")
- 버전 자동 증가: 기존 최대 버전 + 1
- event_key는 snake_case 권장 (강제 아님)
