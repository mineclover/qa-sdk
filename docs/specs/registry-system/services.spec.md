---
def:
  tier: component
  id: registry-services-api-spec
  address: def_document:v2:412829
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: registry-service
  tags: [contract, runtime, entry-point]
  links:
    - target: registry-data-model
      type: depends_on
sources:
  - packages/registry-service/src/modules/services/service.controller.ts
  - packages/registry-service/src/modules/services/service-topology.service.ts
  - packages/registry-service/src/modules/services/service.types.ts
  - packages/registry-service/src/modules/services/endpoint.controller.ts
  - packages/registry-service/src/modules/services/endpoint.service.ts
  - packages/registry-service/src/modules/services/service.controller.test.ts
  - packages/registry-service/src/modules/services/service-topology.service.test.ts
  - packages/registry-service/src/modules/services/service-control-plane.test.ts
---

# Services API

## 목적 ^purpose

서비스 디스커버리에 쓰이는 서비스 topology, svc-owner projection, runtime URL overlay, gateway route를 등록, 조회, 수정하는 Registry API 계약과 검증 범위를 정의한다.

## 구성 ^overview

- **엔드포인트**: `/api/services` 목록/단건/upsert/replace/delete, `/api/services/svc-owners`, `/api/services/urls`, `/api/services/gateway`
- **내부 계층**: `ServiceController` → `ServiceTopologyService` → `ConfigStore("services")` + optional `ServiceEndpointStore`
- **제약**: `serviceId`와 `name`은 upsert 입력 필수, catalog 기본값은 `demo`, endpoint overlay가 있으면 config URL보다 우선한다.

## 상태

implemented

## 엔드포인트

### GET /api/services

서비스 목록 조회. `catalog` 쿼리 생략 시 `demo`.

### GET /api/services/:serviceId

서비스 단건 조회.

### POST /api/services

서비스 단건 추가/갱신. 요청에는 `serviceId`, `name`이 필요하다.

### PUT/PATCH /api/services

전체 서비스 목록 교체. `PATCH`와 `PUT`은 같은 `replaceAll()` 경로로 연결된다.

요청:

```json
{
  "services": [
    {
      "serviceId": "ingest-server",
      "name": "Ingest Server",
      "ownedPrefixes": ["event_record"],
      "gatewayPath": "/v1/ingest"
    }
  ]
}
```

### DELETE /api/services/:serviceId

서비스 단건 삭제.

### GET /api/services/svc-owners

서비스의 `ownedPrefixes`를 `prefix -> serviceId` 맵으로 투영한다.

### GET /api/services/urls

`catalog`, `env`, `namespace`, `region` 쿼리로 runtime URL 맵을 조회한다. `ServiceEndpointStore` overlay가 있으면 우선하고, 없으면 service config의 `urls[env]` 또는 `url`을 사용한다.

### GET /api/services/gateway

`gatewayPath`가 있는 서비스만 gateway route로 투영한다.

## 내부 구조

- `ServiceController` — HTTP adapter
- `ServiceTopologyService` — config-backed topology read/write와 endpoint overlay 조합
- `ServiceRecord` — topology payload shape

## 제약 조건

- `serviceId`, `name` 필수
- catalog 범위는 쿼리 파라미터로 결정하며 기본값은 `demo`
- `replaceAll()` 입력은 `{ services: ServiceRecord[] }`
