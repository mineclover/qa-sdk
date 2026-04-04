---
def:
  id: registry-services-module
  address: def_document:v2:68876
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: mediation
  svc: registry-service
  tags: [runtime, entry-point, observability]
  links:
    - target: registry-service-modules
      type: refines
---
# Registry Services Module

## 목적 ^purpose

서비스 토폴로지, endpoint registry, application 요약, service health surface를 하나의 Nest 모듈로 묶어 `registry-service`의 서비스 메타데이터 API를 제공한다. config-backed topology와 endpoint overlay를 결합해 클라이언트가 서비스 주소와 gateway 구성을 한곳에서 조회하게 하는 것이 목적이다.

## 사용 맥락 ^context

`/api/services`, `/api/endpoints`, `/api/applications`, `/api/health/services`, service component version surface 변경 시 이 모듈을 본다. topology 변경 후 definition-service에서 affected test를 조회하는 경로, `PATCH /api/services`를 `PUT` alias로 유지하는 계약, endpoint store가 있을 때만 overlay를 적용하는 동작, child component lifecycle 및 assembly candidate read-model이 여기서 결정된다.

## 설계 의도 ^intent

`ServiceTopologyService`가 `ConfigStore("services")`와 `ServiceEndpointStore`를 함께 사용해 topology와 runtime URL overlay를 한 service 경계에 유지한다. controller는 transport adapter만 담당하고, `PATCH`와 `PUT`을 같은 `replaceAll()`로 연결해 기존 클라이언트 호환성을 지키며, application/service-health 조회는 같은 모듈 안에서 주변 읽기 모델로 분리한다.

## 구성 ^overview

- controllers:
  - `ServiceController`
  - `ServiceComponentController`
  - `EndpointController`
  - `ApplicationController`
  - `ServiceHealthController`
- providers/exports:
  - `SERVICE_CONFIG_STORE`
  - `SERVICE_ENDPOINT_STORE`
  - `SERVICE_COMPONENT_VERSION_STORE`
  - `SERVICE_HEALTH_BINDINGS`
  - `ServiceTopologyService`
  - `ServiceComponentService`
  - `EndpointService`
  - `ApplicationService`
  - `ServiceHealthService`
- surface:
  - `GET/POST/PATCH/PUT /api/services`
  - `GET/PUT /api/services/:serviceId/components/:kind/:version`
  - `POST /api/services/:serviceId/components/:kind/:version/transition`
  - `POST /api/services/:serviceId/deployments/sync`
  - `GET /api/services/:serviceId/components/:kind/published`
  - `GET /api/services/:serviceId/assembly-candidates`
  - `GET /api/services/svc-owners`
  - `GET /api/services/urls`
  - `GET /api/services/gateway`
  - `GET/DELETE /api/services/:serviceId`
  - `GET /api/endpoints`
  - `GET /api/endpoints/resolve`
  - `GET/PUT/DELETE /api/endpoints/:ns/:svc/:env/:region`
  - `GET/PUT /api/applications`
  - `GET /api/applications/:applicationId`
  - `GET /api/health/services`

## 관련 소스

- `packages/registry-service/src/modules/services/service.module.ts` — 모듈 조립과 export 경계
- `packages/registry-service/src/modules/services/service-topology.service.ts` — topology CRUD, gateway/url 계산, affected test 로그
- `packages/registry-service/src/modules/services/service.controller.ts` — `/api/services` HTTP adapter
- `packages/registry-service/src/modules/services/service-component.service.ts` — child component version/lifecycle/assembly candidate
- `packages/registry-service/src/modules/services/service-component.controller.ts` — service component HTTP adapter
- `packages/registry-service/src/modules/services/endpoint.service.ts` — endpoint registry/resolve 로직
- `packages/registry-service/src/modules/services/endpoint.controller.ts` — `/api/endpoints` HTTP adapter
- `packages/registry-service/src/modules/services/application.service.ts` — application 읽기 모델
- `packages/registry-service/src/modules/services/application.controller.ts` — `/api/applications` HTTP adapter
- `packages/registry-service/src/modules/services/service-health.service.ts` — service health 읽기 모델
- `packages/registry-service/src/modules/services/service-health.controller.ts` — `/api/health/services` HTTP adapter
