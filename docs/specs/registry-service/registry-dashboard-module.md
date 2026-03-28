---
def:
  id: registry-dashboard-module
  address: def_document:v2:68872
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: experience
  svc: registry-service
  tags: [tier-infra]
  links:
    - target: registry-service-modules
      type: refines
---
# Registry Dashboard Module

## 목적 ^purpose

개발용 DKG 관찰 surface를 HTTP, HTML, WebSocket으로 제공해 registry-service가 catalog/graph 상태를 시각적으로 탐색하고 refresh 할 수 있게 한다. dashboard 계산 경로와 dev socket push를 한 모듈에 유지해 개발자 경험을 안정적으로 제공하는 것이 목적이다.

## 사용 맥락 ^context

`/api/dashboard`, `/api/diagrams`, `/dev`, `/dev/ws`가 어떤 provider와 graph를 통해 계산되는지 확인할 때 이 문서를 본다. dev dashboard가 env-gated optional integration이라 production path를 더럽히지 않아야 할 때, 그리고 catalog 변경이 dashboard cache invalidation으로 이어지는지 확인할 때 중요하다.

## 설계 의도 ^intent

`DashboardModule`은 `@Global()`로 선언해 `DEV_DKG_PROVIDER`를 전역 provider로 노출하고, `DashboardService`, `DiagramService`, `DevDashboardGateway`가 같은 provider를 공유하게 한다. provider 생성은 `buildDevDashboardProvider()`에 모으고, HTTP/WS payload 계산은 shared service/socket hub 경로를 재사용해 `/dev`와 `/api/dashboard` 간 drift를 막는다.

## 구성 ^overview

- controllers: `DiagramController`, `DashboardController`
- providers/exports:
  - `DEV_DKG_PROVIDER`
  - `DashboardService`
  - `DiagramService`
  - `DevDashboardGateway`
- surface:
  - `GET /dev`
  - `GET /dev/api/overview`
  - `GET /dev/api/flow-map`
  - `GET /dev/api/metrics`
  - `GET /dev/api/timeline`
  - `POST /dev/api/refresh`
  - `GET /dev/api/catalogs`
  - `GET /api/dashboard/overview`
  - `GET /api/dashboard/flow-map`
  - `GET /api/dashboard/metrics`
  - `GET /api/dashboard/timeline`
  - `GET /api/dashboard/schema`
  - `POST /api/dashboard/collect`
  - `GET /api/diagrams`
  - `GET /api/diagrams/:kind/:id`
  - `WS /dev/ws`

## 관련 소스

- `packages/registry-service/src/modules/dashboard/dashboard.module.ts` — global provider와 service 조립
- `packages/registry-service/src/modules/dashboard/dev-dashboard.provider.ts` — env-gated provider builder
- `packages/registry-service/src/modules/dashboard/dashboard.service.ts` — overview/flow-map/metrics/timeline 계산
- `packages/registry-service/src/modules/dashboard/diagram.service.ts` — Mermaid diagram 계산
- `packages/registry-service/src/modules/dashboard/dashboard.controller.ts` — dashboard/dev HTTP adapter
- `packages/registry-service/src/modules/dashboard/diagram.controller.ts` — diagrams HTTP adapter
- `packages/registry-service/src/modules/dashboard/dev-dashboard.gateway.ts` — `/dev/ws` gateway
- `packages/registry-service/src/modules/dashboard/dev-dashboard.socket-hub.ts` — push fan-out 허브
