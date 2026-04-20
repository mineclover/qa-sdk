---
def:
  id: payment-service-spec
  tier: system
  address: def_document:v2:68639
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: payment
  tags: [external]
  links:
    - target: shopping-backend-spec
      type: depends_on
    - target: payment-api
      type: contains
    - target: payment-data
      type: contains
---
# Payment Service

## 목적 ^purpose

결제 처리 서비스. 주문 완료 후 결제 트랜잭션을 처리하고, 결제 상태 변경 이벤트를 생산한다. shopping-backend와 협력하여 주문-결제 흐름을 구성한다.

## 구성 ^overview

Payment Service의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
