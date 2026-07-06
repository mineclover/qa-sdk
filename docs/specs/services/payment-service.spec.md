---
def:
  id: payment-service-spec
  tier: system
  address: def_document:v2:68639
  scope: feature
  aspect: domain_service_func
  depth: overview
  lifecycle: approved
  layer: domain
  svc: payment
  tags: [external, cross-scope]
  links:
    - target: shopping-backend-spec
      type: depends_on
    - target: payment-api
      type: contains
    - target: payment-data
      type: contains
sources:
  - packages/dkg/src/service-topology.ts
  - packages/demo-types/src/dsl.ts
  - packages/dkg/src/skills/trace-demo.test.ts
  - packages/dkg/src/skills/claim-operation.test.ts
  - packages/platform-demo-api/src/index.ts
  - packages/platform-demo-api/src/registry.ts
  - packages/platform-demo-api/scripts/read-api.test.ts
---
# Payment Service

## 목적 ^purpose

checkout DSL의 DKG/demo 결제 서비스 경계. payment는 prefix를 직접 소유하지 않고 permission, order_event, endpoint, service를 소비하며, platform-demo-api의 scenario/log/event 표면에서 결제 흐름 관측으로 나타난다.

## 구성 ^overview

Payment Service의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
