---
def:
  id: shopping-backend-spec
  tier: layout
  address: def_document:v2:68644
  scope: feature
  aspect: domain_service_func
  depth: overview
  lifecycle: approved
  layer: domain
  svc: shopping-backend
  tags: [entry-point, runtime, observability]
  links:
    - target: system-infra
      type: refines
    - target: shopping-backend-api
      type: refs
    - target: shopping-backend-data
      type: refs
sources:
  - packages/dkg/src/service-topology.ts
  - packages/dkg/src/skills/service-explorer.ts
  - packages/dkg/src/skills/service-explorer.test.ts
  - packages/dkg/src/skills/trace-demo.test.ts
  - packages/dkg/src/skills/claim-operation.ts
  - packages/dkg/src/skills/claim-operation.test.ts
  - packages/demo-types/src/dsl.ts
  - packages/platform-demo-api/src/demo-dashboard-read-model.ts
  - packages/platform-demo-api/src/registry.ts
---
# Shopping Backend

## 목적 ^purpose

쇼핑 도메인의 DKG/demo 백엔드 서비스 경계. cart_event, order_event, permission, event prefix를 소유하고 checkout/commerce/auth DSL 결합에서 주문 흐름, 권한, 이벤트 영향을 추적한다.

## 구성 ^overview

Shopping Backend의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
