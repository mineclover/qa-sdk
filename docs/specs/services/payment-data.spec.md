---
def:
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
---
# Payment — data/domain_data

## 목적 ^purpose

결제 트랜잭션 데이터. 결제 상태, 환불, 정산 레코드.

## 구성 ^overview

Payment — data/domain_data의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
