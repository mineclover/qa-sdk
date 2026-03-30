---
def:
  id: registry-events-module
  address: def_document:v2:68873
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: mediation
  svc: registry-service
  tags: [runtime, contract, observability]
  links:
    - target: registry-service-modules
      type: refines
---
# Registry Events Module

## 목적 ^purpose

event schema CRUD와 정적 event catalog 조회를 같은 Nest 모듈에서 제공해 registry-service가 이벤트 정의 저장소와 참조용 vocabulary surface를 함께 노출하게 한다. 저장형 API와 정적 카탈로그 API를 분리하지 않고도 drift 없이 유지하는 것이 이 모듈의 목표다.

## 사용 맥락 ^context

`/api/event-schemas`와 `/api/event-catalog` surface를 수정하거나, runtime dependency로 포함된 `@qa-sdk/event-catalog` 데이터를 어떤 service가 감싸는지 확인할 때 이 문서를 본다. 이벤트 정의를 DB에서 CRUD하면서도 정적 카탈로그 조회는 503 분기 없이 항상 같은 mapper로 반환해야 하는 상황에서 중요하다.

## 설계 의도 ^intent

`EventSchemaService`는 `EVENT_SCHEMA_STORE`를 통해 저장형 API만 담당하고, `EventCatalogService`는 `@qa-sdk/event-catalog` static import를 thin wrapper로 노출한다. controller가 selector나 mapper를 복제하지 않도록 두 서비스를 분리해 Hono/Nest 병행 기간 없이도 한 경로에서 semantics를 유지한다.

## 구성 ^overview

- controllers: `EventSchemaController`, `EventCatalogController`
- providers/exports: `EVENT_SCHEMA_STORE`, `EventSchemaService`, `EventCatalogService`
- surface:
  - `GET /api/event-schemas`
  - `GET /api/event-schemas/:serviceId/:eventKey`
  - `GET /api/event-schemas/:serviceId/:eventKey/:version`
  - `PUT /api/event-schemas/:serviceId/:eventKey/:version`
  - `DELETE /api/event-schemas/:serviceId/:eventKey/:version`
  - `GET /api/event-catalog`
  - `GET /api/event-catalog/events`
  - `GET /api/event-catalog/events/:key`
  - `GET /api/event-catalog/mappings`
  - `GET /api/event-catalog/categories`

## 관련 소스

- `packages/registry-service/src/modules/events/event.module.ts` — event store/provider 조립
- `packages/registry-service/src/modules/events/event-schema.service.ts` — event schema CRUD
- `packages/registry-service/src/modules/events/event-schema.controller.ts` — `/api/event-schemas` HTTP adapter
- `packages/registry-service/src/modules/events/event-catalog.service.ts` — 정적 event catalog wrapper
- `packages/registry-service/src/modules/events/event-catalog.controller.ts` — `/api/event-catalog` HTTP adapter
