---
def:
  tier: component
  id: dashboard-features
  address: def_document:v2:68619
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: experience
  svc: dashboard
  tags: [external]
  links:
    - target: dashboard-service-spec
      type: refines
sources:
  - packages/registry-service/src/modules/dashboard/dashboard.controller.ts
  - packages/registry-service/src/modules/dashboard/dashboard.service.ts
  - packages/registry-service/src/modules/dashboard/dev-dashboard.gateway.ts
  - packages/registry-service/src/modules/dashboard/dev-dashboard.socket-hub.ts
  - packages/registry-service/src/modules/dashboard/dashboard.controller.test.ts
  - packages/registry-service/src/modules/dashboard/dev-dashboard.gateway.test.ts
  - packages/registry-service/src/e2e/dashboard-and-events.test.ts
---
# Dashboard — feature/func_def

## 목적 ^purpose

DKG 대시보드 기능. 노드 요약, 흐름 맵, 메트릭 집계, 타임라인.

## 구성 ^overview

Dashboard — feature/func_def의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
