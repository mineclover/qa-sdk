---
def:
  tier: component
  id: payment-data
  address: def_document:v2:342028
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: payment
  tags: [external]
  links:
    - target: payment-service-spec
      type: refines
sources:
  - packages/demo-types/src/prefix-ids.ts
  - packages/demo-types/src/sdk-factory.ts
  - packages/demo-types/src/axes.ts
  - packages/demo-types/src/dsl.ts
  - packages/platform-demo-api/src/registry.ts
  - packages/platform-demo-api/src/index.ts
  - packages/dkg/src/service-topology.ts
---
# Payment — data/domain_data

## 목적 ^purpose

결제 흐름 관측 데이터. payment service enum, payment.* event_name, checkout flow/payment step, permission/order_event 소비 관계, seed log의 payment.initiate/payment.refund.fail 이벤트를 정의한다.

## 구성 ^overview

Payment — data/domain_data의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
