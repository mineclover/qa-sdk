---
def:
  tier: component
  id: shopping-backend-data
  address: def_document:v2:342030
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: shopping-backend
  tags: [data, structural, runtime]
  links:
    - target: shopping-backend-spec
      type: refines
sources:
  - packages/demo-types/src/prefix-ids.ts
  - packages/demo-types/src/sdk-factory.ts
  - packages/demo-types/src/axes.ts
  - packages/demo-types/src/dsl.ts
  - packages/platform-demo-api/src/registry.ts
  - packages/platform-demo-api/src/demo-dashboard-read-model.ts
  - packages/dkg/src/service-topology.ts
  - packages/dkg/src/skills/service-explorer.test.ts
  - packages/dkg/src/skills/claim-operation.test.ts
---
# Shopping Backend — data/domain_data

## 목적 ^purpose

쇼핑 백엔드의 DKG/demo 데이터 경계. cart_event, order_event, permission, event prefix와 service binding, checkout/commerce/auth DSL 멤버십, demo registry/read-model 좌표 데이터를 정의한다.

## 구성 ^overview

Shopping Backend — data/domain_data의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
