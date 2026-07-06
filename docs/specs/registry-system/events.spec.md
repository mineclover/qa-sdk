---
def:
  tier: component
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
sources:
  - packages/registry-service/src/modules/events/event-schema.controller.ts
  - packages/registry-service/src/modules/events/event-schema.service.ts
  - packages/registry-service/src/modules/events/event-catalog.controller.ts
  - packages/registry-service/src/modules/events/event-catalog.service.ts
  - packages/registry-service/src/stores/event-schema-store.ts
  - packages/registry-service/src/modules/events/event.controller.test.ts
  - packages/registry-service/src/e2e/dashboard-and-events.test.ts
---

# Events API

## 목적 ^purpose

저장형 이벤트 스키마 CRUD와 정적 event-catalog 조회를 함께 제공한다. 저장형 스키마는 catalogId + serviceId + eventKey + eventVersion 조합으로 버전 관리한다.

## 구성 ^overview

- **저장형 스키마 CRUD**: `/api/event-schemas`에서 서비스별 이벤트 스키마를 list/get/upsert/delete한다.
- **정적 카탈로그 조회**: `/api/event-catalog`에서 event-catalog 요약, events, mappings, packs, adoptions, taxonomy 점검을 제공한다.
- **복합 키**: (catalogId, serviceId, eventKey, eventVersion) 조합이 저장소 primary key다.
- **내부 계층**: `EventSchemaController` → `EventSchemaService` → `EventSchemaStore`, `EventCatalogController` → `EventCatalogService`.

## 상태

implemented

## 엔드포인트

### GET /api/event-schemas

저장형 이벤트 스키마 목록. `catalog`, `service` 쿼리 지원.

### GET /api/event-schemas/:serviceId/:eventKey

특정 service/eventKey의 버전 목록.

### GET /api/event-schemas/:serviceId/:eventKey/:version

특정 이벤트 스키마 버전 조회.

### PUT /api/event-schemas/:serviceId/:eventKey/:version

저장형 이벤트 스키마 생성/갱신. displayName, description, recordKind, status를 body로 받는다.

### DELETE /api/event-schemas/:serviceId/:eventKey/:version

저장형 이벤트 스키마 삭제.

### GET /api/event-catalog

정적 event-catalog 요약.

### GET /api/event-catalog/events

정적 이벤트 목록. `category`, `channel` 필터 지원.

### GET /api/event-catalog/adoptions

service adoption 목록. `catalog` 기본값은 `demo`.

## 내부 구조

- `EventSchemaController` — 저장형 이벤트 스키마 HTTP adapter
- `EventSchemaService` — EventSchemaStore 접근과 404/응답 shape 처리
- `EventCatalogController` — 정적 event-catalog와 adoption/taxonomy 조회 adapter
- `EventCatalogService` — event-catalog 정적 데이터와 catalog adoption config 조합

## 제약 조건

- (catalogId, serviceId, eventKey, eventVersion) 복합 키
- eventVersion은 호출자가 경로에서 명시한다.
- recordKind는 `log | span | both`, status는 `active | deprecated | retired`
